// Who is making this request? The owner signs in with REVIEWS_ADMIN_KEY (set in Netlify).
// Admins sign in with a personal key the owner created for them on the admin page;
// only a hash of each key is stored, in the "admins" blob store.

import { getStore } from "@netlify/blobs";
import { PRIVATE, hash, json, sameSecret } from "./shared.mjs";

// Returns { role: "owner" | "admin", id, name } or null.
export async function findAdmin(req, { ownerKey, adminStore }) {
  const key = req.headers.get("x-admin-key") || "";
  if (!key) return null;
  if (ownerKey && sameSecret(key, ownerKey)) return { role: "owner", id: "owner", name: "Owner" };
  const entry = await adminStore.get(`key/${hash(key)}`, { type: "json" });
  if (!entry) return null;
  const admin = await adminStore.get(`admin/${entry.id}`, { type: "json" });
  return admin ? { role: "admin", id: admin.id, name: admin.name } : null;
}

// The version the deployed functions use; tests pass their own.
export function netlifyAuth() {
  const adminStore = getStore({ name: "admins", consistency: "strong" });
  return (req) => findAdmin(req, { ownerKey: process.env.REVIEWS_ADMIN_KEY, adminStore });
}

export const notAdmin = () => json({ error: "Admins only. Check your admin key." }, 401, PRIVATE);
