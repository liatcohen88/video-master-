/**
 * Real-file SFX mixing. Replaces the previous lavfi synth approach.
 *
 * One trigger = one MP3 from public/sfx/ played at a specific output-timeline
 * timestamp. Triggers come from three places:
 *   1. Auto-detected keyword elements   (effects.contextualSfx)
 *   2. Per-subtitle manualEmojis[].sfxId
 *   3. customLogos[].sfxId   (only timed/non-persistent ones)
 *   4. lottieElements[].sfxId
 *
 * Output:
 *   - inputArgs:   `-i` flags to append after the main video input
 *   - graph:       filter_complex chains (semicolon-separated)
 *   - outLabel:    name of the final audio label (use after [abase] silence step)
 */

import { join } from "node:path";
import type { Subtitle, VideoEffects } from "./types";
import { detectElements } from "./keywordElements";
import { DEFAULT_SFX_FOR_KIND, getSfxAsset } from "./sfxLibrary";
import { retimeTimestamp, type SilentRange } from "./silenceCut";

export type SfxTrigger = {
  /** Output-timeline seconds (already silence-cut adjusted) */
  time: number;
  /** Absolute path of the MP3 to inject */
  filePath: string;
};

const PROJECT_ROOT = process.cwd();

function idToPath(id: string): string | null {
  const asset = getSfxAsset(id);
  if (!asset) return null;
  return join(PROJECT_ROOT, "public", "sfx", `sfx_${asset.id}.mp3`);
}

/** Elementkey, kept in sync with AiDetectedPanel.elementKey */
function elementKey(categoryId: string, time: number): string {
  return `${categoryId}-${Math.round(time * 10)}`;
}

/**
 * Walk every SFX source and emit a flat list of triggers (output-timeline).
 * finalSubtitles must already be retimed for silence cut.
 * appliedSilences is needed to retime logo/lottie times (which the client
 * stores in OUTPUT timeline already — so we DON'T retime those again).
 */
export function collectSfxTriggers(
  effects: VideoEffects,
  finalSubtitles: Subtitle[],
  _appliedSilences: SilentRange[],
): SfxTrigger[] {
  const triggers: SfxTrigger[] = [];

  // 1. Auto-detected keyword elements
  if (effects.contextualElements && effects.contextualSfx) {
    const disabled = new Set(effects.disabledElements ?? []);
    const overrides = effects.elementSfxOverrides ?? {};
    for (const ev of detectElements(finalSubtitles)) {
      const key = elementKey(ev.category.id, ev.time);
      if (disabled.has(key)) continue;
      const overrideId = overrides[key];
      let sfxId: string | undefined;
      if (overrideId === "none") continue;
      sfxId = overrideId ?? DEFAULT_SFX_FOR_KIND[ev.category.sfx];
      const path = idToPath(sfxId);
      if (path) triggers.push({ time: ev.time, filePath: path });
    }
  }

  // 2. Manual emojis attached to subtitles
  for (const sub of finalSubtitles) {
    if (!sub.manualEmojis) continue;
    for (const em of sub.manualEmojis) {
      if (!em.sfxId || em.sfxId === "none") continue;
      const path = idToPath(em.sfxId);
      if (path) triggers.push({ time: sub.start, filePath: path });
    }
  }

  // 3. Custom logos — timed OR persistent (both can carry an SFX).
  // Persistent logos appear at t=0, so fire their SFX at 0; timed ones
  // fire at their declared time. Previously only timed logos were emitted,
  // which made a logo's sfx never play in MP4 when "show throughout" was on.
  for (const logo of effects.customLogos ?? []) {
    if (!logo.sfxId || logo.sfxId === "none") continue;
    const isPersistent = logo.persistent !== false;
    const t = isPersistent ? 0 : (typeof logo.time === "number" ? logo.time : 0);
    const path = idToPath(logo.sfxId);
    if (path) triggers.push({ time: t, filePath: path });
  }

  // 3b. Intro animation SFX — plays once at t=0 alongside the intro reveal.
  // Matches what the live preview fires (playSfxCapped on intro start).
  if (effects.introSfxId && effects.introSfxId !== "none") {
    const path = idToPath(effects.introSfxId);
    if (path) triggers.push({ time: 0, filePath: path });
  }

  // 4. Lottie elements
  for (const lot of effects.lottieElements ?? []) {
    if (!lot.sfxId || lot.sfxId === "none") continue;
    const path = idToPath(lot.sfxId);
    if (path) triggers.push({ time: lot.time, filePath: path });
  }

  return triggers.sort((a, b) => a.time - b.time);
}

/**
 * Build the `-i path.mp3` flags for every trigger. Order matches what
 * buildSfxAudioGraph expects — pass these to ffmpeg right after the video
 * input (and before any other -i).
 */
export function buildSfxFileInputs(triggers: SfxTrigger[]): string[] {
  const args: string[] = [];
  for (const t of triggers) args.push("-i", t.filePath);
  return args;
}

/**
 * Build the audio-side filter_complex chain that delays each SFX to its
 * trigger time and mixes everything on top of [abase].
 *
 * Caller must have already produced [abase] (e.g. from `[0:a]anull[abase]`
 * or the silence-cut audio filter).
 *
 * `sfxInputStartIdx` = the ffmpeg input index of the FIRST SFX file.
 * Returns the parts to append to the filter_complex graph + the final
 * audio label.
 */
export function buildSfxAudioGraph(
  triggers: SfxTrigger[],
  abaseLabel: string,
  sfxInputStartIdx: number,
  /** Optional pre-built bg-music label to include in the amix. */
  bgMusicLabel?: string | null,
  /** Master multiplier (0..2) applied to every SFX volume. */
  sfxMaster = 1,
): { parts: string[]; outLabel: string } {
  if (triggers.length === 0 && !bgMusicLabel) {
    return { parts: [], outLabel: abaseLabel };
  }

  const parts: string[] = [];
  // 1.2 is the per-trigger base gain (slightly hot so individual SFX cut
  // through the mix); sfxMaster lets the user scale all SFX together.
  const perVol = (1.2 * Math.max(0, Math.min(2, sfxMaster))).toFixed(3);
  triggers.forEach((t, i) => {
    const delayMs = Math.max(0, Math.round(t.time * 1000));
    parts.push(
      `[${sfxInputStartIdx + i}:a]adelay=${delayMs}|${delayMs},volume=${perVol}[s${i}]`,
    );
  });
  // amix inputs: speech base, optional bg music, then each SFX. Weights keep
  // speech at ~3x and bg at ~1x so dialogue + SFX stay on top of the bed.
  const extras: string[] = [];
  const weights: string[] = ["3"];
  if (bgMusicLabel) { extras.push(`[${bgMusicLabel}]`); weights.push("1"); }
  triggers.forEach((_, i) => { extras.push(`[s${i}]`); weights.push("1"); });
  const mixIns = `[${abaseLabel}]` + extras.join("");
  parts.push(
    `${mixIns}amix=inputs=${1 + extras.length}:duration=first:` +
      `dropout_transition=0:weights='${weights.join(" ")}':normalize=1[aout]`,
  );
  return { parts, outLabel: "aout" };
}
