// Helpers shared by the reviews and Safe Simulator leaderboard functions.

import { createHash, timingSafeEqual } from "node:crypto";

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

export function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function isBlocked(value) {
  return hasBlockedWords(value) || BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

// Just the slur check, for text only admins read (links are fine there).
export function hasBlockedWords(value) {
  return BLOCKED_WORDS.test(value);
}

// Salted SHA-256, used so IPs and secret tokens are never stored as-is.
export function hash(value) {
  const salt = process.env.REVIEWS_SALT || "bifdma";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export function sameSecret(given, expected) {
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

// UTC date like "2026-09-29", optionally some days back. Used for daily stats.
export function dayKey(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

// For admin-only responses: never cache them anywhere.
export const PRIVATE = { "Cache-Control": "private, no-store" };

export function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
