"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { Subtitle } from "@/lib/types";
import { detectBeatDrops, manualBeatDrops, type BeatDrop } from "@/lib/wowEffects";

/**
 * WowOverlay — pure CSS particle bursts on power-words. Sits ABOVE the
 * video, BELOW the subtitles. Each detected beat-drop spawns 8 sparkle
 * particles that fly outward over ~600ms, then disappear.
 *
 * Why not Canvas? CSS keyframes + a tiny `<span>` per particle is good
 * enough at 8 particles × few-times-per-video, GPU-accelerated, and reads
 * cleanly with HMR. No requestAnimationFrame loops to babysit.
 *
 * Cheap idle: when `enabled=false` we render nothing.
 */
export default function WowOverlay({
  subtitles, currentTime, enabled, shake,
}: {
  subtitles: Subtitle[];
  currentTime: number;
  enabled: boolean;
  /** Micro screen-shake at the same beat-drops. Independent toggle. */
  shake?: boolean;
}) {
  // Auto drops fire only when the global power toggles are on. Manual WOW
  // tags (forceWow per subtitle) ALWAYS fire — particles + shake — even when
  // those toggles are off, because the user explicitly asked for them.
  const forcedDrops = useMemo(() => manualBeatDrops(subtitles), [subtitles]);
  const drops = useMemo(
    () => [
      ...((enabled || shake) ? detectBeatDrops(subtitles) : []),
      ...forcedDrops,
    ],
    [enabled, shake, subtitles, forcedDrops],
  );

  // Which drop is "active" right now? A drop is considered firing for ~0.7s
  // after its `t` so the user sees the burst even if they're a frame late.
  const active = useMemo(
    () => drops.find((d) => currentTime >= d.t && currentTime < d.t + 0.7),
    [drops, currentTime],
  );

  // Particles render when the global particle toggle is on OR this is a
  // manual WOW; shake the same with its own toggle. So a manual tag shows
  // the full effect on its own.
  const showBurst = !!active && (enabled || !!active.manual);
  const showShake = !!active && (shake || !!active.manual);

  // Trigger a fresh DOM animation each time a NEW drop becomes active.
  // We do this by keying the particles container on the drop's timestamp,
  // forcing React to remount → CSS animation re-runs.
  const burstKey = showBurst ? active!.t : null;

  // Apply a tiny CSS shake to the OUTER preview frame when a drop is active.
  // We do that by setting a data attribute on the document so the existing
  // container picks it up via the className below (kept local & cheap).
  const shakeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = shakeRef.current;
    if (!el) return;
    if (showShake) el.classList.add("wow-shake");
    const id = window.setTimeout(() => el?.classList.remove("wow-shake"), 250);
    return () => window.clearTimeout(id);
  }, [showShake]);

  if (!enabled && !shake && forcedDrops.length === 0) return null;

  return (
    <div
      ref={shakeRef}
      className="pointer-events-none absolute inset-0 z-[8] overflow-visible"
      aria-hidden
    >
      {burstKey !== null && (
        <Burst key={burstKey} drop={active!} containerRef={shakeRef} />
      )}

      <style jsx>{`
        :global(.wow-shake) {
          animation: wow-shake-kf 220ms cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes wow-shake-kf {
          0%, 100% { transform: translate(0, 0); }
          20%      { transform: translate(-2px, 1px); }
          40%      { transform: translate(2px, -1px); }
          60%      { transform: translate(-1px, -2px); }
          80%      { transform: translate(1px, 2px); }
        }
      `}</style>
    </div>
  );
}

/** 10 sparkle particles radiating from the matched word's on-screen
 *  position. SubtitleOverlay tags each word span with data-vm-word; we
 *  look up the most recently rendered span for this drop's word, measure
 *  its center relative to the overlay container, and anchor the burst
 *  there. Falls back to the lower-third center if the word isn't in the
 *  DOM yet (subtitle hasn't started rendering this frame). */
function Burst({ drop, containerRef }: {
  drop: BeatDrop;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const N = 10;
  const [pos, setPos] = useState<{ left: string; top: string }>({ left: "50%", top: "72%" });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !drop.word) return;
    // Match by data-vm-word, scoped to the current container.
    const all = container.parentElement?.querySelectorAll<HTMLElement>(
      `[data-vm-word="${cssEscape(drop.word)}"]`,
    );
    const span = all && all.length > 0 ? all[all.length - 1] : null;
    if (!span) return;
    const wordRect = span.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;
    const cx = wordRect.left + wordRect.width / 2 - containerRect.left;
    const cy = wordRect.top + wordRect.height / 2 - containerRect.top;
    setPos({
      left: `${(cx / containerRect.width) * 100}%`,
      top: `${(cy / containerRect.height) * 100}%`,
    });
  }, [drop, containerRef]);

  return (
    <div
      className="absolute"
      style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)" }}
    >
      <div className="relative w-1 h-1">
        {Array.from({ length: N }).map((_, i) => {
          const angle = (i / N) * Math.PI * 2;
          const dx = Math.cos(angle) * 110;
          const dy = Math.sin(angle) * 110;
          const hue = (i * 36) % 360;
          return (
            <span
              key={i}
              className="wow-particle"
              style={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--dx' as any]: `${dx}px`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--dy' as any]: `${dy}px`,
                background: `hsl(${hue} 95% 65%)`,
                boxShadow: `0 0 8px hsl(${hue} 95% 65%)`,
              }}
            />
          );
        })}
      </div>

      <style jsx>{`
        .wow-particle {
          position: absolute;
          inset: 0;
          width: 6px;
          height: 6px;
          margin: auto;
          border-radius: 9999px;
          opacity: 0;
          animation: wow-pop 620ms cubic-bezier(.16, 1, .3, 1) forwards;
        }
        @keyframes wow-pop {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
          10%  { opacity: 1; transform: translate(0, 0) scale(1.4); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.7); }
        }
      `}</style>
    </div>
  );
}

// CSS.escape isn't on every browser engine we target; do a tight subset
// good enough for word strings (drop quotes and backslashes).
function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "");
}
