// Anonymous site counters for the admin stats, served at /api/track.
//   POST {event: "view" | "buy" | "zap"}
// Only counts are kept. A visitor is counted once per day using a salted hash of their IP.

import { getStore } from "@netlify/blobs";
import { dayKey, hash, json } from "../lib/shared.mjs";

const EVENTS = { view: "views", buy: "buys", zap: "zaps" };

export default async (req, context) => {
  const store = getStore({ name: "stats", consistency: "strong" });
  return handleRequest(req, context, store);
};

export const config = { path: "/api/track" };

export async function handleRequest(req, context, store) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }
  const counter = EVENTS[body.event];
  if (!counter) return json({ ok: false }, 400);

  try {
    const day = dayKey();
    await Promise.all([bump(store, `day/${counter}/${day}`), bump(store, `total/${counter}`)]);
    if (body.event === "view") {
      // First view today from this connection also counts as a visitor.
      const seen = await store.setJSON(`seen/${day}/${hash(context?.ip || "unknown")}`, { at: Date.now() }, { onlyIfNew: true });
      if (seen.modified) await bump(store, `day/visitors/${day}`);
    }
    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ ok: false }, 500);
  }
}

// Adds 1 to a counter, retrying if another request updated it at the same moment.
export async function bump(store, key) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await store.getWithMetadata(key, { type: "json" });
    const n = (current?.data?.n || 0) + 1;
    const write = current
      ? await store.setJSON(key, { n }, { onlyIfMatch: current.etag })
      : await store.setJSON(key, { n }, { onlyIfNew: true });
    if (write.modified) return n;
  }
  return null; // stats are best-effort; drop this one
}
