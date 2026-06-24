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
  /** Optional background-music file. Staged into publicDir like the video so
   *  the composition can load it via staticFile() — the same proven path as
   *  the source video, instead of a fragile audio data: URL. The caller must
   *  set inputProps.effects.bgMusicUrl to this same filename. */
  bgMusicBuffer?: Buffer;
  bgMusicFileName?: string;
  outPath: string;
  /** Called as frames render — used by the background-job runner to heartbeat
   *  the job so a long (but healthy) render isn't mistaken for a dead one. */
  onProgress?: (p: { renderedFrames: number; totalFrames: number }) => void;
};

export async function renderViaRemotion({
  inputProps, videoBuffer, videoFileName, bgMusicBuffer, bgMusicFileName, outPath, onProgress,
}: RemotionRenderArgs): Promise<void> {
  // Use the project's REAL public/ dir as the bundle publicDir. It already
  // holds sfx/, lottie/, custom-logos/ etc., so every staticFile() the
  // composition references (SFX audio, Lottie JSON, logos) resolves exactly
  // like the live site. A throwaway tmp publicDir only had the input video,
  // so SFX 404'd ("Error while downloading .../sfx/sfx_1109.mp3").
  // We drop the per-render input video INTO public/ with a unique name and
  // remove just that file afterwards (sfx/lottie stay untouched).
  const publicDir = path.join(process.cwd(), "public");
  const stagedVideoPath = path.join(publicDir, videoFileName);
  await mkdir(publicDir, { recursive: true });
  await writeFile(stagedVideoPath, videoBuffer);

  // Stage the optional bg-music file alongside the video so staticFile()
  // resolves it from the bundle. Cleaned up in finally like the video.
  let stagedMusicPath: string | null = null;
  if (bgMusicBuffer && bgMusicFileName) {
    stagedMusicPath = path.join(publicDir, bgMusicFileName);
    await writeFile(stagedMusicPath, bgMusicBuffer);
  }

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
      // Quality: crf 23 is visually ~identical to 18 for social video but
      // encodes faster and yields a smaller file. JPEG intermediate frames
      // (quality 90) capture MUCH faster than the default PNG — the per-frame
      // capture was a big chunk of the render time. Both are standard Remotion
      // speed levers and don't change the on-screen result meaningfully.
      // crf 20 (was 23) = noticeably sharper for text/subtitles at the same
      // resolution. CRF affects only the final H.264 encode pass (fast) — NOT
      // the per-frame Chromium render (the real cost) — so this is a quality
      // win with negligible time impact. jpegQuality 92 sharpens the captured
      // intermediate frames a touch.
      crf: 20,
      imageFormat: "jpeg",
      jpegQuality: 92,
      // Faster H.264 encode preset — the encode phase is pure speed-up with a
      // negligible size/quality cost for social video (the frame RENDER, not
      // encode, is the real cost — see the 1280-cap in the route).
      x264Preset: "faster",
      // The box ALSO serves the live site, so we never use all cores — leave a
      // couple free for Next + transcription. On the 4-vCPU box concurrency 3
      // was the ceiling (4 starved the site). After resizing to a 16-vCPU box
      // (CX52), set RENDER_CONCURRENCY=12 in Coolify env — no rebuild needed —
      // to roughly 3-4× the render speed while keeping ~4 cores for the site.
      // Default stays 3 so it's always safe on the small box.
      concurrency: Number(process.env.RENDER_CONCURRENCY) || 3,
      browserExecutable: process.env.CHROME_BIN,
      chromiumOptions: {
        // Belt-and-suspenders — kept from earlier file:// debugging.
        disableWebSecurity: true,
        // Force software rendering. Default Chromium tries to use GPU/ANGLE
        // which doesn't exist in a Docker container without a display
        // server — the renderer process crashes mid-decode (visible as
        // <defunct> chrome-headless zombies in ps). swangle = SwiftShader
        // + ANGLE, pure CPU rasterization.
        gl: "swangle",
        // Run Chrome multi-process. Remotion's Linux default is
        // --single-process, which crashes decoding <Video> (the silent
        // mid-frame death we saw — zombie chrome-headless procs, render
        // never advances past frame 0). Multi-process is the documented
        // production setting; it needs shared memory, so the container is
        // launched with --shm-size=2g (Coolify custom_docker_run_options).
        enableMultiProcessOnLinux: true,
      },
      // CX23 has 2 vCPU + 4GB RAM, and headless Chromium decoding a
      // 1080×1920 video frame-by-frame is slow. The default 28s
      // delayRender timeout fires before each frame finishes decoding.
      // 120s gives realistic headroom — actual frame work is much
      // shorter, this just stops the timeout-on-slow-frame failures.
      // The option name in @remotion/renderer v4 is `timeoutInMilliseconds`
      // (NOT delayRenderTimeoutInMilliseconds — that was silently ignored
      // last attempt, all renders kept failing at exactly 28000ms).
      timeoutInMilliseconds: 120_000,
      onProgress: onProgress
        ? ({ renderedFrames }) => onProgress({ renderedFrames, totalFrames: composition.durationInFrames })
        : undefined,
    });
  } finally {
    // The bundle directory is under tmp; remove it so /tmp doesn't fill.
    rm(serveUrl, { recursive: true, force: true }).catch(() => {});
    // Remove ONLY the staged input video from public/ — never the dir
    // itself (sfx/lottie/logos live there and must persist).
    rm(stagedVideoPath, { force: true }).catch(() => {});
    if (stagedMusicPath) rm(stagedMusicPath, { force: true }).catch(() => {});
  }
}
