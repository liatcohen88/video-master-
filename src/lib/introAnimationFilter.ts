/**
 * FFmpeg filter expressions for the intro animations (first ~0.5-0.9s of
 * the exported video). Mirrors the live-preview behavior in
 * introAnimations.ts so what Liat sees in the editor matches the MP4.
 *
 * Strategy: each preset returns a list of -vf filters that are prepended
 * to the main chain. They apply ONLY during the intro window (via FFmpeg
 * `if(lt(t,...), animated, identity)` expressions) and pass the frame
 * through unchanged afterwards.
 *
 * Some presets — shake, irisOpen, whipPan — need expensive per-frame
 * compositing that FFmpeg can't do cheaply with a single filter. Those
 * fall back to the closest visually-equivalent simple animation so users
 * still get a punchy intro instead of nothing.
 */

import type { VideoEffects } from "./types";

type Id = NonNullable<VideoEffects["introAnimation"]>;

/** Duration per preset (seconds) — must match introAnimations.ts presets. */
const DURATION: Record<Id, number> = {
  none: 0,
  punchZoom: 0.55,
  shake: 0.4,
  dropZoom: 0.85,
  whipPan: 0.45,
  bounceIn: 0.7,
  flashWhite: 0.45,
  irisOpen: 0.6,
  slideUp: 0.5,
  fadeIn: 0.5,
};

/**
 * Build the -vf filters for the chosen intro animation. Returns [] when
 * preset is "none" or unknown. The caller PREPENDS these to its filter
 * chain (so they run on the source video before crop/scale/etc.).
 *
 * `outputW`/`outputH` are needed for the scale+crop pair that some
 * animations use to maintain output dimensions while zooming.
 */
export function buildIntroAnimationFilters(
  effects: VideoEffects,
  outputW: number,
  outputH: number,
): string[] {
  const id: Id = effects.introAnimation ?? "none";
  if (id === "none") return [];
  const d = DURATION[id];

  switch (id) {
    case "fadeIn":
      // Fade in from BLACK — FFmpeg's native fade is perfect for this.
      return [`fade=in:st=0:d=${d}`];

    case "flashWhite":
      // White flash that decays: hold full white briefly (0.25*d), then
      // fade it out to reveal the video. FFmpeg's fade-in with color=white
      // overlays a solid white that becomes transparent over `d` seconds.
      return [`fade=in:st=0:d=${d}:color=white`];

    case "punchZoom": {
      // 1.4× → 1.0× over `d` seconds (ease-out-quad). Animate the scale
      // every frame, then crop back to output dims so frame size stays
      // constant. Math: scale = 1 + 0.4*(1 - (t/d)^2) for t in [0, d].
      // Outside the window: scale = 1 (identity).
      const expr = `if(lt(t,${d}), 1 + 0.4*(1 - pow(t/${d},2)), 1)`;
      return [
        `scale=w='iw*${expr}':h='ih*${expr}':eval=frame:flags=lanczos`,
        `crop=${outputW}:${outputH}:(iw-${outputW})/2:(ih-${outputH})/2`,
      ];
    }

    case "dropZoom": {
      // 1.0× → 1.04× over `d` seconds (ease-in-quad). Subtle creep that
      // ominously pushes the viewer in.
      const expr = `if(lt(t,${d}), 1 + 0.04*pow(t/${d},2), 1.04)`;
      return [
        `scale=w='iw*${expr}':h='ih*${expr}':eval=frame:flags=lanczos`,
        `crop=${outputW}:${outputH}:(iw-${outputW})/2:(ih-${outputH})/2`,
      ];
    }

    case "bounceIn": {
      // 0.6 → 1.0 with overshoot. Approximate ease-out-back with a quadratic
      // that peaks ~1.05 around 70% then settles to 1.0. Combined with
      // fade-in for visibility ramp.
      const expr = `if(lt(t,${d}), 0.6 + 0.45*pow(t/${d},0.5) - 0.05*pow(t/${d}-1,2), 1)`;
      return [
        `scale=w='iw*${expr}':h='ih*${expr}':eval=frame:flags=lanczos`,
        `crop=${outputW}:${outputH}:(iw-${outputW})/2:(ih-${outputH})/2`,
        `fade=in:st=0:d=${d * 0.5}`,
      ];
    }

    case "slideUp":
      // Translate Y from +100% to 0 over `d` seconds. Crop a "window" that
      // starts at the bottom and rises. The pad gives us extra vertical
      // space to slide through.
      // Implemented as crop with animated y offset: at t=0 take from
      // outputH below center (off-screen bottom), at t=d take from center.
      // FFmpeg's crop x/y accept expressions when eval=frame is set.
      return [
        // First pad below to give slide room
        `pad=iw:ih*2:0:0:black`,
        // Crop animated: y goes from ih (bottom edge) to 0 over `d` seconds
        `crop=${outputW}:${outputH}:0:'if(lt(t,${d}), ih/2*(1-t/${d}) + ih/2, ih/2)':eval=frame`,
      ];

    case "shake":
      // True multi-axis jitter needs per-frame coordinate randomness, which
      // FFmpeg can do with `if(lt(t,d), random(...))` but it's expensive
      // and looks robotic. Fallback to a quick punch+fade-in — still
      // dramatic, just not jittery. Live-preview keeps the real shake.
      return [
        `scale=w='iw*if(lt(t,${d}), 1.06 - 0.06*t/${d}, 1)':h='ih*if(lt(t,${d}), 1.06 - 0.06*t/${d}, 1)':eval=frame:flags=lanczos`,
        `crop=${outputW}:${outputH}:(iw-${outputW})/2:(ih-${outputH})/2`,
        `fade=in:st=0:d=${d * 0.6}`,
      ];

    case "whipPan":
      // Horizontal slide-in from off-screen-right. Same pad+crop trick as
      // slideUp but on the x axis.
      return [
        `pad=iw*2:ih:0:0:black`,
        `crop=${outputW}:${outputH}:'if(lt(t,${d}), iw/2*(1-t/${d}) + iw/2, iw/2)':0:eval=frame`,
      ];

    case "irisOpen":
      // Real iris (expanding circle mask) needs the `geq` filter — costly
      // and visually similar to a center punch zoom + fade. Use that.
      return [
        `scale=w='iw*if(lt(t,${d}), 1.08 - 0.08*t/${d}, 1)':h='ih*if(lt(t,${d}), 1.08 - 0.08*t/${d}, 1)':eval=frame:flags=lanczos`,
        `crop=${outputW}:${outputH}:(iw-${outputW})/2:(ih-${outputH})/2`,
        `fade=in:st=0:d=${d}`,
      ];

    default:
      return [];
  }
}
