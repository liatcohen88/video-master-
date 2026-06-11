"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, AlertTriangle, Shield, RefreshCw,
  Subtitles, Wand2, Mic, Layers, ArrowRight,
} from "lucide-react";
import { getCredits, addCredits } from "@/lib/credits";
import { getProfile } from "@/lib/userStore";
import { useContent } from "@/lib/useContent";
import PremiumPkgCard, { SharedFeatures } from "@/components/PremiumPkgCard";
import PackagesCarousel from "@/components/PackagesCarousel";
import MasterCoin from "@/components/MasterCoin";
import LogoMark from "@/components/LogoMark";
import SiteHeader from "@/components/SiteHeader";

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
  const currency      = (useContent("brand.currencyName") as string) || "קרדיטים";
  const appName       = useContent("brand.appName") as string;
  const tagline       = useContent("brand.tagline") as string;
  const logoSize      = Number(useContent("brand.headerLogoSize") ?? 56);
  // Hoisted CMS strings — must run unconditionally on every render. They
  // used to be inlined inside the JSX below, but combined with the early
  // `if (!hydrated) return ...` they fired in different orders pre/post
  // hydration → React Hooks-order error.
  const balanceLabel  = useContent("credits.balanceLabel");
  const calcCalcLabel = useContent("credits.calcCalcLabel");
  const eyebrow       = useContent("credits.eyebrow");
  const title         = useContent("credits.title");
  const subtitle      = useContent("credits.subtitle");
  const calcEyebrow   = useContent("credits.calcEyebrow");
  const calcTitle     = useContent("credits.calcTitle");
  const calcSubtitle  = useContent("credits.calcSubtitle");

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
        setMsg(`✓ נוספו ${j.creditsToAdd} ${currency} לחשבון שלך!`);
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

  if (!hydrated) return <div className="min-h-screen" />;

  return (
    <div dir="rtl" className="min-h-screen text-white">
      {/* Soft animated brand glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-violet-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-60 -left-40 w-[420px] h-[420px] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {/* Shared SiteHeader for cross-page consistency */}
        <div className="mb-8"><SiteHeader /></div>

        {/* ── Balance + calculator in one strip — fully centered, mobile-friendly ── */}
        <div className="bg-gradient-to-br from-violet-500/20 via-bg-card to-cyan-500/10 border border-white/10 rounded-2xl p-5 mb-8 flex flex-col md:flex-row md:items-center md:justify-center gap-5 text-center">
          {/* Mobile: coins stacked on top. Desktop: coins on the RIGHT, balance to its left. */}
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 md:border-l md:border-white/10 md:pl-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/master-coins.png" alt="מאסטרים" className="h-12 sm:h-14 w-auto object-contain drop-shadow-[0_3px_12px_rgba(251,191,36,0.45)] select-none pointer-events-none shrink-0" draggable={false} />
            <div className="md:text-right">
              <div className="text-[11px] text-white/50 uppercase tracking-wider">{balanceLabel}</div>
              <div className="text-4xl font-black leading-none mt-0.5">
                {credits.toLocaleString()} <span className="text-sm text-white/40 font-normal">{currency}</span>
              </div>
            </div>
          </div>
          <div className="md:text-right">
            <div className="text-[11px] text-white/50 mb-1.5">{calcCalcLabel}</div>
            <div className="flex flex-wrap justify-center md:justify-start gap-x-5 gap-y-1 text-sm">
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
          <div className="inline-block text-[11px] uppercase tracking-widest text-violet-300 font-bold mb-2">{eyebrow}</div>
          <h2 className="text-3xl font-black mb-2">{title}</h2>
          <p className="text-sm text-white/50">{subtitle}</p>
        </div>

        {/* Mobile: hero-center carousel. Desktop: 4-up grid. */}
        <PackagesCarousel packages={packages} onBuy={buy} busyId={busy} />
        <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-5 mt-8 items-stretch">
          {packages.map((p) => (
            <PremiumPkgCard key={p.id} pkg={p} onBuy={buy} busy={busy === p.id} />
          ))}
        </div>
        <SharedFeatures />

        {/* ── Per-video pricing breakdown ── */}
        <div className="mt-12">
          <div className="text-center mb-5">
            <div className="inline-block text-[11px] uppercase tracking-widest text-cyan-300 font-bold mb-1.5">{calcEyebrow}</div>
            <h3 className="text-2xl font-black">{calcTitle}</h3>
            <p className="text-xs text-white/40 mt-1">{calcSubtitle}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Subtitles, name: "כתוביות בלבד",    cost: costSubtitles, desc: "תמלול + אנימציות + תבניות",        iconColor: "text-violet-200", iconBg: "bg-violet-500/30",  grad: "from-violet-500/20 to-violet-700/5",   border: "border-violet-400/30",  num: "text-violet-200" },
              { icon: Mic,       name: "פודקאסט",         cost: costPodcast,   desc: "+ חיתוך שתיקות + אמוג'ים",          iconColor: "text-emerald-200",iconBg: "bg-emerald-500/30", grad: "from-emerald-500/20 to-teal-700/5",    border: "border-emerald-400/30", num: "text-emerald-200" },
              { icon: Sparkles,  name: "אפקטים מתקדמים",  cost: costAdvanced,  desc: "הכל — אנימציות + Lottie + SFX",     iconColor: "text-fuchsia-200",iconBg: "bg-fuchsia-500/30", grad: "from-fuchsia-500/25 to-pink-700/5",    border: "border-fuchsia-400/30", num: "text-fuchsia-200" },
              { icon: Layers,    name: "חיבור סרטונים",   cost: costMulti,     desc: "כמה סרטונים + תסריט → סרטון אחד",   iconColor: "text-amber-200",  iconBg: "bg-amber-500/30",   grad: "from-amber-400/20 to-orange-700/5",    border: "border-amber-400/30",   num: "text-amber-200" },
            ].map((m) => (
              <div key={m.name}
                className={`bg-gradient-to-br ${m.grad} border ${m.border} hover:brightness-110 rounded-2xl p-5 text-center transition-all hover:-translate-y-1 hover:shadow-xl group h-full flex flex-col`}>
                <div className={`inline-flex p-2.5 rounded-xl ${m.iconBg} ${m.iconColor} mx-auto mb-3`}>
                  <m.icon className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold mb-1">{m.name}</div>
                <div className="text-[10px] text-white/50 mb-4 leading-tight flex-1">{m.desc}</div>
                {/* Hero credit number — matches package-card hierarchy: big credits */}
                <div className="flex items-baseline justify-center gap-1.5 pt-3 border-t border-white/10">
                  <span className={`text-4xl font-black tracking-tight ${m.num}`}>{m.cost}</span>
                  <span className="text-[11px] text-white/50 font-bold">{currency}</span>
                </div>
              </div>
            ))}
          </div>
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
              <div className="text-[10px] text-white/40">לא פג לעולם</div>
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
