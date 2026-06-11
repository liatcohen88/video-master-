/**
 * Preset color filters — pure CSS `filter` strings applied to the <video>
 * element in the preview. Each preset is a curated combo of hue-rotate,
 * sat, contrast, brightness, and sepia to evoke a recognizable vibe.
 *
 * Why not a CSS feGaussianBlur LUT or canvas pipeline? Native `filter` is
 * GPU-accelerated, costs ~0% CPU, and updates instantly. For burn-in at
 * export we translate each preset to an FFmpeg `-vf` chain (TODO in
 * exportCompositor). Until then, preview-only — Liat will see the vibe.
 *
 * Each preset has Hebrew name + English subtitle so the chip is readable
 * in the picker even before she knows what the English word means.
 */

import type { VideoEffects } from "./types";

export type ColorFilterId = NonNullable<VideoEffects["colorFilter"]>;

export type ColorFilterPreset = {
  id: ColorFilterId;
  /** Hebrew display name */
  label: string;
  /** Short English subtitle / English equivalent */
  sub: string;
  /** One-line vibe description */
  desc: string;
  /** Emoji shown in the chip */
  emoji: string;
  /** CSS `filter` value. Empty = passthrough. */
  css: string;
  /** Approximate dominant color — used to tint the chip border */
  chipColor: string;
};

export const COLOR_FILTERS: ColorFilterPreset[] = [
  {
    id: "none",
    label: "ללא פילטר",
    sub: "Original",
    desc: "צבעי הסרטון המקוריים",
    emoji: "🎬",
    css: "",
    chipColor: "rgba(255,255,255,0.4)",
  },
  {
    id: "sunset",
    label: "סנסט",
    sub: "Sunset",
    desc: "חמים, אורנג'-ורוד — וויב חופש",
    emoji: "🌅",
    // hue toward warm, saturation up, slight contrast lift, sepia kiss
    css: "sepia(0.25) saturate(1.4) hue-rotate(-12deg) contrast(1.05) brightness(1.05)",
    chipColor: "#F97316",
  },
  {
    id: "cyberpunk",
    label: "סייברפאנק",
    sub: "Cyberpunk",
    desc: "מג'נטה+סיאן רוויים, אנרגטי",
    emoji: "🌃",
    css: "saturate(1.7) hue-rotate(8deg) contrast(1.18) brightness(0.95)",
    chipColor: "#A855F7",
  },
  {
    id: "vhs",
    label: "VHS",
    sub: "Retro tape",
    desc: "שטוח, ירקרק, נוסטלגיה",
    emoji: "📼",
    css: "saturate(0.7) hue-rotate(-8deg) contrast(0.92) brightness(0.95) sepia(0.15)",
    chipColor: "#10B981",
  },
  {
    id: "y2k",
    label: "Y2K",
    sub: "Pastel pop",
    desc: "ורוד פסטל, חלומי",
    emoji: "💖",
    css: "saturate(1.3) hue-rotate(-18deg) contrast(0.96) brightness(1.1)",
    chipColor: "#EC4899",
  },
  {
    id: "mono",
    label: "מונו",
    sub: "B&W",
    desc: "שחור-לבן עם קונטרסט",
    emoji: "⚫",
    css: "grayscale(1) contrast(1.15) brightness(1.02)",
    chipColor: "#94A3B8",
  },
  {
    id: "vivid",
    label: "וויוויד",
    sub: "Vivid pop",
    desc: "סטורציה+עוצמה — לאוכל ויופי",
    emoji: "✨",
    css: "saturate(1.55) contrast(1.12) brightness(1.04)",
    chipColor: "#FBBF24",
  },
];

/** Resolve a preset id (or undefined) → CSS filter string. */
export function colorFilterCss(id: ColorFilterId | undefined): string {
  if (!id || id === "none") return "";
  return COLOR_FILTERS.find((f) => f.id === id)?.css ?? "";
}
