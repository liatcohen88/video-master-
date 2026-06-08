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
): Promise<{ path: string; width: number; height: number }> {
  await mkdir(CACHE_DIR, { recursive: true });

  const sizeKey = Math.round(cardHeight);
  const filename = `${brand.id}-${sizeKey}.png`;
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

  // Brand name uses brand color (works against the white card background)
  const textFill = `#${brand.color}`;
  // Card background = white with soft shadow (approximated via filter)
  const radius = sizeKey * 0.22;

  // Compose card SVG. Use system "Heebo, Rubik, sans-serif" so Hebrew names
  // render correctly when sharp picks up a Hebrew-capable system font.
  const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${sizeKey}" viewBox="0 0 ${cardWidth} ${sizeKey}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${sizeKey * 0.06}" />
      <feOffset dx="0" dy="${sizeKey * 0.04}" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="${cardWidth}" height="${sizeKey}" rx="${radius}" ry="${radius}"
        fill="#FFFFFF" filter="url(#shadow)" />
  <image x="${padding}" y="${(sizeKey - logoSize) / 2}"
         width="${logoSize}" height="${logoSize}"
         href="data:image/svg+xml;base64,${logoB64}" />
  <text x="${padding * 2 + logoSize}" y="${sizeKey / 2}"
        font-family="Heebo, Rubik, Arial, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="${textFill}"
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
): Promise<Map<string, { path: string; width: number; height: number }>> {
  const map = new Map<string, { path: string; width: number; height: number }>();
  // De-dupe by brand id (multiple events of same brand share one PNG)
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.brand.id)) continue;
    seen.add(ev.brand.id);
    try {
      const r = await getBrandCardPng(ev.brand, cardHeight);
      map.set(ev.brand.id, r);
    } catch (err) {
      console.error(`Brand logo skipped for ${ev.brand.id}:`, err);
    }
  }
  return map;
}
