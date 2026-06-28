/**
 * Admin data store — abstraction layer.
 *
 * TODAY: localStorage with seeded mock data. Single-machine, no auth, not
 * useful for real ops — useful for designing the panel UI before backend.
 *
 * TOMORROW (Lovable migration): replace each function body with a Supabase
 * query. The function signatures stay identical so the admin UI never
 * changes. See LOVABLE_MIGRATION.md for the SQL schema.
 */

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string; // ISO
  credits: number;
  totalSpent: number; // ILS
  videosCount: number;
  lastActive: string;
  status: "active" | "suspended";
};

export type VideoJob = {
  id: string;
  userId: string;
  userName: string;
  fileName: string;
  durationSec: number;
  mode: "subtitles_only" | "basic_effects" | "podcast" | "advanced_effects";
  creditsUsed: number;
  status: "done" | "failed" | "in_progress";
  createdAt: string;
};

export type RevenueTxn = {
  id: string;
  userId: string;
  userName: string;
  amountIls: number;
  creditsBought: number;
  package: "starter" | "pro" | "business";
  createdAt: string;
};

// v2 (2026-06-28): bumped to abandon the old demo-seeded `_v1` store so every
// existing browser auto-starts clean (zeros) without a manual reset.
const LS_KEY = "vm_admin_store_v2";

type Store = { users: AdminUser[]; videos: VideoJob[]; revenue: RevenueTxn[] };

// Demo seeding is DISABLED for launch (2026-06-28, Liat: "תאפס גם"). The admin
// panel must start clean — no fake ליאת/יוסי/נועה rows and no inflated traffic.
// (The old demo seed lived here; recover it from git history if ever needed for
// UI design work.) Every store now starts empty until real data flows in.
function seed(): Store {
  return { users: [], videos: [], revenue: [] };
}

function read(): Store {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as Store;
  } catch {
    return seed();
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function listUsers(): AdminUser[] {
  return read().users;
}
export function listVideos(): VideoJob[] {
  return read().videos;
}
export function listRevenue(): RevenueTxn[] {
  return read().revenue;
}
export function updateUserCredits(id: string, credits: number) {
  const s = read();
  s.users = s.users.map((u) => (u.id === id ? { ...u, credits } : u));
  write(s);
}
export function setUserStatus(id: string, status: AdminUser["status"]) {
  const s = read();
  s.users = s.users.map((u) => (u.id === id ? { ...u, status } : u));
  write(s);
}
export function resetStore() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEY);
}

/**
 * Launch reset — write an EMPTY store (not the demo seed) so the dashboard
 * shows real zeros (₪0 revenue, 0 users, 0 videos) instead of the seeded
 * ליאת/יוסי/נועה demo rows. Used by the "איפוס לקראת השקה" admin action.
 */
export function clearStoreEmpty() {
  if (typeof window === "undefined") return;
  write({ users: [], videos: [], revenue: [] });
}

/**
 * Summary stats for the dashboard tab.
 */
export function getStats() {
  const s = read();
  const totalRevenue = s.revenue.reduce((a, b) => a + b.amountIls, 0);
  const activeUsers = s.users.filter((u) => u.status === "active").length;
  const videosLast24h = s.videos.filter(
    (v) => Date.now() - new Date(v.createdAt).getTime() < 24 * 3600 * 1000,
  ).length;
  const successRate = (() => {
    const done = s.videos.filter((v) => v.status === "done").length;
    const failed = s.videos.filter((v) => v.status === "failed").length;
    const t = done + failed;
    return t === 0 ? 100 : Math.round((done / t) * 100);
  })();
  // ── Site traffic ──────────────────────────────────────────────
  // PLACEHOLDER metrics until a real analytics provider is connected
  // (Vercel Analytics / Plausible / GA — wired after deploy). Derived
  // deterministically from existing data so the dashboard looks alive
  // without inventing random noise. Replace getTraffic() with a real
  // fetch once analytics is live.
  const totalVideos = s.videos.length;
  // Derived from real local data with NO artificial floor — an empty store
  // shows true zeros (clean launch, Liat: "תאפס גם"). Flip isReal + replace
  // with a real fetch once analytics (Microsoft Clarity) is wired in.
  const base = activeUsers * 40 + totalVideos * 6;
  const traffic = {
    isReal: false,                                   // ← flip true when analytics is wired
    visitors7d: base,
    pageViews7d: base * 3,
    signups7d: Math.round(activeUsers * 0.7),
    conversionRate: base > 0 ? Math.round((activeUsers / base) * 1000) / 10 : 0, // %
    // 7-day visitor trend (deterministic shape, newest last)
    trend7d: [0.62, 0.7, 0.55, 0.8, 0.74, 0.9, 1].map((f) => Math.round(base * f / 7)),
  };

  return { totalRevenue, activeUsers, videosLast24h, successRate, traffic };
}
