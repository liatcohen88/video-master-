/**
 * Server-side overlay renderer (Node only — uses @napi-rs/canvas).
 *
 * Renders subtitles, emojis and logos to transparent PNGs that match the
 * browser live-preview pixel-for-pixel. FFmpeg then composites these PNGs
 * over the video with per-element timing. This is the ONLY reliable way to
 * guarantee "export === preview": the PNG literally IS the styled element.
 *
 * Why not ASS/libass? Per-word color overrides break Hebrew bidi in libass,
 * and its emoji/font rendering differs from the browser. Canvas gives us the
 * same font + RTL + stroke + shadow as CSS.
 */

import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { Subtitle, SubtitleStyle } from "./types";

// ── Font registration (once per process) ────────────────────────────────
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const dir = join(process.cwd(), "assets", "fonts");
  const reg = (file: string, family: string) => {
    const p = join(dir, file);
    if (existsSync(p)) {
      try { GlobalFonts.registerFromPath(p, family); } catch { /* ignore */ }
    }
  };
  // Family names here MUST match SubtitleStyle.fontFamily values
  reg("Heebo-Regular.ttf", "Heebo");
  reg("Rubik.ttf", "Rubik");
  reg("Assistant.ttf", "Assistant");
  reg("VarelaRound-Regular.ttf", "Varela Round");
  reg("SecularOne-Regular.ttf", "Secular One");
  reg("SuezOne-Regular.ttf", "Suez One");
  reg("FrankRuhlLibre.ttf", "Frank Ruhl Libre");
  reg("Bellefair-Regular.ttf", "Bellefair");
  fontsRegistered = true;
}

function hexToRgba(hex: string, alpha = 1): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type SubtitleFrame = {
  /** PNG buffer of the rendered subtitle */
  png: Buffer;
  /** Pixel dimensions of the PNG */
  width: number;
  height: number;
  /** When to show (output timeline seconds) */
  start: number;
  end: number;
  /** Center X / bottom Y anchor in OUTPUT video pixels */
  centerX: number;
  /** Y of the TOP of the PNG in output pixels */
  top: number;
};

// ── Overlay-track placement specs (for the fast single-MOV path) ─────────
export type TrackEmoji = {
  pngPath: string;
  /** center X/Y in output pixels */
  cx: number;
  cy: number;
  size: number;
  start: number;
  end: number;
};
export type TrackBrand = {
  pngPath: string;
  /** top-left X/Y + draw size in output pixels */
  x: number;
  y: number;
  w: number;
  h: number;
  start: number;
  end: number;
};

/**
 * FAST PATH: composite the ENTIRE overlay layer (subtitles + emoji + brand)
 * into ONE transparent MOV. This replaces hundreds of per-element FFmpeg
 * overlay inputs with a single overlay → exports go from minutes to seconds.
 *
 * Unique subtitle state PNGs + emoji/brand PNGs are loaded once and cached;
 * each frame just drawImages the visible ones. Frames render at `fps` (12 is
 * plenty for word highlighting) to keep the count low.
 */
export async function renderOverlayTrackMov(opts: {
  workDir: string;
  subtitles: Subtitle[];
  style: SubtitleStyle;
  emojis: TrackEmoji[];
  brands: TrackBrand[];
  videoWidth: number;
  videoHeight: number;
  durationSec: number;
  fps?: number;
  ffmpegPath: string;
}): Promise<string | null> {
  const { workDir, subtitles, style, emojis, brands, videoWidth, videoHeight, durationSec, ffmpegPath } = opts;
  const fps = opts.fps ?? 12;
  ensureFonts();

  // Pre-render unique subtitle state images and index them by time.
  const subFrames = renderSubtitleFrames(subtitles, style, videoWidth, videoHeight);
  type LoadedSub = { img: Awaited<ReturnType<typeof loadImage>>; x: number; y: number; start: number; end: number };
  const loadedSubs: LoadedSub[] = [];
  for (const f of subFrames) {
    try {
      const img = await loadImage(f.png);
      loadedSubs.push({ img, x: Math.round(f.centerX - f.width / 2), y: f.top, start: f.start, end: f.end });
    } catch { /* skip */ }
  }

  // Load emoji + brand PNGs once
  const loadedEmoji = await Promise.all(emojis.map(async (e) => {
    try { return { img: await loadImage(e.pngPath), e }; } catch { return null; }
  }));
  const loadedBrand = await Promise.all(brands.map(async (b) => {
    try { return { img: await loadImage(b.pngPath), b }; } catch { return null; }
  }));

  if (loadedSubs.length === 0 && loadedEmoji.filter(Boolean).length === 0 && loadedBrand.filter(Boolean).length === 0) {
    return null; // nothing to draw
  }

  const canvas = createCanvas(videoWidth, videoHeight);
  const ctx = canvas.getContext("2d");
  const movPath = join(workDir, "overlay-track.mov");

  // SEGMENT approach: the overlay only CHANGES at discrete moments (a subtitle
  // word switches, an emoji appears/disappears). So instead of rendering a
  // frame every 1/fps second (thousands of frames), we collect all change
  // boundaries and render ONE frame per segment — typically ~100-300 frames
  // for a whole video instead of thousands. We then build a variable-duration
  // video via the concat demuxer. This is the big speed win for long videos.
  const boundaries = new Set<number>([0, durationSec]);
  for (const ls of loadedSubs) { boundaries.add(ls.start); boundaries.add(ls.end); }
  for (const le of loadedEmoji) { if (le) { boundaries.add(le.e.start); boundaries.add(le.e.end); } }
  for (const lb of loadedBrand) { if (lb) { boundaries.add(lb.b.start); boundaries.add(lb.b.end); } }
  const times = Array.from(boundaries).filter((t) => t >= 0 && t <= durationSec).sort((a, b) => a - b);

  const framesDir = join(workDir, "track");
  await mkdir(framesDir, { recursive: true });
  const concatLines: string[] = [];
  let frameIdx = 0;

  for (let si = 0; si < times.length - 1; si++) {
    const segStart = times[si];
    const segEnd = times[si + 1];
    const dur = segEnd - segStart;
    if (dur <= 0.0001) continue;
    const mid = (segStart + segEnd) / 2;

    ctx.clearRect(0, 0, videoWidth, videoHeight);
    const s = loadedSubs.find((ls) => mid >= ls.start && mid < ls.end);
    if (s) ctx.drawImage(s.img, s.x, s.y);
    for (const lb of loadedBrand) {
      if (lb && mid >= lb.b.start && mid < lb.b.end) ctx.drawImage(lb.img, lb.b.x, lb.b.y, lb.b.w, lb.b.h);
    }
    for (const le of loadedEmoji) {
      if (le && mid >= le.e.start && mid < le.e.end) {
        ctx.drawImage(le.img, Math.round(le.e.cx - le.e.size / 2), Math.round(le.e.cy - le.e.size / 2), le.e.size, le.e.size);
      }
    }
    const fname = `f${String(frameIdx++).padStart(5, "0")}.png`;
    await writeFile(join(framesDir, fname), canvas.toBuffer("image/png"));
    concatLines.push(`file '${fname}'`, `duration ${dur.toFixed(4)}`);
  }
  // concat demuxer needs the last file repeated (no duration) to flush
  if (frameIdx > 0) concatLines.push(`file 'f${String(frameIdx - 1).padStart(5, "0")}.png'`);
  if (frameIdx === 0) { await rm(framesDir, { recursive: true, force: true }).catch(() => {}); return null; }

  const listPath = join(framesDir, "list.txt");
  await writeFile(listPath, concatLines.join("\n"));

  const ok = await new Promise<boolean>((resolve) => {
    const p = spawn(ffmpegPath, [
      "-y", "-f", "concat", "-safe", "0", "-i", listPath,
      "-vsync", "vfr", "-c:v", "qtrle", "-pix_fmt", "argb", movPath,
    ]);
    let e = ""; p.stderr.on("data", (d) => (e += d.toString()));
    p.on("close", (c) => { if (c) console.error("track encode fail:", e.slice(-200)); resolve(c === 0); });
    p.on("error", () => resolve(false));
  });
  await rm(framesDir, { recursive: true, force: true }).catch(() => {});
  return ok && existsSync(movPath) ? movPath : null;
}

/**
 * Render every (subtitle × active-word) state to a PNG. Each state is shown
 * during its word's time window → reproduces the live word-by-word highlight.
 *
 * Returns a flat list of timed PNG frames ready for FFmpeg overlay.
 */
export function renderSubtitleFrames(
  subtitles: Subtitle[],
  style: SubtitleStyle,
  videoWidth: number,
  videoHeight: number,
): SubtitleFrame[] {
  ensureFonts();
  const frames: SubtitleFrame[] = [];

  // Scale from the 1080p design space to the actual output height
  const scale = videoHeight / 1080;
  const fontSize = Math.round(style.fontSize * scale);
  const strokeW = style.strokeWidth * scale;
  const offset = style.positionOffset * scale;
  const maxWidth = videoWidth * 0.9;

  const fontFamily = style.fontFamily;
  const weight = style.fontWeight;

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;
    const words = sub.words && sub.words.length > 0
      ? sub.words
      : sub.text.split(/\s+/).filter(Boolean).map((w, i, arr) => {
          const dur = sub.end - sub.start;
          return {
            word: w,
            start: sub.start + (i / arr.length) * dur,
            end: sub.start + ((i + 1) / arr.length) * dur,
          };
        });

    const highlightSame =
      style.highlightColor.toLowerCase() === style.color.toLowerCase();

    // One PNG per "active word" state (or a single PNG if no highlight)
    const states = highlightSame ? [{ activeIdx: -1, start: sub.start, end: sub.end }]
      : words.map((w, i) => ({ activeIdx: i, start: w.start, end: w.end }));

    // Merge the gap before the first word into the first state
    if (states.length > 0) states[0].start = sub.start;
    if (states.length > 0) states[states.length - 1].end = sub.end;

    for (const st of states) {
      const rendered = renderOneSubtitle({
        words: words.map((w) => w.word),
        activeIdx: st.activeIdx,
        style, fontSize, strokeW, fontFamily, weight, maxWidth,
      });
      if (!rendered) continue;

      // Vertical anchor
      let top: number;
      if (style.position === "top") top = offset;
      else if (style.position === "middle") top = videoHeight / 2 - rendered.height / 2 + offset;
      else top = videoHeight - rendered.height - offset;

      frames.push({
        png: rendered.png,
        width: rendered.width,
        height: rendered.height,
        start: st.start,
        end: st.end,
        centerX: videoWidth / 2,
        top: Math.round(top),
      });
    }
  }

  return frames;
}

function renderOneSubtitle(opts: {
  words: string[];
  activeIdx: number;
  style: SubtitleStyle;
  fontSize: number;
  strokeW: number;
  fontFamily: string;
  weight: number;
  maxWidth: number;
}): { png: Buffer; width: number; height: number } | null {
  const { words, activeIdx, style, fontSize, strokeW, fontFamily, weight, maxWidth } = opts;

  const fontSpec = `${weight >= 700 ? "bold" : "normal"} ${fontSize}px "${fontFamily}", "Heebo", sans-serif`;
  const wordGap = fontSize * 0.28;
  const padX = fontSize * 0.5 + strokeW;
  const padY = fontSize * 0.35 + strokeW;
  const lineHeight = fontSize * 1.25;

  // Measure with a scratch context
  const scratch = createCanvas(10, 10).getContext("2d");
  scratch.font = fontSpec;
  const measured = words.map((w) => Math.ceil(scratch.measureText(w).width));

  // Word-wrap into lines that fit maxWidth (RTL handled at draw time)
  const lines: { idxs: number[]; width: number }[] = [];
  let cur: number[] = [];
  let curW = 0;
  for (let i = 0; i < words.length; i++) {
    const ww = measured[i];
    const add = (cur.length ? wordGap : 0) + ww;
    if (curW + add > maxWidth - padX * 2 && cur.length) {
      lines.push({ idxs: cur, width: curW });
      cur = [i]; curW = ww;
    } else {
      cur.push(i); curW += add;
    }
  }
  if (cur.length) lines.push({ idxs: cur, width: curW });

  const contentW = Math.max(...lines.map((l) => l.width));
  const W = Math.ceil(contentW + padX * 2);
  const H = Math.ceil(lines.length * lineHeight + padY * 2);
  if (W <= 0 || H <= 0) return null;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background box (if any)
  if (style.backgroundOpacity > 0) {
    ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity);
    const r = fontSize * 0.25;
    roundRect(ctx, 0, 0, W, H, r);
    ctx.fill();
  }

  ctx.font = fontSpec;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  // FULL RTL bidi: with direction "rtl" each token's internal punctuation
  // (?, ., ,) is placed on the correct (left) side for Hebrew. We anchor each
  // word by its RIGHT edge (textAlign "right") and walk right→left.
  ctx.direction = "rtl";
  ctx.textAlign = "right";

  lines.forEach((line, li) => {
    const y = padY + li * lineHeight + lineHeight / 2;
    // CENTER each line within the PNG (matches the live preview's
    // textAlign:center). Previously every line was right-anchored at W-padX,
    // so a short 2nd line hugged the right edge and — once the PNG was centered
    // over the video — appeared pushed to the side. Centering each line keeps
    // export === preview for multi-line subtitles too.
    let xRight = Math.round((W + line.width) / 2);
    for (const idx of line.idxs) {
      const word = words[idx];
      const ww = measured[idx];
      const isActive = idx === activeIdx;
      const fill = isActive ? style.highlightColor : style.color;

      // Shadow
      if (style.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = fontSize * 0.18;
        ctx.shadowOffsetY = fontSize * 0.06;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      }

      // Stroke first (paint-order: stroke fill). textAlign="right" anchors the
      // word at xRight; direction="rtl" lays out its glyphs correctly.
      if (strokeW > 0) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = strokeW * 2;
        ctx.strokeText(word, xRight, y);
      }
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = fill;
      ctx.fillText(word, xRight, y);

      xRight -= ww + wordGap;
    }
  });

  return { png: canvas.toBuffer("image/png"), width: W, height: H };
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
