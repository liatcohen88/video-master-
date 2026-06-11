/**
 * Lottie animated-icon registry (curated 2026-06-07).
 *
 * 23 vector animations under public/lottie/, each mapped to Hebrew/English
 * keyword patterns so the AI auto-pick + manual-add flows can use them
 * without further config. All entries are vector-based (no embedded PNG
 * assets) so the color override pipeline + headless rasterizer both work.
 *
 * fire.json was REMOVED on 2026-06-07 — original was raster (28 base64
 * PNGs) which broke both tinting and the export rasterizer. Archived as
 * fire.json.broken-raster for forensic reference; not loaded here.
 */

import { heWord } from "./hebrewRegex";

export type LottieIcon = {
  id: string;
  name: string;
  /** Public path to the Lottie JSON */
  jsonPath: string;
  /** Hebrew/English keyword patterns for AI auto-pick */
  patterns: RegExp[];
  /** Default tint color (optional) */
  defaultColor?: string;
};

export const LOTTIE_ICONS: LottieIcon[] = [
  // Pre-curated vector trio (verified working 2026-06-07)
  {
    id: "money", name: "כסף", jsonPath: "/lottie/money.json",
    patterns: [heWord("כסף"), heWord("שקל"), heWord("דולר"), heWord("רווח"), heWord("הכנסה"), /\bmoney\b/i, /\$/],
    defaultColor: "#FACC15",
  },
  {
    id: "star", name: "כוכב", jsonPath: "/lottie/star.json",
    patterns: [heWord("מדהים"), heWord("מושלם"), heWord("הכי"), /\bstar\b/i],
    defaultColor: "#FFD700",
  },
  // rocket REMOVED 2026-06-11 — Liat: "תעיף" (low quality / not modern enough)
  // Original file preserved at public/lottie/rocket.json in case we re-enable.
  // New batch (downloaded 2026-06-07 via scripts/download-lottie.cjs)
  {
    id: "trophy", name: "גביע", jsonPath: "/lottie/trophy.json",
    patterns: [heWord("ניצחון"), heWord("ניצחתי"), heWord("הראשון"), heWord("מנצח"), heWord("גביע"), /\btrophy\b/i, /\bwinner\b/i],
    defaultColor: "#FACC15",
  },
  {
    id: "checkmark", name: "אישור", jsonPath: "/lottie/checkmark.json",
    patterns: [heWord("אישור"), heWord("בוצע"), heWord("הצלחה"), heWord("מאושר"), heWord("הושלם"), /\bdone\b/i, /\bsuccess\b/i],
    defaultColor: "#22C55E",
  },
  {
    id: "food", name: "אוכל", jsonPath: "/lottie/food.json",
    patterns: [heWord("אוכל"), heWord("אכלתי"), heWord("ארוחה"), heWord("מסעדה"), heWord("טעים"), heWord("מנה"), heWord("קניות")],
    defaultColor: "#F97316",
  },
  {
    id: "robot", name: "רובוט", jsonPath: "/lottie/robot.json",
    patterns: [heWord("רובוט"), heWord("בוט"), heWord("AI"), heWord("בינה"), /\bai\b/i, /\bbot\b/i, /\bgpt\b/i],
    defaultColor: "#60A5FA",
  },
  {
    id: "hand-pointer", name: "סמן יד", jsonPath: "/lottie/hand-pointer.json",
    patterns: [heWord("לחצו"), heWord("תלחצו"), heWord("לחיצה"), heWord("לחצי"), /\bclick\b/i, /\btap\b/i],
    defaultColor: "#F472B6",
  },
  {
    id: "party-confetti", name: "מסיבה", jsonPath: "/lottie/party-confetti.json",
    patterns: [heWord("חוגגים"), heWord("חגיגה"), heWord("מסיבה"), heWord("יום\\s+הולדת"), heWord("מזל\\s+טוב"), /\bparty\b/i],
    defaultColor: "#EC4899",
  },
  {
    id: "clock", name: "שעון", jsonPath: "/lottie/clock.json",
    patterns: [heWord("זמן"), heWord("שעה"), heWord("דקה"), heWord("דקות"), heWord("מהר"), heWord("עכשיו"), heWord("מיד"), /\btime\b/i],
    defaultColor: "#38BDF8",
  },
  {
    id: "heart", name: "לב", jsonPath: "/lottie/heart.json",
    patterns: [heWord("אוהב"), heWord("אוהבת"), heWord("אהבה"), heWord("הלב"), heWord("לב"), heWord("מרגש"), /\blove\b/i, /\bheart\b/i],
    defaultColor: "#EF4444",
  },
  {
    id: "gift", name: "מתנה", jsonPath: "/lottie/gift.json",
    patterns: [heWord("מתנה"), heWord("במתנה"), heWord("חינם"), heWord("בחינם"), heWord("הפתעה"), /\bgift\b/i, /\bfree\b/i],
    defaultColor: "#F87171",
  },
  {
    id: "gift-new", name: "חדש!", jsonPath: "/lottie/gift-new.json",
    patterns: [heWord("חדש"), heWord("חדשה"), heWord("השקה"), heWord("הצגת"), /\bnew\b/i, /\blaunch\b/i],
    defaultColor: "#A78BFA",
  },
  {
    id: "hello", name: "שלום!", jsonPath: "/lottie/hello.json",
    patterns: [heWord("שלום"), heWord("היי"), heWord("הי"), heWord("מבא"), heWord("ברוכים"), /\bhello\b/i, /\bhi\b/i],
    defaultColor: "#FBBF24",
  },
  {
    id: "wave", name: "ברכה", jsonPath: "/lottie/wave.json",
    patterns: [heWord("נעים"), heWord("להכיר"), heWord("דבר"), /\bwave\b/i],
    defaultColor: "#22D3EE",
  },
  {
    id: "namaste", name: "תודה", jsonPath: "/lottie/namaste.json",
    patterns: [heWord("תודה"), heWord("מודה"), heWord("בבקשה"), /\bthanks\b/i, /\bthank\s*you\b/i],
    defaultColor: "#FB923C",
  },
  {
    id: "cloud-upload", name: "ענן", jsonPath: "/lottie/cloud-upload.json",
    patterns: [heWord("ענן"), heWord("העלאה"), heWord("העלה"), heWord("לשמור"), heWord("גיבוי"), /\bcloud\b/i, /\bupload\b/i],
    defaultColor: "#93C5FD",
  },
  {
    id: "phone", name: "טלפון", jsonPath: "/lottie/phone.json",
    patterns: [heWord("טלפון"), heWord("נייד"), heWord("סמארטפון"), heWord("אפליקציה"), /\bphone\b/i, /\bmobile\b/i],
    defaultColor: "#A78BFA",
  },
  {
    id: "chat", name: "צ'אט", jsonPath: "/lottie/chat.json",
    patterns: [heWord("הודעה"), heWord("הודעות"), heWord("צ'אט"), heWord("התכתבות"), heWord("דיבור"), /\bmessage\b/i, /\bchat\b/i],
    defaultColor: "#34D399",
  },
  {
    id: "chart-up", name: "גרף עולה", jsonPath: "/lottie/chart-up.json",
    patterns: [heWord("גידול"), heWord("עלייה"), heWord("ביצועים"), heWord("יעדים"), heWord("דשבורד"), /\bgrowth\b/i, /\bdashboard\b/i],
    defaultColor: "#10B981",
  },
  {
    id: "analytics", name: "נתונים", jsonPath: "/lottie/analytics.json",
    patterns: [heWord("נתונים"), heWord("סטטיסטיקה"), heWord("מדדים"), heWord("דאטה"), /\banalytics\b/i, /\bdata\b/i],
    defaultColor: "#818CF8",
  },
  {
    id: "meditate", name: "מדיטציה", jsonPath: "/lottie/meditate.json",
    patterns: [heWord("רוגע"), heWord("שלווה"), heWord("מדיטציה"), heWord("נשימה"), heWord("נרגעים"), /\bmeditate\b/i, /\bcalm\b/i],
    defaultColor: "#A3E635",
  },
  {
    id: "sanitizer", name: "ניקיון", jsonPath: "/lottie/sanitizer.json",
    patterns: [heWord("ניקיון"), heWord("חיטוי"), heWord("נקי"), heWord("היגיינה"), /\bclean\b/i],
    defaultColor: "#67E8F9",
  },
  // 2026 trend batch (downloaded 2026-06-11)
  {
    id: "bell-notify", name: "פעמון התראה", jsonPath: "/lottie/bell-notify.json",
    patterns: [heWord("התראה"), heWord("התראות"), heWord("פעמון"), heWord("שימו\\s+לב"), heWord("הכי\\s+חשוב"), /\bnotify\b/i, /\balert\b/i],
    defaultColor: "#FACC15",
  },
  // sparkle-burst REMOVED 2026-06-11 — 600KB raster-heavy file froze the
  // admin grid on low-RAM machines. Will replace with a vector version.
];
