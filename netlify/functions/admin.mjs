// Admin API for bifdma.org, served at /api/admin. Every request needs the x-admin-key header.
//   GET ?action=whoami               who the key belongs to ({ role, name })
//   GET ?action=stats                site stats
//   GET ?action=admins               list admins (owner only)
//   POST {action:"create-admin", name}  make someone an admin; returns their key once (owner only)
//   DELETE ?id=                      revoke an admin (owner only)

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { netlifyAuth, notAdmin } from "../lib/auth.mjs";
import { PRIVATE, clean, dayKey, hash, isBlocked, json } from "../lib/shared.mjs";

const ID_PATTERN = /^[a-f0-9]{16}$/;
const STAT_DAYS = 7;
const MAX_PLAYERS_SUMMED = 2000;

export default async (req, context) => {
  const store = (name) => getStore({ name, consistency: "strong" });
  const stores = {
    admins: store("admins"),
    stats: store("stats"),
    reviews: store("reviews"),
    safe: store("safe-sim"),
    feedback: store("feedback"),
    clips: store("clips"),
  };
  return handleRequest(req, context, stores, netlifyAuth());
};

export const config = { path: "/api/admin" };

// Kept separate from the default export so it can be tested with in-memory stores.
export async function handleRequest(req, context, stores, auth) {
  try {
    const me = await auth(req);
    if (!me) return notAdmin();
    const action = new URL(req.url).searchParams.get("action");

    if (req.method === "GET" && action === "whoami") return json({ role: me.role, name: me.name }, 200, PRIVATE);
    if (req.method === "GET" && action === "stats") return json(await siteStats(stores), 200, PRIVATE);

    // Everything below manages admins, which only the owner can do.
    if (me.role !== "owner") return json({ error: "Only the owner can manage admins." }, 403, PRIVATE);
    if (req.method === "GET" && action === "admins") return json({ admins: await listAdmins(stores.admins) }, 200, PRIVATE);
    if (req.method === "POST") return await createAdmin(req, stores.admins);
    if (req.method === "DELETE") return await revokeAdmin(req, stores.admins);
    return json({ error: "Unknown action." }, 400, PRIVATE);
  } catch (err) {
    console.error(err);
    return json({ error: "Something broke. Nova has been informed." }, 500, PRIVATE);
  }
}

async function listAdmins(adminStore) {
  const { blobs } = await adminStore.list({ prefix: "admin/" });
  const admins = await Promise.all(blobs.map((b) => adminStore.get(b.key, { type: "json" })));
  return admins
    .filter(Boolean)
    .map(({ id, name, createdAt }) => ({ id, name, createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function createAdmin(req, adminStore) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "That didn't make it. Try again." }, 400, PRIVATE);
  }
  if (body.action !== "create-admin") return json({ error: "Unknown action." }, 400, PRIVATE);
  const name = clean(body.name, 40);
  if (name.length < 2 || name.length > 30) return json({ error: "Give them a name between 2 and 30 characters." }, 400, PRIVATE);
  if (isBlocked(name)) return json({ error: "Pick a different name." }, 400, PRIVATE);
  const existing = await listAdmins(adminStore);
  if (existing.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
    return json({ error: `There's already an admin called ${name}.` }, 409, PRIVATE);
  }

  const id = randomBytes(8).toString("hex");
  const key = `bif_${randomBytes(24).toString("base64url")}`;
  const admin = { id, name, createdAt: new Date().toISOString(), keyHash: hash(key) };
  await adminStore.setJSON(`admin/${id}`, admin);
  await adminStore.setJSON(`key/${admin.keyHash}`, { id });
  // The key is only ever shown here; afterwards only its hash exists.
  return json({ admin: { id, name, createdAt: admin.createdAt }, key }, 201, PRIVATE);
}

async function revokeAdmin(req, adminStore) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return json({ error: "Unknown admin." }, 400, PRIVATE);
  const admin = await adminStore.get(`admin/${id}`, { type: "json" });
  if (!admin) return json({ error: "Unknown admin." }, 404, PRIVATE);
  await adminStore.delete(`key/${admin.keyHash}`);
  await adminStore.delete(`admin/${id}`);
  return json({ revoked: id }, 200, PRIVATE);
}

async function siteStats(stores) {
  const count = async (store, prefix) => (await store.list({ prefix })).blobs.length;
  const counter = async (key) => (await stores.stats.get(key, { type: "json" }))?.n || 0;

  const days = Array.from({ length: STAT_DAYS }, (_, i) => dayKey(i)).reverse(); // oldest first
  const byDay = await Promise.all(days.map(async (day) => ({
    day,
    views: await counter(`day/views/${day}`),
    visitors: await counter(`day/visitors/${day}`),
  })));

  const { blobs: playerBlobs } = await stores.safe.list({ prefix: "player/" });
  const players = await Promise.all(
    playerBlobs.slice(0, MAX_PLAYERS_SUMMED).map((b) => stores.safe.get(b.key, { type: "json" })),
  );
  const board = (await stores.safe.get("board", { type: "json" }))?.players || [];

  const [viewsTotal, buys, zaps, reviews, feedback, clips, admins] = await Promise.all([
    counter("total/views"),
    counter("total/buys"),
    counter("total/zaps"),
    count(stores.reviews, "review/"),
    count(stores.feedback, "feedback/"),
    count(stores.clips, "clip/"),
    count(stores.admins, "admin/"),
  ]);
  const today = byDay[byDay.length - 1];

  return {
    views: { today: today.views, week: sum(byDay, "views"), total: viewsTotal },
    visitors: { today: today.visitors, week: sum(byDay, "visitors") },
    byDay,
    buyAttempts: buys,
    zaps,
    reviews,
    players: playerBlobs.length,
    redsFound: players.reduce((n, p) => n + (p?.reds || 0), 0),
    topPlayer: board[0] ? { name: board[0].name, reds: board[0].reds } : null,
    feedback,
    clips,
    admins: admins + 1, // plus the owner
  };
}

function sum(rows, field) {
  return rows.reduce((n, row) => n + row[field], 0);
}
