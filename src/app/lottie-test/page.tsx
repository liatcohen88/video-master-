"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LOTTIE_ICONS } from "@/lib/lottieRegistry";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Isolated Lottie evaluation page — visit /lottie-test to preview the animated
 * icons. Completely separate from the main app so it can't break anything.
 * This is the scaffold for the full Lottie feature (see LOTTIE_PLAN.md).
 */
export default function LottieTestPage() {
  const [data, setData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    LOTTIE_ICONS.forEach((icon) => {
      fetch(icon.jsonPath)
        .then((r) => r.json())
        .then((json) => setData((d) => ({ ...d, [icon.id]: json })))
        .catch(() => {});
    });
  }, []);

  return (
    <main dir="rtl" className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black mb-2">בדיקת אלמנטים מונפשים (Lottie) 🎬</h1>
      <p className="text-white/50 text-sm mb-8">
        אלה אנימציות לדוגמה. מחר נבחר ~30 כאלה, נוסיף בחירת צבע, וזיהוי אוטומטי
        לפי מילים — בדיוק כמו האמוג&apos;ים. ראי LOTTIE_PLAN.md לתוכנית המלאה.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {LOTTIE_ICONS.map((icon) => (
          <div
            key={icon.id}
            className="bg-bg-panel border border-white/10 rounded-2xl p-4 flex flex-col items-center"
          >
            <div className="w-32 h-32 bg-bg-card rounded-xl flex items-center justify-center overflow-hidden">
              {data[icon.id] ? (
                <Lottie
                  animationData={data[icon.id]}
                  loop
                  className="w-full h-full"
                />
              ) : (
                <div className="text-white/30 text-xs">טוען...</div>
              )}
            </div>
            <div className="mt-3 font-bold">{icon.name}</div>
            <div className="text-[11px] text-white/40">{icon.id}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-sm">
        <div className="font-bold text-emerald-200 mb-2">✅ מה כבר עובד (בוקר טוב!)</div>
        <ul className="text-emerald-100/80 space-y-1 text-[13px] list-disc pr-5">
          <li>הייצוא עכשיו נראה <b>בדיוק כמו התצוגה החיה</b> — כתוביות צבעוניות עם הדגשת מילה, RTL מושלם</li>
          <li>אמוג&apos;ים אמיתיים בצבע (twemoji) בייצוא, בדיוק כמו בפריוויו</li>
          <li>לוגו מותג גדול וממורכז</li>
          <li>לוגו מותאם אישית נצרב בייצוא</li>
          <li>הוידאו כבר לא נחתך (הוסר הזום האגרסיבי)</li>
          <li>הסרת רקע אמיתית מלוגו (שחור→שקוף)</li>
        </ul>
      </div>
    </main>
  );
}
