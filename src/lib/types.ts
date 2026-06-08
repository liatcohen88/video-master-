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
  /** Timestamps (sec) where punch zooms should fire — from analysis */
  emphasisMoments?: number[];
  /** Subtitle entrance animation — see subtitleAnimations.ts */
  subtitleAnimation?:
    | "none" | "pop" | "bounce" | "slide-up" | "slide-left"
    | "slide-right" | "zoom-burst" | "wave" | "auto-mix";
  /** Auto-add emoji elements + matching SFX at keyword timestamps */
  contextualElements?: boolean;
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
  subtitles_only: { ...DEFAULT_EFFECTS },
  basic_effects: {
    ...DEFAULT_EFFECTS,
    cutSilence: true,
    zoomEffect: "subtle",
    zoomIntensity: 0.05,
    cinematicColor: true,
    contextualElements: true,
    contextualSfx: true,
  },
  podcast: {
    ...DEFAULT_EFFECTS,
    // NO automatic crop — keep the full original frame. Cropping to 9:16 was
    // cutting the speaker out of frame. The user's videos are already vertical,
    // so "original" shows them in full. 9:16 stays available as a manual choice.
    aspectRatio: "original",
    cutSilence: true,
    zoomEffect: "none",
    cinematicColor: true,
    subtitleAnimation: "pop",
    contextualElements: true,
    contextualSfx: true,
  },
  advanced_effects: {
    ...DEFAULT_EFFECTS,
    aspectRatio: "original", // no auto-crop — full frame
    cutSilence: true,
    zoomEffect: "none",
    cinematicColor: true,
    subtitleAnimation: "auto-mix",
    contextualElements: true,
    contextualSfx: true,
    backgroundDepth: false,
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
