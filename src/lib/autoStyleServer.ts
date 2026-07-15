/**
 * Server-side auto-style for headless (WhatsApp) renders — the same "pick a
 * professional look for THIS video" behavior the browser editor has:
 *   1. a deterministic curated preset (template + accent) from the video's
 *      fingerprint, so different videos get different looks, and
 *   2. real dominant-color sampling (3 frames via ffmpeg) that overrides the
 *      preset accent when the footage is genuinely colorful — mirrors
 *      extractVideoAccent in src/app/page.tsx (canvas → ffmpeg rawvideo).
 *
 * KEEP THE PRESET TABLE IN SYNC with STYLE_PRESETS in src/app/page.tsx.
 */
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ffmpegStatic from "ffmpeg-static";
import type { EditMode, SubtitleStyle } from "@/lib/types";
import { TEMPLATES } from "@/lib/templates";
import { DEFAULT_HEADLESS_STYLE } from "@/lib/whatsappHeadless";

const STYLE_PRESETS: Record<string, { templateId: string; accent: string }[]> = {
  subtitles_only: [
    { templateId: "ali",     accent: "#FACC15" },
    { templateId: "minimal", accent: "#22D3EE" },
    { templateId: "ali",     accent: "#F472B6" },
    { templateId: "minimal", accent: "#34D399" },
    { templateId: "ali",     accent: "#A78BFA" },
    { templateId: "minimal", accent: "#FB923C" },
  ],
  podcast: [
    { templateId: "ali",     accent: "#FACC15" },
    { templateId: "minimal", accent: "#22D3EE" },
    { templateId: "ali",     accent: "#F472B6" },
    { templateId: "minimal", accent: "#A78BFA" },
  ],
  basic_effects: [
    { templateId: "tiktok",    accent: "#FACC15" },
    { templateId: "instagram", accent: "#FCD34D" },
    { templateId: "ali",       accent: "#22D3EE" },
    { templateId: "karaoke",   accent: "#EC4899" },
  ],
  advanced_effects: [
    { templateId: "hormozi",  accent: "#22C55E" },
    { templateId: "bold-pop", accent: "#FACC15" },
    { templateId: "tiktok",   accent: "#F472B6" },
    { templateId: "beast",    accent: "#FACC15" },
  ],
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function run(cmd: string, args: string[]): Promise<{ out: Buffer; code: number }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: true });
    const chunks: Buffer[] = [];
    p.stdout.on("data", (c) => chunks.push(c));
    p.on("close", (code) => resolve({ out: Buffer.concat(chunks), code: code ?? 1 }));
    p.on("error", () => resolve({ out: Buffer.alloc(0), code: 1 }));
  });
}

/** Sample 3 frames (20/50/80%) at 64x36 raw RGB and find the dominant hue —
 *  a straight port of the browser's extractVideoAccent. */
async function extractAccentServer(
  videoPath: string,
  durationSec: number,
): Promise<{ accent: string; colorfulness: number } | null> {
  const ffmpeg = (ffmpegStatic as unknown as string) || "ffmpeg";
  const W = 64, H = 36;
  const times = durationSec > 0.2
    ? [durationSec * 0.2, durationSec * 0.5, durationSec * 0.8]
    : [0];

  const hue = new Array(360).fill(0);
  let satAcc = 0, frames = 0;

  for (const tt of times) {
    const { out, code } = await run(ffmpeg, [
      "-ss", String(Math.max(0, tt)), "-i", videoPath,
      "-frames:v", "1", "-vf", `scale=${W}:${H}`,
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-v", "quiet", "pipe:1",
    ]);
    if (code !== 0 || out.length < W * H * 3) continue;
    let fs = 0, n = 0;
    for (let i = 0; i + 2 < out.length; i += 3) {
      const r = out[i] / 255, g = out[i + 1] / 255, b = out[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      const val = max, sat = max === 0 ? 0 : d / max;
      fs += sat; n++;
      if (sat > 0.25 && val > 0.2 && d > 0) {
        let h: number;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
        hue[Math.floor(h) % 360] += sat * val;
      }
    }
    if (n > 0) { satAcc += fs / n; frames++; }
  }
  if (frames === 0) return null;

  const colorfulness = satAcc / frames;
  let bestH = -1, bestV = 0;
  for (let h = 0; h < 360; h++) {
    let sum = 0;
    for (let k = -10; k <= 10; k++) sum += hue[(h + k + 360) % 360];
    if (sum > bestV) { bestV = sum; bestH = h; }
  }
  const accent = bestH >= 0 ? hslToHex(bestH, 0.85, 0.62) : "#FACC15";
  return { accent, colorfulness };
}

/**
 * Pick a professional look for a headless render: deterministic preset per
 * video + real footage color when it's colorful enough. Falls back to the
 * static default style on any failure — never throws.
 */
export async function autoStyleForVideo(
  videoBuf: Buffer,
  mode: EditMode,
  durationSec: number,
): Promise<{ templateId: string; style: SubtitleStyle }> {
  const presets = STYLE_PRESETS[mode] ?? STYLE_PRESETS.subtitles_only;
  const seed = hashStr(`${videoBuf.length}-${videoBuf.subarray(0, 256).toString("base64")}`);
  const preset = presets[seed % presets.length];

  let accent = preset.accent;
  const tmp = join(tmpdir(), `wa-style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
  try {
    await writeFile(tmp, videoBuf);
    const acc = await extractAccentServer(tmp, durationSec);
    if (acc && acc.colorfulness >= 0.28) accent = acc.accent;
  } catch { /* sampling failed — preset color stands */ }
  finally { unlink(tmp).catch(() => {}); }

  const base = TEMPLATES.find((t) => t.id === preset.templateId);
  const style: SubtitleStyle = base
    ? { ...base.style, position: "bottom", highlightColor: accent }
    : { ...DEFAULT_HEADLESS_STYLE, highlightColor: accent };
  return { templateId: preset.templateId, style };
}
