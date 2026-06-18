/**
 * Server-side Remotion render — bundle the composition with a per-request
 * publicDir so the source video is part of the bundle and Chromium can
 * load it via http://<bundle-server>/input.mp4.
 *
 * Why no bundle cache: @remotion/bundler v4 COPIES publicDir contents into
 * the bundle at build time. Files written to publicDir AFTER bundle() are
 * invisible to the served bundle. So either we bundle per request (3-5s
 * overhead) OR we proxy file requests ourselves. Per-request bundling is
 * the simplest, and Liat's renders take 30-60s anyway — 5s is a rounding
 * error.
 */

import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { CompositionProps } from "@/remotion/VideoComposition";

export type RemotionRenderArgs = {
  inputProps: CompositionProps;
  /** The source video file as a Buffer; written into the per-render publicDir. */
  videoBuffer: Buffer;
  /** The filename to write the video as inside publicDir (matches
   *  inputProps.videoSrc which the composition passes to staticFile()). */
  videoFileName: string;
  outPath: string;
};

export async function renderViaRemotion({
  inputProps, videoBuffer, videoFileName, outPath,
}: RemotionRenderArgs): Promise<void> {
  // Per-request publicDir so the input video is bundled IN.
  const publicDir = path.join(path.dirname(outPath), "public");
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, videoFileName), videoBuffer);

  const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
  const serveUrl = await bundle({ entryPoint, publicDir });

  try {
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
      crf: 18,
      concurrency: 1,
      browserExecutable: process.env.CHROME_BIN,
      chromiumOptions: {
        // Belt-and-suspenders — kept from earlier file:// debugging.
        disableWebSecurity: true,
      },
      // CX23 has 2 vCPU + 4GB RAM, and headless Chromium decoding a
      // 1080×1920 video frame-by-frame is slow. The default 28s
      // delayRender timeout fires before each frame finishes decoding.
      // 120s gives realistic headroom — actual frame work is much
      // shorter, this just stops the timeout-on-slow-frame failures.
      delayRenderTimeoutInMilliseconds: 120_000,
    });
  } finally {
    // The bundle directory is under tmp; remove it so /tmp doesn't fill.
    rm(serveUrl, { recursive: true, force: true }).catch(() => {});
  }
}
