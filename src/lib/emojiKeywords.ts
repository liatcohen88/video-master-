/**
 * Hebrew search keywords for emojis.
 *
 * Hebrew speakers don't naturally search "fire" — they type "אש". Without a
 * keyword map, the picker's search would return nothing for Hebrew queries.
 * Each emoji here gets a small set of synonyms covering common Hebrew terms
 * Liat or her users actually use. Curated by category — pop culture +
 * obvious noun → emoji mappings.
 *
 * Falls back gracefully: if an emoji isn't here, search by category name
 * still works (so "אוכל" reveals all food emojis).
 */

export const EMOJI_KEYWORDS: Record<string, string[]> = {
  // Popular
  "💎": ["יהלום", "תכשיט", "יוקרה", "פרימיום", "diamond"],
  "🔥": ["אש", "ויראלי", "חזק", "fire", "lit"],
  "⚡": ["ברק", "מהר", "מהיר", "אנרגיה", "lightning", "fast"],
  "✨": ["נצנצים", "קסם", "נצנוץ", "sparkle"],
  "💥": ["פיצוץ", "בום", "boom"],
  "🌟": ["כוכב", "מצויין", "star"],
  "💯": ["מאה", "מושלם", "100"],
  "🚀": ["רקטה", "צמיחה", "השקה", "rocket"],
  "💪": ["שריר", "חזק", "אימון", "strength"],
  "👑": ["כתר", "מלך", "מלכה", "crown"],
  "🎯": ["מטרה", "יעד", "מדויק", "target"],
  "🎉": ["חגיגה", "מסיבה", "party"],
  "🤯": ["מטורף", "פיצוץ ראש", "mind blown"],
  "😱": ["שוק", "פחד", "מפחיד", "shock"],
  "👀": ["עיניים", "מבט", "שימו לב", "eyes"],
  "🙌": ["ידיים למעלה", "תהילה", "praise"],
  "✅": ["וי", "אישור", "check"],
  "❤️": ["לב", "אהבה", "אדום", "love", "heart"],

  // Money / business
  "💰": ["שק כסף", "כסף", "money"],
  "💵": ["שטר", "דולר", "cash"],
  "💸": ["כסף עף", "הוצאה", "money"],
  "💳": ["אשראי", "כרטיס", "תשלום", "credit"],
  "📈": ["גרף עולה", "צמיחה", "growth"],
  "📊": ["סטטיסטיקה", "נתונים", "stats"],
  "💼": ["תיק", "עבודה", "עסק", "business"],
  "🏦": ["בנק", "bank"],
  "🤑": ["דולר", "כסף בעיניים", "money face"],
  "🪙": ["מטבע", "coin"],
  "🛍️": ["קניות", "shopping"],
  "🏷️": ["תג מחיר", "מבצע", "tag"],

  // Emotions
  "😍": ["אוהב", "התאהבות", "love eyes"],
  "🥰": ["אהבה", "חמוד", "smiley love"],
  "😎": ["מגניב", "משקפיים", "cool"],
  "🤩": ["וואו", "כוכב", "star eyes"],
  "😂": ["צוחק עד דמעות", "lol"],
  "🤣": ["מתגלגל מצחוק", "rofl"],
  "🥹": ["מרגש", "כמעט בוכה"],
  "😭": ["בוכה", "עצוב", "crying"],
  "🙏": ["תפילה", "תודה", "בבקשה", "pray"],
  "😅": ["מצחיק במבוכה", "sweat smile"],
  "🥳": ["יום הולדת", "חוגג", "party"],

  // Faces
  "😀": ["מחייך", "smile"],
  "😊": ["מחייך נחמד", "blush"],
  "🤔": ["חושב", "thinking"],
  "😴": ["ישן", "עייף", "sleeping"],
  "😶": ["שותק", "ללא מילים"],
  "🤫": ["שקט", "shh"],
  "🤐": ["סגור פה", "סוד"],
  "😜": ["משתעשע", "wink tongue"],

  // Hands / actions
  "👆": ["מצביע למעלה", "up"],
  "👇": ["מצביע למטה", "down"],
  "👈": ["מצביע ימינה", "left"],
  "👉": ["מצביע שמאלה", "right"],
  "👍": ["לייק", "אגודל", "thumbs up"],
  "👎": ["דיסלייק", "אגודל למטה", "thumbs down"],
  "👏": ["מחיאות כפיים", "clap"],
  "✋": ["יד", "עצור", "stop"],
  "🤝": ["לחיצת יד", "עסקה", "deal"],
  "👋": ["שלום", "להתראות", "wave"],

  // Objects
  "🎁": ["מתנה", "gift"],
  "📱": ["טלפון", "סמארטפון", "phone"],
  "💻": ["מחשב נייד", "laptop"],
  "📷": ["מצלמה", "camera"],
  "🎬": ["סרט", "קולנוע", "movie"],
  "🎵": ["מוזיקה", "תו", "music"],
  "🏆": ["גביע", "ניצחון", "trophy"],
  "🥇": ["מקום ראשון", "מדליה", "gold"],
  "💡": ["נורה", "רעיון", "idea"],
  "📦": ["קופסה", "חבילה", "package"],
  "🔔": ["פעמון", "התראה", "bell"],
  "🎤": ["מיקרופון", "שירה", "mic"],
  "📺": ["טלוויזיה", "tv"],

  // Nature
  "☀️": ["שמש", "sun"],
  "🌙": ["ירח", "moon"],
  "⭐": ["כוכב", "star"],
  "🌈": ["קשת", "rainbow"],
  "🌊": ["גלים", "ים", "wave"],
  "🌸": ["פרח ורוד", "סקורה", "flower"],
  "🌹": ["ורד", "אהבה", "rose"],
  "🍀": ["תלתן", "מזל", "luck"],
  "🦄": ["חד-קרן", "unicorn"],
  "🐶": ["כלב", "dog"],
  "🐱": ["חתול", "cat"],
  "🦋": ["פרפר", "butterfly"],
  // Birds (Liat's "ציוץ" example)
  "🐦": ["ציפור", "ציוץ", "bird", "tweet"],
  "🐤": ["אפרוח", "ציפור", "ציוץ", "chick"],
  "🐔": ["תרנגולת", "chicken"],
  "🦅": ["נשר", "eagle"],

  // Food
  "🍕": ["פיצה", "pizza"],
  "🍔": ["המבורגר", "burger"],
  "🍟": ["צ׳יפס", "fries"],
  "🍿": ["פופקורן", "popcorn"],
  "🥤": ["משקה", "כוס", "drink"],
  "☕": ["קפה", "coffee"],
  "🍩": ["דונאט", "donut"],
  "🎂": ["עוגת יום הולדת", "cake"],
  "🍫": ["שוקולד", "chocolate"],
  "🍦": ["גלידה", "ice cream"],
  "🍷": ["יין", "wine"],
  "🍻": ["בירה", "לחיים", "beer"],

  // Symbols
  "❓": ["שאלה", "question"],
  "❗": ["קריאה", "חשוב", "exclamation"],
  "⭕": ["עיגול", "צודק", "circle"],
  "❌": ["איקס", "טעות", "x"],
  "⚠️": ["אזהרה", "warning"],
  "🚫": ["אסור", "no"],
  "🆕": ["חדש", "new"],
  "🆓": ["חינם", "free"],
};

/** Test whether an emoji's Hebrew/English keywords contain the query. Empty
 *  query matches everything. Case-insensitive, substring-based — same UX as
 *  the SFX picker. */
export function emojiMatches(emoji: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const words = EMOJI_KEYWORDS[emoji] ?? [];
  if (words.some((w) => w.toLowerCase().includes(q))) return true;
  // Bare-emoji search ("🔥") matches itself, useful for paste-search.
  return emoji.includes(query);
}
