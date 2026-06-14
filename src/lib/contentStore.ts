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
  "legal.notificationsHeader": "התראות ועדכונים במייל",
  "legal.notificationsBody":
    "בעת הרישום לשירות, את/ה נותן/ת לנו רשות לשלוח עדכונים, חידושים ופיצ'רים חדשים לכתובת האימייל שמסרת — " +
    "בהיקף סביר ובהתאם לחוק התקשורת (בזק ושידורים), התשמ\"ב-1982.\n\n" +
    "בכל מייל כזה יופיע קישור \"הסר מרשימת התפוצה\" שלחיצה עליו תפסיק את העדכונים השיווקיים. " +
    "מיילים תפעוליים (אישור הרשמה, חשבונית, איפוס סיסמה) ימשיכו להישלח גם אחרי הסרה, כי הם נדרשים לתפעול החשבון.",
  "legal.contactHeader": "יצירת קשר",
  "legal.contactBody":   "לכל שאלה: hi@videomaster.example · אנחנו חוזרים תוך 24 שעות.",
  "legal.backToApp":     "חזרה לאפליקציה",

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

  // ── Login / Signup pages (/login, /signup) — every visible string ──
  "auth.backHome":              "לדף הבית",
  "auth.divider":               "או",
  "auth.oauth.google":          "Google",
  "auth.oauth.apple":           "Apple",
  "auth.field.name":            "שם",
  "auth.field.email":           "אימייל",
  "auth.field.password":        "סיסמה",
  // Login
  "auth.login.heading":         "ברוכה השבה",
  "auth.login.subheading":      "היכנסי לחשבון שלך",
  "auth.login.submit":          "התחברי",
  "auth.login.submitBusy":      "מתחברת...",
  "auth.login.noAccount":       "אין לך חשבון?",
  "auth.login.signupCta":       "הירשמי עכשיו",
  // Signup
  "auth.signup.heading":        "הרשמה חדשה",
  "auth.signup.subheading":     "25 מאסטרים במתנה",
  "auth.signup.badge":          "זה לוקח 30 שניות",
  "auth.signup.passPlaceholder":"לפחות 8 תווים",
  "auth.signup.submit":         "צרי חשבון",
  "auth.signup.submitBusy":     "יוצרת חשבון...",
  "auth.signup.terms":          "בלחיצה על \"צרי חשבון\" את מסכימה ל-",
  "auth.signup.haveAccount":    "כבר יש לך חשבון?",
  "auth.signup.loginCta":       "התחברי",
  "auth.signup.confirmTitle":   "כמעט שם! 🎉",
  "auth.signup.confirmBody":    "שלחנו לך אימייל אישור ל-{{email}}. לחצי על הקישור במייל כדי להפעיל את החשבון.",
  "auth.signup.confirmCta":     "חזרה להתחברות",
  "auth.login.forgot":          "שכחת סיסמה?",

  // ── Forgot password (/forgot-password) ─────────────────────
  "auth.forgot.heading":        "איפוס סיסמה",
  "auth.forgot.subheading":     "נשלח אלייך קישור איפוס למייל",
  "auth.forgot.submit":         "שלחי קישור איפוס",
  "auth.forgot.submitBusy":     "שולחת...",
  "auth.forgot.sentTitle":      "נשלח! ✨",
  "auth.forgot.sentBody":       "שלחנו קישור איפוס ל-{{email}}. בדקי את התיבה ולחצי על הקישור.",
  "auth.forgot.backToLogin":    "חזרה להתחברות",

  // ── Credits / pricing page (/credits) ─────────────────────
  "credits.eyebrow":         "חבילות מאסטרים",
  "credits.title":           "בחרי את הקצב שלך",
  "credits.subtitle":        "חיוב חד-פעמי · תקף ללא הגבלת זמן · אין מנוי חודשי",
  "credits.calcEyebrow":     "שקיפות תמחור",
  "credits.calcTitle":       "כמה שווה סרטון?",
  "credits.calcSubtitle":    "המחיר יורד מהיתרה רק בלחיצה על \"ייצוא\"",
  "credits.balanceLabel":    "היתרה שלך",
  "credits.calcCalcLabel":   "איתם תוכלו לעשות:",
  // ── Mode-by-mode pricing card (4-up grid below packages) ──
  "credits.modes.subtitles_only.name": "כתוביות בלבד",
  "credits.modes.subtitles_only.desc": "תמלול + אנימציות + תבניות",
  "credits.modes.podcast.name":        "פודקאסט",
  "credits.modes.podcast.desc":        "+ חיתוך שתיקות + אמוג'ים",
  "credits.modes.advanced.name":       "אפקטים מתקדמים",
  "credits.modes.advanced.desc":       "הכל — אנימציות + Lottie + SFX",
  "credits.modes.multi.name":          "חיבור סרטונים",
  "credits.modes.multi.desc":          "כמה סרטונים + תסריט → סרטון אחד",
  // ── Calculator strip labels ──
  "credits.calc.subtitles": "סרטוני כתוביות",
  "credits.calc.effects":   "עם אפקטים",
  "credits.calc.advanced":  "מתקדמים",
  // ── Trust row (3 bottom cards) ──
  "credits.trust.refund.title":  "החזר 14 ימים",
  "credits.trust.refund.body":   "אם לא נוצל",
  "credits.trust.norenew.title": "ללא חידוש אוטומטי",
  "credits.trust.norenew.body":  "קונה רק כשרוצה",
  "credits.trust.forever.title": "תקף לתמיד",
  "credits.trust.forever.body":  "לא פג לעולם",
  "credits.backToApp":           "חזרה לאפליקציה",

  // ── Account self-service (/account) ───────────────────────
  "account.heading":              "החשבון שלי",
  "account.subheading":           "ניהול סיסמה, הורדת נתונים ומחיקת חשבון",
  "account.password.title":       "שינוי סיסמה",
  "account.password.hint":        "סיסמה חדשה, לפחות 8 תווים",
  "account.password.placeholder": "סיסמה חדשה",
  "account.password.submit":      "עדכני סיסמה",
  "account.password.submitBusy":  "מעדכנת...",
  "account.password.ok":          "✓ הסיסמה עודכנה בהצלחה",
  "account.export.title":         "הורדת הנתונים שלי",
  "account.export.hint":          "קובץ JSON עם הפרופיל וההגדרות שלך — שלך לשמור או להעביר",
  "account.export.button":        "הורידי קובץ",
  "account.danger.title":         "מחיקת חשבון",
  "account.danger.hint":          "מוחק את החשבון, היתרה והפרופיל — לצמיתות. אין דרך חזרה.",
  "account.danger.button":        "מחק את החשבון שלי",
  "account.danger.busy":          "מוחקת...",
  "account.danger.confirm":       "את בטוחה? הפעולה הזו תמחק את החשבון, היתרה והפרופיל לצמיתות. אין דרך חזרה.",
  "account.guestNotice":          "צריך להתחבר כדי לגשת לאזור האישי.",
  "account.goToLogin":            "להתחברות",

  // ── Error pages (404 / 500) ──────────────────────────────
  "error.404.heading": "הדף הזה לא נמצא",
  "error.404.body":    "ייתכן שהקישור שגוי או שהדף עבר. נחזיר אותך הביתה?",
  "error.404.homeCta": "לדף הבית",
  "error.404.helpCta": "מרכז העזרה",
  "error.500.heading": "משהו השתבש",
  "error.500.body":    "אנחנו כבר מטפלים בזה. אפשר לנסות שוב או לחזור הביתה.",
  "error.500.retry":   "נסי שוב",
  "error.500.homeCta": "לדף הבית",

  // ── Email templates (sent from /admin/emails — Liat edits the text) ──
  "emails.welcome.subject":      "ברוכה הבאה ל-Master Video!",
  "emails.welcome.body":         "היי {{name}},\n\nתודה שהצטרפת ל-Master Video. קיבלת 25 מאסטרים במתנה כדי להתחיל — מספיק ל-2-3 סרטונים שלמים.\n\nכל הכלים מוכנים בשבילך בדף הבית:\nhttps://master-video.co.il\n\nבהצלחה!\nליאת",
  "emails.purchase.subject":     "תודה על הרכישה — Master Video",
  "emails.purchase.body":        "היי {{name}},\n\nקיבלנו את התשלום שלך על חבילת {{package}} ({{credits}} מאסטרים).\nהמאסטרים כבר זמינים בחשבון שלך.\n\nחשבונית מס נשלחה בנפרד.\n\nתודה!\nMaster Video",
  "emails.reset.subject":        "איפוס סיסמה — Master Video",
  "emails.reset.body":           "היי,\n\nלחצי על הקישור הבא לאיפוס הסיסמה (תקף לשעה):\n{{link}}\n\nאם לא ביקשת איפוס — אפשר להתעלם מהמייל הזה.\n\nMaster Video",
  "emails.newsletter.subject":   "מה חדש ב-Master Video",
  "emails.newsletter.body":      "היי {{name}},\n\nכמה דברים חדשים שגלגלנו לאתר:\n\n• …\n• …\n• …\n\nרוצה לראות? https://master-video.co.il\n\nלא רוצה לקבל עדכונים? יש קישור הסר בתחתית.\n\nMaster Video",
  "emails.signature":            "המייל הזה נשלח אליך כי נרשמת ל-Master Video. אם אינך מעוניין/ת לקבל עדכונים שיווקיים — {{unsubscribe}}.",

  // ── Footer / sitemap link names (per-link CMS) ────────────
  "footer.link.home":     "דף הבית",
  "footer.link.multi":    "חיבור סרטונים",
  "footer.link.credits":  "חבילות מאסטרים",
  "footer.link.help":     "שאלות נפוצות",
  "footer.link.glossary": "מילון מאסטר וידאו",
  "footer.link.contact":  "יצירת קשר",
  "footer.link.policy":   "תקנון ופרטיות",
  "footer.link.a11y":     "הצהרת נגישות",
  "footer.col.contact":   "צור קשר",
  "footer.col.sitemap":   "מפת אתר",

  // ── /help page ────────────────────────────────────────────
  "help.heading":          "איך אפשר לעזור?",
  "help.subheading":       "השאלות הנפוצות על {{appName}}",
  "help.searchPlaceholder":"חיפוש בשאלות הנפוצות...",
  "help.emptyResults":     "לא נמצאו תשובות. נסי מילים אחרות או צרי קשר במייל.",
  "help.contactCard.title":"לא מצאת תשובה?",
  "help.contactCard.body": "צרי קשר ואנחנו נחזור אלייך תוך 24 שעות",
  "help.contactCard.cta":  "צרי קשר",
  "help.backToApp":        "← חזרה לאפליקציה",
  "help.cat.general.label":  "כללי",
  "help.cat.credits.label":  "קרדיט ותשלום",
  "help.cat.export.label":   "ייצוא והורדה",
  "help.cat.problems.label": "בעיות נפוצות",
  "help.cat.advanced.label": "פיצ'רים מתקדמים",

  // ── Premium package card (carousel + premium card) ────────
  "pkgCard.btn":      "לקנייה",
  "pkgCard.btnBusy":  "מעבד...",
  "pkgCard.taxNote":  "כולל מע\"מ · תשלום חד-פעמי",

  // ── Intro-animation labels + descriptions (admin override) ────
  // Keyed by intro animation id (matches INTRO_ANIMATIONS in introAnimations.ts).
  // Admin enters { punchZoom: "המכה שלי", ... } to rename without code.
  "intro.labels": {} as Record<string, string>,
  "intro.descs":  {} as Record<string, string>,

  // ── Dashboard page (extended) ─────────────────────────────
  "dashboard.editBtn":            "עריכה",
  "dashboard.closeBtn":           "סגור",
  "dashboard.statsLineFull":      "עד עכשיו יצרתם {{videos}} סרטונים, חסכתם ~{{savedMin}} דקות של עריכה, וניצלתם {{used}} {{currency}}.",
  "dashboard.stat.videos":        "סרטונים",
  "dashboard.stat.monthsActive":  "חודשים פעילים",
  "dashboard.stat.memberSince":   "חבר/ה מ-",
  "dashboard.modeLabel.subtitles_only":   "כתוביות",
  "dashboard.modeLabel.basic_effects":    "אפקטים",
  "dashboard.modeLabel.podcast":          "פודקאסט",
  "dashboard.modeLabel.advanced_effects": "מתקדם",
  "dashboard.modeLabel.multi_video":      "מולטי",
  "dashboard.quickAction.title":  "סרטון חדש",
  "dashboard.quickAction.subtitle":"או נסה את",
  "dashboard.quickAction.multiLinkLabel":"מולטי-וידאו AI",
  "dashboard.myVideos.heading":   "הסרטונים שלי",
  "dashboard.myVideos.totalSuffix":"סך הכל",
  "dashboard.myVideos.empty":     "עדיין אין סרטונים",
  "dashboard.myVideos.emptyCta":  "צור את הראשון →",
  "dashboard.video.downloadTooltip":"הורדה",
  "dashboard.video.deleteTooltip":  "מחיקה",
  "dashboard.confirm.deleteVideo.title": "למחוק את הסרטון?",
  "dashboard.confirm.deleteVideo.body":  "\"{{title}}\" יימחק לצמיתות.",
  "dashboard.confirm.deleteVideo.btn":   "מחק",
  "dashboard.toast.videoDeleted":        "הסרטון נמחק",
  "dashboard.confirm.deleteSnapshot.title":"למחוק את הגרסה השמורה?",
  "dashboard.confirm.deleteSnapshot.body": "הפעולה לא ניתנת לשחזור.",
  "dashboard.confirm.deleteSnapshot.btn":  "מחק",
  "dashboard.toast.snapshotDeleted":  "הגרסה נמחקה",
  "dashboard.snapshots.countHint":     "{{n}} גרסאות זמינות לשחזור",
  "dashboard.snapshots.resumeBtn":     "המשך עריכה",
  "dashboard.snapshots.empty.hasVideo":"יש סרטון שמור. תתחילי לערוך — גרסאות יישמרו אוטומטית כל 5 דקות.",
  "dashboard.snapshots.empty.noVideo": "לאחר עריכת סרטון, גרסאות אוטומטיות יישמרו כאן.",
  "dashboard.snapshots.countSuffix":   "כתוביות",
  "dashboard.snapshots.restoreBtn":    "שחזר",
  "dashboard.snapshots.deleteTooltip": "מחק גרסה",
  "dashboard.invoices.countHint":      "{{n}} עסקאות",
  "dashboard.invoices.downloadTooltip":"הורד PDF",
  "dashboard.danger.title":   "מחיקת זיכרון סרטונים",
  "dashboard.danger.body":    "מוחק את הסרטון השמור, כל הגרסאות (snapshots), מטמון התמלולים והעריכה האוטומטית. ה-CMS של האדמין ויתרת המאסטרים <b>לא</b> מושפעים. שימושי לבדיקת המערכת מאפס.",
  "dashboard.danger.confirm.title":  "למחוק את כל הסרטונים והגיבויים?",
  "dashboard.danger.confirm.body":   "הסרטון השמור, snapshots, מטמון התמלול וכל מצב העריכה — ימחקו לצמיתות. ה-CMS ויתרת המאסטרים נשארים.",
  "dashboard.danger.confirm.btn":    "מחק הכל",
  "dashboard.toast.wipeAll":  "נתוני הסרטונים נמחקו — אפשר להתחיל מחדש 🎬",
  "dashboard.danger.btn":     "מחק הכל",
  "dashboard.demoReset.confirm.title":"לאפס את כל נתוני הדמו?",
  "dashboard.demoReset.confirm.body": "הסרטונים והפרופיל יחזרו לברירת המחדל.",
  "dashboard.demoReset.confirm.btn":  "אפס",
  "dashboard.toast.demoReset": "נתוני הדמו אופסו",
  "dashboard.demoReset.btn":  "איפוס נתוני דמו",
  "dashboard.profile.namePlaceholder":  "שם",
  "dashboard.profile.emailPlaceholder": "אימייל",
  "dashboard.profile.saveBtn":   "שמירה",
  "dashboard.profile.cancelBtn": "ביטול",
  "dashboard.profile.labelName":      "שם",
  "dashboard.profile.labelEmail":     "אימייל",
  "dashboard.profile.labelMemberSince":"חבר/ה מ-",
  "dashboard.profile.editBtn":   "ערוך פרטים",
  "dashboard.toast.profileUpdated":"הפרופיל עודכן",

  // ── /multi runtime copy (toasts, status, loaders, picker) ────
  "multi.error.minFiles":          "צריך לפחות 2 סרטונים",
  "multi.error.scriptRequired":    "הדביקי תסריט",
  "multi.error.generic":           "שגיאה",
  "multi.loader.merging.title":    "מאחד את הסרטונים",
  "multi.loader.merging.subtitle": "מחבר את כל הקטעים לסרטון אחד...",
  "multi.loader.merging.hint":     "מחבר את הסרטונים אחד אחרי השני לפי הסדר. עוד כמה שניות וזה מוכן.",
  "multi.status.done":             "מוכן — {{n}} קטעים אוחדו · {{sec}} שניות",
  "multi.status.updated":          "עודכן · {{sec}} שניות",
  "multi.status.addingTransitions":  "מוסיף מעברים יפים בין הקטעים...",
  "multi.status.removingTransitions":"חוזר לחיתוך רגיל...",
  "multi.status.reassigning":        "מעדכן את השיוך וחותך מחדש...",
  "multi.toast.insufficient":   "אין מספיק {{currency}} (צריך {{cost}}). אפשר לרכוש עוד.",
  "multi.toast.insufficientShort":"אין מספיק {{currency}}",
  "multi.toast.downloaded":     "הסרטון ירד! נוכו {{cost}} {{currency}} 🎬",
  "multi.toast.downloadError":  "שגיאה בהורדה",
  "multi.toast.transferError":  "שגיאה בהעברה",
  "multi.loader.preparingDownload.title":   "מכין את הסרטון להורדה",
  "multi.loader.preparingDownload.subtitle":"מעבד את הקובץ הסופי...",
  "multi.loader.transferring.title":    "מעביר את הסרטון לעריכה",
  "multi.loader.transferring.subtitle": "עוד רגע ותהיו בעורך הכתוביות...",
  "multi.tooltip.home":     "לדף הבית",
  "multi.backHome":         "לדף הבית",
  "multi.sources.label":    "סרטוני מקור",
  "multi.script.placeholder":"היי, היום אני אספר לכם על השבוע הזה.\nהתחלנו בבוקר במשרד.\nאחר כך נסענו לפגישה חשובה.\nלסיום, הופתעתי לטובה מהתוצאות.",
  "multi.script.emptyHint": "כל שורה שתכתבו תהפוך לקטע בסרטון 🎬",
  "multi.script.splitPrefix":"הטקסט יתחלק ל-",
  "multi.script.splitSuffix":"קטעים",
  "multi.script.perVideoTpl":"קטע לכל אחד מ-{{n}} הסרטונים",
  "multi.btn.busy":         "מעבד...",
  "multi.preview.empty":    "הסרטון המאוחד יופיע כאן אחרי עיבוד",
  "multi.transitions.title":  "מעברים אוטומטיים בין הקטעים",
  "multi.transitions.onDesc": "מעברים יפים (crossfade) בין כל סרטון",
  "multi.transitions.offDesc":"חיתוך רגיל — בלי מעבר",
  "multi.transitions.toggleTitle":"הפעלה/כיבוי מעברים",
  "multi.transitions.busy.on":  "מוסיף מעברים...",
  "multi.transitions.busy.off": "מסיר מעברים...",
  "multi.btn.download":         "הורדת הסרטון",
  "multi.btn.transferToEditor": "תנו ל-AI לתמלל ולערוך",
  "multi.assign.heading":       "שיוך פלחים → סרטוני מקור",
  "multi.assign.help":          "לחצי על תמונה כדי לשנות איזה סרטון מופיע בכל שורה. הסרטון יתעדכן מיד.",
  "multi.assign.videoLabelTpl": "סרטון {{n}}",
  // ── Brand-logo overrides (used by glossary + auto-detect overlay) ─
  // nameOverrides: change the Hebrew name shown next to a brand
  //   { "amazon": "אמזון", "google": "גוגל" }
  // hidden: brand IDs to skip in detection AND glossary
  // custom: extra brands the admin adds. Each entry needs:
  //   { id, name, slug, color, patterns: [<Hebrew alias>, <English alias>] }
  //   patterns are simple words (admin doesn't write regex); we wrap them.
  "brands.nameOverrides": {} as Record<string, string>,
  "brands.hidden": [] as string[],
  "brands.custom": [] as Array<{ id: string; name: string; slug: string; color: string; patterns: string[] }>,

  "help.faqs": [
    { cat: "general",  q: "מה האפליקציה הזו עושה?",
      a: "מעלים סרטון, ה-AI מתמלל לכתוביות בעברית מקצועית, ומאפשר לעצב, להוסיף אפקטים (זום, חיתוך שתיקה, אנימציות, סאונד), ולייצא MP4 מוכן לעלייה לרילס/טיקטוק/יוטיוב." },
    { cat: "general",  q: "האם זה באמת חינמי?",
      a: "כן — הגרסה הבסיסית. כתוביות בלבד = 10 קרדיט, אפקטים = 20, אפקטים מתקדמים = 40. כל משתמש חדש מקבל 25 קרדיט מתנה (כ-2-3 סרטונים לטעימה)." },
    { cat: "general",  q: "באיזו שפה התמלול?",
      a: "המודל הראשי הוא 'עברית מקצועי' — מאומן ספציפית לעברית, ההכי מדויק. יש גם 'כללי מדויק' שתומך בכל השפות." },
    { cat: "general",  q: "מה ההבדל בין המצבים?",
      a: "כתוביות בלבד = תמלול + עיצוב, בלי שינוי בוידאו. אפקטים בסיסיים = + זום ועריכה. פודקאסט = חיתוך שתיקות + כתוביות גדולות. מתקדמים = הכל + אנימציות + סאונד." },
    { cat: "credits", q: "מה זה מאסטרים?",
      a: "מאסטרים זה המטבע הפנימי שלנו 🪙 — את קונה חבילה (לדוגמה 50 מאסטרים ב-₪25) ומשתמשת בהם לעריכת סרטונים. ככה את משלמת רק עבור מה שאת באמת משתמשת, בלי מנוי חודשי שגובה כסף גם כשאת לא עורכת." },
    { cat: "credits", q: "כמה עולה סרטון?",
      a: "תלוי במצב: כתוביות בלבד = 10 מאסטרים (קבוע), פודקאסט = 20 (קבוע), חיבור סרטונים = 20 (קבוע). אפקטים מתקדמים הם דינמיים — מתחיל ב-25 וכל אפקט שתפעילי מוסיף 2-3 מאסטרים, עד תקרה של 40. ככה את משלמת רק עבור מה שבאמת משתמשת. ניתן לראות את העלות העדכנית על כפתור הייצוא בזמן אמת." },
    { cat: "credits", q: "האם הקרדיט פג?",
      a: "לא — הקרדיט תקף לתמיד. אין חידוש אוטומטי. את משלמת רק כשרוצה לקנות עוד." },
    { cat: "credits", q: "איך משלמים?",
      a: "כרטיס אשראי דרך מערכת סליקה ישראלית מאובטחת (PayPlus). חשבונית מס נשלחת אוטומטית למייל." },
    { cat: "credits", q: "אפשר לקבל החזר?",
      a: "כן — בתוך 14 ימים אם הקרדיט לא נוצל. צרי קשר במייל ונחזיר את התשלום." },
    { cat: "export",  q: "באיזה פורמט הסרטון יורד?",
      a: "MP4 ברזולוציה המקורית של הסרטון שהעלית, או SRT (כתוביות בלבד לפרמייר/דיוינצ'י). ניתן לבחור בלשונית 'ייצוא'." },
    { cat: "export",  q: "כמה זמן לוקח לייצא?",
      a: "סרטון של דקה = בערך 2-3 דקות עיבוד. סרטון של 3 דקות = 7-10 דקות. אפקטים מתקדמים יוסיפו עוד 30%." },
    { cat: "export",  q: "הסרטון יוצא חתוך / לא במיקום הנכון",
      a: "ודאי שהאספקט (יחס תצוגה) נכון — בדרך כלל 'מקורי' עובד הכי טוב. אם בחרת 9:16 אבל הסרטון מקורי 16:9, הוא יחתוך אוטומטית למרכז." },
    { cat: "export",  q: "האם הכתוביות נשמרות?",
      a: "כן — האפליקציה שומרת אוטומטית את כל ההגדרות שלך (כתוביות, סגנון, אפקטים) ב-localStorage. ברענון את ממשיכה מאיפה שהפסקת. רק את הוידאו עצמו צריך להעלות שוב." },
    { cat: "problems", q: "התמלול שגוי / חסר מילים",
      a: "וודאי שבחרת את מודל 'עברית מקצועי'. אם הוידאו רועש או הדובר רחוק מהמיקרופון, אפשר לערוך את הכתוביות ידנית בלשונית 'עורך כתוביות'." },
    { cat: "problems", q: "הייצוא תקוע / לא מסתיים",
      a: "ייצוא ארוך (3+ דקות) במחשבים עם זיכרון נמוך עלול להיתקע. סגרי טאבים אחרים ונסי שוב. אם זה חוזר — נסי מצב 'כתוביות בלבד' שצורך פחות זיכרון." },
    { cat: "problems", q: "האמוג'ים לא במקום הנכון",
      a: "בעורך הכתוביות לכל כתובית — לחיצה על האמוג'י משנה את המיקום (5 אפשרויות: 4 פינות + מעל). השינוי משתקף מיידית בלייב וביצוא." },
    { cat: "problems", q: "ה-SFX לא נשמע בייצוא",
      a: "ודאי ש'אפקטי SFX' מופעלים בלשונית האפקטים. הצליל מתנגן רק כשיש אלמנט (אמוג'י/אנימציה/לוגו) עם המילה המתאימה." },
    { cat: "advanced", q: "איך משתמשים במולטי-וידאו AI Editor?",
      a: "בדף הראשי, לחיצה על הכרטיס '✨ מולטי-וידאו' למעלה. מעלים 2-8 סרטונים, מדביקים תסריט (שורה לכל פלח), וה-AI יחתוך ויאחד אוטומטית לפי דמיון טקסטואלי." },
    { cat: "advanced", q: "איך מוסיפים אנימציה (Lottie) לכתובית?",
      a: "בעורך הכתוביות, לחיצה על כפתור ✨ ליד כל משפט. בדיאלוג שנפתח: לשונית 'אנימציה' — בוחרים מתוך 23 אנימציות וקטוריות, משך, מיקום, וצבע." },
    { cat: "advanced", q: "אפשר להוסיף צליל לאמוג'י?",
      a: "כן! בעורך הכתוביות, ליד כל אמוג'י או אנימציה שמוסיפים יש אייקון רמקול 🔊. לחיצה פותחת בוחר עם 65 צלילי SFX (קליקים, וושש, מטבעות, ויראלי...) ניתן לבחור צליל או 'ללא צליל'." },
    { cat: "advanced", q: "מה ההבדל בין 'כתוביות מוכנות' ל'סגנון כתוביות'?",
      a: "'כתוביות מוכנות' (בראש פאנל העיצוב) = שילובים שלמים — Hormozi / Instagram מודרני / TikTok וכו'. לחיצה אחת = הכל נטען. 'סגנון כתוביות' (מתחת) = גרסה ידנית עדינה עם 10+ אופציות בסיסיות." },
  ],

  // ── Shared nav / header labels (used by SiteHeader + home Header) ─
  "nav.home":             "בית",
  "nav.credits":          "חבילות",
  "nav.help":             "עזרה",
  "nav.contact":          "צור קשר",
  "nav.profile":          "פרופיל ודאשבורד",
  "nav.myVideos":         "הסרטונים שלי",
  "nav.buyCredits":       "קניית מאסטרים",
  "nav.login":            "התחברי",
  "nav.signup":           "הרשמי",
  "nav.logout":           "התנתקי",
  "nav.mobile.buy":       "חבילות וקניה",
  "header.tooltip.home":   "לדף הבית",
  "header.tooltip.balance":"היתרה שלך — לחצי לקניית חבילה",
  "header.tooltip.menu":   "התפריט שלך",
  "header.notifications.title": "התראות",
  "header.notifications.markAllRead": "סמן הכל כנקרא",
  "header.notifications.empty": "אין התראות חדשות",
  "header.mobileMenuLabel":"תפריט",
  "header.defaultUserName":"משתמש",
  "header.defaultInitial": "מ",

  // ── Accessibility statement page ──────────────────────────
  "a11y.title":       "הצהרת נגישות",
  "a11y.intro":       "אנו במאסטר וידאו מאמינים שכל אדם זכאי לגלוש באתר ולהשתמש בו ללא תלות במגבלה כזו או אחרת. השקעת מאמץ נמשך בנגישות היא חלק מהמחויבות שלנו לקהילה הישראלית.",
  "a11y.panel.title": "הפאנל שלנו",
  "a11y.panel.body":  "כפתור הנגישות (♿) נמצא בפינה השמאלית-תחתונה של כל עמוד באתר. לחיצה עליו פותחת פאנל עם הגדרות: גודל טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן ידידותי לדיסלקציה, סמן גדול, והפחתת אנימציות. ההגדרות נשמרות אצלך ונשארות בין ביקורים.",
  "a11y.standard.title": "תקן ורמת תאימות",
  "a11y.standard.body":  "האתר נבנה לפי הנחיות WCAG 2.1 רמה AA, בכפוף לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע\"ג-2013. אנו עורכים בדיקות באופן שוטף ומשפרים נושאים שמתגלים.",
  "a11y.limits.title":   "מגבלות ידועות",
  "a11y.limits.body":    "תכני וידאו שמשתמשי הקצה מעלים אינם תחת שליטתנו ולכן ייתכן שאינם נגישים מלאה. כתוביות אוטומטיות מסופקות לכל סרטון שמועלה למערכת.",
  "a11y.contact.title":  "תקלות ופניות",
  "a11y.contact.body":   "אם נתקלת בקושי בנגישות באתר, נשמח לקבל פנייה ונטפל בה בהקדם:",
  "a11y.contact.responsible": "רכז/ת נגישות:",
  "a11y.updated":        "עודכן לאחרונה: יוני 2026",
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

  // ── Home page visible strings (audit pass 1) ──────────────
  "home.multi.title":       "חיבור סרטונים AI",
  "home.multi.badge":       "✨ חדש",
  "home.multi.desc":        "להעלות כמה סרטונים + תסריט. ה-AI מחבר אותם לסרטון אחד לפי הסדר שכתבתם.",
  "home.replace":           "החלף",
  "home.cta.transcribe":    "תני ל-AI לתמלל ולערוך",
  "home.cta.processing":    "AI מתמלל...",
  "home.retranscribe":      "למחוק את התמלול השמור ולהריץ AI מחדש על הסרטון?\n\n💡 שים לב: ירדו לך קרדיטים שוב כי זה ייחשב כתמלול חדש.",
  "home.progress.upload":   "מעלה את הסרטון לשרת...",
  "home.progress.transcribe":"AI מתמלל את הסרטון...",
  "home.progress.analyze":  "AI מנתח את הסרטון (מזהה דובר, מציע סגנון)...",
  "home.progress.export":   "צורבת כתוביות לוידאו (זה יכול לקחת דקה או שתיים)...",
  "home.progress.loadVideo":"מעלה את הסרטון שלך — רגע אחד...",
  "home.toast.multiReady":  "הסרטון המחובר מוכן — תנו ל-AI לתמלל ולערוך ✨",
  "home.toast.resumeHint":  "המשך מאיפה שהפסקת — העלי את הסרטון לעריכה",
  "home.toast.videoLoaded": "הסרטון נטען — תוכלי להתחיל לתמלל",
  "home.error.noSpeech":    "לא זוהה דיבור בסרטון",
  "home.error.noVideo":     "חסר קובץ וידאו",
  // Hero greeting (below header, above the upload card)
  "home.hero.greeting":     "👋 היי {{name}}, מה תרצה שנערוך לך היום?",
  "home.hero.greetingGuest":"👋 היי מאסטר, מה תרצה שנערוך לך היום?",

  // Signup gate — popup shown when a guest clicks "Export"
  "signupGate.title":         "רגע לפני שמורידים…",
  "signupGate.subtitle":      "צריך חשבון בשביל להוריד את הסרטון. הרשמה לוקחת 30 שניות.",
  "signupGate.giftBadge":     "🎁 25 מאסטרים במתנה",
  "signupGate.submitNew":     "צרי חשבון והורידי",
  "signupGate.submitIn":      "התחברי והורידי",
  "signupGate.switchToLogin": "יש לך כבר חשבון? התחברי",
  "signupGate.switchToSignup":"אין לך עוד חשבון? הירשמי",

  // Post-purchase success page (/credits/success)
  "purchase.title":     "התשלום עבר בהצלחה! ✨",
  "purchase.body":      "נוספו {{credits}} מאסטרים לחשבון שלך. אפשר להתחיל לערוך מיד.",
  "purchase.bodyNoQty": "התשלום נקלט והמאסטרים נוספו לחשבון שלך.",
  "purchase.cta.start": "התחילי לערוך",
  "purchase.cta.more":  "קני עוד חבילה",
  "purchase.error.title": "התשלום לא הושלם",
  "purchase.error.body":  "משהו השתבש בתהליך התשלום. לא חויבת. אפשר לנסות שוב.",
  "purchase.error.retry": "חזרה לחבילות",

  // Upload drop-zone copy (home page)
  "uploader.dropTitle":    "בחר את הסרטון שאותו תרצה שה-AI יערוך לך",
  "uploader.dragingTitle": "שחרר כאן",
  "uploader.checkingTitle":"בודק...",
  "uploader.formatsLine":  "תומך ב-MP4, MOV, AVI, MKV",
  "uploader.durationNote": "תמיכה בסרטונים עד 60 שניות (בינתיים 😉)",

  // Feature flags — toggle to hide pre-launch features without removing code.
  // multi.enabled = false → hides every visible reference to "חיבור סרטונים AI"
  // (home page card, footer link, /credits multi mode). The /multi page itself
  // stays accessible by direct URL so existing bookmarks don't 404.
  "feature.multi.enabled": false,

  // Glossary / dictionary page (/glossary)
  "glossary.intro":
    "המדריך השקוף של מאסטר וידאו — בדיוק מה ה-AI יודע לזהות אוטומטית בסרטון שלך. " +
    "כל הוספה באדמין מופיעה פה מיד.",
  "glossary.brands.title":   "🏷️ לוגואי מותגים שה-AI מזהה",
  "glossary.brands.body":
    "כשאת/ה מזכיר/ה מותג בכתוביות, ה-AI ממקם את הלוגו אוטומטית בפינת המסך — " +
    "בלי שתצטרכי להעלות אותו ידנית.",
  "glossary.drama.title":    "🎬 מילות דרמה (שחור-לבן + סטינג)",
  "glossary.drama.body":
    "ברגע שאחת מהמילים הבאות מופיעה — המסך הופך לשחור-לבן ל-1.2 שניות ונוסף " +
    "צליל סטינג דרמטי. אפשר להוסיף מילים משלך באדמין → תוכן.",
  "glossary.elements.title": "✨ מילים שמזמינות אנימציה",
  "glossary.elements.body":
    "ה-AI מזהה רעיון (כסף, אהבה, מסיבה…) ומוסיף אנימציה Lottie + צליל אפקט. " +
    "כל קטגוריה תומכת בעשרות מילים בעברית ובאנגלית.",
  "glossary.backToApp":      "חזרה לאפליקציה",
};

export type ContentKey = keyof typeof CONTENT_DEFAULTS;

function read(): Content {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ── Cloud sync (Supabase content_overrides table) ─────────────────────
// We keep localStorage as a synchronous read-through cache so first paint
// uses last-known values (no flash of defaults). On mount, hydrateFromCloud
// merges the server-side overrides on top and dispatches `content-change`
// so every useContent() subscriber re-renders.
let cloudHydrated = false;
let cloudHydratePromise: Promise<void> | null = null;

export function hydrateFromCloud(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (cloudHydratePromise) return cloudHydratePromise;
  cloudHydratePromise = (async () => {
    try {
      const res = await fetch("/api/cms/overrides", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const cloud = (json?.overrides ?? {}) as Content;
      if (!cloud || typeof cloud !== "object") return;
      const local = read();
      // MERGE — not replace. Cloud wins for keys both have (it's the latest
      // server source of truth). Local-only keys (e.g. SFX names Liat saved
      // before we added cloud sync) survive — and we also push them up to
      // the cloud so the next visitor sees them too.
      const merged: Content = { ...local, ...cloud };
      // Snapshot the pre-merge state into history so any unwanted overwrite
      // can be rolled back from admin → CMS → "🛟 גיבוי ושחזור".
      pushHistory();
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      cloudHydrated = true;
      window.dispatchEvent(new CustomEvent("content-change"));
      // Backfill: any local key that isn't yet in cloud → POST it now.
      // Only the admin's token will be accepted; for guests this no-ops.
      for (const [k, v] of Object.entries(local)) {
        if (!(k in cloud)) void postToCloud(k, v);
      }
    } catch { /* offline / unconfigured — fall back to localStorage */ }
  })();
  return cloudHydratePromise;
}

async function postToCloud(key: string, value: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // Lazy-import to avoid a server-side bundle of the Supabase auth client
    // pulling in browser-only code.
    const { browserClient } = await import("./supabase");
    const sb = browserClient();
    const token = (await sb?.auth.getSession())?.data.session?.access_token;
    if (!token) return; // not logged in as admin — local-only edit
    await fetch("/api/cms/overrides", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, value }),
    });
  } catch { /* best effort */ }
}

async function deleteFromCloud(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { browserClient } = await import("./supabase");
    const sb = browserClient();
    const token = (await sb?.auth.getSession())?.data.session?.access_token;
    if (!token) return;
    await fetch(`/api/cms/overrides?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch { /* best effort */ }
}

export function isCloudHydrated(): boolean {
  return cloudHydrated;
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
    // Push the restored state to the cloud so every visitor sees the rollback —
    // not just this browser. Without this, hydrateFromCloud would later
    // re-overwrite localStorage with the still-stale cloud values.
    try {
      const parsed = JSON.parse(entry.data) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        void postToCloud(k, v);
      }
    } catch { /* malformed entry — fall through */ }
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
    // Also push every imported key to the cloud so the next page-load (which
    // hydrates from the server) doesn't blow the import away with the old
    // server values.
    for (const [k, v] of Object.entries(parsed)) {
      void postToCloud(k, v);
    }
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
  // Fire-and-forget cloud upsert so every visitor on every device sees this edit.
  void postToCloud(key, value);
}

/** Reset a single key to its shipped default */
export function resetContentKey<K extends ContentKey>(key: K) {
  const c = read();
  delete c[key];
  write(c);
  void deleteFromCloud(key);
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
