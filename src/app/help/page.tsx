"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, HelpCircle, Sparkles, Coins, Download, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { useContent } from "@/lib/useContent";

type FAQ = { q: string; a: string };
type Category = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; faqs: FAQ[] };

const CATEGORIES: Category[] = [
  {
    id: "general",
    label: "כללי",
    icon: Sparkles,
    faqs: [
      { q: "מה האפליקציה הזו עושה?",
        a: "מעלים סרטון, ה-AI מתמלל לכתוביות בעברית מקצועית, ומאפשר לעצב, להוסיף אפקטים (זום, חיתוך שתיקה, אנימציות, סאונד), ולייצא MP4 מוכן לעלייה לרילס/טיקטוק/יוטיוב." },
      { q: "האם זה באמת חינמי?",
        a: "כן — הגרסה הבסיסית. כתוביות בלבד = 10 קרדיט, אפקטים = 20, אפקטים מתקדמים = 40. כל משתמש חדש מקבל 25 קרדיט מתנה (כ-2-3 סרטונים לטעימה)." },
      { q: "באיזו שפה התמלול?",
        a: "המודל הראשי הוא 'עברית מקצועי' — מאומן ספציפית לעברית, ההכי מדויק. יש גם 'כללי מדויק' שתומך בכל השפות." },
      { q: "מה ההבדל בין המצבים?",
        a: "כתוביות בלבד = תמלול + עיצוב, בלי שינוי בוידאו. אפקטים בסיסיים = + זום ועריכה. פודקאסט = חיתוך שתיקות + כתוביות גדולות. מתקדמים = הכל + אנימציות + סאונד." },
    ],
  },
  {
    id: "credits",
    label: "קרדיט ותשלום",
    icon: Coins,
    faqs: [
      { q: "כמה עולה סרטון?",
        a: "תלוי במצב: כתוביות בלבד = 10 קרדיט, אפקטים בסיסיים = 20, פודקאסט = 20, אפקטים מתקדמים = 40, מולטי-וידאו = 30. ניתן לראות את העלות על כל כרטיס בבחירת המצב." },
      { q: "האם הקרדיט פג?",
        a: "לא — הקרדיט תקף לתמיד. אין חידוש אוטומטי. את משלמת רק כשרוצה לקנות עוד." },
      { q: "איך משלמים?",
        a: "כרטיס אשראי דרך מערכת סליקה ישראלית מאובטחת (PayPlus). חשבונית מס נשלחת אוטומטית למייל." },
      { q: "אפשר לקבל החזר?",
        a: "כן — בתוך 14 ימים אם הקרדיט לא נוצל. צרי קשר במייל ונחזיר את התשלום." },
    ],
  },
  {
    id: "export",
    label: "ייצוא והורדה",
    icon: Download,
    faqs: [
      { q: "באיזה פורמט הסרטון יורד?",
        a: "MP4 ברזולוציה המקורית של הסרטון שהעלית, או SRT (כתוביות בלבד לפרמייר/דיוינצ'י). ניתן לבחור בלשונית 'ייצוא'." },
      { q: "כמה זמן לוקח לייצא?",
        a: "סרטון של דקה = בערך 2-3 דקות עיבוד. סרטון של 3 דקות = 7-10 דקות. אפקטים מתקדמים יוסיפו עוד 30%." },
      { q: "הסרטון יוצא חתוך / לא במיקום הנכון",
        a: "ודאי שהאספקט (יחס תצוגה) נכון — בדרך כלל 'מקורי' עובד הכי טוב. אם בחרת 9:16 אבל הסרטון מקורי 16:9, הוא יחתוך אוטומטית למרכז." },
      { q: "האם הכתוביות נשמרות?",
        a: "כן — האפליקציה שומרת אוטומטית את כל ההגדרות שלך (כתוביות, סגנון, אפקטים) ב-localStorage. ברענון את ממשיכה מאיפה שהפסקת. רק את הוידאו עצמו צריך להעלות שוב." },
    ],
  },
  {
    id: "problems",
    label: "בעיות נפוצות",
    icon: AlertTriangle,
    faqs: [
      { q: "התמלול שגוי / חסר מילים",
        a: "וודאי שבחרת את מודל 'עברית מקצועי'. אם הוידאו רועש או הדובר רחוק מהמיקרופון, אפשר לערוך את הכתוביות ידנית בלשונית 'עורך כתוביות'." },
      { q: "הייצוא תקוע / לא מסתיים",
        a: "ייצוא ארוך (3+ דקות) במחשבים עם זיכרון נמוך עלול להיתקע. סגרי טאבים אחרים ונסי שוב. אם זה חוזר — נסי מצב 'כתוביות בלבד' שצורך פחות זיכרון." },
      { q: "האמוג'ים לא במקום הנכון",
        a: "בעורך הכתוביות לכל כתובית — לחיצה על האמוג'י משנה את המיקום (5 אפשרויות: 4 פינות + מעל). השינוי משתקף מיידית בלייב וביצוא." },
      { q: "ה-SFX לא נשמע בייצוא",
        a: "ודאי ש'אפקטי SFX' מופעלים בלשונית האפקטים. הצליל מתנגן רק כשיש אלמנט (אמוג'י/אנימציה/לוגו) עם המילה המתאימה." },
    ],
  },
  {
    id: "advanced",
    label: "פיצ'רים מתקדמים",
    icon: SettingsIcon,
    faqs: [
      { q: "איך משתמשים במולטי-וידאו AI Editor?",
        a: "בדף הראשי, לחיצה על הכרטיס '✨ מולטי-וידאו' למעלה. מעלים 2-8 סרטונים, מדביקים תסריט (שורה לכל פלח), וה-AI יחתוך ויאחד אוטומטית לפי דמיון טקסטואלי." },
      { q: "איך מוסיפים אנימציה (Lottie)?",
        a: "בעורך הכתוביות, לחיצה על כפתור ✨ ליד כל משפט. בדיאלוג שנפתח: לשונית 'אנימציה' — בוחרים מתוך 23 אנימציות וקטוריות, משך, מיקום, וצבע." },
      { q: "אפשר לערוך לוגו ומיתוג?",
        a: "ב-/admin → לשונית 'מיתוג'. שם משנים שם אפליקציה, סלוגן, צבעי מותג, ומעלים לוגו מותאם. השינויים נראים מיידית בכל האתר." },
      { q: "איך משנים את שמות ה-SFX?",
        a: "ב-/admin → לשונית 'SFX'. מאזינים לכל צליל דרך כפתור ▶ ונותנים לו שם שמתאר מה הוא. השם מופיע אחר כך בכל הפיקרים." },
    ],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const appName = useContent("brand.appName");

  // Filter FAQs by query (across question + answer)
  const filtered = CATEGORIES.map((cat) => ({
    ...cat,
    faqs: cat.faqs.filter((f) =>
      !query
      || f.q.toLowerCase().includes(query.toLowerCase())
      || f.a.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((cat) => cat.faqs.length > 0);

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-white relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-violet-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-3">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-2">איך אפשר לעזור?</h1>
          <p className="text-sm text-white/50">השאלות הנפוצות על {appName}</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בשאלות הנפוצות..."
            className="w-full bg-bg-card border border-white/10 focus:border-brand/50 rounded-xl pr-10 pl-4 py-3 text-sm placeholder-white/30 outline-none"
          />
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/40">
            לא נמצאו תשובות. נסי מילים אחרות או צרי קשר במייל.
          </div>
        )}

        {filtered.map((cat) => (
          <div key={cat.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3 text-sm text-white/60 font-bold uppercase tracking-wider">
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </div>
            <div className="space-y-2">
              {cat.faqs.map((f, i) => <FaqItem key={i} faq={f} />)}
            </div>
          </div>
        ))}

        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 mt-10 text-center">
          <div className="text-sm font-bold mb-2">לא מצאת תשובה?</div>
          <p className="text-xs text-white/50 mb-3">צרי קשר ואנחנו נחזור אלייך תוך 24 שעות</p>
          <a href={`mailto:${useContent("footer.contactEmail")}`}
             className="inline-block bg-brand hover:bg-brand/80 text-white px-5 py-2 rounded-lg text-sm font-bold">
            צרי קשר
          </a>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-white/40 hover:text-white">← חזרה לאפליקציה</Link>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors
      ${open ? "border-brand/40 bg-bg-card" : "border-white/10 bg-bg-card/50 hover:border-white/20"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right"
      >
        <span className={`font-medium text-sm ${open ? "text-white" : "text-white/85"}`}>{faq.q}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-white/70 leading-relaxed border-t border-white/5 pt-3">
          {faq.a}
        </div>
      )}
    </div>
  );
}
