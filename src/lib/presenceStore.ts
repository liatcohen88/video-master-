/**
 * In-memory live-presence tracker (Shopify-style "who's online now").
 *
 * Master Video runs as a SINGLE Node process on the Hetzner/Coolify container,
 * so a module-level Map is shared across all requests — good enough for a live
 * "who's here right now" view. It intentionally resets on redeploy and is NOT
 * historical analytics (use a real provider for trends).
 *
 * Clients POST a heartbeat to /api/presence every ~20s with a per-tab session
 * id + the page they're on. A session is "live" if seen within WINDOW_MS.
 */

type Session = { path: string; ts: number; country: string | null };

const sessions = new Map<string, Session>();
const WINDOW_MS = 45_000; // a tab pinging every 20s stays "live" between pings

function prune(now: number) {
  const cut = now - WINDOW_MS;
  for (const [k, v] of sessions) if (v.ts < cut) sessions.delete(k);
}

/** Record/refresh a visitor heartbeat. `now` is injected for testability. */
export function touch(sessionId: string, path: string, country: string | null, now = Date.now()) {
  if (!sessionId) return;
  sessions.set(sessionId, { path: path || "/", ts: now, country });
  if (sessions.size > 5000) prune(now); // opportunistic cap so it can't grow unbounded
}

export type LiveSnapshot = {
  count: number;
  byPath: { path: string; count: number }[];
  byCountry: { country: string; count: number }[];
  sessions: { path: string; secondsAgo: number; country: string | null }[];
};

/** Current live snapshot (auto-prunes stale sessions first). */
export function liveList(now = Date.now()): LiveSnapshot {
  prune(now);
  const arr = [...sessions.values()].map((s) => ({
    path: s.path,
    secondsAgo: Math.round((now - s.ts) / 1000),
    country: s.country,
  }));
  const byPathMap = new Map<string, number>();
  const byCountryMap = new Map<string, number>();
  for (const s of arr) {
    byPathMap.set(s.path, (byPathMap.get(s.path) ?? 0) + 1);
    if (s.country) byCountryMap.set(s.country, (byCountryMap.get(s.country) ?? 0) + 1);
  }
  return {
    count: arr.length,
    byPath: [...byPathMap.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count),
    byCountry: [...byCountryMap.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
    sessions: arr.sort((a, b) => a.secondsAgo - b.secondsAgo),
  };
}
