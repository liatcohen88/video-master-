/**
 * Brand logo download + caching pipeline.
 *
 * Composes a styled "brand card" PNG (white rounded rectangle + logo + name)
 * for each brand that gets mentioned in a video. Cached on disk so we don't
 * re-fetch on every render.
 *
 * Cache key: <brand.id>-<cardHeight>.png
 *
 * The card is rendered as SVG and rasterized with sharp. The brand logo
 * itself is fetched from simpleicons.org and embedded as a data URL.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { BrandLogo } from "./brandLogos";

const CACHE_DIR = join(process.cwd(), "cache", "brand-logos");

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Return the local PNG path for a brand card at a given size, downloading
 * and rendering on first request. Throws if the logo can't be fetched.
 */
export async function getBrandCardPng(
  brand: BrandLogo,
  cardHeight: number,
  transparentBg = false,
): Promise<{ path: string; width: number; height: number }> {
  await mkdir(CACHE_DIR, { recursive: true });

  const sizeKey = Math.round(cardHeight);
  // Transparent variants cached separately — otherwise a previous run with
  // the white card sticks around forever and silently overrides the user's
  // toggle. Suffix matches what Liat saw missing in the MP4 export.
  const variant = transparentBg ? "t" : "w";
  const filename = `${brand.id}-${sizeKey}-${variant}.png`;
  const cachePath = join(CACHE_DIR, filename);

  // Card dimensions
  const logoSize = sizeKey * 0.62;
  const padding = sizeKey * 0.2;
  const fontSize = sizeKey * 0.46;
  // Approximate card width based on brand name length
  const approxCharWidth = fontSize * 0.55;
  const textWidth = brand.name.length * approxCharWidth;
  const cardWidth = Math.round(padding * 2 + logoSize + padding * 0.8 + textWidth + padding);

  if (existsSync(cachePath)) {
    return { path: cachePath, width: cardWidth, height: sizeKey };
  }

  // Fetch brand logo SVG from simpleicons CDN
  const logoUrl = `https://cdn.simpleicons.org/${brand.slug}/${brand.color}`;
  const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch logo for ${brand.id}: HTTP ${res.status}`);
  }
  const logoSvgText = await res.text();
  const logoB64 = Buffer.from(logoSvgText).toString("base64");

  // Text color depends on background. Opaque card = brand color on white.
  // Transparent = white text with a dark drop shadow so it stays readable
  // against any video frame (mirrors VideoPreview.tsx BrandOverlay logic).
  const textFill = transparentBg ? "#FFFFFF" : `#${brand.color}`;
  const radius = sizeKey * 0.22;
  const shadowStd = sizeKey * 0.04;

  const backgroundLayer = transparentBg
    ? ""
    : `<rect x="0" y="0" width="${cardWidth}" height="${sizeKey}" rx="${radius}" ry="${radius}"
            fill="#FFFFFF" filter="url(#shadow)" />`;
  const textShadow = transparentBg ? ` filter="url(#textShadow)"` : "";

  const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${sizeKey}" viewBox="0 0 ${cardWidth} ${sizeKey}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${sizeKey * 0.06}" />
      <feOffset dx="0" dy="${sizeKey * 0.04}" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${shadowStd}" />
      <feOffset dx="0" dy="${sizeKey * 0.025}" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.75" /></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${backgroundLayer}
  <image x="${padding}" y="${(sizeKey - logoSize) / 2}"
         width="${logoSize}" height="${logoSize}"
         href="data:image/svg+xml;base64,${logoB64}" />
  <text x="${padding * 2 + logoSize}" y="${sizeKey / 2}"
        font-family="Heebo, Rubik, Arial, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="${textFill}"${textShadow}
        dominant-baseline="central">${escapeXml(brand.name)}</text>
</svg>`;

  const png = await sharp(Buffer.from(cardSvg), { density: 300 })
    .png({ compressionLevel: 6 })
    .toBuffer();

  await writeFile(cachePath, png);

  // Measure actual rendered size (sharp may add padding for filter)
  const meta = await sharp(png).metadata();
  return {
    path: cachePath,
    width: meta.width ?? cardWidth,
    height: meta.height ?? sizeKey,
  };
}

/**
 * Pre-warm: download cards for ALL brand events. Returns a map for use
 * in the FFmpeg filter graph. Errors are swallowed per-brand so one bad
 * fetch doesn't kill the whole render.
 */
export async function prepareBrandCards(
  events: { brand: BrandLogo }[],
  cardHeight: number,
  transparentBg = false,
): Promise<Map<string, { path: string; width: number; height: number }>> {
  const map = new Map<string, { path: string; width: number; height: number }>();
  // De-dupe by brand id (multiple events of same brand share one PNG)
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.brand.id)) continue;
    seen.add(ev.brand.id);
    try {
      const r = await getBrandCardPng(ev.brand, cardHeight, transparentBg);
      map.set(ev.brand.id, r);
    } catch (err) {
      console.error(`Brand logo skipped for ${ev.brand.id}:`, err);
    }
  }
  return map;
}
