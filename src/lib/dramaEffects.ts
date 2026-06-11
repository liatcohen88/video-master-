/**
 * "Drama Mode" — Israeli reels trope detection.
 *
 * When the speaker says a "I-can't-believe-this" line ("אני לא מאמין",
 * "זה לא קורה לי", "מה!?"), Reels editors flash the video to black-and-
 * white for ~1.2s and drop a dramatic sting sound (dun-dun-DUNNN). Classic
 * surprise-reveal beat — works on every audience demographic.
 *
 * We detect via the transcript (whisper word-timestamps when available;
 * proportional estimate otherwise), and emit "drama moments". The video
 * preview swaps its CSS filter to grayscale around `t`, and a sting SFX
 * is scheduled at the same moment.
 *
 * Admin can edit the word list from /admin → WOW (alongside power-words).
 */

import type { Subtitle } from "./types";
import { heWord } from "./hebrewRegex";
import { getContent } from "./contentStore";

/** Drama lines users actually say in Hebrew reels.
 *  CURATED TIGHT: each match should be a GENUINE surprise — multi-word
 *  phrases or rare single words only. "מה", "באמת", "וואלה" were removed:
 *  they're conversational fillers in Hebrew, not drama signals, and made
 *  the sting fire on half the subtitles ("הוא משתגעעעעעע"). */
export const DRAMA_WORDS_BASE: { key: string; re: RegExp }[] = [
  { key: "אני לא מאמין",     re: /אני\s+לא\s+מאמין/u },
  { key: "זה לא קורה לי",    re: /זה\s+לא\s+קורה\s+לי/u },
  { key: "לא יכול להיות",    re: /לא\s+יכול\s+להיות/u },
  { key: "לא ייאמן",         re: heWord("ייאמן") },
  { key: "לא נכון",          re: /לא\s+נכון/u },
  { key: "אין מצב",         re: /אין\s+מצב/u },
  { key: "שיט",             re: heWord("שיט") },
  // English — Israelis say these too. Multi-word/whole phrase only.
  { key: "no way",          re: /\bno\s+way\b/i },
  { key: "omg",             re: /\bomg\b|\boh\s+my\s+god\b/i },
];

function resolveDramaWords(): RegExp[] {
  const hidden = (getContent("drama.hiddenWords") as string[]) ?? [];
  const extras = (getContent("drama.extraWords")  as string[]) ?? [];
  const hiddenSet = new Set(hidden);
  const base = DRAMA_WORDS_BASE.filter((p) => !hiddenSet.has(p.key)).map((p) => p.re);
  const extra = extras.filter(Boolean).map((w) => heWord(w.trim()));
  return [...base, ...extra];
}

export type DramaMoment = {
  /** Start time of the drama beat (seconds) */
  t: number;
  /** Duration of the B&W flash. Default 1.2s — long enough to register, short
   *  enough not to feel like a glitch. */
  duration: number;
  /** The matched text — handy for debugging */
  word: string;
};

const DEFAULT_DURATION = 1.2;
// Dedup window TIGHT enough not to swallow real beats, WIDE enough that
// adjacent drama phrases ("אני לא מאמין, זה לא קורה לי" in one subtitle)
// don't both pop a sting on top of each other. 4s is past the longest
// drama sting in our library (~2.5s), so successive stings never overlap.
const DEDUPE_WINDOW = 4.0;

/** Scan subtitles for drama phrases and emit a beat per hit. */
export function detectDramaMoments(subtitles: Subtitle[]): DramaMoment[] {
  const out: DramaMoment[] = [];
  const PATTERNS = resolveDramaWords();

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;
    for (const re of PATTERNS) {
      const m = sub.text.match(re);
      if (!m) continue;

      // Prefer whisper word-timestamp; fall back to proportional estimate.
      const cleaned = m[0].replace(/[?.,!]/g, "").trim();
      const first = cleaned.split(/\s+/)[0] ?? cleaned;
      const wordHit = sub.words?.find((w) =>
        w.word.includes(first) || first.includes(w.word),
      );
      const t = wordHit
        ? wordHit.start
        : sub.start + (sub.text.indexOf(m[0]) / Math.max(sub.text.length, 1)) * (sub.end - sub.start);

      if (out.some((d) => Math.abs(d.t - t) < DEDUPE_WINDOW)) continue;
      out.push({ t, duration: DEFAULT_DURATION, word: cleaned });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Is `t` inside any drama moment? — used by the preview to switch filter. */
export function dramaActiveAt(t: number, moments: DramaMoment[]): DramaMoment | null {
  // Pre-roll the filter by 60ms so the swap aligns with the spoken word
  // (lips move before the audio peaks).
  const PRE = 0.06;
  for (const d of moments) {
    if (t >= d.t - PRE && t < d.t + d.duration) return d;
  }
  return null;
}

/** Drama sting SFX ids — SHORT impact sounds only. We rotate through them
 *  so repeated drama beats don't feel cloned. The picked id maps to
 *  public/sfx/sfx_<id>.mp3.
 *
 *  Curated from the "impacts" category (short hits, not viral risers).
 *  The viral-long category (1996/1997/1040/1149) was wrong here — those
 *  are 3-5s cinematic risers that played as "אותו סאונד 5 שניות".
 *  Impacts: 2448 (short), 951/1090/1100/1066/1028/1056/1058 (medium).
 *  Still capped at 1.5s playback in the player so worst case is bounded. */
export const DRAMA_STING_IDS = ["2448", "951", "1090", "1100", "1066", "1028"];

/** Pick a sting for a given drama moment index. Deterministic — same index
 *  always returns the same sting, so re-plays sound consistent. */
export function pickDramaSting(idx: number): string {
  return DRAMA_STING_IDS[idx % DRAMA_STING_IDS.length] ?? DRAMA_STING_IDS[0];
}
