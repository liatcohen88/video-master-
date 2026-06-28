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
  const minW = Math.max(1, Math.floor(settings.minWordsPerLine) || 1);
  const keepPunct = settings.addPunctuation;

  // Natural caption breaks (Liat): a caption should END at a clause boundary,
  // not in the middle of a sentence. Two hard breaks:
  //   1. PUNCTUATION — a word ending with . , ! ? ; : closes the caption, so a
  //      period/comma never sits mid-line with more words after it.
  //   2. SILENCE — a pause longer than SILENCE_GAP between two words starts a
  //      new caption, so upcoming words don't show during the quiet gap.
  // maxWordsPerLine is now a CAP that applies between hard breaks.
  const BREAK_AFTER = /[.,!?;:׃…]["'»)\]]*\s*$/;
  const SILENCE_GAP = 0.6; // seconds of silence that forces a new caption

  // ADD commas at natural speech pauses when addPunctuation is ON. Whisper
  // (esp. Hebrew) often returns no commas, so "keep punctuation" alone added
  // nothing — Liat: "הוספת פסיקים סימנתי וזה לא באמת הוסיף". A medium pause
  // (>= COMMA_GAP, but below SILENCE_GAP which already splits the caption)
  // earns a trailing comma on the preceding word. Derived from word timings,
  // so it's deterministic and fully reversible by unchecking the box.
  const COMMA_GAP = 0.3;
  const sourceWords: TimedWord[] = keepPunct
    ? baseWords.map((w, i) => {
        const nx = baseWords[i + 1];
        if (!nx) return w;
        const gap = nx.start - w.end;
        if (gap >= COMMA_GAP && gap < SILENCE_GAP && !BREAK_AFTER.test(w.word)) {
          return { ...w, word: w.word + "," };
        }
        return w;
      })
    : baseWords;

  // Each chunk records whether it ended on a HARD boundary (punctuation/
  // silence) — those are deliberate and must survive the min-words merge below.
  const chunks: { words: TimedWord[]; hard: boolean }[] = [];
  let cur: TimedWord[] = [];
  for (let i = 0; i < sourceWords.length; i++) {
    const w = sourceWords[i];
    cur.push(w);
    const next = sourceWords[i + 1];
    const endsClause = BREAK_AFTER.test(w.word);
    const silenceNext = !!next && next.start - w.end >= SILENCE_GAP;
    if (endsClause || silenceNext || cur.length >= size) {
      chunks.push({ words: cur, hard: endsClause || silenceNext });
      cur = [];
    }
  }
  if (cur.length) chunks.push({ words: cur, hard: false });

  // minWordsPerLine: merge a too-short chunk back into the PREVIOUS one — but
  // ONLY across a soft (max-words) boundary, never across a punctuation/silence
  // break, so we don't undo a deliberate sentence split.
  const mergedChunks: { words: TimedWord[]; hard: boolean }[] = [];
  for (const c of chunks) {
    const prev = mergedChunks[mergedChunks.length - 1];
    if (prev && !prev.hard && c.words.length < minW) {
      prev.words = prev.words.concat(c.words);
      prev.hard = c.hard;
    } else {
      mergedChunks.push({ words: c.words.slice(), hard: c.hard });
    }
  }

  const subs: Subtitle[] = [];
  for (const chunk of mergedChunks) {
    const words = chunk.words
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
