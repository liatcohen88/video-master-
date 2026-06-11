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

/** Play `url` with the cap. Caller decides volume (0..1). */
export function playSfxCapped(
  url: string,
  volume = 0.6,
  capMs: number = DEFAULT_CAP_MS,
): CappedPlayHandle {
  const a = new Audio(url);
  a.preload = "auto";
  a.volume = volume;
  a.play().catch(() => { /* user gesture / load races — caller doesn't care */ });

  let stopped = false;
  let fadeTimer: number | null = null;
  let fadeInterval: number | null = null;

  function cleanup() {
    if (fadeTimer !== null) { window.clearTimeout(fadeTimer); fadeTimer = null; }
    if (fadeInterval !== null) { window.clearInterval(fadeInterval); fadeInterval = null; }
    try { a.pause(); a.src = ""; } catch { /* noop */ }
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
    const startVol = a.volume;
    let i = 0;
    fadeInterval = window.setInterval(() => {
      i += 1;
      a.volume = Math.max(0, startVol * (1 - i / steps));
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
