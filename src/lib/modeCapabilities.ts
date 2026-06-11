/**
 * What each edit mode is allowed to do — mirrors the bullet points shown on
 * the mode-selector cards, so the editor only exposes the features that match
 * the mode the user picked.
 *
 *   כתוביות בלבד  — תמלול + אנימציית כתוביות בלבד. בלי אפקטים/אמוג'ים/סאונד.
 *   פודקאסט       — כתוביות + חיתוך שתיקות + אמוג'ים/איקונים + לוגו + סאונד
 *                   + חיתוך יחס. בלי תיקון צבע ובלי זום-פנים אוטומטי.
 *   אפקטים מתקדמים — הכל.
 */
import type { EditMode } from "./types";

export type ModeCaps = {
  /** Add emojis / Lottie icons to subtitles (and auto-detect them) */
  elements: boolean;
  /** Per-element SFX sounds */
  sound: boolean;
  /** Personal logo / watermark */
  logo: boolean;
  /** Auto silence cutting */
  silenceCut: boolean;
  /** Aspect-ratio crop (9:16 / 1:1 / 16:9) */
  aspectCrop: boolean;
  /** Face detection + auto punch-zoom */
  faceZoom: boolean;
  /** Cinematic colour grade */
  colorGrade: boolean;
};

const ALL_ON: ModeCaps = {
  elements: true, sound: true, logo: true, silenceCut: true,
  aspectCrop: true, faceZoom: true, colorGrade: true,
};

// Liat (2026-06-11): "אני כן הייתי רוצה שיהיה בצד אפקטים מתקדמים - ואז כל
// שינוי שהמשתמש עושה זה ישנה את כמו הקרדיט לסרטון". Every mode now grants
// ACCESS to every effect — the mode only controls the DEFAULTS (what AI
// applies automatically). Per-effect opt-in raises cost via calcDynamicCost.
// AI editing per the mode card bullets still drives the auto-apply via
// MODE_DEFAULT_EFFECTS, so e.g. subtitles_only auto-applies nothing — the
// user just sees the side panel and can choose to add what they want.
const CAPS: Record<EditMode, ModeCaps> = {
  subtitles_only:   ALL_ON,
  podcast:          ALL_ON,
  basic_effects:    ALL_ON,
  advanced_effects: ALL_ON,
};

export function modeCapabilities(mode: EditMode): ModeCaps {
  return CAPS[mode] ?? ALL_ON;
}
