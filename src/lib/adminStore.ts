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

const LS_KEY = "vm_admin_store_v1";

type Store = { users: AdminUser[]; videos: VideoJob[]; revenue: RevenueTxn[] };

function seed(): Store {
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  const users: AdminUser[] = [
    { id: "u1", email: "liat@example.com",   name: "ליאת",    createdAt: ago(720), credits: 320, totalSpent: 250, videosCount: 18, lastActive: ago(2),   status: "active" },
    { id: "u2", email: "yossi@example.com",  name: "יוסי",    createdAt: ago(540), credits: 95,  totalSpent: 50,  videosCount: 7,  lastActive: ago(24),  status: "active" },
    { id: "u3", email: "noa@example.com",    name: "נועה",    createdAt: ago(120), credits: 25,  totalSpent: 0,   videosCount: 1,  lastActive: ago(1),   status: "active" },
    { id: "u4", email: "amir@example.com",   name: "עמיר",    createdAt: ago(2400), credits: 0,  totalSpent: 100, videosCount: 22, lastActive: ago(168), status: "suspended" },
    { id: "u5", email: "tal@example.com",    name: "טל",      createdAt: ago(48),  credits: 50,  totalSpent: 25,  videosCount: 3,  lastActive: ago(6),   status: "active" },
  ];
  const videos: VideoJob[] = [
    { id: "v1", userId: "u1", userName: "ליאת", fileName: "reels-43.mp4",   durationSec: 28, mode: "podcast",          creditsUsed: 15, status: "done",        createdAt: ago(2)  },
    { id: "v2", userId: "u1", userName: "ליאת", fileName: "tutorial.mp4",   durationSec: 180, mode: "advanced_effects", creditsUsed: 40, status: "done",        createdAt: ago(4)  },
    { id: "v3", userId: "u2", userName: "יוסי", fileName: "ad-cut.mov",     durationSec: 60, mode: "basic_effects",    creditsUsed: 20, status: "done",        createdAt: ago(24) },
    { id: "v4", userId: "u5", userName: "טל",   fileName: "demo.mp4",       durationSec: 45, mode: "subtitles_only",   creditsUsed: 10, status: "failed",      createdAt: ago(6)  },
    { id: "v5", userId: "u3", userName: "נועה", fileName: "intro.mp4",      durationSec: 15, mode: "podcast",          creditsUsed: 15, status: "in_progress", createdAt: ago(0.5) },
  ];
  const revenue: RevenueTxn[] = [
    { id: "r1", userId: "u1", userName: "ליאת",  amountIls: 100, creditsBought: 200, package: "business", createdAt: ago(360) },
    { id: "r2", userId: "u1", userName: "ליאת",  amountIls: 50,  creditsBought: 100, package: "pro",      createdAt: ago(168) },
    { id: "r3", userId: "u2", userName: "יוסי",  amountIls: 50,  creditsBought: 100, package: "pro",      createdAt: ago(120) },
    { id: "r4", userId: "u4", userName: "עמיר",  amountIls: 100, creditsBought: 200, package: "business", createdAt: ago(720) },
    { id: "r5", userId: "u5", userName: "טל",    amountIls: 25,  creditsBought: 50,  package: "starter",  createdAt: ago(24)  },
  ];
  return { users, videos, revenue };
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
  return { totalRevenue, activeUsers, videosLast24h, successRate };
}
