/**
 * Video intro animations — the first ~600-900ms of every clip.
 *
 * Hooks the viewer in the critical first second. Every preset is a tight
 * curve over a short window — long enough to feel intentional, short
 * enough not to delay the message. Composes with existing zoom/shake by
 * MULTIPLYING into the same transform pipeline (additive on top, never
 * fighting the per-frame zoom).
 *
 * Live-preview only for now (CSS transform + opacity). Export burn-in via
 * FFmpeg `geq`/`scale=eval=frame` is a follow-up — for the MVP, what the
 * user sees in preview is what proves the value.
 */

import type { VideoEffects } from "./types";

export type IntroAnimationId = NonNullable<VideoEffects["introAnimation"]>;

export type IntroPreset = {
  id: IntroAnimationId;
  label: string;
  emoji: string;
  /** Short description for the chip */
  desc: string;
  /** Total animation duration in seconds */
  duration: number;
};

export const INTRO_ANIMATIONS: IntroPreset[] = [
  { id: "none",        label: "ללא",          emoji: "—",  desc: "התחלה רגילה",                              duration: 0    },
  { id: "punchZoom",   label: "פאנץ' זום",    emoji: "🥊", desc: "מתחיל בזום 1.4× וקופץ לרגיל — MrBeast",     duration: 0.55 },
  { id: "shake",       label: "רעד דרמטי",    emoji: "🌋", desc: "רעידה אגרסיבית 350ms — סטייל MrHorse",     duration: 0.4  },
  { id: "dropZoom",    label: "זום סוחף",     emoji: "🎯", desc: "זום פנימה איטי 4% — תחושת מתח",            duration: 0.85 },
  { id: "whipPan",     label: "וויפ פאן",     emoji: "🌪️", desc: "מחליק מהצד עם blur תנועה",                duration: 0.45 },
  { id: "bounceIn",    label: "באונס",        emoji: "🏀", desc: "קופץ פנימה עם overshoot חינני",            duration: 0.7  },
  { id: "flashWhite",  label: "פלאש לבן",     emoji: "⚡", desc: "פלאש לבן קצר → הוידאו מופיע",              duration: 0.45 },
  { id: "irisOpen",    label: "פתיחת איריס",  emoji: "⚫", desc: "מתחיל מנקודה במרכז ונפתח",                 duration: 0.6  },
  { id: "slideUp",     label: "סליידאפ",      emoji: "⬆️", desc: "מחליק מלמטה כלפי מעלה",                    duration: 0.5  },
  { id: "fadeIn",      label: "פייד שחור",    emoji: "🎬", desc: "עולה משחור — קלאסי",                       duration: 0.5  },
];

/** State of the intro animation at time `t` (seconds since clip start). */
export type IntroFrame = {
  /** Multiply into the existing scale chain */
  scaleMul: number;
  /** Add to existing translate (percent) */
  translateX: number;
  translateY: number;
  /** Rotation in degrees */
  rotate: number;
  /** Opacity (0..1). Apply to the video element. */
  opacity: number;
  /** Color overlay above the video for flash/iris effects.
   *  background: any CSS color/gradient. opacity: 0..1. */
  overlayBg?: string;
  overlayOpacity?: number;
  /** Optional CSS clip-path for iris */
  clipPath?: string;
  /** Extra filter (e.g. glitch hue-rotate) */
  extraFilter?: string;
};

const PASSTHROUGH: IntroFrame = {
  scaleMul: 1, translateX: 0, translateY: 0, rotate: 0, opacity: 1,
};

/** Smooth cubic-bezier easing — matches CSS `cubic-bezier(.16,1,.3,1)` */
function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Resolve the intro animation state at time `t` for the chosen preset.
 * Caller multiplies/adds the returned values into the existing transform.
 */
export function introFrameAt(
  t: number,
  id: IntroAnimationId | undefined,
): IntroFrame {
  if (!id || id === "none") return PASSTHROUGH;
  const preset = INTRO_ANIMATIONS.find((p) => p.id === id);
  if (!preset || preset.duration <= 0) return PASSTHROUGH;
  if (t < 0 || t >= preset.duration) return PASSTHROUGH;

  const p = t / preset.duration; // 0..1 progress
  const ease = easeOutExpo(p);

  switch (id) {
    case "punchZoom":
      // Start at 1.4×, ease down to 1.0
      return { ...PASSTHROUGH, scaleMul: 1.4 - 0.4 * ease };

    case "shake": {
      // MrHorse signature: aggressive multi-axis jitter that decays from
      // strong → none. Combined with a 1.06× scale "punch" to give weight.
      // Uses pseudo-random per-frame offsets that taper with (1-p) so the
      // rumble settles into stillness exactly at duration end.
      const intensity = (1 - p) * (1 - p); // quadratic taper, ends at 0
      const ax = Math.sin(t * 90) * 14 * intensity;
      const ay = Math.cos(t * 110) * 11 * intensity;
      const rot = Math.sin(t * 70) * 4 * intensity;
      return {
        ...PASSTHROUGH,
        scaleMul: 1 + 0.06 * intensity,
        translateX: ax,
        translateY: ay,
        rotate: rot,
      };
    }

    case "dropZoom": {
      // Slow ominous push-in from 1.0 to 1.04. No bounce — the menace is in
      // the steady creep. MrHorse uses this under suspense lines.
      const easeIn = p * p; // ease-in-quad: slow start, accelerating
      return { ...PASSTHROUGH, scaleMul: 1 + 0.04 * easeIn };
    }

    case "whipPan": {
      // Horizontal whip from off-screen right (+120%) to 0. Heavy at the
      // start, smooth at the end. Skew adds motion-blur feel without an
      // actual blur filter (cheaper, GPU-friendly).
      const tx = (1 - ease) * 120;
      const skew = (1 - ease) * 12; // degrees — read as motion blur
      return {
        ...PASSTHROUGH,
        translateX: tx,
        rotate: skew * 0.3, // gentle accompanying lean
      };
    }

    case "bounceIn": {
      const k = easeOutBack(p);
      return { ...PASSTHROUGH, scaleMul: 0.6 + 0.4 * k, opacity: Math.min(1, p * 2) };
    }

    case "flashWhite": {
      // First 25% = full white, then fade out
      const flashP = p < 0.25 ? 1 : 1 - (p - 0.25) / 0.75;
      return {
        ...PASSTHROUGH,
        scaleMul: 1.03 - 0.03 * ease,
        overlayBg: "white",
        overlayOpacity: Math.max(0, flashP),
      };
    }

    case "irisOpen": {
      // Circle expands from 0% to 75% (75% covers most of the frame at the
      // tail end so the reveal feels complete).
      const r = 75 * ease;
      return {
        ...PASSTHROUGH,
        clipPath: `circle(${r}% at 50% 50%)`,
        scaleMul: 1.08 - 0.08 * ease,
      };
    }

    case "slideUp":
      return {
        ...PASSTHROUGH,
        translateY: (1 - ease) * 100, // 100% down → 0%
        opacity: ease,
      };

    case "fadeIn":
      return {
        ...PASSTHROUGH,
        opacity: ease,
        overlayBg: "black",
        overlayOpacity: 1 - ease,
      };

    default:
      return PASSTHROUGH;
  }
}
