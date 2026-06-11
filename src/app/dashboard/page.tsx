"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Film, Clock, Plus, Bell, Download, Trash2, Pencil,
  AlertTriangle, Sparkles, Receipt, ArrowUpRight, Layers, History, Play,
} from "lucide-react";
import MasterCoin from "@/components/MasterCoin";
import LogoMark from "@/components/LogoMark";
import SiteHeader from "@/components/SiteHeader";
import { useContent } from "@/lib/useContent";
import { ArrowRight } from "lucide-react";
import { listSnapshots, deleteSnapshot, loadCurrentVideo, wipeAllProjectStorage, type ProjectSnapshot } from "@/lib/projectStorage";
import { clearAutoSavedProject } from "@/lib/useAutoSave";
import {
  getProfile, updateProfile, listMyVideos, deleteVideo,
  listNotifications, markNotificationRead, clearAllNotifications,
  listInvoices, getUserStats, resetUserStore,
  type UserVideo, type UserNotification,
} from "@/lib/userStore";
import { getCredits } from "@/lib/credits";
import { confirm } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toaster";

const MODE_LABEL: Record<UserVideo["mode"], string> = {
  subtitles_only: "כתוביות",
  basic_effects:  "אפקטים",
  podcast:        "פודקאסט",
  advanced_effects: "מתקדם",
  multi_video:    "מולטי",
};

/**
 * Minimalist dashboard — fewer columns, less color, more whitespace.
 * Stats compressed to a single row of 3. Profile + invoices collapsed
 * by default. Notifications as a bell-button popover (not always-visible).
 */
export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [credits, setCredits] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [hasSavedVideo, setHasSavedVideo] = useState(false);
  const currency = (useContent("brand.currencyName") as string) || "קרדיטים";
  const appName  = useContent("brand.appName") as string;
  const tagline  = useContent("brand.tagline") as string;
  const logoSize = Number(useContent("brand.headerLogoSize") ?? 56);
  // Dashboard copy — pulled here (NOT inside JSX conditionals!) so React's
  // Rules of Hooks are obeyed: same number of hooks every render.
  const dashGreeting    = useContent("dashboard.greeting") as string;
  const dashHistory     = useContent("dashboard.sections.history") as string;
  const dashInvoices    = useContent("dashboard.sections.invoices") as string;
  const dashEmptyNone   = useContent("dashboard.empty.noHistory") as string;
  const dashEmptySaved  = useContent("dashboard.empty.savedVideo") as string;

  useEffect(() => {
    setHydrated(true);
    setCredits(getCredits());
    const refresh = () => setCredits(getCredits());
    window.addEventListener("credits-change", refresh);
    // Load saved project snapshots from IndexedDB
    (async () => {
      setSnapshots(await listSnapshots());
      setHasSavedVideo(Boolean(await loadCurrentVideo()));
    })();
    return () => window.removeEventListener("credits-change", refresh);
  }, [tick]);

  async function removeSnapshot(id: number) {
    const ok = await confirm({ title: "למחוק את הגרסה השמורה?", body: "הפעולה לא ניתנת לשחזור.", confirmLabel: "מחק", destructive: true });
    if (!ok) return;
    await deleteSnapshot(id);
    setSnapshots(await listSnapshots());
    toast.success("הגרסה נמחקה");
  }

  if (!hydrated) return <div className="min-h-screen" />;

  const profile       = getProfile();
  const stats         = getUserStats();
  const videos        = listMyVideos();
  const notifications = listNotifications();
  const invoices      = listInvoices();
  const unread        = notifications.filter((n) => !n.read).length;

  return (
    <div dir="rtl" className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Shared SiteHeader — Liat: "אני צריכה שתמיד יהיה את התפריט בהדר
            גם בפרופיל". Same nav (בית / חבילות / עזרה), credits pill,
            profile dropdown on every page. */}
        <div className="mb-8"><SiteHeader /></div>

        {/* ── HERO Profile card at the top — cover + avatar + greeting + stats ── */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-white/10 bg-bg-card">
          {/* Top: bell + credits sit ABOVE the cover gradient */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <Link href="/credits"
              className="flex items-center gap-2 bg-black/40 backdrop-blur border border-white/15 hover:border-brand/40 rounded-full pl-3 pr-2 py-1.5 transition-colors group">
              <MasterCoin size={16} />
              <span className="text-sm font-bold">{credits.toLocaleString()}</span>
              <span className="text-[10px] text-white/60">{currency}</span>
              <span className="bg-brand/40 group-hover:bg-brand/60 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 transition-colors">+</span>
            </Link>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-full bg-black/40 backdrop-blur border border-white/15 hover:border-brand/40 transition-colors">
                <Bell className="w-4 h-4 text-white/80" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute left-0 top-11 w-80 bg-bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-3 z-50">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="text-xs font-bold">התראות</div>
                    {unread > 0 && (
                      <button onClick={() => { clearAllNotifications(); setTick(tick + 1); }}
                        className="text-[10px] text-white/40 hover:text-white">סמן הכל כנקרא</button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {notifications.slice(0, 8).map((n) => (
                      <NotifRow key={n.id} n={n}
                        onClick={() => { markNotificationRead(n.id); setTick(tick + 1); }} />
                    ))}
                    {notifications.length === 0 && (
                      <div className="text-center text-xs text-white/30 py-4">אין התראות חדשות</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cover gradient banner */}
          <div className="h-28 bg-gradient-to-br from-violet-600/50 via-fuchsia-600/40 to-pink-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(168,85,247,0.5),transparent_50%),radial-gradient(circle_at_80%_50%,rgba(236,72,153,0.4),transparent_50%)]" />
          </div>

          <div className="px-5 pb-5 -mt-10 relative">
            <div className="flex items-end gap-3 mb-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-3xl font-black border-4 border-bg-card shadow-xl">
                {profile.name.charAt(0)}
              </div>
              <div className="flex-1 pb-1">
                <div className="text-2xl font-black leading-tight">{dashGreeting.replace("{{name}}", profile.name)}</div>
                <div className="text-xs text-white/50 mt-0.5">{profile.email}</div>
              </div>
              <button onClick={() => setProfileEditing(!profileEditing)}
                className="bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                <Pencil className="w-3 h-3" />
                {profileEditing ? "סגור" : "עריכה"}
              </button>
            </div>

            {/* Personalized stats sentence */}
            {!profileEditing && (
              <p className="text-sm text-white/75 leading-relaxed mb-4">
                עד עכשיו יצרתם <span className="text-violet-300 font-bold">{stats.videosCount} סרטונים</span>,
                חסכתם <span className="text-emerald-300 font-bold">~{stats.savedMin} דקות</span> של עריכה,
                וניצלתם <span className="text-amber-300 font-bold">{stats.creditsUsed} {currency}</span>.
              </p>
            )}

            {/* Inline stats strip */}
            {!profileEditing && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg py-2.5">
                  <div className="text-base font-bold">{stats.videosCount}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">סרטונים</div>
                </div>
                <div className="bg-white/5 rounded-lg py-2.5">
                  <div className="text-base font-bold">{stats.monthsActive}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">חודשים פעילים</div>
                </div>
                <div className="bg-white/5 rounded-lg py-2.5">
                  <div className="text-base font-bold">{new Date(profile.joinedAt).toLocaleDateString("he-IL", { month: "short", year: "2-digit" })}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">חבר/ה מ-</div>
                </div>
              </div>
            )}

            {profileEditing && (
              <ProfileEditor profile={profile} editing={true} setEditing={setProfileEditing} onChange={() => setTick(tick + 1)} />
            )}
          </div>
        </div>

        {/* ── Quick action: just one primary button ── */}
        <Link href="/"
          className="flex items-center justify-between bg-bg-card border border-white/10 hover:border-brand/40 rounded-2xl p-5 mb-10 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/15 text-brand-light">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">סרטון חדש</div>
              <div className="text-xs text-white/40 mt-0.5">או נסה את <span className="text-brand-light">מולטי-וידאו AI</span></div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
        </Link>

        {/* ── My videos — clean list, less per-row noise ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">הסרטונים שלי</h2>
            <span className="text-xs text-white/30">{videos.length} סך הכל</span>
          </div>
          {videos.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
              <Film className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40 mb-3">עדיין אין סרטונים</p>
              <Link href="/" className="text-xs text-brand-light hover:text-white">צור את הראשון →</Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {videos.map((v) => (
                <VideoRow key={v.id} video={v}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: "למחוק את הסרטון?",
                      body: `"${v.title}" יימחק לצמיתות.`,
                      confirmLabel: "מחק", destructive: true,
                    });
                    if (!ok) return;
                    deleteVideo(v.id); setTick(tick + 1);
                    toast.success("הסרטון נמחק");
                  }}
                />
              ))}
            </div>
          )}
        </section>


        {/* ── Saved project versions (snapshots from the editor) ────────── */}
        <details className="group mb-4 bg-bg-card/50 border border-white/5 rounded-xl" open={snapshots.length > 0}>
          <summary className="cursor-pointer flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-violet-500/15 text-violet-300">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold">{dashHistory}</div>
                <div className="text-[11px] text-white/40">
                  {snapshots.length === 0
                    ? hasSavedVideo ? dashEmptySaved : dashEmptyNone
                    : `${snapshots.length} גרסאות זמינות לשחזור`}
                </div>
              </div>
            </div>
            {hasSavedVideo && (
              <Link href="/" className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-brand/20 hover:bg-brand/30 text-brand-light px-3 py-1.5 rounded-lg font-bold transition">
                <Play className="w-3 h-3" /> המשך עריכה
              </Link>
            )}
          </summary>
          <div className="px-4 pb-4 border-t border-white/5 pt-3">
            {snapshots.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-4">
                {hasSavedVideo
                  ? "יש סרטון שמור. תתחילי לערוך — גרסאות יישמרו אוטומטית כל 5 דקות."
                  : "לאחר עריכת סרטון, גרסאות אוטומטיות יישמרו כאן."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-xs py-2 px-2 rounded-lg hover:bg-white/5 group/row">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0">
                      <History className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{s.label}</div>
                      <div className="text-[10px] text-white/40">
                        {new Date(s.at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {s.payload.subtitles.length} כתוביות
                      </div>
                    </div>
                    <Link href="/" className="px-2.5 py-1 rounded-md bg-brand/20 hover:bg-brand/40 text-brand-light text-[10px] font-bold transition">
                      שחזר
                    </Link>
                    <button onClick={() => s.id && removeSnapshot(s.id)} className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/row:opacity-100 transition" title="מחק גרסה">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        <details className="group mb-10 bg-bg-card/50 border border-white/5 rounded-xl">
          <summary className="cursor-pointer flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold">{dashInvoices}</div>
                <div className="text-[11px] text-white/40">{invoices.length} עסקאות</div>
              </div>
            </div>
          </summary>
          <div className="px-4 pb-4 border-t border-white/5 space-y-1.5 pt-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 text-xs py-1">
                <span className="flex-1 text-white/70">{inv.package} — {inv.credits} {currency}</span>
                <span className="text-white/40 text-[10px]">{new Date(inv.date).toLocaleDateString("he-IL")}</span>
                <span className="text-emerald-300 font-bold">₪{inv.amountIls}</span>
                <a href={inv.url} className="p-1 text-white/40 hover:text-white" title="הורד PDF">
                  <Download className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </details>

        {/* Dev reset — small + discrete */}
        {/* ── DANGER ZONE — wipe stored videos + clear auto-saved project state ── */}
        <div className="mt-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🗑️</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-red-200">מחיקת זיכרון סרטונים</div>
              <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                מוחק את הסרטון השמור, כל הגרסאות (snapshots), מטמון התמלולים והעריכה האוטומטית.
                ה-CMS של האדמין ויתרת המאסטרים <span className="font-bold">לא</span> מושפעים.
                <br />שימושי לבדיקת המערכת מאפס.
              </div>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "למחוק את כל הסרטונים והגיבויים?",
                  body: "הסרטון השמור, snapshots, מטמון התמלול וכל מצב העריכה — ימחקו לצמיתות. ה-CMS ויתרת המאסטרים נשארים.",
                  confirmLabel: "מחק הכל",
                  destructive: true,
                });
                if (!ok) return;
                await wipeAllProjectStorage();
                clearAutoSavedProject();
                setTick(tick + 1);
                setSnapshots([]);
                setHasSavedVideo(false);
                toast.success("נתוני הסרטונים נמחקו — אפשר להתחיל מחדש 🎬");
              }}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 px-3 py-2 rounded-md whitespace-nowrap font-bold transition-colors"
            >
              מחק הכל
            </button>
          </div>
        </div>

        <button onClick={async () => {
            const ok = await confirm({ title: "לאפס את כל נתוני הדמו?", body: "הסרטונים והפרופיל יחזרו לברירת המחדל.", confirmLabel: "אפס", destructive: true });
            if (!ok) return;
            resetUserStore(); setTick(tick + 1);
            toast.success("נתוני הדמו אופסו");
          }}
          className="w-full text-[10px] text-white/20 hover:text-white/50 py-2 transition-colors">
          איפוס נתוני דמו
        </button>
      </div>
    </div>
  );
}

// ── Sub-components — pared down, less ornamentation ──

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card p-4 text-center">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function VideoRow({ video, onDelete }: { video: UserVideo; onDelete: () => void }) {
  const isProcessing = video.status === "processing";
  const isFailed = video.status === "failed";
  return (
    <div className="flex items-center gap-3 py-3 group">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl shrink-0">
        {isProcessing ? (
          <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
        ) : isFailed ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : (
          video.thumbnailEmoji
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{video.title}</div>
        <div className="text-[11px] text-white/40 flex items-center gap-1.5">
          <span>{MODE_LABEL[video.mode]}</span>
          <span>·</span>
          <span>{Math.round(video.durationSec)}s</span>
          <span>·</span>
          <span>{new Date(video.createdAt).toLocaleDateString("he-IL")}</span>
        </div>
      </div>
      {video.status === "done" && (
        <button className="p-1.5 text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="הורדה">
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onDelete}
        className="p-1.5 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="מחיקה">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NotifRow({ n, onClick }: { n: UserNotification; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-right flex gap-2 rounded-md p-2 transition-colors
        ${n.read ? "opacity-50 hover:opacity-90" : "bg-white/5 hover:bg-white/10"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{n.title}</div>
        <div className="text-[11px] text-white/50 leading-tight line-clamp-2">{n.body}</div>
      </div>
      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-light shrink-0 mt-1.5" />}
    </button>
  );
}

function ProfileEditor({ profile, editing, setEditing, onChange }: {
  profile: ReturnType<typeof getProfile>;
  editing: boolean; setEditing: (b: boolean) => void; onChange: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  function save() {
    updateProfile({ name, email });
    setEditing(false);
    onChange();
    toast.success("הפרופיל עודכן");
  }
  if (editing) {
    return (
      <div className="space-y-2 pt-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם"
          className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל"
          className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 py-1.5 bg-brand text-white text-xs font-bold rounded">שמירה</button>
          <button onClick={() => setEditing(false)} className="py-1.5 px-3 bg-white/5 text-xs rounded">ביטול</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-xs pt-3">
      <div className="flex justify-between"><span className="text-white/40">שם</span><span>{profile.name}</span></div>
      <div className="flex justify-between"><span className="text-white/40">אימייל</span><span className="text-white/70 truncate max-w-[200px]">{profile.email}</span></div>
      <div className="flex justify-between"><span className="text-white/40">חבר/ה מ-</span><span>{new Date(profile.joinedAt).toLocaleDateString("he-IL")}</span></div>
      <button onClick={() => setEditing(true)}
        className="mt-2 text-[11px] text-brand-light hover:text-white flex items-center gap-1">
        <Pencil className="w-3 h-3" /> ערוך פרטים
      </button>
    </div>
  );
}
