"use client";

import { useEffect, useRef, useState } from "react";
import {
  Users, Film, DollarSign, BarChart3, AlertTriangle, RefreshCw,
  FileText, Palette, Tag, Image as ImageIcon, Trash2, Plus,
  Volume2, Play, Pause,
} from "lucide-react";
import { SFX_LIBRARY, SFX_CATEGORY_LABEL, listSfxByCategory } from "@/lib/sfxLibrary";
import {
  listUsers, listVideos, listRevenue, updateUserCredits, setUserStatus, getStats, resetStore,
  type AdminUser, type VideoJob, type RevenueTxn,
} from "@/lib/adminStore";
import {
  CONTENT_DEFAULTS, getContent, setContent, resetContentKey, resetAllContent,
  listContentByGroup, type ContentKey,
} from "@/lib/contentStore";

type Tab = "overview" | "users" | "videos" | "revenue" | "content" | "branding" | "pricing" | "sfx";

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
  whisper: { label: "מודלי תמלול",    tab: "content"  },
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-white/40">טוען...</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-white">
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

function UsersTab({ onChange }: { onChange: () => void }) {
  const users = listUsers();
  return (
    <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-input text-[11px] uppercase tracking-wider text-white/50">
          <tr>
            <th className="text-right p-3">שם</th>
            <th className="text-right p-3">אימייל</th>
            <th className="text-right p-3">קרדיט</th>
            <th className="text-right p-3">סה״כ שילם</th>
            <th className="text-right p-3">סרטונים</th>
            <th className="text-right p-3">סטטוס</th>
            <th className="text-right p-3">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: AdminUser) => (
            <tr key={u.id} className="border-t border-white/5">
              <td className="p-3 font-medium">{u.name}</td>
              <td className="p-3 text-white/60 text-xs">{u.email}</td>
              <td className="p-3">
                <input type="number" value={u.credits}
                  onChange={(e) => { updateUserCredits(u.id, parseInt(e.target.value) || 0); onChange(); }}
                  className="w-20 bg-bg-input border border-white/10 rounded px-2 py-1 text-xs" />
              </td>
              <td className="p-3">₪{u.totalSpent}</td>
              <td className="p-3">{u.videosCount}</td>
              <td className="p-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full
                  ${u.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                  {u.status === "active" ? "פעיל" : "מושעה"}
                </span>
              </td>
              <td className="p-3">
                <button
                  onClick={() => { setUserStatus(u.id, u.status === "active" ? "suspended" : "active"); onChange(); }}
                  className="text-xs text-white/60 hover:text-white underline">
                  {u.status === "active" ? "השעי" : "הפעלי"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  // Only show TEXT-like groups (skip branding/pricing — they have their own tabs)
  const textGroups = ["home", "mode", "footer", "welcome", "whisper"];
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">
        עריכת כל הטקסטים הסטטיים באתר. שמירה מיידית. השינויים נראים לכל משתמש (במצב פיתוח: רק במחשב הזה).
      </p>
      {textGroups.map((grp) => {
        const keys = groups[grp];
        if (!keys?.length) return null;
        return (
          <div key={grp} className="bg-bg-card border border-white/10 rounded-xl p-4">
            <div className="text-sm font-bold mb-3">{GROUP_LABELS[grp]?.label ?? grp}</div>
            <div className="space-y-3">
              {keys.map((k) => (
                <ContentField key={k} ck={k} onChange={onChange} />
              ))}
            </div>
          </div>
        );
      })}
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
  const [logoUrl,     setLogoUrl]     = useState(getContent("brand.logoUrl"));
  const [primary,     setPrimary]     = useState(getContent("brand.primaryColor"));
  const [accent,      setAccent]      = useState(getContent("brand.accentColor"));
  const [heroImage,   setHeroImage]   = useState(getContent("brand.heroImageUrl"));

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  function play(id: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      if (playingId === id) { setPlayingId(null); return; }
    }
    const sfx = SFX_LIBRARY.find((s) => s.id === id);
    if (!sfx) return;
    const a = new Audio(sfx.url);
    a.volume = 0.75;
    a.play().catch(() => {});
    a.onended = () => setPlayingId((p) => (p === id ? null : p));
    audioRef.current = a;
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

  const groups = listSfxByCategory();
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

      {groups.map((g) => (
        <div key={g.category} className="bg-bg-card border border-white/10 rounded-xl p-4">
          <div className="text-sm font-bold mb-3 flex items-center gap-2">
            <span>{SFX_CATEGORY_LABEL[g.category]}</span>
            <span className="text-[10px] text-white/40 font-normal">({g.items.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {g.items.map((s) => (
              <div key={s.id} className={`flex items-center gap-2 rounded-md border p-1.5
                ${overrides[s.id] ? "bg-brand/10 border-brand/30" : "bg-bg-input border-white/10"}`}>
                <button
                  onClick={() => play(s.id)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white"
                  title="האזנה"
                >
                  {playingId === s.id
                    ? <Pause className="w-3.5 h-3.5 text-brand-light animate-pulse" />
                    : <Play className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[10px] text-white/30 font-mono w-12 truncate">#{s.id}</span>
                <input
                  defaultValue={overrides[s.id] ?? s.label}
                  onBlur={(e) => commit(s.id, e.target.value)}
                  className="flex-1 bg-transparent text-xs text-white/90 focus:outline-none focus:bg-white/5 rounded px-1 py-0.5"
                  placeholder={s.label}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

