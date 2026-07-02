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
  // Trust the proxy-set header FIRST. Our Traefik/Coolify front-end overwrites
  // x-real-ip with the real peer IP on every request, so a client can't forge
  // it. The leftmost x-forwarded-for value, by contrast, is fully
  // client-controlled — trusting it let an attacker send a random XFF per
  // request and land in a fresh rate-limit bucket every time, defeating the
  // only DoS/cost control we have (e.g. the guest /transcribe OpenAI spend).
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  // Fallback for environments without x-real-ip: take the LAST XFF hop (the
  // one added by the closest trusted proxy), not the spoofable first one.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "dev-local";
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
      JSON.stringify({ error: "יותר מדי בקשות. אפשר לנסות שוב בעוד מעט.", retryAfter }),
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
