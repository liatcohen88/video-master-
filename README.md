# 🎬 סטודיו כתוביות / Video Master

אפליקציה לעריכת כתוביות עברית, אפקטים אוטומטיים, וייצוא סרטונים מוכנים לרילס/טיקטוק/יוטיוב.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Python (Whisper) + FFmpeg + @napi-rs/canvas

---

## 🚀 הפעלה מקומית

### תנאים מקדימים
- Node.js 20+
- Python 3.11+ (לתמלול Whisper)
- FFmpeg 7+ (לעיבוד וידאו)

### התקנה
```bash
npm install
pip install -r scripts/requirements.txt   # ivrit-ai/whisper + dependencies
```

### הרצה
```bash
npm run dev
```
פותחת על http://localhost:3001

---

## 📁 מבנה תיקיות

```
src/
  app/                    # Next.js App Router pages
    page.tsx              # דף ראשי — עורך כתוביות
    multi/                # מולטי-וידאו AI editor
    admin/                # פאנל ניהול + CMS
    dashboard/            # דף משתמש
    credits/              # קניית חבילות
    help/                 # שאלות נפוצות
    api/                  # API routes (transcribe, render, multi-edit)
  components/             # קומפוננטות React
  lib/                    # לוגיקה — types, contentStore, ffmpegFilter
public/
  sfx/                    # 65 קבצי SFX (~9MB)
  lottie/                 # 23 אנימציות וקטוריות (~600KB)
assets/fonts/             # פונטים עבריים (Heebo, Rubik, וכו')
scripts/
  transcribe.py           # Python Whisper runner
  render-lottie.cjs       # Lottie rasterizer
```

---

## ⚙️ Environment Variables

ראי `.env.example` לרשימה המלאה. עיקריים:

- `PAYPLUS_API_KEY` / `PAYPLUS_SECRET_KEY` / `PAYPLUS_PAGE_UID` — סליקה (אופציונלי, ללא = dev stub)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — DB+Auth (אופציונלי, ללא = localStorage)
- `FFMPEG_PATH` / `PYTHON_PATH` — נתיבים מקומיים, ברירת מחדל מה-PATH

---

## 🌐 פריסה ל-Production

### Lovable (UI בלבד) — מצב נוכחי
- Lovable מריצה את כל ה-frontend pages
- API routes שלא דורשים FFmpeg/Whisper יעבדו (admin, credits, content)
- **API routes שדורשים FFmpeg/Whisper לא יעבדו** — צריך Modal.com או Railway

### Modal.com (לעיבוד וידאו) — שלב הבא
- ל-`/api/render`, `/api/transcribe`, `/api/multi-edit`
- חינם 600 רינדורים/חודש
- ראי `LOVABLE_MIGRATION.md` להוראות מלאות

---

## 📚 מסמכים נוספים

- [`LOVABLE_MIGRATION.md`](./LOVABLE_MIGRATION.md) — מעבר ל-Supabase + Stripe + Modal
- [`PREMIERE_PLUGIN.md`](./PREMIERE_PLUGIN.md) — תוסף לפרמייר
- [`.env.example`](./.env.example) — env vars נדרשים

---

## 🎨 פיצ'רים עיקריים

- ✅ תמלול עברית מקצועי (Whisper ivrit-ai)
- ✅ 6 סגנונות כתוביות מוכנים + עורך מלא
- ✅ 23 אנימציות Lottie וקטוריות עם color picker
- ✅ 65 SFX אמיתיים (Mixkit), קטוגרזציה, שמות מותאמים
- ✅ אפקטים: זום אוטומטי, חיתוך שתיקות, צבע קולנועי, אנימציות כתוביות
- ✅ מולטי-וידאו AI editor — חיבור כמה סרטונים לפי תסריט
- ✅ פאנל ניהול CMS מלא — עריכת כל המלל, מיתוג, תמחור
- ✅ מערכת קרדיטים + 4 חבילות מוכנות
- ✅ Auto-save פרויקט
- ✅ Toasts, Onboarding, Help/FAQ
- ✅ סליקת PayPlus (ישראלי) — מוכן להפעלה

---

Built with ❤️ for Hebrew content creators.
