/**
 * Remotion entry — registers every composition. Bundled by @remotion/bundler
 * at render time. The single composition we ship today is `VideoComposition`;
 * it's data-driven via inputProps so every render is a different video.
 *
 * Why Remotion: the existing FFmpeg export pipeline and the live React/CSS
 * preview have drifted to the point where users see one thing in the editor
 * and a different thing in the exported MP4 (subtitle styling missing,
 * emojis offset, drama filter inconsistent). Remotion renders the SAME
 * React component on both sides — server-side headless Chromium for export,
 * <Player> in the future for live preview — guaranteeing pixel parity.
 *
 * This file is intentionally tiny — the heavy lifting is in
 * `VideoComposition.tsx`. Keep it that way so the bundler entry stays fast.
 */

import { Composition, staticFile } from "remotion";
import { VideoComposition, type CompositionProps } from "./VideoComposition";
import { DEFAULT_EFFECTS } from "../lib/types";

// Defaults are only used when Remotion Studio is opened with no inputProps
// (i.e. during local development / preview). Production renders always
// override these via `inputProps`.
// Sample subtitles cycle through the visual treatments so Studio shows
// every style in one preview pass:
//   0.5-2.5s  → plain subtitle (baseline)
//   3.0-5.0s  → drama trigger ("אין מצב") — B&W filter expected
//   5.5-7.5s  → wow trigger ("מטורף") — warm pop filter expected
const DEFAULT_PROPS: CompositionProps = {
  videoSrc: staticFile("demo.mp4"),
  subtitles: [
    { id: "s1", start: 0.5, end: 2.5, text: "שלום, זו דוגמה ראשונה" },
    { id: "s2", start: 3.0, end: 5.0, text: "אין מצב שזה קרה!" },
    { id: "s3", start: 5.5, end: 7.5, text: "מטורף, ממש מטורף" },
  ],
  style: {
    fontFamily: "Heebo, system-ui, sans-serif",
    fontSize: 96,
    fontWeight: 800,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 4,
    backgroundColor: "#000000",
    backgroundOpacity: 0,
    position: "bottom",
    positionOffset: 0,
    textAlign: "center",
    highlightColor: "#FACC15",
    shadow: true,
  },
  effects: { ...DEFAULT_EFFECTS, dramaMode: true },
  width: 1080,
  height: 1920,
  durationSec: 9,
  fps: 30,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoComposition"
      component={VideoComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_PROPS}
      // Real dimensions/duration come from the rendering script via
      // `calculateMetadata` so each user's video is rendered at its native
      // aspect ratio and length, not the defaults above.
      calculateMetadata={({ props }) => {
        const p = props as CompositionProps;
        return {
          durationInFrames: Math.max(1, Math.round(p.durationSec * p.fps)),
          fps: p.fps,
          width: p.width,
          height: p.height,
        };
      }}
    />
  );
};
