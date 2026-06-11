/**
 * FFmpeg equivalents for the CSS color filters in colorFilters.ts. Lets the
 * exported MP4 carry the same vibe Liat saw in the live preview.
 *
 * Mapping notes:
 *   CSS `brightness(1.05)` is multiplicative → FFmpeg `eq=brightness=` is
 *   additive in range [-1, 1]. We approximate 1.05 ≈ +0.05.
 *   CSS `sepia(x)` has no perfect FFmpeg counterpart — we lean on the
 *   `curves=preset=vintage` for warm shift + extra saturation to get close.
 *   `hue-rotate(Ndeg)` ↔ `hue=h=N`.
 *   `grayscale(1)` ↔ `hue=s=0`.
 */

import type { VideoEffects } from "./types";

type Id = NonNullable<VideoEffects["colorFilter"]>;

// Each preset mirrors the CSS string in colorFilters.ts as closely as
// FFmpeg can express it. Earlier versions added extra `colorbalance` and
// `curves=preset=vintage` that weren't in the CSS — that's why the MP4
// looked noticeably different from the live preview (Liat: "הצבע גם
// יוצא שונה"). The mapping here is intentionally MINIMAL — just the
// filters the CSS actually uses — so what the user sees IS what they get.
//
// sepia(x) has no direct FFmpeg equivalent. We approximate via a small
// red/blue colorbalance shift proportional to x. Strength tuned empirically.
const MAP: Record<Exclude<Id, "none">, string[]> = {
  // CSS: sepia(0.25) saturate(1.4) hue-rotate(-12deg) contrast(1.05) brightness(1.05)
  sunset: [
    "eq=saturation=1.4:contrast=1.05:brightness=0.05",
    "hue=h=-12",
    // sepia(0.25) ≈ tiny warm shift
    "colorbalance=rs=0.06:bs=-0.06",
  ],
  // CSS: saturate(1.7) hue-rotate(8deg) contrast(1.18) brightness(0.95)
  cyberpunk: [
    "eq=saturation=1.7:contrast=1.18:brightness=-0.05",
    "hue=h=8",
  ],
  // CSS: saturate(0.7) hue-rotate(-8deg) contrast(0.92) brightness(0.95) sepia(0.15)
  vhs: [
    "eq=saturation=0.7:contrast=0.92:brightness=-0.05",
    "hue=h=-8",
    // sepia(0.15) ≈ slight warm tint, NOT curves=vintage (way too strong)
    "colorbalance=rs=0.04:bs=-0.04",
  ],
  // CSS: saturate(1.3) hue-rotate(-18deg) contrast(0.96) brightness(1.1)
  y2k: [
    "eq=saturation=1.3:contrast=0.96:brightness=0.10",
    "hue=h=-18",
  ],
  // CSS: grayscale(1) contrast(1.15) brightness(1.02)
  mono: [
    "hue=s=0",
    "eq=contrast=1.15:brightness=0.02",
  ],
  // CSS: saturate(1.55) contrast(1.12) brightness(1.04)
  vivid: [
    "eq=saturation=1.55:contrast=1.12:brightness=0.04",
  ],
};

/** Return the FFmpeg -vf filter list for the chosen preset (or [] for none). */
export function buildColorFilterFfmpeg(effects: VideoEffects): string[] {
  const id = effects.colorFilter ?? "none";
  if (id === "none") return [];
  return MAP[id] ?? [];
}
