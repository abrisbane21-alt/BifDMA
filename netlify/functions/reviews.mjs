// Reviews API for bifdma.org, served at /api/reviews.
//   GET                      latest reviews, newest first (?limit=, max 200)
//   POST {name,stars,text}   add a review
//   DELETE ?id=              remove a review (needs the x-admin-key header)
// Reviews are kept in Netlify Blobs, one blob per review.

import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_NAME = 30;
const MAX_TEXT = 280;
const MIN_TEXT = 3;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;
const COOLDOWN_MS = 60_000;
const ID_PATTERN = /^\d{13}-[a-f0-9]{8}$/;

// No links, emails or phone numbers: keeps out spam and people's personal details.
const BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(?:com|net|org|gg|io|tv|ly|me|xyz)\b/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/,
  /(?:\d[\s().-]?){10,}/,
];
// Slurs and self-harm taunts. Written as stems so common spellings are caught too.
const BLOCKED_WORDS =
  /\b(?:n[i1!|]gg\w*|f[a@4]gg?(?:[o0]ts?|s)?|r[e3]t[a@4]rd\w*|tr[a@4]nn(?:y|ies)|k[i1]kes?|sp[i1]cs?|ch[i1]nks?|kys)\b|kill\s+(?:yo)?ur\s*self/i;

export default async (req, context) => {
  const store = getStore({ name: "reviews", consistency: "strong" });
  return handleRequest(req, context, store, process.env.REVIEWS_ADMIN_KEY);
};

export const config = { path: "/api/reviews" };

// Kept separate from the default export so it can be tested with an in-memory store.
export async function handleRequest(req, context, store, adminKey) {
  try {
    if (req.method === "GET") return await listReviews(req, store);
    if (req.method === "POST") return await addReview(req, context, store);
    if (req.method === "DELETE") return await deleteReview(req, store, adminKey);
    return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
  } catch (err) {
    console.error(err);
    return json({ error: "Something broke. Bartholomew probably zapped the server." }, 500);
  }
}

async function listReviews(req, store) {
  const requested = Number(new URL(req.url).searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requested, 1), MAX_LIMIT);
  const { blobs } = await store.list({ prefix: "review/" });
  // Keys start with a millisecond timestamp, so sorting them sorts by date.
  const keys = blobs.map((b) => b.key).sort().reverse().slice(0, limit);
  const reviews = (await Promise.all(keys.map((key) => store.get(key, { type: "json" })))).filter(Boolean);
  return json({ reviews }, 200, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
  });
}

async function addReview(req, context, store) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "That review didn't make it. Try again." }, 400);
  }

  // Hidden form field that only bots fill in: pretend it worked and drop it.
  if (body.website) return json({ review: null }, 201);

  const name = clean(body.name, MAX_NAME) || "Anonymous Operator";
  const text = clean(body.text, MAX_TEXT);
  const stars = Number(body.stars);

  // BifDMA only accepts 5-star reviews (the page also blocks lower ratings with a joke popup).
  if (stars !== 5) {
    return json({ error: "Only 5-star reviews are accepted. For quality reasons." }, 400);
  }
  if (text.length < MIN_TEXT) {
    return json({ error: "Write at least a few words." }, 400);
  }
  if (isBlocked(name) || isBlocked(text)) {
    return json({ error: "Keep it about the game. Links, contact details and slurs aren't allowed." }, 400);
  }

  const ipKey = `ip/${hash(context?.ip || "unknown")}`;
  const last = await store.get(ipKey, { type: "json" });
  if (last && Date.now() - last.at < COOLDOWN_MS) {
    return json({ error: "One review a minute. Even Bartholomew has to wait." }, 429);
  }

  const now = Date.now();
  const review = {
    id: `${String(now).padStart(13, "0")}-${randomBytes(4).toString("hex")}`,
    name,
    stars,
    text,
    at: new Date(now).toISOString(),
  };
  await store.setJSON(`review/${review.id}`, review);
  await store.setJSON(ipKey, { at: now });
  return json({ review }, 201);
}

async function deleteReview(req, store, adminKey) {
  if (!adminKey) {
    return json({ error: "Deleting is turned off. Set REVIEWS_ADMIN_KEY in Netlify to turn it on." }, 403);
  }
  if (!sameSecret(req.headers.get("x-admin-key") || "", adminKey)) {
    return json({ error: "Wrong admin key." }, 401);
  }
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return json({ error: "Unknown review." }, 400);
  await store.delete(`review/${id}`);
  return json({ deleted: id }, 200);
}

function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isBlocked(value) {
  return BLOCKED_WORDS.test(value) || BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

// IPs are only kept as a salted hash, for the one-review-a-minute limit.
function hash(value) {
  const salt = process.env.REVIEWS_SALT || "bifdma";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

function sameSecret(given, expected) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
