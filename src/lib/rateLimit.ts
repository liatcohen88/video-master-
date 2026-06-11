/**
 * In-memory rate limiter — protects API routes from abuse.
 *
 * Strategy: token bucket per-IP per-route. Cheap, no DB needed.
 * Works on single Vercel instance; for multi-region scale-out you'd
 * swap this for Upstash Redis (same API surface).
 *
 *   import { rateLimit } from "@/lib/rateLimit";
 *   const limited = rateLimit(req, { key: "checkout", max: 10, windowSec: 60 });
 *   if (limited) return new Response("rate limited", { status: 429 });
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Periodically purge expired entries so the map doesn't grow forever
let lastSweepAt = 0;
function sweep() {
  const now = Date.now();
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

export function clientIp(req: Request): string {
  // Vercel / most CDNs set x-forwarded-for. Fall back to a constant
  // so dev (no header) shares one bucket — fine for local.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "dev-local";
}

/**
 * Returns null if allowed, or a 429 Response if exceeded.
 * Defaults: 30 req / 60 seconds per IP+key.
 */
export function rateLimit(
  req: Request,
  opts: { key: string; max?: number; windowSec?: number } = { key: "default" },
): Response | null {
  sweep();
  const max = opts.max ?? 30;
  const windowMs = (opts.windowSec ?? 60) * 1000;
  const id = `${opts.key}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(id);

  if (!b || b.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (b.count >= max) {
    const retryAfter = Math.ceil((b.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({ error: "יותר מדי בקשות. נסי שוב בעוד מעט.", retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }
  b.count++;
  return null;
}
