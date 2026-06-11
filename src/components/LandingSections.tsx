"use client";

/**
 * Marketing landing sections below the upload hero. Every string in this
 * file pulls from CMS (`landing.*` keys) so admin can rewrite without
 * touching code. Visual personality + section order are fixed in code;
 * copy is content-managed.
 *
 * Gender-neutral Hebrew throughout — uses plural ("בואו", "מעלים")
 * or infinitive ("להתחיל"), no female-only conjugations.
 */

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import {
  Upload, Wand2, Download, Coins, Zap, Languages,
  Sparkles, Layers, Cloud, ArrowLeft, Star, Quote, Save,
  FileDown, Crown, Rocket, Film, Check,
} from "lucide-react";
import { useContent } from "@/lib/useContent";
import FeatureShowcase from "./FeatureShowcase";
import PremiumPkgCard, { SharedFeatures } from "./PremiumPkgCard";
import PackagesCarousel from "./PackagesCarousel";

export default function LandingSections({ onScrollToUpload }: { onScrollToUpload?: () => void }) {
  // ── Badge texts (5, ordered) ─────────────────────────────────
  const b1 = useContent("landing.badge.1");
  const b2 = useContent("landing.badge.2");
  const b3 = useContent("landing.badge.3");
  const b4 = useContent("landing.badge.4");
  const b5 = useContent("landing.badge.5");

  // ── How it works ─────────────────────────────────────────────
  const howEy = useContent("landing.how.eyebrow");
  const howT  = useContent("landing.how.title");
  const howS  = useContent("landing.how.subtitle");
  const s1T   = useContent("landing.step1.title");
  const s1B   = useContent("landing.step1.body");
  const s2T   = useContent("landing.step2.title");
  const s2B   = useContent("landing.step2.body");
  const s3T   = useContent("landing.step3.title");
  const s3B   = useContent("landing.step3.body");

  // ── Big claim ────────────────────────────────────────────────
  const clEy  = useContent("landing.claim.eyebrow");
  const clTp  = useContent("landing.claim.titlePre");
  const clTh  = useContent("landing.claim.titleHi");
  const clTs  = useContent("landing.claim.titleSuf");
  const clB   = useContent("landing.claim.body");
  const clCta = useContent("landing.claim.cta");

  // ── Features ─────────────────────────────────────────────────
  const fEy   = useContent("landing.features.eyebrow");
  const fT    = useContent("landing.features.title");
  const fS    = useContent("landing.features.subtitle");
  const f1T = useContent("landing.feat1.title"); const f1B = useContent("landing.feat1.body");
  const f2T = useContent("landing.feat2.title"); const f2B = useContent("landing.feat2.body");
  const f3T = useContent("landing.feat3.title"); const f3B = useContent("landing.feat3.body");
  const f4T = useContent("landing.feat4.title"); const f4B = useContent("landing.feat4.body");
  const f5T = useContent("landing.feat5.title"); const f5B = useContent("landing.feat5.body");
  const f6T = useContent("landing.feat6.title"); const f6B = useContent("landing.feat6.body");

  // ── Testimonials ─────────────────────────────────────────────
  const tEy = useContent("landing.test.eyebrow");
  const tT  = useContent("landing.test.title");
  const t1N = useContent("landing.test1.name"); const t1R = useContent("landing.test1.role"); const t1Q = useContent("landing.test1.quote");
  const t2N = useContent("landing.test2.name"); const t2R = useContent("landing.test2.role"); const t2Q = useContent("landing.test2.quote");
  const t3N = useContent("landing.test3.name"); const t3R = useContent("landing.test3.role"); const t3Q = useContent("landing.test3.quote");

  // ── Pricing teaser ───────────────────────────────────────────
  const pEy  = useContent("landing.pricing.eyebrow");
  const pT   = useContent("landing.pricing.title");
  const pS   = useContent("landing.pricing.subtitle");
  const pCta = useContent("landing.pricing.cta");
  const packages = useContent("pricing.packages");

  // ── Final CTA ────────────────────────────────────────────────
  const cT  = useContent("landing.cta.title");
  const cB  = useContent("landing.cta.body");
  const cBu = useContent("landing.cta.button");
  const cBl = useContent("landing.cta.bullets");

  return (
    <div dir="rtl" className="space-y-20 mt-12 mb-16">

      {/* ── 1. Trust badges (5 — exact order from CMS) ── */}
      <div className="flex flex-wrap justify-center gap-2.5 text-xs">
        <Badge icon={<Cloud className="w-3.5 h-3.5" />}        color="violet">{b1}</Badge>
        <Badge icon={<Coins className="w-3.5 h-3.5" />}        color="amber">{b2}</Badge>
        <Badge icon={<Languages className="w-3.5 h-3.5" />}    color="fuchsia">{b3}</Badge>
        <Badge icon={<Zap className="w-3.5 h-3.5" />}          color="cyan">{b4}</Badge>
        <Badge icon={<FileDown className="w-3.5 h-3.5" />}     color="emerald">{b5}</Badge>
      </div>

      {/* ── 2. How it works (3 steps — NO NUMBERS, just icons) ── */}
      <section>
        <SectionHeader eyebrow={howEy} title={howT} subtitle={howS} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          <Step icon={<Upload className="w-7 h-7" />}   title={s1T} body={s1B} color="violet" />
          <Step icon={<Wand2 className="w-7 h-7" />}    title={s2T} body={s2B} color="fuchsia" featured />
          <Step icon={<Download className="w-7 h-7" />} title={s3T} body={s3B} color="pink" />
        </div>
      </section>

      {/* ── 2.5. Feature showcase — phone mockups with floating UI bits ── */}
      <FeatureShowcase />

      {/* ── 3. Big claim ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-pink-500/20 border border-white/10 p-8 md:p-12 text-center">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-violet-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-pink-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-block text-[11px] uppercase tracking-widest text-violet-300 font-bold mb-3">{clEy}</div>
          <h2 className="text-3xl md:text-5xl font-black leading-tight max-w-3xl mx-auto">
            {clTp}{" "}
            <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">{clTh}</span>{" "}
            {clTs}
          </h2>
          <p className="text-base md:text-lg text-white/70 mt-5 max-w-2xl mx-auto leading-relaxed">{clB}</p>
          <button onClick={() => onScrollToUpload?.()}
            className="mt-8 bg-white text-bg font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90 inline-flex items-center gap-2">
            {clCta} <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── 4. Features grid (6) ── */}
      <section>
        <SectionHeader eyebrow={fEy} title={fT} subtitle={fS} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          <Feature icon={<Languages />} color="violet"   title={f1T} body={f1B} />
          <Feature icon={<Sparkles />}  color="fuchsia"  title={f2T} body={f2B} />
          <Feature icon={<Layers />}    color="pink"     title={f3T} body={f3B} />
          <Feature icon={<Wand2 />}     color="cyan"     title={f4T} body={f4B} />
          <Feature icon={<Coins />}     color="amber"    title={f5T} body={f5B} />
          <Feature icon={<Save />}      color="emerald"  title={f6T} body={f6B} />
        </div>
      </section>

      {/* ── 5. Testimonials ── */}
      <section>
        <SectionHeader eyebrow={tEy} title={tT} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          <Testimonial name={t1N} role={t1R} quote={t1Q} stars={5} />
          <Testimonial name={t2N} role={t2R} quote={t2Q} stars={5} />
          <Testimonial name={t3N} role={t3R} quote={t3Q} stars={5} />
        </div>
      </section>

      {/* ── 6. Pricing — same package data + much nicer cards ── */}
      <section>
        <SectionHeader eyebrow={pEy} title={pT} subtitle={pS} />
        {/* Mobile: hero-center carousel. Desktop: plain 4-up grid. */}
        <PackagesCarousel packages={packages} />
        <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 items-stretch">
          {packages.map((p) => <PkgCard key={p.id} pkg={p} />)}
        </div>
        <SharedFeatures />
        <div className="text-center mt-8">
          <Link href="/credits"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90">
            {pCta} <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── 7. Final CTA ── */}
      <section className="relative overflow-hidden rounded-3xl border border-brand/30 p-10 md:p-16 text-center bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-pink-600/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(168,85,247,0.4),transparent_50%),radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.4),transparent_50%)] pointer-events-none" />
        <div className="relative">
          <Sparkles className="w-10 h-10 mx-auto text-yellow-300 mb-3" />
          <h2 className="text-3xl md:text-5xl font-black mb-4">{cT}</h2>
          <p className="text-white/80 text-base md:text-lg max-w-xl mx-auto mb-8">{cB}</p>
          <button onClick={() => onScrollToUpload?.()}
            className="bg-white text-bg font-black px-8 py-4 rounded-2xl text-lg hover:scale-105 transition-transform inline-flex items-center gap-2 shadow-2xl">
            {cBu} <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs text-white/50 mt-4">{cBl}</div>
        </div>
      </section>
    </div>
  );
}

// ── Section building blocks ──────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="inline-block text-[11px] uppercase tracking-widest text-violet-300 font-bold mb-2">{eyebrow}</div>
      <h2 className="text-2xl md:text-4xl font-black leading-tight">{title}</h2>
      {subtitle && <p className="text-sm md:text-base text-white/60 mt-3 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

const COLOR_MAP = {
  violet:   { bg: "from-violet-500/20 to-violet-700/5",  icon: "bg-violet-500/25 text-violet-200",   ring: "ring-violet-400/30",  border: "border-violet-400/30" },
  fuchsia:  { bg: "from-fuchsia-500/25 to-pink-500/5",   icon: "bg-fuchsia-500/25 text-fuchsia-200", ring: "ring-fuchsia-400/30", border: "border-fuchsia-400/40" },
  pink:     { bg: "from-pink-500/20 to-rose-500/5",      icon: "bg-pink-500/25 text-pink-200",       ring: "ring-pink-400/30",    border: "border-pink-400/30" },
  cyan:     { bg: "from-cyan-500/20 to-blue-500/5",      icon: "bg-cyan-500/25 text-cyan-200",       ring: "ring-cyan-400/30",    border: "border-cyan-400/30" },
  amber:    { bg: "from-amber-400/20 to-orange-500/5",   icon: "bg-amber-400/25 text-amber-200",     ring: "ring-amber-400/30",   border: "border-amber-400/30" },
  emerald:  { bg: "from-emerald-500/20 to-teal-500/5",   icon: "bg-emerald-500/25 text-emerald-200", ring: "ring-emerald-400/30", border: "border-emerald-400/30" },
} as const;

function Step({ icon, title, body, color, featured }: {
  icon: React.ReactNode; title: string; body: string;
  color: keyof typeof COLOR_MAP; featured?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`relative rounded-2xl p-6 bg-gradient-to-br ${c.bg} border transition-all
      ${featured ? "border-white/25 shadow-xl lg:scale-[1.03] z-10" : "border-white/10 hover:border-white/20"}`}>
      <div className={`inline-flex p-3.5 rounded-2xl ${c.icon} mb-4 ring-2 ${c.ring}`}>{icon}</div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{body}</p>
    </div>
  );
}

function Feature({ icon, title, body, color }: {
  icon: React.ReactNode; title: string; body: string;
  color: keyof typeof COLOR_MAP;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-2xl p-5 bg-gradient-to-br ${c.bg} border border-white/10 hover:border-white/25 transition-all hover:-translate-y-1`}>
      <div className={`inline-flex p-2.5 rounded-xl ${c.icon} mb-3`}>{icon}</div>
      <h3 className="text-base font-bold mb-1.5">{title}</h3>
      <p className="text-[13px] text-white/60 leading-relaxed">{body}</p>
    </div>
  );
}

function Badge({ icon, color, children }: {
  icon: React.ReactNode; color: keyof typeof COLOR_MAP; children: React.ReactNode;
}) {
  const c = COLOR_MAP[color];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${c.border} ${c.icon} font-medium whitespace-nowrap`}>
      {icon}
      {children}
    </span>
  );
}

function Testimonial({ name, role, quote, stars }: { name: string; role: string; quote: string; stars: number }) {
  return (
    <div className="bg-bg-card border border-white/10 rounded-2xl p-5 hover:border-white/25 transition-colors relative">
      <Quote className="w-6 h-6 text-violet-400/40 absolute top-3 left-3" />
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-sm text-white/85 leading-relaxed mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center font-black text-sm">
          {name.charAt(0)}
        </div>
        <div>
          <div className="font-bold text-sm">{name}</div>
          <div className="text-[11px] text-white/40">{role}</div>
        </div>
      </div>
    </div>
  );
}

// ── PkgCard — wraps the shared PremiumPkgCard component used on /credits too.
function PkgCard({ pkg }: { pkg: { id: string; credits: number; priceIls: number; label: string; highlight: string } }) {
  return <PremiumPkgCard pkg={pkg} />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LandingPkg = { id: string; credits: number; priceIls: number; label: string; highlight: string };

// Local fallback kept here in case we ever want to inline tweaks per-page.
// Currently we use the shared <PackagesCarousel/> imported above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PackagesCarouselLegacy({ packages }: { packages: readonly LandingPkg[] }) {
  const popularRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Whichever card is closest to the strip's center gets the hero treatment
  // (full size + opacity). Updates live while scrolling/dragging.
  const popularIdx = Math.max(0, packages.findIndex((p) => p.highlight === "הכי נמכר"));
  const [activeIdx, setActiveIdx] = useState(popularIdx);
  // Mouse drag-to-scroll — touch swipes natively, but a narrow DESKTOP window
  // has no horizontal gesture, which made the strip feel "stuck".
  const drag = useRef<{ startX: number; startScroll: number; active: boolean }>({ startX: 0, startScroll: 0, active: false });

  function updateActive() {
    const el = stripRef.current;
    if (!el) return;
    const stripCenter = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - stripCenter);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActiveIdx(best);
  }

  useEffect(() => {
    // Center the popular card on mount. scrollIntoView handles RTL scroll
    // coordinates correctly (manual scrollLeft math breaks in RTL and left
    // the strip stuck at one edge).
    popularRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={stripRef}
      onScroll={updateActive}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") return; // touch scrolls natively
        const el = stripRef.current; if (!el) return;
        drag.current = { startX: e.clientX, startScroll: el.scrollLeft, active: true };
        el.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const el = stripRef.current;
        if (!el || !drag.current.active) return;
        el.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX);
      }}
      onPointerUp={() => { drag.current.active = false; }}
      onPointerCancel={() => { drag.current.active = false; }}
      className="md:hidden flex items-center gap-3 mt-10 overflow-x-auto snap-x snap-proximity pb-4 pt-6 scrollbar-hide touch-pan-x overscroll-x-contain cursor-grab active:cursor-grabbing select-none"
    >
      {/* edge spacers so the first/last card can reach the center */}
      <div className="shrink-0 w-[10vw]" aria-hidden />
      {packages.map((p, i) => {
        const isActive = i === activeIdx;
        const isPopular = p.highlight === "הכי נמכר";
        return (
          <div
            key={p.id}
            ref={(el) => {
              cardRefs.current[i] = el;
              if (isPopular && el) (popularRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            }}
            className={`snap-center shrink-0 w-[68%] transition-all duration-300
              ${isActive ? "opacity-100 scale-100 z-10" : "opacity-50 scale-90"}`}
          >
            <PkgCard pkg={p} />
          </div>
        );
      })}
      <div className="shrink-0 w-[10vw]" aria-hidden />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyPremiumPkgCard({ pkg }: { pkg: { id: string; credits: number; priceIls: number; label: string; highlight: string } }) {
  // Fake "regular price" — 60% above the real price, to anchor value
  const fakeRegularPrice = Math.round(pkg.priceIls * 1.6);
  const videosBasic = Math.floor(pkg.credits / 20);
  const videosAdv   = Math.floor(pkg.credits / 40);
  const isPopular   = pkg.highlight === "הכי נמכר";
  const isBestValue = pkg.highlight === "הכי משתלם";
  const featured    = isPopular || isBestValue;

  // Build the bullet list dynamically — skip "0 advanced videos" etc.
  const bullets = [
    "כתוביות אוטומטיות בכמה שניות",
    "אנימציות ויראליות — Pop, Slide, Type ועוד",
    videosBasic > 0 && `עד ${videosBasic} סרטונים עם אפקטים`,
    videosAdv  >= 1 && `עד ${videosAdv} סרטונים מתקדמים`,
    "גישה לכל הסגנונות והעדכונים",
  ].filter(Boolean) as string[];

  return (
    <div className={`relative transition-all ${featured ? "lg:scale-[1.03] z-10" : "hover:-translate-y-1"}`}>
      {/* Launch deal banner — top of card. All-brand gradient (purple/pink),
          no yellow. Different tones for the two featured tiers. */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
        <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide shadow-lg
          ${isBestValue
            ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-fuchsia-500/50"
            : isPopular
              ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-violet-500/50"
              : "bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 text-white shadow-violet-500/30"}`}>
          ⚡ {pkg.highlight || "מבצע השקה"}
        </div>
      </div>

      {/* Inner card */}
      <div className={`relative bg-bg-card rounded-2xl border overflow-hidden p-6 md:p-7
        ${featured ? "border-brand/40 shadow-2xl shadow-brand/15" : "border-white/10 hover:border-white/25"}`}>

        {/* Price block — TOP focus, big bold number, strikethrough left */}
        <div className="flex items-baseline justify-center gap-3 mb-1 mt-1">
          <div className="text-[15px] text-red-400/70 line-through font-bold">₪{fakeRegularPrice}</div>
          <div className="flex items-baseline">
            <span className="text-5xl font-black text-white leading-none">{pkg.priceIls}</span>
            <span className="text-2xl text-white/60 font-bold mr-0.5">₪</span>
          </div>
        </div>

        {/* Sub-pricing line — green */}
        <div className="text-center text-[11px] text-emerald-300 font-medium mb-5">
          תשלום חד-פעמי <span className="text-white/30 mx-1">|</span> הקרדיט לא פג
        </div>

        {/* Credit count chip */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          <div className="bg-gradient-to-r from-violet-500/15 to-pink-500/15 border border-white/10 rounded-full px-3 py-1.5">
            <span className="text-base font-black text-white">{pkg.credits}</span>
            <span className="text-[10px] text-white/50 mr-1">קרדיט</span>
          </div>
          <div className="text-xs text-white/40">·</div>
          <div className="text-xs text-white/60 font-medium">{pkg.label}</div>
        </div>

        {/* Feature bullets — only the relevant ones */}
        <ul className="space-y-2.5 text-sm text-white/80 mb-6">
          {bullets.map((b, i) => <Bullet key={i}>{b}</Bullet>)}
        </ul>

        {/* CTA button — brand gradient (purple→pink) instead of yellow */}
        <Link href="/credits"
          className="block w-full py-3.5 rounded-xl text-center font-black text-base text-white
                     bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-400 hover:to-pink-400
                     shadow-lg shadow-brand/30 transition-all hover:shadow-xl hover:scale-[1.02]">
          קנה עכשיו ✦
        </Link>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

// ── PkgCardClassic — original design kept as backup (not currently used) ──
const PKG_THEME: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string; ring: string; iconBg: string; accent: string; glow: string;
}> = {
  mini:     { icon: Zap,    bg: "from-slate-800/80 via-sky-950/60 to-slate-900/80",        ring: "ring-sky-400/20",     iconBg: "bg-sky-500/30 text-sky-100",      accent: "text-sky-300",     glow: "shadow-sky-500/10"  },
  starter:  { icon: Film,   bg: "from-violet-950/80 via-violet-900/60 to-purple-950/80",   ring: "ring-violet-400/30",  iconBg: "bg-violet-500/30 text-violet-100", accent: "text-violet-300",  glow: "shadow-violet-500/30" },
  pro:      { icon: Rocket, bg: "from-fuchsia-950/80 via-pink-900/60 to-purple-950/80",    ring: "ring-fuchsia-400/30", iconBg: "bg-fuchsia-500/30 text-fuchsia-100", accent: "text-fuchsia-300", glow: "shadow-fuchsia-500/20" },
  business: { icon: Crown,  bg: "from-amber-950/80 via-orange-900/60 to-amber-950/80",    ring: "ring-amber-400/40",   iconBg: "bg-amber-400/30 text-amber-100",   accent: "text-amber-300",   glow: "shadow-amber-500/40" },
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PkgCardClassic({ pkg }: { pkg: { id: string; credits: number; priceIls: number; label: string; highlight: string } }) {
  const t = PKG_THEME[pkg.id] ?? PKG_THEME.starter;
  const Icon = t.icon;
  const isPopular   = pkg.highlight === "הכי נמכר";
  const isBestValue = pkg.highlight === "הכי משתלם";
  const elevated    = isPopular || isBestValue;
  // Rough capacity hints — number of "basic effects" videos (20cr each)
  const videosBasic = Math.floor(pkg.credits / 20);
  const videosAdv   = Math.floor(pkg.credits / 40);

  return (
    // Outer wrapper — NO overflow-hidden, so the badge can sit above the card edge
    <div className={`group relative rounded-2xl transition-all ${elevated ? "lg:scale-105 z-10" : "hover:-translate-y-1.5"}`}>
      {/* Badge — floats above the card, never clipped */}
      {pkg.highlight && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shadow-lg z-20
          ${isBestValue ? "bg-amber-400 text-amber-900 shadow-amber-500/40" : isPopular ? "bg-violet-500 text-white shadow-violet-500/40" : "bg-white/20 text-white"}`}>
          {isBestValue ? "👑 " : isPopular ? "🔥 " : ""}{pkg.highlight}
        </div>
      )}

      {/* Inner card — keeps overflow-hidden so the hover glow stays contained */}
      <div className={`relative rounded-2xl text-center bg-gradient-to-br ${t.bg} border overflow-hidden transition-all
        ${elevated
          ? `border-white/30 shadow-2xl ${t.glow} ring-1 ${t.ring}`
          : "border-white/10 hover:border-white/25 hover:shadow-xl"}`}>

        {/* Animated hover glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className={`absolute -top-1/2 -right-1/2 w-full h-full rounded-full ${t.iconBg.replace("text-", "").replace("bg-", "bg-")} blur-3xl opacity-30`} />
        </div>

        <div className="relative p-6">
        {/* Icon */}
        <div className={`inline-flex p-3 rounded-2xl ${t.iconBg} mb-3 ring-2 ${t.ring}`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Plan label */}
        <div className="text-xs font-bold text-white/70 mb-4 uppercase tracking-widest">{pkg.label}</div>

        {/* Credits — the hero */}
        <div className="mb-5">
          <div className={`text-5xl font-black leading-none ${t.accent}`}>{pkg.credits}</div>
          <div className="text-[10px] text-white/50 mt-1.5 uppercase tracking-wider">קרדיטים</div>
        </div>

        {/* Mini value indicators */}
        <div className="space-y-1 mb-5 text-[11px] text-white/60">
          <div className="flex items-center justify-center gap-1.5">
            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            עד {videosBasic} סרטונים עם אפקטים
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            עד {videosAdv} סרטונים מתקדמים
          </div>
        </div>

        {/* Price — bold and clear */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-black">{pkg.priceIls}</span>
            <span className="text-lg text-white/40">₪</span>
          </div>
          <div className="text-[10px] text-white/40 mt-1.5 uppercase tracking-wider">חיוב חד-פעמי</div>
        </div>

        {/* CTA button — always visible, especially on mobile.
            On desktop it's the secondary action below the price;
            on mobile it's the primary tap target. */}
        <Link href="/credits"
          className={`mt-4 w-full block py-2.5 rounded-xl font-bold text-sm transition-all
            ${elevated
              ? "bg-white text-bg shadow-lg hover:shadow-xl"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/10"}`}>
          קנה עכשיו ←
        </Link>
      </div>
      </div>
    </div>
  );
}
