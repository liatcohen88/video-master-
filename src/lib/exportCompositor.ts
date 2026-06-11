/**
 * Export compositor — builds the list of timed PNG overlays that reproduce
 * the live preview, plus the FFmpeg overlay filter chain to burn them.
 *
 * Everything the user sees in the browser becomes a PNG here:
 *   - subtitles (canvas, per-word highlight, real Hebrew fonts)
 *   - emojis (twemoji, full color)
 *   - brand logos (simpleicons card, enlarged + centered)
 *   - custom logos (user watermark)
 *
 * The route feeds these PNGs to FFmpeg as inputs and chains overlay filters.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Subtitle, SubtitleStyle, VideoEffects } from "./types";
import { renderOverlayTrackMov, type TrackEmoji, type TrackBrand } from "./overlayRenderer";
import { getEmojiPng } from "./assetCache";
import { detectElements } from "./keywordElements";
import { detectBrands } from "./brandLogos";
import { prepareBrandCards } from "./brandLogoCache";
import { renderLottieToMov } from "./lottieRenderer";
import { LOTTIE_ICONS } from "./lottieRegistry";

export type TimedOverlay = {
  /** Absolute path to the PNG to overlay */
  pngPath: string;
  /** FFmpeg overlay x expression (in OUTPUT pixels). May reference overlay_w. */
  x: string;
  y: string;
  /** Start time (output timeline). */
  start: number;
  /** End time, or null for "until end of video". */
  end: number | null;
};

/** A Lottie animation overlay — a transparent MOV played during a window. */
export type LottieOverlay = {
  movPath: string;
  x: string;
  y: string;
  start: number;
  end: number;
};

const POS_RATIO: Record<string, { x: number; y: number }> = {
  "top-right": { x: 0.78, y: 0.20 },
  "top-left": { x: 0.22, y: 0.20 },
  "bottom-right": { x: 0.78, y: 0.75 },
  "bottom-left": { x: 0.22, y: 0.75 },
  "top-center": { x: 0.5, y: 0.12 },
};

/**
 * Build all overlays for a render. Subtitles + emoji + brand cards are baked
 * into ONE transparent overlay-track MOV (fast). Custom logos stay as PNG
 * overlays; Lottie stay as their own MOVs.
 */
export async function buildExportOverlays(opts: {
  workDir: string;
  subtitles: Subtitle[];
  style: SubtitleStyle;
  effects: VideoEffects;
  outputWidth: number;
  outputHeight: number;
  durationSec: number;
  ffmpegPath: string;
}): Promise<{ trackMov: string | null; pngOverlays: TimedOverlay[]; lottieOverlays: LottieOverlay[] }> {
  const { workDir, subtitles, style, effects, outputWidth, outputHeight, durationSec, ffmpegPath } = opts;
  await mkdir(workDir, { recursive: true });
  const overlays: TimedOverlay[] = [];
  const lottieOverlays: LottieOverlay[] = [];

  // ── Collect emoji + brand placements for the overlay track ───────────
  const trackEmoji: TrackEmoji[] = [];
  const trackBrand: TrackBrand[] = [];

  if (effects.contextualElements) {
    const overridesEmoji = effects.elementOverrides ?? {};
    const overridesPos = effects.elementPositionOverrides ?? {};
    const overridesPxPerEl = effects.elementSizePx ?? {};
    const overridesPosPerEl = effects.elementPosition ?? {};
    const disabled = new Set(effects.disabledElements ?? []);
    const baseEmojiSize = Math.round(outputHeight * 0.10);

    const detected = detectElements(subtitles);
    for (const el of detected) {
      const key = `${el.category.id}-${Math.round(el.time * 10)}`;
      if (disabled.has(key)) continue;
      const emoji = overridesEmoji[key] ?? el.category.emoji;
      // Per-element overrides (Liat's tap-to-edit popover): position from
      // the new map first, then fall back to the legacy overridesPos, then
      // category default.
      const pos = overridesPosPerEl[key] ?? overridesPos[key] ?? el.category.position;
      const px = overridesPxPerEl[key];
      const emojiSize = typeof px === "number" && px > 0
        ? Math.max(16, Math.min(px, outputHeight))
        : baseEmojiSize;
      const png = await getEmojiPng(emoji, emojiSize).catch(() => null);
      if (!png) continue;
      const r = POS_RATIO[pos] ?? POS_RATIO["top-right"];
      trackEmoji.push({
        pngPath: png, size: emojiSize,
        cx: Math.round(r.x * outputWidth), cy: Math.round(r.y * outputHeight),
        start: el.time, end: el.time + el.durationSec,
      });
    }
    for (const sub of subtitles) {
      if (!sub.manualEmojis) continue;
      for (const me of sub.manualEmojis) {
        const png = await getEmojiPng(me.emoji, emojiSize).catch(() => null);
        if (!png) continue;
        const r = POS_RATIO[me.position] ?? POS_RATIO["top-right"];
        trackEmoji.push({
          pngPath: png, size: emojiSize,
          cx: Math.round(r.x * outputWidth), cy: Math.round(r.y * outputHeight),
          start: sub.start, end: Math.max(sub.end, sub.start + 0.6),
        });
      }
    }

    // Brand cards (capped size, centered upper area). Respect Liat's
    // brand-logo toggle — if she turned it off, skip the detect entirely.
    const brands = effects.brandLogosDetect === false ? [] : detectBrands(subtitles);
    if (brands.length > 0) {
      const sharp = (await import("sharp")).default;
      const cardHeight = Math.round(outputHeight * 0.10);
      const maxW = Math.round(outputWidth * 0.55);
      const defaultMaxH = Math.round(outputHeight * 0.12);
      const cards = await prepareBrandCards(brands, cardHeight, effects.transparentLogoBg ?? false);
      const brandPxMap = effects.brandSizePx ?? {};
      const brandPosMap = effects.brandPosition ?? {};
      let bi = 0;
      for (const b of brands) {
        const card = cards.get(b.brand.id);
        if (!card) continue;
        const bKey = `${b.brand.id}-${Math.round(b.time * 10)}`;
        // Per-occurrence size override (matches the popover in
        // AiDetectedPanel). When set, use it as the bounding HEIGHT —
        // width follows the card's natural aspect ratio.
        const pxOverride = brandPxMap[bKey];
        const targetMaxH = typeof pxOverride === "number" && pxOverride > 0
          ? Math.max(16, Math.min(pxOverride, outputHeight))
          : defaultMaxH;
        const scale = Math.min(maxW / card.width, targetMaxH / card.height, 1);
        const w = Math.max(1, Math.round(card.width * scale));
        const h = Math.max(1, Math.round(card.height * scale));
        const fitted = join(workDir, `brand-${bi++}.png`);
        try { await sharp(card.path).resize(w, h, { fit: "fill" }).png().toFile(fitted); }
        catch { continue; }
        // Position override — default keeps the centered-upper layout.
        const margin = Math.round(outputHeight * 0.08);
        const posOverride = brandPosMap[bKey];
        let bx: number, by: number;
        switch (posOverride) {
          case "top-left":      bx = margin;                       by = margin; break;
          case "top-right":     bx = outputWidth - w - margin;     by = margin; break;
          case "top-center":    bx = Math.round((outputWidth - w) / 2); by = margin; break;
          case "bottom-left":   bx = margin;                       by = outputHeight - h - margin; break;
          case "bottom-right":  bx = outputWidth - w - margin;     by = outputHeight - h - margin; break;
          case "bottom-center": bx = Math.round((outputWidth - w) / 2); by = outputHeight - h - margin; break;
          default:
            bx = Math.round((outputWidth - w) / 2);
            by = Math.round(outputHeight * 0.10);
        }
        trackBrand.push({
          pngPath: fitted, w, h, x: bx, y: by,
          start: b.time, end: b.time + b.durationSec,
        });
      }
    }
  }

  // ── Bake subtitles + emoji + brand into ONE overlay-track MOV ─────────
  const trackMov = await renderOverlayTrackMov({
    workDir, subtitles, style,
    emojis: trackEmoji, brands: trackBrand,
    videoWidth: outputWidth, videoHeight: outputHeight,
    durationSec, ffmpegPath,
  });

  // ── Custom logos (user watermark) — kept as PNG overlays ─────────────
  for (const logo of effects.customLogos ?? []) {
    // logo.src is a public URL like /custom-logos/xxx.png → resolve to disk
    const rel = logo.src.replace(/^\//, "");
    const pngPath = join(process.cwd(), "public", rel);
    const sizeScale = logo.size === "S" ? 0.07 : logo.size === "L" ? 0.14 : 0.10;
    // Exact-px size overrides the S/M/L scale. Clamped to a sane min and to
    // outputHeight so users can't request a logo larger than the canvas.
    const target = typeof logo.sizePx === "number" && logo.sizePx > 0
      ? Math.max(8, Math.min(logo.sizePx, outputHeight))
      : Math.round(outputHeight * sizeScale);
    // Resize the logo to a temp PNG so overlay dims are predictable
    const sized = join(workDir, `logo-${overlays.length}.png`);
    try {
      const sharp = (await import("sharp")).default;
      await sharp(pngPath)
        .resize(target, target, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(sized);
    } catch {
      continue; // logo file missing — skip
    }
    const m = Math.round(outputHeight * 0.025);
    let x: string, y: string;
    switch (logo.position) {
      case "top-left":     x = `${m}`; y = `${m}`; break;
      case "bottom-right": x = `main_w-overlay_w-${m}`; y = `main_h-overlay_h-${m}`; break;
      case "bottom-left":  x = `${m}`; y = `main_h-overlay_h-${m}`; break;
      default:             x = `main_w-overlay_w-${m}`; y = `${m}`; // top-right
    }
    const persistent = logo.persistent ?? true;
    overlays.push({
      pngPath: sized,
      x, y,
      start: persistent ? 0 : (logo.time ?? 0),
      end: persistent ? null : (logo.time ?? 0) + (logo.durationSec ?? 2),
    });
  }

  // ── 5. Lottie animated icons → transparent MOV overlays ──────────────
  // TWO sources:
  //  (a) effects.lottieElements   — legacy standalone picker (still works)
  //  (b) subtitles[].manualEmojis — new per-word picker added 2026-06-07
  //      (each manualEmoji entry where `lottieIconId` is set IS a lottie,
  //      not an emoji — fired at that subtitle's start)
  type LottieSpec = {
    iconId: string;
    time: number;
    durationSec: number;
    position: NonNullable<VideoEffects["lottieElements"]>[number]["position"];
    color?: string;
    sizeRatio?: number;
  };
  const allLottie: LottieSpec[] = [
    ...(effects.lottieElements ?? []),
    ...subtitles.flatMap((sub) =>
      (sub.manualEmojis ?? [])
        .filter((m) => m.lottieIconId)
        .map<LottieSpec>((m) => ({
          iconId: m.lottieIconId!,
          time: sub.start,
          durationSec: m.durationSec ?? 2,
          position: m.position,
          color: m.color,
          sizeRatio: 0.2,
        })),
    ),
  ];

  for (const lot of allLottie) {
    const icon = LOTTIE_ICONS.find((i) => i.id === lot.iconId);
    if (!icon) continue;
    const sizeRatio = lot.sizeRatio ?? 0.18;
    const size = Math.round(outputHeight * sizeRatio);
    try {
      const res = await renderLottieToMov({
        jsonPath: icon.jsonPath,
        id: `${icon.id}-${lot.color ? lot.color.replace("#", "") : "orig"}`,
        size,
        durationSec: Math.max(0.5, lot.durationSec),
        color: lot.color,
      });
      if (!res) continue;
      const r = POS_RATIO[lot.position] ?? POS_RATIO["top-right"];
      lottieOverlays.push({
        movPath: res.movPath,
        x: `${Math.round(r.x * outputWidth)}-overlay_w/2`,
        y: `${Math.round(r.y * outputHeight)}-overlay_h/2`,
        start: lot.time,
        end: lot.time + lot.durationSec,
      });
    } catch {
      // Lottie render failed → skip silently (export never breaks)
    }
  }

  return { trackMov, pngOverlays: overlays, lottieOverlays };
}

/**
 * Build the FFmpeg filter_complex chain that overlays all PNGs onto the base
 * video stream `[baseLabel]`, returning the new chain parts and final label.
 *
 * Each overlay input is referenced as `[<inputIndexStart + i>:v]`.
 */
export function buildOverlayFilterChain(
  overlays: TimedOverlay[],
  baseLabel: string,
  inputIndexStart: number,
): { parts: string[]; finalLabel: string } {
  const parts: string[] = [];
  let prev = baseLabel;
  overlays.forEach((ov, i) => {
    const inIdx = inputIndexStart + i;
    const next = `ov${i}`;
    const enable =
      ov.end === null
        ? `gte(t,${ov.start.toFixed(3)})`
        : `between(t,${ov.start.toFixed(3)},${ov.end.toFixed(3)})`;
    parts.push(
      `[${prev}][${inIdx}:v]overlay=x='${ov.x}':y='${ov.y}':enable='${enable}':format=auto[${next}]`,
    );
    prev = next;
  });
  return { parts, finalLabel: prev };
}
