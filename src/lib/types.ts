export type EditMode = "subtitles_only" | "basic_effects" | "podcast" | "advanced_effects";

export type AspectRatio = "original" | "9:16" | "1:1" | "16:9" | "4:5";

export type VideoEffects = {
  aspectRatio: AspectRatio;
  cutSilence: boolean;
  silenceThresholdDb: number; // -50 = quiet, -30 = louder threshold
  silenceMinDurationSec: number;
  zoomEffect: "none" | "subtle" | "kenburns" | "punch";
  zoomIntensity: number; // 0.0 - 0.3 (extra zoom multiplier)
  cropFocus: "center" | "top" | "bottom"; // where to focus the crop
  /**
   * Face-aware crop coordinates (0..1 ratios of source dimensions).
   * When set, FFmpeg crop centers on these instead of the geometric center,
   * keeping the speaker in frame for vertical reframes.
   * Filled in by /api/analyze (MediaPipe).
   */
  faceCenterX?: number;
  faceCenterY?: number;
  /** Cinematic color grading (warm highlights, lift shadows, +saturation) */
  cinematicColor?: boolean;
  /** Preset color filter applied to the whole video. CSS-only in preview;
   *  burned with FFmpeg vf chain at export. "none" = passthrough. */
  colorFilter?: "none" | "sunset" | "cyberpunk" | "vhs" | "y2k" | "mono" | "vivid";
  /** Drama Mode — when the speaker says a "can't believe this" line
   *  ("אני לא מאמין" / "זה לא קורה לי" / "אין מצב"), the video flashes
   *  to B&W for ~1.2s and a dramatic sting plays. Israeli reels trope. */
  dramaMode?: boolean;
  /** Intro animation — plays once in the first ~500-900ms. See
   *  introAnimations.ts for the curve per preset. */
  introAnimation?:
    | "none" | "punchZoom" | "shake" | "dropZoom" | "whipPan"
    | "bounceIn" | "flashWhite" | "irisOpen" | "slideUp" | "fadeIn";
  /** Sound effect to play in sync with the intro animation. "none" mutes,
   *  undefined = no sound. Plays at t=0 alongside the visual intro. */
  introSfxId?: string;
  /** Background music — overlay audio mixed under the video's own audio. */
  bgMusicUrl?: string;
  /** Background music gain 0..1. Defaults to 0.25 (gentle bed). */
  bgMusicVolume?: number;
  /** Video's own-audio gain 0..1. Defaults to 1.0. */
  videoVolume?: number;
  /** Master gain applied to ALL sound effects (auto-elements, manual emojis,
   *  intro SFX, logo SFX, Lottie SFX) so the user can balance speech vs SFX
   *  with one knob. Defaults to 1.0. */
  sfxMasterVolume?: number;
  /** Timestamps (sec) where punch zooms should fire — from analysis */
  emphasisMoments?: number[];
  /** Beat-drop zoom — punch in ~3% on power-words ("וואו", "אש", "חייבים"...).
   *  Detected from the speech transcript; rendered as a short scale-up
   *  (~250ms) around the spoken word in the preview + burned in export.
   *  Only meaningful when the mode allows zoom (caps.faceZoom). */
  beatDropZoom?: boolean;
  /** Particle Burst — short sparkle/confetti pulse on the same power-words.
   *  Pure overlay (no video math), so it works in every mode. */
  particleBurst?: boolean;
  /** Punch-shake — micro screen shake on detected impact moments
   *  (SFX boom / cha-ching). Subtle, ~120ms, looks cinematic. */
  punchShake?: boolean;
  /** Subtitle entrance animation — see subtitleAnimations.ts */
  subtitleAnimation?:
    | "none" | "pop" | "bounce" | "slide-up" | "slide-left"
    | "slide-right" | "zoom-burst" | "wave" | "auto-mix";
  /** Auto-add emoji elements + matching SFX at keyword timestamps */
  contextualElements?: boolean;
  /** Auto-overlay brand logos when speaker mentions known brands (Amazon,
   *  AliExpress, Apple…). Default true — undefined treated as on for
   *  back-compat. Independent of contextualElements so user can turn brand
   *  logos off without losing emoji auto-detect. */
  brandLogosDetect?: boolean;
  /** Per-brand-occurrence size in px. Key = "<brandId>-<round(time*10)>" so
   *  each appearance of the same brand can be tuned independently. */
  brandSizePx?: Record<string, number>;
  /** Per-brand-occurrence position override. Default position is upper-right. */
  brandPosition?: Record<string,
    "top-right" | "top-left" | "bottom-right" | "bottom-left"
    | "top-center" | "bottom-center"
  >;
  /** Per-AI-element size in px (matches the emoji-element key from
   *  AiDetectedPanel: "<categoryId>-<round(time*10)>"). */
  elementSizePx?: Record<string, number>;
  /** Per-AI-element position override. */
  elementPosition?: Record<string,
    "top-right" | "top-left" | "bottom-right" | "bottom-left"
    | "top-center" | "bottom-center"
  >;
  /**
   * User overrides for detected element emojis. Key = element key
   * ("<categoryId>-<roundedTime>"), value = custom emoji string.
   * Lets the user swap "⚡" → "💎" etc.
   */
  elementOverrides?: Record<string, string>;
  /**
   * Element keys the user has disabled (X-ed out). These auto-detected
   * elements will be hidden from preview AND export.
   */
  disabledElements?: string[];
  /**
   * Per-element position overrides. Key = element key, value = position.
   * Lets the user move a "top-right" emoji to "top-left" etc.
   */
  elementPositionOverrides?: Record<
    string,
    "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center"
  >;
  /**
   * Per-element SFX overrides. Key = same `elementKey()` used above,
   * value = sfx asset id from sfxLibrary.ts. Use "none" to mute the
   * SFX for this single occurrence without disabling the visual emoji.
   * Unset → use the keyword category's default (DEFAULT_SFX_FOR_KIND).
   */
  elementSfxOverrides?: Record<string, string>;
  /**
   * Render brand logos as floating logo+text WITHOUT the white card behind.
   * Useful when the brand color doesn't pop against speaker's clothing.
   */
  transparentLogoBg?: boolean;
  /**
   * User-uploaded custom logos. By default each is a PERSISTENT watermark
   * shown the whole video in a corner — like a brand badge. If `persistent`
   * is false, the logo only shows from `time` for `durationSec` seconds.
   */
  customLogos?: Array<{
    /** Current src in use (either original or background-removed) */
    src: string;
    /** The originally-uploaded file URL — kept so we can revert */
    srcOriginal?: string;
    /** Cached background-removed version — built on first toggle */
    srcTransparent?: string;
    /** Display name (optional) */
    name?: string;
    /** Always-on watermark (true) or timed appearance (false). Default true. */
    persistent?: boolean;
    /** Start time in OUTPUT timeline, used only when persistent=false */
    time?: number;
    /** Duration on screen, used only when persistent=false */
    durationSec?: number;
    /** Branding corners only — top-center removed (looks weird for a watermark) */
    position: "top-right" | "top-left" | "bottom-right" | "bottom-left";
    /** Show with a white card behind (false) or float transparent (true) */
    transparent: boolean;
    /** Visual size on screen: S=small (~7%), M=medium (~10%), L=large (~14%) */
    size?: "S" | "M" | "L";
    /** Exact pixel height of the logo. When set, overrides `size`. Lets the
     *  user dial in a precise size like "24px" instead of S/M/L only. */
    sizePx?: number;
    /** SFX asset id played at appearance time. "none" mutes. Unset = no SFX. */
    sfxId?: string;
  }>;
  /** Mix SFX audio at element timestamps (requires contextualElements) */
  contextualSfx?: boolean;
  /**
   * Animated Lottie icons placed by the user (or AI). Each renders animated in
   * the live preview (lottie-react) AND in the exported MP4 (server-side
   * rasterized to a transparent MOV — all free, see lottieRenderer.ts).
   */
  lottieElements?: Array<{
    /** registry id (lottieRegistry.ts) */
    iconId: string;
    /** Start time in seconds (output timeline) */
    time: number;
    /** Seconds on screen */
    durationSec: number;
    position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
    /** Optional tint color override (#RRGGBB) */
    color?: string;
    /** Size as fraction of video height (default 0.18) */
    sizeRatio?: number;
    /** SFX asset id played at appearance time. "none" mutes. Unset = no SFX. */
    sfxId?: string;
  }>;
  /**
   * Background depth (parallax). Cuts out the speaker via MediaPipe Selfie
   * Segmentation and places elements/text BETWEEN the speaker and a blurred
   * copy of the background. Adds 30-60s of preprocessing per render.
   */
  backgroundDepth?: boolean;
  /**
   * When depth is on, this picks the BACKGROUND look:
   *   "original" = blurred original video (default)
   *   "sunset" / "cyber" / "bokeh" / "wave" / "particles" / "mesh-gradient"
   * = animated generated patterns that replace the background entirely.
   */
  backgroundPattern?:
    | "original" | "sunset" | "cyber" | "bokeh" | "wave"
    | "particles" | "mesh-gradient";
};

/** Output shape of /api/analyze (MediaPipe-based) */
export type VideoAnalysis = {
  face_detected: boolean;
  face_center_x: number;
  face_center_y: number;
  face_size_ratio: number;
  face_detection_rate: number;
  is_talking_head: boolean;
  duration_sec: number;
  video_width: number;
  video_height: number;
  video_aspect: "horizontal" | "vertical" | "square";
  recommended_aspect: AspectRatio;
  recommended_mode: EditMode;
  recommended_template: string;
  emphasis_moments?: number[];
};

export const DEFAULT_EFFECTS: VideoEffects = {
  aspectRatio: "original",
  cutSilence: false,
  silenceThresholdDb: -35,
  silenceMinDurationSec: 0.6,
  zoomEffect: "none",
  zoomIntensity: 0.05,
  cropFocus: "center",
  cinematicColor: false,
  // Default ON — every video should benefit from brand/keyword detection
  contextualElements: true,
  // SFX defaults on too — synthesized cheaply by FFmpeg, gives big WOW
  contextualSfx: true,
};

// Effects defaults per editing mode
export const MODE_DEFAULT_EFFECTS: Record<EditMode, VideoEffects> = {
  // Subtitles-only mode: ONLY transcription + subtitle styling. The mode
  // card promises "בלי אפקטים/אמוג'ים/סאונד". Default-true contextual flags
  // were leaking in via the spread — user saw רכב emoji + sound on a
  // "subtitles-only" video. Explicit `false` everywhere fixes that.
  subtitles_only: {
    ...DEFAULT_EFFECTS,
    contextualElements: false,
    contextualSfx: false,
    brandLogosDetect: false,
    cutSilence: false,
    zoomEffect: "none",
    cinematicColor: false,
    beatDropZoom: false,
    particleBurst: false,
    punchShake: false,
    dramaMode: false,
    introAnimation: "none",
    colorFilter: "none",
  },
  basic_effects: {
    ...DEFAULT_EFFECTS,
    cutSilence: true,
    zoomEffect: "subtle",
    zoomIntensity: 0.05,
    cinematicColor: true,
    contextualElements: true,
    contextualSfx: true,
  },
  // Podcast (20 מאסטרים — fixed): match the mode-card bullets exactly:
  // חיתוך 9:16/1:1/16:9, תמלול+אנימציה, חיתוך אוטומטי של שתיקות, לוגו אישי,
  // סאונד אפקט, אמוג'י/איקונים, צבע, אנימציית כניסה, מוזיקת רקע.
  // NO face zoom, NO WOW effects — those belong to "advanced".
  podcast: {
    ...DEFAULT_EFFECTS,
    aspectRatio: "original",       // ratio chooser exposed; default keeps full frame
    cutSilence: true,
    zoomEffect: "none",
    cinematicColor: true,
    subtitleAnimation: "pop",
    contextualElements: true,      // אמוג'י/איקונים — auto-suggest
    contextualSfx: true,           // סאונד אפקט — auto
    brandLogosDetect: true,
    introAnimation: "fadeIn",      // אנימציית כניסה
    // bgMusic — user uploads manually, no default
    // WOW + drama OFF for podcast (advanced-only)
    beatDropZoom: false,
    particleBurst: false,
    punchShake: false,
    dramaMode: false,
    colorFilter: "none",
  },
  // Advanced (25–40 מאסטרים, dynamic): GIVES ACCESS to every effect, but
  // Liat: "המקסימום זה 40 אם ישתמש ברוב האפקטים" — start with a sensible
  // baseline (face zoom, basic auto-detect, color, intro). User opts in
  // to the heavy WOW pack one effect at a time, each lifting cost via
  // calcDynamicCost. Reaches the 40 cap only when most are on.
  advanced_effects: {
    ...DEFAULT_EFFECTS,
    aspectRatio: "original",
    cutSilence: true,
    zoomEffect: "punch",           // זיהוי פנים + זום אוטומטי — the headline feature
    cinematicColor: true,
    subtitleAnimation: "auto-mix",
    contextualElements: true,
    contextualSfx: true,
    brandLogosDetect: true,
    introAnimation: "fadeIn",      // gentle default — user upgrades to punchZoom/shake
    backgroundDepth: false,
    // WOW pack OFF by default — user opts in, each one costs +2 credits.
    // This matches Liat's vision: starting cost low (~25-27), reaches 40
    // only when most WOW toggles are also on.
    beatDropZoom: false,
    particleBurst: false,
    punchShake: false,
    dramaMode: false,
    colorFilter: "none",
  },
};

export const ASPECT_RATIO_INFO: Record<AspectRatio, {
  label: string;
  description: string;
  width: number | null;
  height: number | null;
}> = {
  original: { label: "מקורי", description: "אותו יחס כמו הוידאו", width: null, height: null },
  "9:16": { label: "9:16", description: "אנכי - רילס/טיקטוק/שורטס", width: 1080, height: 1920 },
  "1:1": { label: "1:1", description: "ריבועי - אינסטה/פייסבוק", width: 1080, height: 1080 },
  "16:9": { label: "16:9", description: "אופקי - יוטיוב/לפטופ", width: 1920, height: 1080 },
  "4:5": { label: "4:5", description: "פיד אינסטגרם", width: 1080, height: 1350 },
};

export type ExportFormat = "mp4" | "srt";

export type SubtitlePosition = "top" | "middle" | "bottom";

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  backgroundOpacity: number;
  position: SubtitlePosition;
  positionOffset: number;
  textAlign: "right" | "center" | "left";
  highlightColor: string;
  shadow: boolean;
};

export type SubtitleSettings = {
  maxWordsPerLine: number;
  minWordsPerLine: number;
  addPunctuation: boolean;
  stretchSubtitles: boolean;
};

export type Subtitle = {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
  /** Sound effect to play at this subtitle's start — without needing an
   *  emoji or Lottie attached. "none" mutes, undefined = no SFX. */
  sfxId?: string;
  /** Manually-added emojis attached to this subtitle by the user */
  manualEmojis?: Array<{
    /** Emoji character (for emoji-type) OR empty for lottie-type */
    emoji: string;
    /** If set → this is a Lottie animation (registry id), emoji is ignored */
    lottieIconId?: string;
    /** Optional tint color for the lottie (#RRGGBB) */
    color?: string;
    position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
    /** How many seconds the element stays on screen. Default 0.9 (emoji) / 2 (lottie) */
    durationSec?: number;
    /** SFX asset id played at the subtitle start. "none" mutes. Unset = no SFX. */
    sfxId?: string;
  }>;
};

export type Project = {
  id: string;
  videoFile: File | null;
  videoUrl: string | null;
  videoDuration: number;
  mode: EditMode;
  exportFormat: ExportFormat;
  settings: SubtitleSettings;
  style: SubtitleStyle;
  subtitles: Subtitle[];
  status: "idle" | "uploading" | "transcribing" | "editing" | "rendering" | "done";
  progress: number;
};

export const DEFAULT_SETTINGS: SubtitleSettings = {
  maxWordsPerLine: 2,
  minWordsPerLine: 1,
  addPunctuation: false,
  stretchSubtitles: false,
};

// Whisper model options — quality vs speed tradeoff
export type WhisperModel = {
  id: string;
  name: string;
  description: string;
  size: string;
  hebrewQuality: 1 | 2 | 3 | 4 | 5; // stars
  speedRealtime: number; // higher = faster
};

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: "ivrit-ai/whisper-large-v3-turbo-ct2",
    name: "עברית מקצועי",
    description: "מאומן ספציפית לעברית — הכי מדויק. מומלץ!",
    size: "~1.5GB",
    hebrewQuality: 5,
    speedRealtime: 2,
  },
  {
    id: "large-v3",
    name: "כללי מדויק",
    description: "מודל גדול ומדויק לכל השפות",
    size: "~1.5GB",
    hebrewQuality: 4,
    speedRealtime: 1,
  },
  {
    id: "medium",
    name: "כללי בינוני",
    description: "איזון בין מהירות לדיוק",
    size: "~750MB",
    hebrewQuality: 3,
    speedRealtime: 3,
  },
  {
    id: "small",
    name: "מהיר",
    description: "מהיר אבל פחות מדויק בעברית",
    size: "~250MB",
    hebrewQuality: 2,
    speedRealtime: 5,
  },
];

// Default template per mode (which template the user lands on after transcription)
export const MODE_DEFAULT_TEMPLATE: Record<EditMode, string> = {
  subtitles_only: "plain",
  basic_effects: "minimal",
  podcast: "ali",
  advanced_effects: "hormozi",
};

// Default subtitle settings per mode
export const MODE_DEFAULT_SETTINGS: Record<EditMode, SubtitleSettings> = {
  subtitles_only: { maxWordsPerLine: 5, minWordsPerLine: 3, addPunctuation: true, stretchSubtitles: true },
  basic_effects: { maxWordsPerLine: 3, minWordsPerLine: 1, addPunctuation: true, stretchSubtitles: true },
  podcast: { maxWordsPerLine: 4, minWordsPerLine: 2, addPunctuation: true, stretchSubtitles: true },
  advanced_effects: { maxWordsPerLine: 2, minWordsPerLine: 1, addPunctuation: false, stretchSubtitles: false },
};

export const HEBREW_FONTS = [
  { name: "Heebo", value: "Heebo" },
  { name: "Rubik", value: "Rubik" },
  { name: "Assistant", value: "Assistant" },
  { name: "Varela Round", value: "Varela Round" },
  { name: "Secular One", value: "Secular One" },
  { name: "Suez One", value: "Suez One" },
  { name: "Frank Ruhl Libre", value: "Frank Ruhl Libre" },
  { name: "Bellefair", value: "Bellefair" },
];

export const MODE_PRESETS: Record<EditMode, SubtitleStyle> = {
  viral: {
    fontFamily: "Rubik",
    fontSize: 72,
    fontWeight: 900,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 6,
    backgroundColor: "#000000",
    backgroundOpacity: 0,
    position: "middle",
    positionOffset: 0,
    textAlign: "center",
    highlightColor: "#facc15",
    shadow: true,
  },
  effects: {
    fontFamily: "Heebo",
    fontSize: 56,
    fontWeight: 800,
    color: "#ffffff",
    strokeColor: "#7c3aed",
    strokeWidth: 4,
    backgroundColor: "#7c3aed",
    backgroundOpacity: 0.3,
    position: "bottom",
    positionOffset: 100,
    textAlign: "center",
    highlightColor: "#ec4899",
    shadow: true,
  },
  clean: {
    fontFamily: "Assistant",
    fontSize: 42,
    fontWeight: 600,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 2,
    backgroundColor: "#000000",
    backgroundOpacity: 0.6,
    position: "bottom",
    positionOffset: 80,
    textAlign: "center",
    highlightColor: "#ffffff",
    shadow: false,
  },
};
