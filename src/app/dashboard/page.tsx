"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Coins, Film, Clock, Calendar, Sparkles, Layers,
  Plus, Bell, Download, Trash2, CheckCheck, Pencil,
  AlertTriangle, Sparkle, Receipt, ArrowUpRight,
} from "lucide-react";
import {
  getProfile, updateProfile, listMyVideos, deleteVideo,
  listNotifications, markNotificationRead, clearAllNotifications,
  listInvoices, getUserStats, resetUserStore,
  type UserVideo, type UserNotification,
} from "@/lib/userStore";
import { getCredits } from "@/lib/credits";
import LogoMark from "@/components/LogoMark";
import { confirm } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toaster";

const MODE_LABEL: Record<UserVideo["mode"], string> = {
  subtitles_only: "כתוביות",
  basic_effects:  "אפקטים",
  podcast:        "פודקאסט",
  advanced_effects: "מתקדם",
  multi_video:    "מולטי",
};

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    setHydrated(true);
    setCredits(getCredits());
    const refresh = () => setCredits(getCredits());
    window.addEventListener("credits-change", refresh);
    return () => window.removeEventListener("credits-change", refresh);
  }, []);

  if (!hydrated) return <div className="min-h-screen bg-bg" />;

  const profile = getProfile();
  const stats = getUserStats();
  const videos = listMyVideos();
  const notifications = listNotifications();
  const invoices = listInvoices();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-white relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-violet-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-60 -left-40 w-[420px] h-[420px] bg-pink-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* ── Top: greeting + balance ── */}
        <div className="bg-gradient-to-br from-brand/20 via-bg-card to-pink-500/10 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <LogoMark size={64} mode="static" />
            <div className="flex-1">
              <div className="text-xs text-white/50 uppercase tracking-wider">שלום</div>
              <h1 className="text-3xl font-black mt-0.5">{profile.name} 👋</h1>
              <p className="text-sm text-white/50 mt-1">מה את יוצרת היום?</p>
            </div>
            <div className="bg-bg-card/60 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-400/20">
                <Coins className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">היתרה שלך</div>
                <div className="text-3xl font-black">{credits.toLocaleString()}</div>
              </div>
              <Link href="/credits"
                className="mr-2 bg-brand hover:bg-brand/80 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-1">
                <Plus className="w-3 h-3" /> קני עוד
              </Link>
            </div>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <QuickAction href="/"        icon={<Film className="w-5 h-5" />}     label="סרטון חדש"   tone="violet" />
          <QuickAction href="/multi"   icon={<Layers className="w-5 h-5" />}   label="מולטי-וידאו" tone="fuchsia" badge="✨ חדש" />
          <QuickAction href="/credits" icon={<Coins className="w-5 h-5" />}    label="קניית קרדיט" tone="amber" />
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat icon={<Film />}     label="סרטונים שיצרת"   value={String(stats.videosCount)} accent="violet" />
          <Stat icon={<Coins />}    label="קרדיט שנוצל"     value={String(stats.creditsUsed)} accent="amber" />
          <Stat icon={<Clock />}    label="זמן עריכה שנחסך" value={`~${stats.savedMin} דק'`}  accent="emerald" sub="לעומת עריכה ידנית" />
          <Stat icon={<Calendar />} label="חודשי פעילות"    value={String(stats.monthsActive)} accent="cyan" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* ── Left: my videos ── */}
          <div className="bg-bg-card border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-300" />
                הסרטונים שלי <span className="text-sm text-white/40 font-normal">({videos.length})</span>
              </h2>
              <Link href="/" className="text-xs text-brand-light hover:text-white flex items-center gap-1">
                <Plus className="w-3 h-3" /> סרטון חדש
              </Link>
            </div>
            <div className="space-y-2">
              {videos.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-violet-500/15 to-pink-500/10 border border-white/10 mb-3">
                    <Film className="w-10 h-10 text-violet-300" />
                  </div>
                  <div className="text-base font-bold mb-1">עדיין אין סרטונים</div>
                  <p className="text-xs text-white/50 mb-4">העלי וידאו ראשון וקבלי 25 קרדיט מתנה</p>
                  <Link href="/"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-brand to-pink-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:opacity-90">
                    <Plus className="w-4 h-4" /> סרטון ראשון
                  </Link>
                </div>
              )}
              {videos.map((v) => (
                <VideoRow key={v.id} video={v}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: "למחוק את הסרטון?",
                      body: `"${v.title}" יימחק לצמיתות. הפעולה לא ניתנת לביטול.`,
                      confirmLabel: "מחקי",
                      destructive: true,
                    });
                    if (!ok) return;
                    deleteVideo(v.id);
                    setTick(tick + 1);
                    toast.success("הסרטון נמחק");
                  }} />
              ))}
            </div>
          </div>

          {/* ── Right column: notifications + profile + invoices ── */}
          <div className="space-y-4">
            {/* Notifications */}
            <div className="bg-bg-card border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-300" />
                  התראות
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{unread}</span>
                  )}
                </h2>
                {unread > 0 && (
                  <button onClick={() => { clearAllNotifications(); setTick(tick + 1); }}
                    className="text-[11px] text-white/50 hover:text-white flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> סמני הכל כנקרא
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <NotifRow key={n.id} n={n}
                    onClick={() => { markNotificationRead(n.id); setTick(tick + 1); }} />
                ))}
              </div>
            </div>

            {/* Profile */}
            <ProfileCard profile={profile} onChange={() => setTick(tick + 1)} />

            {/* Invoices */}
            <div className="bg-bg-card border border-white/10 rounded-2xl p-5">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-300" />
                חשבוניות והיסטוריית קניות
              </h2>
              <div className="space-y-1.5">
                {invoices.length === 0 && (
                  <div className="text-xs text-white/40">עוד לא קנית קרדיט.</div>
                )}
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 text-xs bg-bg-input rounded-md p-2">
                    <div className="flex-1">
                      <div className="font-bold">{inv.package} — {inv.credits} קרדיט</div>
                      <div className="text-white/40 text-[10px]">{new Date(inv.date).toLocaleDateString("he-IL")}</div>
                    </div>
                    <div className="text-emerald-300 font-bold">₪{inv.amountIls}</div>
                    <a href={inv.url} className="p-1.5 text-white/40 hover:text-white" title="הורדת PDF">
                      <Download className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset (dev only — TODO: hide in production) */}
            <button onClick={() => { resetUserStore(); setTick(tick + 1); }}
              className="w-full text-[10px] text-white/30 hover:text-white/60 py-2 border border-dashed border-white/10 rounded-md">
              איפוס נתוני דמו (dev only)
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-white/40 hover:text-white">← חזרה לאפליקציה</Link>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

const TONE_CLASS = {
  violet:  { card: "from-violet-500/20 to-violet-700/5",  icon: "bg-violet-500/20 text-violet-200" },
  fuchsia: { card: "from-fuchsia-500/20 to-pink-700/5",   icon: "bg-fuchsia-500/20 text-fuchsia-200" },
  amber:   { card: "from-amber-400/20 to-orange-600/5",   icon: "bg-amber-400/20 text-amber-200" },
  emerald: { card: "from-emerald-500/15 to-teal-600/5",   icon: "bg-emerald-500/20 text-emerald-200" },
  cyan:    { card: "from-cyan-500/15 to-blue-600/5",      icon: "bg-cyan-500/20 text-cyan-200" },
} as const;

function QuickAction({ href, icon, label, tone, badge }: {
  href: string; icon: React.ReactNode; label: string;
  tone: keyof typeof TONE_CLASS; badge?: string;
}) {
  const t = TONE_CLASS[tone];
  return (
    <Link href={href}
      className={`relative bg-gradient-to-br ${t.card} border border-white/10 hover:border-white/20 rounded-xl p-4 flex items-center gap-3 group transition-all hover:-translate-y-0.5`}>
      <div className={`p-2.5 rounded-xl ${t.icon}`}>{icon}</div>
      <div className="flex-1 font-bold text-sm">{label}</div>
      <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
      {badge && (
        <span className="absolute -top-2 right-3 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Stat({ icon, label, value, accent, sub }: {
  icon: React.ReactNode; label: string; value: string;
  accent: keyof typeof TONE_CLASS; sub?: string;
}) {
  const t = TONE_CLASS[accent];
  return (
    <div className={`bg-gradient-to-br ${t.card} border border-white/10 rounded-xl p-4`}>
      <div className={`inline-flex p-1.5 rounded-md ${t.icon} mb-2`}>{icon}</div>
      <div className="text-3xl font-black">{value}</div>
      <div className="text-[11px] text-white/60 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-white/30 mt-1">{sub}</div>}
    </div>
  );
}

function VideoRow({ video, onDelete }: { video: UserVideo; onDelete: () => void }) {
  const isProcessing = video.status === "processing";
  const isFailed = video.status === "failed";
  return (
    <div className={`flex items-center gap-3 bg-bg-input rounded-lg p-2.5 border
      ${isFailed ? "border-red-500/30" : isProcessing ? "border-amber-500/30" : "border-white/5 hover:border-white/15"} transition-colors`}>
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center text-2xl shrink-0">
        {isProcessing ? <LogoMark size={28} mode="spinning" /> : video.thumbnailEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{video.title}</div>
        <div className="text-[11px] text-white/40 flex items-center gap-1.5 flex-wrap">
          <span>{MODE_LABEL[video.mode]}</span>
          <span>·</span>
          <span>{Math.round(video.durationSec)}s</span>
          <span>·</span>
          <span>{video.creditsUsed} קרדיט</span>
          <span>·</span>
          <span>{new Date(video.createdAt).toLocaleDateString("he-IL")}</span>
        </div>
      </div>
      {isProcessing && <span className="text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">בעיבוד</span>}
      {isFailed && <span className="text-[10px] text-red-300 bg-red-500/15 px-2 py-0.5 rounded-full">נכשל</span>}
      {video.status === "done" && (
        <button className="p-1.5 text-white/50 hover:text-white" title="הורדה">
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onDelete} className="p-1.5 text-white/40 hover:text-red-300" title="מחיקה">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NotifRow({ n, onClick }: { n: UserNotification; onClick: () => void }) {
  const Icon =
    n.kind === "video_ready" ? Sparkles :
    n.kind === "credits_low" ? AlertTriangle :
    n.kind === "feature"     ? Sparkle :
                                Receipt;
  const tone =
    n.kind === "credits_low" ? "text-amber-300 bg-amber-500/15" :
    n.kind === "video_ready" ? "text-emerald-300 bg-emerald-500/15" :
    n.kind === "purchase"    ? "text-violet-300 bg-violet-500/15" :
                                "text-cyan-300 bg-cyan-500/15";
  return (
    <button onClick={onClick}
      className={`w-full text-right flex gap-2 rounded-md p-2 transition-colors
        ${n.read ? "bg-transparent opacity-60 hover:opacity-100" : "bg-white/5 hover:bg-white/10"}`}>
      <div className={`p-1 rounded-md ${tone} shrink-0 h-fit`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{n.title}</div>
        <div className="text-[11px] text-white/50 leading-tight">{n.body}</div>
      </div>
      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-light shrink-0 mt-1" />}
    </button>
  );
}

function ProfileCard({ profile, onChange }: { profile: ReturnType<typeof getProfile>; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  function save() {
    updateProfile({ name, email });
    setEditing(false);
    onChange();
  }
  return (
    <div className="bg-bg-card border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-[11px] font-black">
            {profile.name.charAt(0)}
          </div>
          הפרופיל שלי
        </h2>
        <button onClick={() => setEditing(!editing)} className="text-white/50 hover:text-white">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="שם" className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="אימייל" className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
          <button onClick={save} className="w-full py-1.5 bg-brand text-white text-xs font-bold rounded">שמירה</button>
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-white/40">שם</span><span>{profile.name}</span></div>
          <div className="flex justify-between"><span className="text-white/40">אימייל</span><span className="text-white/70 truncate max-w-[200px]">{profile.email}</span></div>
          <div className="flex justify-between"><span className="text-white/40">חברה מ-</span><span>{new Date(profile.joinedAt).toLocaleDateString("he-IL")}</span></div>
        </div>
      )}
    </div>
  );
}
