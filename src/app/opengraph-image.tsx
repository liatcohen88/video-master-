import { ImageResponse } from "next/og";

/**
 * Generated social-share card (1200×630) — replaces the missing static
 * /og-image.png so WhatsApp/Facebook/Twitter previews aren't broken.
 *
 * Pure typography on the brand gradient — no Hebrew (next/og's default font
 * lacks Hebrew glyphs → would render boxes) and no external image fetch
 * (would fail at build), so it renders reliably on the self-hosted box.
 * Applies to every route via Next's file convention (root segment).
 */

export const runtime = "nodejs";
export const alt = "Master Video — AI video subtitles, effects & export";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6d28d9 0%, #9333ea 45%, #db2777 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* soft glow accents */}
        <div style={{ position: "absolute", top: -120, left: -80, width: 380, height: 380, borderRadius: 9999, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ position: "absolute", bottom: -140, right: -60, width: 420, height: 420, borderRadius: 9999, background: "rgba(0,0,0,0.12)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
          <div style={{ fontSize: 120 }}>🎬</div>
        </div>
        <div style={{ fontSize: 92, fontWeight: 900, letterSpacing: -3 }}>Master Video</div>
        <div style={{ fontSize: 38, opacity: 0.92, marginTop: 14, fontWeight: 600 }}>
          AI Video Subtitles · Effects · Export
        </div>
        <div style={{ fontSize: 26, opacity: 0.7, marginTop: 36, letterSpacing: 4 }}>
          master-video.co.il
        </div>
      </div>
    ),
    { ...size },
  );
}
