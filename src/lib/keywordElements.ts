/**
 * Contextual graphic elements + sound effects triggered by keywords in
 * the speech. Single source of truth: same definitions drive the live
 * preview overlay AND the ASS/FFmpeg burn.
 *
 * Hebrew regex patterns are tested against each subtitle's text. When a
 * match is found, an element event is generated at the word's timestamp.
 */

import type { Subtitle } from "./types";
import { heWord } from "./hebrewRegex";

export type SfxKind = "ding" | "zap" | "whoosh" | "cha-ching" | "boom" | "chime";

export type KeywordCategory = {
  id: string;
  emoji: string;
  /** Sound effect type to mix into the audio at the match time */
  sfx: SfxKind;
  /** Hebrew/English word patterns. Word-boundary aware. */
  patterns: RegExp[];
  /**
   * Where on the frame the element appears. Positions are EDGE-only so they
   * don't obscure the speaker's face (typically center). The previous
   * "above-subtitle" / "center" positions are intentionally removed.
   */
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
  /** Tailwind gradient for live-preview badge background */
  previewBg: string;
};

// All Hebrew patterns now use heWord() which adds proper word boundaries
// using lookbehind/lookahead — no more "מיד" matching inside "מידע".
export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    id: "money",
    emoji: "💰",
    sfx: "cha-ching",
    patterns: [
      heWord("כסף"), heWord("שקל"), heWord("שקלים"),
      heWord("דולר"), heWord("דולרים"),
      heWord("מיליון"), heWord("מיליארד"),
      heWord("רווח"), heWord("הכנסה"), heWord("משכורת"), heWord("הון"),
    ],
    position: "top-right",
    previewBg: "from-yellow-400 to-amber-600",
  },
  {
    id: "speed",
    emoji: "⚡",
    sfx: "zap",
    patterns: [
      heWord("מהיר"), heWord("מהר"), heWord("מהירות"),
      heWord("מיד"), heWord("מייד"), heWord("מיידי"), heWord("מיידית"),
      heWord("ברגע"), heWord("בשניות"), heWord("בדקות"),
    ],
    position: "top-center",
    previewBg: "from-cyan-400 to-blue-600",
  },
  {
    id: "important",
    emoji: "❗",
    sfx: "ding",
    patterns: [
      heWord("חשוב"), heWord("חיוני"), heWord("קריטי"),
      heWord("חייב"), heWord("חובה"),
      heWord("המרכזי"), heWord("העיקרי"),
    ],
    position: "top-center",
    previewBg: "from-red-400 to-rose-600",
  },
  {
    id: "question",
    emoji: "❓",
    sfx: "boom",
    patterns: [
      /\?/, heWord("למה"), heWord("מדוע"), heWord("האם"),
      heWord("איך"), heWord("מתי"), heWord("איפה"),
    ],
    position: "top-right",
    previewBg: "from-violet-400 to-purple-700",
  },
  {
    id: "love",
    emoji: "❤️",
    sfx: "chime",
    patterns: [
      heWord("אוהב"), heWord("אוהבת"), heWord("אהבה"),
      heWord("הלב"), heWord("לב"),
      heWord("מרגש"), heWord("מושלם"),
    ],
    position: "top-center",
    previewBg: "from-pink-400 to-rose-600",
  },
  {
    id: "growth",
    emoji: "📈",
    sfx: "whoosh",
    patterns: [
      heWord("צמיחה"), heWord("גידול"), heWord("עלייה"),
      heWord("הצלחה"), heWord("פריצת\\s*דרך"), heWord("התקדמות"),
    ],
    position: "top-left",
    previewBg: "from-emerald-400 to-green-600",
  },
  {
    id: "free",
    emoji: "🎁",
    sfx: "chime",
    patterns: [
      heWord("חינם"), heWord("בחינם"),
      heWord("מתנה"), heWord("במתנה"),
      heWord("ללא\\s+עלות"),
    ],
    position: "top-left",
    previewBg: "from-fuchsia-400 to-pink-600",
  },
  {
    id: "secret",
    emoji: "🤫",
    sfx: "whoosh",
    patterns: [
      heWord("סוד"), heWord("סודי"), heWord("בסוד"),
      heWord("לחשוף"), heWord("האמת"),
    ],
    position: "top-center",
    previewBg: "from-indigo-500 to-blue-700",
  },
  {
    id: "cta",
    emoji: "👆",
    sfx: "ding",
    patterns: [
      heWord("תעלו"), heWord("לחצו"), heWord("תקנו"),
      heWord("תרשמו"), heWord("תעקבו"),
      heWord("לעקוב"), heWord("להירשם"),
      heWord("לייק"), heWord("שתפו"),
    ],
    position: "top-right",
    previewBg: "from-orange-400 to-red-600",
  },
  {
    id: "fire",
    emoji: "🔥",
    sfx: "whoosh",
    patterns: [
      heWord("מדהים"), heWord("לוהט"), heWord("להט"),
      heWord("ויראלי"), heWord("ענק"), heWord("מטורף"),
    ],
    position: "top-center",
    previewBg: "from-orange-500 to-red-700",
  },
  {
    id: "car",
    emoji: "🚗",
    sfx: "boom",
    patterns: [
      heWord("רכב"), heWord("אוטו"), heWord("מכונית"),
      heWord("נסיעה"), heWord("נסעתי"), heWord("נסענו"),
      heWord("דרך"), heWord("כביש"),
    ],
    position: "top-right",
    previewBg: "from-slate-500 to-zinc-700",
  },
  {
    id: "food",
    emoji: "🍽️",
    sfx: "ding",
    patterns: [
      heWord("אוכל"), heWord("אוכלים"), heWord("אכלתי"),
      heWord("ארוחה"), heWord("מסעדה"), heWord("טעים"),
      heWord("מנה"),
    ],
    position: "top-left",
    previewBg: "from-orange-400 to-amber-700",
  },
  {
    id: "place",
    emoji: "📍",
    sfx: "ding",
    patterns: [
      heWord("מקום"), heWord("מיקום"), heWord("כאן"),
      heWord("שם\\s+ב"), heWord("הגעתי\\s+ל"),
    ],
    position: "top-right",
    previewBg: "from-red-500 to-rose-700",
  },
  {
    id: "time",
    emoji: "⏰",
    sfx: "ding",
    patterns: [
      heWord("זמן"), heWord("שעה"), heWord("דקה"), heWord("שניה"),
      heWord("היום"), heWord("מחר"), heWord("אתמול"),
    ],
    position: "top-left",
    previewBg: "from-blue-400 to-indigo-700",
  },
  {
    id: "winner",
    emoji: "🏆",
    sfx: "chime",
    patterns: [
      heWord("ניצחון"), heWord("ניצחתי"), heWord("הראשון"),
      heWord("מנצח"), heWord("מקום\\s+ראשון"),
    ],
    position: "top-center",
    previewBg: "from-yellow-400 to-amber-600",
  },
  {
    id: "thinking",
    emoji: "🤔",
    sfx: "ding",
    patterns: [
      heWord("חושב"), heWord("חושבת"), heWord("חשבתי"),
      heWord("מחשבה"), heWord("רעיון"),
    ],
    position: "top-right",
    previewBg: "from-violet-400 to-purple-700",
  },
  {
    id: "shocked",
    emoji: "😱",
    sfx: "boom",
    patterns: [
      heWord("הלם"), heWord("מזעזע"), heWord("בלתי\\s+ייאמן"),
      heWord("שוקד"), heWord("נדהמתי"), heWord("וואו"),
    ],
    position: "top-center",
    previewBg: "from-red-500 to-orange-700",
  },
  {
    id: "warning",
    emoji: "⚠️",
    sfx: "boom",
    patterns: [
      heWord("זהירות"), heWord("סכנה"), heWord("שים\\s+לב"),
      heWord("שימי\\s+לב"), heWord("אזהרה"),
    ],
    position: "top-center",
    previewBg: "from-yellow-500 to-red-600",
  },
  {
    id: "celebration",
    emoji: "🎉",
    sfx: "chime",
    patterns: [
      heWord("חוגגים"), heWord("חגיגה"), heWord("מסיבה"),
      heWord("יום\\s+הולדת"), heWord("מזל\\s+טוב"),
    ],
    position: "top-left",
    previewBg: "from-pink-400 to-purple-600",
  },
];

export type ElementEvent = {
  /** Time (in OUTPUT timeline, seconds) — already retimed if silence cut */
  time: number;
  /** Duration on screen (typically 700-1200ms) */
  durationSec: number;
  category: KeywordCategory;
  /** The word/text that matched (for debugging) */
  matchedText: string;
};

/**
 * Scan subtitles for keyword matches and emit one element event per match.
 * De-duplicates close-by matches of the same category (within 2s) to avoid spam.
 *
 * subtitles are expected to be in the FINAL (cut) timeline so element times
 * line up with the rendered video.
 */
export function detectElements(subtitles: Subtitle[]): ElementEvent[] {
  const events: ElementEvent[] = [];

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;

    for (const cat of KEYWORD_CATEGORIES) {
      for (const pattern of cat.patterns) {
        const m = sub.text.match(pattern);
        if (!m) continue;

        // Find the matched word's approximate timestamp inside the subtitle
        const matchIdx = sub.text.indexOf(m[0]);
        const ratio = sub.text.length > 0 ? matchIdx / sub.text.length : 0;
        const subDur = sub.end - sub.start;
        let time = sub.start + ratio * subDur;

        // Refine via word-level timestamps if available
        if (sub.words) {
          const cleanMatch = m[0].replace(/[?.,!]/g, "").trim();
          const wordHit = sub.words.find((w) =>
            w.word.includes(cleanMatch) || cleanMatch.includes(w.word),
          );
          if (wordHit) time = wordHit.start;
        }

        // De-dupe: skip if same category fired within the last 2 seconds
        const recent = events.find(
          (e) => e.category.id === cat.id && Math.abs(e.time - time) < 2,
        );
        if (recent) continue;

        events.push({
          time,
          durationSec: 0.9,
          category: cat,
          matchedText: m[0],
        });
        break; // one match per category per subtitle
      }
    }
  }

  return events.sort((a, b) => a.time - b.time);
}
