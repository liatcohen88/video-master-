/**
 * "Edit-as" reference style presets.
 *
 * Each preset is a curated combination of mode + template + effects that
 * mimics a recognizable viral editing style. User clicks one → all settings
 * snap into place. The pieces themselves are already implemented elsewhere
 * (templates.ts, types.ts effects); this file is the recipe book.
 */

import type {
  EditMode, VideoEffects, SubtitleSettings,
} from "./types";
import { DEFAULT_EFFECTS } from "./types";
import type { SubtitleAnimationType } from "./subtitleAnimations";

export type ReferenceStyle = {
  id: string;
  name: string;
  /** One-line tagline shown on the card */
  tagline: string;
  /** Full description shown when card focused */
  description: string;
  /** Emoji or short symbol shown big */
  emoji: string;
  /** Tailwind gradient classes for card background */
  gradient: string;
  /** Reference creator/source ("Inspired by Alex Hormozi" etc.) */
  inspiredBy: string;
  /** Apply: returns {mode, templateId, settings, effects} to set */
  preset: {
    mode: EditMode;
    templateId: string;
    settings: Partial<SubtitleSettings>;
    effectsOverride: Partial<VideoEffects> & { subtitleAnimation: SubtitleAnimationType };
  };
};

export const REFERENCE_STYLES: ReferenceStyle[] = [
  {
    id: "hormozi",
    name: "Hormozi 🔥",
    tagline: "ויראלי, צהוב, אגרסיבי",
    description: "פאנץ' זום עוצמתי, אנימציה מתחלפת, חיתוכי שתיקה מהירים, צבע קולנועי. הסטייל של הסרטונים הוויראליים של Alex Hormozi.",
    emoji: "🔥",
    gradient: "from-yellow-400 via-orange-500 to-red-600",
    inspiredBy: "Inspired by Alex Hormozi",
    preset: {
      mode: "advanced_effects",
      templateId: "hormozi",
      settings: { maxWordsPerLine: 2, minWordsPerLine: 1, addPunctuation: false, stretchSubtitles: false },
      effectsOverride: {
        ...DEFAULT_EFFECTS,
        aspectRatio: "9:16",
        cutSilence: true,
        silenceThresholdDb: -32,
        silenceMinDurationSec: 0.4,
        zoomEffect: "punch",
        zoomIntensity: 0.12,
        cinematicColor: true,
        subtitleAnimation: "auto-mix",
      },
    },
  },
  {
    id: "rollin",
    name: "פודקאסט ישראלי 🎙️",
    tagline: "כמו Rollin' Video",
    description: "9:16 עם דובר במרכז, כתוביות גדולות בלבן, חיתוך שתיקות, מעברים חלקים. מושלם לקליפים מפודקאסטים.",
    emoji: "🎙️",
    gradient: "from-amber-500 via-orange-600 to-red-700",
    inspiredBy: "סגנון Rollin' Video, פודקאסטים ישראליים",
    preset: {
      mode: "podcast",
      templateId: "ali",
      settings: { maxWordsPerLine: 4, minWordsPerLine: 2, addPunctuation: true, stretchSubtitles: true },
      effectsOverride: {
        ...DEFAULT_EFFECTS,
        aspectRatio: "9:16",
        cutSilence: true,
        silenceThresholdDb: -35,
        silenceMinDurationSec: 0.6,
        zoomEffect: "punch",
        zoomIntensity: 0.05,
        cinematicColor: true,
        subtitleAnimation: "slide-up",
      },
    },
  },
  {
    id: "captions",
    name: "Captions Default 📝",
    tagline: "נקי וקריא",
    description: "סטייל ה-default המוכר של Captions.ai — לבן עם רקע שקור, מילה-מילה. אלגנטי ומקצועי.",
    emoji: "📝",
    gradient: "from-slate-400 via-slate-600 to-slate-800",
    inspiredBy: "Inspired by Captions.ai",
    preset: {
      mode: "basic_effects",
      templateId: "minimal",
      settings: { maxWordsPerLine: 3, minWordsPerLine: 1, addPunctuation: true, stretchSubtitles: true },
      effectsOverride: {
        ...DEFAULT_EFFECTS,
        aspectRatio: "original",
        cutSilence: true,
        silenceThresholdDb: -38,
        silenceMinDurationSec: 0.7,
        zoomEffect: "none",
        cinematicColor: false,
        subtitleAnimation: "pop",
      },
    },
  },
  {
    id: "tiktok-energy",
    name: "TikTok Energy ⚡",
    tagline: "צבעוני, מהיר, חי",
    description: "כתוביות צבעוניות, אנימציות מתחלפות, חיתוכים מהירים, הבזקי צבע. הסטייל של רילסים ויראליים עם המון תנועה.",
    emoji: "⚡",
    gradient: "from-pink-500 via-fuchsia-600 to-purple-700",
    inspiredBy: "סטייל TikTok ויראלי",
    preset: {
      mode: "advanced_effects",
      templateId: "neon",
      settings: { maxWordsPerLine: 2, minWordsPerLine: 1, addPunctuation: false, stretchSubtitles: false },
      effectsOverride: {
        ...DEFAULT_EFFECTS,
        aspectRatio: "9:16",
        cutSilence: true,
        silenceThresholdDb: -30,
        silenceMinDurationSec: 0.3,
        zoomEffect: "punch",
        zoomIntensity: 0.15,
        cinematicColor: true,
        subtitleAnimation: "auto-mix",
      },
    },
  },
  {
    id: "podcast-calm",
    name: "פודקאסט שקט 🧘",
    tagline: "מינימלי, נקי",
    description: "כתוביות עדינות, ללא אפקטים, ללא חיתוכים. מושלם לסרטוני מדיטציה, ראיונות רגועים, הרצאות.",
    emoji: "🧘",
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
    inspiredBy: "סגנון הרצאות / מדיטציה",
    preset: {
      mode: "subtitles_only",
      templateId: "plain",
      settings: { maxWordsPerLine: 6, minWordsPerLine: 3, addPunctuation: true, stretchSubtitles: true },
      effectsOverride: {
        ...DEFAULT_EFFECTS,
        aspectRatio: "original",
        cutSilence: false,
        zoomEffect: "none",
        cinematicColor: false,
        subtitleAnimation: "none",
      },
    },
  },
  {
    id: "instagram-modern",
    name: "Instagram מודרני 💎",
    tagline: "אסתטי וטרנדי",
    description: "כתוביות עם רקע גרדיאנט, פונט מודרני, חיתוך 4:5 לפיד, צבע קולנועי. הסטייל של בלוגרים אסתטיים.",
    emoji: "💎",
    gradient: "from-violet-400 via-purple-500 to-fuchsia-600",
    inspiredBy: "Instagram aesthetic creators",
    preset: {
      mode: "basic_effects",
      templateId: "instagram",
      settings: { maxWordsPerLine: 3, minWordsPerLine: 2, addPunctuation: true, stretchSubtitles: true },
      effectsOverride: {
        ...DEFAULT_EFFECTS,
        aspectRatio: "4:5",
        cutSilence: true,
        silenceThresholdDb: -38,
        silenceMinDurationSec: 0.5,
        zoomEffect: "subtle",
        zoomIntensity: 0.04,
        cinematicColor: true,
        subtitleAnimation: "slide-up",
      },
    },
  },
];
