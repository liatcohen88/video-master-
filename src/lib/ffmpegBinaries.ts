/**
 * Resolve absolute paths to the ffmpeg and ffprobe binaries.
 *
 * Priority:
 *   1. `FFMPEG_PATH` / `FFPROBE_PATH` env vars (local dev override)
 *   2. Bundled binaries from `ffmpeg-static` / `ffprobe-static` (production)
 *   3. Bare `ffmpeg` / `ffprobe` (assumes system PATH)
 *
 * On Vercel/Linux the bundled binaries from the static packages just work.
 * Locally on Windows, FFMPEG_PATH wins so the dev's own install is used.
 */

// These packages export the absolute path to the binary as the default export.
// Using `require` avoids ESM/CJS interop quirks for these specific packages.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegStatic = require("ffmpeg-static") as string | null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffprobeStatic = require("ffprobe-static") as { path: string } | null;

export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && process.env.FFMPEG_PATH !== "ffmpeg") {
    return process.env.FFMPEG_PATH;
  }
  if (ffmpegStatic) return ffmpegStatic;
  return "ffmpeg";
}

export function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  // If FFMPEG_PATH is set explicitly (local dev), derive ffprobe from it
  // so both binaries come from the same install.
  if (process.env.FFMPEG_PATH && process.env.FFMPEG_PATH !== "ffmpeg") {
    return process.env.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, (m) =>
      m.replace("ffmpeg", "ffprobe"),
    );
  }
  if (ffprobeStatic?.path) return ffprobeStatic.path;
  return "ffprobe";
}
