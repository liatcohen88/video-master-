"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ─── subtitle cycle ─── */
const SUBS = [
  { text: "חייבים לראות את זה!", color: "#FFD700", anim: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both" },
  { text: "לא תאמינו כמה זה קל", color: "#7BE8FF", anim: "sub-bounce 500ms cubic-bezier(0.34,1.56,0.64,1) both" },
  { text: "אני לא מאמין שזה קרה!", color: "#fff",    anim: "sub-slide-up 350ms ease-out both", drama: true },
  { text: "פצצה של פיצ'ר!",     color: "#FF6B6B", anim: "sub-zoom-burst 350ms cubic-bezier(0.25,0.46,0.45,0.94) both" },
  { text: "וואו זה מטורף!",      color: "#FFD700", anim: "sub-pop-strong 300ms cubic-bezier(0.34,1.56,0.64,1) both", beat: true },
  { text: "קיבלתי פרס! מדהים",  color: "#C3B1FF", anim: "sub-wave 500ms ease-in-out both", icon: "⭐" },
  { text: "קדימה נעשה היסטוריה", color: "#98FF98", anim: "sub-slide-left 350ms ease-out both" },
  { text: "אש! זה עובד לבד!",   color: "#FFA040", anim: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both", icon: "🔥" },
];

const SUBTITLE_LIST = [
  { start: "0:01", text: "חייבים לראות את זה!", active: true },
  { start: "0:04", text: "לא תאמינו כמה זה קל", active: false },
  { start: "0:07", text: "אני לא מאמין שזה קרה!", active: false },
  { start: "0:11", text: "פצצה של פיצ'ר!", active: false },
  { start: "0:14", text: "וואו זה מטורף!", active: false },
];

const TEMPLATES = [
  { name: "הופ!", bg: "#FFD700", textColor: "#000", bold: true },
  { name: "ניאון", bg: "#0a0a1a", textColor: "#00FFFF", bold: false },
  { name: "פייר", bg: "#7C3AED", textColor: "#fff", bold: false },
  { name: "לבן", bg: "#fff", textColor: "#111", bold: false },
  { name: "שקוף", bg: "rgba(0,0,0,0.5)", textColor: "#fff", bold: false },
  { name: "אש 🔥", bg: "#FF4500", textColor: "#FFD700", bold: true },
];

const CHIPS = [
  { label: "כתוביות אוטומטיות", icon: "✍️", side: "right", delay: 0.4 },
  { label: "Beat-drop zoom",     icon: "🎵", side: "right", delay: 0.8 },
  { label: "23 אייקוני Lottie",  icon: "⭐", side: "right", delay: 1.2 },
  { label: "ייצוא MP4 מקצועי",  icon: "📤", side: "left",  delay: 0.6 },
  { label: "Drama mode AI",      icon: "🎭", side: "left",  delay: 1.0 },
  { label: "6 רקעים דינמיים",   icon: "✨", side: "left",  delay: 1.4 },
];

function BrowserHero() {
  const [idx, setIdx]         = useState(0);
  const [vis, setVis]         = useState(true);
  const [beat, setBeat]       = useState(false);
  const [drama, setDrama]     = useState(false);
  const [icon, setIcon]       = useState<string | null>(null);
  const [chipsIn, setChipsIn] = useState(false);
  const [activeRow, setActiveRow] = useState(0);
  const subRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { setTimeout(() => setChipsIn(true), 600); }, []);

  const advance = useCallback(() => {
    setVis(false);
    setTimeout(() => {
      setIdx(prev => {
        const next = (prev + 1) % SUBS.length;
        const s = SUBS[next];
        if (s.beat)  { setBeat(true);  setTimeout(() => setBeat(false),  700); }
        if (s.drama) { setDrama(true); setTimeout(() => setDrama(false), 1200); }
        setIcon(s.icon ?? null);
        setActiveRow(next % SUBTITLE_LIST.length);
        return next;
      });
      setVis(true);
      setTimeout(() => {
        if (!subRef.current) return;
        subRef.current.style.animation = "none";
        void subRef.current.offsetWidth;
        subRef.current.style.animation = SUBS[(idx + 1) % SUBS.length].anim;
      }, 20);
    }, 180);
  }, [idx]);

  useEffect(() => {
    const id = setInterval(advance, 2800);
    return () => clearInterval(id);
  }, [advance]);

  const cur = SUBS[idx];

  return (
    <div style={{ position: "relative", maxWidth: 880, margin: "0 auto" }}>

      {/* chips right */}
      <div style={{ position: "absolute", right: -8, top: "8%", zIndex: 10, display: "flex", flexDirection: "column", gap: 9 }}>
        {CHIPS.filter(c => c.side === "right").map((c, i) => (
          <div key={c.label} style={{
            background: "rgba(15,12,30,0.85)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100,
            padding: "6px 14px", fontSize: 12, color: "#fff", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 7,
            transform: chipsIn ? "translateX(0)" : "translateX(70px)",
            opacity: chipsIn ? 1 : 0,
            transition: `transform 0.6s cubic-bezier(0.22,1,0.36,1) ${c.delay}s, opacity 0.5s ease ${c.delay}s`,
            animation: chipsIn ? `chip-float ${3 + i * 0.3}s ease-in-out ${i * 0.4}s infinite` : "none",
          }}>
            <span>{c.icon}</span><span style={{ opacity: 0.8 }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* chips left */}
      <div style={{ position: "absolute", left: -8, top: "15%", zIndex: 10, display: "flex", flexDirection: "column", gap: 9 }}>
        {CHIPS.filter(c => c.side === "left").map((c, i) => (
          <div key={c.label} style={{
            background: "rgba(15,12,30,0.85)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100,
            padding: "6px 14px", fontSize: 12, color: "#fff", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 7,
            transform: chipsIn ? "translateX(0)" : "translateX(-70px)",
            opacity: chipsIn ? 1 : 0,
            transition: `transform 0.6s cubic-bezier(0.22,1,0.36,1) ${c.delay}s, opacity 0.5s ease ${c.delay}s`,
            animation: chipsIn ? `chip-float ${3.3 + i * 0.3}s ease-in-out ${i * 0.5 + 0.2}s infinite` : "none",
          }}>
            <span>{c.icon}</span><span style={{ opacity: 0.8 }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* ── browser frame ── */}
      <div style={{
        borderRadius: "14px 14px 10px 10px", overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
      }}>

        {/* browser chrome */}
        <div style={{
          background: "#16162a", padding: "9px 14px",
          display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#FF5F57","#FEBC2E","#28C840"].map(c => (
              <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
            ))}
          </div>
          {/* tabs */}
          <div style={{ display: "flex", gap: 2, marginRight: 6 }}>
            <div style={{ padding: "3px 14px", borderRadius: "6px 6px 0 0", background: "#0d0d20", fontSize: 11, color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid #0d0d20" }}>
              מאסטר וידאו
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5, padding: "4px 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", fontFamily: "monospace" }}>
            videomaster.app
          </div>
        </div>

        {/* ── editor body ── */}
        <div style={{ background: "#0d0d20", display: "flex", height: 460, direction: "ltr" }}>

          {/* ── LEFT: video + subtitle list ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, minWidth: 0, padding: "14px 14px 0 14px" }}>

            {/* video preview — 9:16 phone ratio */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{
                width: 180, aspectRatio: "9/16",
                background: "linear-gradient(180deg, #1a1030, #0d0d20, #1a1a3e)",
                borderRadius: 12, position: "relative", overflow: "hidden",
                transform: beat ? "scale(1.05)" : "scale(1)",
                filter: drama ? "grayscale(1) brightness(0.7)" : "none",
                transition: "transform 0.2s ease, filter 0.3s ease",
                border: "1px solid rgba(255,255,255,0.07)",
                flexShrink: 0,
              }}>
                {/* scanlines */}
                <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.4) 2px,rgba(255,255,255,0.4) 3px)", pointerEvents: "none" }} />
                {/* person shape */}
                <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "45%", height: "65%", background: "linear-gradient(180deg, rgba(100,80,160,0.25), rgba(60,40,120,0.5))", borderRadius: "50% 50% 0 0", opacity: 0.6 }} />
                {/* beat badge */}
                {beat && <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,50,50,0.9)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#fff", fontWeight: 700 }}>● BEAT</div>}
                {/* drama badge */}
                {drama && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.75)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#aaa" }}>🎬 DRAMA</div>}
                {/* lottie icon */}
                {icon && vis && <span style={{ position: "absolute", bottom: "28%", right: "8%", fontSize: 22, display: "inline-block", animation: "lottie-pop 450ms cubic-bezier(0.175,0.885,0.32,1.275) both" }}>{icon}</span>}
                {/* subtitle */}
                <div style={{ position: "absolute", bottom: "10%", width: "100%", textAlign: "center", padding: "0 8%" }}>
                  {vis && (
                    <span ref={subRef} style={{
                      display: "inline-block", fontSize: 13, fontWeight: 800,
                      color: cur.color,
                      textShadow: `0 0 16px ${cur.color}88, 0 1px 4px rgba(0,0,0,0.9)`,
                      fontFamily: "var(--font-heebo), system-ui, sans-serif",
                      animation: cur.anim,
                      background: "rgba(0,0,0,0.35)", borderRadius: 4, padding: "2px 8px",
                    }}>
                      {cur.text}
                    </span>
                  )}
                </div>
                {/* progress bar */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ height: "100%", background: "linear-gradient(90deg,#7C3AED,#C084FC)", animation: "prog 2.8s linear infinite" }} />
                </div>
              </div>
            </div>

            {/* subtitle list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 0 14px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, textAlign: "right", paddingRight: 4 }}>כתוביות ({SUBTITLE_LIST.length})</div>
              {SUBTITLE_LIST.map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 6,
                  background: i === activeRow ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${i === activeRow ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.06)"}`,
                  cursor: "default", transition: "all 0.3s ease",
                }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", flexShrink: 0 }}>{s.start}</span>
                  <span style={{ fontSize: 11, color: i === activeRow ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: "var(--font-heebo), sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}</span>
                  {i === activeRow && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C3AED", flexShrink: 0, marginRight: "auto", animation: "pulse 1s ease-in-out infinite" }} />}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: style panel ── */}
          <div style={{ width: 220, background: "#111128", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>

            {/* templates */}
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>תבניות סגנון</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {TEMPLATES.map((t, i) => (
                  <div key={i} style={{
                    height: 36, borderRadius: 7, background: t.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: t.textColor, fontWeight: t.bold ? 700 : 400,
                    border: i === 0 ? "2px solid rgba(124,58,237,0.8)" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "default", position: "relative", overflow: "hidden",
                    fontFamily: "var(--font-heebo), sans-serif",
                  }}>
                    {t.name}
                    {i === 0 && <div style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: "#7C3AED" }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* font size */}
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>גודל פונט</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, position: "relative" }}>
                  <div style={{ width: "55%", height: "100%", background: "#7C3AED", borderRadius: 2 }} />
                  <div style={{ position: "absolute", left: "55%", top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, background: "#7C3AED", borderRadius: "50%", border: "2px solid #fff" }} />
                </div>
                <span style={{ fontSize: 11, color: "#fff", minWidth: 24 }}>32</span>
              </div>
            </div>

            {/* divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* effects toggles */}
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>אפקטים</div>
              {[
                { label: "Beat-drop zoom", on: true,  icon: "🎵" },
                { label: "Drama mode",     on: true,  icon: "🎭" },
                { label: "אייקוני Lottie", on: true,  icon: "⭐" },
              ].map((fx) => (
                <div key={fx.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                    <span>{fx.icon}</span>{fx.label}
                  </div>
                  <div style={{ width: 28, height: 16, borderRadius: 8, background: fx.on ? "#7C3AED" : "rgba(255,255,255,0.1)", position: "relative", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, right: fx.on ? 2 : "auto", left: fx.on ? "auto" : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* export button */}
            <button style={{
              padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
              color: "#fff", background: "linear-gradient(135deg,#7C3AED,#5B21B6)",
              border: "none", cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
            }}>
              📤 ייצוא MP4
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnimationPreviewPage() {
  return (
    <>
      <style>{`
        body { background: #070710 !important; }
        @keyframes chip-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes lottie-pop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.25) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes prog { from{width:0%} to{width:100%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes title-in { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hero-in  { from{opacity:0;transform:translateY(32px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes sub-pop        { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        @keyframes sub-pop-strong { 0%{transform:scale(0.2);opacity:0} 60%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
        @keyframes sub-bounce     { 0%{transform:translateY(30px);opacity:0} 60%{transform:translateY(-8px)} 100%{transform:translateY(0);opacity:1} }
        @keyframes sub-slide-up   { from{transform:translateY(28px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes sub-slide-left { from{transform:translateX(-40px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes sub-slide-right{ from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes sub-zoom-burst { 0%{transform:scale(2.2);opacity:0;filter:blur(6px)} 100%{transform:scale(1);opacity:1;filter:blur(0)} }
        @keyframes sub-wave       { 0%{transform:skewX(-12deg) scale(0.85);opacity:0} 50%{transform:skewX(5deg) scale(1.05)} 100%{transform:skewX(0) scale(1);opacity:1} }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#070710", color: "#fff", direction: "rtl" }}>

        {/* purple glow */}
        <div style={{ position: "fixed", top: "-15%", left: "50%", transform: "translateX(-50%)", width: 700, height: 450, background: "radial-gradient(ellipse,rgba(124,58,237,0.15) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <section style={{ padding: "5rem 3rem 4rem", maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>

          {/* badge */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem", animation: "title-in 0.6s ease both" }}>
            <span style={{ display: "inline-block", padding: "6px 18px", borderRadius: 100, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", color: "#a78bfa", fontSize: 13, fontWeight: 600 }}>
              ✨ עורך הוידאו החכם לתוכן ישראלי
            </span>
          </div>

          {/* headline */}
          <div style={{ textAlign: "center", marginBottom: "3rem", animation: "title-in 0.7s ease 0.1s both" }}>
            <h1 style={{ fontSize: "clamp(2rem,5vw,3.8rem)", fontWeight: 800, lineHeight: 1.15, fontFamily: "var(--font-heebo),system-ui,sans-serif", margin: 0 }}>
              מסרטון גולמי לריילס מוגמר
              <br />
              <span style={{ background: "linear-gradient(90deg,#7C3AED,#C084FC,#7C3AED 200%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                בלחיצה אחת — בעברית
              </span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, marginTop: "1rem", lineHeight: 1.7 }}>
              העלי וידאו. תקבלי כתוביות מסונכרנות, beat-drops, אייקונים ו-drama mode — אוטומטית.
            </p>
          </div>

          {/* browser mockup */}
          <div style={{ animation: "hero-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s both", padding: "0 3rem" }}>
            <BrowserHero />
          </div>
        </section>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "1rem 2rem 6rem", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", padding: "1rem 2.5rem", borderRadius: 16, background: "linear-gradient(135deg,#7C3AED,#5B21B6)", boxShadow: "0 0 50px rgba(124,58,237,0.4)", fontSize: 16, fontWeight: 700, cursor: "default" }}>
            🚀 הממשק הזה — בדיוק מה שמשתמשים רואים
          </div>
        </div>
      </div>
    </>
  );
}
