"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ─── subtitle cycle data ─── */
const SUBTITLE_CYCLE = [
  { text: "חייבים לראות את זה!", color: "#FFD700", anim: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both", icon: null },
  { text: "לא תאמינו כמה זה קל", color: "#7BE8FF", anim: "sub-bounce 500ms cubic-bezier(0.34,1.56,0.64,1) both", icon: null },
  { text: "אני לא מאמין שזה קרה!", color: "#fff", anim: "sub-slide-up 350ms ease-out both", icon: "🎭", drama: true },
  { text: "פצצה של פיצ'ר!", color: "#FF6B6B", anim: "sub-zoom-burst 350ms cubic-bezier(0.25,0.46,0.45,0.94) both", icon: null },
  { text: "וואו זה מטורף!", color: "#FFD700", anim: "sub-pop-strong 300ms cubic-bezier(0.34,1.56,0.64,1) both", icon: null, beat: true },
  { text: "קיבלתי פרס! מדהים", color: "#C3B1FF", anim: "sub-wave 500ms ease-in-out both", icon: "⭐" },
  { text: "קדימה נעשה היסטוריה", color: "#98FF98", anim: "sub-slide-left 350ms ease-out both", icon: null },
  { text: "אש! זה עובד לבד!", color: "#FFA040", anim: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both", icon: "🔥" },
];

const CHIPS = [
  { label: "כתוביות אוטומטיות", icon: "✍️", side: "right", delay: 0.3 },
  { label: "Beat-drop zoom", icon: "🎵", side: "right", delay: 0.7 },
  { label: "23 אייקוני Lottie", icon: "⭐", side: "right", delay: 1.1 },
  { label: "ייצוא FFmpeg מקצועי", icon: "🎬", side: "left", delay: 0.5 },
  { label: "Drama mode AI", icon: "🎭", side: "left", delay: 0.9 },
  { label: "רקעים דינמיים", icon: "✨", side: "left", delay: 1.3 },
];

const SUB_ANIMS_LIST = [
  { id: "pop", label: "פופ", emoji: "💥", css: "sub-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both", color: "#FFD700", text: "חייבים לראות!" },
  { id: "bounce", label: "באונס", emoji: "🏀", css: "sub-bounce 500ms cubic-bezier(0.34,1.56,0.64,1) both", color: "#7BE8FF", text: "לא תאמין!" },
  { id: "slide-up", label: "Slide up", emoji: "⬆️", css: "sub-slide-up 350ms ease-out both", color: "#98FF98", text: "רגע אחד..." },
  { id: "slide-left", label: "Slide left", emoji: "⬅️", css: "sub-slide-left 350ms ease-out both", color: "#FF9EFF", text: "קדימה נצא!" },
  { id: "zoom-burst", label: "Zoom burst", emoji: "🔭", css: "sub-zoom-burst 350ms cubic-bezier(0.25,0.46,0.45,0.94) both", color: "#FF6B6B", text: "פצצה!" },
  { id: "wave", label: "Wave", emoji: "🌊", css: "sub-wave 500ms ease-in-out both", color: "#C3B1FF", text: "כיף מטורף" },
  { id: "pop-strong", label: "פופ חזק", emoji: "💣", css: "sub-pop-strong 300ms cubic-bezier(0.34,1.56,0.64,1) both", color: "#FFA040", text: "אש!!!" },
  { id: "slide-right", label: "Slide right", emoji: "➡️", css: "sub-slide-right 350ms ease-out both", color: "#40FFD4", text: "עוד רגע!" },
];

/* ─── Browser hero mockup ─── */
function BrowserHero() {
  const [subIndex, setSubIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [beatZoom, setBeatZoom] = useState(false);
  const [dramaFlash, setDramaFlash] = useState(false);
  const [particles, setParticles] = useState<{ x: number; y: number; color: string }[]>([]);
  const [chips, setChipsVisible] = useState(false);
  const subRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setChipsVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const triggerParticles = useCallback(() => {
    const colors = ["#AFA9EC", "#FFD700", "#FF6B6B", "#7BE8FF", "#98FF98"];
    setParticles(Array.from({ length: 10 }, (_, i) => ({
      x: 15 + Math.round((i / 10) * 70),
      y: 30 + Math.round(Math.random() * 40),
      color: colors[i % colors.length],
    })));
    setTimeout(() => setParticles([]), 1200);
  }, []);

  useEffect(() => {
    const cycle = () => {
      setVisible(false);
      setTimeout(() => {
        setSubIndex(prev => {
          const next = (prev + 1) % SUBTITLE_CYCLE.length;
          const sub = SUBTITLE_CYCLE[next];
          if (sub.beat) {
            setBeatZoom(true);
            setTimeout(() => setBeatZoom(false), 700);
          }
          if (sub.drama) {
            setDramaFlash(true);
            setTimeout(() => setDramaFlash(false), 1200);
          }
          if (sub.icon === "⭐") triggerParticles();
          return next;
        });
        setVisible(true);
        setTimeout(() => {
          if (subRef.current) {
            const el = subRef.current;
            el.style.animation = "none";
            void el.offsetWidth;
            el.style.animation = SUBTITLE_CYCLE[(subIndex + 1) % SUBTITLE_CYCLE.length].anim;
          }
        }, 20);
      }, 200);
    };
    const id = setInterval(cycle, 2800);
    return () => clearInterval(id);
  }, [subIndex, triggerParticles]);

  const current = SUBTITLE_CYCLE[subIndex];

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 900, margin: "0 auto" }}>

      {/* floating chips RIGHT */}
      <div style={{ position: "absolute", right: -10, top: "12%", zIndex: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {CHIPS.filter(c => c.side === "right").map((chip, i) => (
          <div
            key={chip.label}
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100,
              padding: "7px 14px",
              fontSize: 12,
              color: "#fff",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 7,
              transform: chips ? "translateX(0)" : "translateX(60px)",
              opacity: chips ? 1 : 0,
              transition: `transform 0.6s cubic-bezier(0.22,1,0.36,1) ${chip.delay}s, opacity 0.5s ease ${chip.delay}s`,
              animation: chips ? `chip-float 3s ease-in-out ${i * 0.4}s infinite` : "none",
            }}
          >
            <span>{chip.icon}</span>
            <span style={{ opacity: 0.85 }}>{chip.label}</span>
          </div>
        ))}
      </div>

      {/* floating chips LEFT */}
      <div style={{ position: "absolute", left: -10, top: "20%", zIndex: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {CHIPS.filter(c => c.side === "left").map((chip, i) => (
          <div
            key={chip.label}
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100,
              padding: "7px 14px",
              fontSize: 12,
              color: "#fff",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 7,
              transform: chips ? "translateX(0)" : "translateX(-60px)",
              opacity: chips ? 1 : 0,
              transition: `transform 0.6s cubic-bezier(0.22,1,0.36,1) ${chip.delay}s, opacity 0.5s ease ${chip.delay}s`,
              animation: chips ? `chip-float 3.2s ease-in-out ${i * 0.5 + 0.2}s infinite` : "none",
            }}
          >
            <span>{chip.icon}</span>
            <span style={{ opacity: 0.85 }}>{chip.label}</span>
          </div>
        ))}
      </div>

      {/* browser frame */}
      <div style={{
        borderRadius: "14px 14px 10px 10px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
      }}>

        {/* browser chrome bar */}
        <div style={{
          background: "#1a1a2e",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840" }} />
          </div>
          <div style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            fontFamily: "monospace",
          }}>
            videomaster.app/editor
          </div>
        </div>

        {/* editor UI */}
        <div style={{ background: "#0d0d1a", display: "flex", height: 480 }}>

          {/* sidebar */}
          <div style={{
            width: 52,
            background: "#111128",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 16,
            gap: 20,
          }}>
            {["✂️","🎨","✍️","🎵","⚙️"].map((icon, i) => (
              <div key={i} style={{
                width: 36, height: 36, borderRadius: 8,
                background: i === 2 ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.04)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, cursor: "default",
                border: i === 2 ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
              }}>
                {icon}
              </div>
            ))}
          </div>

          {/* main area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

            {/* top toolbar */}
            <div style={{
              height: 40,
              background: "#111128",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 14px",
            }}>
              {["ייצוא","תבנית","פונט","אנימציה"].map((btn, i) => (
                <div key={i} style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "default",
                }}>
                  {btn}
                </div>
              ))}
              <div style={{ marginRight: "auto" }} />
              <div style={{
                padding: "4px 16px",
                borderRadius: 5,
                fontSize: 11,
                color: "#fff",
                background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                cursor: "default",
                fontWeight: 600,
              }}>
                ▶ ייצוא
              </div>
            </div>

            {/* video + right panel */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

              {/* video preview */}
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#070710",
                padding: 20,
                position: "relative",
              }}>
                {/* the video frame */}
                <div
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    aspectRatio: "16/9",
                    background: "linear-gradient(135deg, #1a1a3e 0%, #0d0d20 50%, #1a1030 100%)",
                    borderRadius: 8,
                    position: "relative",
                    overflow: "hidden",
                    transform: beatZoom ? "scale(1.05)" : "scale(1)",
                    filter: dramaFlash ? "grayscale(1) brightness(0.75)" : "grayscale(0) brightness(1)",
                    transition: "transform 0.25s ease, filter 0.3s ease",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {/* scanlines */}
                  <div style={{
                    position: "absolute", inset: 0, opacity: 0.04,
                    backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.5) 2px,rgba(255,255,255,0.5) 3px)",
                    pointerEvents: "none",
                  }} />

                  {/* fake person silhouette */}
                  <div style={{
                    position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                    width: "30%", height: "75%",
                    background: "linear-gradient(180deg, rgba(100,80,160,0.3), rgba(60,40,120,0.6))",
                    borderRadius: "60% 60% 0 0",
                    opacity: 0.5,
                  }} />

                  {/* particles */}
                  {particles.map((p, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      left: `${p.x}%`, top: `${p.y}%`,
                      width: 6, height: 6, borderRadius: "50%",
                      background: p.color,
                      animation: "particle-up 1.2s ease-out both",
                    }} />
                  ))}

                  {/* beat indicator */}
                  {beatZoom && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      background: "rgba(255,60,60,0.85)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 9,
                      color: "#fff",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}>
                      ● BEAT
                    </div>
                  )}

                  {/* drama badge */}
                  {dramaFlash && (
                    <div style={{
                      position: "absolute", top: 8, left: 8,
                      background: "rgba(0,0,0,0.7)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 9,
                      color: "#aaa",
                    }}>
                      🎬 DRAMA
                    </div>
                  )}

                  {/* lottie icon */}
                  {current.icon && visible && (
                    <span
                      ref={iconRef}
                      style={{
                        position: "absolute",
                        bottom: "28%",
                        right: "10%",
                        fontSize: 32,
                        display: "inline-block",
                        animation: "lottie-pop 450ms cubic-bezier(0.175,0.885,0.32,1.275) both",
                      }}
                    >
                      {current.icon}
                    </span>
                  )}

                  {/* subtitle */}
                  <div style={{
                    position: "absolute", bottom: "12%",
                    width: "100%", textAlign: "center",
                    padding: "0 12%",
                  }}>
                    {visible && (
                      <span
                        ref={subRef}
                        style={{
                          display: "inline-block",
                          fontSize: 20,
                          fontWeight: 800,
                          color: current.color,
                          textShadow: `0 0 24px ${current.color}88, 0 2px 8px rgba(0,0,0,0.9)`,
                          fontFamily: "var(--font-heebo), system-ui, sans-serif",
                          animation: current.anim,
                          lineHeight: 1.2,
                          background: "rgba(0,0,0,0.4)",
                          borderRadius: 6,
                          padding: "4px 12px",
                        }}
                      >
                        {current.text}
                      </span>
                    )}
                  </div>

                  {/* progress bar */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
                    background: "rgba(255,255,255,0.1)",
                  }}>
                    <div style={{
                      height: "100%",
                      background: "linear-gradient(90deg, #7C3AED, #C084FC)",
                      animation: "progress-bar 2.8s linear infinite",
                    }} />
                  </div>
                </div>
              </div>

              {/* right panel */}
              <div style={{
                width: 160,
                background: "#111128",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                padding: 12,
                overflowY: "auto",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  אנימציה
                </div>
                {["פופ 💥","באונס 🏀","Zoom burst","Slide up","Wave 🌊"].map((opt, i) => (
                  <div key={i} style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    color: i === 0 ? "#fff" : "rgba(255,255,255,0.45)",
                    background: i === 0 ? "rgba(124,58,237,0.3)" : "transparent",
                    border: i === 0 ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                    marginBottom: 3,
                    cursor: "default",
                  }}>
                    {opt}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "14px 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  אפקטים
                </div>
                {["Beat-drop ✓","Drama ✓","Lottie ✓"].map((opt, i) => (
                  <div key={i} style={{
                    padding: "5px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#98FF98",
                    background: "rgba(0,255,100,0.07)",
                    border: "1px solid rgba(0,255,100,0.15)",
                    marginBottom: 3,
                    cursor: "default",
                  }}>
                    {opt}
                  </div>
                ))}
              </div>
            </div>

            {/* timeline */}
            <div style={{
              height: 80,
              background: "#0d0d1a",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "8px 14px",
            }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>0:00 — 0:45</div>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {/* video track */}
                <div style={{
                  height: 28, flex: 1,
                  background: "linear-gradient(135deg, #1e1e4a, #2d1b69)",
                  borderRadius: 4,
                  border: "1px solid rgba(124,58,237,0.3)",
                  display: "flex", alignItems: "center", padding: "0 8px",
                  fontSize: 10, color: "rgba(255,255,255,0.5)",
                }}>
                  🎬 וידאו ראשי
                </div>
              </div>
              <div style={{ display: "flex", gap: 3, marginTop: 4, alignItems: "center" }}>
                {/* subtitle clips */}
                {[35, 22, 28, 18, 32].map((w, i) => (
                  <div key={i} style={{
                    height: 18,
                    width: `${w}%`,
                    background: i % 2 === 0 ? "rgba(255,215,0,0.15)" : "rgba(124,58,237,0.15)",
                    borderRadius: 3,
                    border: `1px solid ${i % 2 === 0 ? "rgba(255,215,0,0.3)" : "rgba(124,58,237,0.3)"}`,
                    fontSize: 9,
                    color: "rgba(255,255,255,0.35)",
                    display: "flex", alignItems: "center", padding: "0 4px",
                    overflow: "hidden", whiteSpace: "nowrap",
                  }}>
                    כתובית {i + 1}
                  </div>
                ))}
              </div>

              {/* playhead */}
              <div style={{
                position: "absolute",
                top: 0, bottom: 0,
                width: 2,
                background: "#7C3AED",
                animation: "playhead-move 2.8s linear infinite",
                boxShadow: "0 0 6px rgba(124,58,237,0.8)",
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── small subtitle demo card ─── */
function SubCard({ anim, index }: { anim: typeof SUB_ANIMS_LIST[0]; index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const play = () => {
      if (!ref.current) return;
      ref.current.style.animation = "none";
      void ref.current.offsetWidth;
      ref.current.style.animation = anim.css;
    };
    play();
    const id = setInterval(play, 2600 + index * 280);
    return () => clearInterval(id);
  }, [anim.css, index]);

  return (
    <div
      className="group relative overflow-hidden rounded-xl cursor-pointer"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      onClick={() => {
        if (!ref.current) return;
        ref.current.style.animation = "none";
        void ref.current.offsetWidth;
        ref.current.style.animation = anim.css;
      }}
    >
      <div style={{ height: 90, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.2) 3px,rgba(255,255,255,0.2) 4px)" }} />
        <span
          ref={ref}
          style={{ fontSize: 18, fontWeight: 700, color: anim.color, textShadow: `0 0 16px ${anim.color}88`, fontFamily: "var(--font-heebo), sans-serif", display: "inline-block", padding: "3px 10px" }}
        >
          {anim.text}
        </span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>{anim.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{anim.label}</span>
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>לחץ לחזרה</p>
      </div>
    </div>
  );
}

/* ─── main page ─── */
export default function AnimationPreviewPage() {
  return (
    <>
      <style>{`
        body { background: #070710 !important; }

        @keyframes chip-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes lottie-pop {
          0%  { transform: scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.25) rotate(5deg); opacity: 1; }
          100%{ transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes particle-up {
          0%   { transform: translateY(0) scale(0); opacity:0; }
          30%  { opacity:1; transform:translateY(-22px) scale(1); }
          100% { transform:translateY(-55px) scale(0.4); opacity:0; }
        }
        @keyframes progress-bar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes playhead-move {
          from { left: 14px; }
          to   { left: calc(100% - 14px); }
        }
        @keyframes title-in {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes hero-in {
          from { opacity:0; transform:translateY(40px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#070710", color: "#fff", direction: "rtl", overflow: "hidden" }}>

        {/* purple glow bg */}
        <div style={{
          position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: 800, height: 500,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        {/* ── HERO ── */}
        <section style={{ padding: "5rem 2rem 4rem", maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>

          {/* badge */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem", animation: "title-in 0.6s ease both" }}>
            <span style={{
              display: "inline-block", padding: "6px 18px", borderRadius: 100,
              background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
              color: "#a78bfa", fontSize: 13, fontWeight: 600,
            }}>
              ✨ עורך הוידאו החכם לתוכן ישראלי
            </span>
          </div>

          {/* headline */}
          <div style={{ textAlign: "center", marginBottom: "3rem", animation: "title-in 0.7s ease 0.1s both" }}>
            <h1 style={{
              fontSize: "clamp(2rem, 5vw, 3.8rem)",
              fontWeight: 800,
              lineHeight: 1.15,
              fontFamily: "var(--font-heebo), system-ui, sans-serif",
              margin: 0,
            }}>
              כתוביות, אנימציות ואפקטים
              <br />
              <span style={{ background: "linear-gradient(90deg, #7C3AED, #C084FC, #7C3AED 200%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                שנדלקים לבד — ב-AI
              </span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, marginTop: "1rem", lineHeight: 1.7 }}>
              העלה וידאו. קבל כתוביות מונפשות, beat-drops, אייקונים ו-drama mode — בלחיצה אחת.
            </p>
          </div>

          {/* browser mockup */}
          <div style={{ animation: "hero-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s both", padding: "0 4rem" }}>
            <BrowserHero />
          </div>
        </section>

        {/* ── subtitle cards ── */}
        <section style={{ padding: "4rem 2rem", maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 28 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: "0.12em", textTransform: "uppercase" }}>כתוביות</span>
            <h2 style={{ fontSize: "clamp(1.4rem,3vw,1.9rem)", fontWeight: 700, margin: "6px 0 4px", fontFamily: "var(--font-heebo), sans-serif" }}>8 אנימציות כניסה</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>CSS בתצוגה מקדימה • ASS override codes בייצוא FFmpeg</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px,1fr))", gap: 14 }}>
            {SUB_ANIMS_LIST.map((a, i) => <SubCard key={a.id} anim={a} index={i} />)}
          </div>
        </section>

        {/* ── CTA ── */}
        <div style={{ textAlign: "center", padding: "2rem 2rem 6rem", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-block", padding: "1rem 2.5rem", borderRadius: 16,
            background: "linear-gradient(135deg,#7C3AED,#5B21B6)",
            boxShadow: "0 0 50px rgba(124,58,237,0.4)",
            fontSize: 16, fontWeight: 700, cursor: "default",
          }}>
            🚀 כל הפיצ'רים האלה — בנויים ומוכנים ללאנדינג
          </div>
        </div>
      </div>
    </>
  );
}
