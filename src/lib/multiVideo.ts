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

// Hebrew discourse connectors that mark a NEW beat in the narration — we
// break the script at these even without punctuation, because most people
// type one long run-on sentence (e.g. "...שתיתי בכוס ואחר כך אכלתי עוגיות...").
const HE_CONNECTORS = [
  "ואחר כך", "אחר כך", "אחרי זה", "אחרי כן", "לאחר מכן", "אחרי ש",
  "ואז", "ולבסוף", "לבסוף", "בסוף", "ובסוף",
  "בהתחלה", "קודם כל", "קודם", "ראשית",
  "וזהו", "וזה הכל", "אחר כך", "וגם", "בנוסף", "חוץ מזה",
];

/**
 * Split a script into segments — robust to how real people type.
 *
 * Layered strategy:
 *   1. Break on sentence punctuation (. ! ?) and line breaks.
 *   2. Break on commas and Hebrew discourse connectors ("ואחר כך", "ואז"…),
 *      so a punctuation-free run-on sentence still splits into beats.
 *   3. If we STILL have fewer segments than `minSegments` (usually the number
 *      of uploaded videos), rebalance by splitting into ~equal word-chunks so
 *      every video gets a turn instead of showing just one clip.
 */
export function splitScript(script: string, minSegments = 1): string[] {
  // Layer 1+2: natural boundaries — punctuation, newlines, commas, connectors.
  const connectorRe = new RegExp(`\\s+(?=(?:${HE_CONNECTORS.join("|")})\\b)`, "g");
  let segs = script
    .split(/(?<=[.!?])\s+|\n+/g)
    .flatMap((s) => s.split(/\s*[,،;]\s*/g))   // commas
    .flatMap((s) => s.split(connectorRe))       // Hebrew connectors
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Layer 3: not enough beats for the number of videos → keep the natural
  // segments and repeatedly split the LONGEST one in half (at a word
  // boundary) until we reach minSegments. Preserves phrase boundaries far
  // better than a blind word-chunk, so subtitles never break mid-connector.
  if (segs.length < minSegments && minSegments > 1) {
    // Don't try to make more segments than there are words to fill them.
    const totalWords = segs.reduce((n, s) => n + s.split(/\s+/).length, 0);
    const target = Math.min(minSegments, totalWords);

    while (segs.length < target) {
      // Find the segment with the most words that can still be split.
      let idx = -1, maxWords = 1;
      for (let i = 0; i < segs.length; i++) {
        const w = segs[i].split(/\s+/).length;
        if (w > maxWords) { maxWords = w; idx = i; }
      }
      if (idx === -1) break; // nothing left to split

      const words = segs[idx].split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const left = words.slice(0, mid).join(" ");
      const right = words.slice(mid).join(" ");
      segs.splice(idx, 1, left, right);
    }
  }

  return segs;
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
 * Estimate how long a script segment needs to stay on screen, based on
 * Hebrew reading speed. This is the KEY to "follow the script": each clip's
 * length is driven by the TEXT (reading time), not by whatever happened to
 * match in a source transcript. A longer sentence → a longer clip.
 */
export function readingDurationSec(
  text: string,
  opts: { minSec?: number; maxSec?: number; charsPerSec?: number } = {},
): number {
  const min = opts.minSec ?? 2;
  const max = opts.maxSec ?? 6;
  const cps = opts.charsPerSec ?? 14; // comfortable Hebrew on-screen reading
  const chars = text.replace(/\s+/g, "").length;
  const raw = chars / cps + 0.6; // +0.6s base so very short lines still breathe
  return Math.min(max, Math.max(min, raw));
}

/** A transcript match is "strong" only above this Jaccard score. Below it we
 *  trust the script order + sequential footage instead of a weak coincidence. */
const STRONG_MATCH = 0.2;

/**
 * Main alignment — SCRIPT-FIRST. Returns one ClipPick per script segment,
 * strictly in script order.
 *
 * For each segment, the desired on-screen duration comes from its reading
 * time. We then choose WHICH footage fills that slot:
 *
 *   1. Strong transcript match — if the segment's words clearly appear in a
 *      source clip's speech (score ≥ STRONG_MATCH), use that exact moment.
 *      This keeps the smart behavior when the script IS the voice-over.
 *
 *   2. Otherwise — sequential footage. Each video has a moving cursor; we
 *      round-robin across videos and pull the next unused chunk, advancing
 *      the cursor so we never re-show the same opening seconds. This makes
 *      pure B-roll (no matching speech) follow the script cleanly: segment 1
 *      → video 1, segment 2 → video 2, segment 3 → video 1 (next chunk)…
 *
 * The clip length always equals the segment's reading time (clamped to what
 * the source can still provide), so the output paces with the script.
 */
export function alignScriptToVideos(
  script: string,
  transcripts: VideoTranscript[],
  opts: { minClipSec?: number; maxClipSec?: number; charsPerSec?: number } = {},
): ClipPick[] {
  const minClip = opts.minClipSec ?? 2;
  const maxClip = opts.maxClipSec ?? 6;

  // Ask for at least as many segments as there are videos, so every uploaded
  // clip gets used instead of the whole script collapsing into one segment.
  const segments = splitScript(script, transcripts.length);
  const scriptTokens = segments.map(tokenize);
  const picks: ClipPick[] = [];
  const usedSubs = new Set<string>();          // `${videoIdx}:${subIdx}`
  const cursors = transcripts.map(() => 0);     // per-video playhead for sequential pulls
  let rrPointer = 0;                            // round-robin pointer for sequential fallback

  for (let i = 0; i < segments.length; i++) {
    const want = readingDurationSec(segments[i], {
      minSec: minClip, maxSec: maxClip, charsPerSec: opts.charsPerSec,
    });

    // ── 1. Strong transcript match ──────────────────────────────
    let best: { score: number; videoIdx: number; subIdx: number; sub: Subtitle } | null = null;
    for (const tr of transcripts) {
      tr.subtitles.forEach((sub, subIdx) => {
        if (usedSubs.has(`${tr.videoIdx}:${subIdx}`)) return;
        const score = scoreMatch(scriptTokens[i], tokenize(sub.text));
        if (score >= STRONG_MATCH && (best === null || score > best.score)) {
          best = { score, videoIdx: tr.videoIdx, subIdx, sub };
        }
      });
    }

    if (best !== null) {
      const b = best as { score: number; videoIdx: number; subIdx: number; sub: Subtitle };
      usedSubs.add(`${b.videoIdx}:${b.subIdx}`);
      const dur = transcripts[b.videoIdx].durationSec;
      const start = b.sub.start;
      const end = Math.min(dur, start + want);
      cursors[b.videoIdx] = Math.max(cursors[b.videoIdx], end);
      picks.push({
        scriptIdx: i,
        scriptText: segments[i],
        videoIdx: b.videoIdx,
        srcStart: start,
        srcEnd: end,
        matchScore: b.score,
        matchedSubText: b.sub.text,
      });
      continue;
    }

    // ── 2. Sequential footage (round-robin across videos) ───────
    const vIdx = rrPointer % transcripts.length;
    rrPointer++;
    const tr = transcripts[vIdx];
    let start = cursors[vIdx];
    // If this video is near its end, wrap back to the start so we still
    // have footage to show rather than an empty/too-short clip.
    if (start + Math.min(1, want) >= tr.durationSec) start = 0;
    const end = Math.min(tr.durationSec, start + want);
    cursors[vIdx] = end;
    picks.push({
      scriptIdx: i,
      scriptText: segments[i],
      videoIdx: vIdx,
      srcStart: start,
      srcEnd: end,
      matchScore: 0,
      matchedSubText: "(רצף לפי התסריט)",
    });
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
