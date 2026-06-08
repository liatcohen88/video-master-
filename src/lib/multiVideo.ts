/**
 * Multi-video AI editing helpers.
 *
 * Core problem: user uploads N videos and a script (the voice-over they
 * want, or just bullet points). We need to decide which clip from which
 * source video to show during each part of the script, then concat.
 *
 * Approach (MVP): split the script into sentences. For each sentence,
 * compute a word-overlap score against EVERY subtitle line of EVERY source
 * video. Pick the highest-scoring subtitle line and use its start/end as
 * the clip. Ties → spread across videos to avoid showing the same one.
 *
 * Hebrew-aware tokenization: strip nikud, drop common stop words, lowercase
 * (no-op on Hebrew but cheap).
 */

import type { Subtitle } from "./types";

const HE_STOPWORDS = new Set([
  "של","את","עם","על","אני","אתה","היא","הוא","הם","הן","אנחנו","זה","זו","זאת",
  "ה","ו","ב","ל","מ","ש","כ","כי","אם","אז","גם","רק","לא","כן","יש","אין",
  "מאוד","יותר","פחות","הכי","כל","איך","למה","מתי","איפה","מה","מי","איזה",
  "אבל","או","וגם","אחד","אחת","שני","שתי","יכול","יכולה","היה","הייתה","להיות",
]);

const EN_STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","to","of","in","on",
  "at","for","with","and","or","but","i","you","he","she","it","we","they","this",
  "that","these","those","not","no","yes","do","does","did","have","has","had",
]);

/** Strip Hebrew nikud + punctuation, split to lower-case tokens. */
export function tokenize(text: string): string[] {
  return text
    .replace(/[֑-ׇ]/g, "") // nikud
    .replace(/[.,?!:;"'()[\]{}<>«»…װ-״–—-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !HE_STOPWORDS.has(w) && !EN_STOPWORDS.has(w));
}

/**
 * Split a script into segments. Hebrew speakers usually write either with
 * sentence punctuation or with line breaks. We honor both, plus collapse
 * runs of whitespace.
 */
export function splitScript(script: string): string[] {
  return script
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type VideoTranscript = {
  /** Index of the source video (0-based, in upload order) */
  videoIdx: number;
  /** Total duration in seconds */
  durationSec: number;
  subtitles: Subtitle[];
};

export type ClipPick = {
  scriptIdx: number;
  /** What the user wrote — burned as subtitle */
  scriptText: string;
  videoIdx: number;
  /** Source video start/end in seconds */
  srcStart: number;
  srcEnd: number;
  /** Why we picked this — used for the explain panel */
  matchScore: number;
  matchedSubText: string;
};

/**
 * Score how well a script sentence matches a subtitle line.
 * Simple Jaccard-ish: shared tokens / union, with a small bonus for
 * consecutive bigram matches so phrase reuse outranks scattered words.
 */
function scoreMatch(scriptTokens: string[], subTokens: string[]): number {
  if (scriptTokens.length === 0 || subTokens.length === 0) return 0;
  const subSet = new Set(subTokens);
  const shared = scriptTokens.filter((t) => subSet.has(t)).length;
  if (shared === 0) return 0;
  const union = new Set([...scriptTokens, ...subTokens]).size;
  const jaccard = shared / union;
  // Bigram bonus
  let bigramHits = 0;
  for (let i = 0; i < scriptTokens.length - 1; i++) {
    const bg = scriptTokens[i] + " " + scriptTokens[i + 1];
    for (let j = 0; j < subTokens.length - 1; j++) {
      if (subTokens[j] + " " + subTokens[j + 1] === bg) bigramHits++;
    }
  }
  return jaccard + bigramHits * 0.15;
}

/**
 * Main alignment. Returns one ClipPick per script segment.
 *
 * Strategy: greedy — score every (scriptSeg, sourceSub) pair, then for
 * each script segment pick the best unused source sub. If a script
 * segment has no matches at all, round-robin a fallback clip from the
 * next video (cycling), of duration = avg of matched clips (or 3s).
 */
export function alignScriptToVideos(
  script: string,
  transcripts: VideoTranscript[],
  opts: { minClipSec?: number; maxClipSec?: number; defaultClipSec?: number } = {},
): ClipPick[] {
  const minClip = opts.minClipSec ?? 1.5;
  const maxClip = opts.maxClipSec ?? 5;
  const defaultClip = opts.defaultClipSec ?? 3;

  const segments = splitScript(script);
  const scriptTokens = segments.map(tokenize);
  const picks: ClipPick[] = [];
  const used = new Set<string>(); // `${videoIdx}:${subIdx}` to avoid reusing same clip

  for (let i = 0; i < segments.length; i++) {
    let best: { score: number; videoIdx: number; subIdx: number; sub: Subtitle } | null = null;

    for (const tr of transcripts) {
      tr.subtitles.forEach((sub, subIdx) => {
        const key = `${tr.videoIdx}:${subIdx}`;
        if (used.has(key)) return;
        const score = scoreMatch(scriptTokens[i], tokenize(sub.text));
        if (score > 0 && (best === null || score > best.score)) {
          best = { score, videoIdx: tr.videoIdx, subIdx, sub };
        }
      });
    }

    if (best !== null) {
      const b = best as { score: number; videoIdx: number; subIdx: number; sub: Subtitle };
      used.add(`${b.videoIdx}:${b.subIdx}`);
      const len = Math.max(minClip, Math.min(maxClip, b.sub.end - b.sub.start));
      picks.push({
        scriptIdx: i,
        scriptText: segments[i],
        videoIdx: b.videoIdx,
        srcStart: b.sub.start,
        srcEnd: b.sub.start + len,
        matchScore: b.score,
        matchedSubText: b.sub.text,
      });
    } else {
      // Fallback: round-robin across videos, take from a non-used position
      const vIdx = i % transcripts.length;
      const tr = transcripts[vIdx];
      // pick a not-yet-used point — first unused subtitle in this video
      let chosenStart = 0;
      for (let s = 0; s < tr.subtitles.length; s++) {
        if (!used.has(`${vIdx}:${s}`)) {
          chosenStart = tr.subtitles[s].start;
          used.add(`${vIdx}:${s}`);
          break;
        }
      }
      const len = Math.min(maxClip, Math.max(minClip, defaultClip));
      picks.push({
        scriptIdx: i,
        scriptText: segments[i],
        videoIdx: vIdx,
        srcStart: chosenStart,
        srcEnd: Math.min(tr.durationSec, chosenStart + len),
        matchScore: 0,
        matchedSubText: "(fallback)",
      });
    }
  }

  return picks;
}

/**
 * Convert picks → Subtitle[] for burning the user's SCRIPT (not the
 * original transcripts) over the concatenated output. Each subtitle spans
 * its clip's duration on the output timeline.
 */
export function buildOutputSubtitles(picks: ClipPick[]): Subtitle[] {
  const subs: Subtitle[] = [];
  let cursor = 0;
  for (const p of picks) {
    const dur = p.srcEnd - p.srcStart;
    subs.push({
      id: `m${p.scriptIdx}`,
      start: cursor,
      end: cursor + dur,
      text: p.scriptText,
    });
    cursor += dur;
  }
  return subs;
}
