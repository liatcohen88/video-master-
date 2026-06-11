"use client";

/**
 * Live showcase — real vlogger video + brand caption/effects overlay.
 * ALL text & emoji editable from /admin → תוכן → "דף הנחיתה" via the
 * landing.showcaseN.* keys. Card 1 uses the AI-generated video; card 2
 * is a gradient until we mint its own clip.
 */

import { Sparkles, Languages, Music, Scissors, Wand2, Layers, Zap } from "lucide-react";
import { useContent } from "@/lib/useContent";
import MultiVideoMergeAnimation from "./MultiVideoMergeAnimation";

export default function FeatureShowcase() {
  const s1Title = useContent("landing.showcase1.title");
  const s1Body  = useContent("landing.showcase1.body");
  const s1Cap1  = useContent("landing.showcase1.caption1");
  const s1Cap1H = useContent("landing.showcase1.caption1Hi");
  const s1Cap2  = useContent("landing.showcase1.caption2");
  const s1Cap2H = useContent("landing.showcase1.caption2Hi");
  const s1Emoji = useContent("landing.showcase1.emoji");

  const s2Title = useContent("landing.showcase2.title");
  const s2Body  = useContent("landing.showcase2.body");
  const s2Cap1  = useContent("landing.showcase2.caption1");
  const s2Cap1H = useContent("landing.showcase2.caption1Hi");
  const s2Cap2  = useContent("landing.showcase2.caption2");
  const s2Cap2H = useContent("landing.showcase2.caption2Hi");
  const s2Emoji = useContent("landing.showcase2.emoji");

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ShowcaseCard
        title={s1Title} body={s1Body}
        videoSrc="/showcase-woman.mp4"
        captions={[
          { text: s1Cap1, hiWord: s1Cap1H, effect: "pop"    },
          { text: s1Cap2, hiWord: s1Cap2H, effect: "bounce" },
        ]}
        emoji={s1Emoji}
        theme="warm"
      />
      <ShowcaseCard
        title={s2Title} body={s2Body}
        captions={[
          { text: s2Cap1, hiWord: s2Cap1H, effect: "pop"    },
          { text: s2Cap2, hiWord: s2Cap2H, effect: "bounce" },
        ]}
        emoji={s2Emoji}
        theme="cool"
        lottie="multi-merge"
      />
    </section>
  );
}

type Caption = { text: string; hiWord: string; effect: "pop" | "bounce" };

function ShowcaseCard({
  title, body, videoSrc, captions, emoji, theme, lottie,
}: {
  title: string; body: string;
  videoSrc?: string;
  captions: Caption[];
  emoji: string;
  theme: "warm" | "cool";
  /** When set, replaces the gradient placeholder with a Lottie animation. */
  lottie?: "multi-merge";
}) {
  const themeBg = theme === "warm"
    ? "from-amber-700/70 via-rose-700/80 to-pink-800/70"
    : "from-violet-800/70 via-fuchsia-800/70 to-cyan-700/60";

  return (
    <div className="bg-bg-card border border-white/10 rounded-3xl p-6 md:p-8 overflow-hidden">
      <div className="h-[380px] md:h-[420px] relative flex items-center justify-center mb-10">
        <div className="relative w-full max-w-[320px] mx-auto">

          {/* Editor chrome */}
          <div className="bg-bg/95 border border-white/15 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden lc-window-float">

            {/* 9:16 phone preview */}
            <div className="relative mx-auto my-4 w-[200px] aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/15 bg-black">
              {/* Real video OR Lottie OR gradient fallback */}
              {videoSrc ? (
                <video
                  key={videoSrc}
                  src={videoSrc}
                  autoPlay loop muted playsInline
                  preload="auto"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : lottie === "multi-merge" ? (
                /* Lottie has its own deep navy bg + soft cyan glow + dot grid,
                   so we skip the themed gradient + dark overlay that the
                   gradient fallback uses. Letting it own the frame. */
                <MultiVideoMergeAnimation
                  orientation="portrait"
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                <>
                  <div className={`absolute inset-0 bg-gradient-to-br ${themeBg}`} />
                  <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/15 blur-md" />
                </>
              )}

              {/* Subtle gradient overlay for caption legibility — skipped when
                  Lottie is rendering (its own vignettes handle depth). */}
              {!lottie && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20 pointer-events-none" />
              )}

              {/* ONE emoji popping near the TOP-LEFT corner (off the face) —
                  synced with the FIRST caption ("היי חברים").
                  Hidden when a Lottie animation is rendering, since the Lottie
                  is the focal point and the emoji would visually compete. */}
              {!lottie && (
                <div className="absolute top-[8%] left-[8%] text-[38px] drop-shadow-[0_0_14px_rgba(251,191,36,0.8)] lc-emoji-pop pointer-events-none">
                  {emoji}
                </div>
              )}

              {/* Captions intentionally hidden in the showcase card — Liat
                  asked for a clean look. The CMS values (caption1/caption2)
                  remain available; re-enable by uncommenting the map below.
              {captions.map((c, ci) => (
                <div key={ci} className={`absolute bottom-[14%] left-2 right-2 text-center lc-caption-${ci}`}>
                  <CaptionLine words={c.text.split(" ")} hiWord={c.hiWord} effect={c.effect} capIdx={ci} />
                </div>
              ))} */}
            </div>

            {/* Effect toolbar — the row of tool icons pulsing in sequence
                to show users "yes, the app also does SFX / cuts / effects" */}
            <div className="flex items-center justify-center gap-1.5 px-3 pb-3 pt-1">
              <ToolPing color="violet"  icon={<Languages className="w-3 h-3" />} delay={0} />
              <ToolPing color="pink"    icon={<Music className="w-3 h-3" />}      delay={0.5} />
              <ToolPing color="amber"   icon={<Scissors className="w-3 h-3" />}   delay={1.0} />
              <ToolPing color="cyan"    icon={<Wand2 className="w-3 h-3" />}      delay={1.5} />
              <ToolPing color="emerald" icon={<Layers className="w-3 h-3" />}     delay={2.0} />
              <ToolPing color="rose"    icon={<Sparkles className="w-3 h-3" />}   delay={2.5} />
              <ToolPing color="yellow"  icon={<Zap className="w-3 h-3" />}        delay={3.0} />
            </div>
          </div>

          <ShowcaseStyles captionCount={captions.length} />
        </div>
      </div>
      <h3 className="text-xl md:text-2xl font-black mb-2 leading-tight">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{body}</p>
    </div>
  );
}

// ── Reels-style caption: big bold Hebrew with thick BLACK outline.
//    No text-stroke (broke Hebrew rendering). Uses multi-layer text-shadow
//    to fake the outline cleanly. Highlight word = pink. Simple POP animation.
function CaptionLine({ words, hiWord, capIdx }: {
  words: string[]; hiWord: string; effect: "pop" | "bounce"; capIdx: number;
}) {
  // 8-direction text-shadow = solid outline that works perfectly with Hebrew
  const blackOutline = [
    "-2px -2px 0 #000",
    "2px -2px 0 #000",
    "-2px 2px 0 #000",
    "2px 2px 0 #000",
    "0 -2px 0 #000",
    "0 2px 0 #000",
    "-2px 0 0 #000",
    "2px 0 0 #000",
    "0 4px 6px rgba(0,0,0,0.5)",
  ].join(", ");

  return (
    <div className="flex items-center justify-center gap-2 whitespace-nowrap" dir="rtl">
      {words.map((w, wi) => {
        const clean = w.replace(/[,.!?]/g, "");
        const isHi  = clean === hiWord.trim();
        return (
          <span key={wi}
            className={`inline-block text-2xl md:text-3xl font-black leading-none lc-pop-word ${isHi ? "lc-hi-word" : ""}`}
            style={{
              animationDelay: `${0.15 * wi + (capIdx * 3)}s`,
              color: isHi ? undefined : "#FFFFFF",
              textShadow: blackOutline,
            }}>
            {w}
          </span>
        );
      })}
    </div>
  );
}

function ShowcaseStyles({ captionCount }: { captionCount: number }) {
  // 6s cycle, each caption gets equal slot.
  // MUST be `global` — these class names are applied on elements in the
  // PARENT component (ShowcaseCard), so scoped styled-jsx wouldn't reach.
  return (
    <style jsx global>{`
      @keyframes lc-window { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      .lc-window-float { animation: lc-window 5s ease-in-out infinite; }

      @keyframes lc-rec { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      .lc-rec { animation: lc-rec 1s ease-in-out infinite; }

      @keyframes lc-pill { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-3px); } }
      .lc-pill-float { animation: lc-pill 3s ease-in-out infinite; }

      /* Emoji POP — mid-cycle dramatic entrance */
      @keyframes lc-emoji-pop {
        0%, 30%       { opacity: 0; transform: scale(0) rotate(-45deg); }
        38%           { opacity: 1; transform: scale(1.5) rotate(20deg); }
        46%           { transform: scale(0.85) rotate(-8deg); }
        52%           { transform: scale(1.1) rotate(4deg); }
        58%           { transform: scale(1) rotate(0deg); }
        88%           { opacity: 1; transform: scale(1.06) rotate(2deg); }
        96%           { opacity: 0; transform: scale(0.7) rotate(15deg); }
        100%          { opacity: 0; transform: scale(0); }
      }
      .lc-emoji-pop { opacity: 0; animation: lc-emoji-pop 6s ease-in-out infinite; }

      /* ── Caption visibility windows (${captionCount} captions, 6s cycle) ──
         Handle the edge cases: i=0 starts AT 0% (don't duplicate);
         the last caption ends AT 100% (don't duplicate). */
      ${Array.from({ length: captionCount }).map((_, i) => {
        const slotStart  = (i / captionCount) * 100;
        const fadeIn     = slotStart + 3;
        const fadeOutAt  = ((i + 1) / captionCount) * 100 - 4;
        const fadeOutEnd = ((i + 1) / captionCount) * 100;
        const isFirst = i === 0;
        const isLast  = i === captionCount - 1;
        // Build keyframe stops without duplicate 0% or 100%
        const stops: string[] = [];
        if (isFirst) {
          stops.push(`0% { opacity: 0; transform: translateY(10px) scale(0.95); }`);
        } else {
          stops.push(`0% { opacity: 0; transform: translateY(10px) scale(0.95); }`);
          stops.push(`${slotStart}% { opacity: 0; transform: translateY(10px) scale(0.95); }`);
        }
        stops.push(`${fadeIn}% { opacity: 1; transform: translateY(0) scale(1); }`);
        stops.push(`${fadeOutAt}% { opacity: 1; transform: translateY(0) scale(1); }`);
        if (isLast) {
          stops.push(`100% { opacity: 0; transform: translateY(-4px) scale(0.97); }`);
        } else {
          stops.push(`${fadeOutEnd}% { opacity: 0; transform: translateY(-4px) scale(0.97); }`);
          stops.push(`100% { opacity: 0; }`);
        }
        return `
          @keyframes lc-cap-${i} { ${stops.join(" ")} }
          .lc-caption-${i} { animation: lc-cap-${i} 6s ease-in-out infinite; opacity: 0; }
        `;
      }).join("\n")}

      /* ── Clean POP, EXACTLY like the app's sub-pop subtitle preset.
         Scale 0.8 → 1.08 (tiny overshoot) → 1. Nothing more. */
      @keyframes lc-pop-word {
        0%   { opacity: 0; transform: scale(0.7); }
        45%  { opacity: 1; transform: scale(1.08); }
        100% { opacity: 1; transform: scale(1); }
      }
      .lc-pop-word {
        animation: lc-pop-word 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        display: inline-block;
      }

      /* Highlighted word: same pop, just stays pink with a soft glow.
         No color cycling, no continuous wiggle — clean and readable. */
      .lc-hi-word {
        color: #EC4899;
        filter: drop-shadow(0 0 6px rgba(236, 72, 153, 0.5));
      }

      /* Tool icon pulse — one at a time, sweep through the toolbar */
      @keyframes lc-tool-ping {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        5%       { transform: scale(1.25); opacity: 1; box-shadow: 0 0 12px currentColor; }
        15%      { transform: scale(1); opacity: 0.5; }
      }
      .lc-tool-ping { animation: lc-tool-ping 4s ease-out infinite; opacity: 0.5; }
    `}</style>
  );
}

// Tool icon that pulses in sequence with siblings
function ToolPing({ color, icon, delay }: {
  color: "violet" | "pink" | "amber" | "cyan" | "emerald" | "rose" | "yellow";
  icon: React.ReactNode;
  delay: number;
}) {
  const colors = {
    violet:  "bg-violet-500/25 text-violet-300",
    pink:    "bg-pink-500/25 text-pink-300",
    amber:   "bg-amber-500/25 text-amber-300",
    cyan:    "bg-cyan-500/25 text-cyan-300",
    emerald: "bg-emerald-500/25 text-emerald-300",
    rose:    "bg-rose-500/25 text-rose-300",
    yellow:  "bg-yellow-500/25 text-yellow-300",
  };
  return (
    <div className={`p-1.5 rounded-md ${colors[color]} lc-tool-ping`}
         style={{ animationDelay: `${delay}s` }}>
      {icon}
    </div>
  );
}
