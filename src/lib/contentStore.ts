/**
 * Editable content store — the CMS backing layer.
 *
 * Every key here is editable from /admin → תוכן/מיתוג/תמחור. Reads happen
 * client-side via useContent() / getContentSync(). On the server, callers
 * should pass values in from the client OR seed-defaults — we don't
 * import localStorage on the server side.
 *
 * Today: localStorage. Tomorrow (Lovable): single Supabase table
 *   create table content (key text primary key, value jsonb, updated_at timestamptz)
 * — and the same API surface here keeps the components untouched.
 */

const LS_KEY = "vm_content_v1";

export type Content = Record<string, unknown>;

/** Defaults shipped with the app — used until an admin overrides a key. */
export const CONTENT_DEFAULTS = {
  // ── Branding ─────────────────────────────────────────────
  "brand.appName": "סטודיו כתוביות",
  "brand.tagline": "תמלול עברית אוטומטי • חינמי לצמיתות",
  "brand.logoUrl": "",                // empty → fallback to icon mark
  "brand.primaryColor": "#7C3AED",
  "brand.accentColor":  "#22D3EE",
  "brand.heroImageUrl": "",           // empty → no hero image

  // ── Home hero ─────────────────────────────────────────────
  "home.heroTitle": "עורכת סרטונים בקליק",
  "home.heroSubtitle": "העלי סרטון, ה-AI ייצור כתוביות, אפקטים, וסאונד אוטומטית",
  "home.uploadCta": "העלי סרטון",
  "home.multiCardTitle": "מולטי-וידאו AI Editor",
  "home.multiCardDesc": "העלי כמה סרטונים + הדביקי תסריט. ה-AI יחתוך, יבחר ויאחד לסרטון אחד.",
  "home.multiCardBadge": "✨ חדש",

  // ── Mode picker section header ─────────────────────────────
  "mode.sectionTitle": "איך AI יערוך לך את הסרטון?",
  "mode.sectionSubtitle": "בחרי סגנון — אחרי התמלול תוכלי לעצב את הכתוביות מתוך 10+ תבניות",

  // ── Mode cards: title, tagline, description, features (newline-separated) ──
  "mode.subtitles_only.title":    "כתוביות בלבד",
  "mode.subtitles_only.tagline":  "פשוט",
  "mode.subtitles_only.desc":     "הוספת כתוביות בלבד, ללא שינוי בוידאו. 10+ תבניות עיצוב לבחירה.",
  "mode.subtitles_only.features": "תמלול אוטומטי בעברית\n10+ תבניות עיצוב\nייצוא MP4 או SRT לפרמייר\nללא שינוי בקצב הוידאו",

  "mode.basic_effects.title":     "אפקטים בסיס",
  "mode.basic_effects.tagline":   "מתחילים",
  "mode.basic_effects.desc":      "זום עדין, מעברים בין משפטים, חיתוך זמני שתיקה ארוכים.",
  "mode.basic_effects.features":  "זום-אין/אאוט עדין על דובר\nחיתוך שתיקות (silence cut)\nמעברים חלקים בין משפטים\nתיקון חשיפה אוטומטי",

  "mode.podcast.title":           "פודקאסט",
  "mode.podcast.tagline":         "אינסטה/יוטיוב",
  "mode.podcast.desc":            "סגנון Rollin' Video — חיתוך אנכי + כתוביות בולטות לפודקאסטרים.",
  "mode.podcast.features":        "חיתוך 9:16 / 1:1 / 16:9\nכתוביות גדולות וקריאות\nמיתוג עם פס שם למטה\nמותאם להעלאה לאינסטה",

  "mode.advanced_effects.title":  "אפקטים מתקדמים",
  "mode.advanced_effects.tagline":"מקצועי",
  "mode.advanced_effects.desc":   "AI מזהה דובר, עושה זום חכם על הפנים, אפקטי טקסט אנימטיביים, מעברים מקצועיים.",
  "mode.advanced_effects.features":"זיהוי פנים + זום אוטומטי\nאנימציות פופ/באונס/החלקה\nמעברים מקצועיים בין סצנות\nהבזק צבע ברגעי אמפזיס",

  // ── Footer / legal ─────────────────────────────────────────
  "footer.text": "© כל הזכויות שמורות למאסטר וידאו",
  "footer.contactEmail": "hi@videomaster.example",

  // ── Credit costs (override CREDIT_COSTS in src/lib/credits.ts) ──
  "pricing.cost.subtitles_only": 10,
  "pricing.cost.basic_effects":  20,
  "pricing.cost.podcast":        20,
  "pricing.cost.advanced_effects": 40,
  "pricing.cost.multi_video":    30,

  // ── Credit packages (override CREDIT_PACKAGES in src/lib/credits.ts) ──
  // Stored as JSON array — edited via the dedicated table editor.
  "pricing.packages": [
    { id: "mini",     credits: 25,  priceIls: 10,  label: "התחלה",   highlight: "" },
    { id: "starter",  credits: 50,  priceIls: 25,  label: "פופולרי", highlight: "הכי נמכר" },
    { id: "pro",      credits: 100, priceIls: 50,  label: "פרו",     highlight: "" },
    { id: "business", credits: 200, priceIls: 100, label: "ביזנס",   highlight: "הכי משתלם" },
  ],

  // ── Whisper model names (shown in subtitle settings panel) ──
  "whisper.modelName.hebrew":    "עברית מקצועי",
  "whisper.modelName.universal": "כללי מדויק",

  // ── SFX label overrides — admin renames each sfxId after listening ──
  // map { sfxId → custom label }; entries not present use the default
  // from SFX_LIBRARY (e.g. "קליק #1").
  "sfx.labels": {} as Record<string, string>,

  // ── New-user welcome ──────────────────────────────────────
  "welcome.freeCredits": 25,
  "welcome.message": "ברוכה הבאה! קיבלת {{credits}} קרדיט מתנה כדי להתחיל",
} as const;

export type ContentKey = keyof typeof CONTENT_DEFAULTS;

function read(): Content {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function write(c: Content) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(c));
  window.dispatchEvent(new CustomEvent("content-change"));
}

/** Read a single key with a typed default. SSR-safe (returns default). */
export function getContent<K extends ContentKey>(key: K): (typeof CONTENT_DEFAULTS)[K] {
  const c = read();
  const v = c[key];
  return (v !== undefined ? v : CONTENT_DEFAULTS[key]) as (typeof CONTENT_DEFAULTS)[K];
}

export function setContent<K extends ContentKey>(key: K, value: (typeof CONTENT_DEFAULTS)[K]) {
  const c = read();
  c[key] = value;
  write(c);
}

/** Reset a single key to its shipped default */
export function resetContentKey<K extends ContentKey>(key: K) {
  const c = read();
  delete c[key];
  write(c);
}

/** Wipe ALL overrides */
export function resetAllContent() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEY);
  window.dispatchEvent(new CustomEvent("content-change"));
}

/** List all keys grouped by their dot-prefix (brand/home/mode/footer/pricing) */
export function listContentByGroup(): Record<string, ContentKey[]> {
  const groups: Record<string, ContentKey[]> = {};
  (Object.keys(CONTENT_DEFAULTS) as ContentKey[]).forEach((k) => {
    const grp = k.split(".")[0];
    (groups[grp] ||= []).push(k);
  });
  return groups;
}
