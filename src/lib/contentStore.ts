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
  "brand.appName": "Master Video",
  "brand.tagline": "עריכת וידאו חכמה מבוססת AI • פיתוח ישראלי",
  // In-app currency name (plural). Change to "קרדיטים" to revert the rebrand.
  "brand.currencyName": "מאסטרים",
  "brand.logoUrl": "",                // empty → fallback to icon mark
  "brand.primaryColor": "#7C3AED",
  "brand.accentColor":  "#22D3EE",
  "brand.heroImageUrl": "",           // empty → no hero image
  "brand.headerLogoSize": 44,         // size in px of the header logo

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
  "footer.tagline": "עורכים סרטונים בעברית. בלי להוריד שום תוכנה.",
  "footer.address": "ישראל",
  "footer.contactEmail": "motiva8891@gmail.com",
  "footer.contactPhone": "053-5372699",

  // ── Contact page ─────────────────────────────────────────────
  "contact.title":        "בואו נדבר",
  "contact.subtitle":     "אנחנו פה לכל שאלה — תוך 24 שעות תקבלו תשובה",
  "contact.phoneTitle":   "טלפון",
  "contact.phoneHint":    "ימים א'–ה', 09:00–18:00",
  "contact.whatsappTitle":"וואטסאפ",
  "contact.whatsappHint": "המהיר ביותר — מענה תוך שעה ביום עסקים",
  "contact.emailTitle":   "מייל",
  "contact.emailHint":    "לפניות מורכבות ועסקיות",
  "contact.hoursTitle":   "שעות פעילות",
  "contact.hoursBody":    "א'–ה' 09:00–18:00\nו' 09:00–13:00\nשבת סגור",

  // ── Landing page — trust badges (5 in order) ──────────────
  "landing.badge.1": "ללא צורך בהתקנה",
  "landing.badge.2": "25 מאסטרים במתנה",
  "landing.badge.3": "מותאם לשפה העברית",
  "landing.badge.4": "תוצאה מושלמת תוך דקות",
  "landing.badge.5": "הורדת כתוביות בקובץ לפרמייר",

  // ── Landing page — "how it works" section ─────────────────
  "landing.how.eyebrow": "איך זה עובד",
  "landing.how.title":   "מסרטון גולמי לרילס מוכן ב-3 צעדים",
  "landing.how.subtitle":"הכל קורה בדפדפן. אין להתקין, אין הרשמה מסובכת. רק להעלות וללכת.",
  "landing.step1.title": "העלאת סרטון",
  "landing.step1.body":  "גוררים קובץ MP4/MOV מהמחשב. הקובץ נשאר בדפדפן שלכם — פרטי לחלוטין.",
  "landing.step2.title": "ה-AI עורך",
  "landing.step2.body":  "תמלול עברי מדויק, חיתוך שתיקות, סגנון כתוביות, אנימציות וסאונד — אוטומטית או לפי בחירה.",
  "landing.step3.title": "ייצוא ועלייה",
  "landing.step3.body":  "MP4 ברזולוציה המקורית, מוכן לרילס/טיקטוק/יוטיוב. או SRT לפרמייר.",

  // ── Landing page — big claim section ──────────────────────
  "landing.claim.eyebrow":  "100% בדפדפן",
  "landing.claim.titlePre": "עורכים סרטונים",
  "landing.claim.titleHi":  "בלי להוריד",
  "landing.claim.titleSuf": "שום תוכנה.",
  "landing.claim.body":     "אדובי פרמייר עולה ₪240/חודש ודורש מחשב חזק. כאן: חינמי, בדפדפן, בעברית, מוכן ב-5 דקות.",
  "landing.claim.cta":      "להתחיל עכשיו",

  // ── Landing page — features (6) ───────────────────────────
  "landing.features.eyebrow": "פיצ'רים",
  "landing.features.title":   "כל מה שצריך לעריכת רילס מקצועי",
  "landing.features.subtitle":"במקום להתקין 5 כלים שונים — הכל אצלנו, בעברית, בלי קימפול ובלי מנוי חודשי.",
  "landing.feat1.title": "תמלול עברי מקצועי",
  "landing.feat1.body":  "מודל Whisper מאומן ספציפית לעברית. הכי מדויק שיש בשוק — כולל מבטא ישראלי וסלנג.",
  "landing.feat2.title": "סגנונות כתוביות מוכנים",
  "landing.feat2.body":  "פודקאסט, TikTok, Hormozi, Instagram מודרני ועוד. לחיצה אחת = כל ההגדרות נטענות.",
  "landing.feat3.title": "מולטי-וידאו AI",
  "landing.feat3.body":  "מעלים כמה סרטונים + תסריט, ה-AI חותך ומאחד לסרטון אחד מקצועי. פיצ'ר הדגל.",
  "landing.feat4.title": "אנימציות ו-SFX",
  "landing.feat4.body":  "23 אנימציות Lottie וקטוריות עם בוחר צבע, 65 צלילים ויראליים — הכל בלחיצה.",
  "landing.feat5.title": "מחיר הוגן",
  "landing.feat5.body":  "משלמים רק כשמייצאים. לא פג לעולם. סרטון פשוט = 10 מאסטרים, מתקדם = 40.",
  "landing.feat6.title": "שמירה אוטומטית",
  "landing.feat6.body":  "כל שנייה הכל נשמר. ברענון ממשיכים מאיפה שהפסקתם. אף פעם לא תאבדו עבודה.",

  // ── Landing page — Showcase cards (video mockup section) ──
  "landing.showcase1.title":     "פחות מ-10 שניות ויש לכם רילס מוכן",
  "landing.showcase1.body":      "ה-AI מתמלל את הסרטון, מעצב כתוביות בעברית, מוסיף אפקטים — ומייצא MP4 מוכן לעלייה. בלי להוריד שום תוכנה.",
  "landing.showcase1.caption1":  "היי חברים,",
  "landing.showcase1.caption1Hi":"חברים",
  "landing.showcase1.caption2":  "אתם חייבים",
  "landing.showcase1.caption2Hi":"חייבים",
  "landing.showcase1.emoji":     "👋",
  "landing.showcase2.title":     "חיבור סרטונים AI — מאחד לכם הכל",
  "landing.showcase2.body":      "כמה סרטונים + תסריט = סרטון אחד רציף. ה-AI מחבר אותם לפי הסדר שכתבתם, ואתם בוחרים ידנית איזה סרטון לכל שורה.",
  "landing.showcase2.caption1":  "3 סרטונים",
  "landing.showcase2.caption1Hi":"3",
  "landing.showcase2.caption2":  "סיפור אחד",
  "landing.showcase2.caption2Hi":"אחד",
  "landing.showcase2.emoji":     "✨",

  // ── Landing page — testimonials ───────────────────────────
  "landing.test.eyebrow":  "מה אומרים עלינו",
  "landing.test.title":    "יוצרות ויוצרי תוכן בישראל כבר אצלנו",
  "landing.test1.name":    "נועה ר.",
  "landing.test1.role":    "פודקאסטרית, 12K עוקבים",
  "landing.test1.quote":   "חסכתי שעות של עריכה. תמלול בעברית שווה הכל — אפילו הז'רגון של ההייטק נכון.",
  "landing.test2.name":    "עומר ל.",
  "landing.test2.role":    "יוצר תוכן בטיקטוק",
  "landing.test2.quote":   "המולטי-וידאו עשה לי את החיים. שני סרטונים + תסריט = סרטון אחד מוכן. מטורף.",
  "landing.test3.name":    "טל מ.",
  "landing.test3.role":    "מנהלת סושיאל בעסק",
  "landing.test3.quote":   "₪25 לחודש לבזבז על כתוביות? הסתבכנו עם Kapwing שלא תמך בעברית. פה זה פשוט עובד.",

  // ── Landing page — pricing teaser + final CTA ──────────────
  "landing.pricing.eyebrow":  "תמחור",
  "landing.pricing.title":    "פשוט. שקוף. בלי הפתעות.",
  "landing.pricing.subtitle": "קונים חבילה פעם אחת, משתמשים כשרוצים. אין מנוי חודשי, אין חידוש אוטומטי.",
  "landing.pricing.cta":      "למחירון המלא",
  "landing.cta.title":  "להתחיל עכשיו",
  "landing.cta.body":   "25 קרדיט במתנה ברישום. מספיק ל-2-3 סרטונים שלמים. בלי כרטיס אשראי.",
  "landing.cta.button": "בואו נתחיל",
  "landing.cta.bullets":"ללא הורדות · ללא הרשמה לטסט · קרדיט לא פג",

  // ── Legal — Terms & Privacy (editable from admin) ──────────
  "legal.title":     "תקנון ומדיניות פרטיות",
  "legal.subtitle":  "מאסטר וידאו — תנאי השימוש והגנת הפרטיות",
  "legal.lastUpdate":"עודכן לאחרונה: יוני 2026",
  "legal.privacyHeader": "הפרטיות שלכם בראש סדר העדיפויות",
  "legal.privacyBody":
    "אנחנו לא שומרים את הסרטונים שלכם. עיבוד הוידאו והתמלול קורים בזמן השימוש שלכם — אחרי הייצוא, " +
    "הקובץ נמחק מהשרת באופן אוטומטי. רק קובצי הפלט שלכם נשארים אצלכם.\n\n" +
    "אנחנו אוספים אך ורק: שם, אימייל, היסטוריית קניות (לצורך חשבונית מס) ומונים סטטיסטיים אנונימיים. " +
    "אנחנו לא משתפים נתונים עם צד שלישי, לא מציגים פרסומות, ולא מוכרים מידע.",
  "legal.termsHeader": "תנאי שימוש",
  "legal.termsBody":
    "1. השירות מסופק כפי שהוא (As-Is). אנחנו עושים את המקסימום כדי שיעבוד תמיד, אבל לא ניתן להבטיח זמינות 100%.\n\n" +
    "2. הקרדיט שלכם תקף ללא הגבלת זמן. ניתן לקבל החזר על קרדיט שלא נוצל בתוך 14 יום מהקנייה.\n\n" +
    "3. אסור להעלות תוכן בלתי-חוקי, מפר זכויות יוצרים, או פוגעני. אנחנו שומרים את הזכות להשעות חשבונות שמפרים זאת.\n\n" +
    "4. השימוש בתוצרים (סרטונים מיוצאים) הוא שלכם — אנחנו לא דורשים זכויות עליהם.",
  "legal.contactHeader": "יצירת קשר",
  "legal.contactBody":   "לכל שאלה: hi@videomaster.example · אנחנו חוזרים תוך 24 שעות.",

  // ── Credit costs (override CREDIT_COSTS in src/lib/credits.ts) ──
  "pricing.cost.subtitles_only": 10,
  "pricing.cost.basic_effects":  20,
  "pricing.cost.podcast":        20,
  "pricing.cost.advanced_effects": 25,
  "pricing.cost.multi_video":    20,

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
  "whisper.modelDesc.hebrew":    "מאומן ספציפית לעברית — הכי מדויק. מומלץ!",
  "whisper.modelDesc.universal": "מודל גדול ומדויק לכל השפות",
  "whisper.recommendedBadge":    "מומלץ",

  // ── Subtitle-settings panel labels (fully editable) ──────────
  "settings.title":            "הגדרות כתוביות",
  "settings.modelLabel":       "מודל AI לתמלול",
  "settings.maxWords.label":   "מקסימום מילים בשורה",
  "settings.maxWords.hint":    "בסגנון רילס מומלץ 1-2. בסגנון נקי 4-6.",
  "settings.minWords.label":   "מינימום מילים בשורה",
  "settings.punctuation.label":"הוסף פיסוק",
  "settings.punctuation.hint": "פסיקים ונקודות אוטומטיות מ-AI",
  "settings.stretch.label":    "מתח כתוביות",
  "settings.stretch.hint":     "הארך כל כתובית עד תחילת הבאה (נראה חלק יותר)",

  // ── SFX label overrides — admin renames each sfxId after listening ──
  // map { sfxId → custom label }; entries not present use the default
  // from SFX_LIBRARY (e.g. "קליק #1").
  "sfx.labels": {} as Record<string, string>,
  // map { categoryId → custom Hebrew category title }
  "sfx.categoryLabels": {} as Record<string, string>,
  // map { sfxId → categoryId } — moves an effect into a different category
  "sfx.categoryOverrides": {} as Record<string, string>,
  // Admin-uploaded sounds: [{id, label, category, url}] — files live in
  // public/sfx/sfx_<id>.mp3 (uploaded via /api/sfx/upload)
  "sfx.custom": [] as Array<{ id: string; label: string; category: string; url: string }>,
  // Hidden SFX ids — won't appear in the picker. Existing videos using a
  // hidden SFX still play it (lookup by id stays valid); we only filter the
  // gallery the user picks new sounds from.
  "sfx.hidden": {} as Record<string, true>,
  // Display order of categories. id → position. Admin reorders by drag.
  // Categories not in this list fall back to the built-in default order.
  "sfx.categoryOrder": [] as string[],
  // User-added categories (e.g. "שונים"). Each has an id (slug) + Hebrew
  // label. Sounds get moved into them via the "move to category" dropdown.
  "sfx.customCategories": [] as Array<{ id: string; label: string }>,

  // ── Intro animations — hide presets per admin choice ─────────────
  // id → true means "hide from the picker in EffectsPanel". Like the SFX
  // approach, existing videos using a hidden preset still render normally.
  "intro.hidden": {} as Record<string, true>,

  // ── Lottie overrides (admin → טאב Lottie) ────────────────────────
  // Hidden IDs (won't appear in the picker / AI auto-pick). Old videos
  // already referencing the icon still render — we filter on add only.
  "lottie.hidden":   {} as Record<string, true>,
  // Rename display name shown in the picker. id → new Hebrew name.
  "lottie.names":    {} as Record<string, string>,
  // Override default tint color (#rrggbb). id → color.
  "lottie.colors":   {} as Record<string, string>,
  // Strip the background rectangle/solid layer from these icons. id → true.
  // Useful when LottieFiles ships an animation with a colored square behind
  // the icon — looks fine on their site, ugly floating on top of video.
  "lottie.bgRemoved":{} as Record<string, true>,
  // Admin-uploaded Lottie JSONs: [{id, name, jsonPath, defaultColor}] —
  // files live in public/lottie/<id>.json (via /api/lottie/upload).
  "lottie.custom":   [] as Array<{ id: string; name: string; jsonPath: string; defaultColor?: string }>,

  // ── Emoji picker extensions ──────────────────────────────────────
  // Extra emojis Liat adds per category (appended to the built-in list).
  // Key = exact category Hebrew name from EMOJI_CATEGORIES.
  "emoji.extras":    {} as Record<string, string[]>,
  // Emojis to hide globally (any string match across all categories).
  "emoji.hidden":    [] as string[],

  // ── WOW effect: power-words detection ────────────────────────────
  // Extra Hebrew words that should trigger the WOW burst (beyond the
  // hardcoded list in wowEffects.ts). Each entry becomes a heWord(...)
  // pattern → matches the word as a standalone token.
  "wow.extraWords":  [] as string[],
  // Built-in words Liat wants silenced (e.g. "הכי" fires too often).
  "wow.hiddenWords": [] as string[],

  // ── Drama Mode: B&W flash + sting on "אני לא מאמין" / "זה לא קורה לי" ──
  "drama.extraWords":  [] as string[],
  "drama.hiddenWords": [] as string[],

  // ── Post-registration welcome popup ───────────────────────
  // Shown only after a successful sign-up (triggered by ?welcome=1
  // URL param, or by setting localStorage "vm_just_registered" = "1").
  // NOT shown on every page load — only ONCE after registering.
  "welcome.freeCredits": 25,
  "welcome.title":   "ברוכים הבאים! 🎉",
  "welcome.message": "קיבלת {{credits}} מאסטרים מתנה כדי להתחיל לערוך — בלי הגבלת זמן.",
  "welcome.cta":     "יאללה, מתחילים!",

  // ── Credits / pricing page (/credits) ─────────────────────
  "credits.eyebrow":         "חבילות מאסטרים",
  "credits.title":           "בחרי את הקצב שלך",
  "credits.subtitle":        "חיוב חד-פעמי · תקף ללא הגבלת זמן · אין מנוי חודשי",
  "credits.calcEyebrow":     "שקיפות תמחור",
  "credits.calcTitle":       "כמה שווה סרטון?",
  "credits.calcSubtitle":    "המחיר יורד מהיתרה רק בלחיצה על \"ייצוא\"",
  "credits.balanceLabel":    "היתרה שלך",
  "credits.calcCalcLabel":   "איתם תוכלו לעשות:",

  // ── Footer / sitemap link names (per-link CMS) ────────────
  "footer.link.home":     "דף הבית",
  "footer.link.multi":    "חיבור סרטונים",
  "footer.link.credits":  "חבילות מאסטרים",
  "footer.link.help":     "שאלות נפוצות",
  "footer.link.contact":  "יצירת קשר",
  "footer.link.policy":   "תקנון ופרטיות",
  "footer.bottom.terms":  "תנאי שימוש",
  "footer.bottom.privacy":"מדיניות פרטיות",

  // ── Dashboard / profile page ──────────────────────────────
  "dashboard.greeting":         "היי {{name}} 👋",
  "dashboard.statsLine":        "ניצלתם {{used}} {{currency}}",
  "dashboard.sections.history": "גרסאות שמורות",
  "dashboard.sections.invoices":"חשבוניות",
  "dashboard.empty.noHistory":  "אין גרסאות שמורות",
  "dashboard.empty.savedVideo": "סרטון שמור (עוד לא נוצרה גרסה)",

  // ── Multi-video joiner page (/multi) ──────────────────────
  "multi.title":      "חיבור סרטונים AI",
  "multi.subtitle":   "העלו 2–8 סרטונים + תסריט, וה-AI יחבר אותם לסרטון אחד לפי הסדר שכתבתם",
  "multi.scriptLabel":"תסריט / טקסט",
  "multi.scriptHelp": "שורה לכל קטע. כל שורה תופיע ככתובית מעל סרטון אחד, לפי הסדר שכתבתם. ה-AI מחבר את הסרטונים לרצף אחד — הוא לא מנתח מה יש בכל סרטון. אחרי החיבור תוכלו לבחור ידנית איזה סרטון יופיע בכל שורה.",
  "multi.cta":        "חברו לסרטון אחד",
  "multi.bottomNote": "הורדה = הסרטון המחובר בלבד (בלי כתוביות). \"תנו ל-AI לתמלל ולערוך\" = מעבירים אותו לעורך לכתוביות + אפקטים.",
} as const;

export type ContentKey = keyof typeof CONTENT_DEFAULTS;

function read(): Content {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
const HISTORY_KEY = "vm_content_history_v1";
const MAX_HISTORY = 15;

/** Push the CURRENT stored state into a rolling history before overwriting,
 *  so any admin edit (or accidental wipe) can be rolled back. */
function pushHistory() {
  try {
    const current = localStorage.getItem(LS_KEY);
    if (!current || current === "{}") return;
    const raw = localStorage.getItem(HISTORY_KEY);
    const hist: { at: number; data: string }[] = raw ? JSON.parse(raw) : [];
    // Skip if identical to the latest snapshot (avoid noise on rapid blurs)
    if (hist.length > 0 && hist[hist.length - 1].data === current) return;
    hist.push({ at: Date.now(), data: current });
    while (hist.length > MAX_HISTORY) hist.shift();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  } catch { /* quota — best effort */ }
}

export function listContentHistory(): { at: number; keys: number }[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const hist: { at: number; data: string }[] = raw ? JSON.parse(raw) : [];
    return hist.map((h) => ({ at: h.at, keys: Object.keys(JSON.parse(h.data)).length })).reverse();
  } catch { return []; }
}

/** Restore the Nth most-recent history snapshot (0 = newest). */
export function restoreContentHistory(indexFromNewest: number): boolean {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const hist: { at: number; data: string }[] = raw ? JSON.parse(raw) : [];
    const entry = hist[hist.length - 1 - indexFromNewest];
    if (!entry) return false;
    pushHistory(); // keep the pre-restore state recoverable too
    localStorage.setItem(LS_KEY, entry.data);
    window.dispatchEvent(new CustomEvent("content-change"));
    return true;
  } catch { return false; }
}

/** Download-able backup of everything the admin customized. */
export function exportContentJson(): string {
  return localStorage.getItem(LS_KEY) ?? "{}";
}
export function importContentJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return false;
    pushHistory();
    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new CustomEvent("content-change"));
    return true;
  } catch { return false; }
}

function write(c: Content) {
  if (typeof window === "undefined") return;
  pushHistory();
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
