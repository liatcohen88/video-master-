/**
 * Build the FFmpeg filter graph for a given set of VideoEffects.
 *
 * The pipeline order matters:
 *   1. silenceremove (audio) — drops quiet sections, BEFORE subtitle burning
 *      so we don't desync subtitle timings.  (For MVP we apply silence
 *      cut as a separate pass; combining with subtitles requires re-timing
 *      the subtitles too — Phase 3 work.)
 *   2. crop+scale to target aspect ratio
 *   3. zoompan (Ken Burns) over duration
 *   4. subtitles (ASS burn)
 */

import type { VideoEffects } from "./types";
import { ASPECT_RATIO_INFO } from "./types";

type FilterChain = {
  videoFilters: string[];
  audioFilters: string[];
  outputWidth: number;
  outputHeight: number;
};

/**
 * Color grading look-up table for a subtle cinematic feel:
 * - lift shadows (gamma curve)
 * - warm highlights (eq filter)
 * - slight saturation bump
 *
 * If emphasisMoments provided, also adds a brief brightness/saturation
 * "flash" at each emphasis point — synchronized with the punch zoom.
 */
export function cinematicColorFilter(emphasisMoments: number[] = []): string[] {
  if (emphasisMoments.length === 0) {
    return [
      "eq=contrast=1.06:saturation=1.12:gamma=0.96",
      "curves=preset=increase_contrast",
    ];
  }

  // Build a "pulse" expression that boosts at emphasis moments.
  // Pulse curve: ramp-in 80ms → peak 150ms → ramp-out 250ms
  const rampIn = 0.08;
  const hold = 0.15;
  const rampOut = 0.25;
  const pulse = emphasisMoments
    .map((t) => {
      const a = (t - rampIn).toFixed(3);
      const b = t.toFixed(3);
      const c = (t + hold).toFixed(3);
      const d = (t + hold + rampOut).toFixed(3);
      return (
        `if(between(t,${a},${b}),(t-${a})/${rampIn.toFixed(3)},` +
        `if(between(t,${b},${c}),1,` +
        `if(between(t,${c},${d}),(${d}-t)/${rampOut.toFixed(3)},0)))`
      );
    })
    .join("+");

  const P = `(${pulse})`; // 0..1 envelope
  return [
    // Base cinematic look + emphasis pulse on top
    `eq=` +
      `contrast='1.06+0.18*${P}':` +
      `saturation='1.12+0.20*${P}':` +
      `brightness='0.04*${P}':` +
      `gamma=0.96`,
    "curves=preset=increase_contrast",
  ];
}

/**
 * Build an FFmpeg expression for "whip zoom" — a fast spike at cut boundaries
 * that disguises hard silence-cut transitions. Sharper and shorter than emphasis
 * punches: 100ms ramp-in, no hold, 200ms ramp-out.
 *
 * Returns a 0-centered expression (i.e. ADD to the base 1.0, not multiply).
 * When called with no boundaries, returns "1" so caller's sum stays at +0.
 */
function buildWhipZoomExpr(boundaries: number[], peak: number): string {
  if (boundaries.length === 0 || peak <= 0) return "1";

  const rampIn = 0.1;
  const rampOut = 0.2;
  const P = peak.toFixed(4);
  const ri = rampIn.toFixed(3);
  const ro = rampOut.toFixed(3);

  const terms = boundaries.map((t) => {
    const a = (t - rampIn).toFixed(3); // ramp-in start
    const b = t.toFixed(3); // peak (no hold)
    const d = (t + rampOut).toFixed(3); // ramp-out end
    return (
      `if(between(t,${a},${b}),${P}*(t-${a})/${ri},` +
      `if(between(t,${b},${d}),${P}*(${d}-t)/${ro},0))`
    );
  });

  return `(1+${terms.join("+")})`;
}

/**
 * Build an FFmpeg expression for "punch zoom" — zoom stays at 1.0 most of the
 * time and PUNCHES up to (1+peak) at each emphasis moment, then settles back.
 *
 * Curve per moment: ramp-in (150ms) → hold (400ms) → ramp-out (300ms)
 *
 * Multiple moments are summed; overlapping ones add together but the spacing
 * minimum from emphasis detection (≥1.5s) prevents stacking in practice.
 */
function buildPunchZoomExpr(moments: number[], peak: number): string {
  if (moments.length === 0 || peak <= 0) return "1";

  const rampIn = 0.15;
  const hold = 0.4;
  const rampOut = 0.3;
  const P = peak.toFixed(4);
  const ri = rampIn.toFixed(3);
  const ro = rampOut.toFixed(3);

  const terms = moments.map((t) => {
    const a = (t - rampIn).toFixed(3); // ramp-in start
    const b = t.toFixed(3); // hold start
    const c = (t + hold).toFixed(3); // hold end
    const d = (t + hold + rampOut).toFixed(3); // ramp-out end
    // Piecewise: ramp up → hold → ramp down → 0 outside window
    return (
      `if(between(t,${a},${b}),${P}*(t-${a})/${ri},` +
      `if(between(t,${b},${c}),${P},` +
      `if(between(t,${c},${d}),${P}*(${d}-t)/${ro},0)))`
    );
  });

  return `(1+${terms.join("+")})`;
}

export function buildFilterChain(
  effects: VideoEffects,
  sourceWidth: number,
  sourceHeight: number,
  durationSec: number,
  /** Cut-boundary timestamps (in the OUTPUT timeline, after silence cut).
   *  At each, a brief whip-zoom is added to disguise the jump. */
  cutBoundaries: number[] = [],
): FilterChain {
  const videoFilters: string[] = [];
  const audioFilters: string[] = [];

  // 1. Aspect ratio: crop to target ratio, then scale to standard dims
  const target = ASPECT_RATIO_INFO[effects.aspectRatio];
  let outputWidth = sourceWidth;
  let outputHeight = sourceHeight;

  if (target.width && target.height) {
    const targetRatio = target.width / target.height;
    const sourceRatio = sourceWidth / sourceHeight;

    // Crop the source to match target ratio, then scale.
    let cropW: number;
    let cropH: number;
    if (sourceRatio > targetRatio) {
      // Source is wider — crop horizontally
      cropH = sourceHeight;
      cropW = Math.round(cropH * targetRatio);
    } else {
      // Source is taller — crop vertically
      cropW = sourceWidth;
      cropH = Math.round(cropW / targetRatio);
    }

    // Crop position. We do NOT add an artificial zoom — that was cropping
    // out the speaker. We crop ONLY what's needed to hit the target aspect,
    // and center the window on the detected face (so the speaker stays in
    // frame) or on the geometric center / chosen focus zone otherwise.
    // When source aspect already equals target, cropW/cropH == full frame
    // and nothing is cut — the whole original frame is kept.
    const hasFace = effects.faceCenterX != null && effects.faceCenterY != null;
    let cropX: number;
    let cropY: number;
    if (hasFace) {
      const desiredX = effects.faceCenterX! * sourceWidth - cropW / 2;
      const desiredY = effects.faceCenterY! * sourceHeight - cropH / 2;
      cropX = Math.max(0, Math.min(sourceWidth - cropW, Math.round(desiredX)));
      cropY = Math.max(0, Math.min(sourceHeight - cropH, Math.round(desiredY)));
    } else {
      cropX = Math.round((sourceWidth - cropW) / 2);
      if (effects.cropFocus === "top") cropY = 0;
      else if (effects.cropFocus === "bottom") cropY = sourceHeight - cropH;
      else cropY = Math.round((sourceHeight - cropH) / 2);
    }

    videoFilters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
    videoFilters.push(`scale=${target.width}:${target.height}:flags=lanczos`);
    outputWidth = target.width;
    outputHeight = target.height;
  }

  // 2. Zoom effect.
  // PUNCH ZOOM (new): no continuous interpolation. Zoom stays at 1.0 most of
  // the time and PUNCHES IN at specific emphasis moments. This avoids the
  // jittery "constant drift" feel of linear zoom.
  // The trick that kills sub-pixel scaling artifacts: scale the source UP
  // ONCE to a headroom resolution, then animate ONLY the crop window. The
  // pixel grid stays stable; the crop just moves.
  if (effects.zoomEffect === "punch") {
    const peak = effects.zoomIntensity; // e.g. 0.08
    // Whip transitions are stronger and shorter than emphasis punches.
    // Combine both into one zoom expression. Cap headroom at the max possible.
    const whipPeak = 0.15;
    const maxPossible = Math.max(peak, whipPeak);
    const headroom = 1 + maxPossible + 0.01;
    const moments = effects.emphasisMoments ?? [];
    const punchExpr = buildPunchZoomExpr(moments, peak);
    const whipExpr = buildWhipZoomExpr(cutBoundaries, whipPeak);
    // Sum both contributions (max() would clip; sum makes them stack if overlap)
    const Z =
      cutBoundaries.length > 0
        ? `(${punchExpr}+${whipExpr}-1)`
        : punchExpr;

    // Scale up to headroom resolution (ONCE, not per-frame)
    const scaledW = Math.round(outputWidth * headroom);
    const scaledH = Math.round(outputHeight * headroom);
    videoFilters.push(
      `scale=${scaledW}:${scaledH}:flags=lanczos`,
      // Animated crop: window shrinks symmetrically around center as Z increases.
      // Output dims stay constant (no scaling artifacts during zoom).
      `crop=` +
        `w='${outputWidth}/${Z}':` +
        `h='${outputHeight}/${Z}':` +
        `x='(iw-${outputWidth}/${Z})/2':` +
        `y='(ih-${outputHeight}/${Z})/2'`,
      // Final scale fills output dims smoothly even when crop is non-integer.
      `scale=${outputWidth}:${outputHeight}:flags=bicubic`,
    );
  } else if (effects.zoomEffect === "subtle") {
    // Legacy: kept for users who prefer continuous slow zoom.
    const intensity = effects.zoomIntensity;
    const T = Math.max(0.5, durationSec);
    const Z = `(1+${intensity.toFixed(4)}*t/${T.toFixed(3)})`;
    videoFilters.push(
      `scale=w='iw*${Z}':h='ih*${Z}':eval=frame:flags=lanczos`,
      `crop=${outputWidth}:${outputHeight}:(iw-${outputWidth})/2:(ih-${outputHeight})/2`,
    );
  } else if (effects.zoomEffect === "kenburns") {
    const intensity = effects.zoomIntensity;
    const T = Math.max(0.5, durationSec);
    const Z = `(1+${intensity.toFixed(4)}*t/${T.toFixed(3)})`;
    videoFilters.push(
      `scale=w='iw*${Z}':h='ih*${Z}':eval=frame:flags=lanczos`,
      `crop=${outputWidth}:${outputHeight}:` +
        `(iw-${outputWidth})/2 + sin(t/${T.toFixed(3)}*PI)*iw*0.04:` +
        `(ih-${outputHeight})/2 + cos(t/${T.toFixed(3)}*PI)*ih*0.02`,
    );
  }

  // 3. Silence removal — DISABLED in this iteration.
  // Reason: silenceremove only trims audio. Without ALSO cutting matching video
  // segments AND re-timing the subtitles, you get audio-video desync. Doing it
  // properly needs a 2-pass pipeline (silencedetect → segment selection → subtitle
  // retiming). Planned for Phase 3. The preview still simulates it visually.
  void effects.cutSilence;

  return {
    videoFilters,
    audioFilters,
    outputWidth,
    outputHeight,
  };
}
