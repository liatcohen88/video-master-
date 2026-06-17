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

import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { Subtitle, SubtitleStyle, VideoEffects } from "../lib/types";
import { detectDramaMoments, dramaActiveAt, detectWowMoments, wowActiveAt } from "../lib/dramaEffects";
import { colorFilterCss } from "../lib/colorFilters";
import { detectElements, type ElementEvent } from "../lib/keywordElements";
import { detectBeatDrops, beatDropZoomAt } from "../lib/wowEffects";

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
    for (const ev of detectElements(subtitles)) {
      const key = `${ev.category.id}-${Math.round(ev.time * 10)}`;
      if (disabled.has(key)) continue;
      const cat = { ...ev.category };
      if (overrides[key]) cat.emoji = overrides[key];
      if (posOverrides[key]) cat.position = posOverrides[key];
      out.push({ ...ev, category: cat });
    }
  }
  for (const sub of subtitles) {
    for (const me of sub.manualEmojis ?? []) {
      if (me.lottieIconId) continue; // Lottie path handled separately later
      out.push({
        time: sub.start,
        durationSec: me.durationSec ?? Math.max(0.6, sub.end - sub.start),
        matchedText: "",
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

  // --- Zoom / Ken Burns / Punch ----------------------------------------
  // Mirrors VideoPreview's zoom logic exactly. Beat-drop pulses always
  // add on top so the wow feature stands alone even when zoomEffect=none.
  const beatDrops = effects?.beatDropZoom ? detectBeatDrops(subtitles) : [];
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
  const videoTransform = (zoomScale !== 1 || panX !== 0 || panY !== 0)
    ? `scale(${zoomScale}) translate(${panX}%, ${panY}%)`
    : undefined;

  // Same drama/wow detection the live preview uses — re-running it here is
  // cheap (just regex over subtitle text) and guarantees identical hits.
  const dramaMoments = effects?.dramaMode ? detectDramaMoments(subtitles) : [];
  const wowMoments   = effects?.dramaMode ? detectWowMoments(subtitles)   : [];
  const activeDrama  = effects?.dramaMode ? dramaActiveAt(t, dramaMoments) : null;
  const activeWow    = effects?.dramaMode ? wowActiveAt(t, wowMoments)     : null;

  // Filter chain mirrors VideoPreview line-for-line. Drama beats wow beats
  // the default color stack — same precedence as the live preview.
  const videoFilter = activeDrama
    ? "grayscale(1) contrast(1.25) brightness(0.96)"
    : activeWow
      ? "saturate(1.45) contrast(1.12) brightness(1.04) sepia(0.08)"
      : ([
          colorFilterCss(effects?.colorFilter),
          effects?.cinematicColor ? "contrast(1.08) saturate(1.16) brightness(1.02) sepia(0.06)" : "",
        ].filter(Boolean).join(" ") || undefined);

  // Active subtitle = the one whose window contains the current time. Same
  // findIndex pattern as VideoPreview so a frame on the boundary picks the
  // same line in both engines.
  const currentSub = subtitles.find((s) => t >= s.start && t <= s.end);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b16" }}>
      {/* Base video layer — Studio renders without a video while we
          iterate on overlay parity; production renders always supply src. */}
      {videoSrc ? (
        <Video
          src={videoSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: videoFilter,
            transform: videoTransform,
            transformOrigin: "center center",
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

      {/* Emoji overlay layer — contextual (auto-detected) + manual emojis
          added by the user in the subtitle editor. Visible window logic
          and position % match VideoPreview.ElementOverlay exactly so the
          emoji appears at the same on-screen spot the user sees live. */}
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 10 }}>
        {buildEmojiEvents(subtitles, effects)
          .filter((el) => t >= el.time && t < el.time + el.durationSec)
          .map((el) => {
            const pos = EMOJI_POS[el.category.position] ?? EMOJI_POS["top-center"];
            const size = Math.max(40, height * 0.10);
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
                  fontSize: `${size}px`,
                  lineHeight: 1,
                  textShadow: "0 4px 24px rgba(0,0,0,0.7)",
                }}
              >
                {el.category.emoji}
              </div>
            );
          })}
      </AbsoluteFill>

      {/* Subtitle overlay — simplest possible bottom-center text for the
          PoC. Style fields (color, stroke, shadow, font) plugged straight
          from the SubtitleStyle so they match the live preview exactly.
          Full per-word highlight + animation modes come in iteration 2. */}
      {currentSub && style && (() => {
        // Mirror VideoPreview's vertical anchoring: `position` picks one of
        // three bands, `positionOffset` (-50..50) nudges within the band.
        const offsetPx = (style.positionOffset / 100) * height * 0.4;
        const anchor = style.position === "top"
          ? { top: `${Math.round(height * 0.08 + offsetPx)}px` }
          : style.position === "middle"
            ? { top: "50%", transform: "translate(-50%, -50%)" as const }
            : { bottom: `${Math.round(height * 0.08 - offsetPx)}px` };
        return (
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            <div
              dir="rtl"
              style={{
                position: "absolute",
                left: "50%",
                ...(style.position === "middle"
                  ? {}
                  : { transform: "translateX(-50%)" }),
                ...anchor,
                width: `${Math.round(width * 0.92)}px`,
                textAlign: style.textAlign,
                whiteSpace: "normal",
                wordBreak: "keep-all",
                fontFamily: style.fontFamily,
                fontWeight: style.fontWeight,
                fontSize: `${style.fontSize}px`,
                color: style.color,
                background: style.backgroundOpacity > 0
                  ? `rgba(0,0,0,${style.backgroundOpacity})`
                  : "transparent",
                padding: style.backgroundOpacity > 0 ? "0.3em 0.6em" : 0,
                borderRadius: 12,
                WebkitTextStroke: style.strokeWidth > 0
                  ? `${style.strokeWidth}px ${style.strokeColor}`
                  : undefined,
                paintOrder: "stroke fill",
                textShadow: style.shadow ? "0 4px 14px rgba(0,0,0,0.7)" : "none",
                lineHeight: 1.2,
              }}
            >
              {(() => {
                // Per-word highlight — exact same algorithm as
                // VideoPreview.SubtitleOverlay: the active word is the LAST
                // word whose start has passed. Auto-split if the AI didn't
                // give us per-word timings (rare, but mirrors live behavior).
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
                return words.map((w, i) => (
                  <span key={i}>
                    {i > 0 && " "}
                    <span
                      style={{
                        color: i === activeIdx && !sameColor ? style.highlightColor : style.color,
                      }}
                    >
                      {w.word}
                    </span>
                  </span>
                ));
              })()}
            </div>
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
}
