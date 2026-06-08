/**
 * Server-side Lottie → transparent MOV renderer (FREE, no browser).
 *
 * The actual rendering runs in a SEPARATE Node process (scripts/render-lottie.cjs)
 * because lottie-web needs a DOM shim that would otherwise pollute the Next.js
 * server's globals and break SSR. Spawning isolates it cleanly.
 *
 * Output is a transparent qtrle MOV cached by (id, size, duration, color).
 * All local + free.
 */

import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const CACHE_DIR = join(process.cwd(), "cache", "lottie");

export type LottieRenderResult = { movPath: string; fps: number };

export async function renderLottieToMov(opts: {
  jsonPath: string;       // public/-relative or absolute path
  id: string;             // cache key component
  size: number;
  durationSec: number;
  color?: string;
  fps?: number;
}): Promise<LottieRenderResult | null> {
  const { jsonPath, id, size, durationSec } = opts;
  const fps = opts.fps ?? 24;
  await mkdir(CACHE_DIR, { recursive: true });

  const colorKey = opts.color ? opts.color.replace("#", "") : "orig";
  const movPath = join(CACHE_DIR, `${id}-${size}-${Math.round(durationSec * 10)}-${colorKey}.mov`);
  if (existsSync(movPath)) return { movPath, fps };

  const absJson = jsonPath.startsWith("/")
    ? join(process.cwd(), "public", jsonPath.replace(/^\//, ""))
    : jsonPath;
  if (!existsSync(absJson)) return null;

  const script = join(process.cwd(), "scripts", "render-lottie.cjs");
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

  const ok = await new Promise<boolean>((resolve) => {
    const proc = spawn(process.execPath, [
      script, absJson, movPath, String(size), String(fps),
      String(durationSec), colorKey === "orig" ? "orig" : `#${colorKey}`, ffmpeg,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", () => {});
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 && out.includes("OK"));
    });
    proc.on("error", () => { clearTimeout(timer); resolve(false); });
    // Hard timeout: a stuck Lottie render must NEVER hang the whole export.
    // 25 sec is plenty even for a 3-sec / 24fps icon; anything beyond is a hang.
    const timer = setTimeout(() => {
      console.error(`[lottie] watchdog killing ${id} (>25s)`);
      try { proc.kill("SIGKILL"); } catch {}
      resolve(false);
    }, 25_000);
  });

  if (!ok || !existsSync(movPath)) return null;
  return { movPath, fps };
}
