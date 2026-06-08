# 🚀 מדריך פריסה ל-Lovable — צעד-אחרי-צעד

מדריך זה מעלה את הקוד מהמחשב שלך → GitHub → Lovable → URL חי.
זמן משוער: **15 דקות**.

⚠️ **מה יעבוד בלייב ומה לא:**
- ✅ כל ה-UI: דאשבורד, אדמין, /help, /credits, /multi (העלאה+הצגה), עיצוב, אנימציות, CMS
- ❌ ייצוא וידאו אמיתי (FFmpeg) — דורש Modal.com בשלב 2

---

## שלב 1: GitHub (פעם אחת)

### 1.1 — חשבון GitHub
- אם אין: [github.com/signup](https://github.com/signup) — חינם, 30 שניות
- אם יש: התחברי ב-[github.com/login](https://github.com/login)

### 1.2 — יצירת Repository ריק
1. לכי ל-[github.com/new](https://github.com/new)
2. שם הרפו: **`video-master`** (או כל שם — קל לזכור)
3. השאירי **Public** או **Private** (לא משנה ל-Lovable)
4. **אל** תסמני "Add README" / "Add .gitignore" / "License" — יש לנו כבר
5. לחיצה: **Create repository**

תקבלי דף עם URL: `https://github.com/YOUR-USERNAME/video-master.git`. שמרי אותו.

---

## שלב 2: דחיפת הקוד (פעם אחת)

### 2.1 — פותחים PowerShell בתיקיית הפרויקט
לחיצה ימנית בתיקייה `E:\קלוד עריכת וידאו\` → "Open in Terminal"

### 2.2 — מריצים את הפקודות הבאות (החלפי `YOUR-USERNAME`):

```powershell
git init
git add .
git commit -m "Initial commit: Video Master MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/video-master.git
git push -u origin main
```

הפעם הראשונה GitHub יבקש להתחבר:
- בחרי **"Sign in with browser"**
- מאשרי בדפדפן
- כל push בעתיד יזכור אותך

---

## שלב 3: חיבור ל-Lovable (פעם אחת)

### 3.1
1. לכי ל-[lovable.dev](https://lovable.dev) → התחברי
2. בחרי **"+ New Project"**
3. בחרי **"Import from GitHub"**
4. אם זו הפעם הראשונה — תאשרי גישת Lovable לחשבון ה-GitHub שלך
5. בחרי את הרפו: **`video-master`**

### 3.2 — הגדרות פריסה
Lovable יזהה אוטומטית שזה Next.js. תאשרי את ברירות המחדל:
- Build command: `npm run build`
- Output dir: `.next` (אוטומטי)
- Node version: `20` (אוטומטי)

### 3.3 — לחיצה: **Deploy**
תוך **2-5 דקות** תקבלי URL: `https://video-master-XXX.lovable.app`

---

## שלב 4: זרימת עבודה רגילה מהיום

מהיום, **כל שינוי שאני עושה אצלך בקוד = אוטומטי בלייב תוך 30 שניות**:

```powershell
# אחרי שמשנים קוד, פקודה אחת:
git add .
git commit -m "תיאור השינוי"
git push
```

Lovable יזהה את ה-push, יבנה אוטומטית, ויעדכן את ה-URL. את לא צריכה לעשות כלום.

> 💡 **טיפ**: אפשר להגדיר ב-VS Code את ה-Source Control panel — בלחיצת כפתור אחת `Commit & Push` בלי לזכור פקודות.

---

## ⚠️ דברים שצריך לדעת

### Environment Variables ב-Lovable
- כשתפתחי חשבון PayPlus → לוסיף את המפתחות ב-Lovable Settings → Environment Variables
- ראי [`.env.example`](./.env.example) לרשימה
- בלי המפתחות = האתר עובד במצב **dev stub** (קרדיט מתווסף מקומית, ייצוא לא יעבוד)

### Whisper + FFmpeg
- **לא יעבדו ב-Lovable** — צריך Modal.com בשלב 2
- בינתיים: תוכלי להראות את ה-UI, לעצב, לקבל פידבק, אבל לא לייצא וידאו אמיתי בלייב

### דומיין מותאם
- את מקבלת `*.lovable.app` חינם
- כשתקני דומיין (למשל `videomaster.co.il`):
  - הוסיפי אותו ב-Lovable → Settings → Custom Domain
  - תני לזה ~24 שעות לאישור DNS

### Lovable Credits
- ה-100 קרדיט/חודש שלך = רק לצ'אט עם ה-AI שלהם
- **דחיפות מ-GitHub לא שורפות קרדיט**
- מנצלת אותם רק כשמבקשת מה-AI של Lovable שינוי

---

## 🆘 בעיות נפוצות

**"git: command not found"**  
→ התקיני Git: [git-scm.com/download/win](https://git-scm.com/download/win)

**"Permission denied (publickey)"**  
→ זה SSH, אנחנו השתמשנו ב-HTTPS. ודאי שה-URL מתחיל ב-`https://` ולא `git@`

**ה-build נכשל ב-Lovable**  
→ בדקי ב-Lovable Build Logs. אם מופיע "Module not found" — חסר package, חזרי לפה ונפתור

**הדף נטען לבן**  
→ בדקי DevTools (F12) → Console. שלחי לי תמונה ואני אתקן

---

זהו. שלב 1 ושלב 2 — פעם אחת בלבד. שלב 3 — אחרי כל שינוי.
