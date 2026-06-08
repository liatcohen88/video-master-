"use client";

import { useEffect, useState } from "react";
import { Sparkles, Upload, Wand2, Download, X } from "lucide-react";
import LogoMark from "./LogoMark";
import { useContent } from "@/lib/useContent";

/**
 * Two-stage first-visit experience:
 *
 *  Stage 1 — SPLASH (everyone): a brief 600ms fade-in of the brand logo
 *  on every page load. Subtle, hides itself once interactive.
 *
 *  Stage 2 — ONBOARDING (first-time only): a friendly 3-step welcome modal
 *  shown only the first time a user lands. Sets a localStorage flag so it
 *  never shows again. The user can also explicitly dismiss it ("דלגי").
 */

const VISITED_KEY = "vm_onboarded_v1";

export default function OnboardingSplash() {
  const appName = useContent("brand.appName");
  const [stage, setStage] = useState<"splash" | "onboard" | "done">("splash");
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Splash always shows briefly, then either onboard or done.
    const t = setTimeout(() => {
      const visited = typeof window !== "undefined" && localStorage.getItem(VISITED_KEY);
      setStage(visited ? "done" : "onboard");
    }, 700);
    return () => clearTimeout(t);
  }, []);

  function finishOnboarding() {
    setClosing(true);
    setTimeout(() => {
      try { localStorage.setItem(VISITED_KEY, "1"); } catch {}
      setStage("done");
    }, 250);
  }

  if (stage === "done") return null;

  const STEPS = [
    {
      icon: Upload,
      title: `ברוכה הבאה ל-${appName}! 👋`,
      body: "בואי נראה איך זה עובד ב-3 צעדים. תקבלי 25 קרדיט מתנה להתחיל.",
      cta: "יאללה נתחיל",
    },
    {
      icon: Wand2,
      title: "1. העלי סרטון, בחרי מצב",
      body: "ה-AI יזהה דובר, יחתוך שתיקות, ויציע סגנון כתוביות. את בוחרת איך זה ייראה בסוף.",
      cta: "הבא",
    },
    {
      icon: Sparkles,
      title: "2. עיצוב + אפקטים",
      body: "סגנון כתוביות, אנימציות (Lottie), אמוג'ים, צלילי SFX — הכל קליק-קליק. תצוגה חיה תמיד.",
      cta: "הבא",
    },
    {
      icon: Download,
      title: "3. ייצוא — מוכן לעלייה",
      body: "MP4 ברזולוציה המקורית. או SRT לפרמייר. הקרדיט יורד רק כשמייצאים, לא במהלך עריכה.",
      cta: "מעולה, יאללה לעבודה!",
    },
  ];
  const s = STEPS[step];

  return (
    <div dir="rtl"
         className={`fixed inset-0 z-[150] flex items-center justify-center bg-bg/95 backdrop-blur-md
                     ${closing ? "animate-fade-out" : "animate-fade-in"}`}>
      {stage === "splash" ? (
        <div className="flex flex-col items-center gap-4 animate-splash-up">
          <LogoMark size={120} mode="breathing" />
          <div className="text-xl font-black tracking-tight">{appName}</div>
        </div>
      ) : (
        <div className="relative max-w-md w-[90vw] mx-auto bg-bg-card border border-brand/40 rounded-2xl p-6 shadow-2xl shadow-brand/20 animate-card-up">
          {step > 0 && (
            <button onClick={finishOnboarding}
                    className="absolute top-3 left-3 text-white/40 hover:text-white text-xs flex items-center gap-1">
              <X className="w-3 h-3" /> דלגי
            </button>
          )}

          <div className="flex flex-col items-center text-center">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4 shadow-lg shadow-brand/30">
              <s.icon className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-black mb-2">{s.title}</h2>
            <p className="text-sm text-white/70 leading-relaxed mb-5">{s.body}</p>

            <div className="flex items-center gap-1.5 mb-4">
              {STEPS.map((_, i) => (
                <div key={i}
                     className={`h-1.5 rounded-full transition-all
                                 ${i === step ? "w-6 bg-brand" : i < step ? "w-3 bg-brand/40" : "w-3 bg-white/15"}`} />
              ))}
            </div>

            <button
              onClick={() => {
                if (step === STEPS.length - 1) finishOnboarding();
                else setStep(step + 1);
              }}
              className="w-full py-3 bg-gradient-to-r from-brand to-pink-500 hover:opacity-90 text-white font-bold rounded-xl text-sm">
              {s.cta}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes splash-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes card-up   { from { transform: translateY(30px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-fade-in    { animation: fade-in 220ms ease-out; }
        .animate-fade-out   { animation: fade-out 220ms ease-out; }
        .animate-splash-up  { animation: splash-up 600ms ease-out; }
        .animate-card-up    { animation: card-up 320ms cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
