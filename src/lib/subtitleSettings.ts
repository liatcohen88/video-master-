/**
 * Client-side application of the subtitle SETTINGS that were previously no-ops:
 *  - addPunctuation  → keep vs strip commas/periods (Whisper returns them).
 *  - stretchSubtitles → extend each line until the next begins (no gaps).
 *  - maxWordsPerLine  → re-chunk the word stream live in the editor.
 *
 * Everything is derived from the word stream (each word keeps its ORIGINAL
 * punctuation as the source of truth), so toggling a setting on/off is fully
 * reversible. Preview + export both read the resulting subtitle state, so they
 * stay in parity for free. Liat: "מתח כתוביות והוספת פסיקים... רק אם המשתמש
 * מסמן אותם תעשה ואם לא אז לא".
 */

import type { Subtitle, SubtitleSettings } from "./types";

export type TimedWord = { word: string; start: number; end: number };

// Sentence punctuation to drop when addPunctuation is OFF (commas, periods…).
const PUNCT = /[.,!?;:׃…]/g;

export function stripPunct(s: string): string {
  return s.replace(PUNCT, "").replace(/\s+/g, " ").trim();
}

/** Flatten subtitles back to a single word stream (their words keep punctuation).
 *  Falls back to splitting `text` evenly across the line's duration when a
 *  subtitle has no per-word timings. */
export function flattenWords(subs: Subtitle[]): TimedWord[] {
  const out: TimedWord[] = [];
  for (const s of subs) {
    if (s.words && s.words.length) {
      for (const w of s.words) out.push({ word: w.word, start: w.start, end: w.end });
    } else if (s.text?.trim()) {
      const parts = s.text.trim().split(/\s+/);
      const dur = Math.max(0.001, (s.end - s.start) / parts.length);
      parts.forEach((p, i) => out.push({ word: p, start: s.start + i * dur, end: s.start + (i + 1) * dur }));
    }
  }
  return out;
}

/** Build subtitles from a base word stream honoring the current settings. */
export function buildSubtitles(baseWords: TimedWord[], settings: SubtitleSettings): Subtitle[] {
  if (!baseWords.length) return [];
  const size = Math.max(1, Math.floor(settings.maxWordsPerLine) || 1);
  const keepPunct = settings.addPunctuation;

  const subs: Subtitle[] = [];
  for (let i = 0; i < baseWords.length; i += size) {
    const chunk = baseWords.slice(i, i + size);
    const words = chunk
      .map((w) => ({ word: keepPunct ? w.word : stripPunct(w.word), start: w.start, end: w.end }))
      .filter((w) => w.word.length > 0);
    if (!words.length) continue;
    subs.push({
      id: String(subs.length + 1),
      start: words[0].start,
      end: words[words.length - 1].end,
      text: words.map((w) => w.word).join(" "),
      words,
    });
  }

  // Stretch: each line stays on screen until the next one begins (no gaps).
  if (settings.stretchSubtitles) {
    for (let i = 0; i < subs.length - 1; i++) {
      if (subs[i + 1].start > subs[i].end) subs[i].end = subs[i + 1].start;
    }
  }

  return subs;
}

/** Re-attach per-line manual emojis + subtitle SFX to the rebuilt chunks by
 *  time, so changing a setting doesn't wipe the user's per-line additions. */
export function remapAttachments(oldSubs: Subtitle[], newSubs: Subtitle[]): Subtitle[] {
  if (!newSubs.length) return newSubs;
  const at = (t: number) =>
    newSubs.find((s) => t >= s.start && t <= s.end) ??
    newSubs.find((s) => s.start >= t) ??
    newSubs[newSubs.length - 1];
  for (const s of oldSubs) {
    for (const me of s.manualEmojis ?? []) {
      const tgt = at(s.start);
      (tgt.manualEmojis = tgt.manualEmojis ?? []).push(me);
    }
    if (s.sfxId && s.sfxId !== "none") {
      const tgt = at(s.start);
      if (!tgt.sfxId) tgt.sfxId = s.sfxId;
    }
  }
  return newSubs;
}

/** Convenience: rebuild `current` subtitles for new settings, using a stable
 *  base word stream (preferred) and preserving per-line attachments. */
export function applySubtitleSettings(
  current: Subtitle[],
  settings: SubtitleSettings,
  baseWords?: TimedWord[],
): Subtitle[] {
  const base = baseWords && baseWords.length ? baseWords : flattenWords(current);
  return remapAttachments(current, buildSubtitles(base, settings));
}
