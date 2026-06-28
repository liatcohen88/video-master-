"use client";

import { useEffect, useRef, useState } from "react";

const SUBS = [
  { start: "0:00.00", dur: "0:00.80", text: "היי חברים" },
  { start: "0:00.80", dur: "0:01.10", text: "מי שעורך לי את" },
  { start: "0:01.90", dur: "0:00.90", text: "הסרטון הזה" },
  { start: "0:02.80", dur: "0:01.20", text: "זה מאסטר וידאו" },
];

const TEMPLATES = [
  { name: "Default",          bg: "#1a1a2e", textColor: "rgba(255,255,255,0.7)", icon: null,  active: false },
  { name: "פודקאסט ישראלי",   bg: "linear-gradient(135deg,#c0392b,#e74c3c)", textColor: "#fff", icon: "🎙", active: false },
  { name: "Hormozi",          bg: "linear-gradient(135deg,#e55c00,#ff8c00)", textColor: "#fff", icon: "🔥", active: false },
  { name: "Instagram מודרני", bg: "linear-gradient(135deg,#6c3483,#a855f7)", textColor: "#fff", icon: "💎", active: false },
  { name: "פודקאסט שקט",      bg: "linear-gradient(135deg,#0d4f4f,#1a7a7a)", textColor: "#cff", icon: "🎙", active: false },
  { name: "TikTok Energy",    bg: "linear-gradient(135deg,#4c1d95,#7c3aed)", textColor: "#fff", icon: "⚡", active: true },
];

const ANIMATIONS = [
  { name: "רעד דרמטי", icon: "🎸", desc: "דרמטי" },
  { name: "פאנץ׳ זום",  icon: "🥊", desc: "ויראלי" },
  { name: "ללא",        icon: "—",  desc: "התחלה רגילה" },
  { name: "באוטם",      icon: "🎸", desc: "overshoot" },
  { name: "וייפ פאן",   icon: "🌪", desc: "blur" },
  { name: "זום סוחף",   icon: "🌊", desc: "מתח" },
  { name: "סליידאפ",    icon: "🚀", desc: "כלפי מעלה" },
  { name: "פתיחת אירועים", icon: "🎬", desc: "ממרכז" },
  { name: "פלאש לבן",   icon: "⚡", desc: "הופיע" },
];

const CHIPS = [
  { label: "תמלול אוטמטי מותאם לעברית", icon: "✍️", side: "right", delay: 0.4 },
  { label: "אפקטי אנימציה",              icon: "🎬", side: "right", delay: 0.8 },
  { label: "סאונד אפקט ויראלי",          icon: "🎵", side: "right", delay: 1.2 },
  { label: "תבניות צבעים",               icon: "🎨", side: "left",  delay: 0.6 },
  { label: "עריכה אוטמטית",              icon: "✨", side: "left",  delay: 1.0 },
];

export default function HeroBrowserMockup() {
  const [chipsIn, setChipsIn]         = useState(false);
  const [activeRow, setActiveRow]     = useState(0);
  const videoRef                      = useRef<HTMLVideoElement>(null);

  useEffect(() => { setTimeout(() => setChipsIn(true), 400); }, []);

  // iOS Safari aggressively pauses muted-autoplay videos that are off-screen
  // or hidden behind cross-origin policies — the result on Liat's phone was
  // a frozen first frame. Defensive: call .play() on mount AND every time
  // the video scrolls back into view (IntersectionObserver), and swallow
  // the NotAllowedError that browsers throw before the first user gesture.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => { v.play().catch(() => {/* will retry on next gesture */}); };
    tryPlay();
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) tryPlay(); },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveRow(prev => (prev + 1) % SUBS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const chip = (c: typeof CHIPS[0], i: number) => (
    <div key={c.label} style={{
      background: "rgba(12,10,28,0.88)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.13)", borderRadius: 100,
      padding: "7px 15px", fontSize: 12, color: "#fff", whiteSpace: "nowrap",
      display: "flex", alignItems: "center", gap: 7,
      transform: chipsIn ? "translateX(0)" : c.side === "right" ? "translateX(80px)" : "translateX(-80px)",
      opacity: chipsIn ? 1 : 0,
      transition: `transform 0.65s cubic-bezier(0.22,1,0.36,1) ${c.delay}s, opacity 0.5s ease ${c.delay}s`,
      animation: chipsIn ? `hbm-chip-float ${3 + i * 0.4}s ease-in-out ${i * 0.4}s infinite` : "none",
    }}>
      <span>{c.icon}</span><span style={{ opacity: 0.85 }}>{c.label}</span>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes hbm-chip-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes hbm-prog { from{width:0%} to{width:100%} }
        @keyframes hbm-hero { from{opacity:0;transform:translateY(24px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        /* Mobile: stack the mock editor vertically (video on top, settings below) — the desktop side-by-side layout gets unreadable below ~640px. Also hide the floating chips since they sit outside the frame and collide with the page on narrow viewports. */
        @media (max-width: 768px) {
          .hbm-body { flex-direction: column-reverse !important; height: auto !important; }
          .hbm-left { width: 100% !important; border-right: none !important; border-top: 1px solid rgba(255,255,255,0.06) !important; }
          .hbm-video-wrap { flex: 0 0 auto !important; padding: 14px 0 10px !important; }
          .hbm-chips-side { display: none !important; }
        }
      `}</style>

      <div style={{ position: "relative", maxWidth: 1060, margin: "0 auto", animation: "hbm-hero 0.9s cubic-bezier(0.22,1,0.36,1) both" }}>

        {/* chips right */}
        <div className="hbm-chips-side" style={{ position: "absolute", right: -14, top: "8%", zIndex: 20, display: "flex", flexDirection: "column", gap: 9 }}>
          {CHIPS.filter(c => c.side === "right").map((c, i) => chip(c, i))}
        </div>

        {/* chips left */}
        <div className="hbm-chips-side" style={{ position: "absolute", left: -14, top: "14%", zIndex: 20, display: "flex", flexDirection: "column", gap: 9 }}>
          {CHIPS.filter(c => c.side === "left").map((c, i) => chip(c, i))}
        </div>

        {/* browser frame */}
        <div style={{
          borderRadius: "14px 14px 10px 10px", overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          {/* browser chrome */}
          <div style={{ background: "#13132a", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", gap: 5 }}>
              {["#FF5F57","#FEBC2E","#28C840"].map(c => (
                <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 2, marginRight: 6 }}>
              <div style={{ padding: "3px 14px", borderRadius: "6px 6px 0 0", background: "#0d0d20", fontSize: 11, color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid #0d0d20", display: "flex", alignItems: "center", gap: 5 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" style={{ width: 13, height: 13, borderRadius: 3, objectFit: "contain" }} />
                מאסטר וידאו
              </div>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5, padding: "4px 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", fontFamily: "monospace" }}>
              master-video.co.il/
            </div>
          </div>

          {/* editor body */}
          <div className="hbm-body" style={{ background: "#0d0d1f", display: "flex", height: 520, direction: "ltr" }}>

            {/* LEFT: StylePanel */}
            <div className="hbm-left" style={{ width: 300, background: "#111128", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

              {/* template gallery */}
              <div style={{ padding: "10px 10px 8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                  {TEMPLATES.map((t, i) => (
                    <div key={i} style={{
                      height: 44, borderRadius: 8, background: t.bg,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      fontSize: 10, color: t.textColor,
                      border: t.active ? "2px solid #a78bfa" : "1px solid rgba(255,255,255,0.07)",
                      cursor: "default", position: "relative", gap: 1,
                      boxShadow: t.active ? "0 0 12px rgba(124,58,237,0.5)" : "none",
                      fontFamily: "var(--font-heebo), sans-serif",
                    }}>
                      {t.icon && <span style={{ fontSize: 13 }}>{t.icon}</span>}
                      <span style={{ fontSize: 9, opacity: 0.9, maxWidth: "90%", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                      {t.active && <div style={{ position: "absolute", top: 3, left: 3, width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* style row */}
              <div style={{ padding: "0 10px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-heebo), sans-serif" }}>סגנון כתוביות</span>
                <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "var(--font-heebo), sans-serif" }}>✨ Neon</span>
              </div>

              {/* AI tip removed 2026-06-16 per Liat — matches the actual editor
                  (we removed the same banner there last build). */}

              {/* tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.07)", direction: "rtl" }}>
                {["כתוביות","סאונדים","לוגואים","צבע","אפקטים מיוחדים"].map((tab, i) => (
                  <div key={tab} style={{
                    flex: i === 4 ? "none" : 1, padding: "7px 5px",
                    fontSize: 9, textAlign: "center", cursor: "default",
                    color: i === 4 ? "#fff" : "rgba(255,255,255,0.4)",
                    background: i === 4 ? "rgba(124,58,237,0.25)" : "transparent",
                    borderBottom: i === 4 ? "2px solid #7C3AED" : "2px solid transparent",
                    fontFamily: "var(--font-heebo), sans-serif",
                    whiteSpace: "nowrap", paddingLeft: 7, paddingRight: 7,
                  }}>{tab}</div>
                ))}
              </div>

              {/* effects panel */}
              <div style={{ padding: "10px", flex: 1, direction: "rtl", display: "flex", flexDirection: "column", gap: 11 }}>
                {/* aspect ratio */}
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "var(--font-heebo), sans-serif" }}>יחס תצוגה</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["4:5","16:9","1:1","9:16","מקורי"].map(r => (
                      <div key={r} style={{
                        flex: 1, padding: "5px 2px", borderRadius: 6, textAlign: "center", fontSize: 9,
                        background: r === "9:16" ? "#7C3AED" : "rgba(255,255,255,0.06)",
                        color: r === "9:16" ? "#fff" : "rgba(255,255,255,0.45)",
                        border: r === "9:16" ? "none" : "1px solid rgba(255,255,255,0.08)",
                        fontFamily: "var(--font-heebo), sans-serif", cursor: "default",
                      }}>{r}</div>
                    ))}
                  </div>
                </div>
                {/* crop */}
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "var(--font-heebo), sans-serif" }}>מיקוד החיתוך</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["למטה","מרכז","למעלה"].map(opt => (
                      <div key={opt} style={{
                        flex: 1, padding: "6px 4px", borderRadius: 6, textAlign: "center", fontSize: 10,
                        background: opt === "מרכז" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                        color: opt === "מרכז" ? "#a78bfa" : "rgba(255,255,255,0.45)",
                        border: opt === "מרכז" ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.07)",
                        fontFamily: "var(--font-heebo), sans-serif", cursor: "default",
                      }}>{opt}</div>
                    ))}
                  </div>
                </div>
                {/* animations grid */}
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "var(--font-heebo), sans-serif" }}>✨ אנימציית כניסה לסרטון</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    {ANIMATIONS.map((a, i) => (
                      <div key={i} style={{
                        padding: "6px 4px", borderRadius: 7, textAlign: "center",
                        background: i === 1 ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                        border: i === 1 ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.07)",
                        cursor: "default",
                      }}>
                        <div style={{ fontSize: 13 }}>{a.icon}</div>
                        <div style={{ fontSize: 8, color: i === 1 ? "#c4b5fd" : "rgba(255,255,255,0.55)", fontFamily: "var(--font-heebo), sans-serif", lineHeight: 1.2 }}>{a.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: portrait video + subtitle list */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0d0d1f" }}>

              {/* portrait video */}
              <div className="hbm-video-wrap" style={{ flex: "0 0 370px", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a18", padding: "12px 0 8px", position: "relative" }}>
                <div style={{ position: "relative", width: 185, height: 330, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={videoRef}
                    src="/showcase-woman.mp4"
                    autoPlay muted loop playsInline preload="auto"
                    // disableRemotePlayback + disablePictureInPicture stop
                    // mobile browsers from pausing the loop when the user
                    // backgrounds AirPlay / PiP controls.
                    disableRemotePlayback
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {/* progress bar */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.1)" }}>
                    <div style={{ width: "20%", height: "100%", background: "linear-gradient(90deg,#7C3AED,#e040fb)", animation: "hbm-prog 5s linear infinite" }} />
                  </div>
                </div>
              </div>

              {/* subtitle editor */}
              <div style={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", direction: "rtl" }}>
                <div style={{ position: "sticky", top: 0, background: "#111128", zIndex: 2, borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "8px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-heebo), sans-serif" }}>עריכת כתוביות</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>⌃</span>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-heebo), sans-serif" }}>{SUBS.length} כתוביות</div>
                </div>
                <div style={{ padding: "4px 0" }}>
                  {SUBS.map((s, i) => (
                    <div key={i}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                        background: i === activeRow ? "rgba(124,58,237,0.12)" : "transparent",
                        borderRight: i === activeRow ? "2px solid #7C3AED" : "2px solid transparent",
                        transition: "all 0.3s ease",
                      }}>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {["🗑","✏️","😊","🔊"].map(ic => (
                            <span key={ic} style={{ fontSize: 10, opacity: 0.4, cursor: "default" }}>{ic}</span>
                          ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                          <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{s.start}</span>
                          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.18)", fontFamily: "monospace" }}>+{s.dur}</span>
                        </div>
                        <span style={{
                          flex: 1, fontSize: 12, fontFamily: "var(--font-heebo), sans-serif",
                          color: i === activeRow ? "#fff" : "rgba(255,255,255,0.55)",
                          fontWeight: i === activeRow ? 700 : 400, textAlign: "right",
                        }}>{s.text}</span>
                      </div>
                      <div style={{ padding: "2px 12px" }}>
                        <div style={{ padding: "3px 10px", borderRadius: 5, textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-heebo), sans-serif", cursor: "default" }}>
                          + הוסף כתובית
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
