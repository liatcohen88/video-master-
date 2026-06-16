"use client";

import { useEffect, useState } from "react";

/* ─── subtitle lines matching the video ─── */
const SUBS = [
  { start: "0:00.00", dur: "0:00.80", text: "היי חברים" },
  { start: "0:00.80", dur: "0:01.10", text: "מי שעורך לי את" },
  { start: "0:01.90", dur: "0:00.90", text: "הסרטון הזה" },
  { start: "0:02.80", dur: "0:01.20", text: "זה מאסטר וידאו" },
];

const TEMPLATES = [
  { name: "Default", bg: "#1a1a2e", textColor: "rgba(255,255,255,0.7)", icon: null, active: false },
  { name: "פודקאסט ישראלי", bg: "linear-gradient(135deg,#c0392b,#e74c3c)", textColor: "#fff", icon: "🎙", active: false },
  { name: "Hormozi", bg: "linear-gradient(135deg,#e55c00,#ff8c00)", textColor: "#fff", icon: "🔥", active: false },
  { name: "Instagram מודרני", bg: "linear-gradient(135deg,#6c3483,#a855f7)", textColor: "#fff", icon: "💎", active: false },
  { name: "פודקאסט שקט", bg: "linear-gradient(135deg,#0d4f4f,#1a7a7a)", textColor: "#cff", icon: "🎙", active: false },
  { name: "TikTok Energy", bg: "linear-gradient(135deg,#4c1d95,#7c3aed)", textColor: "#fff", icon: "⚡", active: true },
];

const ANIMATIONS = [
  { name: "רעד דרמטי", icon: "🎸", desc: "MrHorse" },
  { name: "פאנץ׳ זום", icon: "🥊", desc: "MrBeast" },
  { name: "ללא", icon: "—", desc: "התחלה רגילה" },
  { name: "באוטם", icon: "🎸", desc: "overshoot" },
  { name: "וייפ פאן", icon: "🌪", desc: "blur" },
  { name: "זום סוחף", icon: "🌊", desc: "מתח" },
  { name: "סליידאפ", icon: "🚀", desc: "כלפי מעלה" },
  { name: "פתיחת אירועים", icon: "🎬", desc: "ממרכז" },
  { name: "פלאש לבן", icon: "⚡", desc: "הופיע" },
];

const CHIPS = [
  { label: "תמלול אוטמטי מותאם לעברית", icon: "✍️", side: "right", delay: 0.4 },
  { label: "אפקטי אנימציה",              icon: "🎬", side: "right", delay: 0.8 },
  { label: "סאונד אפקט ויראלי",          icon: "🎵", side: "right", delay: 1.2 },
  { label: "תבניות צבעים",               icon: "🎨", side: "left",  delay: 0.6 },
  { label: "עריכה אוטמטית",             icon: "✨", side: "left",  delay: 1.0 },
];

function BrowserMockup() {
  const [chipsIn, setChipsIn] = useState(false);
  const [activeRow, setActiveRow] = useState(2); // "בא ללמד" is active (idx 2)
  const [subtitleAnim, setSubtitleAnim] = useState(true);

  useEffect(() => {
    setTimeout(() => setChipsIn(true), 500);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSubtitleAnim(false);
      setTimeout(() => {
        setActiveRow(prev => (prev + 1) % SUBS.length);
        setSubtitleAnim(true);
      }, 150);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const activeSub = SUBS[activeRow];

  return (
    <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto" }}>

      {/* ── floating chips right ── */}
      <div style={{ position: "absolute", right: -16, top: "6%", zIndex: 20, display: "flex", flexDirection: "column", gap: 9 }}>
        {CHIPS.filter(c => c.side === "right").map((c, i) => (
          <div key={c.label} style={{
            background: "rgba(12,10,28,0.9)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.13)", borderRadius: 100,
            padding: "7px 15px", fontSize: 12, color: "#fff", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 7,
            transform: chipsIn ? "translateX(0)" : "translateX(80px)",
            opacity: chipsIn ? 1 : 0,
            transition: `transform 0.65s cubic-bezier(0.22,1,0.36,1) ${c.delay}s, opacity 0.5s ease ${c.delay}s`,
            animation: chipsIn ? `chip-float ${3 + i * 0.4}s ease-in-out ${i * 0.4}s infinite` : "none",
          }}>
            <span>{c.icon}</span><span style={{ opacity: 0.85 }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* ── floating chips left ── */}
      <div style={{ position: "absolute", left: -16, top: "12%", zIndex: 20, display: "flex", flexDirection: "column", gap: 9 }}>
        {CHIPS.filter(c => c.side === "left").map((c, i) => (
          <div key={c.label} style={{
            background: "rgba(12,10,28,0.9)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.13)", borderRadius: 100,
            padding: "7px 15px", fontSize: 12, color: "#fff", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 7,
            transform: chipsIn ? "translateX(0)" : "translateX(-80px)",
            opacity: chipsIn ? 1 : 0,
            transition: `transform 0.65s cubic-bezier(0.22,1,0.36,1) ${c.delay}s, opacity 0.5s ease ${c.delay}s`,
            animation: chipsIn ? `chip-float ${3.4 + i * 0.4}s ease-in-out ${i * 0.5 + 0.3}s infinite` : "none",
          }}>
            <span>{c.icon}</span><span style={{ opacity: 0.85 }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* ── browser chrome ── */}
      <div style={{
        borderRadius: "14px 14px 10px 10px", overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 50px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)",
      }}>

        {/* top bar */}
        <div style={{
          background: "#13132a", padding: "9px 14px",
          display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#FF5F57","#FEBC2E","#28C840"].map(c => (
              <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 2, marginRight: 6 }}>
            <div style={{ padding: "3px 14px", borderRadius: "6px 6px 0 0", background: "#0d0d20", fontSize: 11, color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid #0d0d20", display: "flex", alignItems: "center", gap: 5 }}>
              <img src="/logo.png" style={{ width: 13, height: 13, borderRadius: 3, objectFit: "contain" }} />
              מאסטר וידאו
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5, padding: "4px 12px", fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", fontFamily: "monospace" }}>
            master-video.co.il/
          </div>
        </div>

        {/* ── editor body: LTR flex so StylePanel left, video+subs right ── */}
        <div style={{ background: "#0d0d1f", display: "flex", height: 520, direction: "ltr" }}>

          {/* ══ LEFT: StylePanel (380px) ══ */}
          <div style={{ width: 320, background: "#111128", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

            {/* template gallery */}
            <div style={{ padding: "10px 10px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {TEMPLATES.map((t, i) => (
                  <div key={i} style={{
                    height: 46, borderRadius: 8,
                    background: t.bg,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: t.textColor, fontFamily: "var(--font-heebo),sans-serif",
                    border: t.active ? "2px solid #a78bfa" : "1px solid rgba(255,255,255,0.07)",
                    cursor: "default", position: "relative", gap: 1,
                    boxShadow: t.active ? "0 0 12px rgba(124,58,237,0.5)" : "none",
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
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-heebo),sans-serif" }}>סגנון כתוביות</span>
              <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "var(--font-heebo),sans-serif", display: "flex", alignItems: "center", gap: 4 }}>✨ Neon</span>
            </div>

            {/* AI tip */}
            <div style={{ margin: "0 10px 10px", padding: "8px 10px", background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.2)", borderRadius: 8, fontSize: 10, color: "rgba(255,220,100,0.85)", lineHeight: 1.5, fontFamily: "var(--font-heebo),sans-serif", direction: "rtl" }}>
              💡 <strong>תוספת אופציינלית</strong> — ה-AI לא מפעיל אותם אוטומטית. אפשר לבחור בכל אחד מהם, ולשלם רק עבור מה שנבחר.
            </div>

            {/* tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.07)", direction: "rtl" }}>
              {["כתוביות","סאונדים","לוגואים","צבע","אפקטים מיוחדים"].map((tab, i) => (
                <div key={tab} style={{
                  flex: i === 4 ? "none" : 1, padding: "7px 6px",
                  fontSize: 9.5, textAlign: "center", cursor: "default",
                  color: i === 4 ? "#fff" : "rgba(255,255,255,0.4)",
                  background: i === 4 ? "rgba(124,58,237,0.25)" : "transparent",
                  borderBottom: i === 4 ? "2px solid #7C3AED" : "2px solid transparent",
                  fontFamily: "var(--font-heebo),sans-serif",
                  whiteSpace: "nowrap", paddingLeft: 8, paddingRight: 8,
                }}>
                  {tab}
                </div>
              ))}
            </div>

            {/* effects panel content */}
            <div style={{ padding: "10px", flex: 1, direction: "rtl", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* aspect ratio */}
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 7, fontFamily: "var(--font-heebo),sans-serif" }}>יחס תצוגה</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["4:5","16:9","1:1","9:16","מקורי"].map(r => (
                    <div key={r} style={{
                      flex: 1, padding: "5px 2px", borderRadius: 6, textAlign: "center", fontSize: 9,
                      background: r === "16:9" ? "#7C3AED" : "rgba(255,255,255,0.06)",
                      color: r === "16:9" ? "#fff" : "rgba(255,255,255,0.45)",
                      border: r === "16:9" ? "none" : "1px solid rgba(255,255,255,0.08)",
                      fontFamily: "var(--font-heebo),sans-serif", cursor: "default",
                    }}>{r}</div>
                  ))}
                </div>
              </div>

              {/* crop focus */}
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 7, fontFamily: "var(--font-heebo),sans-serif" }}>מיקוד החיתוך</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["למטה","מרכז","למעלה"].map(opt => (
                    <div key={opt} style={{
                      flex: 1, padding: "6px 4px", borderRadius: 6, textAlign: "center", fontSize: 10,
                      background: opt === "מרכז" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      color: opt === "מרכז" ? "#a78bfa" : "rgba(255,255,255,0.45)",
                      border: opt === "מרכז" ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      fontFamily: "var(--font-heebo),sans-serif", cursor: "default",
                    }}>{opt}</div>
                  ))}
                </div>
              </div>

              {/* intro animation grid */}
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 7, display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-heebo),sans-serif" }}>
                  <span>✨</span> אנימציית כניסה לסרטון
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  {ANIMATIONS.map((a, i) => (
                    <div key={i} style={{
                      padding: "6px 4px", borderRadius: 7, textAlign: "center",
                      background: i === 1 ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      border: i === 1 ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      cursor: "default",
                    }}>
                      <div style={{ fontSize: 14, marginBottom: 2 }}>{a.icon}</div>
                      <div style={{ fontSize: 8.5, color: i === 1 ? "#c4b5fd" : "rgba(255,255,255,0.55)", fontFamily: "var(--font-heebo),sans-serif", lineHeight: 1.2 }}>{a.name}</div>
                      <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-heebo),sans-serif", marginTop: 1 }}>{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ══ RIGHT: portrait video (Reels 9:16) + subtitle list ══ */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0d0d1f" }}>

            {/* video preview — portrait Reels */}
            <div style={{ flex: "0 0 370px", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a18", padding: "12px 0 8px" }}>
              <div style={{ position: "relative", width: 185, height: 330, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
                <video
                  src="/showcase-woman.mp4"
                  autoPlay muted loop playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {/* progress bar */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.1)" }}>
                  <div style={{ width: "20%", height: "100%", background: "linear-gradient(90deg,#7C3AED,#e040fb)", animation: "prog 5s linear infinite" }} />
                </div>
              </div>
              {/* playback time below video */}
              <div style={{ position: "absolute", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "monospace", marginTop: 338 }}>0:01 / 0:05</div>
            </div>

            {/* subtitle editor */}
            <div style={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", direction: "rtl" }}>

              {/* subtitle editor header */}
              <div style={{ position: "sticky", top: 0, background: "#111128", zIndex: 2, borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-heebo),sans-serif" }}>עריכת כתוביות</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", cursor: "default" }}>⌃</span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-heebo),sans-serif" }}>6 כתוביות</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-heebo),sans-serif", marginTop: 2, lineHeight: 1.4 }}>
                  פותחים כדי לערוך טקסט, להוסיף אמוג׳ים, סאונדים ומיקום צדדים לכל שורה
                </div>
              </div>

              {/* subtitle rows */}
              <div style={{ padding: "6px 0" }}>
                {SUBS.map((s, i) => (
                  <div key={i}>
                    {/* subtitle row */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                      background: i === activeRow ? "rgba(124,58,237,0.12)" : "transparent",
                      borderRight: i === activeRow ? "2px solid #7C3AED" : "2px solid transparent",
                      transition: "all 0.3s ease",
                    }}>
                      {/* icons */}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {["🗑","✏️","😊","🔊"].map(ic => (
                          <span key={ic} style={{ fontSize: 10, opacity: 0.45, cursor: "default" }}>{ic}</span>
                        ))}
                      </div>
                      {/* timestamps */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                        <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{s.start}</span>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.18)", fontFamily: "monospace" }}>+ {s.dur}</span>
                      </div>
                      {/* text */}
                      <span style={{
                        flex: 1, fontSize: 12, fontFamily: "var(--font-heebo),sans-serif",
                        color: i === activeRow ? "#fff" : "rgba(255,255,255,0.6)",
                        fontWeight: i === activeRow ? 700 : 400,
                        textAlign: "right",
                      }}>{s.text}</span>
                    </div>

                    {/* add subtitle between */}
                    <div style={{ padding: "3px 12px" }}>
                      <div style={{
                        padding: "3px 10px", borderRadius: 5, textAlign: "center",
                        border: "1px dashed rgba(255,255,255,0.1)", fontSize: 9,
                        color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-heebo),sans-serif",
                        cursor: "default",
                      }}>+ הוסף כתובית</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        body { background: #070710 !important; margin: 0; }
        @keyframes chip-float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes title-in      { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hero-in       { from{opacity:0;transform:translateY(28px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes sub-pop       { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#070710", color: "#fff", direction: "rtl" }}>

        {/* purple glow */}
        <div style={{ position: "fixed", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 800, height: 500, background: "radial-gradient(ellipse,rgba(124,58,237,0.13) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <section style={{ padding: "4rem 5rem 3rem", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>

          {/* badge */}
          <div style={{ textAlign: "center", marginBottom: "1.4rem", animation: "title-in 0.6s ease both" }}>
            <span style={{ display: "inline-block", padding: "6px 18px", borderRadius: 100, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", color: "#a78bfa", fontSize: 13, fontWeight: 600 }}>
              ✨ עורך הוידאו החכם לתוכן ישראלי
            </span>
          </div>

          {/* headline */}
          <div style={{ textAlign: "center", marginBottom: "3rem", animation: "title-in 0.7s ease 0.1s both" }}>
            <h1 style={{ fontSize: "clamp(2rem,4.5vw,3.6rem)", fontWeight: 800, lineHeight: 1.15, fontFamily: "var(--font-heebo),system-ui,sans-serif", margin: 0 }}>
              מסרטון גולמי לריילס מוגמר
              <br />
              <span style={{ background: "linear-gradient(90deg,#7C3AED,#C084FC,#7C3AED 200%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                בלחיצה אחת — בעברית
              </span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 17, marginTop: "1rem", lineHeight: 1.7 }}>
              מעלים וידאו. מקבלים כתוביות מסונכרנות, beat-drops, אייקונים ו-drama mode — אוטומטית.
            </p>
          </div>

          {/* browser mockup */}
          <div style={{ animation: "hero-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s both" }}>
            <BrowserMockup />
          </div>
        </section>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "1rem 2rem 6rem", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", padding: "1rem 2.5rem", borderRadius: 16, background: "linear-gradient(135deg,#7C3AED,#5B21B6)", boxShadow: "0 0 50px rgba(124,58,237,0.4)", fontSize: 16, fontWeight: 700, cursor: "default", fontFamily: "var(--font-heebo),sans-serif" }}>
            🚀 הממשק הזה — בדיוק מה שמשתמשים רואים
          </div>
        </div>
      </div>
    </>
  );
}
