"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, AlertTriangle, Shield, RefreshCw,
  Subtitles, Wand2, Mic, Layers, ArrowRight,
} from "lucide-react";
import { getCredits, ADVANCED_EFFECTS_CAP } from "@/lib/credits";
import { getProfile } from "@/lib/userStore";
import { useAuth } from "@/lib/useAuth";
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
  // Per-mode card text (every line on /credits goes through CMS so Liat can
  // tweak naming/copy without touching code)
  const modeSubName   = useContent("credits.modes.subtitles_only.name") as string;
  const modeSubDesc   = useContent("credits.modes.subtitles_only.desc") as string;
  const modePodName   = useContent("credits.modes.podcast.name") as string;
  const modePodDesc   = useContent("credits.modes.podcast.desc") as string;
  const modeAdvName   = useContent("credits.modes.advanced.name") as string;
  const modeAdvDesc   = useContent("credits.modes.advanced.desc") as string;
  const modeMulName   = useContent("credits.modes.multi.name") as string;
  const modeMulDesc   = useContent("credits.modes.multi.desc") as string;
  const calcSubsLbl   = useContent("credits.calc.subtitles") as string;
  const calcEffLbl    = useContent("credits.calc.effects") as string;
  const calcAdvLbl    = useContent("credits.calc.advanced") as string;
  const trustRefTitle = useContent("credits.trust.refund.title") as string;
  const trustRefBody  = useContent("credits.trust.refund.body") as string;
  const trustNrTitle  = useContent("credits.trust.norenew.title") as string;
  const trustNrBody   = useContent("credits.trust.norenew.body") as string;
  const trustFvTitle  = useContent("credits.trust.forever.title") as string;
  const trustFvBody   = useContent("credits.trust.forever.body") as string;
  const backToApp     = useContent("credits.backToApp") as string;
  const multiEnabled  = useContent("feature.multi.enabled") as boolean;

  // Liat 2026-06-16: "היתרה בחבילות לא תואמת לבאמת כמה מאסטרים יש".
  // Root cause: this page was reading from localStorage only, which can
  // drift from the Supabase truth (e.g., dashboard reads from profile,
  // /credits read from localStorage). The auth profile is the source of
  // truth when authenticated; fall back to localStorage only for guests.
  const auth = useAuth();
  useEffect(() => {
    setCreditsLocal(getCredits());
    setHydrated(true);
    const refresh = () => setCreditsLocal(getCredits());
    window.addEventListener("credits-change", refresh);
    return () => window.removeEventListener("credits-change", refresh);
  }, []);

  // Send the buyer to our pre-checkout page /buy/[pkg]. That page collects
  // the user's identity (so the webhook can credit the right account when
  // Grow returns), renders the branded checkout UI, and only then
  // redirects to Grow's hosted payment page.
  function buy(id: string) {
    setBusy(id);
    window.location.href = `/buy/${id}`;
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
                {/* Prefer the live Supabase profile credits when authenticated;
                    fall back to the localStorage-backed credits for guests. */}
                {(auth.status === "user" && auth.profile
                  ? auth.profile.credits
                  : credits
                ).toLocaleString()} <span className="text-sm text-white/40 font-normal">{currency}</span>
              </div>
            </div>
          </div>
          <div className="md:text-right">
            <div className="text-[11px] text-white/50 mb-1.5">{calcCalcLabel}</div>
            <div className="flex flex-wrap justify-center md:justify-start gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5"><span className="text-violet-300 font-bold">{calc.subtitles}</span><span className="text-white/60">{calcSubsLbl}</span></span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1.5"><span className="text-fuchsia-300 font-bold">{calc.effects}</span><span className="text-white/60">{calcEffLbl}</span></span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1.5"><span className="text-amber-300 font-bold">{calc.advanced}</span><span className="text-white/60">{calcAdvLbl}</span></span>
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
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${multiEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {[
              { icon: Subtitles, name: modeSubName, cost: costSubtitles, costMax: undefined as number | undefined, desc: modeSubDesc, iconColor: "text-violet-200", iconBg: "bg-violet-500/30",  grad: "from-violet-500/20 to-violet-700/5",   border: "border-violet-400/30",  num: "text-violet-200" },
              { icon: Mic,       name: modePodName, cost: costPodcast,   costMax: undefined as number | undefined, desc: modePodDesc, iconColor: "text-emerald-200",iconBg: "bg-emerald-500/30", grad: "from-emerald-500/20 to-teal-700/5",    border: "border-emerald-400/30", num: "text-emerald-200" },
              { icon: Sparkles,  name: modeAdvName, cost: costAdvanced,  costMax: ADVANCED_EFFECTS_CAP as number | undefined, desc: modeAdvDesc, iconColor: "text-fuchsia-200",iconBg: "bg-fuchsia-500/30", grad: "from-fuchsia-500/25 to-pink-700/5",    border: "border-fuchsia-400/30", num: "text-fuchsia-200" },
              ...(multiEnabled ? [{ icon: Layers, name: modeMulName, cost: costMulti, costMax: undefined as number | undefined, desc: modeMulDesc, iconColor: "text-amber-200", iconBg: "bg-amber-500/30", grad: "from-amber-400/20 to-orange-700/5", border: "border-amber-400/30", num: "text-amber-200" }] : []),
            ].map((m) => (
              <div key={m.name}
                className={`group relative overflow-hidden rounded-2xl border ${m.border} bg-bg-card p-6 text-center transition-all hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/40 h-full flex flex-col items-center`}>
                {/* Soft accent glow — premium look matching the package cards */}
                <div className={`pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full bg-gradient-to-br ${m.grad} blur-3xl opacity-70 group-hover:opacity-100 transition-opacity`} />
                <div className={`relative inline-flex p-3.5 rounded-2xl ${m.iconBg} ${m.iconColor} mb-4 ring-1 ring-white/10 shadow-lg`}>
                  <m.icon className="w-6 h-6" />
                </div>
                <div className="relative text-base font-black mb-1.5">{m.name}</div>
                <div className="relative text-[11px] text-white/45 leading-snug mb-5 flex-1">{m.desc}</div>
                {/* Hero credit number — matches package-card hierarchy: big credits */}
                <div className="relative w-full pt-4 border-t border-white/10">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className={`text-4xl font-black tracking-tight ${m.num}`}>
                      {m.costMax ? `${m.cost}-${m.costMax}` : m.cost}
                    </span>
                    <span className="text-[11px] text-white/50 font-bold">{currency}</span>
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">{m.costMax ? "לפי אפקטים" : "לסרטון"}</div>
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
              <div className="text-xs font-bold">{trustRefTitle}</div>
              <div className="text-[10px] text-white/40">{trustRefBody}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300"><RefreshCw className="w-4 h-4" /></div>
            <div>
              <div className="text-xs font-bold">{trustNrTitle}</div>
              <div className="text-[10px] text-white/40">{trustNrBody}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300"><Sparkles className="w-4 h-4" /></div>
            <div>
              <div className="text-xs font-bold">{trustFvTitle}</div>
              <div className="text-[10px] text-white/40">{trustFvBody}</div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-200 text-center">
            {msg}
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-white/40 hover:text-white">← {backToApp}</a>
        </div>
      </div>
    </div>
  );
}
