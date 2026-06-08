/**
 * Hebrew-aware word boundary helpers.
 *
 * JavaScript's \b only recognizes ASCII boundaries; in `אני מיד הולך` the
 * pattern /\bמיד\b/ won't match. Without boundaries, /מיד/ would also match
 * inside "מידע" (information) and "מידי" — causing false positives.
 *
 * heWord(stem) returns a regex that matches `stem` only when NOT touching
 * another Hebrew letter on either side. Uses lookbehind+lookahead (supported
 * in modern Chromium/Node, which is what we run on).
 */

const HE_LETTER = "[\\u0590-\\u05FF\\u200F\\u200E]"; // includes RLM/LRM as non-letter? Actually treat them as non-boundary

/**
 * Build a Hebrew word-boundary regex.
 * - `stem` is the Hebrew word/phrase (can include \s* for inner whitespace).
 * - Matches when not adjacent to another Hebrew letter on either side.
 * - Punctuation, spaces, ASCII letters are valid boundaries.
 */
export function heWord(stem: string, flags = ""): RegExp {
  return new RegExp(`(?<!${HE_LETTER})(?:${stem})(?!${HE_LETTER})`, flags);
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
