/**
 * Render an MP4 on AWS Lambda (Remotion Lambda) instead of locally.
 *
 * Why: the local CX33 box renders frame-by-frame on 4 shared cores (~5.5min
 * for a 29s clip, serialized queue). Lambda splits the video across many
 * parallel functions → ~5-8x faster, auto-scales to many concurrent users, and
 * costs pennies per render instead of a fixed monthly server bump.
 *
 * Flow: upload the user's source video to the Remotion S3 bucket → presign a
 * GET URL → renderMediaOnLambda with videoSrc=that URL (the composition's
 * OffthreadVideo already accepts a full URL) → poll progress → download the
 * finished MP4 to `outPath` so the existing render-result delivery is unchanged.
 *
 * Gated by REMOTION_LAMBDA=1 in env; the local renderer stays the default.
 */
import { renderMediaOnLambda, getRenderProgress, presignUrl } from "@remotion/lambda/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile } from "node:fs/promises";
import type { CompositionProps } from "@/remotion/VideoComposition";
import type { VideoEffects } from "@/lib/types";

type AwsRegion = Parameters<typeof renderMediaOnLambda>[0]["region"];

const REGION = (process.env.AWS_REGION || "eu-central-1") as AwsRegion;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME ?? "";
const SERVE_URL = process.env.REMOTION_SERVE_URL ?? "";

function creds() {
  return {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
  };
}

/** True when Lambda rendering is configured + enabled. */
export function lambdaEnabled(): boolean {
  return process.env.REMOTION_LAMBDA === "1" && !!FUNCTION_NAME && !!SERVE_URL && !!creds().accessKeyId;
}

export type LambdaRenderArgs = {
  inputProps: CompositionProps;
  videoBuffer: Buffer;
  videoFileName: string;
  /** Optional bg-music: uploaded to S3 too so the composition can load it by URL. */
  bgMusicBuffer?: Buffer;
  bgMusicFileName?: string;
  outPath: string;
  onProgress?: (p: { renderedFrames: number; totalFrames: number }) => void;
};

export async function renderViaLambda({
  inputProps, videoBuffer, videoFileName, bgMusicBuffer, bgMusicFileName, outPath, onProgress,
}: LambdaRenderArgs): Promise<void> {
  const bucketName = process.env.REMOTION_BUCKET_NAME ?? "";
  const s3 = new S3Client({ region: REGION, credentials: creds() });

  // 1. Upload the source video (and optional music) to S3, presign GET URLs.
  const stamp = Date.now();
  const put = async (key: string, body: Buffer, type: string) => {
    await s3.send(new PutObjectCommand({ Bucket: bucketName, Key: key, Body: body, ContentType: type }));
    return presignUrl({ region: REGION, bucketName, objectKey: key, expiresInSeconds: 3600, checkIfObjectExists: false });
  };
  const videoUrl = await put(`inputs/${stamp}-${videoFileName}`, videoBuffer, "video/mp4");
  const effects: VideoEffects | null = inputProps.effects ? { ...inputProps.effects } : null;
  if (bgMusicBuffer && bgMusicFileName && effects) {
    effects.bgMusicUrl = await put(`inputs/${stamp}-${bgMusicFileName}`, bgMusicBuffer, "audio/mpeg");
  }

  // 2. Fire the Lambda render. videoSrc/bgMusicUrl are now full URLs the
  //    composition resolves directly (no staticFile needed on Lambda).
  const props: CompositionProps = { ...inputProps, videoSrc: videoUrl, effects };
  const { renderId, bucketName: outBucket } = await renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SERVE_URL,
    composition: "VideoComposition",
    inputProps: props,
    codec: "h264",
    imageFormat: "jpeg",
    jpegQuality: 92,
    crf: 20,
    privacy: "public",
    downloadBehavior: { type: "play-in-browser" },
  });

  // 3. Poll until done, forwarding progress to the existing job heartbeat.
  const totalFrames = Math.max(1, Math.round((inputProps.durationSec || 0) * (inputProps.fps || 30)));
  for (;;) {
    const p = await getRenderProgress({ renderId, bucketName: outBucket, functionName: FUNCTION_NAME, region: REGION });
    if (p.fatalErrorEncountered) {
      throw new Error(p.errors?.[0]?.message || "Lambda render failed");
    }
    if (onProgress) {
      onProgress({ renderedFrames: p.framesRendered ?? Math.round((p.overallProgress || 0) * totalFrames), totalFrames });
    }
    if (p.done) {
      // 4. Download the finished MP4 to outPath (existing delivery is unchanged).
      const url = p.outputFile;
      if (!url) throw new Error("Lambda render finished without an output file");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download of Lambda output failed: ${res.status}`);
      await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
