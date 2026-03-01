// ==============================================================================
// src/cache/index.ts
//
// DragonflyDB connection via ioredis.
//
// What is DragonflyDB?
//   A Redis-compatible in-memory data store. "Compatible" means it speaks the
//   same wire protocol as Redis, so ioredis (a Redis client) connects to it
//   without any code changes.
//
// Why DragonflyDB over Redis?
//   • Multi-threaded (Redis is single-threaded) → handles more ops/sec
//   • Significantly lower memory footprint due to a custom data structure engine
//   • Drop-in replacement: zero code changes vs using Redis
//
// What we use it for in a trading bot:
//   • Caching market data (price feeds, order books) to reduce DB reads
//   • Rate-limit counters per user/IP
//   • Storing ephemeral session data and JWT deny-lists
//   • Pub/Sub for real-time price broadcasting to WebSocket clients
// ==============================================================================

import Redis from "ioredis"; // ioredis is a robust, promise-based Redis/Dragonfly client
import env from "@/config/env";

// ── Create the client ─────────────────────────────────────────────────────────
//
// `new Redis(url)` parses the redis://host:port URL and manages connections
// automatically, including reconnect logic.
//
// maxRetriesPerRequest: 3
//   If a command fails (e.g. network blip), ioredis retries up to 3 times
//   before rejecting the promise. Set to null for infinite retries (not
//   recommended in production — you want fast failure + circuit breaker).
export const cache = new Redis(env.DRAGONFLY_URL!, {
  maxRetriesPerRequest: 3,
  // lazyConnect: true means the TCP connection is established on the FIRST
  // command, not on construction. Useful so startup isn't blocked by cache.
  lazyConnect: true,
  // keyPrefix: "bot:"  ← you can uncomment this to namespace all keys,
  //   e.g. "bot:price:BTCUSDT" instead of "price:BTCUSDT"
});

// ── Event listeners for observability ─────────────────────────────────────────
cache.on("connect", () => console.log("[cache] Connected to DragonflyDB ✓"));
cache.on("error", (err) => console.error("[cache] DragonflyDB error:", err.message));
cache.on("reconnecting", () => console.warn("[cache] Reconnecting to DragonflyDB..."));

// ── Helper: connect explicitly (called at app startup) ────────────────────────
export async function connectCache(): Promise<void> {
  await cache.connect();
}

// ── Helper utilities (thin wrappers with typed return values) ─────────────────

/**
 * Store a JSON-serialisable value in the cache with an optional TTL.
 *
 * @param key   Cache key, e.g. "price:BTCUSDT"
 * @param value Any JSON-serialisable value
 * @param ttlSeconds  Seconds until the key expires. Omit for no expiry.
 *
 * @example
 *   await setCache("price:BTCUSDT", { bid: 65000, ask: 65001 }, 5);
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const serialised = JSON.stringify(value);
  if (ttlSeconds) {
    await cache.set(key, serialised, "EX", ttlSeconds); // EX = seconds expiry
  } else {
    await cache.set(key, serialised);
  }
}

/**
 * Retrieve and deserialise a cached value.
 * Returns null if the key doesn't exist or has expired.
 *
 * @example
 *   const price = await getCache<{ bid: number; ask: number }>("price:BTCUSDT");
 *   if (price) console.log(price.bid);
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await cache.get(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

/**
 * Delete one or more keys from the cache.
 *
 * @example
 *   await deleteCache("price:BTCUSDT");
 */
export async function deleteCache(...keys: string[]): Promise<void> {
  if (keys.length > 0) await cache.del(...keys);
}
