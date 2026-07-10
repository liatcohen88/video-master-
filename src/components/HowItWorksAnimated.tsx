"use client";

/**
 * Animated "How it works — 3 steps" for the landing page + first-run
 * onboarding banner. Instead of 3 static cards, a looping mini-reel actually
 * DEMONSTRATES the flow inside a phone-style frame:
 *   0) העלאה   — a clip drops into the upload zone, progress bar fills
 *   1) ה-AI עורך — captions type in, an emoji + ⚡ badge pop, a scan-line sweeps
 *   2) ייצוא ושיתוף — a ✓ lands, then download + share pills fan in
 * The 3 step chips light up in sync with a filling progress connector.
 *
 * Copy still comes from CMS (passed in from LandingSections) so admin can
 * rewrite. All motion is dependency-free CSS keyframes, retriggered by keying
 * the frame content on the active step. Honors prefers-reduced-motion (freezes
 * on the richest stage, no looping).
 *
 * Two shapes:
 *   <HowItWorksAnimated .../>          — full, for the landing section
 *   <HowItWorksAnimated compact .../>  — chips-only strip, for the onboarding
 */

import { useEffect, useRef, useState } from "react";
import { Upload, Wand2, Download, Check, Share2, Sparkles, SlidersHorizontal } from "lucide-react";
import LogoMark from "./LogoMark";

type StepCopy = { title: string; body: string };

const ACCENTS = [
  { dot: "bg-violet-400",  text: "text-violet-200",  ring: "ring-violet-400/40",  glow: "shadow-violet-500/40",  from: "from-violet-500",  to: "to-violet-700" },
  { dot: "bg-fuchsia-400", text: "text-fuchsia-200", ring: "ring-fuchsia-400/40", glow: "shadow-fuchsia-500/40", from: "from-fuchsia-500", to: "to-pink-600" },
  { dot: "bg-cyan-400",    text: "text-cyan-200",    ring: "ring-cyan-400/40",    glow: "shadow-cyan-500/40",    from: "from-cyan-500",    to: "to-blue-600" },
  { dot: "bg-pink-400",    text: "text-pink-200",    ring: "ring-pink-400/40",    glow: "shadow-pink-500/40",    from: "from-pink-500",    to: "to-rose-600" },
] as const;

// 4 steps: upload → AI transcribes/edits → you fine-tune → export & share
const STEP_ICONS = [Upload, Wand2, SlidersHorizontal, Download] as const;
const STEP_MS = 3000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Auto-advancing 0→…→count-1→0 index, pausable. Freezes at 1 when reduced-motion. */
function useCycle(paused: boolean, reduced: boolean, count: number) {
  const [active, setActive] = useState(reduced ? 1 : 0);
  const ref = useRef(active);
  ref.current = active;
  useEffect(() => {
    if (reduced || paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % count), STEP_MS);
    return () => clearInterval(id);
  }, [paused, reduced, count]);
  return [active, setActive] as const;
}

export default function HowItWorksAnimated({
  steps,
  compact = false,
}: {
  steps: StepCopy[];
  compact?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useCycle(paused, reduced, steps.length);

  return (
    <div
      dir="rtl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{KEYFRAMES}</style>

      {compact ? (
        <StepChips steps={steps} active={active} onPick={setActive} compact />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center">
          {/* Live demo frame */}
          <div className="order-1 md:order-2 flex justify-center">
            <DemoFrame active={active} reduced={reduced} />
          </div>
          {/* Steps + progress */}
          <div className="order-2 md:order-1">
            <StepChips steps={steps} active={active} onPick={setActive} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── The step rows / chips with a filling progress connector ── */
function StepChips({
  steps, active, onPick, compact = false,
}: {
  steps: StepCopy[];
  active: number;
  onPick: (i: number) => void;
  compact?: boolean;
}) {
  // progress 0..1 across the steps for the connector fill
  const progress = (active + 1) / steps.length;
  return (
    <div className={compact ? "flex items-stretch gap-2 sm:gap-3" : "relative flex flex-col gap-3"}>
      {/* connector rail */}
      {!compact && (
        <div className="absolute right-[19px] top-6 bottom-6 w-[2px] bg-white/10 rounded-full overflow-hidden">
          <div
            className="w-full bg-gradient-to-b from-violet-400 via-fuchsia-400 to-pink-400 rounded-full transition-[height] duration-700 ease-out"
            style={{ height: `${progress * 100}%` }}
          />
        </div>
      )}
      {steps.map((s, i) => {
        const a = ACCENTS[i];
        const Icon = STEP_ICONS[i];
        const on = i === active;
        const done = i < active;
        if (compact) {
          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              className={`group flex-1 min-w-0 flex items-center gap-2 rounded-xl px-2.5 py-2 border text-right transition-all duration-300
                ${on ? `bg-gradient-to-br ${a.from}/20 ${a.to}/5 border-white/25 shadow-lg ${a.glow}` : "bg-white/[0.03] border-white/10 hover:border-white/20"}`}
            >
              <span className={`shrink-0 grid place-items-center w-6 h-6 rounded-full text-white text-[11px] font-black transition-transform duration-300
                ${on ? `bg-gradient-to-br ${a.from} ${a.to} scale-110` : "bg-white/15"}`}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`truncate text-[12.5px] font-bold ${on ? "text-white" : "text-white/70"}`}>{s.title}</span>
            </button>
          );
        }
        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`relative z-10 flex items-start gap-3.5 rounded-2xl p-3.5 pr-2.5 border text-right transition-all duration-300
              ${on ? `bg-gradient-to-br ${a.from}/15 ${a.to}/5 border-white/25 shadow-xl ${a.glow}` : "bg-white/[0.02] border-white/10 hover:border-white/20"}`}
          >
            <span className={`relative shrink-0 grid place-items-center w-10 h-10 rounded-xl ring-2 transition-all duration-300
              ${on ? `bg-gradient-to-br ${a.from} ${a.to} text-white ${a.ring} scale-105` : `bg-white/5 ${a.text} ring-white/10`}`}>
              {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
              {on && <span className={`absolute inset-0 rounded-xl ${a.dot} opacity-40 animate-ping`} style={{ animationDuration: "1.6s" }} />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className={`text-[15px] font-black ${on ? "text-white" : "text-white/80"}`}>{s.title}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${a.dot} text-black/70`}>{i + 1}</span>
              </span>
              <span className={`block text-[12.5px] leading-relaxed mt-0.5 transition-colors ${on ? "text-white/75" : "text-white/45"}`}>{s.body}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── The phone-style frame that demonstrates each stage ── */
function DemoFrame({ active, reduced }: { active: number; reduced: boolean }) {
  return (
    <div className="relative w-[230px] sm:w-[250px] aspect-[9/16] rounded-[26px] p-2 bg-gradient-to-b from-white/15 to-white/5 border border-white/15 shadow-2xl shadow-black/50">
      {/* notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/20 z-20" />
      <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-[#0d0b1a]">
        {/* key on active → enter animations replay each stage */}
        <div key={active} className="absolute inset-0">
          {active === 0 && <StageUpload reduced={reduced} />}
          {active === 1 && <StageEdit reduced={reduced} />}
          {active === 2 && <StageCustomize reduced={reduced} />}
          {active === 3 && <StageExport reduced={reduced} />}
        </div>
      </div>
    </div>
  );
}

function StageUpload({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <div className="w-full">
        <div
          className="mx-auto w-full rounded-2xl border-2 border-dashed border-violet-400/50 bg-violet-500/5 grid place-items-center py-8"
          style={reduced ? undefined : { animation: "hiw-pop .5s ease both" }}
        >
          <Upload
            className="w-9 h-9 text-violet-300"
            style={reduced ? undefined : { animation: "hiw-bob 1.6s ease-in-out infinite" }}
          />
          <span className="text-[11px] text-white/60 mt-2 font-bold">גוררים סרטון לכאן</span>
        </div>
        {/* a clip card slides up into place */}
        <div
          className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 p-2"
          style={reduced ? undefined : { animation: "hiw-rise .6s .25s ease both" }}
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 grid place-items-center text-white text-sm">🎬</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-white/70 font-bold truncate">clip-01.mp4</div>
            <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full"
                style={reduced ? { width: "100%" } : { animation: "hiw-fill 1.5s .4s ease-out both" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stage 1 mirrors the REAL Master Video processing screen the user sees while
 * the AI transcribes + edits (AILoadingOverlay): spinning brand logo in a glow,
 * "מתמלל ועורך את הסרטון…" with bouncing dots, and a shimmer progress bar.
 * Liat: "ב-AI עורך נעשה את עמוד הטעינה של מאסטר וידאו שהוא עורך ומתמלל".
 */
function StageEdit({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#1a1330] to-[#120c22] px-4">
      <div className="flex flex-col items-center text-center gap-4">
        {/* brand logo in a pulsing glow — same as the live loader */}
        <div className="relative">
          <div
            className="absolute inset-0 -m-5 rounded-full bg-gradient-to-br from-brand/40 to-pink-500/25 blur-2xl"
            style={reduced ? undefined : { animation: "hiw-glow 2s ease-in-out infinite" }}
          />
          {/* "breathing" = calm continuous pulse (the logo "working"), NOT the
              full spin which read as comical (Liat). Lighter than "reveal" too,
              which matters for a demo that loops forever on the landing page. */}
          <LogoMark size={76} mode={reduced ? "static" : "breathing"} />
        </div>

        <div>
          <div className="text-[15px] font-black text-white leading-snug">
            מתמלל ועורך
            <span className="inline-block whitespace-nowrap mr-1 align-baseline">
              <span className="hiw-dot">.</span>
              <span className="hiw-dot">.</span>
              <span className="hiw-dot">.</span>
            </span>
          </div>
          <div className="text-[10px] text-white/55 mt-1 font-bold">כתוביות · אפקטים · סאונד — אוטומטית</div>
        </div>

        {/* indeterminate shimmer bar — matches AILoadingOverlay */}
        <div className="w-40 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand to-pink-500"
            style={reduced ? { width: "60%" } : { animation: "hiw-shimmer 1.5s ease-in-out infinite" }}
          />
        </div>
      </div>
    </div>
  );
}

// Three real template looks, cycled in sync: the caption restyles itself, the
// matching template card lights up below, and a colored glow washes the video —
// exactly the real editor interaction (pick a template → captions change).
const CZ_STYLES = [
  {
    name: "Hormozi", icon: "🔥",
    chip: "linear-gradient(135deg,#e55c00,#ff8c00)",
    color: "#fde047", stroke: "#000",
    glow: "rgba(255,140,0,0.45)",
  },
  {
    name: "TikTok", icon: "⚡",
    chip: "linear-gradient(135deg,#4c1d95,#7c3aed)",
    color: "#ffffff", stroke: "#5b21b6",
    glow: "rgba(124,58,237,0.5)",
  },
  {
    name: "נאון", icon: "💎",
    chip: "linear-gradient(135deg,#0891b2,#22d3ee)",
    color: "#67e8f9", stroke: "#083344",
    glow: "rgba(34,211,238,0.4)",
  },
];

/**
 * Stage 2 — "עריכה כרצונכם". The video fills the frame and ONE caption visibly
 * flips between three real template looks (Hormozi → TikTok → נאון) while the
 * matching template card lights up underneath and a synced color-glow washes
 * the scene — the actual editor interaction, dramatized. All on a 3s loop that
 * fits exactly inside the stage's window, CSS-only.
 */
function StageCustomize({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 bg-[#0d0d1f] flex flex-col text-white" dir="rtl">
      {/* VIDEO HERO */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-[#251c42] to-[#130d24]">
        <div className="absolute inset-0 grid place-items-center text-6xl opacity-90">🧑‍💻</div>

        {/* synced color washes — one per template look */}
        {CZ_STYLES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 90% 55% at 50% 100%, ${s.glow}, transparent 70%)`,
              opacity: reduced ? (i === 0 ? 1 : 0) : 0,
              ...(reduced ? {} : { animation: `hiw-o${i} 3s linear infinite` }),
            }}
          />
        ))}

        {/* emoji + free-edit pill */}
        <div className="absolute top-3 right-3 text-2xl drop-shadow" style={reduced ? undefined : { animation: "hiw-spring .5s .25s both" }}>❤️</div>
        <div
          className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 backdrop-blur px-2 py-1 border border-white/15"
          style={reduced ? undefined : { animation: "hiw-fade .4s .1s both" }}
        >
          <SlidersHorizontal size={10} className="text-violet-300" />
          <span className="text-[8px] font-black text-white/85">עריכה חופשית</span>
        </div>

        {/* ONE caption, restyling itself — crossfading variants stacked */}
        <div className="absolute inset-x-0 bottom-6 grid place-items-center h-9">
          {CZ_STYLES.map((s, i) => (
            <span
              key={i}
              className="col-start-1 row-start-1 text-[19px] font-black tracking-tight"
              style={{
                color: s.color,
                WebkitTextStroke: `2.5px ${s.stroke}`,
                paintOrder: "stroke fill",
                textShadow: `0 0 14px ${s.glow}`,
                opacity: reduced ? (i === 0 ? 1 : 0) : 0,
                ...(reduced ? {} : { animation: `hiw-win${i} 3s ease-in-out infinite` }),
              }}
            >
              מושלם ✨
            </span>
          ))}
        </div>
      </div>

      {/* template cards — the matching one lights up in sync with the caption */}
      <div className="shrink-0 bg-[#111128]/95 border-t border-white/10 px-2.5 pt-2 pb-2.5">
        <div className="text-[8px] text-white/45 font-bold mb-1.5 flex items-center gap-1">
          <Sparkles size={9} className="text-violet-300" /> החליפו סגנון בקליק
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {CZ_STYLES.map((t, i) => (
            <div
              key={i}
              className="relative h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 ring-1 ring-white/10 overflow-visible"
              style={{ background: t.chip }}
            >
              <span className="text-base leading-none drop-shadow">{t.icon}</span>
              <span className="text-[8px] font-black text-white/95 leading-none">{t.name}</span>
              {/* synced highlight ring + glow */}
              <span
                className="absolute -inset-0.5 rounded-xl ring-2 ring-white pointer-events-none"
                style={{
                  boxShadow: `0 0 16px ${t.glow}`,
                  opacity: reduced ? (i === 0 ? 1 : 0) : 0,
                  ...(reduced ? {} : { animation: `hiw-o${i} 3s linear infinite` }),
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StageExport({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#132a1f] to-[#0d1f18] p-4">
      <div className="text-center">
        <div
          className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-xl shadow-emerald-500/40"
          style={reduced ? undefined : { animation: "hiw-spring .55s both" }}
        >
          <Check size={34} strokeWidth={3} />
        </div>
        <div
          className="mt-3 text-[15px] font-black text-white flex items-center justify-center gap-1"
          style={reduced ? undefined : { animation: "hiw-fade .4s .25s both" }}
        >
          מוכן <Sparkles size={14} className="text-amber-300" />
        </div>

        {/* download pill */}
        <div
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] font-black px-3 py-1.5 shadow-lg"
          style={reduced ? undefined : { animation: "hiw-rise .45s .35s both" }}
        >
          <Download size={13} /> הורדת MP4
        </div>

        {/* share icons fan in */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {["📸", "▶️", "🎵"].map((e, i) => (
            <span
              key={i}
              className="grid place-items-center w-8 h-8 rounded-full bg-white/10 border border-white/15 text-sm"
              style={reduced ? undefined : { animation: `hiw-spring .45s ${0.5 + i * 0.12}s both` }}
            >
              {e}
            </span>
          ))}
        </div>
        <div
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/50 font-bold"
          style={reduced ? undefined : { animation: "hiw-fade .4s .8s both" }}
        >
          <Share2 size={10} /> רילס · טיקטוק · יוטיוב
        </div>
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes hiw-pop { 0%{opacity:0;transform:translateY(6px) scale(.85)} 60%{transform:translateY(0) scale(1.06)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes hiw-spring { 0%{opacity:0;transform:scale(.4)} 55%{transform:scale(1.18)} 100%{opacity:1;transform:scale(1)} }
@keyframes hiw-rise { 0%{opacity:0;transform:translateY(14px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes hiw-fade { from{opacity:0} to{opacity:1} }
@keyframes hiw-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes hiw-fill { from{width:0%} to{width:100%} }
@keyframes hiw-scan { 0%{top:-20%} 100%{top:110%} }
@keyframes hiw-glow { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
@keyframes hiw-shimmer { 0%{transform:translateX(-120%)} 100%{transform:translateX(420%)} }
@keyframes hiw-dot-bounce { 0%,80%,100%{opacity:.25;transform:translateY(0)} 40%{opacity:1;transform:translateY(-4px)} }
.hiw-dot { display:inline-block; animation:hiw-dot-bounce 1.4s ease-in-out infinite; }
.hiw-dot:nth-child(2){ animation-delay:.15s } .hiw-dot:nth-child(3){ animation-delay:.3s }
/* 3s loop split into three 1s windows — caption look, template highlight and
   color wash all keyed to the SAME windows so they switch together. */
@keyframes hiw-win0 { 0%{opacity:0;transform:translateY(8px) scale(.8)} 6%,27%{opacity:1;transform:translateY(0) scale(1)} 33%,100%{opacity:0;transform:translateY(-4px) scale(.92)} }
@keyframes hiw-win1 { 0%,33%{opacity:0;transform:translateY(8px) scale(.8)} 39%,60%{opacity:1;transform:translateY(0) scale(1)} 66%,100%{opacity:0;transform:translateY(-4px) scale(.92)} }
@keyframes hiw-win2 { 0%,66%{opacity:0;transform:translateY(8px) scale(.8)} 72%,94%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-4px) scale(.92)} }
@keyframes hiw-o0 { 0%{opacity:0} 6%,27%{opacity:1} 33%,100%{opacity:0} }
@keyframes hiw-o1 { 0%,33%{opacity:0} 39%,60%{opacity:1} 66%,100%{opacity:0} }
@keyframes hiw-o2 { 0%,66%{opacity:0} 72%,94%{opacity:1} 100%{opacity:0} }
`;
