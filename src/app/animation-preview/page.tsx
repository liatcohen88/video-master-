"use client";

import { useEffect, useRef, useState } from "react";

/* ── tiny helpers ── */
function useLoopAnim(intervalMs: number, cb: () => void) {
  useEffect(() => {
    cb();
    const id = setInterval(cb, intervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}

function replayAnim(el: HTMLElement | null, animation: string) {
  if (!el) return;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = animation;
}

/* ── types ── */
type SubAnim = {
  id: string;
  label: string;
  emoji: string;
  css: string;
  color: string;
  text: string;
};

type IntroAnim = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  css: string;
};

/* ── data ── */
const SUB_ANIMS: SubAnim[] = [
  { id: "pop",        label: "פופ",         emoji: "💥", css: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both",        color: "#FFD700", text: "חייבים לראות!" },
  { id: "bounce",     label: "באונס",       emoji: "🏀", css: "sub-bounce 500ms cubic-bezier(0.34,1.56,0.64,1) both",     color: "#7BE8FF", text: "לא תאמין!" },
  { id: "slide-up",   label: "Slide up",    emoji: "⬆️", css: "sub-slide-up 350ms ease-out both",                         color: "#98FF98", text: "רגע אחד..." },
  { id: "slide-left", label: "Slide left",  emoji: "⬅️", css: "sub-slide-left 350ms ease-out both",                       color: "#FF9EFF", text: "קדימה נצא!" },
  { id: "zoom-burst", label: "Zoom burst",  emoji: "🔭", css: "sub-zoom-burst 350ms cubic-bezier(0.25,0.46,0.45,0.94) both", color: "#FF6B6B", text: "פצצה!" },
  { id: "wave",       label: "Wave",        emoji: "🌊", css: "sub-wave 500ms ease-in-out both",                          color: "#C3B1FF", text: "כיף מטורף" },
  { id: "pop-strong", label: "פופ חזק",    emoji: "💣", css: "sub-pop-strong 300ms cubic-bezier(0.34,1.56,0.64,1) both",  color: "#FFA040", text: "אש!!!" },
  { id: "slide-right",label: "Slide right", emoji: "➡️", css: "sub-slide-right 350ms ease-out both",                      color: "#40FFD4", text: "עוד רגע!" },
];

const INTRO_ANIMS: IntroAnim[] = [
  { id: "punch",   label: "Punch zoom",   emoji: "👊", desc: "MrBeast style",         css: "intro-punch 700ms cubic-bezier(0.22,1,0.36,1) both" },
  { id: "shake",   label: "Shake",        emoji: "💥", desc: "אגרסיבי ודרמטי",       css: "intro-shake 500ms ease both" },
  { id: "flash",   label: "Flash white",  emoji: "⚡", desc: "פלאש שמגלה הכל",       css: "intro-flash 600ms ease both" },
  { id: "iris",    label: "Iris open",    emoji: "🎬", desc: "עיגול קולנועי",         css: "intro-iris 600ms ease both" },
  { id: "fade",    label: "Fade in",      emoji: "🌅", desc: "כניסה קלאסית ונקייה",  css: "intro-fade 600ms ease both" },
  { id: "slide-up",label: "Slide up",     emoji: "📱", desc: "נכנס מלמטה",           css: "intro-slide-up 500ms cubic-bezier(0.22,1,0.36,1) both" },
];

const AI_EFFECTS = [
  {
    id: "beat",
    label: "Beat-drop zoom",
    emoji: "🎵",
    badge: "AI",
    badgeColor: "#7C3AED",
    desc: "מזהה מילות כוח בטרנסקריפט — \"וואו\", \"אש\", \"מטורף\" — ומזום בדיוק על הבית",
    demo: "beat",
  },
  {
    id: "drama",
    label: "Drama mode",
    emoji: "🎭",
    badge: "AI",
    badgeColor: "#7C3AED",
    desc: "מזהה משפטי דרמה → גרייסקייל + מוסיקה דרמטית. \"אני לא מאמין שזה קרה לי\"",
    demo: "drama",
  },
  {
    id: "lottie",
    label: "אייקון חכם",
    emoji: "⭐",
    badge: "Lottie",
    badgeColor: "#059669",
    desc: "מזהה הקשר מהטרנסקריפט ומוסיף אייקון וקטורי מונפש אוטומטית — 23 אייקונים",
    demo: "lottie",
  },
  {
    id: "particles",
    label: "Particle burst",
    emoji: "✨",
    badge: "AI",
    badgeColor: "#7C3AED",
    desc: "פיצוץ חלקיקים על מומנטים מרגשים — חתונה, לידה, קידום, ניצחון",
    demo: "particles",
  },
];

const BACKGROUNDS = [
  { id: "sunset",   label: "Sunset",   colors: ["#FF6B35", "#F7C59F", "#EFEFD0"] },
  { id: "cyber",    label: "Cyber",    colors: ["#0a0a1a", "#1a0a2e", "#16213e"] },
  { id: "bokeh",    label: "Bokeh",    colors: ["#1a1a2e", "#16213e", "#0f3460"] },
  { id: "wave",     label: "Wave",     colors: ["#4facfe", "#00f2fe", "#a18cd1"] },
  { id: "particles",label: "Particles",colors: ["#0c0c0c", "#1a1a1a", "#111"] },
  { id: "mesh",     label: "Mesh",     colors: ["#667eea", "#764ba2", "#f093fb"] },
];

/* ── SubtitleDemo card ── */
function SubtitleCard({ anim, index }: { anim: SubAnim; index: number }) {
  const textRef = useRef<HTMLSpanElement>(null);

  useLoopAnim(2800 + index * 300, () => {
    replayAnim(textRef.current, anim.css);
  });

  return (
    <div
      className="group relative overflow-hidden rounded-2xl cursor-pointer select-none"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      onClick={() => replayAnim(textRef.current, anim.css)}
    >
      {/* preview area */}
      <div className="relative flex items-center justify-center" style={{ height: 110, background: "rgba(0,0,0,0.5)" }}>
        {/* fake video bars */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 4px)",
        }} />
        <span
          ref={textRef}
          className="relative z-10 font-bold text-center px-3"
          style={{
            fontSize: 20,
            color: anim.color,
            textShadow: `0 0 20px ${anim.color}88, 0 2px 8px rgba(0,0,0,0.9)`,
            fontFamily: "var(--font-heebo), sans-serif",
            display: "inline-block",
          }}
        >
          {anim.text}
        </span>
      </div>

      {/* info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 14 }}>{anim.emoji}</span>
          <span className="font-semibold text-white" style={{ fontSize: 13 }}>{anim.label}</span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>לחץ לחזרה</p>
      </div>

      {/* replay hint on hover */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.8)", color: "#fff" }}>↺</span>
      </div>
    </div>
  );
}

/* ── IntroDemo card ── */
function IntroCard({ anim, index }: { anim: IntroAnim; index: number }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useLoopAnim(3500 + index * 400, () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = `${anim.css}`;
  });

  return (
    <div
      className="group relative overflow-hidden rounded-2xl cursor-pointer"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      onClick={() => {
        const el = boxRef.current;
        if (!el) return;
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = anim.css;
      }}
    >
      <div className="relative flex items-center justify-center" style={{ height: 110, background: "rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div
          ref={boxRef}
          className="rounded-xl flex items-center justify-center"
          style={{
            width: "75%", height: 70,
            background: "linear-gradient(135deg, #1e1e3a, #2d1b69)",
            border: "1px solid rgba(124,58,237,0.4)",
            transformOrigin: "center center",
          }}
        >
          <span className="text-white font-bold text-sm opacity-70">תוכן הוידאו שלך</span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 14 }}>{anim.emoji}</span>
          <span className="font-semibold text-white" style={{ fontSize: 13 }}>{anim.label}</span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{anim.desc}</p>
      </div>
    </div>
  );
}

/* ── AI effect card ── */
function AICard({ effect }: { effect: typeof AI_EFFECTS[0] }) {
  const demoRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<{ x: number; y: number; color: string; delay: number }[]>([]);

  useLoopAnim(3000, () => {
    if (effect.demo === "particles") {
      const colors = ["#AFA9EC", "#FFD700", "#FF6B6B", "#7BE8FF", "#98FF98", "#FF9EFF"];
      setParticles(
        Array.from({ length: 14 }, (_, i) => ({
          x: 5 + Math.floor((i / 14) * 90),
          y: 10 + Math.floor(Math.random() * 65),
          color: colors[i % colors.length],
          delay: i * 80,
        }))
      );
      setTimeout(() => setParticles([]), 1800);
      return;
    }
    if (demoRef.current) {
      demoRef.current.style.animation = "none";
      void demoRef.current.offsetWidth;
      if (effect.demo === "beat") demoRef.current.style.animation = "beat-drop-zoom 800ms ease both";
      if (effect.demo === "drama") demoRef.current.style.animation = "drama-flash 1200ms ease both";
      if (effect.demo === "lottie") demoRef.current.style.animation = "lottie-pop 500ms cubic-bezier(0.175,0.885,0.32,1.275) both";
    }
  });

  return (
    <div
      className="group relative overflow-hidden rounded-2xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div
        className="relative flex items-center justify-center gap-3"
        style={{ height: 120, background: "rgba(0,0,0,0.6)", overflow: "hidden" }}
      >
        {effect.demo === "beat" && (
          <div ref={demoRef} className="flex items-center gap-2">
            <span className="text-xl" style={{ color: "#FF6B6B", fontSize: 11, opacity: 0.8 }}>🎵 BEAT</span>
            <span className="font-bold" style={{ fontSize: 20, color: "#FFD700", fontFamily: "var(--font-heebo), sans-serif", textShadow: "0 0 20px #FFD70088" }}>
              וואו זה מטורף!
            </span>
          </div>
        )}
        {effect.demo === "drama" && (
          <div ref={demoRef} style={{ textAlign: "center" }}>
            <span className="font-bold" style={{ fontSize: 16, color: "#fff", fontFamily: "var(--font-heebo), sans-serif" }}>
              אני לא מאמין שזה קרה לי
            </span>
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>🎬 DRAMA MODE</div>
          </div>
        )}
        {effect.demo === "lottie" && (
          <div ref={demoRef} className="flex items-center gap-2">
            <span style={{ fontSize: 42, display: "inline-block" }}>⭐</span>
            <span className="font-bold" style={{ fontSize: 18, color: "#fff", fontFamily: "var(--font-heebo), sans-serif" }}>
              קיבלתי פרס!
            </span>
          </div>
        )}
        {effect.demo === "particles" && (
          <div className="absolute inset-0" style={{ overflow: "hidden" }}>
            {particles.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: 7, height: 7,
                  background: p.color,
                  animation: `particle-fly 1.4s ease-out ${p.delay}ms both`,
                }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-bold" style={{ fontSize: 18, color: "#fff", fontFamily: "var(--font-heebo), sans-serif" }}>
                קנינו בית! 🏠
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: effect.badgeColor, color: "#fff", fontSize: 10 }}
          >
            {effect.badge}
          </span>
          <span className="font-semibold text-white" style={{ fontSize: 13 }}>{effect.label}</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{effect.desc}</p>
      </div>
    </div>
  );
}

/* ── Background thumbnail ── */
function BgThumb({ bg }: { bg: typeof BACKGROUNDS[0] }) {
  return (
    <div
      className="rounded-xl overflow-hidden relative cursor-pointer group"
      style={{
        height: 80,
        background: `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]}, ${bg.colors[2]})`,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="absolute inset-0 flex items-end p-2">
        <span className="text-xs font-semibold text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{bg.label}</span>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AnimationPreviewPage() {
  return (
    <>
      <style>{`
        /* ─── page resets ─── */
        body { background: #070710 !important; }

        /* ─── intro keyframes ─── */
        @keyframes intro-punch {
          0%   { transform: scale(1.45); }
          100% { transform: scale(1); }
        }
        @keyframes intro-shake {
          0%   { transform: translate(0,0) rotate(0); }
          10%  { transform: translate(-7px, 5px) rotate(-1.5deg); }
          20%  { transform: translate(6px,-4px) rotate(1.2deg); }
          30%  { transform: translate(-5px, 6px) rotate(-1deg); }
          45%  { transform: translate(3px,-3px) rotate(0.5deg); }
          60%  { transform: translate(-2px, 2px); }
          80%  { transform: translate(1px,-1px); }
          100% { transform: translate(0,0) rotate(0); }
        }
        @keyframes intro-flash {
          0%   { filter: brightness(12) saturate(0); opacity: 0.95; }
          100% { filter: brightness(1) saturate(1); opacity: 1; }
        }
        @keyframes intro-iris {
          from { clip-path: circle(0% at 50% 50%); }
          to   { clip-path: circle(80% at 50% 50%); }
        }
        @keyframes intro-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes intro-slide-up {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }

        /* ─── AI effect keyframes ─── */
        @keyframes beat-drop-zoom {
          0%,100% { transform: scale(1); }
          15%,55% { transform: scale(1.08); }
        }
        @keyframes drama-flash {
          0%,100% { filter: grayscale(0) brightness(1); }
          25%,75% { filter: grayscale(1) brightness(0.75); }
        }
        @keyframes lottie-pop {
          0%  { transform: scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100%{ transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes particle-fly {
          0%   { transform: translateY(0) scale(0); opacity: 0; }
          30%  { opacity: 1; transform: translateY(-25px) scale(1); }
          100% { transform: translateY(-60px) scale(0.5); opacity: 0; }
        }
      `}</style>

      <div className="min-h-screen" style={{ background: "#070710", color: "#fff", direction: "rtl" }}>

        {/* ── Hero ── */}
        <div className="text-center px-6" style={{ paddingTop: "5rem", paddingBottom: "3rem" }}>
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }}>
            ✨ הצצה למערכת האנימציות
          </div>
          <h1 className="font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontFamily: "var(--font-heebo), sans-serif" }}>
            כל אנימציה שקיימת
            <br />
            <span style={{ background: "linear-gradient(90deg, #7C3AED, #C084FC, #7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              במערכת — כאן חיה
            </span>
          </h1>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, lineHeight: 1.7 }}>
            לחץ על כל כרטיס כדי לראות את האנימציה שוב. כולן כבר קיימות — אלה הן הפיצ'רים האמיתיים.
          </p>
        </div>

        {/* ── Section: כתוביות ── */}
        <section className="px-6 pb-16 max-w-6xl mx-auto">
          <SectionHeader
            label="כתוביות"
            title="8 אנימציות כניסה לכתוביות"
            sub="משמשות גם בתצוגה מקדימה וגם בייצוא — ASS + CSS מסונכרנים"
          />
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {SUB_ANIMS.map((a, i) => <SubtitleCard key={a.id} anim={a} index={i} />)}
          </div>
        </section>

        {/* ── Section: פתיחות ── */}
        <section className="px-6 pb-16 max-w-6xl mx-auto">
          <SectionHeader
            label="פתיחות"
            title="6 אנימציות פתיחה לוידאו"
            sub="מופעלות על הפריים הראשון — CSS בתצוגה, FFmpeg filter chain בייצוא"
          />
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {INTRO_ANIMS.map((a, i) => <IntroCard key={a.id} anim={a} index={i} />)}
          </div>
        </section>

        {/* ── Section: AI effects ── */}
        <section className="px-6 pb-16 max-w-6xl mx-auto">
          <SectionHeader
            label="AI-powered"
            title="4 אפקטים שנדלקים לבד"
            sub="המערכת מנתחת את הטרנסקריפט ומוסיפה אפקטים בדיוק במקום הנכון"
          />
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {AI_EFFECTS.map(e => <AICard key={e.id} effect={e} />)}
          </div>
        </section>

        {/* ── Section: רקעים ── */}
        <section className="px-6 pb-16 max-w-6xl mx-auto">
          <SectionHeader
            label="רקעים דינמיים"
            title="6 רקעים זזים בזמן אמת"
            sub="מונפשים ב-CSS בתצוגה — נוצרים דרך FFmpeg lavfi בייצוא"
          />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {BACKGROUNDS.map(b => <BgThumb key={b.id} bg={b} />)}
          </div>
        </section>

        {/* ── CTA ── */}
        <div className="text-center pb-24 px-6">
          <div
            className="inline-block px-8 py-4 rounded-2xl font-bold text-lg"
            style={{
              background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
              boxShadow: "0 0 40px rgba(124,58,237,0.4)",
              cursor: "default",
            }}
          >
            🚀 כל זה כבר בנוי — הלאנדינג יראה אותו חי
          </div>
        </div>

      </div>
    </>
  );
}

function SectionHeader({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <div className="mb-8">
      <span
        className="text-xs font-bold tracking-widest uppercase mb-3 inline-block"
        style={{ color: "#7C3AED", letterSpacing: "0.12em" }}
      >
        {label}
      </span>
      <h2 className="font-bold mb-2" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontFamily: "var(--font-heebo), sans-serif" }}>
        {title}
      </h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>{sub}</p>
    </div>
  );
}
