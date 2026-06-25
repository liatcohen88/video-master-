/**
 * Play an SFX audio with a hard duration cap + fade-out so long files don't
 * drown out the video. Caps at ~3.5s by default (Liat: "תוכל לקצר את
 * הסאונד אפקט עד 3-4 שניות"). The fade is gentle (200ms) so the cut isn't
 * audible.
 *
 * Returns the audio handle so the caller can stop it early (a new trigger
 * firing, video paused, etc.).
 */

export type CappedPlayHandle = {
  audio: HTMLAudioElement;
  stop: () => void;
};

const DEFAULT_CAP_MS = 3500;
const FADE_MS = 200;

// Singleton AudioContext — lets us amplify above 1.0 via GainNode, which
// HTMLAudioElement.volume can't (it's hard-clamped to 0..1).
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
  const w = window as WindowWithWebkit;
  const AC = window.AudioContext ?? w.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  return ctx;
}

/** Play `url` with the cap. `volume` is a linear multiplier — values >1
 *  amplify above the source. WebAudio path is used when available so
 *  volumes like 2.0 actually produce louder output. */
export function playSfxCapped(
  url: string,
  volume = 0.6,
  capMs: number = DEFAULT_CAP_MS,
): CappedPlayHandle {
  const a = new Audio(url);
  a.preload = "auto";

  // CORS-safe playback. Routing a CROSS-ORIGIN media element through
  // createMediaElementSource() makes the browser output SILENCE unless the
  // server sends CORS headers the Web Audio graph trusts — Supabase-hosted
  // admin SFX came out muted ("עלה אבל ללא שמע"). So we only use the Web Audio
  // path (needed for >1 volume amplification) for SAME-ORIGIN / data: media;
  // for cross-origin URLs we play the plain element, which streams cross-origin
  // audio reliably (volume clamped to 0..1, fine for SFX).
  let crossOrigin = false;
  if (/^https?:\/\//i.test(url) && typeof location !== "undefined") {
    try { crossOrigin = new URL(url).origin !== location.origin; } catch { /* keep false */ }
  }
  const useWebAudio = !crossOrigin;
  if (useWebAudio) a.crossOrigin = "anonymous";

  const audioCtx = useWebAudio ? getCtx() : null;
  let gainNode: GainNode | null = null;
  let mediaSource: MediaElementAudioSourceNode | null = null;

  if (audioCtx) {
    try {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      mediaSource = audioCtx.createMediaElementSource(a);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = Math.max(0, volume);
      mediaSource.connect(gainNode).connect(audioCtx.destination);
      a.volume = 1;
    } catch {
      // CORS or already-connected — fall back to element volume (clamped).
      a.volume = Math.min(1, Math.max(0, volume));
    }
  } else {
    a.volume = Math.min(1, Math.max(0, volume));
  }

  a.play().catch(() => { /* user gesture / load races — caller doesn't care */ });

  let stopped = false;
  let fadeTimer: number | null = null;
  let fadeInterval: number | null = null;

  function cleanup() {
    if (fadeTimer !== null) { window.clearTimeout(fadeTimer); fadeTimer = null; }
    if (fadeInterval !== null) { window.clearInterval(fadeInterval); fadeInterval = null; }
    try { a.pause(); a.src = ""; } catch { /* noop */ }
    try { mediaSource?.disconnect(); gainNode?.disconnect(); } catch { /* noop */ }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    cleanup();
  }

  // Schedule the fade. We start fading FADE_MS before the cap so total
  // duration matches capMs exactly.
  const fadeStartMs = Math.max(0, capMs - FADE_MS);
  fadeTimer = window.setTimeout(() => {
    if (stopped) return;
    const steps = 10;
    const stepMs = FADE_MS / steps;
    const startVol = gainNode ? gainNode.gain.value : a.volume;
    let i = 0;
    fadeInterval = window.setInterval(() => {
      i += 1;
      const v = Math.max(0, startVol * (1 - i / steps));
      if (gainNode) gainNode.gain.value = v;
      else a.volume = v;
      if (i >= steps) {
        stopped = true;
        cleanup();
      }
    }, stepMs);
  }, fadeStartMs);

  // If the audio finishes naturally (i.e. shorter than the cap), clear the
  // pending timer so we don't try to fade-and-pause an already-ended audio.
  a.addEventListener("ended", () => {
    if (fadeTimer !== null) { window.clearTimeout(fadeTimer); fadeTimer = null; }
    if (fadeInterval !== null) { window.clearInterval(fadeInterval); fadeInterval = null; }
  }, { once: true });

  return { audio: a, stop };
}
