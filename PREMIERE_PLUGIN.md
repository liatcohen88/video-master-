# Premiere Pro Plugin — Plan

מסלול מינימלי לבניית תוסף ל-Adobe Premiere שמייבא פלט מ-Video Master (SRT + MP4 מעובד).

---

## בחירת טכנולוגיה

| | CEP (ישן) | UXP (חדש) |
|---|---|---|
| שפת UI | HTML/CSS/JS | React + Spectrum UI |
| תמיכת Premiere | מ-2015 | מ-Premiere 2024 בלבד |
| ScriptUI / ExtendScript | כן | UXP API |
| הפצה | ZXP installer | Adobe Marketplace |
| **המלצה** | **לא** | **כן — Adobe מפסיק תמיכה ב-CEP** |

→ נבחר ב-**UXP**.

---

## מבנה תוסף

```
premiere-plugin/
  manifest.json             # רשום ל-UXP
  index.html                # מסך התוסף
  src/
    App.jsx                 # React UI
    importer.js             # קורא ל-Premiere API
  icons/
    icon-32.png
    icon-256.png
  README.md
```

### manifest.json (דוגמה)
```json
{
  "id": "com.videomaster.importer",
  "name": "Video Master Importer",
  "version": "0.1.0",
  "main": "index.html",
  "manifestVersion": 5,
  "host": [
    { "app": "premierepro", "minVersion": "24.0.0" }
  ],
  "entrypoints": [
    {
      "type": "panel",
      "id": "videomaster.panel",
      "label": { "default": "Video Master" },
      "minimumSize": { "width": 280, "height": 360 }
    }
  ]
}
```

---

## פלואו משתמש

1. ליאת מסיימת לערוך סרטון ב-Video Master, מוציאה **MP4** + **SRT**.
2. בפרמייר, פותחת `Window → Extensions → Video Master`.
3. בתוסף, לוחצת **"ייבוא פרויקט Video Master"** ובוחרת תיקייה.
4. התוסף:
   - מייבא את ה-MP4 ל-Project Bin
   - מייבא את ה-SRT כ-Captions track
   - מציב את שניהם בטיימליין בקליפ חדש
   - מסנכרן את ה-captions למיקום של הוידאו

---

## קוד מינימלי (UXP)

```js
import { app, premierepro } from "premierepro";

async function importVMProject(folderPath) {
  const mp4 = `${folderPath}/output.mp4`;
  const srt = `${folderPath}/output.srt`;

  const project = await premierepro.Project.getActiveProject();
  const importResult = await project.importFiles([mp4, srt], false, await project.getRootItem(), false);

  // מציב את ה-MP4 בטיימליין
  const seq = await project.getActiveSequence();
  const videoItem = importResult.find(i => i.name.endsWith(".mp4"));
  if (videoItem && seq) {
    await seq.createVideoClipFromProjectItem(videoItem, 0); // בזמן 0
  }
  return { imported: importResult.length };
}
```

---

## הפצה

1. **חתימה**: צרי tools/UXP Developer Tool של Adobe → "Sign Plugin" → תקבלי `.ccx`.
2. **פנימי**: שלחי .ccx ללקוחות שלך, הם מתקינים דרך Creative Cloud.
3. **חנות (אופציונלי)**: הגישי ל-Adobe Marketplace — לוקח ~2 שבועות לאישור, חינמי.

---

## מה עוד שווה לבנות אחרי MVP

- **Round-trip**: כפתור "שלח חזרה ל-Video Master" — מייצא את הסיקוונס הנוכחי, פותח אותו ב-Video Master לעדכון כתוביות, מקבל חזרה.
- **Direct render**: לעקוף MP4 — לקרוא ל-/api/render של Video Master עם הסיקוונס שכבר חתוך בפרמייר.
- **Live preview**: WebSocket בין התוסף ל-Video Master כדי לראות שינויי כתוביות בלייב.

---

## עלות פיתוח משוערת

- MVP (ייבוא MP4+SRT): ~3-5 ימים
- חתימה + הגשה ל-Marketplace: ~1 יום
- Round-trip מלא: +5-7 ימים

זמן ה-MVP מצדיק התחלה רק אחרי שיש לקוחות שביקשו במפורש את האינטגרציה. כיוון שבסוף סיום עריכה ב-Video Master, רוב המשתמשים פשוט מייצאים MP4 והופ — תוסף לפרמייר לא יוסיף ערך עד שהיקף עורכי הפרמייר בקרב הלקוחות יצדיק זאת.
