/**
 * Silence detection + cut helpers.
 *
 * Real silence removal needs THREE coordinated changes:
 *   1. Detect silent intervals via FFmpeg `silencedetect` filter.
 *   2. Build a complex filter graph that selects non-silent ranges from
 *      BOTH video AND audio, then re-timestamps with setpts/asetpts.
 *   3. Re-time the subtitle JSON so timings match the cut output.
 *
 * Without (3), subtitles fire at original times while video is cut → desync.
 */

import { spawn } from "node:child_process";
import type { Subtitle } from "./types";

export type SilentRange = { start: number; end: number };

/**
 * Run FFmpeg silencedetect to find silent intervals.
 * silencedetect logs to stderr lines like:
 *   [silencedetect @ ...] silence_start: 1.234
 *   [silencedetect @ ...] silence_end: 2.567 | silence_duration: 1.333
 */
export function detectSilences(
  ffmpegPath: string,
  inputPath: string,
  thresholdDb: number,
  minDurationSec: number,
): Promise<SilentRange[]> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", inputPath,
      "-af",
      `silencedetect=noise=${thresholdDb}dB:d=${minDurationSec.toFixed(2)}`,
      "-f", "null",
      "-",
    ];
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`silencedetect failed (code ${code}): ${stderr.slice(-300)}`));
        return;
      }
      const ranges: SilentRange[] = [];
      let pendingStart: number | null = null;
      for (const line of stderr.split("\n")) {
        const startMatch = line.match(/silence_start:\s*([\d.-]+)/);
        const endMatch = line.match(/silence_end:\s*([\d.]+)/);
        if (startMatch) {
          pendingStart = Math.max(0, parseFloat(startMatch[1]));
        } else if (endMatch && pendingStart != null) {
          const end = parseFloat(endMatch[1]);
          if (end > pendingStart) {
            ranges.push({ start: pendingStart, end });
          }
          pendingStart = null;
        }
      }
      resolve(ranges);
    });
    proc.on("error", (e) => reject(new Error(`silencedetect spawn failed: ${e.message}`)));
  });
}

/**
 * Given a sorted list of silent ranges and the total video duration,
 * return the non-silent "keep" intervals. These are what we feed into
 * FFmpeg select() / aselect() filters.
 */
export function buildKeepIntervals(
  silences: SilentRange[],
  durationSec: number,
): SilentRange[] {
  const keep: SilentRange[] = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start > cursor) keep.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < durationSec) keep.push({ start: cursor, end: durationSec });
  return keep;
}

/**
 * Build the FFmpeg `select` filter expression to keep only the listed
 * time ranges. The output frames are renumbered with setpts.
 *
 *   select='between(t,0,1.5)+between(t,3.0,5.0)',setpts=N/FRAME_RATE/TB
 *
 * NOTE: between() in select returns 1 inside the range. The sum is >=1
 *       when any range matches; select treats nonzero as truthy.
 */
export function buildSelectExpression(keep: SilentRange[]): string {
  if (keep.length === 0) return "1"; // keep everything (fallback)
  return keep
    .map((r) => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`)
    .join("+");
}

/**
 * Re-time a single timestamp based on cut silent ranges.
 * Returns the equivalent time in the output (cut) timeline.
 */
export function retimeTimestamp(t: number, silences: SilentRange[]): number {
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  let cut = 0;
  for (const s of sorted) {
    if (s.end <= t) {
      cut += s.end - s.start;
    } else if (s.start < t) {
      cut += t - s.start;
      return Math.max(0, t - cut);
    } else {
      break;
    }
  }
  return Math.max(0, t - cut);
}

/**
 * Re-time a subtitle's timestamps based on cut silent ranges.
 * For each timestamp T, subtract the total silent time that occurred BEFORE T.
 * If T falls inside a silent range, snap it to the start of the silence
 * (after subtraction).
 */
export function retimeSubtitles(
  subtitles: Subtitle[],
  silences: SilentRange[],
): Subtitle[] {
  // For O(N+M) lookup, sort silences once
  const sorted = [...silences].sort((a, b) => a.start - b.start);

  function adjust(t: number): number {
    let cut = 0;
    for (const s of sorted) {
      if (s.end <= t) {
        cut += s.end - s.start; // silence entirely before T
      } else if (s.start < t) {
        // T falls inside a silence; clamp to start (everything before this is kept)
        cut += t - s.start;
        return Math.max(0, t - cut);
      } else {
        break; // silences are sorted; no more affect this T
      }
    }
    return Math.max(0, t - cut);
  }

  return subtitles.map((sub) => {
    const newStart = adjust(sub.start);
    const newEnd = adjust(sub.end);
    const dur = Math.max(0.05, newEnd - newStart);
    const newWords = sub.words?.map((w) => {
      const ws = adjust(w.start);
      const we = adjust(w.end);
      return {
        word: w.word,
        start: ws,
        end: Math.max(ws + 0.02, we),
      };
    });
    return {
      ...sub,
      start: newStart,
      end: newStart + dur,
      words: newWords,
    };
  });
}
