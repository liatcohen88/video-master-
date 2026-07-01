/**
 * Hebrew-aware word boundary helpers.
 *
 * JavaScript's \b only recognizes ASCII boundaries; in `אני מיד הולך` the
 * pattern /\bמיד\b/ won't match. Without boundaries, /מיד/ would also match
 * inside "מידע" (information) and "מידי" — causing false positives.
 *
 * heWord(stem) returns a regex that matches `stem` only when NOT embedded
 * inside another Hebrew word. Uses lookbehind+lookahead (supported in modern
 * Chromium/Node, which is what we run on).
 *
 * Hebrew prepositions/conjunctions (ב/ל/מ/ו/ש/כ/ה) attach directly to the
 * following noun with no space — "מאליאקספרס" ("from AliExpress"),
 * "באליאקספרס" ("at/on AliExpress") are completely normal phrasing, not rare
 * edge cases. A strict "no Hebrew letter before" check rejected all of these,
 * silently failing to detect brand names in everyday sentences. Fixed by
 * allowing exactly ONE preceding Hebrew letter (a single glued prefix) while
 * still rejecting two-or-more consecutive Hebrew letters before the stem
 * (which means the match is genuinely embedded inside a longer, unrelated
 * word rather than a real word boundary).
 */

const HE_LETTER = "[\\u0590-\\u05FF\\u200F\\u200E]"; // includes RLM/LRM as non-letter? Actually treat them as non-boundary

/**
 * Build a Hebrew word-boundary regex.
 * - `stem` is the Hebrew word/phrase (can include \s* for inner whitespace).
 * - Matches when not preceded by two-or-more consecutive Hebrew letters
 *   (i.e. a single attached prefix letter is allowed) and not followed by
 *   another Hebrew letter.
 * - Punctuation, spaces, ASCII letters are valid boundaries.
 */
export function heWord(stem: string, flags = ""): RegExp {
  return new RegExp(`(?<!${HE_LETTER}${HE_LETTER})(?:${stem})(?!${HE_LETTER})`, flags);
}

/** Variant that allows match at end with ? . , ! etc. (default already does) */
export function heWords(...stems: string[]): RegExp[] {
  return stems.map((s) => heWord(s));
}

/**
 * Test if a JS regex feature (lookbehind) is supported in this runtime.
 * Returns true on modern Node 18+ and recent browsers.
 */
export function lookbehindSupported(): boolean {
  try {
    new RegExp("(?<=a)b");
    return true;
  } catch {
    return false;
  }
}
