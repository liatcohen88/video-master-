/**
 * User-side data store — mock today, Supabase tomorrow.
 *
 * Same architectural pattern as adminStore: localStorage-seeded mock data
 * so the dashboard UI can be designed before a real backend exists. After
 * Lovable migration, swap each function's body for a Supabase query —
 * UI doesn't change.
 */

const LS_KEY = "vm_user_store_v1";

export type UserProfile = {
  name: string;
  email: string;
  joinedAt: string;
  avatarUrl?: string;
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
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  return {
    profile: {
      name: "ליאת",
      email: "liat@example.com",
      joinedAt: ago(720), // ~30 days ago
    },
    videos: [
      { id: "v1", title: "פתיחה לסטוריז שישי", thumbnailEmoji: "🎬", durationSec: 28, mode: "advanced_effects", creditsUsed: 40, status: "done",       createdAt: ago(2)   },
      { id: "v2", title: "טיפ של היום",         thumbnailEmoji: "💡", durationSec: 45, mode: "podcast",          creditsUsed: 20, status: "done",       createdAt: ago(6)   },
      { id: "v3", title: "סיכום שבוע",          thumbnailEmoji: "📅", durationSec: 120, mode: "advanced_effects", creditsUsed: 40, status: "done",       createdAt: ago(24)  },
      { id: "v4", title: "הצצה למוצר חדש",      thumbnailEmoji: "✨", durationSec: 18, mode: "basic_effects",    creditsUsed: 20, status: "processing", createdAt: ago(0.2) },
      { id: "v5", title: "ספרה ראשונה",         thumbnailEmoji: "📖", durationSec: 90, mode: "subtitles_only",   creditsUsed: 10, status: "done",       createdAt: ago(120) },
      { id: "v6", title: "טיקטוק חורף",         thumbnailEmoji: "❄️", durationSec: 15, mode: "advanced_effects", creditsUsed: 40, status: "done",       createdAt: ago(168) },
      { id: "v7", title: "הסבר על מוצר",         thumbnailEmoji: "📦", durationSec: 60, mode: "podcast",          creditsUsed: 20, status: "failed",     createdAt: ago(72)  },
    ],
    notifications: [
      { id: "n1", kind: "video_ready",  title: "הסרטון שלך מוכן 🎉", body: "פתיחה לסטוריז שישי — מוכן להורדה",       createdAt: ago(2),    read: false },
      { id: "n2", kind: "credits_low",  title: "הקרדיט שלך מתחיל להיגמר", body: "נשארו לך 50 קרדיט — כדאי לקנות עוד", createdAt: ago(6),    read: false },
      { id: "n3", kind: "feature",      title: "פיצ'ר חדש: מולטי-וידאו ✨", body: "ה-AI יחבר לך כמה סרטונים לפי תסריט שתכתבי", createdAt: ago(48),  read: true },
      { id: "n4", kind: "purchase",     title: "הקנייה אושרה",             body: "100 קרדיט נוספו לחשבונך · חשבונית נשלחה למייל", createdAt: ago(168), read: true },
    ],
    invoices: [
      { id: "i1", date: ago(168), amountIls: 50,  credits: 100, package: "פרו",     url: "#" },
      { id: "i2", date: ago(360), amountIls: 25,  credits: 50,  package: "פופולרי", url: "#" },
      { id: "i3", date: ago(720), amountIls: 100, credits: 200, package: "ביזנס",   url: "#" },
    ],
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
export function listNotifications(): UserNotification[] { return read().notifications; }
export function markNotificationRead(id: string) {
  const s = read();
  s.notifications = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  write(s);
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
