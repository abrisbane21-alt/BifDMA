// One-off move of the old data from Netlify Blobs into this site's database, served at /api/import.
//   POST   copy reviews, leaderboard, suggestions, clips, admins and stats across (owner only)
// Needs NETLIFY_SITE_ID and NETLIFY_TOKEN in Vercel's environment variables. Safe to run more than
// once: nothing is copied twice, and anything added since the move to Vercel is kept.

import { getStore as getNetlifyStore } from "@netlify/blobs";
import { notAdmin, siteAuth } from "../lib/auth.js";
import { PRIVATE, dayKey, json } from "../lib/shared.js";
import { getStore } from "../lib/store.js";
import { JOIN_CARRY_PURPLES, JOIN_CARRY_REDS, nameKey, purplesOf, rebuildBoard } from "./safe.js";
import { DAY_TTL } from "./track.js";

const READ_CONCURRENCY = 8;

// Vercel calls the exported function named after the request method.
export const POST = (req) => {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_TOKEN;
  const netlify = siteID && token ? (name) => getNetlifyStore({ name, siteID, token }) : null;
  const stores = {
    reviews: getStore("reviews"),
    safe: getStore("safe-sim"),
    feedback: getStore("feedback"),
    clips: getStore("clips"),
    admins: getStore("admins"),
    stats: getStore("stats"),
  };
  return handleRequest(req, { netlify, stores }, siteAuth());
};

// Kept separate from the export above so it can be tested with local stores.
// netlify(name) opens an old Netlify Blobs store, or is null when Netlify isn't set up.
export async function handleRequest(req, { netlify, stores }, auth) {
  try {
    const me = await auth(req);
    if (!me) return notAdmin();
    if (me.role !== "owner") return json({ error: "Only the owner can import data." }, 403, PRIVATE);
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST", ...PRIVATE });
    if (!netlify) {
      return json({ error: "Add NETLIFY_SITE_ID and NETLIFY_TOKEN in Vercel's environment variables, redeploy, then try again." }, 400, PRIVATE);
    }

    const cutoff = dayKey(Math.floor(DAY_TTL / 86_400));
    const [reviews, safe, feedback, clips, admins, stats] = await Promise.all([
      readOld(netlify("reviews"), (k) => k.startsWith("review/")),
      readOld(netlify("safe-sim"), (k) => k.startsWith("player/") || k.startsWith("name/")),
      readOld(netlify("feedback"), (k) => k.startsWith("feedback/")),
      readOld(netlify("clips"), (k) => k.startsWith("clip/")),
      readOld(netlify("admins"), (k) => k.startsWith("admin/")),
      readOld(netlify("stats"), (k) => k.startsWith("total/") || (k.startsWith("day/") && k.slice(-10) >= cutoff)),
    ]);

    const players = await importPlayers(safe, stores.safe);
    const imported = {
      reviews: await copyNew(reviews, stores.reviews),
      players: players.restored,
      merged: players.merged,
      suggestions: await copyNew(feedback, stores.feedback),
      clips: await copyNew(clips, stores.clips),
      admins: await importAdmins(admins, stores.admins),
      stats: await importStats(stats, stores.stats),
    };
    return json({ imported }, 200, PRIVATE);
  } catch (err) {
    console.error(err);
    return json({ error: `Import failed: ${explain(err)}` }, 500, PRIVATE);
  }
}

function explain(err) {
  if (/\b(401|403|404)\b/.test(err.message)) {
    return "Netlify didn't accept the site ID and token. Check NETLIFY_SITE_ID and NETLIFY_TOKEN in Vercel.";
  }
  return err.message;
}

// Every wanted key in an old store, with its value: Map(key → value).
async function readOld(store, wanted) {
  const { blobs } = await store.list();
  const keys = blobs.map((b) => b.key).filter(wanted);
  const values = await mapLimit(keys, READ_CONCURRENCY, (key) => store.get(key, { type: "json" }));
  return new Map(keys.map((key, i) => [key, values[i]]).filter(([, value]) => value != null));
}

// Reviews, suggestions and clips have unique ids, so each is only added if it isn't there yet.
async function copyNew(old, store) {
  const writes = await mapLimit([...old], READ_CONCURRENCY, ([key, value]) => store.setJSON(key, value, { onlyIfNew: true }));
  return writes.filter((w) => w.modified).length;
}

async function importPlayers(old, store) {
  const players = [...old].filter(([key]) => key.startsWith("player/")).map(([, p]) => p);
  // Names are stored hashed with REVIEWS_SALT; if the salt differs, old keys and names won't match.
  if (players.length && !players.some((p) => old.has(nameKey(p.name)))) {
    throw new Error("REVIEWS_SALT on Vercel isn't the same as it was on Netlify. Copy it across, redeploy and try again.");
  }

  let restored = 0;
  let merged = 0;
  for (const player of players) {
    const { whites: _oldField, ...record } = player;
    const p = { ...record, purples: purplesOf(player) };
    const claim = await store.setJSON(nameKey(p.name), { id: p.id }, { onlyIfNew: true });
    const owner = claim.modified ? { id: p.id } : await store.get(nameKey(p.name));
    if (owner?.id === p.id) {
      if ((await store.setJSON(`player/${p.id}`, p, { onlyIfNew: true })).modified) restored++;
      continue;
    }
    // The name was taken again after the move (usually the same person rejoining). Their new
    // score started from at most JOIN_CARRY_REDS of the old one, so add back the rest, once.
    if (!(await store.setJSON(`imported/player/${p.id}`, 1, { onlyIfNew: true })).modified) continue;
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await store.getWithMetadata(`player/${owner.id}`);
      if (!current) break;
      const now = current.data;
      const next = {
        ...now,
        reds: p.reds + Math.max(0, now.reds - Math.min(p.reds, JOIN_CARRY_REDS)),
        purples: p.purples + Math.max(0, purplesOf(now) - Math.min(p.purples, JOIN_CARRY_PURPLES)),
      };
      if ((await store.setJSON(`player/${owner.id}`, next, { onlyIfMatch: current.etag })).modified) {
        merged++;
        break;
      }
    }
  }
  if (players.length) await rebuildBoard(store);
  return { restored, merged };
}

async function importAdmins(old, store) {
  const { blobs } = await store.list({ prefix: "admin/" });
  const names = new Set((await store.getMany(blobs.map((b) => b.key))).filter(Boolean).map((a) => a.name.toLowerCase()));
  let count = 0;
  for (const admin of old.values()) {
    // Someone made an admin with the same name since the move: keep that one.
    if (!admin.id || !admin.keyHash || names.has(admin.name.toLowerCase())) continue;
    if (!(await store.setJSON(`admin/${admin.id}`, admin, { onlyIfNew: true })).modified) continue;
    await store.setJSON(`key/${admin.keyHash}`, { id: admin.id });
    names.add(admin.name.toLowerCase());
    count++;
  }
  return count;
}

// Old counters are added on top of what's been counted since the move, once each.
async function importStats(old, store) {
  let count = 0;
  for (const [key, value] of old) {
    const n = Number(value.n);
    if (!Number.isSafeInteger(n) || n <= 0) continue;
    const ttl = key.startsWith("day/") ? DAY_TTL : undefined;
    if (!(await store.setJSON(`imported/${key}`, 1, { onlyIfNew: true, ttl })).modified) continue;
    await store.increment(key, { by: n, ttl });
    count++;
  }
  return count;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
