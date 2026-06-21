/**
 * User-side data store — mock today, Supabase tomorrow.
 *
 * Same architectural pattern as adminStore: localStorage-seeded mock data
 * so the dashboard UI can be designed before a real backend exists. After
 * Lovable migration, swap each function's body for a Supabase query —
 * UI doesn't change.
 */

// v2: dropped the 7 fake demo videos / notifications / invoices. Real users
// must see their OWN exported videos, not samples (Liat: "נאפס את נתוני הדמו
// שאוכל לראות בפרופיל סרטונים שהורדו"). Bumping the key abandons the old
// demo-seeded store in every existing browser automatically.
const LS_KEY = "vm_user_store_v2";

import { getContent } from "./contentStore";

export type UserProfile = {
  name: string;
  email: string;
  joinedAt: string;
  avatarUrl?: string;
  /** Optional phone the user adds in the profile editor (also saved to Supabase
   *  auth metadata so it appears in the admin users table). */
  phone?: string;
};

export type UserVideo = {
  id: string;
  title: string;
  thumbnailEmoji: string; // placeholder until real thumbnails
  durationSec: number;
  mode: "subtitles_only" | "basic_effects" | "podcast" | "advanced_effects" | "multi_video";
  creditsUsed: number;
  status: "done" | "processing" | "failed";
  createdAt: string;
};

export type UserNotification = {
  id: string;
  kind: "video_ready" | "credits_low" | "feature" | "purchase";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type Invoice = {
  id: string;
  date: string;
  amountIls: number;
  credits: number;
  package: string;
  url: string;       // mock; real one comes from PayPlus
};

type Store = {
  profile: UserProfile;
  videos: UserVideo[];
  notifications: UserNotification[];
  invoices: Invoice[];
};

function seed(): Store {
  // No demo content — a real account starts empty and fills with the user's
  // own exports (addVideo) + real purchases. profile is a fallback only; the
  // dashboard hydrates name/email from the authenticated Supabase session.
  return {
    profile: { name: "", email: "", joinedAt: new Date().toISOString() },
    videos: [],
    notifications: [],
    invoices: [],
  };
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
  } catch { return seed(); }
}
function write(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function getProfile(): UserProfile { return read().profile; }
export function updateProfile(patch: Partial<UserProfile>) {
  const s = read();
  s.profile = { ...s.profile, ...patch };
  write(s);
}
export function listMyVideos(): UserVideo[] { return read().videos; }
export function deleteVideo(id: string) {
  const s = read();
  s.videos = s.videos.filter((v) => v.id !== id);
  write(s);
}

/**
 * Record a real exported video in the user's profile. Called when an export
 * job starts (status "processing") so the video shows up in "הסרטונים שלי"
 * immediately; ExportJobBadge flips it to "done"/"failed" via setVideoStatus.
 * `id` is the render jobId so the profile can re-download via /api/render-result.
 */
export function addVideo(v: {
  id: string;
  title: string;
  durationSec: number;
  mode: UserVideo["mode"];
  creditsUsed: number;
  status?: UserVideo["status"];
  thumbnailEmoji?: string;
}) {
  const s = read();
  // De-dupe on id (e.g. a retried export with the same jobId).
  s.videos = s.videos.filter((x) => x.id !== v.id);
  s.videos.unshift({
    id: v.id,
    title: v.title || "סרטון",
    thumbnailEmoji: v.thumbnailEmoji || "🎬",
    durationSec: Math.round(v.durationSec || 0),
    mode: v.mode,
    creditsUsed: v.creditsUsed || 0,
    status: v.status || "processing",
    createdAt: new Date().toISOString(),
  });
  write(s);
}

export function setVideoStatus(id: string, status: UserVideo["status"]) {
  const s = read();
  let changed = false;
  s.videos = s.videos.map((v) => {
    if (v.id !== id) return v;
    changed = true;
    return { ...v, status };
  });
  if (changed) write(s);
}
export function listNotifications(): UserNotification[] { return read().notifications; }
export function markNotificationRead(id: string) {
  const s = read();
  s.notifications = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  write(s);
}
/** Add a notification. When an explicit `id` is given it's idempotent —
 *  calling twice with the same id won't duplicate (used for the welcome note). */
export function addNotification(n: {
  id?: string;
  kind?: UserNotification["kind"];
  title: string;
  body?: string;
}) {
  const s = read();
  const id = n.id ?? `n-${Date.now()}`;
  if (n.id && s.notifications.some((x) => x.id === n.id)) return;
  s.notifications.unshift({
    id,
    kind: n.kind ?? "feature",
    title: n.title,
    body: n.body ?? "",
    createdAt: new Date().toISOString(),
    read: false,
  });
  write(s);
}

/** Welcome notification shown once after signup. Idempotent (fixed id), and
 *  CMS-editable via notif.welcome.* so Liat can rephrase it from /admin. */
export function ensureWelcomeNotification() {
  addNotification({
    id: "welcome",
    kind: "feature",
    title: (getContent("notif.welcome.title") as string) || "ברוך הבא למאסטר וידאו!",
    body: (getContent("notif.welcome.body") as string)
      || "לכל שאלה או רעיון אנחנו זמינים עבורך ❤️ עריכה נעימה!",
  });
}

export function clearAllNotifications() {
  const s = read();
  s.notifications = s.notifications.map((n) => ({ ...n, read: true }));
  write(s);
}
export function listInvoices(): Invoice[] { return read().invoices; }

export function resetUserStore() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEY);
}

/**
 * Derive useful stats for the dashboard header — no raw counts the user
 * wouldn't care about; only "feels-good" framings (time saved, etc.).
 */
export function getUserStats() {
  const s = read();
  const videosCount = s.videos.filter((v) => v.status === "done").length;
  const creditsUsed = s.videos.reduce((a, v) => a + v.creditsUsed, 0);
  const totalSec = s.videos.reduce((a, v) => a + v.durationSec, 0);
  // Estimate: 15 min of manual editing saved per minute of output video
  const savedMin = Math.round((totalSec / 60) * 15);
  const monthsActive = Math.max(
    1,
    Math.round((Date.now() - new Date(s.profile.joinedAt).getTime()) / (30 * 24 * 3600 * 1000)),
  );
  return { videosCount, creditsUsed, savedMin, monthsActive };
}
