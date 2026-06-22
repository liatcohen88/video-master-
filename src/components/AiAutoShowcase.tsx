"use client";

/**
 * "מה ה-AI עושה לבד" — tabbed showcase of the auto-detection magic.
 * Each tab follows the pattern: ה-AI מזהה X  →  עושה Y, automatically.
 * Tabs (Liat, 2026-06-21): words→emoji+WOW, brands→logo, drama, subtitles.
 *
 * Brand tab uses the REAL brand logos (same simpleicons source as the editor),
 * cycling through several companies. Drama tab visibly animates color → B&W so
 * the cinematic effect is obvious. No Lottie (animations were removed). Copy is
 * gender-neutral (impersonal / plural).
 */

import { useEffect, useState } from "react";
import { BRAND_LOGOS, brandLogoCdnUrl, type BrandLogo } from "@/lib/brandLogos";

type TabId = "words" | "brands" | "drama" | "subs";

type Tab = {
  id: TabId;
  chip: string;
  emoji: string;
  detect: string;
  title: string;
  body: string;
  accent: string;
};

const TABS: Tab[] = [
  {
    id: "words",
    chip: "מילים",
    emoji: "✨",
    detect: "ה-AI מקשיב לדיבור",
    title: "מילה חזקה → אמוג'י + אפקט WOW",
    body: "על מילות מפתח (כסף, אהבה, מסיבה, אש…) קופץ האמוג'י המתאים, ובדיוק שם נכנס אפקט WOW — זום־ביט, פיצוץ חלקיקים ושייק. הכל אוטומטי, בלי לבחור כלום.",
    accent: "violet",
  },
  {
    id: "brands",
    chip: "מותגים",
    emoji: "🏷️",
    detect: "ה-AI מזהה שם מותג",
    title: "אומרים מותג → הלוגו קופץ",
    body: "מזכירים אינסטגרם, נטפליקס, יוטיוב או טסלה — וה-AI שותל את הלוגו האמיתי על המסך, בגודל ובמיקום הנכונים. אפשר גם לכוונן ידנית בלחיצה.",
    accent: "pink",
  },
  {
    id: "drama",
    chip: "רגעי דרמה",
    emoji: "🎬",
    detect: "ה-AI מזהה משפט עוצמתי",
    title: "רגע דרמטי → אפקט קולנועי",
    body: "כשנאמר משפט עם פאנץ', נכנס רגע קולנועי — המסך הופך לשחור-לבן עם האטה וזום פנימה — שמחזיק את הצופה צמוד למסך בדיוק בנקודה הנכונה.",
    accent: "amber",
  },
  {
    id: "subs",
    chip: "כתוביות",
    emoji: "💬",
    detect: "ה-AI מתמלל את הדיבור",
    title: "מדברים → כתוביות בסטייל ריל",
    body: "תמלול עברית מדויק שהופך לכתוביות מודגשות, מתוזמנות מילה-מילה ועם אנימציה — בדיוק כמו ברילז הכי נצפים. אפס הקלדה, אפס סנכרון ידני.",
    accent: "cyan",
  },
];

const ACCENT: Record<string, { text: string; chipOn: string; glow: string; from: string }> = {
  violet: { text: "text-violet-300", chipOn: "bg-violet-500/25 text-violet-100 border-violet-400/50", glow: "bg-violet-500/30", from: "from-violet-600/40" },
  pink:   { text: "text-pink-300",   chipOn: "bg-pink-500/25 text-pink-100 border-pink-400/50",     glow: "bg-pink-500/30",   from: "from-pink-600/40" },
  amber:  { text: "text-amber-300",  chipOn: "bg-amber-500/25 text-amber-100 border-amber-400/50",  glow: "bg-amber-500/30",  from: "from-amber-600/40" },
  cyan:   { text: "text-cyan-300",   chipOn: "bg-cyan-500/25 text-cyan-100 border-cyan-400/50",     glow: "bg-cyan-500/30",   from: "from-cyan-600/40" },
};

export default function AiAutoShowcase() {
  const [active, setActive] = useState<TabId>("words");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((cur) => {
        const i = TABS.findIndex((t) => t.id === cur);
        return TABS[(i + 1) % TABS.length].id;
      });
    }, 4200);
    return () => window.clearInterval(id);
  }, [paused]);

  const tab = TABS.find((t) => t.id === active)!;
  const ac = ACCENT[tab.accent];

  return (
    <section dir="rtl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-wider text-brand-light/80 uppercase mb-2">
          ✨ אוטומטי לגמרי
        </div>
        <h2 className="text-3xl md:text-4xl font-black mb-2">הקסם קורה לבד</h2>
        <p className="text-white/55 max-w-xl mx-auto text-sm md:text-base">
          מעלים סרטון — וה-AI מזהה מה קורה בו ומוסיף את האפקטים הנכונים במקומות הנכונים. בלי עריכה ידנית.
        </p>
      </div>

      <div
        className="bg-bg-card border border-white/10 rounded-3xl p-3 md:p-4"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {TABS.map((t) => {
            const on = t.id === active;
            const tac = ACCENT[t.accent];
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                  on ? `${tac.chipOn} scale-[1.03]` : "bg-bg-input/60 text-white/55 border-white/10 hover:text-white/80 hover:border-white/20"
                }`}
                aria-pressed={on}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                {t.chip}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
          <div className="order-1 md:order-2 flex items-center justify-center py-4">
            <TabVisual tab={tab} />
          </div>

          <div className="order-2 md:order-1 px-2 md:px-4 pb-4 md:pb-0">
            <div className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${ac.text} bg-white/[0.04] border border-white/10 rounded-full px-3 py-1 mb-3`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ac.glow} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${ac.glow}`} />
              </span>
              {tab.detect}
            </div>
            <h3 className="text-xl md:text-2xl font-black mb-2 leading-tight">{tab.title}</h3>
            <p className="text-white/60 text-sm md:text-[15px] leading-relaxed">{tab.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Themed 9:16 mini-frame illustrating the active capability — CSS only. */
function TabVisual({ tab }: { tab: Tab }) {
  const ac = ACCENT[tab.accent];
  return (
    <div className="relative w-[180px] aspect-[9/16] rounded-[1.4rem] border-2 border-white/15 bg-black overflow-hidden shadow-2xl shadow-black/60">
      {/* themed backdrop — drama provides its own animated scene */}
      {tab.id !== "drama" && (
        <div className={`absolute inset-0 bg-gradient-to-br ${ac.from} via-bg-panel to-black`} />
      )}
      <div className={`absolute -top-8 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full ${ac.glow} blur-3xl opacity-50 pointer-events-none`} />

      {tab.id === "words" && <WordsInner />}

      {tab.id === "brands" && <BrandsInner />}
      {tab.id === "drama" && <DramaInner />}

      {tab.id === "subs" && (
        <div className="absolute inset-x-0 bottom-[12%] flex justify-center gap-1.5" dir="rtl">
          {["מה", "קורה", "פה?!"].map((w, i) => (
            <span key={i}
              className={`text-lg font-black aas-word ${i === 2 ? "text-cyan-300" : "text-white"}`}
              style={{
                animationDelay: `${i * 0.18}s`,
                textShadow: "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000",
              }}>
              {w}
            </span>
          ))}
        </div>
      )}

      <VisualStyles />
    </div>
  );
}

/** A real caption scene: the subtitle appears, then the matching emoji POPS —
 *  exactly what the AI does on a keyword. Cycles through a few examples. */
const WORD_SCENES = [
  { text: "עשינו מסיבה", hi: "מסיבה", emoji: "🎉" },
  { text: "עשינו המון כסף", hi: "כסף", emoji: "💰" },
  { text: "זה פשוט אש", hi: "אש", emoji: "🔥" },
  { text: "אני מתה עליך", hi: "מתה", emoji: "❤️" },
];

function WordsInner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % WORD_SCENES.length), 2800);
    return () => window.clearInterval(id);
  }, []);
  const sc = WORD_SCENES[i];
  return (
    <div className="absolute inset-0">
      {/* matching emoji pops in, a beat AFTER the caption shows */}
      <div className="absolute top-[26%] left-1/2 -translate-x-1/2">
        <span key={`e${i}`} className="block text-[60px] aas-pop drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]" style={{ animationDelay: "0.35s" }}>
          {sc.emoji}
        </span>
      </div>
      {/* Reels-style caption at the bottom, keyword highlighted */}
      <div key={`c${i}`} className="absolute bottom-[14%] inset-x-0 flex flex-wrap justify-center gap-x-1.5 px-3 aas-cap" dir="rtl">
        {sc.text.split(" ").map((w, wi) => (
          <span key={wi} className={`text-base font-black ${w === sc.hi ? "text-amber-300" : "text-white"}`}
            style={{ textShadow: "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000" }}>
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Cycles through several REAL brand logos, each popping in on a white chip
 *  (same "logo overlay on the video" look the editor produces). */
const SHOWCASE_BRAND_IDS = ["instagram", "netflix", "youtube", "spotify", "tesla", "tiktok"];

function BrandsInner() {
  const brands = SHOWCASE_BRAND_IDS
    .map((id) => BRAND_LOGOS.find((b) => b.id === id))
    .filter(Boolean) as BrandLogo[];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (brands.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % brands.length), 1500);
    return () => window.clearInterval(id);
  }, [brands.length]);

  if (!brands.length) return null;
  const b = brands[i];
  const nameColor = b.color.toUpperCase() === "FFFFFF" ? "#111827" : `#${b.color}`;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <div key={b.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl aas-pop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brandLogoCdnUrl(b)} alt={b.name} width={26} height={26}
          style={{ width: 26, height: 26 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <span className="font-black text-lg" style={{ color: nameColor }}>{b.name}</span>
      </div>
      {/* the roster of brands it knows — active one lit, others dimmed */}
      <div className="flex items-center justify-center gap-2 px-3">
        {brands.map((br, idx) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={br.id} src={brandLogoCdnUrl({ ...br, color: "FFFFFF" })} alt={br.name}
            width={18} height={18}
            style={{ width: 18, height: 18, opacity: idx === i ? 1 : 0.35, transition: "opacity .3s" }} />
        ))}
      </div>
    </div>
  );
}

/** Plays a colorful "scene" that visibly desaturates to black & white with a
 *  slow-zoom, looping — so the cinematic drama effect reads instantly. */
function DramaInner() {
  return (
    <>
      <div className="absolute inset-0 aas-drama">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-600 to-purple-700" />
        {/* a little "scene" so the desaturation is obvious */}
        <div className="absolute inset-0 flex items-center justify-center text-[64px]">🎬</div>
        <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-yellow-300/70 blur-md" />
      </div>
      <div className="absolute bottom-4 inset-x-0 flex justify-center">
        <span className="text-white/90 text-[11px] font-mono tracking-widest border border-white/40 rounded px-2 py-0.5 bg-black/40">
          SLOW ‹ ❚❚ ›
        </span>
      </div>
    </>
  );
}

function VisualStyles() {
  return (
    <style jsx global>{`
      @keyframes aas-pop {
        0% { opacity: 0; transform: scale(0.4); }
        60% { opacity: 1; transform: scale(1.12); }
        100% { opacity: 1; transform: scale(1); }
      }
      .aas-pop { animation: aas-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }
      @keyframes aas-spark { 0%,100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.2); } }
      .aas-spark { animation: aas-spark 1.6s ease-in-out infinite; }
      /* caption fade-in for the keyword scene (emoji uses aas-pop after a beat) */
      @keyframes aas-cap { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
      .aas-cap { animation: aas-cap 0.4s ease-out both; }
      @keyframes aas-word { 0% { opacity: 0; transform: translateY(8px) scale(0.8); } 60% { opacity: 1; transform: translateY(0) scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
      .aas-word { animation: aas-word 0.5s cubic-bezier(0.34,1.56,0.64,1) both; display: inline-block; }
      /* color → black&white + slow zoom, looping (the drama effect) */
      @keyframes aas-drama {
        0%, 35%   { filter: grayscale(0) contrast(1); transform: scale(1); }
        65%, 100% { filter: grayscale(1) contrast(1.25) brightness(0.92); transform: scale(1.1); }
      }
      .aas-drama { animation: aas-drama 3.2s ease-in-out infinite alternate; }
    `}</style>
  );
}
