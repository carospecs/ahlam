// Shared rate limiter for auth routes.
//
// Default backend is an in-memory fixed-window counter. That is enough to blunt
// scripted abuse, but on serverless (Vercel) each instance has its own Map, so
// the effective limit is per-instance and resets on cold start.
//
// To make the limit durable and shared across instances, set both
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (Upstash Redis / Vercel
// KV REST). When present, this module uses them automatically — no code change.
// (A Vercel Firewall rate rule on /api/auth/* is an equally valid alternative.)

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// ---- in-memory fallback ----
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20_000; // hard cap so a unique-key flood can't grow memory unbounded

function sweep(now: number) {
  if (buckets.size < 5000) return; // cheap: only sweep once it grows
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // If a flood of unique keys (rotated email/IP) keeps the Map oversized even
  // after dropping expired entries, evict oldest-first (Map preserves insertion
  // order). Bounds both memory and the O(n) cost of this scan.
  if (buckets.size > MAX_KEYS) {
    let drop = buckets.size - MAX_KEYS;
    for (const k of buckets.keys()) { if (drop-- <= 0) break; buckets.delete(k); }
  }
}

function checkMemory(key: string, windowMs: number, max: number, now: number): RateLimitResult {
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

// ---- Upstash REST backend ----
async function checkUpstash(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  // INCR the counter and set the TTL only on the first hit (NX), then read the
  // TTL so we can report an accurate Retry-After. One round-trip via pipeline.
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs), "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const out = (await res.json()) as Array<{ result: number }>;
  const count = Number(out[0]?.result ?? 0);
  const ttlMs = Number(out[2]?.result ?? windowMs);
  if (count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Returns { ok:false } when `key` has exceeded `max` hits within `windowMs`.
 * If the durable (Upstash) backend is unreachable, it degrades to the
 * in-memory limiter rather than erroring — a store outage must not take auth
 * down, and per-instance throttling still applies.
 */
export async function checkRateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number }
): Promise<RateLimitResult> {
  const now = Date.now();
  if (useUpstash) {
    try {
      return await checkUpstash(key, windowMs, max);
    } catch {
      return checkMemory(key, windowMs, max, now); // degrade to per-instance
    }
  }
  return checkMemory(key, windowMs, max, now);
}

// Best-effort client IP from proxy headers (first hop in x-forwarded-for).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}
