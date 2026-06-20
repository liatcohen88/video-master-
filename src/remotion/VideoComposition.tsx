/**
 * VideoComposition — the React tree that renders the entire export video.
 *
 * Architecture: one big <AbsoluteFill> with the source video on a base
 * layer, and every effect / overlay stacks on top as a sibling layer.
 * Remotion's frame-driven model means each frame React re-renders with the
 * exact same logic the live preview uses — guaranteeing parity.
 *
 * Layers (back to front):
 *   1. Source <Video> with optional CSS filter (drama / wow / colorFilter / cinematic)
 *   2. <SubtitleLayer> — current spoken line with style + animation
 *   3. <EmojiLayer> — contextual + manual emoji overlays
 *   4. (future) brand logos, custom logos, Lottie
 *   5. (future) bg music as <Audio>
 *
 * Time mapping: useCurrentFrame() returns the frame index; we divide by fps
 * to get the seconds-into-video that match `subtitle.start` / `effect.time`
 * exactly as the live preview understands them.
 */

import { AbsoluteFill, OffthreadVideo, Audio, Img, Sequence, useCurrentFrame, useVideoConfig, interpolate, delayRender, continueRender, staticFile } from "remotion";
import { appleEmojiUrl, twemojiUrl } from "../lib/twemoji";
import { useEffect, useState } from "react";
import { Lottie } from "@remotion/lottie";
import { LOTTIE_ICONS } from "../lib/lottieRegistry";
import type { Subtitle, SubtitleStyle, VideoEffects } from "../lib/types";
import { ASPECT_RATIO_INFO } from "../lib/types";
import { detectDramaMoments, dramaActiveAt, detectWowMoments, wowActiveAt } from "../lib/dramaEffects";
import { colorFilterCss } from "../lib/colorFilters";
import { detectElements, type ElementEvent } from "../lib/keywordElements";
import { detectBeatDrops, beatDropZoomAt } from "../lib/wowEffects";
import { introFrameAt } from "../lib/introAnimations";
import { detectBrands, brandLogoCdnUrl } from "../lib/brandLogos";
import { getSfxAsset, DEFAULT_SFX_FOR_KIND } from "../lib/sfxLibrary";
import { resolveRemotionFont } from "./remotionFonts";
import { resolveAnimation, type SubtitleAnimationType } from "../lib/subtitleAnimations";

/**
 * Frame-based reimplementation of the subtitle entrance @keyframes (see
 * globals.css: sub-fade, sub-pop, sub-bounce, sub-slide, sub-zoom-burst,
 * sub-wave). CSS keyframe
 * animations are wall-clock and don't capture in Remotion's frame render,
 * so we reproduce each animation's transform+opacity curve from the time
 * since the subtitle appeared (localT seconds). Stops/values mirror the
 * CSS percentages × the cssAnimation duration so the export motion matches
 * the live preview.
 */
function subtitleEntrance(
  animType: SubtitleAnimationType | undefined,
  index: number,
  localT: number,
): { transform: string; opacity: number } {
  const id = resolveAnimation(animType ?? "none", index).id;
  const ms = localT * 1000;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  // piecewise-linear interpolation over keyframe stops (ms) → values
  const seg = (stops: number[], vals: number[]): number => {
    if (ms <= stops[0]) return vals[0];
    for (let i = 1; i < stops.length; i++) {
      if (ms <= stops[i]) {
        const f = (ms - stops[i - 1]) / (stops[i] - stops[i - 1]);
        return vals[i - 1] + (vals[i] - vals[i - 1]) * f;
      }
    }
    return vals[vals.length - 1];
  };
  switch (id) {
    case "pop": // 0%→45%→100% over 320ms: scale .8→1.08→1
      return { transform: `scale(${seg([0, 144, 320], [0.8, 1.08, 1])})`, opacity: seg([0, 144, 320], [0, 1, 1]) };
    case "bounce": // 0/28/52/80/100% over 500ms: scale .6→1.15→.9→1.05→1
      return { transform: `scale(${seg([0, 140, 260, 400, 500], [0.6, 1.15, 0.9, 1.05, 1])})`, opacity: seg([0, 140], [0, 1]) };
    case "slide-up": { const p = clamp01(ms / 350); return { transform: `translateY(${40 * (1 - p)}%) scale(${0.95 + 0.05 * p})`, opacity: p }; }
    case "slide-left": { const p = clamp01(ms / 350); return { transform: `translateX(${-40 * (1 - p)}%) scale(${0.95 + 0.05 * p})`, opacity: p }; }
    case "slide-right": { const p = clamp01(ms / 350); return { transform: `translateX(${40 * (1 - p)}%) scale(${0.95 + 0.05 * p})`, opacity: p }; }
    case "zoom-burst": { const p = clamp01(ms / 400); return { transform: `scale(${1.5 - 0.5 * p})`, opacity: p }; }
    case "wave": // 0/25/50/75/100% over 600ms: scaleX/Y wiggle
      return {
        transform: `scaleX(${seg([0, 150, 300, 450, 600], [0.95, 1.05, 0.98, 1.02, 1])}) scaleY(${seg([0, 150, 300, 450, 600], [1.05, 0.95, 1.02, 0.98, 1])})`,
        opacity: seg([0, 150], [0, 1]),
      };
    case "none":
    default: // sub-fade: opacity 0→1 over 200ms
      return { transform: "none", opacity: clamp01(ms / 200) };
  }
}

/**
 * Resolve a public asset URL for the Remotion renderer. SFX/bg-music URLs
 * from our libs are root-relative ("/sfx/sfx_888.mp3"). The headless
 * renderer only serves files that the bundler KNOWS are referenced — and
 * it learns that from staticFile() calls at build time. A raw "/sfx/..."
 * string is invisible to the bundler, so the file isn't copied into the
 * bundle and the render 404s (file not found under the webpack bundle
 * dir). Wrapping in staticFile() (leading slash stripped) registers it.
 * Absolute http(s) URLs (CDN bg-music) pass through.
 */
function remotionAsset(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("blob:")) return null; // browser-only, un-fetchable server-side → would 404 the job
  if (url.startsWith("data:")) return url;  // inlined upload, pass through
  if (/^[a-z]+:\/\//i.test(url)) return url; // already absolute (http/https)
  return staticFile(url.replace(/^\//, ""));
}

function buildSfxTriggers(
  subtitles: Subtitle[],
  effects: VideoEffects | null,
): Array<{ time: number; url: string; gain: number }> {
  if (!effects) return [];
  const triggers: Array<{ time: number; url: string; gain: number }> = [];
  const gain = 0.6 * (effects.sfxMasterVolume ?? 1);
  const disabled = new Set(effects.disabledElements ?? []);
  const sfxOverrides = effects.elementSfxOverrides ?? {};

  if (effects.contextualElements && effects.contextualSfx) {
    for (const ev of detectElements(subtitles)) {
      const key = `${ev.category.id}-${Math.round(ev.time * 10)}`;
      if (disabled.has(key)) continue;
      const ov = sfxOverrides[key];
      if (ov === "none") continue;
      const sfxId = ov ?? DEFAULT_SFX_FOR_KIND[ev.category.sfx];
      const url = getSfxAsset(sfxId)?.url;
      if (url) triggers.push({ time: ev.time, url, gain });
    }
  }
  for (const sub of subtitles) {
    if (sub.sfxId && sub.sfxId !== "none") {
      const url = getSfxAsset(sub.sfxId)?.url;
      if (url) triggers.push({ time: sub.start, url, gain });
    }
    for (const em of sub.manualEmojis ?? []) {
      if (!em.sfxId || em.sfxId === "none") continue;
      const url = getSfxAsset(em.sfxId)?.url;
      if (url) triggers.push({ time: sub.start, url, gain });
    }
  }
  for (const lot of effects.lottieElements ?? []) {
    if (!lot.sfxId || lot.sfxId === "none") continue;
    const url = getSfxAsset(lot.sfxId)?.url;
    if (url) triggers.push({ time: lot.time, url, gain });
  }
  for (const logo of effects.customLogos ?? []) {
    if (logo.persistent !== false || typeof logo.time !== "number") continue;
    if (!logo.sfxId || logo.sfxId === "none") continue;
    const url = getSfxAsset(logo.sfxId)?.url;
    if (url) triggers.push({ time: logo.time, url, gain });
  }
  if ((effects.brandLogosDetect ?? true) && effects.brandSfxId !== "none") {
    const sfxId = effects.brandSfxId ?? DEFAULT_SFX_FOR_KIND.whoosh;
    const url = getSfxAsset(sfxId)?.url;
    if (url) {
      for (const ev of detectBrands(subtitles)) {
        triggers.push({ time: ev.time, url, gain });
      }
    }
  }
  return triggers;
}

/**
 * Wrap @remotion/lottie to fetch JSON from a public/lottie/*.json path
 * via Remotion's static-file resolver. delayRender pauses the frame
 * until the JSON loads — required when bridging async work into a
 * frame-driven render.
 */
function LottieIconRender({
  iconId, size, color: _color,
}: {
  iconId: string;
  size: number;
  color?: string;
}) {
  const icon = LOTTIE_ICONS.find((l) => l.id === iconId);
  const [data, setData] = useState<unknown | null>(null);
  const [handle] = useState(() => delayRender(`lottie-${iconId}`));

  useEffect(() => {
    if (!icon) {
      continueRender(handle);
      return;
    }
    fetch(staticFile(icon.jsonPath.replace(/^\//, "")))
      .then((r) => r.json())
      .then((j) => {
        setData(j);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [icon, handle]);

  if (!icon || !data) return null;
  return (
    <Lottie
      // @ts-expect-error animationData type is loose; runtime accepts the parsed JSON.
      animationData={data}
      style={{ width: size, height: size }}
    />
  );
}

// Mirrors ElementOverlay in VideoPreview.tsx — % anchors are the same so
// the emoji lands in the identical visual slot.
const EMOJI_POS: Record<string, { left: string; top: string }> = {
  "top-right":    { left: "78%", top: "20%" },
  "top-left":     { left: "22%", top: "20%" },
  "bottom-right": { left: "78%", top: "75%" },
  "bottom-left":  { left: "22%", top: "75%" },
  "top-center":   { left: "50%", top: "15%" },
};

function buildEmojiEvents(subtitles: Subtitle[], effects: VideoEffects | null): ElementEvent[] {
  const out: ElementEvent[] = [];
  if (effects?.contextualElements) {
    const disabled = new Set(effects.disabledElements ?? []);
    const overrides = effects.elementOverrides ?? {};
    const posOverrides = effects.elementPositionOverrides ?? {};
    const sizePx = effects.elementSizePx ?? {};
    for (const ev of detectElements(subtitles)) {
      const key = `${ev.category.id}-${Math.round(ev.time * 10)}`;
      if (disabled.has(key)) continue;
      const cat = { ...ev.category };
      if (overrides[key]) cat.emoji = overrides[key];
      if (posOverrides[key]) cat.position = posOverrides[key];
      // Size slider (px) → scale vs the 108px base (10% of a 1080-tall frame)
      // so the auto-element size set in the editor actually applies to export.
      const px = sizePx[key];
      out.push({ ...ev, category: cat, scale: typeof px === "number" && px > 0 ? px / 108 : undefined });
    }
  }
  for (const sub of subtitles) {
    for (const me of sub.manualEmojis ?? []) {
      if (me.lottieIconId) continue; // Lottie path handled separately later
      out.push({
        time: sub.start,
        durationSec: me.durationSec ?? Math.max(0.6, sub.end - sub.start),
        matchedText: "",
        scale: me.scale,
        category: {
          id: `manual-${sub.id}-${me.emoji}`,
          emoji: me.emoji,
          sfx: "ding",
          patterns: [],
          position: me.position,
          previewBg: "from-fuchsia-500 to-purple-700",
        },
      });
    }
  }
  return out;
}

/** Emoji as an Apple image, with a Twemoji fallback if the Apple glyph is
 *  missing. onError swaps the src instead of cancelling the render. */
function EmojiImg({ emoji, size }: { emoji: string; size: number }) {
  const [src, setSrc] = useState(appleEmojiUrl(emoji));
  return (
    <Img
      src={src}
      onError={() => { const t = twemojiUrl(emoji); setSrc((cur) => (cur === t ? cur : t)); }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "block",
        filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.7))",
      }}
    />
  );
}

export type CompositionProps = {
  /** Absolute file path or http(s) URL of the source video. */
  videoSrc: string;
  subtitles: Subtitle[];
  style: SubtitleStyle | null;
  effects: VideoEffects | null;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
};

export function VideoComposition({
  videoSrc, subtitles, style, effects, width, height, durationSec,
}: CompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const progress = durationSec > 0 ? t / durationSec : 0;

  // Crop/framing parity with VideoPreview (VideoPreview.tsx:288-311,760-761).
  // The preview uses object-fit cover only when a specific aspect crop is
  // chosen (else contain), and positions the crop via cropFocus/faceCenter.
  // The export canvas is already sized to the chosen aspect by the route,
  // so we mirror the SAME object-fit + object-position here.
  const aspectInfo = ASPECT_RATIO_INFO[effects?.aspectRatio ?? "original"];
  const hasAspect = !!aspectInfo && aspectInfo.width !== null && aspectInfo.height !== null;
  const videoObjectFit: "cover" | "contain" = hasAspect ? "cover" : "contain";
  const videoObjectPosition = (() => {
    if (!hasAspect) return "center";
    if (effects?.faceCenterX !== undefined && effects?.faceCenterY !== undefined) {
      return `${Math.round(effects.faceCenterX * 100)}% ${Math.round(effects.faceCenterY * 100)}%`;
    }
    if (effects?.cropFocus === "top") return "center top";
    if (effects?.cropFocus === "bottom") return "center bottom";
    return "center center";
  })();

  // --- Zoom / Ken Burns / Punch ----------------------------------------
  // Mirrors VideoPreview's zoom logic exactly. Beat-drop pulses always
  // add on top so the wow feature stands alone even when zoomEffect=none.
  // Beat drops are shared between zoom pulse, particle burst, and shake —
  // detect once when any of them is on.
  const wantsDrops = !!(effects?.beatDropZoom || effects?.particleBurst || effects?.punchShake);
  const beatDrops = wantsDrops ? detectBeatDrops(subtitles) : [];
  const activeDrop = beatDrops.find((d) => t >= d.t && t < d.t + 0.7);
  // Tiny screen-shake when a drop is active. Frame-driven: damped sine over
  // 220ms so the wiggle decays even if multiple drops chain together.
  const shakeT = (activeDrop && effects?.punchShake) ? t - activeDrop.t : -1;
  const shakeX = shakeT >= 0 && shakeT < 0.22
    ? Math.sin(shakeT * 80) * 2 * (1 - shakeT / 0.22)
    : 0;
  const shakeY = shakeT >= 0 && shakeT < 0.22
    ? Math.cos(shakeT * 90) * 1.5 * (1 - shakeT / 0.22)
    : 0;
  const emphasisMoments: number[] = effects?.emphasisMoments ?? [];
  const zoomScale = (() => {
    const beat = beatDropZoomAt(t, beatDrops);
    if (!effects || effects.zoomEffect === "none") return 1 + beat;
    if (effects.zoomEffect === "punch") {
      const rampIn = 0.15, hold = 0.4, rampOut = 0.3;
      const peak = effects.zoomIntensity ?? 0.05;
      let add = 0;
      for (const m of emphasisMoments) {
        if (t >= m - rampIn && t < m) add += peak * (t - (m - rampIn)) / rampIn;
        else if (t >= m && t < m + hold) add += peak;
        else if (t >= m + hold && t < m + hold + rampOut) add += peak * ((m + hold + rampOut) - t) / rampOut;
      }
      return 1 + add + beat;
    }
    // subtle / kenburns: linear ramp over the whole clip
    return 1 + (effects.zoomIntensity ?? 0.05) * progress + beat;
  })();
  const panX = effects?.zoomEffect === "kenburns" ? Math.sin(progress * Math.PI) * 4 : 0;
  const panY = effects?.zoomEffect === "kenburns" ? Math.cos(progress * Math.PI) * 2 : 0;
  // Intro animation — applies only in the first ~500-900ms. Composes into
  // the same transform chain by MULTIPLYING the scale and ADDING translate.
  const intro = introFrameAt(t, effects?.introAnimation);
  const finalScale = zoomScale * intro.scaleMul;
  const finalPanX = panX + intro.translateX;
  const finalPanY = panY + intro.translateY;
  const videoTransform = (finalScale !== 1 || finalPanX !== 0 || finalPanY !== 0 || intro.rotate)
    ? `scale(${finalScale}) translate(${finalPanX}%, ${finalPanY}%) rotate(${intro.rotate}deg)`
    : undefined;

  // Same drama/wow detection the live preview uses — re-running it here is
  // cheap (just regex over subtitle text) and guarantees identical hits.
  const dramaMoments = effects?.dramaMode ? detectDramaMoments(subtitles) : [];
  const wowMoments   = effects?.dramaMode ? detectWowMoments(subtitles)   : [];
  const activeDrama  = effects?.dramaMode ? dramaActiveAt(t, dramaMoments) : null;
  const activeWow    = effects?.dramaMode ? wowActiveAt(t, wowMoments)     : null;

  // Filter chain mirrors VideoPreview line-for-line. Drama beats wow beats
  // the default color stack — same precedence as the live preview.
  // WOW intentionally has NO color/filter change — matches the live
  // preview after Liat's 2026-06-17 ask. WOW visuals come purely from
  // particles + shake + zoom in the layers below; the color stack stays
  // neutral when WOW fires.
  const videoFilter = activeDrama
    ? "grayscale(1) contrast(1.25) brightness(0.96)"
    : ([
        colorFilterCss(effects?.colorFilter),
        effects?.cinematicColor ? "contrast(1.08) saturate(1.16) brightness(1.02) sepia(0.06)" : "",
      ].filter(Boolean).join(" ") || undefined);
  void activeWow;

  // Active subtitle = the one whose window contains the current time. Same
  // findIndex pattern as VideoPreview so a frame on the boundary picks the
  // same line in both engines.
  const currentSub = subtitles.find((s) => t >= s.start && t <= s.end);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0b16",
        transform: (shakeX || shakeY) ? `translate(${shakeX}px, ${shakeY}px)` : undefined,
      }}
    >
      {/* Base video layer — Studio renders without a video while we
          iterate on overlay parity; production renders always supply src. */}
      {videoSrc ? (
        <OffthreadVideo
          // OffthreadVideo extracts frames server-side via FFmpeg instead of
          // relying on Chromium's <video> decoder. The headless-shell
          // Chromium has NO H.264 codec, so <Video> hung forever at frame 0
          // ("delayRender Rendering <Html5Video> ... not cleared after
          // 118000ms"). OffthreadVideo bypasses that entirely and is the
          // production-recommended component anyway.
          // Wrap relative paths in staticFile() so Remotion resolves them
          // against the bundle's internal http server (publicDir), not the
          // page's window.location which points at the Next.js app (3000).
          src={/^[a-z]+:\/\//i.test(videoSrc) ? videoSrc : staticFile(videoSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: videoObjectFit,
            objectPosition: videoObjectPosition,
            filter: [videoFilter, intro.extraFilter].filter(Boolean).join(" ") || undefined,
            transform: videoTransform,
            transformOrigin: "center center",
            opacity: intro.opacity,
            clipPath: intro.clipPath,
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(135deg,#1a1430 0%,#3a1a4a 50%,#1a1430 100%)",
            filter: videoFilter,
            transform: videoTransform,
            transformOrigin: "center center",
          }}
        />
      )}

      {/* SFX audio mix — each trigger is its own <Sequence> at the right
          frame so Remotion plays it once at that timeline position. Cap
          duration at ~3.5s so a long sample doesn't drag past its moment. */}
      {buildSfxTriggers(subtitles, effects).map((trig, i) => {
        const src = remotionAsset(trig.url);
        if (!src) return null;
        const fromFrame = Math.max(0, Math.round(trig.time * fps));
        const maxFrames = Math.round(3.5 * fps);
        return (
          <Sequence key={`sfx-${i}`} from={fromFrame} durationInFrames={maxFrames}>
            <Audio src={src} volume={trig.gain} />
          </Sequence>
        );
      })}

      {/* Intro SFX — fires at t=0 alongside the intro animation. */}
      {effects?.introSfxId && effects.introSfxId !== "none" && (() => {
        const src = remotionAsset(getSfxAsset(effects.introSfxId)?.url);
        return src ? <Audio src={src} volume={effects.sfxMasterVolume ?? 1} /> : null;
      })()}

      {/* Background music — mixed UNDER the source video's own audio at
          the user-set volume. Remotion auto-handles audio mixing in the
          final MP4 so we don't need an FFmpeg pass. remotionAsset() returns
          null for a dead/blob: URL so a stale music ref can't 404 the job. */}
      {(() => {
        const src = remotionAsset(effects?.bgMusicUrl);
        return src ? (
          <Audio src={src} volume={effects?.bgMusicVolume ?? 0.3} />
        ) : null;
      })()}

      {/* Intro overlay layer — flash white / fade from black / etc. Sits
          ABOVE the video so the color fully covers the frame. Returns
          opacity 0 once the intro window is over so it stops painting. */}
      {intro.overlayBg && (intro.overlayOpacity ?? 0) > 0 && (
        <AbsoluteFill
          style={{
            background: intro.overlayBg,
            opacity: intro.overlayOpacity,
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {/* WOW particle burst — 10 sparkles fly outward from the subtitle
          band when a beat drop is active. Frame-driven (no CSS keyframes
          needed) so it works identically in Studio preview and headless
          Chromium export. Mirrors WowOverlay.Burst from VideoPreview. */}
      {effects?.particleBurst && activeDrop && (() => {
        const local = t - activeDrop.t;
        const phase = Math.min(1, local / 0.62);
        const N = 10;
        // Position the burst origin where the subtitle text sits — same
        // 72% vertical anchor as the live preview.
        const originX = width / 2;
        const originY = height * 0.72;
        return (
          <AbsoluteFill style={{ pointerEvents: "none", zIndex: 8 }}>
            {Array.from({ length: N }).map((_, i) => {
              const angle = (i / N) * Math.PI * 2;
              const dx = Math.cos(angle) * 110 * phase;
              const dy = Math.sin(angle) * 110 * phase;
              const hue = (i * 36) % 360;
              // Match Burst's keyframes: opacity ramps in fast then fades.
              const opacity = phase < 0.1
                ? phase / 0.1
                : Math.max(0, 1 - (phase - 0.1) / 0.9);
              const scale = phase < 0.1
                ? 0.4 + (phase / 0.1) * (1.4 - 0.4)
                : 1.4 - (phase - 0.1) * 0.7;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${originX + dx}px`,
                    top: `${originY + dy}px`,
                    width: 6,
                    height: 6,
                    borderRadius: 9999,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    background: `hsl(${hue} 95% 65%)`,
                    boxShadow: `0 0 8px hsl(${hue} 95% 65%)`,
                    opacity,
                  }}
                />
              );
            })}
          </AbsoluteFill>
        );
      })()}

      {/* Brand logos — auto-detected from speech ("Apple", "Nike", etc.).
          Pulled as SVG from Iconify CDN (brandLogoCdnUrl). Stacked in the
          top-right corner with a small offset per occurrence to avoid
          overlap. Each shows for ~brand.durationSec from its trigger time. */}
      {effects?.contextualElements && effects.brandLogosDetect !== false && (() => {
        const brands = detectBrands(subtitles);
        const margin = 8; // % from edge
        const transparentBg = effects.transparentLogoBg ?? false;
        return brands
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => t >= b.time && t < b.time + b.durationSec)
          .map(({ b, i }) => {
            const sizeKey = `${b.brand.id}-${Math.round(b.time * 10)}`;
            const sizeOverride = effects.brandSizePx?.[sizeKey];
            const posOverride = effects.brandPosition?.[sizeKey];
            // sizeOverride is 1920-reference px (preview scales by H/1920) —
            // scale to this canvas's height so 1:1 doesn't render it oversized.
            const logoSize = typeof sizeOverride === "number" && sizeOverride > 0
              ? Math.max(16, sizeOverride * (height / 1920))
              : Math.max(64, height * 0.14);
            const pad = logoSize * 0.18;
            const corner: React.CSSProperties = (() => {
              if (!posOverride) {
                return { top: `${10 + i * 12}%`, right: `${8 + i * 4}%` };
              }
              switch (posOverride) {
                case "top-right":     return { top: `${margin}%`, right: `${margin}%` };
                case "top-left":      return { top: `${margin}%`, left: `${margin}%` };
                case "top-center":    return { top: `${margin}%`, left: "50%", transform: "translateX(-50%)" };
                case "bottom-right":  return { bottom: `${margin}%`, right: `${margin}%` };
                case "bottom-left":   return { bottom: `${margin}%`, left: `${margin}%` };
                case "bottom-center": return { bottom: `${margin}%`, left: "50%", transform: "translateX(-50%)" };
                default:              return { top: `${margin}%`, right: `${margin}%` };
              }
            })();
            const containerStyle: React.CSSProperties = transparentBg
              ? {
                  padding: 0,
                  background: "transparent",
                  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))",
                  display: "flex",
                  alignItems: "center",
                  gap: `${pad * 0.7}px`,
                }
              : {
                  background: "rgba(255,255,255,0.96)",
                  padding: `${pad}px ${pad * 1.4}px`,
                  borderRadius: `${pad * 0.7}px`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: `${pad * 0.7}px`,
                };
            return (
              <div
                key={`brand-${b.brand.id}-${b.time}`}
                style={{
                  position: "absolute",
                  ...corner,
                  zIndex: 9,
                  pointerEvents: "none",
                }}
              >
                <div style={containerStyle}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandLogoCdnUrl(b.brand)}
                    alt={b.brand.name}
                    width={logoSize}
                    height={logoSize}
                    style={{ display: "block", width: logoSize, height: logoSize }}
                  />
                </div>
              </div>
            );
          });
      })()}

      {/* Custom logos — user-uploaded watermarks. Persistent ones show
          throughout, timed ones only inside their window. URL must be
          absolute (http(s) or data:) so headless Chromium can fetch it. */}
      {(effects?.customLogos ?? [])
        // Safety net: a blob: URL can't be fetched by the headless render
        // (the client converts these to data: URLs before export, but skip
        // any that slip through so one bad logo doesn't 404 the whole job).
        .filter((logo) => typeof logo.src === "string" && !logo.src.startsWith("blob:"))
        .filter((logo) => {
          if (logo.persistent ?? true) return true;
          const t0 = logo.time ?? 0;
          const dur = logo.durationSec ?? 0;
          return t >= t0 && t < t0 + dur;
        })
        .map((logo, i) => {
          const margin = Math.max(8, height * 0.025);
          const corner: React.CSSProperties = (() => {
            switch (logo.position) {
              case "top-right":    return { top: margin, right: margin };
              case "top-left":     return { top: margin, left: margin };
              case "bottom-right": return { bottom: margin, right: margin };
              case "bottom-left":  return { bottom: margin, left: margin };
              default:             return { top: margin, right: margin };
            }
          })();
          const sizeScale = logo.size === "S" ? 0.07 : logo.size === "L" ? 0.14 : 0.10;
          // sizePx is authored against a 1920-tall reference (the preview scales
          // it by containerHeight/1920). The export canvas height varies by
          // aspect (1080 for 1:1, 1920 for 9:16, …), so scale sizePx by
          // height/1920 too — otherwise a 1:1 export renders the logo 1.78×
          // too big vs the preview (Liat: "לוגו בצד לא אותו גודל").
          const size = typeof logo.sizePx === "number" && logo.sizePx > 0
            ? Math.max(8, logo.sizePx * (height / 1920))
            : Math.max(40, height * sizeScale);
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`logo-${i}`}
              src={logo.src}
              alt={logo.name || "logo"}
              style={{
                position: "absolute",
                ...corner,
                width: `${size}px`,
                height: "auto",
                opacity: 0.9,
                pointerEvents: "none",
                zIndex: 7,
              }}
            />
          );
        })}

      {/* Lottie animated icons — two sources:
            1. effects.lottieElements (standalone, legacy EffectsPanel)
            2. subtitle.manualEmojis with lottieIconId (newer editor)
          Each renders the animation at the per-occurrence position. */}
      {(() => {
        const items: Array<{
          iconId: string;
          time: number;
          durationSec: number;
          position: keyof typeof EMOJI_POS;
          color?: string;
        }> = [
          ...(effects?.lottieElements ?? []).map((l) => ({
            iconId: l.iconId,
            time: l.time,
            durationSec: l.durationSec ?? 2,
            position: (l.position ?? "top-right") as keyof typeof EMOJI_POS,
            color: l.color,
          })),
          ...subtitles.flatMap((sub) =>
            (sub.manualEmojis ?? [])
              .filter((m) => m.lottieIconId)
              .map((m) => ({
                iconId: m.lottieIconId!,
                time: sub.start,
                durationSec: m.durationSec ?? 2,
                position: m.position as keyof typeof EMOJI_POS,
                color: m.color,
              })),
          ),
        ];
        return items
          .filter((it) => t >= it.time && t < it.time + it.durationSec)
          .map((it, i) => {
            const pos = EMOJI_POS[it.position] ?? EMOJI_POS["top-right"];
            const size = Math.max(80, height * 0.18);
            return (
              <div
                key={`lottie-${i}-${it.time}`}
                style={{
                  position: "absolute",
                  left: pos.left,
                  top: pos.top,
                  transform: "translate(-50%, -50%)",
                  width: size,
                  height: size,
                  zIndex: 10,
                  pointerEvents: "none",
                  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))",
                }}
              >
                <LottieIconRender iconId={it.iconId} size={size} color={it.color} />
              </div>
            );
          });
      })()}

      {/* Emoji overlay layer — contextual (auto-detected) + manual emojis
          added by the user in the subtitle editor. Visible window logic
          and position % match VideoPreview.ElementOverlay exactly so the
          emoji appears at the same on-screen spot the user sees live. */}
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 10 }}>
        {buildEmojiEvents(subtitles, effects)
          .filter((el) => t >= el.time && t < el.time + el.durationSec)
          .map((el) => {
            const pos = EMOJI_POS[el.category.position] ?? EMOJI_POS["top-center"];
            const size = Math.max(40, height * 0.10 * (el.scale ?? 1));
            // Entry pop: scale 0 → 1.15 → 1 in first 320ms, then hold.
            const localT = t - el.time;
            const scale = localT < 0.32
              ? interpolate(localT, [0, 0.18, 0.32], [0, 1.15, 1], { extrapolateRight: "clamp" })
              : 1;
            const opacity = interpolate(localT, [0, 0.18], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={`${el.category.id}-${el.time}`}
                style={{
                  position: "absolute",
                  left: pos.left,
                  top: pos.top,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  opacity,
                  lineHeight: 1,
                }}
              >
                {/* Apple emoji image — identical to the editor preview,
                    regardless of host OS. Falls back to Twemoji if missing. */}
                <EmojiImg emoji={el.category.emoji} size={size} />
              </div>
            );
          })}
      </AbsoluteFill>

      {/* Subtitle overlay — simplest possible bottom-center text for the
          PoC. Style fields (color, stroke, shadow, font) plugged straight
          from the SubtitleStyle so they match the live preview exactly.
          Full per-word highlight + animation modes come in iteration 2. */}
      {currentSub && style && (() => {
        // 1:1 PORT of VideoPreview.SubtitleOverlay. The preview computes
        // subtitleScale = containerHeight / 1080, so all style values
        // (fontSize, positionOffset, strokeWidth, paddings) are authored in
        // a 1080-tall reference space. The export canvas is `height` tall
        // (1920), so the matching scale is height/1080 (~1.78) — NOT 1.
        // Using raw values made the export subtitle ~1.78× too small and
        // mis-positioned vs the live preview.
        const scale = height / 1080;
        const fontSizePx = style.fontSize * scale;
        const strokePx = style.strokeWidth * scale;
        const offsetPx = style.positionOffset * scale;
        const bgHex = style.backgroundOpacity > 0
          ? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255).toString(16).padStart(2, "0")}`
          : "transparent";

        const words = currentSub.words ?? currentSub.text.split(/\s+/).map((w, i, arr) => {
          const dur = currentSub.end - currentSub.start;
          return {
            word: w,
            start: currentSub.start + (i / arr.length) * dur,
            end: currentSub.start + ((i + 1) / arr.length) * dur,
          };
        });
        const sameColor = style.highlightColor.toLowerCase() === style.color.toLowerCase();
        let activeIdx = -1;
        for (let i = 0; i < words.length; i++) {
          if (t >= words[i].start) activeIdx = i;
        }
        if (activeIdx === -1 && words.length > 0) activeIdx = 0;

        // Entrance animation (frame-based port of the preview CSS keyframes).
        const subIndex = subtitles.indexOf(currentSub);
        const entrance = subtitleEntrance(
          effects?.subtitleAnimation as SubtitleAnimationType | undefined,
          subIndex < 0 ? 0 : subIndex,
          t - currentSub.start,
        );

        return (
          <AbsoluteFill
            style={{
              pointerEvents: "none",
              display: "flex",
              // CRITICAL: AbsoluteFill injects flexDirection:'column' when no
              // flex-row className is present. Column makes justifyContent
              // center on the VERTICAL axis (a no-op here) and leaves
              // horizontal placement to alignItems — so the block was NOT
              // horizontally centered like the preview. Force row so
              // justifyContent:center centers horizontally, exactly like the
              // preview's `flex` (row) wrapper. Do NOT set alignItems.
              flexDirection: "row",
              justifyContent: "center",
              padding: `0 ${24 * scale}px`,
              top: style.position === "top"
                ? `${offsetPx}px`
                : style.position === "middle"
                  ? `calc(50% + ${offsetPx}px)`
                  : "auto",
              bottom: style.position === "bottom" ? `${offsetPx}px` : "auto",
              height: style.position === "middle" ? undefined : "auto",
              transform: style.position === "middle" ? "translateY(-50%)" : undefined,
            }}
          >
            <div
              dir="rtl"
              style={{
                fontFamily: resolveRemotionFont(style.fontFamily),
                fontSize: `${fontSizePx}px`,
                fontWeight: style.fontWeight,
                paintOrder: "stroke fill",
                WebkitTextStroke: strokePx > 0 ? `${strokePx}px ${style.strokeColor}` : undefined,
                background: bgHex,
                padding: style.backgroundOpacity > 0 ? `${8 * scale}px ${18 * scale}px` : "0",
                borderRadius: `${12 * scale}px`,
                textShadow: style.shadow ? `0 ${4 * scale}px ${16 * scale}px rgba(0,0,0,0.85)` : "none",
                display: "inline-block",
                lineHeight: 1.3,
                maxWidth: "92%",
                whiteSpace: "normal",
                textAlign: "center",
                color: style.color,
                transformOrigin: "center center",
                // Frame-based entrance animation (matches the preview's CSS
                // keyframe per the selected subtitleAnimation).
                transform: entrance.transform,
                opacity: entrance.opacity,
              }}
            >
              {words.map((w, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  <span style={{ color: i === activeIdx && !sameColor ? style.highlightColor : style.color }}>
                    {w.word}
                  </span>
                </span>
              ))}
            </div>
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
}
