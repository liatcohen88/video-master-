/**
 * Cross-platform emoji parity.
 *
 * The live preview renders in the user's browser (Windows → Segoe glossy
 * emoji; Mac → Apple emoji), but the export renders in headless Chromium on
 * Linux (Noto Color Emoji — a flatter design). So the SAME 🔥 looked like a
 * different emoji in the exported MP4 vs the editor (Liat: "האמוגי לא אותו
 * אמוגי, זה עיצוב אחר").
 *
 * Fix: render emoji as Twemoji IMAGES on BOTH sides. An image is identical
 * regardless of OS/font, guaranteeing the editor and the export match exactly.
 * Twemoji is Twitter's open-source emoji set (now maintained at jdecked/twemoji),
 * served as tiny per-emoji SVGs from jsDelivr — only the handful of emojis a
 * video actually uses get fetched.
 */

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

const ZWJ = String.fromCharCode(0x200d);
const VARIATION_SELECTOR = /️/g;

/**
 * Convert an emoji string to Twemoji's hyphen-joined hex codepoint filename.
 * Mirrors twemoji's own `toCodePoint` + the FE0F-stripping rule (drop the
 * U+FE0F variation selector unless the sequence has a ZWJ, e.g. 👨‍👩‍👧).
 */
export function emojiToCodepoint(emoji: string): string {
  const input = emoji.indexOf(ZWJ) < 0 ? emoji.replace(VARIATION_SELECTOR, "") : emoji;
  const out: string[] = [];
  let pending = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (pending) {
      out.push((0x10000 + ((pending - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      pending = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      pending = c; // high surrogate — pair with the next char
    } else {
      out.push(c.toString(16));
    }
  }
  return out.join("-");
}

/** CDN URL of the Twemoji SVG for a given emoji character. */
export function twemojiUrl(emoji: string): string {
  return `${TWEMOJI_BASE}/${emojiToCodepoint(emoji)}.svg`;
}

// Apple-style emoji (emoji-datasource-apple) — Liat prefers the Apple look over
// the flatter Twemoji ("באלי אמוגים של אפל"). Served from jsDelivr (reliable,
// versioned). Filename = ALL codepoints lowercase, '-'-joined, INCLUDING the
// FE0F variation selector — verified: `2764-fe0f.png` exists, `2764.png` 404s.
// (This is the opposite of Twemoji, which strips FE0F.) twemojiUrl stays the
// onError fallback so a missing glyph still shows a colored emoji.
const APPLE_BASE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64";

export function appleEmojiUrl(emoji: string): string {
  const code = Array.from(emoji).map((c) => c.codePointAt(0)!.toString(16)).join("-");
  return `${APPLE_BASE}/${code}.png`;
}
