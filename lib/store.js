// Storage for the API: an Upstash Redis database connected to the Vercel project (Storage tab).
// Each store ("reviews", "safe-sim", …) is a key prefix in the same database, and every value is JSON.
//   get(key)                     the value, or null
//   getMany(keys)                values in the same order (null for missing ones)
//   getWithMetadata(key)         { data, etag } or null; pass etag to setJSON's onlyIfMatch
//   setJSON(key, value, opts)    { modified }. opts: onlyIfNew, onlyIfMatch: etag, ttl: seconds
//   increment(key, { by, ttl })  adds 1 (or by) to a counter and returns the new count
//   list({ prefix })             { blobs: [{ key }] }
//   delete(key)

// Vercel's Upstash integration sets one of these pairs.
const restUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Saves only if the key still holds exactly what was read, so two requests can't overwrite each other.
const SET_IF_UNCHANGED = `if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("SET", KEYS[1], ARGV[2]) return 1 end return 0`;
const MGET_CHUNK = 500;

// Runs one Redis command through Upstash's REST API.
export async function redis(...command) {
  if (!restUrl() || !restToken()) {
    throw new Error("Storage isn't connected: add Upstash Redis to the Vercel project (Storage tab), then redeploy.");
  }
  const res = await fetch(restUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${restToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(command.map(String)),
    signal: AbortSignal.timeout(8000),
  });
  const out = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (out.error) throw new Error(`Redis ${command[0]} failed: ${out.error}`);
  return out.result;
}

export function getStore(name, send = redis) {
  const full = (key) => `${name}:${key}`;
  const parse = (raw) => (raw == null ? null : JSON.parse(raw));
  const expiry = (ttl) => (ttl ? ["EX", ttl] : []);

  return {
    async get(key) {
      return parse(await send("GET", full(key)));
    },

    async getMany(keys) {
      const values = [];
      for (let i = 0; i < keys.length; i += MGET_CHUNK) {
        values.push(...(await send("MGET", ...keys.slice(i, i + MGET_CHUNK).map(full))));
      }
      return values.map(parse);
    },

    // The etag is the stored text itself, which is all SET_IF_UNCHANGED needs to compare.
    async getWithMetadata(key) {
      const raw = await send("GET", full(key));
      return raw == null ? null : { data: JSON.parse(raw), etag: raw };
    },

    async setJSON(key, value, { onlyIfNew = false, onlyIfMatch, ttl } = {}) {
      const raw = JSON.stringify(value);
      if (onlyIfMatch !== undefined) {
        return { modified: (await send("EVAL", SET_IF_UNCHANGED, 1, full(key), onlyIfMatch, raw)) === 1 };
      }
      const result = await send("SET", full(key), raw, ...expiry(ttl), ...(onlyIfNew ? ["NX"] : []));
      return { modified: result === "OK" };
    },

    async increment(key, { by = 1, ttl } = {}) {
      const n = await send("INCRBY", full(key), by);
      if (ttl && n === by) await send("EXPIRE", full(key), ttl); // the counter was just created
      return n;
    },

    async list({ prefix = "" } = {}) {
      const pattern = `${full(prefix).replace(/[*?[\]\\]/g, "\\$&")}*`;
      const keys = new Set();
      let cursor = "0";
      do {
        const [next, batch] = await send("SCAN", cursor, "MATCH", pattern, "COUNT", 1000);
        batch.forEach((k) => keys.add(k.slice(name.length + 1)));
        cursor = String(next);
      } while (cursor !== "0");
      return { blobs: [...keys].map((key) => ({ key })) };
    },

    async delete(key) {
      await send("DEL", full(key));
    },
  };
}
