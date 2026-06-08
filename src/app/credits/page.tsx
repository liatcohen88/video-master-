"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Coins, Sparkles, AlertTriangle, Zap, Crown, Rocket, Film,
  Check, Shield, RefreshCw, Subtitles, Wand2, Mic, Layers,
} from "lucide-react";
import { getCredits, addCredits } from "@/lib/credits";
import { useContent } from "@/lib/useContent";

// Visual personality per package id. Falls back to the "starter" theme for
// unknown CMS-added packages.
const THEME: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  glow: string;
  iconBg: string;
  emoji: string;
  hint: string;
}> = {
  mini:     { icon: Zap,    gradient: "from-sky-500/20 to-cyan-500/5",          glow: "shadow-sky-500/10",     iconBg: "bg-sky-500/20 text-sky-300",     emoji: "✨", hint: "לטעימה — 2-3 סרטונים" },
  starter:  { icon: Film,   gradient: "from-violet-500/25 to-purple-500/5",     glow: "shadow-violet-500/20",  iconBg: "bg-violet-500/20 text-violet-300", emoji: "🎬", hint: "המתאים לרוב היוצרים" },
  pro:      { icon: Rocket, gradient: "from-fuchsia-500/25 to-pink-500/5",      glow: "shadow-fuchsia-500/20", iconBg: "bg-fuchsia-500/20 text-fuchsia-300", emoji: "🚀", hint: "לעבודה שוטפת" },
  business: { icon: Crown,  gradient: "from-amber-400/25 to-orange-500/5",      glow: "shadow-amber-500/30",   iconBg: "bg-amber-400/20 text-amber-300",  emoji: "👑", hint: "סטודיו מקצועי" },
};
const FALLBACK_THEME = THEME.starter;

export default function CreditsPage() {
  const [credits, setCreditsLocal] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const packages = useContent("pricing.packages");
  const costSubtitles = useContent("pricing.cost.subtitles_only");
  const costEffects   = useContent("pricing.cost.basic_effects");
  const costPodcast   = useContent("pricing.cost.podcast");
  const costAdvanced  = useContent("pricing.cost.advanced_effects");
  const costMulti     = useContent("pricing.cost.multi_video");

  useEffect(() => {
    setCreditsLocal(getCredits());
    setHydrated(true);
    const refresh = () => setCreditsLocal(getCredits());
    window.addEventListener("credits-change", refresh);
    return () => window.removeEventListener("credits-change", refresh);
  }, []);

  async function buy(id: string) {
    setBusy(id); setMsg(null);
    try {
      const pkg = packages.find((p) => p.id === id);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: id, packageOverride: pkg }),
      });
      const j = await res.json();
      if (j.mode === "dev-stub") {
        addCredits(j.creditsToAdd);
        setMsg(`✓ נוספו ${j.creditsToAdd} קרדיט (מצב פיתוח — בלי תשלום)`);
      } else if (j.url) {
        window.location.href = j.url;
      } else {
        setMsg(j.error || "שגיאה לא צפויה");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // "What can I do with current balance" calculator
  const calc = useMemo(() => ({
    subtitles: Math.floor(credits / costSubtitles),
    effects:   Math.floor(credits / costEffects),
    advanced:  Math.floor(credits / costAdvanced),
  }), [credits, costSubtitles, costEffects, costAdvanced]);

  if (!hydrated) return <div className="min-h-screen bg-bg" />;

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-white">
      {/* Soft animated brand glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-violet-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-60 -left-40 w-[420px] h-[420px] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-[11px] text-amber-200 flex items-center gap-2 mb-6 justify-center">
          <AlertTriangle className="w-3.5 h-3.5" />
          מצב פיתוח · Stripe יופעל אחרי המעבר ל-Lovable
        </div>

        {/* ── Balance + calculator in one compact strip ── */}
        <div className="bg-gradient-to-br from-violet-500/20 via-bg-card to-cyan-500/10 border border-white/10 rounded-2xl p-5 mb-8 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 md:border-l md:border-white/10 md:pl-6">
            <div className="p-2.5 rounded-xl bg-yellow-400/20">
              <Coins className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <div className="text-[11px] text-white/50 uppercase tracking-wider">היתרה שלך</div>
              <div className="text-3xl font-bold leading-none mt-0.5">
                {credits.toLocaleString()} <span className="text-sm text-white/40 font-normal">קרדיט</span>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-white/50 mb-1.5">איתם את יכולה לעשות:</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5"><span className="text-violet-300 font-bold">{calc.subtitles}</span><span className="text-white/60">סרטוני כתוביות</span></span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1.5"><span className="text-fuchsia-300 font-bold">{calc.effects}</span><span className="text-white/60">עם אפקטים</span></span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1.5"><span className="text-amber-300 font-bold">{calc.advanced}</span><span className="text-white/60">מתקדמים</span></span>
            </div>
          </div>
        </div>

        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="inline-block text-[11px] uppercase tracking-widest text-violet-300 font-bold mb-2">חבילות קרדיט</div>
          <h2 className="text-3xl font-black mb-2">בחרי את הקצב שלך</h2>
          <p className="text-sm text-white/50">חיוב חד-פעמי · קרדיט תקף ללא הגבלת זמן · אין מנוי חודשי</p>
        </div>

        {/* ── Packages grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((p) => {
            const t = THEME[p.id] ?? FALLBACK_THEME;
            const Icon = t.icon;
            const isPopular = p.highlight === "הכי נמכר";
            const isBestValue = p.highlight === "הכי משתלם";
            const elevated = isPopular || isBestValue;
            const isBusy = busy === p.id;

            return (
              <div key={p.id}
                className={`relative rounded-2xl p-6 flex flex-col bg-gradient-to-br ${t.gradient} border transition-all
                  ${elevated
                    ? `border-white/25 shadow-xl ${t.glow} lg:scale-[1.04] z-10`
                    : "border-white/10 hover:border-white/20"}`}>
                {p.highlight && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap
                    ${isBestValue ? "bg-amber-400 text-amber-900" : "bg-violet-500 text-white"}`}>
                    {isBestValue ? "👑 " : isPopular ? "🔥 " : ""}{p.highlight}
                  </div>
                )}

                {/* Top: icon + name */}
                <div className="flex items-center gap-2.5 mb-5">
                  <div className={`p-2 rounded-xl ${t.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm leading-tight">{p.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{t.hint}</div>
                  </div>
                </div>

                {/* Hero number: credits */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black tracking-tight">{p.credits}</span>
                    <span className="text-sm text-white/40">קרדיט</span>
                  </div>
                </div>

                {/* What you get bullets — keep tight, 2 lines */}
                <ul className="space-y-1.5 text-[11px] text-white/60 mb-5 flex-1">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    עד {Math.floor(p.credits / costSubtitles)} סרטוני כתוביות
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    עד {Math.floor(p.credits / costEffects)} עם אפקטים
                  </li>
                </ul>

                {/* Price + CTA */}
                <div className="pt-4 border-t border-white/10">
                  <div className="text-center mb-3">
                    <span className="text-4xl font-black">{p.priceIls}</span>
                    <span className="text-lg text-white/40 mr-1">₪</span>
                  </div>
                  <button
                    disabled={isBusy}
                    onClick={() => buy(p.id)}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all
                      ${elevated
                        ? "bg-white text-bg shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        : "bg-white/10 text-white hover:bg-white/20"}
                      disabled:opacity-50 disabled:translate-y-0`}>
                    {isBusy ? "מעבד..." : `קנייה ב-₪${p.priceIls}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Per-video pricing breakdown ── */}
        <div className="mt-12">
          <div className="text-center mb-5">
            <div className="inline-block text-[11px] uppercase tracking-widest text-cyan-300 font-bold mb-1.5">שקיפות תמחור</div>
            <h3 className="text-2xl font-black">כמה שווה סרטון?</h3>
            <p className="text-xs text-white/40 mt-1">מספר הקרדיט יורד מהיתרה רק בלחיצה על &quot;ייצוא&quot;</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { icon: Subtitles, name: "כתוביות בלבד",    cost: costSubtitles, desc: "תמלול + עיצוב",              color: "from-slate-500/20 to-slate-700/5",   ring: "ring-slate-400/30" },
              { icon: Wand2,     name: "אפקטים בסיסיים",  cost: costEffects,   desc: "+ צבע + זום עדין",            color: "from-cyan-500/20 to-blue-500/5",     ring: "ring-cyan-400/30" },
              { icon: Mic,       name: "פודקאסט",         cost: costPodcast,   desc: "+ חיתוך שתיקות + כתוביות גדולות", color: "from-emerald-500/20 to-teal-500/5", ring: "ring-emerald-400/30" },
              { icon: Sparkles,  name: "אפקטים מתקדמים",  cost: costAdvanced,  desc: "+ אנימציות + Lottie + SFX",     color: "from-fuchsia-500/25 to-purple-500/5","ring": "ring-fuchsia-400/30" },
              { icon: Layers,    name: "מולטי-וידאו",     cost: costMulti,     desc: "כמה סרטונים + תסריט → סרטון אחד", color: "from-amber-400/25 to-orange-500/5", ring: "ring-amber-400/30" },
            ].map((m) => (
              <div key={m.name}
                className={`bg-gradient-to-br ${m.color} border border-white/10 hover:border-white/20 rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5 group`}>
                <div className={`inline-flex p-2 rounded-xl bg-white/10 mb-2 ring-1 ${m.ring}`}>
                  <m.icon className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold mb-1">{m.name}</div>
                <div className="text-[10px] text-white/40 mb-3 h-7 leading-tight">{m.desc}</div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-black">{m.cost}</span>
                  <span className="text-[10px] text-white/40">קרדיט</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/30 text-center mt-3">
            המחירים נקבעים לפי המאמץ העיבודי · ניתן לעדכן דרך פאנל הניהול
          </p>
        </div>

        {/* ── Trust row ── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300"><Shield className="w-4 h-4" /></div>
            <div>
              <div className="text-xs font-bold">החזר 14 ימים</div>
              <div className="text-[10px] text-white/40">אם לא נוצל</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300"><RefreshCw className="w-4 h-4" /></div>
            <div>
              <div className="text-xs font-bold">ללא חידוש אוטומטי</div>
              <div className="text-[10px] text-white/40">קונה רק כשרוצה</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300"><Sparkles className="w-4 h-4" /></div>
            <div>
              <div className="text-xs font-bold">תקף לתמיד</div>
              <div className="text-[10px] text-white/40">קרדיט לא פג</div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-200 text-center">
            {msg}
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-white/40 hover:text-white">← חזרה לאפליקציה</a>
        </div>
      </div>
    </div>
  );
}
