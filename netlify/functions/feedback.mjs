// Suggestion box for bifdma.org, served at /api/feedback.
//   POST {text, name}   anyone can send a suggestion
//   GET                 list suggestions, newest first (admins only)
//   DELETE ?id=         remove a suggestion (admins only)

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { netlifyAuth, notAdmin } from "../lib/auth.mjs";
import { PRIVATE, clean, hasBlockedWords, hash, json } from "../lib/shared.mjs";

const MAX_TEXT = 500;
const MIN_TEXT = 5;
const MAX_NAME = 30;
const COOLDOWN_MS = 60_000;
const ID_PATTERN = /^\d{13}-[a-f0-9]{8}$/;

export default async (req, context) => {
  const store = getStore({ name: "feedback", consistency: "strong" });
  return handleRequest(req, context, store, netlifyAuth());
};

export const config = { path: "/api/feedback" };

// Kept separate from the default export so it can be tested with an in-memory store.
export async function handleRequest(req, context, store, auth) {
  try {
    if (req.method === "POST") return await addFeedback(req, context, store);
    if (req.method === "GET" || req.method === "DELETE") {
      if (!(await auth(req))) return notAdmin();
      return req.method === "GET" ? await listFeedback(store) : await deleteFeedback(req, store);
    }
    return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
  } catch (err) {
    console.error(err);
    return json({ error: "Something broke. Try again in a bit." }, 500);
  }
}

async function addFeedback(req, context, store) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "That didn't make it. Try again." }, 400);
  }
  if (body.website) return json({ ok: true }, 201); // bot trap

  const text = clean(body.text, MAX_TEXT);
  const name = clean(body.name, MAX_NAME) || "Anonymous Operator";
  if (text.length < MIN_TEXT) return json({ error: "Write a little more so the admins know what you mean." }, 400);
  // Only admins read these, so links are fine; slurs still aren't.
  if (hasBlockedWords(text) || hasBlockedWords(name)) return json({ error: "Keep it friendly." }, 400);

  const ipKey = `ip/${hash(context?.ip || "unknown")}`;
  const last = await store.get(ipKey, { type: "json" });
  if (last && Date.now() - last.at < COOLDOWN_MS) {
    return json({ error: "One suggestion a minute. The admins read them all, promise." }, 429);
  }

  const now = Date.now();
  const id = `${String(now).padStart(13, "0")}-${randomBytes(4).toString("hex")}`;
  await store.setJSON(`feedback/${id}`, { id, name, text, at: new Date(now).toISOString() });
  await store.setJSON(ipKey, { at: now });
  return json({ ok: true }, 201);
}

async function listFeedback(store) {
  const { blobs } = await store.list({ prefix: "feedback/" });
  const keys = blobs.map((b) => b.key).sort().reverse().slice(0, 500);
  const feedback = (await Promise.all(keys.map((key) => store.get(key, { type: "json" })))).filter(Boolean);
  return json({ feedback }, 200, PRIVATE);
}

async function deleteFeedback(req, store) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return json({ error: "Unknown suggestion." }, 400, PRIVATE);
  await store.delete(`feedback/${id}`);
  return json({ deleted: id }, 200, PRIVATE);
}
