/**
 * Generate an Advanced SubStation Alpha (.ass) subtitle file.
 * libass (used by FFmpeg's `subtitles` filter) burns this into the video
 * with full styling: fonts, colors, outlines, backgrounds, positions.
 *
 * For word-by-word highlighting we use ASS karaoke tags (\k) combined with
 * mid-line color overrides (\1c) — same trick captions.ai/submagic use.
 */

import type { Subtitle, SubtitleStyle } from "./types";
import { resolveAnimation, type SubtitleAnimationType } from "./subtitleAnimations";
import type { ElementEvent } from "./keywordElements";

// ASS uses BGR (not RGB) hex with leading "&H00" alpha and trailing "&"
// e.g. white #FFFFFF -> &H00FFFFFF&  ; red #FF0000 -> &H000000FF&
function toAssColor(hex: string, alpha = 0): string {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  const a = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `&H${a}${b}${g}${r}&`.toUpperCase();
}

function secToAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec - Math.floor(sec)) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

// ASS alignment numpad: 7=top-left, 8=top-center, 9=top-right
// 4=mid-left, 5=mid-center, 6=mid-right
// 1=bot-left, 2=bot-center, 3=bot-right
function alignmentFor(
  position: SubtitleStyle["position"],
  textAlign: SubtitleStyle["textAlign"],
): number {
  const col = textAlign === "left" ? 1 : textAlign === "right" ? 3 : 2;
  if (position === "top") return 6 + col;     // 7|8|9
  if (position === "middle") return 3 + col;  // 4|5|6
  return col;                                  // 1|2|3
}

type AssRenderOpts = {
  videoWidth: number;
  videoHeight: number;
  style: SubtitleStyle;
  subtitles: Subtitle[];
  /**
   * Whether to emit per-word color highlighting via inline color overrides.
   * Set to false for a simpler "all one color" subtitle.
   */
  perWordHighlight: boolean;
  /** Entrance animation type — see subtitleAnimations.ts */
  animation?: SubtitleAnimationType;
  /**
   * Emphasis moments (in OUTPUT timeline). Subtitles whose start lands within
   * 0.4s of any emphasis moment get a stronger entrance animation.
   */
  emphasisMoments?: number[];
  /**
   * Contextual graphic elements (emoji popups) overlaid at keyword timestamps.
   * Already re-timed to the output timeline before being passed here.
   */
  elements?: ElementEvent[];
};

// Bidi markers — force RTL paragraph direction so libass lays words right-to-left.
// Without these the {\1c...} override codes (which are LTR-strong) flip the
// paragraph direction to LTR and Hebrew words appear in reversed order.
const RLM = "‏"; // Right-to-Left Mark (strong RTL char, sets paragraph direction)
const RLE = "‫"; // Right-to-Left Embedding (opens RTL embed scope)
const PDF = "‬"; // Pop Directional Formatting (closes embed)
// Defense-in-depth: RLM at start guarantees first strong char is RTL,
// even if libass strips RLE before paragraph direction is decided.
const RTL_PREFIX = RLM + RLE;
const RTL_SUFFIX = PDF + RLM;

export function generateAss(opts: AssRenderOpts): string {
  const {
    videoWidth, videoHeight, style, subtitles, perWordHighlight,
    animation = "none", emphasisMoments = [], elements = [],
  } = opts;

  // Helper: a subtitle is "on emphasis" if it starts within 0.4s of any peak.
  const isEmphasisSub = (subStart: number) =>
    emphasisMoments.some((m) => Math.abs(subStart - m) < 0.4);

  const isSameHighlight =
    style.highlightColor.toLowerCase() === style.color.toLowerCase();

  // The style is designed for 1080p. Scale to actual output resolution.
  const scale = videoHeight / 1080;
  const fontSize = Math.round(style.fontSize * scale);
  const outlineWidth = Math.max(0, Math.round(style.strokeWidth * scale * 0.5));
  const marginV = Math.round(style.positionOffset * scale);

  const primaryColor = toAssColor(style.color);
  const outlineColor = toAssColor(style.strokeColor);
  const backColor = toAssColor(
    style.backgroundColor,
    Math.round((1 - style.backgroundOpacity) * 255),
  );
  const highlightColor = toAssColor(style.highlightColor);

  const alignment = alignmentFor(style.position, style.textAlign);

  // BorderStyle 1=outline+shadow, 3=opaque box behind text
  const borderStyle = style.backgroundOpacity > 0 ? 3 : 1;
  const shadow = style.shadow ? 2 : 0;

  // ASS header
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${fontSize},${primaryColor},${primaryColor},${outlineColor},${backColor},${style.fontWeight >= 700 ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${shadow},${alignment},40,40,${marginV},1
Style: Element,Segoe UI Emoji,${Math.round(110 * scale)},&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&H80000000&,0,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(3 * scale))},${Math.max(2, Math.round(3 * scale))},5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Events
  const events: string[] = [];
  let subIndex = 0;

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;

    // Word-by-word highlighting in burned MP4 requires override codes
    // ({\1c...}, \k) which create LTR-strong characters that confuse
    // libass/fribidi bidi detection — Hebrew words flip to LTR order.
    //
    // After multiple attempts with bidi markers (RLM/RLE/PDF), we now use the
    // most robust approach: ONE plain Dialogue per subtitle with NO override
    // codes mid-line. Single style color throughout. Stable RTL guaranteed.
    //
    // The live preview in the browser still shows word-by-word highlighting
    // (HTML/CSS handles bidi correctly). This trade-off applies only to the
    // exported MP4 file.
    //
    // perWordHighlight is intentionally ignored here. Word-level animation in
    // the burned video is a planned Phase-4 feature using a different pipeline
    // (per-word PNG overlays composited with FFmpeg).
    void perWordHighlight;
    void isSameHighlight;

    const start = secToAssTime(sub.start);
    const end = secToAssTime(sub.end);
    const onEmphasis = isEmphasisSub(sub.start);

    // Resolve the animation for this subtitle (auto-mix varies per index)
    const animDef = resolveAnimation(animation, subIndex);
    const animIntro = animDef.assIntro(onEmphasis);
    const fadeIn = onEmphasis ? 40 : 80;
    const intro = `\\fad(${fadeIn},120)${animIntro}`;

    const text = `${RTL_PREFIX}{${intro}}${sub.text}${RTL_SUFFIX}`;
    events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
    subIndex++;
  }

  // --- Element overlays (emoji popups at keyword timestamps) ---------------
  // Each element is a separate Dialogue using the Element style at a
  // configurable screen position. Pop-in animation (scale 30% → 130% → 100%)
  // gives a satisfying "punch".
  for (const el of elements) {
    const start = secToAssTime(el.time);
    const end = secToAssTime(el.time + el.durationSec);
    const { x, y } = elementPosition(el.category.position, videoWidth, videoHeight);
    // Stable entrance: scale 50% → 100% in 300ms. No overshoot, no bounce.
    // After the transition the emoji stays still at scale(100).
    const intro =
      `\\an5\\pos(${x},${y})\\fad(80,180)` +
      `\\fscx50\\fscy50\\t(0,300,\\fscx100\\fscy100)`;
    events.push(
      `Dialogue: 5,${start},${end},Element,,0,0,0,,{${intro}}${el.category.emoji}`,
    );
  }

  return header + events.join("\n") + "\n";
}

/** Map element category position to (x, y) pixel coords for ASS \pos.
 *  All positions are EDGE-only to avoid covering the speaker's face. */
function elementPosition(
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center",
  w: number,
  h: number,
): { x: number; y: number } {
  switch (position) {
    case "top-right":    return { x: Math.round(w * 0.78), y: Math.round(h * 0.20) };
    case "top-left":     return { x: Math.round(w * 0.22), y: Math.round(h * 0.20) };
    case "bottom-right": return { x: Math.round(w * 0.78), y: Math.round(h * 0.75) };
    case "bottom-left":  return { x: Math.round(w * 0.22), y: Math.round(h * 0.75) };
    case "top-center":   return { x: Math.round(w / 2),    y: Math.round(h * 0.15) };
  }
}

// Inline color (used inside override blocks) — no leading "&H00" alpha
function assColorInline(hex: string): string {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `&H${b}${g}${r}&`.toUpperCase();
}
