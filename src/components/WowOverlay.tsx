"use client";

import { useMemo, useRef, useEffect } from "react";
import type { Subtitle } from "@/lib/types";
import { detectBeatDrops, type BeatDrop } from "@/lib/wowEffects";

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
  const drops = useMemo(
    () => (enabled || shake) ? detectBeatDrops(subtitles) : [],
    [enabled, shake, subtitles],
  );

  // Which drop is "active" right now? A drop is considered firing for ~0.7s
  // after its `t` so the user sees the burst even if they're a frame late.
  const active = useMemo(
    () => drops.find((d) => currentTime >= d.t && currentTime < d.t + 0.7),
    [drops, currentTime],
  );

  // Trigger a fresh DOM animation each time a NEW drop becomes active.
  // We do this by keying the particles container on the drop's timestamp,
  // forcing React to remount → CSS animation re-runs.
  const burstKey = active ? active.t : null;

  // Apply a tiny CSS shake to the OUTER preview frame when a drop is active.
  // We do that by setting a data attribute on the document so the existing
  // container picks it up via the className below (kept local & cheap).
  const shakeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = shakeRef.current;
    if (!el) return;
    if (shake && active) el.classList.add("wow-shake");
    const id = window.setTimeout(() => el?.classList.remove("wow-shake"), 250);
    return () => window.clearTimeout(id);
  }, [shake, active]);

  if (!enabled && !shake) return null;

  return (
    <div
      ref={shakeRef}
      className="pointer-events-none absolute inset-0 z-[8] overflow-visible"
      aria-hidden
    >
      {enabled && burstKey !== null && (
        <Burst key={burstKey} drop={active!} />
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

/** 8 sparkle particles flying out in a circle. */
function Burst({ drop: _drop }: { drop: BeatDrop }) {
  const N = 10;
  return (
    <div className="absolute inset-0 grid place-items-center">
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
