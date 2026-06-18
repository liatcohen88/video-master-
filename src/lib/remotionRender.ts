/**
 * Server-side Remotion render — bundle the composition, then ask headless
 * Chromium to draw every frame and stitch them into an MP4. This is the
 * parity-guaranteed alternative to the FFmpeg filter graph in
 * `/api/render`. The two paths coexist behind EXPORT_ENGINE so we can roll
 * Remotion out per-request without breaking paying customers.
 *
 * Performance note: the bundler step is expensive on cold start (~3-5s on
 * CCX13). Cache the bundle URL between requests once the entry hasn't
 * changed — production should hit the cache for every render after the
 * first one post-deploy.
 */

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { CompositionProps } from "@/remotion/VideoComposition";

let cachedBundleUrl: string | null = null;

/**
 * Fixed directory that Remotion serves at the bundle root via http://...
 * Each render writes its input video here (the route is concurrency:1 so a
 * stable filename is fine). file:// URLs don't work — headless Chromium
 * rejects them with ERR_UNKNOWN_URL_SCHEME. Bundling with a publicDir
 * means the same files become reachable as http://serve/input.mp4 etc.
 */
export const REMOTION_PUBLIC_DIR = path.join(tmpdir(), "remotion-public");

async function getBundle(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  await mkdir(REMOTION_PUBLIC_DIR, { recursive: true });
  const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
  cachedBundleUrl = await bundle({
    entryPoint,
    publicDir: REMOTION_PUBLIC_DIR,
  });
  return cachedBundleUrl;
}

export type RemotionRenderArgs = {
  inputProps: CompositionProps;
  outPath: string;
};

export async function renderViaRemotion({ inputProps, outPath }: RemotionRenderArgs): Promise<void> {
  const serveUrl = await getBundle();
  const composition = await selectComposition({
    serveUrl,
    id: "VideoComposition",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outPath,
    inputProps,
    // CRF 18 = visually lossless — matches what the FFmpeg path uses.
    // Adjust later if file size becomes an issue.
    crf: 18,
    // Single-process for now; we'll tune concurrency once the PoC is green.
    concurrency: 1,
    // CHROME_BIN points to the system chromium installed via Nixpacks. On
    // dev machines it's unset → Remotion falls back to its bundled Headless
    // Shell (one-time download to ~/.cache/remotion).
    browserExecutable: process.env.CHROME_BIN,
    chromiumOptions: {
      // We pass the source video as `file:///tmp/...` via inputProps. The
      // bundle is served from http://localhost so Chromium blocks the
      // cross-protocol load with "Not allowed to load local resource".
      // disableWebSecurity drops the same-origin check just for THIS
      // headless render — no security impact (Chromium isn't exposed).
      disableWebSecurity: true,
    },
  });
}
