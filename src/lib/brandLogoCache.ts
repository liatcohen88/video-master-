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

/**
 * Return the local PNG path for a brand badge at a given size, downloading
 * and rendering on first request. Throws if the logo can't be fetched.
 *
 * Mirrors the live preview's BrandOverlay (VideoPreview.tsx) exactly:
 *   - Just the logo (no brand-name text — that was a CDN-failure fallback
 *     and Liat asked to never add text alongside a working logo:
 *     "תראה אמזון זה לא תואם צריך שממש יהיה את האיקון הלוגו שלהם")
 *   - When transparentBg: just the logo with a drop shadow
 *   - When !transparentBg: white rounded card with the logo centered inside
 *
 * Cache key bumped to v2 so old text-card PNGs in cache/ get bypassed.
 */
export async function getBrandCardPng(
  brand: BrandLogo,
  cardHeight: number,
  transparentBg = false,
): Promise<{ path: string; width: number; height: number }> {
  await mkdir(CACHE_DIR, { recursive: true });

  const sizeKey = Math.round(cardHeight);
  // v2 in the cache key = post text-removal. Old cached files (no v2) live on
  // disk but are never returned, so a sweep is optional.
  const variant = transparentBg ? "t" : "w";
  const filename = `${brand.id}-${sizeKey}-${variant}-v2.png`;
  const cachePath = join(CACHE_DIR, filename);

  // Square badge: logo fills ~70% of the card with padding around it (matches
  // the preview's logoSize * 0.18 padding ratio inside the card).
  const logoSize = Math.round(sizeKey * 0.7);
  const padding = Math.round((sizeKey - logoSize) / 2);
  const cardWidth = sizeKey;

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

  const radius = sizeKey * 0.18; // matches preview's borderRadius math
  const backgroundLayer = transparentBg
    ? ""
    : `<rect x="0" y="0" width="${cardWidth}" height="${sizeKey}" rx="${radius}" ry="${radius}"
            fill="#FFFFFF" fill-opacity="0.96" filter="url(#shadow)" />`;
  const logoShadow = transparentBg ? ` filter="url(#logoShadow)"` : "";

  const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${sizeKey}" viewBox="0 0 ${cardWidth} ${sizeKey}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${sizeKey * 0.06}" />
      <feOffset dx="0" dy="${sizeKey * 0.04}" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${sizeKey * 0.04}" />
      <feOffset dx="0" dy="${sizeKey * 0.03}" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${backgroundLayer}
  <image x="${padding}" y="${padding}"
         width="${logoSize}" height="${logoSize}"
         href="data:image/svg+xml;base64,${logoB64}"${logoShadow} />
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
