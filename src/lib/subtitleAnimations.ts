/**
 * Subtitle entrance animations — single source of truth.
 *
 * Each animation has:
 *   - cssAnimation: CSS animation name to apply in the live preview
 *   - assIntro(emphasis): ASS override codes to apply at burn time
 *
 * Preview and export must stay perceptually identical, so both code paths
 * read from the same definitions here. To add a new animation:
 *   1. Add an entry to ANIMATIONS
 *   2. Add matching @keyframes to globals.css
 */

export type SubtitleAnimationType =
  | "none"
  | "pop"
  | "bounce"
  | "slide-up"
  | "slide-left"
  | "slide-right"
  | "zoom-burst"
  | "wave"
  | "auto-mix";

export type AnimationDef = {
  id: SubtitleAnimationType;
  label: string;
  description: string;
  emoji: string;
  /** CSS animation property value (matches a @keyframes in globals.css) */
  cssAnimation: string;
  /** ASS override codes prepended to text (no \fad here — added separately) */
  assIntro: (emphasis: boolean) => string;
};

export const ANIMATIONS: AnimationDef[] = [
  {
    id: "none",
    label: "ללא",
    description: "פייד פשוט",
    emoji: "—",
    cssAnimation: "sub-fade 200ms ease-out",
    assIntro: () => "",
  },
  {
    id: "pop",
    label: "פופ",
    description: "סקייל overshoot",
    emoji: "💥",
    cssAnimation: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1)",
    assIntro: (emp) =>
      emp
        ? `\\fscx70\\fscy70\\t(0,140,\\fscx120\\fscy120)\\t(140,300,\\fscx100\\fscy100)`
        : `\\fscx80\\fscy80\\t(0,150,\\fscx108\\fscy108)\\t(150,280,\\fscx100\\fscy100)`,
  },
  {
    id: "bounce",
    label: "באונס",
    description: "קפיצה אלסטית",
    emoji: "🏀",
    cssAnimation: "sub-bounce 500ms cubic-bezier(0.68,-0.55,0.27,1.55)",
    assIntro: (emp) => {
      const a = emp ? 130 : 115;
      return (
        `\\fscx60\\fscy60` +
        `\\t(0,140,\\fscx${a}\\fscy${a})` +
        `\\t(140,260,\\fscx90\\fscy90)` +
        `\\t(260,400,\\fscx105\\fscy105)` +
        `\\t(400,500,\\fscx100\\fscy100)`
      );
    },
  },
  {
    id: "slide-up",
    label: "מלמטה",
    description: "החלקה מלמטה",
    emoji: "⬆️",
    cssAnimation: "sub-slide-up 350ms cubic-bezier(0.16,1,0.3,1)",
    // \move x1,y1 → x2,y2 over 0..t. We use a relative offset trick:
    // shift vertically via larger \fscy then settle.
    assIntro: () => `\\fscy120\\t(0,300,\\fscy100)`,
  },
  {
    id: "slide-left",
    label: "מצד שמאל",
    description: "החלקה משמאל",
    emoji: "⬅️",
    cssAnimation: "sub-slide-left 350ms cubic-bezier(0.16,1,0.3,1)",
    assIntro: () => `\\fscx70\\t(0,300,\\fscx100)`,
  },
  {
    id: "slide-right",
    label: "מצד ימין",
    description: "החלקה מימין",
    emoji: "➡️",
    cssAnimation: "sub-slide-right 350ms cubic-bezier(0.16,1,0.3,1)",
    assIntro: () => `\\fscx70\\fscy90\\t(0,300,\\fscx100\\fscy100)`,
  },
  {
    id: "zoom-burst",
    label: "פיצוץ זום",
    description: "מתחיל ענק וקטן",
    emoji: "🌟",
    cssAnimation: "sub-zoom-burst 400ms cubic-bezier(0.16,1,0.3,1)",
    assIntro: (emp) => {
      const start = emp ? 160 : 140;
      return `\\fscx${start}\\fscy${start}\\t(0,350,\\fscx100\\fscy100)`;
    },
  },
  {
    id: "wave",
    label: "גל",
    description: "מתנדנד פנימה",
    emoji: "🌊",
    cssAnimation: "sub-wave 600ms ease-out",
    assIntro: () =>
      `\\fscx95\\fscy105\\t(0,150,\\fscx105\\fscy95)\\t(150,300,\\fscx98\\fscy102)\\t(300,500,\\fscx100\\fscy100)`,
  },
  {
    id: "auto-mix",
    label: "AI מערבב",
    description: "כל כתובית עם אנימציה שונה",
    emoji: "🎲",
    // auto-mix is resolved per-subtitle elsewhere
    cssAnimation: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1)",
    assIntro: (emp) =>
      emp
        ? `\\fscx70\\fscy70\\t(0,140,\\fscx120\\fscy120)\\t(140,300,\\fscx100\\fscy100)`
        : `\\fscx80\\fscy80\\t(0,150,\\fscx108\\fscy108)\\t(150,280,\\fscx100\\fscy100)`,
  },
];

export const ANIMATION_MAP = Object.fromEntries(
  ANIMATIONS.map((a) => [a.id, a]),
) as Record<SubtitleAnimationType, AnimationDef>;

/** Cycle through these animations for auto-mix mode. Order matters: skip "none". */
const AUTO_MIX_POOL: SubtitleAnimationType[] = [
  "pop", "bounce", "slide-up", "zoom-burst", "wave", "slide-left", "slide-right",
];

/**
 * Pick an animation for a given subtitle index. In auto-mix mode, cycles through
 * the pool with a deterministic offset so each refresh is the same.
 */
export function resolveAnimation(
  mode: SubtitleAnimationType,
  subtitleIndex: number,
): AnimationDef {
  if (mode !== "auto-mix") return ANIMATION_MAP[mode];
  const picked = AUTO_MIX_POOL[subtitleIndex % AUTO_MIX_POOL.length];
  return ANIMATION_MAP[picked];
}
