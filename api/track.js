// Anonymous site counters for the admin stats, served at /api/track.
//   POST {event: "view" | "buy" | "tip" | "zap"}
// Only counts are kept. A visitor is counted once per day using a salted hash of their IP.

import { clientIp, dayKey, hash, json } from "../lib/shared.js";
import { getStore } from "../lib/store.js";

const EVENTS = { view: "views", buy: "buys", tip: "tips", zap: "zaps" };
const DAY_TTL = 40 * 86_400; // daily counts are kept 40 days; the admin page shows the last 7
const SEEN_TTL = 2 * 86_400;

// Vercel calls the exported function named after the request method.
export const POST = (req) => handleRequest(req, { ip: clientIp(req) }, getStore("stats"));

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
    await Promise.all([
      store.increment(`day/${counter}/${day}`, { ttl: DAY_TTL }),
      store.increment(`total/${counter}`),
    ]);
    if (body.event === "view") {
      // First view today from this connection also counts as a visitor.
      const seen = await store.setJSON(`seen/${day}/${hash(context?.ip || "unknown")}`, 1, { onlyIfNew: true, ttl: SEEN_TTL });
      if (seen.modified) await store.increment(`day/visitors/${day}`, { ttl: DAY_TTL });
    }
    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ ok: false }, 500);
  }
}
