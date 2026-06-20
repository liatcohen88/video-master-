/**
 * Hebrew search keywords for emojis — now sourced from the shared emoji
 * dataset (emojiData.ts) so both pickers + search stay in sync. Hebrew
 * speakers type "אש" not "fire", so the picker search matches against these
 * synonyms. Falls back to category-name search for un-keyworded emojis.
 */

import { EMOJI_KEYWORDS } from "./emojiData";

export { EMOJI_KEYWORDS };

/** Test whether an emoji's Hebrew/English keywords contain the query. Empty
 *  query matches everything. Case-insensitive, substring-based — same UX as
 *  the SFX picker. */
export function emojiMatches(emoji: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const words = EMOJI_KEYWORDS[emoji] ?? [];
  if (words.some((w) => w.toLowerCase().includes(q))) return true;
  // Bare-emoji search ("🔥") matches itself, useful for paste-search.
  return emoji.includes(query);
}
