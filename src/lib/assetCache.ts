/**
 * Asset cache for export overlays — downloads & caches emoji and brand logo
 * PNGs so the burned video matches the live preview (real color emojis,
 * real brand marks).
 *
 * - Emojis: twemoji 72x72 PNGs from jsdelivr (full color, same as preview).
 * - Brand logos: simpleicons SVG → rasterized PNG card via sharp.
 *
 * All files cached under cache/ keyed by content so repeat renders are fast.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CACHE_DIR = join(process.cwd(), "cache");
const EMOJI_DIR = join(CACHE_DIR, "emoji");

/** Convert an emoji string to its twemoji filename codepoint(s). */
function emojiCodepoints(emoji: string): string {
  const cps: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // twemoji drops the FE0F variation selector
    if (cp === 0xfe0f) continue;
    cps.push(cp.toString(16));
  }
  return cps.join("-");
}

/**
 * Download (and cache) a twemoji PNG for an emoji, resized to `size` px.
 * Returns the local PNG path, or null if the emoji isn't in twemoji.
 */
export async function getEmojiPng(emoji: string, size: number): Promise<string | null> {
  await mkdir(EMOJI_DIR, { recursive: true });
  const code = emojiCodepoints(emoji);
  if (!code) return null;
  const sizedName = `${code}-${size}.png`;
  const sizedPath = join(EMOJI_DIR, sizedName);
  if (existsSync(sizedPath)) return sizedPath;

  // Source 72px twemoji
  const rawPath = join(EMOJI_DIR, `${code}.png`);
  let rawBuf: Buffer;
  if (existsSync(rawPath)) {
    rawBuf = await readFile(rawPath);
  } else {
    const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${code}.png`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        // Fallback CDN
        const alt = `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${code}.png`;
        const res2 = await fetch(alt, { signal: AbortSignal.timeout(8000) });
        if (!res2.ok) return null;
        rawBuf = Buffer.from(await res2.arrayBuffer());
      } else {
        rawBuf = Buffer.from(await res.arrayBuffer());
      }
      await writeFile(rawPath, rawBuf);
    } catch {
      return null;
    }
  }

  // Resize to requested size with high quality
  const resized = await sharp(rawBuf)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(sizedPath, resized);
  return sizedPath;
}
