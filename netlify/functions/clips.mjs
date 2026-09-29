// bif's clips for bifdma.org, served at /api/clips.
//   GET                  list clips, newest first
//   POST {url, title}    add a Twitch clip or YouTube link (admins only)
//   DELETE ?id=          remove a clip (admins only)
// Clips are stored as links and play in Twitch's or YouTube's own player, so no video is hosted here.

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { netlifyAuth, notAdmin } from "../lib/auth.mjs";
import { PRIVATE, clean, hasBlockedWords, json } from "../lib/shared.mjs";

const MAX_TITLE = 80;
const MAX_CLIPS = 60;
const ID_PATTERN = /^\d{13}-[a-f0-9]{8}$/;
const TWITCH_SLUG = /^[A-Za-z0-9_-]{3,100}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export default async (req, context) => {
  const store = getStore({ name: "clips", consistency: "strong" });
  return handleRequest(req, context, store, netlifyAuth());
};

export const config = { path: "/api/clips" };

// Kept separate from the default export so it can be tested with an in-memory store.
export async function handleRequest(req, context, store, auth) {
  try {
    if (req.method === "GET") return await listClips(store);
    if (req.method === "POST" || req.method === "DELETE") {
      const admin = await auth(req);
      if (!admin) return notAdmin();
      return req.method === "POST" ? await addClip(req, store, admin) : await deleteClip(req, store);
    }
    return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
  } catch (err) {
    console.error(err);
    return json({ error: "Something broke. Try again in a bit." }, 500);
  }
}

async function listClips(store) {
  const { blobs } = await store.list({ prefix: "clip/" });
  const keys = blobs.map((b) => b.key).sort().reverse().slice(0, MAX_CLIPS);
  const clips = (await Promise.all(keys.map((key) => store.get(key, { type: "json" })))).filter(Boolean);
  return json({ clips: clips.map(({ addedBy, ...clip }) => clip) }, 200, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
  });
}

async function addClip(req, store, admin) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "That didn't make it. Try again." }, 400, PRIVATE);
  }
  const video = parseClipUrl(String(body.url || ""));
  if (!video) {
    return json({ error: "Paste a Twitch clip link (clips.twitch.tv/… or twitch.tv/…/clip/…) or a YouTube link." }, 400, PRIVATE);
  }
  const title = clean(body.title, MAX_TITLE);
  if (title.length < 2) return json({ error: "Give the clip a title." }, 400, PRIVATE);
  if (hasBlockedWords(title)) return json({ error: "Pick a different title." }, 400, PRIVATE);

  const now = Date.now();
  const clip = {
    id: `${String(now).padStart(13, "0")}-${randomBytes(4).toString("hex")}`,
    source: video.source,
    videoId: video.id,
    title,
    addedBy: admin.name,
    at: new Date(now).toISOString(),
  };
  await store.setJSON(`clip/${clip.id}`, clip);
  return json({ clip }, 201, PRIVATE);
}

async function deleteClip(req, store) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return json({ error: "Unknown clip." }, 400, PRIVATE);
  await store.delete(`clip/${id}`);
  return json({ deleted: id }, 200, PRIVATE);
}

// Turns a pasted link into { source: "twitch" | "youtube", id }, or null if it isn't one we can embed.
export function parseClipUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "clips.twitch.tv") {
    const slug = parts[0] === "embed" ? url.searchParams.get("clip") : parts[0];
    return slug && TWITCH_SLUG.test(slug) ? { source: "twitch", id: slug } : null;
  }
  if (host === "twitch.tv") {
    const at = parts.indexOf("clip");
    const slug = at === -1 ? null : parts[at + 1];
    return slug && TWITCH_SLUG.test(slug) ? { source: "twitch", id: slug } : null;
  }
  let id = null;
  if (host === "youtube.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live"].includes(parts[0])) id = parts[1];
  } else if (host === "youtu.be") {
    id = parts[0];
  }
  return id && YOUTUBE_ID.test(id) ? { source: "youtube", id } : null;
}
