// Nova's Safe Simulator leaderboard, served at /api/safe.
//   GET                                   top players by reds (?limit=, max 50)
//   POST {action:"join", name, reds, purples}     claim a username; returns a secret token
//   POST {action:"sync", id, token, seq, reds, purples}  add reds/purples found since the last sync
// The rare drop used to be a white item; records and requests that still say "whites" are read as purples.
//   DELETE ?name=                         remove a player (needs the x-admin-key header)
//
// Clicks happen in the browser, so the server can't see them. To keep the board
// honest-ish it only accepts up to MAX_PER_SEC reds per second of real time, and
// caps what a new player can carry over when joining.

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { adminError, clean, hash, isBlocked, json } from "../lib/shared.mjs";

const BOARD_SIZE = 50;
const DEFAULT_LIMIT = 20;
const MAX_PER_SEC = 20;
const MAX_WINDOW_MS = 60_000;
const JOIN_CARRY_REDS = 1000;
const JOIN_CARRY_PURPLES = 5;
const JOIN_COOLDOWN_MS = 2 * 60_000;
const NAME_PATTERN = /^[A-Za-z0-9 _.-]{2,20}$/;
const ID_PATTERN = /^[a-f0-9]{16}$/;
const RESERVED = new Set(["bif", "bifsterr", "nova", "bartholomew", "admin", "moderator", "bifdma"]);

export default async (req, context) => {
  const store = getStore({ name: "safe-sim", consistency: "strong" });
  return handleRequest(req, context, store, process.env.REVIEWS_ADMIN_KEY);
};

export const config = { path: "/api/safe" };

// Kept separate from the default export so it can be tested with an in-memory store.
export async function handleRequest(req, context, store, adminKey) {
  try {
    if (req.method === "GET") return await getBoard(req, store);
    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: "That didn't make it. Try again." }, 400);
      }
      if (body.action === "join") return await join(body, context, store);
      if (body.action === "sync") return await sync(body, store);
      return json({ error: "Unknown action." }, 400);
    }
    if (req.method === "DELETE") return await removePlayer(req, store, adminKey);
    return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
  } catch (err) {
    console.error(err);
    return json({ error: "Something broke. Nova has been informed." }, 500);
  }
}

async function getBoard(req, store) {
  const requested = Number(new URL(req.url).searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requested, 1), BOARD_SIZE);
  const board = (await store.get("board", { type: "json" })) || { players: [] };
  const players = board.players.slice(0, limit).map((p, i) => ({ rank: i + 1, name: p.name, reds: p.reds, purples: purplesOf(p) }));
  return json({ players }, 200, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
  });
}

async function join(body, context, store) {
  // Hidden form field that only bots fill in.
  if (body.website) return json({ error: "Couldn't join right now." }, 400);

  const name = clean(body.name, 40); // longer than allowed so too-long names fail below instead of being cut
  if (!NAME_PATTERN.test(name)) {
    return json({ error: "Use 2–20 letters, numbers, spaces, dots, dashes or underscores." }, 400);
  }
  if (isBlocked(name)) return json({ error: "Pick a different name." }, 400);
  if (RESERVED.has(name.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
    return json({ error: "That name is reserved. Nice try." }, 400);
  }

  const ipKey = `joinip/${hash(context?.ip || "unknown")}`;
  const lastJoin = await store.get(ipKey, { type: "json" });
  if (lastJoin && Date.now() - lastJoin.at < JOIN_COOLDOWN_MS) {
    return json({ error: "You just joined. Wait a couple of minutes before making another name." }, 429);
  }

  const id = randomBytes(8).toString("hex");
  // Claiming the name only succeeds if nobody has it yet (case-insensitive).
  const claim = await store.setJSON(nameKey(name), { id }, { onlyIfNew: true });
  if (!claim.modified) return json({ error: "That name is taken. Try another one." }, 409);

  const localReds = toCount(body.reds);
  const localPurples = toCount(body.purples ?? body.whites);
  const now = Date.now();
  const token = randomBytes(24).toString("base64url");
  const player = {
    id,
    name,
    reds: Math.min(localReds, JOIN_CARRY_REDS),
    purples: Math.min(localPurples, JOIN_CARRY_PURPLES),
    tokenHash: hash(token),
    lastSeq: 0,
    lastSyncAt: now,
    joinedAt: now,
  };
  try {
    await store.setJSON(`player/${id}`, player);
  } catch (err) {
    await store.delete(nameKey(name)); // don't leave the name claimed by nobody
    throw err;
  }
  await store.setJSON(ipKey, { at: now });
  const board = await updateBoard(store, player);

  return json({
    id,
    token,
    name,
    reds: player.reds,
    purples: player.purples,
    capped: localReds > player.reds,
    rank: rankOf(board, id),
  }, 201);
}

async function sync(body, store) {
  const id = String(body.id || "");
  if (!ID_PATTERN.test(id)) return json({ error: "Unknown player." }, 404);
  // Each batch has a number, so a batch resent after the page closed mid-request isn't counted twice.
  const seq = Number(body.seq);
  if (!Number.isSafeInteger(seq) || seq < 1) return json({ error: "Missing sync number." }, 400);

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.getWithMetadata(`player/${id}`, { type: "json" });
    if (!current) return json({ error: "Unknown player." }, 404);
    const player = current.data;
    const purplesSoFar = purplesOf(player);
    if (hash(String(body.token || "")) !== player.tokenHash) return json({ error: "That isn't your name." }, 401);
    if (seq <= (player.lastSeq || 0)) {
      const board = await readBoard(store);
      return json({ reds: player.reds, purples: purplesSoFar, accepted: 0, duplicate: true, rank: rankOf(board, id) }, 200);
    }

    // Accept at most MAX_PER_SEC finds per second since the last sync (window capped),
    // so faking a huge number doesn't work and neither does saving it up.
    const now = Date.now();
    const elapsed = Math.min(Math.max(now - player.lastSyncAt, 0), MAX_WINDOW_MS);
    const budget = Math.floor((elapsed * MAX_PER_SEC) / 1000);
    const purples = Math.min(toCount(body.purples ?? body.whites), budget);
    const reds = Math.min(toCount(body.reds), budget - purples);

    const { whites: _oldField, ...rest } = player;
    const next = { ...rest, reds: player.reds + reds, purples: purplesSoFar + purples, lastSeq: seq, lastSyncAt: now };
    const write = await store.setJSON(`player/${id}`, next, { onlyIfMatch: current.etag });
    if (!write.modified) continue; // another tab synced at the same time; retry

    const board = reds || purples ? await updateBoard(store, next) : await readBoard(store);
    return json({ reds: next.reds, purples: next.purples, accepted: reds + purples, rank: rankOf(board, id) }, 200);
  }
  return json({ error: "Busy. Try again." }, 503);
}

async function removePlayer(req, store, adminKey) {
  const denied = adminError(req, adminKey);
  if (denied) return denied;
  const name = clean(new URL(req.url).searchParams.get("name"), 20);
  const entry = name && (await store.get(nameKey(name), { type: "json" }));
  if (!entry) return json({ error: "No player with that name." }, 404);

  await store.delete(`player/${entry.id}`);
  await store.delete(nameKey(name));
  await editBoard(store, (players) => players.filter((p) => p.id !== entry.id));
  return json({ deleted: name }, 200);
}

// Keeps the top BOARD_SIZE players in one blob so reading the board is a single request.
async function updateBoard(store, player) {
  const entry = { id: player.id, name: player.name, reds: player.reds, purples: purplesOf(player), at: Date.now() };
  return editBoard(store, (players) => {
    const others = players.filter((p) => p.id !== entry.id);
    const wasOnBoard = others.length !== players.length;
    const lowest = others[others.length - 1];
    if (!wasOnBoard && others.length >= BOARD_SIZE && entry.reds <= lowest.reds) return null;
    return [...others, entry].sort(byScore).slice(0, BOARD_SIZE);
  });
}

// Applies change(players) to the board with a conditional write, retrying on conflicts.
// change returns the new list, or null for "no change".
async function editBoard(store, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await store.getWithMetadata("board", { type: "json" });
    const players = current?.data?.players || [];
    const next = change(players);
    if (!next) return players;
    const write = current
      ? await store.setJSON("board", { players: next }, { onlyIfMatch: current.etag })
      : await store.setJSON("board", { players: next }, { onlyIfNew: true });
    if (write.modified) return next;
  }
  return null;
}

async function readBoard(store) {
  return ((await store.get("board", { type: "json" })) || { players: [] }).players;
}

function byScore(a, b) {
  return b.reds - a.reds || a.at - b.at;
}

function rankOf(players, id) {
  if (!players) return null;
  const index = players.findIndex((p) => p.id === id);
  return index === -1 ? null : index + 1;
}

function purplesOf(record) {
  return record.purples ?? record.whites ?? 0;
}

function nameKey(name) {
  return `name/${hash(name.toLowerCase())}`;
}

function toCount(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1_000_000) : 0;
}
