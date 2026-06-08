/**
 * Chroma-key background removal for logo images.
 *
 * Algorithm:
 *   1. Read the image as raw RGBA.
 *   2. Sample the 4 corner pixels — assume they are all background.
 *   3. Compute the average corner color → that's the "key color".
 *   4. For every pixel, measure RGB distance to the key color.
 *      - dist < hardThreshold       → fully transparent (clean cut)
 *      - hardThreshold..softThreshold → gradient alpha (anti-aliased edge)
 *      - dist > softThreshold       → kept as-is
 *   5. Encode back to PNG (PNG is the only format with reliable alpha).
 *
 * Works great for solid-color logo backgrounds (white, black, green-screen).
 * Won't work for complex backgrounds (use AI segmentation for those).
 *
 * SVG inputs are returned unchanged because vectors have native transparency.
 */

import sharp from "sharp";

const HARD_THRESHOLD = 35;  // close enough to key → fully transparent
const SOFT_THRESHOLD = 70;  // beyond this distance → keep pixel intact

export async function removeBackground(buffer: Buffer): Promise<Buffer> {
  // ensureAlpha keeps any existing alpha channel and adds one if missing.
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected 4 channels (RGBA), got ${channels}`);
  }

  // Sample 4 corner pixels (5x5 average each for robustness)
  function sampleAvg(cx: number, cy: number) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.max(0, Math.min(width - 1, cx + dx));
        const y = Math.max(0, Math.min(height - 1, cy + dy));
        const off = (y * width + x) * 4;
        // Skip already-transparent pixels — they don't represent the bg color.
        if (data[off + 3] < 200) continue;
        r += data[off];
        g += data[off + 1];
        b += data[off + 2];
        n++;
      }
    }
    return n > 0 ? { r: r / n, g: g / n, b: b / n, valid: true } : { r: 0, g: 0, b: 0, valid: false };
  }

  const corners = [
    sampleAvg(2, 2),
    sampleAvg(width - 3, 2),
    sampleAvg(2, height - 3),
    sampleAvg(width - 3, height - 3),
  ].filter((c) => c.valid);

  if (corners.length === 0) {
    // All corners are already transparent — no background to remove.
    return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  // Average all valid corners
  const keyR = corners.reduce((s, c) => s + c.r, 0) / corners.length;
  const keyG = corners.reduce((s, c) => s + c.g, 0) / corners.length;
  const keyB = corners.reduce((s, c) => s + c.b, 0) / corners.length;

  // Walk the buffer and adjust alpha based on color distance to key.
  // Use a fresh buffer so we don't mutate sharp's internal data.
  const out = Buffer.alloc(data.length);
  data.copy(out);

  for (let i = 0; i < out.length; i += 4) {
    // Preserve already-transparent pixels
    if (out[i + 3] === 0) continue;

    const dr = out[i] - keyR;
    const dg = out[i + 1] - keyG;
    const db = out[i + 2] - keyB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist < HARD_THRESHOLD) {
      // Cut
      out[i + 3] = 0;
    } else if (dist < SOFT_THRESHOLD) {
      // Anti-aliased edge — gradient alpha
      const t = (dist - HARD_THRESHOLD) / (SOFT_THRESHOLD - HARD_THRESHOLD);
      out[i + 3] = Math.round(out[i + 3] * t);
    }
    // else: pixel intact
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
