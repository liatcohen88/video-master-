/**
 * "Wow" effects layer — viral polish on top of the standard editor.
 *
 * Beat-Drop Zoom: detects power-words in the transcript ("וואו", "אש",
 * "חייבים"...) and produces short ~250ms zoom-in pulses on them, so the
 * speaker's catchy line lands with a punch — the trick every Reels editor
 * uses. The pulses stack additively on top of the regular "emphasis" zoom
 * the AI suggests, so a manually selected zoom + power-word pop both fire.
 */

import type { Subtitle } from "./types";
import { heWord } from "./hebrewRegex";
import { getContent } from "./contentStore";

/** Hebrew "punchy" words baked in. Each entry has a `key` (admin can silence
 *  it from /admin → WOW מילים) and the matching regex. Curated short — too
 *  many → constant zoom = nauseating. */
export const POWER_WORDS_BASE: { key: string; re: RegExp }[] = [
  // וואו family — accept any number of ו's: ואו, ואוו, וואווווו וכו'.
  { key: "וואו", re: /(?:^|\s|[.,!?])(ו+או+)(?=\s|[.,!?]|$)/u },
  { key: "אש",        re: heWord("אש") },
  { key: "חייבים",    re: heWord("חייבים") },
  { key: "חייב",      re: heWord("חייב") },
  { key: "חייבת",     re: heWord("חייבת") },
  { key: "חינם",      re: heWord("חינם") },
  { key: "בום",       re: heWord("בום") },
  { key: "מטורף",     re: heWord("מטורף") },
  { key: "מטורפת",    re: heWord("מטורפת") },
  { key: "מושלם",     re: heWord("מושלם") },
  { key: "מושלמת",    re: heWord("מושלמת") },
  { key: "ענק",       re: heWord("ענק") },
  { key: "ענקית",     re: heWord("ענקית") },
  { key: "שיגעון",    re: heWord("שיגעון") },
  { key: "מדהים",     re: heWord("מדהים") },
  { key: "מדהימה",    re: heWord("מדהימה") },
  { key: "הכי",       re: heWord("הכי") },
  // English-Hebrew transliteration creators actually say in vlogs
  { key: "wow",     re: /\bwow\b/i },
  { key: "boom",    re: /\bboom\b/i },
  { key: "perfect", re: /\bperfect\b/i },
];

/** Resolve the active POWER_WORDS at call-time, honoring admin CMS overrides:
 *   - `wow.hiddenWords`: silence built-ins by key
 *   - `wow.extraWords`:  append more (each becomes a heWord pattern)
 *  Safe on server (getContent falls back to defaults when localStorage absent). */
function resolvePowerWords(): RegExp[] {
  const hidden = (getContent("wow.hiddenWords") as string[]) ?? [];
  const extras = (getContent("wow.extraWords")  as string[]) ?? [];
  const hiddenSet = new Set(hidden);
  const base = POWER_WORDS_BASE.filter((p) => !hiddenSet.has(p.key)).map((p) => p.re);
  const extra = extras.filter(Boolean).map((w) => heWord(w.trim()));
  return [...base, ...extra];
}

/** One beat-drop event: pulses zoom up by `intensity` around time `t`. */
export type BeatDrop = {
  /** Center timestamp of the pulse (seconds in source video) */
  t: number;
  /** Peak extra zoom — 0.03 = +3% punch. Capped 0.02-0.05 in the UI. */
  intensity: number;
  /** Pulse shape duration in seconds. Default 0.25 (snappy). */
  duration: number;
};

const RAMP_IN  = 0.06;  // very fast ramp up — sells the punch
const RAMP_OUT = 0.16;  // longer settle to feel cinematic, not jittery

/**
 * Scan transcript for power-words and emit a beat-drop per hit. Uses the
 * subtitle's word-level timestamps when present (Whisper provides them);
 * falls back to a proportional estimate inside the subtitle window.
 */
export function detectBeatDrops(
  subtitles: Subtitle[],
  intensity = 0.03,
): BeatDrop[] {
  const drops: BeatDrop[] = [];
  // Dedupe: ignore repeats within 0.7s — same word echoing in two subtitles
  // would otherwise double-pulse and look glitchy.
  const SOON = 0.7;
  const POWER_WORDS = resolvePowerWords();

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;
    for (const re of POWER_WORDS) {
      const m = sub.text.match(re);
      if (!m) continue;

      let t: number;
      const cleaned = m[0].replace(/[?.,!]/g, "").trim();
      const wordHit = sub.words?.find((w) =>
        w.word.includes(cleaned) || cleaned.includes(w.word),
      );
      if (wordHit) {
        t = wordHit.start;
      } else {
        const ratio = sub.text.length > 0 ? sub.text.indexOf(m[0]) / sub.text.length : 0;
        t = sub.start + ratio * (sub.end - sub.start);
      }

      if (drops.some((d) => Math.abs(d.t - t) < SOON)) continue;
      drops.push({ t, intensity, duration: RAMP_IN + 0.03 + RAMP_OUT });
    }
  }

  return drops.sort((a, b) => a.t - b.t);
}

/**
 * Sample the additive zoom contribution from ALL beat-drops at time `t`.
 * Returns 0 when nothing is firing. Add this to your existing zoomScale.
 */
export function beatDropZoomAt(t: number, drops: BeatDrop[]): number {
  let add = 0;
  for (const d of drops) {
    const start = d.t - RAMP_IN;
    const hold0 = d.t;
    const hold1 = d.t + 0.03;
    const end   = hold1 + RAMP_OUT;
    if (t < start || t >= end) continue;
    if (t < hold0)        add += d.intensity * (t - start) / RAMP_IN;          // ramp in
    else if (t < hold1)   add += d.intensity;                                   // hold
    else                  add += d.intensity * (end - t) / RAMP_OUT;            // ramp out
  }
  return add;
}
