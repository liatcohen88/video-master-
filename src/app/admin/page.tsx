"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Film, DollarSign, BarChart3, AlertTriangle, RefreshCw,
  FileText, Palette, Tag, Image as ImageIcon, Trash2, Plus,
  Volume2, Play, Pause, Sparkles, Eye, EyeOff, Square, SquareDashed,
  GripVertical, X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SFX_LIBRARY, SFX_CATEGORY_LABEL, listSfxByCategory } from "@/lib/sfxLibrary";
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";
import { EMOJI_CATEGORIES } from "@/components/EmojiPicker";
import { POWER_WORDS_BASE } from "@/lib/wowEffects";
import { DRAMA_WORDS_BASE } from "@/lib/dramaEffects";
import { INTRO_ANIMATIONS } from "@/lib/introAnimations";
import { playSfxCapped } from "@/lib/playSfxCapped";
import { stripLottieBg } from "@/lib/lottieBgStrip";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import {
  listUsers, listVideos, listRevenue, updateUserCredits, setUserStatus, getStats, resetStore,
  type AdminUser, type VideoJob, type RevenueTxn,
} from "@/lib/adminStore";
import {
  CONTENT_DEFAULTS, getContent, setContent, resetContentKey, resetAllContent,
  listContentByGroup, type ContentKey,
  listContentHistory, restoreContentHistory, exportContentJson, importContentJson,
} from "@/lib/contentStore";

type Tab = "overview" | "users" | "videos" | "revenue" | "content" | "branding" | "pricing" | "sfx" | "lottie" | "emoji" | "wow" | "drama" | "intro";

const MODE_LABELS: Record<VideoJob["mode"], string> = {
  subtitles_only: "כתוביות בלבד",
  basic_effects: "אפקטים בסיסיים",
  podcast: "פודקאסט",
  advanced_effects: "אפקטים מתקדמים",
};
const PACKAGE_LABELS: Record<RevenueTxn["package"], string> = {
  starter: "סטרטר", pro: "פרו", business: "ביזנס",
};

const GROUP_LABELS: Record<string, { label: string; tab: Tab }> = {
  brand:   { label: "מיתוג",         tab: "branding" },
  home:    { label: "דף הבית",       tab: "content"  },
  mode:    { label: "מצבי עריכה",    tab: "content"  },
  footer:  { label: "כותרת תחתונה",  tab: "content"  },
  pricing: { label: "תמחור",         tab: "pricing"  },
  welcome: { label: "ברוכים הבאים",  tab: "content"  },
  whisper:  { label: "מודלי תמלול",    tab: "content"  },
  settings: { label: "הגדרות כתוביות", tab: "content"  },
  landing: { label: "דף הנחיתה",      tab: "content"  },
  multi:    { label: "חיבור סרטונים",   tab: "content"  },
  credits:  { label: "דף חבילות",       tab: "content"  },
  dashboard:{ label: "עמוד משתמש",      tab: "content"  },
  legal:   { label: "תקנון ופרטיות",   tab: "content"  },
  contact: { label: "יצירת קשר",        tab: "content"  },
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-white/40">טוען...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen text-white">
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center gap-2 justify-center">
        <AlertTriangle className="w-3.5 h-3.5" />
        סביבת פיתוח · אין auth · נתונים ב-localStorage · מתחבר ל-Supabase אחרי המעבר ל-Lovable
        <button onClick={() => { resetStore(); resetAllContent(); setTick((t) => t + 1); }}
          className="ml-2 text-amber-100 hover:text-white underline flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> איפוס דמו + תוכן
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">פאנל ניהול</h1>
          <a href="/" className="text-xs text-white/40 hover:text-white">→ לאפליקציה</a>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
          {([
            { id: "overview", icon: BarChart3, label: "סקירה" },
            { id: "users",    icon: Users,     label: "משתמשים" },
            { id: "videos",   icon: Film,      label: "סרטונים" },
            { id: "revenue",  icon: DollarSign,label: "הכנסות" },
            { id: "content",  icon: FileText,  label: "תוכן" },
            { id: "branding", icon: Palette,   label: "מיתוג" },
            { id: "pricing",  icon: Tag,       label: "תמחור" },
            { id: "sfx",      icon: Volume2,   label: "SFX" },
            // "Lottie" tab hidden 2026-06-11 — until we have a stronger
            // curated set of animations. The data layer + admin code stays
            // intact (still accessible via direct ?tab=lottie URL), so when
            // we re-enable, no rebuild needed.
            // { id: "lottie",   icon: Sparkles,  label: "Lottie" },
            { id: "emoji",    icon: ImageIcon, label: "אמוג'י" },
            { id: "wow",      icon: AlertTriangle, label: "WOW" },
            { id: "drama",    icon: AlertTriangle, label: "דרמה" },
            { id: "intro",    icon: Sparkles,  label: "כניסות" },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px whitespace-nowrap
                ${tab === t.id ? "border-brand text-white" : "border-transparent text-white/50 hover:text-white"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab key={tick} />}
        {tab === "users"    && <UsersTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "videos"   && <VideosTab key={tick} />}
        {tab === "revenue"  && <RevenueTab key={tick} />}
        {tab === "content"  && <ContentTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "branding" && <BrandingTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "pricing"  && <PricingTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "sfx"      && <SfxTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "lottie"   && <LottieTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "emoji"    && <EmojiTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "wow"      && <WowTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "drama"    && <DramaTab key={tick} onChange={() => setTick(tick + 1)} />}
        {tab === "intro"    && <IntroTab key={tick} onChange={() => setTick(tick + 1)} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-bg-card border border-white/10 rounded-xl p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-white/40 mt-1">{hint}</div>}
    </div>
  );
}

function OverviewTab() {
  const stats = getStats();
  const recent = listVideos().slice(0, 5);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="הכנסות סה״כ"      value={`₪${stats.totalRevenue.toLocaleString()}`} hint="כל הזמנים" />
        <StatCard label="משתמשים פעילים"   value={String(stats.activeUsers)} />
        <StatCard label="סרטונים ב-24 שעות" value={String(stats.videosLast24h)} />
        <StatCard label="אחוז הצלחה"        value={`${stats.successRate}%`} hint="ייצוא תקין מתוך כלל הניסיונות" />
      </div>

      {/* ── Site traffic ─────────────────────────────────────── */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">תנועת אתר · 7 ימים אחרונים</div>
          {!stats.traffic.isReal && (
            <span className="text-[10px] text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
              נתוני דמו — יתחבר לאנליטיקה אמיתית אחרי העלייה
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="כניסות לאתר"     value={stats.traffic.visitors7d.toLocaleString()} />
          <StatCard label="צפיות בעמודים"   value={stats.traffic.pageViews7d.toLocaleString()} />
          <StatCard label="הרשמות חדשות"    value={String(stats.traffic.signups7d)} />
          <StatCard label="אחוז המרה"       value={`${stats.traffic.conversionRate}%`} hint="כניסות → משתמשים" />
        </div>
        {/* mini bar chart */}
        <div className="flex items-end gap-1.5 h-16">
          {stats.traffic.trend7d.map((v, i) => {
            const max = Math.max(...stats.traffic.trend7d, 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-gradient-to-t from-brand/40 to-brand"
                     style={{ height: `${Math.max(8, (v / max) * 100)}%` }} title={`${v} כניסות`} />
                <span className="text-[9px] text-white/30">{["א","ב","ג","ד","ה","ו","ש"][i]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3">פעילות אחרונה</div>
        <ul className="space-y-2">
          {recent.map((v) => (
            <li key={v.id} className="flex items-center gap-3 text-xs bg-bg-input rounded-md p-2">
              <span className="w-2 h-2 rounded-full"
                style={{ background: v.status === "done" ? "#22C55E" : v.status === "failed" ? "#EF4444" : "#F59E0B" }} />
              <span className="font-bold">{v.userName}</span>
              <span className="text-white/60 flex-1 truncate">{v.fileName}</span>
              <span className="text-white/40">{MODE_LABELS[v.mode]}</span>
              <span className="text-white/40">{v.creditsUsed} קרדיט</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type RegisteredUser = {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  created_at: string;
};

function UsersTab(_props: { onChange: () => void }) {
  void _props;
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d: { users: RegisteredUser[]; configured: boolean }) => {
        setUsers(d.users);
        setConfigured(d.configured);
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
  });

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-3">
      {/* Top bar — search + count */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי אימייל או שם..."
          className="flex-1 bg-bg-input border border-white/10 rounded-lg px-3 py-2 text-sm"
        />
        <div className="text-xs text-white/50 whitespace-nowrap">
          {loading ? "טוען..." : `${filtered.length} מתוך ${users.length}`}
        </div>
      </div>

      {!configured && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs p-3 rounded-lg">
          ⚠️ Supabase לא מוגדר. הוסיפי NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ו-SUPABASE_SERVICE_ROLE_KEY ב-env vars ב-Coolify.
        </div>
      )}

      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-input text-[11px] uppercase tracking-wider text-white/50">
            <tr>
              <th className="text-right p-3">שם</th>
              <th className="text-right p-3">אימייל</th>
              <th className="text-right p-3">מאסטרים</th>
              <th className="text-right p-3">נרשם ב</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="p-3 font-medium">{u.display_name ?? "—"}</td>
                <td className="p-3 text-white/60 text-xs" dir="ltr">{u.email}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                    🪙 {u.credits}
                  </span>
                </td>
                <td className="p-3 text-white/60 text-xs">{formatDate(u.created_at)}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-white/40 text-sm">
                {users.length === 0 ? "אין משתמשים רשומים עדיין" : "אין התאמות לחיפוש"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VideosTab() {
  const videos = listVideos();
  return (
    <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-input text-[11px] uppercase tracking-wider text-white/50">
          <tr>
            <th className="text-right p-3">קובץ</th>
            <th className="text-right p-3">משתמש</th>
            <th className="text-right p-3">מצב</th>
            <th className="text-right p-3">משך</th>
            <th className="text-right p-3">קרדיט</th>
            <th className="text-right p-3">סטטוס</th>
            <th className="text-right p-3">מתי</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => (
            <tr key={v.id} className="border-t border-white/5">
              <td className="p-3 font-medium truncate max-w-[200px]">{v.fileName}</td>
              <td className="p-3">{v.userName}</td>
              <td className="p-3 text-white/60 text-xs">{MODE_LABELS[v.mode]}</td>
              <td className="p-3">{v.durationSec}s</td>
              <td className="p-3">{v.creditsUsed}</td>
              <td className="p-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full
                  ${v.status === "done" ? "bg-emerald-500/20 text-emerald-300"
                    : v.status === "failed" ? "bg-red-500/20 text-red-300"
                    : "bg-amber-500/20 text-amber-300"}`}>
                  {v.status === "done" ? "הושלם" : v.status === "failed" ? "נכשל" : "בעיבוד"}
                </span>
              </td>
              <td className="p-3 text-white/40 text-xs">{new Date(v.createdAt).toLocaleString("he-IL")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueTab() {
  const txns = listRevenue();
  const total = txns.reduce((a, b) => a + b.amountIls, 0);
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="text-xs text-emerald-200">הכנסות סה״כ</div>
        <div className="text-4xl font-bold mt-1">₪{total.toLocaleString()}</div>
        <div className="text-[11px] text-white/50 mt-1">{txns.length} עסקאות</div>
      </div>
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-input text-[11px] uppercase tracking-wider text-white/50">
            <tr>
              <th className="text-right p-3">משתמש</th>
              <th className="text-right p-3">חבילה</th>
              <th className="text-right p-3">קרדיט</th>
              <th className="text-right p-3">סכום</th>
              <th className="text-right p-3">מתי</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 font-medium">{r.userName}</td>
                <td className="p-3 text-white/60 text-xs">{PACKAGE_LABELS[r.package]}</td>
                <td className="p-3">{r.creditsBought}</td>
                <td className="p-3 font-bold text-emerald-300">₪{r.amountIls}</td>
                <td className="p-3 text-white/40 text-xs">{new Date(r.createdAt).toLocaleString("he-IL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CMS: Content tab (texts) ─────────────────────────────────────────
function ContentTab({ onChange }: { onChange: () => void }) {
  const groups = listContentByGroup();
  // Ordered by where it appears in the product, each with a plain-Hebrew
  // description + emoji so it's findable. Rendered as collapsible accordions
  // so the page isn't one giant scroll.
  const SECTIONS: { grp: string; emoji: string; desc: string }[] = [
    { grp: "home",    emoji: "🏠", desc: "כותרות וטקסטים בעמוד הראשי (מסך העלאת הסרטון)" },
    { grp: "landing", emoji: "🚀", desc: "דף הנחיתה — באנרים, יתרונות, המלצות, כותרות חבילות" },
    { grp: "mode",    emoji: "🎬", desc: "מסך בחירת מצב העריכה (כתוביות / פודקאסט / מתקדם)" },
    { grp: "multi",     emoji: "🔗", desc: "עמוד חיבור הסרטונים" },
    { grp: "credits",   emoji: "🪙", desc: "כותרות וטקסטים בדף החבילות (/credits)" },
    { grp: "dashboard", emoji: "👤", desc: "טקסטים בעמוד המשתמש (ברכה, חשבוניות, גרסאות)" },
    { grp: "footer",    emoji: "📋", desc: "הכותרת התחתונה — שמות הקישורים במפת האתר" },
    { grp: "welcome",   emoji: "🎉", desc: "פופאפ ברוכים הבאים אחרי הרשמה" },
    { grp: "whisper",  emoji: "🎙️", desc: "שמות ותיאורי מודלי התמלול" },
    { grp: "settings", emoji: "⚙️", desc: "פאנל הגדרות הכתוביות בעורך (מודל, מילים בשורה, פיסוק)" },
    { grp: "contact", emoji: "📞", desc: "עמוד יצירת קשר" },
    { grp: "legal",   emoji: "⚖️", desc: "תקנון ומדיניות פרטיות" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        עריכת כל הטקסטים באתר. לחצי על קטע כדי לפתוח אותו. השמירה מיידית — מספיק לצאת מהשדה.
      </p>

      <ContentBackupBar onChange={onChange} />
      {SECTIONS.map(({ grp, emoji, desc }) => {
        const keys = groups[grp];
        if (!keys?.length) return null;
        return (
          <details key={grp} className="group bg-bg-card border border-white/10 rounded-xl overflow-hidden">
            <summary className="cursor-pointer flex items-center gap-3 p-4 hover:bg-white/[0.02] select-none">
              <span className="text-xl">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{GROUP_LABELS[grp]?.label ?? grp}</div>
                <div className="text-[11px] text-white/40">{desc}</div>
              </div>
              <span className="text-[11px] text-white/30 bg-white/5 rounded-full px-2 py-0.5">{keys.length} שדות</span>
              <span className="text-white/30 group-open:rotate-90 transition-transform">‹</span>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
              {keys.map((k) => (
                <ContentField key={k} ck={k} onChange={onChange} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/**
 * Backup & restore bar for the CMS — every save auto-snapshots the previous
 * state (rolling 15), so an accidental wipe/overwrite is one click to undo.
 * Also offers export-to-file / import-from-file for an offline safety copy.
 */
function ContentBackupBar({ onChange }: { onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const history = listContentHistory();

  function download() {
    const blob = new Blob([exportContentJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master-video-content-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function onImportFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importContentJson(String(reader.result));
      if (ok) onChange();
      else alert("קובץ גיבוי לא תקין");
    };
    reader.readAsText(f);
  }
  function fmtTime(at: number) {
    return new Date(at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-emerald-200">🛟 גיבוי ושחזור</span>
        <span className="text-[10px] text-white/40 flex-1">
          כל שינוי נשמר אוטומטית להיסטוריה ({history.length}/15 גרסאות)
        </span>
        <button onClick={() => setOpen(!open)}
          className="text-[11px] bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-md border border-white/10">
          {open ? "סגירה" : `שחזור גרסה (${history.length})`}
        </button>
        <button onClick={download}
          className="text-[11px] bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-md border border-white/10">
          ⬇ ייצוא לקובץ
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="text-[11px] bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-md border border-white/10">
          ⬆ ייבוא מקובץ
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
      </div>

      {open && (
        <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10 bg-black/20">
          {history.length === 0 && (
            <div className="text-[11px] text-white/40 text-center py-3">
              עדיין אין גרסאות — הן ייווצרו אוטומטית מהשינוי הבא
            </div>
          )}
          {history.map((h, i) => (
            <div key={h.at} className="flex items-center gap-3 px-3 py-2 text-[11px]">
              <span className="text-white/60 flex-1">{fmtTime(h.at)} · {h.keys} שדות מותאמים</span>
              <button
                onClick={() => { if (restoreContentHistory(i)) onChange(); }}
                className="bg-brand/20 hover:bg-brand/40 text-brand-light px-2.5 py-1 rounded-md font-bold">
                שחזר ←
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentField({ ck, onChange }: { ck: ContentKey; onChange: () => void }) {
  const def = CONTENT_DEFAULTS[ck];
  const [val, setVal] = useState<string>(String(getContent(ck) ?? ""));
  const isLong = typeof def === "string" && def.length > 60;
  const isNumber = typeof def === "number";

  function save() {
    const v: string | number = isNumber ? (parseInt(val) || 0) : val;
    setContent(ck, v as never);
    onChange();
  }

  return (
    <div className="flex items-start gap-2">
      <label className="text-[11px] text-white/40 font-mono w-44 shrink-0 mt-2">{ck}</label>
      <div className="flex-1">
        {isLong ? (
          <textarea value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} rows={2}
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm resize-y" />
        ) : (
          <input
            type={isNumber ? "number" : "text"}
            value={val} onChange={(e) => setVal(e.target.value)} onBlur={save}
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        )}
      </div>
      <button
        onClick={() => { resetContentKey(ck); setVal(String(CONTENT_DEFAULTS[ck])); onChange(); }}
        className="text-[11px] text-white/40 hover:text-white px-2 mt-2 underline whitespace-nowrap"
        title="שחזור ברירת מחדל">
        איפוס
      </button>
    </div>
  );
}

// ── CMS: Branding tab ─────────────────────────────────────────
function BrandingTab({ onChange }: { onChange: () => void }) {
  const [appName,     setAppName]     = useState(getContent("brand.appName"));
  const [tagline,     setTagline]     = useState(getContent("brand.tagline"));
  const [currency,    setCurrency]    = useState(getContent("brand.currencyName"));
  const [logoUrl,     setLogoUrl]     = useState(getContent("brand.logoUrl"));
  const [primary,     setPrimary]     = useState(getContent("brand.primaryColor"));
  const [accent,      setAccent]      = useState(getContent("brand.accentColor"));
  const [heroImage,   setHeroImage]   = useState(getContent("brand.heroImageUrl"));
  const [logoSize,    setLogoSize]    = useState(getContent("brand.headerLogoSize"));

  function save<K extends ContentKey>(k: K, v: (typeof CONTENT_DEFAULTS)[K]) {
    setContent(k, v); onChange();
  }

  async function uploadFile(file: File, key: "brand.logoUrl" | "brand.heroImageUrl") {
    // Local-only: read as data URL. For Lovable migration use Supabase Storage.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      save(key, dataUrl);
      if (key === "brand.logoUrl") setLogoUrl(dataUrl);
      else setHeroImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-bg-card border border-white/10 rounded-xl p-4 space-y-3">
        <div className="text-sm font-bold mb-2">זהות מותג</div>
        <div>
          <label className="text-xs text-white/50 block mb-1">שם האפליקציה</label>
          <input value={appName} onChange={(e) => setAppName(e.target.value)} onBlur={() => save("brand.appName", appName)}
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1">סלוגן / תיאור קצר</label>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} onBlur={() => save("brand.tagline", tagline)}
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1">שם המטבע (קרדיטים / מאסטרים)</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} onBlur={() => save("brand.currencyName", currency)}
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
          <p className="text-[10px] text-white/30 mt-1">מתעדכן בכל האתר — בצ&apos;יפ, בחבילות, בברכת ההצטרפות ובכפתורי הייצוא.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-white/50 block mb-1">צבע ראשי</label>
            <div className="flex gap-1.5">
              <input type="color" value={primary} onChange={(e) => { setPrimary(e.target.value); save("brand.primaryColor", e.target.value); }}
                className="w-12 h-9 rounded bg-bg-input border border-white/10" />
              <input value={primary} onChange={(e) => setPrimary(e.target.value)} onBlur={() => save("brand.primaryColor", primary)}
                className="flex-1 bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">צבע אקצנט</label>
            <div className="flex gap-1.5">
              <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); save("brand.accentColor", e.target.value); }}
                className="w-12 h-9 rounded bg-bg-input border border-white/10" />
              <input value={accent} onChange={(e) => setAccent(e.target.value)} onBlur={() => save("brand.accentColor", accent)}
                className="flex-1 bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm font-mono" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-white/10 rounded-xl p-4 space-y-3">
        <div className="text-sm font-bold mb-2">תמונות</div>
        <ImageUploader
          label="לוגו" value={logoUrl}
          onUpload={(f) => uploadFile(f, "brand.logoUrl")}
          onClear={() => { save("brand.logoUrl", ""); setLogoUrl(""); }}
        />
        <ImageUploader
          label="תמונת Hero בדף הבית (אופציונלי)" value={heroImage}
          onUpload={(f) => uploadFile(f, "brand.heroImageUrl")}
          onClear={() => { save("brand.heroImageUrl", ""); setHeroImage(""); }}
        />

        {/* Header logo size slider */}
        <div className="pt-3 border-t border-white/5">
          <label className="text-xs text-white/50 block mb-2">
            גודל הלוגו בכותרת
            <span className="text-white/30 mr-2 font-mono">{logoSize}px</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={40} max={180} step={4}
              value={logoSize}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                setLogoSize(n);
                save("brand.headerLogoSize", n);
              }}
              className="flex-1 accent-brand"
            />
            <input
              type="number" min={40} max={300}
              value={logoSize}
              onChange={(e) => {
                const n = parseInt(e.target.value) || 100;
                setLogoSize(n);
                save("brand.headerLogoSize", n);
              }}
              className="w-16 bg-bg-input border border-white/10 rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="text-[10px] text-white/30 mt-1">קטן: 50px · רגיל: 80px · גדול: 120px · ענק: 180px</div>
        </div>
      </div>
    </div>
  );
}

function ImageUploader({ label, value, onUpload, onClear }: {
  label: string; value: string;
  onUpload: (f: File) => void; onClear: () => void;
}) {
  return (
    <div>
      <label className="text-xs text-white/50 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="w-14 h-14 object-contain rounded bg-bg-input border border-white/10" />
        ) : (
          <div className="w-14 h-14 rounded bg-bg-input border border-dashed border-white/10 flex items-center justify-center text-white/30">
            <ImageIcon className="w-5 h-5" />
          </div>
        )}
        <label className="flex-1 cursor-pointer text-xs bg-bg-input border border-white/10 rounded px-2 py-2 hover:bg-white/5">
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          {value ? "החליפי תמונה" : "העלי תמונה"}
        </label>
        {value && (
          <button onClick={onClear} className="text-white/40 hover:text-red-400 p-2" title="מחקי">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── CMS: Pricing tab ─────────────────────────────────────────
type Pkg = { id: string; credits: number; priceIls: number; label: string; highlight: string };

function PricingTab({ onChange }: { onChange: () => void }) {
  const [packages, setPackages] = useState<Pkg[]>(() => getContent("pricing.packages") as Pkg[]);
  const costs = {
    subtitles_only:   getContent("pricing.cost.subtitles_only"),
    basic_effects:    getContent("pricing.cost.basic_effects"),
    podcast:          getContent("pricing.cost.podcast"),
    advanced_effects: getContent("pricing.cost.advanced_effects"),
    multi_video:      getContent("pricing.cost.multi_video"),
  };

  function savePackages(next: Pkg[]) {
    setPackages(next);
    setContent("pricing.packages", next as never);
    onChange();
  }
  function updatePkg(i: number, patch: Partial<Pkg>) {
    savePackages(packages.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function addPkg() {
    savePackages([
      ...packages,
      { id: `new-${Date.now()}`, credits: 50, priceIls: 25, label: "חבילה חדשה", highlight: "" },
    ]);
  }
  function removePkg(i: number) {
    savePackages(packages.filter((_, j) => j !== i));
  }
  function saveCost(key: keyof typeof costs, value: number) {
    setContent(`pricing.cost.${key}` as ContentKey, value as never);
    onChange();
  }

  return (
    <div className="space-y-5">
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">חבילות קרדיט</div>
          <button onClick={addPkg}
            className="text-xs bg-brand/20 hover:bg-brand/30 text-brand-light px-3 py-1.5 rounded-md flex items-center gap-1">
            <Plus className="w-3 h-3" /> חבילה
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="text-right p-2">מזהה</th>
              <th className="text-right p-2">שם</th>
              <th className="text-right p-2">קרדיט</th>
              <th className="text-right p-2">מחיר ₪</th>
              <th className="text-right p-2">תג</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p, i) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="p-2 text-white/40 font-mono text-xs">{p.id}</td>
                <td className="p-2">
                  <input value={p.label} onChange={(e) => updatePkg(i, { label: e.target.value })}
                    className="w-full bg-bg-input border border-white/10 rounded px-2 py-1 text-xs" />
                </td>
                <td className="p-2">
                  <input type="number" value={p.credits} onChange={(e) => updatePkg(i, { credits: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-bg-input border border-white/10 rounded px-2 py-1 text-xs" />
                </td>
                <td className="p-2">
                  <input type="number" value={p.priceIls} onChange={(e) => updatePkg(i, { priceIls: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-bg-input border border-white/10 rounded px-2 py-1 text-xs" />
                </td>
                <td className="p-2">
                  <input value={p.highlight} onChange={(e) => updatePkg(i, { highlight: e.target.value })}
                    placeholder='למשל "הכי משתלם"'
                    className="w-32 bg-bg-input border border-white/10 rounded px-2 py-1 text-xs" />
                </td>
                <td className="p-2">
                  <button onClick={() => removePkg(i)} className="text-white/40 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3">עלות בקרדיט פר מצב עריכה</div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {(Object.keys(costs) as Array<keyof typeof costs>).map((k) => (
            <div key={k}>
              <label className="text-[11px] text-white/40 block mb-1">{MODE_LABELS[k as VideoJob["mode"]] ?? k}</label>
              <input type="number" defaultValue={costs[k]}
                onBlur={(e) => saveCost(k, parseInt(e.target.value) || 0)}
                className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CMS: SFX rename tab ─────────────────────────────────────────
function SfxTab({ onChange }: { onChange: () => void }) {
  const labels = getContent("sfx.labels") as Record<string, string>;
  const [overrides, setOverrides] = useState<Record<string, string>>({ ...labels });
  const [catLabels, setCatLabels] = useState<Record<string, string>>({ ...(getContent("sfx.categoryLabels") as Record<string, string>) });
  const [catOverrides, setCatOverrides] = useState<Record<string, string>>({ ...(getContent("sfx.categoryOverrides") as Record<string, string>) });
  const [hiddenSfx, setHiddenSfx] = useState<Record<string, true>>(
    () => ({ ...((getContent("sfx.hidden") as Record<string, true>) ?? {}) }),
  );
  function toggleHiddenSfx(id: string) {
    const next = { ...hiddenSfx };
    if (next[id]) delete next[id]; else next[id] = true;
    setHiddenSfx(next);
    setContent("sfx.hidden", next as never);
    onChange();
  }
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Admin-uploaded sounds (metadata in CMS; files in public/sfx)
  type CustomSfx = { id: string; label: string; category: string; url: string };
  const [customs, setCustoms] = useState<CustomSfx[]>(
    () => (getContent("sfx.custom") as CustomSfx[]) ?? [],
  );
  const [uploadCat, setUploadCat] = useState("fx");
  const [uploadingSfx, setUploadingSfx] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function uploadSfx(file: File) {
    setUploadingSfx(true); setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/sfx/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "העלאה נכשלה");
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "סאונד חדש";
      const next = [...customs, { id: j.id, label, category: uploadCat, url: j.url }];
      setCustoms(next);
      setContent("sfx.custom", next as never); // SfxCustomLoader re-registers via content-change
      onChange();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingSfx(false);
    }
  }
  function removeCustom(id: string) {
    const next = customs.filter((c) => c.id !== id);
    setCustoms(next);
    setContent("sfx.custom", next as never);
    onChange();
  }

  // Custom categories Liat added (e.g. "שונים"). Each one shows up as a
  // category in both admin and the user-facing SfxPicker.
  type CustomCat = { id: string; label: string };
  const [customCats, setCustomCats] = useState<CustomCat[]>(
    () => [...((getContent("sfx.customCategories") as CustomCat[]) ?? [])],
  );
  // Order = [built-ins + customs] arranged by the admin (drag-and-drop).
  // Categories not in the saved order list fall back to default position.
  const builtInIds = Object.keys(SFX_CATEGORY_LABEL);
  const [order, setOrder] = useState<string[]>(() => {
    const saved = (getContent("sfx.categoryOrder") as string[]) ?? [];
    const known = [...builtInIds, ...customCats.map((c) => c.id)];
    const valid = saved.filter((id) => known.includes(id));
    const missing = known.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  });

  function saveOrder(next: string[]) {
    setOrder(next);
    setContent("sfx.categoryOrder", next as never);
    onChange();
  }
  function moveCategory(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= order.length) return;
    const next = [...order];
    const [m] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, m);
    saveOrder(next);
  }
  function addCustomCategory(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    // Slug: lowercase Latin alphanumeric + dashes, fall back to timestamp.
    const slug = trimmed.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 20)
      || `cat${Date.now()}`;
    let id = slug;
    let n = 2;
    while (builtInIds.includes(id) || customCats.some((c) => c.id === id)) {
      id = `${slug}-${n++}`;
    }
    const nextCats = [...customCats, { id, label: trimmed }];
    setCustomCats(nextCats);
    setContent("sfx.customCategories", nextCats as never);
    // Append the new category to the order (bottom). Admin can drag it up.
    saveOrder([...order, id]);
  }
  function removeCustomCategory(id: string) {
    if (!confirm(`למחוק את הקטגוריה? צלילים שהיו בה יחזרו לקטגוריה המקורית.`)) return;
    const nextCats = customCats.filter((c) => c.id !== id);
    setCustomCats(nextCats);
    setContent("sfx.customCategories", nextCats as never);
    saveOrder(order.filter((x) => x !== id));
    // Any sfx whose override points here → drop the override so it reverts.
    const nextOverrides = { ...catOverrides };
    let changed = false;
    Object.entries(nextOverrides).forEach(([k, v]) => {
      if (v === id) { delete nextOverrides[k]; changed = true; }
    });
    if (changed) {
      setCatOverrides(nextOverrides);
      setContent("sfx.categoryOverrides", nextOverrides as never);
    }
  }

  // Master list of categories admin sees. Built-ins always available;
  // customs appear when added.
  const ALL_CATS = [...builtInIds, ...customCats.map((c) => c.id)];
  const catTitle = (c: string) => {
    if (catLabels[c]) return catLabels[c];
    const custom = customCats.find((x) => x.id === c);
    if (custom) return custom.label;
    return SFX_CATEGORY_LABEL[c as keyof typeof SFX_CATEGORY_LABEL] ?? c;
  };

  function saveCatLabel(cat: string, value: string) {
    const trimmed = value.trim();
    // Custom category? Update its label in customCats directly.
    const customIdx = customCats.findIndex((x) => x.id === cat);
    if (customIdx >= 0) {
      const nextCats = customCats.map((x, i) =>
        i === customIdx ? { ...x, label: trimmed || x.id } : x,
      );
      setCustomCats(nextCats);
      setContent("sfx.customCategories", nextCats as never);
      onChange();
      return;
    }
    const next = { ...catLabels };
    if (trimmed === "" || trimmed === SFX_CATEGORY_LABEL[cat as keyof typeof SFX_CATEGORY_LABEL]) delete next[cat];
    else next[cat] = trimmed;
    setCatLabels(next);
    setContent("sfx.categoryLabels", next as never);
    onChange();
  }
  function moveSfx(id: string, defaultCat: string, newCat: string) {
    const next = { ...catOverrides };
    if (newCat === defaultCat) delete next[id];
    else next[id] = newCat;
    setCatOverrides(next);
    setContent("sfx.categoryOverrides", next as never);
    onChange();
  }

  function play(id: string) {
    // Stop any prior preview (toggles the same one off if clicked again).
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
      if (playingId === id) { setPlayingId(null); return; }
    }
    const sfx = SFX_LIBRARY.find((s) => s.id === id)
      ?? (getContent("sfx.custom") as { id: string; url: string }[]).find((s) => s.id === id);
    if (!sfx) return;
    // Capped preview — never plays beyond 3.5s, even for long files. Same
    // cap Liat asked for in the trigger system; consistent behavior across
    // admin + picker + live preview.
    const h = playSfxCapped(sfx.url, 0.75);
    h.audio.addEventListener("ended", () => setPlayingId((p) => (p === id ? null : p)), { once: true });
    audioRef.current = h.audio;
    setPlayingId(id);
  }
  function commit(id: string, value: string) {
    const next = { ...overrides };
    if (value.trim() === "") delete next[id];
    else next[id] = value.trim();
    setOverrides(next);
    setContent("sfx.labels", next as never);
    onChange();
  }
  function resetAll() {
    setOverrides({});
    setContent("sfx.labels", {} as never);
    onChange();
  }

  // Group by EFFECTIVE category (respecting move-overrides), built-ins + uploads.
  const effCat = (s: { id: string; category: string }) => catOverrides[s.id] ?? s.category;
  const allSfx = [
    ...SFX_LIBRARY,
    ...customs.map((c) => ({ id: c.id, url: c.url, label: c.label, category: c.category })),
  ];
  const customIds = new Set(customs.map((c) => c.id));
  // Render in admin-chosen order + include empty categories so Liat can
  // move sounds INTO an empty "שונים" (drag they don't help if the box
  // doesn't exist on screen).
  const groups = order
    .filter((c) => ALL_CATS.includes(c))
    .map((c) => ({ category: c, items: allSfx.filter((s) => effCat(s) === c) }));
  const renamedCount = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-white/10 rounded-xl p-4 flex items-center gap-3">
        <Volume2 className="w-5 h-5 text-brand-light" />
        <div className="flex-1">
          <div className="text-sm font-bold">שמות SFX — האזיני ותני שם משלך</div>
          <div className="text-[11px] text-white/50">
            השמות הנוכחיים הם גנריים (קליק #1, התראה #3...). תני שם שמתאר את הצליל כפי שאת שומעת.
            השם משתקף בכל הפיקרים באתר. ריק = חזרה לברירת מחדל.
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black">{renamedCount}</div>
          <div className="text-[10px] text-white/40">משוייכים</div>
        </div>
        {renamedCount > 0 && (
          <button onClick={resetAll}
            className="text-xs bg-red-500/15 hover:bg-red-500/25 text-red-200 px-3 py-1.5 rounded-md flex items-center gap-1 border border-red-500/30">
            <RefreshCw className="w-3 h-3" /> איפוס הכל
          </button>
        )}
      </div>

      <p className="text-[11px] text-white/40 px-1">
        💡 לחצי על שם הקטגוריה כדי לשנות אותו. ה-<span className="font-bold">⇄</span> ליד כל אפקט מעביר אותו לקטגוריה אחרת.
      </p>

      {/* Quick action: rename ALL built-ins to "Sound Effect #N" sequentially */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold">🎬 שינוי שם של הכל ל-"Sound Effect #N"</div>
          <div className="text-[11px] text-white/40 mt-0.5">
            ממספר את כל {SFX_LIBRARY.length} האפקטים ברצף (#1, #2, #3...). אפשר עדיין לערוך שם ספציפי אחר כך.
          </div>
        </div>
        <button
          onClick={() => {
            const next: Record<string, string> = { ...overrides };
            SFX_LIBRARY.forEach((s, i) => { next[s.id] = `Sound Effect #${i + 1}`; });
            setOverrides(next);
            setContent("sfx.labels", next as never);
            onChange();
          }}
          className="text-xs bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand-light px-3 py-2 rounded-md whitespace-nowrap"
        >
          ✨ מספר הכל
        </button>
      </div>

      {/* ── Upload your own sound ── */}
      <div className="bg-bg-card border border-dashed border-brand/40 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-bold mb-0.5">🎵 העלאת סאונד משלך</div>
            <div className="text-[11px] text-white/50">
              MP3 / WAV / OGG עד 3MB. הסאונד יופיע מיד בכל בוררי הצלילים באתר ובייצוא.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={uploadCat}
              onChange={(e) => setUploadCat(e.target.value)}
              className="bg-bg-input border border-white/10 rounded-md text-xs text-white/80 px-2 py-2 focus:outline-none focus:border-brand/40"
            >
              {ALL_CATS.map((c) => (
                <option key={c} value={c}>{catTitle(c)}</option>
              ))}
            </select>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploadingSfx}
              className="text-xs bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand-light px-3 py-2 rounded-md disabled:opacity-50 whitespace-nowrap"
            >
              {uploadingSfx ? "מעלה..." : "+ בחרי קובץ"}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSfx(f); e.target.value = ""; }}
            />
          </div>
        </div>
        {uploadError && (
          <div className="mt-2 text-[11px] bg-red-500/10 border border-red-500/30 text-red-200 rounded p-2">⚠️ {uploadError}</div>
        )}
      </div>

      {/* + Add custom category */}
      <AddCategoryRow onAdd={addCustomCategory} />

      {groups.map((g, gIdx) => {
        const isCustom = customCats.some((c) => c.id === g.category);
        return (
        <div
          key={g.category}
          className="bg-bg-card border border-white/10 rounded-xl p-4"
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(gIdx)); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={(e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
            if (!Number.isNaN(fromIdx)) moveCategory(fromIdx, gIdx);
          }}
        >
          <div className="text-sm font-bold mb-3 flex items-center gap-2">
            <span
              className="cursor-grab text-white/30 hover:text-white/70 shrink-0"
              title="גררי לסדר מחדש"
            >
              <GripVertical className="w-4 h-4" />
            </span>
            <input
              defaultValue={catTitle(g.category)}
              onBlur={(e) => saveCatLabel(g.category, e.target.value)}
              className="bg-transparent font-bold focus:outline-none focus:bg-white/5 rounded px-1.5 py-0.5 border border-transparent focus:border-white/15 hover:border-white/10 transition-colors"
              title="לחצי לשינוי שם הקטגוריה"
            />
            <span className="text-[10px] text-white/40 font-normal">({g.items.length})</span>
            {isCustom && (
              <button
                onClick={() => removeCustomCategory(g.category)}
                className="ml-auto p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"
                title="מחיקת קטגוריה (הצלילים יחזרו לקטגוריה המקורית)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {g.items.length === 0 && (
            <div className="text-[11px] text-white/30 italic py-3 px-1">
              קטגוריה ריקה — העבירי צלילים אליה דרך הסלקטור בכל שורה
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {g.items.map((s) => (
              <div key={s.id} className={`flex items-center gap-1.5 rounded-md border p-1.5 transition-opacity
                ${hiddenSfx[s.id] ? "opacity-40 bg-bg-input/40 border-white/5"
                  : overrides[s.id] || catOverrides[s.id] ? "bg-brand/10 border-brand/30"
                  : "bg-bg-input border-white/10"}`}>
                <button
                  onClick={() => toggleHiddenSfx(s.id)}
                  className={`p-1.5 rounded-md hover:bg-white/10 shrink-0 ${
                    hiddenSfx[s.id] ? "text-white/30" : "text-emerald-300/80"
                  }`}
                  title={hiddenSfx[s.id] ? "מוסתר מהמשתמשים — לחצי להציג" : "הסתר מהמשתמשים"}
                >
                  {hiddenSfx[s.id]
                    ? <EyeOff className="w-3.5 h-3.5" />
                    : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => play(s.id)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                  title="האזנה"
                >
                  {playingId === s.id
                    ? <Pause className="w-3.5 h-3.5 text-brand-light animate-pulse" />
                    : <Play className="w-3.5 h-3.5" />}
                </button>
                <input
                  defaultValue={overrides[s.id] ?? s.label}
                  onBlur={(e) => commit(s.id, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-xs text-white/90 focus:outline-none focus:bg-white/5 rounded px-1 py-0.5"
                  placeholder={s.label}
                />
                {/* Move to another category */}
                <select
                  value={effCat(s)}
                  onChange={(e) => moveSfx(s.id, s.category, e.target.value)}
                  title="העברה לקטגוריה אחרת"
                  className="shrink-0 bg-bg-panel border border-white/10 rounded text-[10px] text-white/60 px-1 py-1 max-w-[5.5rem] focus:outline-none focus:border-brand/40"
                >
                  {ALL_CATS.map((c) => (
                    <option key={c} value={c}>{catTitle(c)}</option>
                  ))}
                </select>
                {customIds.has(s.id) && (
                  <button
                    onClick={() => removeCustom(s.id)}
                    className="shrink-0 p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"
                    title="מחיקת סאונד שהעלית"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}

/** "+ הוסיפי קטגוריה חדשה" — controlled inline form. */
function AddCategoryRow({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-bg-card border-2 border-dashed border-white/15 rounded-xl py-3 text-sm text-white/60 hover:text-white hover:border-brand/50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> הוסיפי קטגוריה חדשה
      </button>
    );
  }
  return (
    <div className="bg-bg-card border border-brand/40 rounded-xl p-3 flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onAdd(value); setValue(""); setOpen(false); }
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        placeholder='שם הקטגוריה (למשל: "שונים", "מצבי רוח", "סרקאזם")'
        className="flex-1 bg-bg-input border border-white/10 rounded px-3 py-1.5 text-sm"
        dir="rtl"
      />
      <button
        onClick={() => { onAdd(value); setValue(""); setOpen(false); }}
        disabled={!value.trim()}
        className="px-3 py-1.5 bg-brand hover:bg-brand-light disabled:opacity-40 rounded text-sm font-bold"
      >
        הוסיפי
      </button>
      <button
        onClick={() => { setValue(""); setOpen(false); }}
        className="p-1.5 text-white/40 hover:text-white"
        title="ביטול"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── CMS: Lottie management ──────────────────────────────────────
function LottieTab({ onChange }: { onChange: () => void }) {
  const [hidden, setHidden]   = useState<Record<string, true>>(() => ({ ...(getContent("lottie.hidden") as Record<string, true>) }));
  const [names, setNames]     = useState<Record<string, string>>(() => ({ ...(getContent("lottie.names") as Record<string, string>) }));
  const [colors, setColors]   = useState<Record<string, string>>(() => ({ ...(getContent("lottie.colors") as Record<string, string>) }));
  const [bgRemoved, setBgRemoved] = useState<Record<string, true>>(() => ({ ...(getContent("lottie.bgRemoved") as Record<string, true>) }));
  type CustomLot = { id: string; name: string; jsonPath: string; defaultColor?: string };
  const [customs, setCustoms] = useState<CustomLot[]>(() => (getContent("lottie.custom") as CustomLot[]) ?? []);
  const [previews, setPreviews] = useState<Record<string, unknown>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ALL: Array<{ id: string; name: string; jsonPath: string; defaultColor?: string; isCustom: boolean }> = [
    ...LOTTIE_ICONS.map((i) => ({ id: i.id, name: i.name, jsonPath: i.jsonPath, defaultColor: i.defaultColor, isCustom: false })),
    ...customs.map((c) => ({ ...c, isCustom: true })),
  ];

  useEffect(() => {
    ALL.forEach((i) => {
      if (previews[i.id]) return;
      fetch(i.jsonPath).then((r) => r.json())
        .then((j) => setPreviews((p) => ({ ...p, [i.id]: j }))).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customs.length]);

  function toggleHidden(id: string) {
    const next = { ...hidden };
    if (next[id]) delete next[id]; else next[id] = true;
    setHidden(next);
    setContent("lottie.hidden", next as never);
    onChange();
  }
  function saveName(id: string, value: string, fallback: string) {
    const next = { ...names };
    if (!value.trim() || value.trim() === fallback) delete next[id];
    else next[id] = value.trim();
    setNames(next);
    setContent("lottie.names", next as never);
    onChange();
  }
  function saveColor(id: string, value: string) {
    const next = { ...colors };
    next[id] = value;
    setColors(next);
    setContent("lottie.colors", next as never);
    onChange();
  }
  function toggleBg(id: string) {
    const next = { ...bgRemoved };
    if (next[id]) delete next[id]; else next[id] = true;
    setBgRemoved(next);
    setContent("lottie.bgRemoved", next as never);
    onChange();
  }
  function removeCustom(id: string) {
    if (!confirm("למחוק את האנימציה?")) return;
    const next = customs.filter((c) => c.id !== id);
    setCustoms(next);
    setContent("lottie.custom", next as never);
    onChange();
  }
  async function upload(file: File) {
    setUploading(true); setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/lottie/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "העלאה נכשלה");
      const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "אנימציה חדשה";
      const next: CustomLot[] = [...customs, { id: j.id, name: baseName, jsonPath: j.url, defaultColor: "#7C3AED" }];
      setCustoms(next);
      setContent("lottie.custom", next as never);
      onChange();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/50">
        כאן את שולטת באנימציות ה-Lottie שזמינות למשתמשים: הסתרה, שינוי שם, צבע ברירת מחדל, והעלאת חדשות (JSON).
        סרטונים ישנים שכבר השתמשו באנימציה מוסתרת — ימשיכו לעבוד.
      </div>

      {/* Upload */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4" /> העלאת אנימציה חדשה (Lottie JSON)
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            disabled={uploading}
            className="text-xs"
          />
          {uploading && <span className="text-xs text-white/50">מעלה…</span>}
        </div>
        <div className="text-[10px] text-white/40 mt-1">
          מקור מומלץ: <a href="https://lottiefiles.com" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">LottieFiles.com</a> (חינמי) — הורידי JSON וקטורי בלבד (לא רסטר).
        </div>
        {uploadError && (
          <div className="mt-2 text-[11px] bg-red-500/10 border border-red-500/30 text-red-200 rounded p-2">⚠️ {uploadError}</div>
        )}
      </div>

      {/* Grid */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3 flex items-center justify-between">
          <span>{ALL.length} אנימציות ({ALL.length - Object.keys(hidden).length} פעילות, {Object.keys(hidden).length} מוסתרות)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ALL.map((icon) => {
            const isHidden = !!hidden[icon.id];
            const currentName = names[icon.id] ?? icon.name;
            const currentColor = colors[icon.id] ?? icon.defaultColor ?? "#7C3AED";
            return (
              <div
                key={icon.id}
                className={`relative border rounded-lg p-2.5 space-y-2 transition-opacity ${
                  isHidden ? "bg-bg-input/30 border-white/5 opacity-50" : "bg-bg-input border-white/10"
                }`}
              >
                <LottieHoverPreview
                  json={previews[icon.id]}
                  stripBg={!!bgRemoved[icon.id]}
                />

                <input
                  defaultValue={currentName}
                  onBlur={(e) => saveName(icon.id, e.target.value, icon.name)}
                  className="w-full bg-bg-card border border-white/10 rounded px-2 py-1 text-xs"
                  placeholder="שם להצגה"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => saveColor(icon.id, e.target.value)}
                    className="w-9 h-7 rounded bg-bg-card border border-white/10"
                    title="צבע ברירת מחדל"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleBg(icon.id)}
                      className={`p-1.5 rounded border transition-colors ${
                        bgRemoved[icon.id]
                          ? "border-cyan-500/40 text-cyan-300 bg-cyan-500/10"
                          : "border-white/10 text-white/40 hover:text-white"
                      }`}
                      title={bgRemoved[icon.id] ? "רקע מוסר — לחצי להחזיר" : "הסר רקע"}
                    >
                      {bgRemoved[icon.id] ? <SquareDashed className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => toggleHidden(icon.id)}
                      className={`p-1.5 rounded border transition-colors ${
                        isHidden
                          ? "border-white/10 text-white/40 hover:text-white"
                          : "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                      }`}
                      title={isHidden ? "הצג" : "הסתר"}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {icon.isCustom && (
                      <button
                        onClick={() => removeCustom(icon.id)}
                        className="p-1.5 rounded border border-white/10 text-white/40 hover:text-red-300 hover:border-red-500/30"
                        title="מחק לצמיתות"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {icon.isCustom && (
                  <div className="text-[9px] text-cyan-300/70">העלאה שלי</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Show a Lottie preview only when hovered, otherwise render NOTHING — just
 * the dark placeholder. With 25+ animations in the admin grid, autoplaying
 * them all simultaneously freezes low-RAM machines (Liat hit this).
 * Hover-only keeps the grid scrollable at 60fps.
 */
function LottieHoverPreview({ json, stripBg = false }: { json: unknown; stripBg?: boolean }) {
  const [hover, setHover] = useState(false);
  // Apply bg strip if admin marked this icon "no background". Memo on
  // stripBg flag so toggling is instant; the heavy clone-and-walk only runs
  // when the toggle changes, not on every hover.
  const rendered = useMemo(
    () => (json && stripBg ? stripLottieBg(json) : json),
    [json, stripBg],
  );
  return (
    <div
      className="w-full aspect-square bg-bg-card rounded relative cursor-pointer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!rendered && <div className="absolute inset-0 animate-pulse" />}
      {rendered && hover ? (
        <Lottie animationData={rendered as object} loop autoplay style={{ width: "100%", height: "100%" }} />
      ) : rendered ? (
        // Static thumbnail: render once, no autoplay, no loop. Lottie still
        // paints frame 0 → user sees the icon shape without CPU cost.
        <Lottie animationData={rendered as object} loop={false} autoplay={false} style={{ width: "100%", height: "100%" }} />
      ) : null}
      <div className="absolute bottom-1 right-1 text-[8px] text-white/30 pointer-events-none">
        {hover ? "▶" : "hover"}
      </div>
    </div>
  );
}

// ── CMS: Emoji extras & hidden ─────────────────────────────────
function EmojiTab({ onChange }: { onChange: () => void }) {
  const [extras, setExtras] = useState<Record<string, string[]>>(() => ({ ...(getContent("emoji.extras") as Record<string, string[]>) }));
  const [hidden, setHidden] = useState<string[]>(() => [...((getContent("emoji.hidden") as string[]) ?? [])]);
  const [inputByCat, setInputByCat] = useState<Record<string, string>>({});

  function addEmoji(cat: string) {
    const raw = (inputByCat[cat] ?? "").trim();
    if (!raw) return;
    // Split by spaces so she can paste "🦅 🐺 🦁" at once
    const tokens = raw.split(/\s+/).filter(Boolean);
    const existing = extras[cat] ?? [];
    const next = { ...extras, [cat]: Array.from(new Set([...existing, ...tokens])) };
    setExtras(next);
    setContent("emoji.extras", next as never);
    setInputByCat((p) => ({ ...p, [cat]: "" }));
    onChange();
  }
  function removeExtra(cat: string, emoji: string) {
    const next = { ...extras, [cat]: (extras[cat] ?? []).filter((e) => e !== emoji) };
    if (next[cat].length === 0) delete next[cat];
    setExtras(next);
    setContent("emoji.extras", next as never);
    onChange();
  }
  function toggleHidden(emoji: string) {
    const set = new Set(hidden);
    if (set.has(emoji)) set.delete(emoji); else set.add(emoji);
    const next = Array.from(set);
    setHidden(next);
    setContent("emoji.hidden", next as never);
    onChange();
  }

  const hiddenSet = new Set(hidden);

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/50">
        הוספה: הדביקי אמוג'ים בשורת ההוספה והקליקי על <strong>+</strong>. הסתרה: לחצי על אמוג'י קיים כדי לסמן אותו כמוסתר (משתמשים לא יראו).
      </div>

      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3">{hidden.length} אמוג'ים מוסתרים</div>
        {hidden.length === 0 ? (
          <div className="text-xs text-white/40">לא הסתרת אמוג'ים. לחצי על כל אמוג'י למטה כדי להסתיר.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((e) => (
              <button key={e} onClick={() => toggleHidden(e)}
                className="text-2xl p-1.5 rounded-md bg-red-500/10 border border-red-500/30 hover:bg-red-500/20" title="לחצי להחזרה">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {EMOJI_CATEGORIES.map((cat) => (
        <div key={cat.name} className="bg-bg-card border border-white/10 rounded-xl p-4">
          <div className="text-sm font-bold mb-3 flex items-center justify-between gap-2">
            <span>{cat.name}</span>
            <span className="text-[10px] text-white/40 font-normal">
              {cat.emojis.length} מובנים + {(extras[cat.name] ?? []).length} שלך
            </span>
          </div>

          <div className="text-[10px] uppercase text-white/30 mb-1">מובנים (לחצי להסתרה)</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {cat.emojis.map((e) => (
              <button key={e} onClick={() => toggleHidden(e)}
                className={`text-2xl p-1.5 rounded-md border transition ${
                  hiddenSet.has(e)
                    ? "bg-red-500/10 border-red-500/40 opacity-40 line-through"
                    : "bg-bg-input border-white/10 hover:border-white/30"
                }`}
                title={hiddenSet.has(e) ? "מוסתר — לחצי להחזרה" : "לחצי להסתרה"}>
                {e}
              </button>
            ))}
          </div>

          {(extras[cat.name]?.length ?? 0) > 0 && (
            <>
              <div className="text-[10px] uppercase text-cyan-300/70 mb-1">שלך (לחצי למחיקה)</div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(extras[cat.name] ?? []).map((e) => (
                  <button key={e} onClick={() => removeExtra(cat.name, e)}
                    className="text-2xl p-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20"
                    title="מחקי">
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <input
              value={inputByCat[cat.name] ?? ""}
              onChange={(e) => setInputByCat((p) => ({ ...p, [cat.name]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") addEmoji(cat.name); }}
              placeholder="🦅 🐺 🦁  (אפשר כמה ביחד)"
              className="flex-1 bg-bg-input border border-white/10 rounded px-3 py-2 text-lg"
              dir="rtl"
            />
            <button onClick={() => addEmoji(cat.name)}
              className="px-3 py-2 bg-brand hover:bg-brand-light rounded text-sm font-bold flex items-center gap-1">
              <Plus className="w-4 h-4" /> הוסיפי
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CMS: WOW power-words ─────────────────────────────────────────
function WowTab({ onChange }: { onChange: () => void }) {
  const [extras, setExtras] = useState<string[]>(() => [...((getContent("wow.extraWords") as string[]) ?? [])]);
  const [hidden, setHidden] = useState<string[]>(() => [...((getContent("wow.hiddenWords") as string[]) ?? [])]);
  const [input, setInput] = useState("");

  function addWord() {
    const raw = input.trim();
    if (!raw) return;
    const tokens = raw.split(/[\s,،]+/).map((s) => s.trim()).filter(Boolean);
    const next = Array.from(new Set([...extras, ...tokens]));
    setExtras(next);
    setContent("wow.extraWords", next as never);
    setInput("");
    onChange();
  }
  function removeExtra(w: string) {
    const next = extras.filter((x) => x !== w);
    setExtras(next);
    setContent("wow.extraWords", next as never);
    onChange();
  }
  function toggleBaseHidden(key: string) {
    const set = new Set(hidden);
    if (set.has(key)) set.delete(key); else set.add(key);
    const next = Array.from(set);
    setHidden(next);
    setContent("wow.hiddenWords", next as never);
    onChange();
  }
  const hiddenSet = new Set(hidden);

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/50 leading-relaxed">
        כשהמשתמש אומר מילה מהרשימה — האפקטים <strong>WOW</strong> פועלים אוטומטית בנקודה הזו: זום פעימה, פיצוץ נוצצים, וניעור עדין של המסך.
        כאן את שולטת אילו מילים מפעילות את זה — מוסיפה משלך וגם מסתירה את המילים המובנות שלא מתאימות לך.
      </div>

      {/* Add new */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4" /> הוספת מילים חדשות (משלך)
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addWord(); }}
            placeholder="וואלה, סבבה, יאללה, אש (פסיק או רווח בין מילים)"
            className="flex-1 bg-bg-input border border-white/10 rounded px-3 py-2 text-sm"
            dir="rtl"
          />
          <button onClick={addWord}
            className="px-3 py-2 bg-brand hover:bg-brand-light rounded text-sm font-bold">
            הוסיפי
          </button>
        </div>
        {extras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {extras.map((w) => (
              <button key={w} onClick={() => removeExtra(w)}
                className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/40 hover:bg-red-500/20 hover:border-red-500/40 transition"
                title="לחצי למחיקה">
                {w} ✕
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Built-in: hide toggles */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3">מילים מובנות (לחצי להסתרה)</div>
        <div className="flex flex-wrap gap-1.5">
          {POWER_WORDS_BASE.map((p) => (
            <button key={p.key} onClick={() => toggleBaseHidden(p.key)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                hiddenSet.has(p.key)
                  ? "bg-red-500/10 border-red-500/40 text-white/40 line-through"
                  : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}>
              {p.key}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-white/40 mt-2">
          {POWER_WORDS_BASE.length - hidden.length} פעילות, {hidden.length} מוסתרות
        </div>
      </div>
    </div>
  );
}

// ── CMS: Drama words (B&W flash trigger) ──────────────────────
function DramaTab({ onChange }: { onChange: () => void }) {
  const [extras, setExtras] = useState<string[]>(() => [...((getContent("drama.extraWords") as string[]) ?? [])]);
  const [hidden, setHidden] = useState<string[]>(() => [...((getContent("drama.hiddenWords") as string[]) ?? [])]);
  const [input, setInput] = useState("");

  function addWord() {
    const raw = input.trim();
    if (!raw) return;
    const tokens = raw.split(/[\s,،]+/).map((s) => s.trim()).filter(Boolean);
    const next = Array.from(new Set([...extras, ...tokens]));
    setExtras(next);
    setContent("drama.extraWords", next as never);
    setInput("");
    onChange();
  }
  function removeExtra(w: string) {
    const next = extras.filter((x) => x !== w);
    setExtras(next);
    setContent("drama.extraWords", next as never);
    onChange();
  }
  function toggleBaseHidden(key: string) {
    const set = new Set(hidden);
    if (set.has(key)) set.delete(key); else set.add(key);
    const next = Array.from(set);
    setHidden(next);
    setContent("drama.hiddenWords", next as never);
    onChange();
  }
  const hiddenSet = new Set(hidden);

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/50 leading-relaxed">
        כשהמשתמש אומר ביטוי מהרשימה — הוידאו <strong>קופץ לשחור-לבן ל-1.2 שניות</strong> 🎭.
        כאן את שולטת אילו ביטויים מפעילים את האפקט. לטיפ: ביטויים של 2-3 מילים עובדים הכי טוב — מילים בודדות כמו "מה" / "באמת" מציפות.
      </div>

      {/* Add new */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4" /> הוספת ביטויים (משלך)
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addWord(); }}
            placeholder='לדוגמה: "פגעו בנו", "הציל אותי", "לא ייאמן" — פסיק או רווח בין ביטויים'
            className="flex-1 bg-bg-input border border-white/10 rounded px-3 py-2 text-sm"
            dir="rtl"
          />
          <button onClick={addWord}
            className="px-3 py-2 bg-brand hover:bg-brand-light rounded text-sm font-bold">
            הוסיפי
          </button>
        </div>
        {extras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {extras.map((w) => (
              <button key={w} onClick={() => removeExtra(w)}
                className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/40 hover:bg-red-500/20 hover:border-red-500/40 transition"
                title="לחצי למחיקה">
                {w} ✕
              </button>
            ))}
          </div>
        )}
        <div className="text-[10px] text-white/40 mt-2">
          💡 שים לב: ביטויים מילולים בלבד (לא ביטויי regex). המערכת מחפשת התאמה מדויקת בכתוביות.
        </div>
      </div>

      {/* Built-in: hide toggles */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3">ביטויים מובנים (לחצי להסתרה)</div>
        <div className="flex flex-wrap gap-1.5">
          {DRAMA_WORDS_BASE.map((p) => (
            <button key={p.key} onClick={() => toggleBaseHidden(p.key)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                hiddenSet.has(p.key)
                  ? "bg-red-500/10 border-red-500/40 text-white/40 line-through"
                  : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}>
              {p.key}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-white/40 mt-2">
          {DRAMA_WORDS_BASE.length - hidden.length} פעילים, {hidden.length} מוסתרים
        </div>
      </div>
    </div>
  );
}

// ── CMS: Intro animation visibility ─────────────────────────────
function IntroTab({ onChange }: { onChange: () => void }) {
  const [hidden, setHidden] = useState<Record<string, true>>(
    () => ({ ...((getContent("intro.hidden") as Record<string, true>) ?? {}) }),
  );
  function toggle(id: string) {
    if (id === "none") return; // "ללא" can't be hidden — it's the default
    const next = { ...hidden };
    if (next[id]) delete next[id]; else next[id] = true;
    setHidden(next);
    setContent("intro.hidden", next as never);
    onChange();
  }
  const visibleCount = INTRO_ANIMATIONS.filter((i) => !hidden[i.id]).length;
  return (
    <div className="space-y-4">
      <div className="text-xs text-white/50 leading-relaxed">
        כאן את שולטת אילו <strong>אפקטי כניסה לסרטון</strong> זמינים למשתמשים בעורך
        (טאב "אפקטים מיוחדים" → "אנימציית כניסה לסרטון"). לחיצה על אפקט מסתירה/מציגה אותו.
        סרטונים שכבר השתמשו באפקט מוסתר ימשיכו לעבוד.
      </div>
      <div className="bg-bg-card border border-white/10 rounded-xl p-4">
        <div className="text-sm font-bold mb-3 flex items-center justify-between">
          <span>אפקטי כניסה ({visibleCount} פעילים, {Object.keys(hidden).length} מוסתרים)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {INTRO_ANIMATIONS.map((opt) => {
            if (opt.id === "none") return null;
            const isHidden = !!hidden[opt.id];
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className={`text-right p-3 rounded-lg border transition-colors ${
                  isHidden
                    ? "bg-bg-input/40 border-white/5 opacity-50"
                    : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
                title={isHidden ? "מוסתר — לחצי להציג" : "לחצי להסתרה"}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{opt.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{opt.label}</div>
                    <div className="text-[10px] text-white/40 truncate">{opt.desc}</div>
                  </div>
                  {isHidden
                    ? <EyeOff className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    : <Eye className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-white/40 mt-3">
          💡 הערה: "ללא" תמיד פעיל — זה ברירת המחדל למשתמשים שלא בוחרים אפקט.
        </div>
      </div>
    </div>
  );
}

