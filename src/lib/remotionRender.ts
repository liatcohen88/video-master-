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
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { CompositionProps } from "@/remotion/VideoComposition";

let cachedBundleUrl: string | null = null;

async function getBundle(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
  cachedBundleUrl = await bundle({
    entryPoint,
    // No webpack overrides yet — defaults handle TS + Tailwind classes
    // fine for our simple composition. Add when we need next/font etc.
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
  });
}
