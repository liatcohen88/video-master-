"use client";

/**
 * MultiVideoMergeAnimation — real-video edition
 * ──────────────────────────────────────────────
 * Replaces the earlier Lottie build. Lottie can't embed actual video, so the
 * cards there read as plain rectangles. This version uses real <video> tags
 * inside each clip card, with the cinematic UI (play button, scrubber, REC
 * dot, duration pill) layered on top — so it's unmistakable that you're
 * looking at three video clips merging into a master.
 *
 * Choreography (5s loop, pure CSS @keyframes):
 *   0.0–0.4s  · BG + cyan glow + dot grid fade in
 *   0.4–1.0s  · 3 clip cards pop in (60ms stagger), real videos play in lupe
 *   1.0–1.3s  · cursor flies in from off-screen, anchors top-left of selection
 *   1.3–2.5s  · cursor drags a Figma-blue MARQUEE around all three clips
 *   2.5–2.7s  · cyan borders + 12 corner handles snap on (overshoot ease)
 *   2.85–3.4s · "3 selected" Figma-blue pill floats next to cursor
 *   3.4–4.0s  · all three cards glide toward the center, scaling down
 *   4.0–4.2s  · soft white-to-cyan flash at the merge point
 *   4.2–4.7s  · MASTER clip scales up — same video chrome, cyan glow stroke,
 *               "MASTER" tag in corner, full-fill scrubber
 *   4.7–5.0s  · hold, then loop
 *
 * Sources: each card pulls a clip from /public/clips/. By default we ship 3
 * color-graded segments of showcase-woman.mp4 (warm / cool / vibrant) so the
 * 3 cards LOOK like 3 different shoots. Drop clip1.mp4 / clip2.mp4 / clip3.mp4
 * into public/clips/ to swap in your own footage.
 */
import { useEffect, useRef } from "react";

type Orientation = "landscape" | "portrait";

type Props = {
  className?: string;
  orientation?: Orientation;
  /** Override which video files load into each card. */
  clipSrcs?: [string, string, string];
};

const DEFAULT_CLIPS: [string, string, string] = [
  "/clips/clip1.mp4",
  "/clips/clip2.mp4",
  "/clips/clip3.mp4",
];

export default function MultiVideoMergeAnimation({
  className,
  orientation = "portrait",
  clipSrcs = DEFAULT_CLIPS,
}: Props) {
  // Refs so we can poke the videos if a browser pauses them on tab background return
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([null, null, null]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        videoRefs.current.forEach((v) => v?.play().catch(() => {}));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const isPortrait = orientation === "portrait";

  return (
    <div
      className={className}
      style={{ aspectRatio: isPortrait ? "360 / 640" : "600 / 400" }}
      role="img"
      aria-label="הדמיה: עכבר תופס 3 סרטונים ומאחד אותם לסרטון אחד"
    >
      <div className={`mvm-root ${isPortrait ? "mvm-portrait" : "mvm-landscape"}`}>
        {/* Soft cyan radial glow + dot grid sit on the deep navy backdrop */}
        <div className="mvm-glow" aria-hidden />
        <div className="mvm-grid" aria-hidden />

        {/* THREE VIDEO CLIPS — positioned absolutely, each animated independently */}
        {[0, 1, 2].map((i) => (
          <div key={i} className={`mvm-clip mvm-clip-${i + 1}`}>
            {/* Real looping video — silent, autoplay, plays in-place on iOS */}
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              src={clipSrcs[i]}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="mvm-video"
            />
            {/* Cinematic chrome layered on top of the real video */}
            <div className="mvm-vignette-top" />
            <div className="mvm-vignette-bottom" />
            <div className="mvm-rec">
              <span className="mvm-rec-dot" />
              <span className="mvm-rec-bar" />
            </div>
            <div className="mvm-duration">
              <span className="mvm-duration-bar" />
            </div>
            <div className="mvm-play">
              <svg viewBox="0 0 24 24" width="8" height="8">
                <path d="M7 5v14l12-7L7 5z" fill="#fff" />
              </svg>
            </div>
            <div className="mvm-scrubber">
              <div className={`mvm-scrubber-fill mvm-scrubber-fill-${i + 1}`} />
              <div className={`mvm-scrubber-dot mvm-scrubber-dot-${i + 1}`} />
            </div>

            {/* Selection border (cyan) — same DOM node, just animates opacity */}
            <div className="mvm-sel-border" />

            {/* 4 corner handles */}
            {["tl", "tr", "br", "bl"].map((p) => (
              <span key={p} className={`mvm-handle mvm-handle-${p}`} />
            ))}
          </div>
        ))}

        {/* MARQUEE rectangle — Figma's drag-to-select pattern */}
        <div className="mvm-marquee" aria-hidden />

        {/* "3 selected" pill — appears briefly after selection snaps */}
        <div className="mvm-pill">
          <span className="mvm-pill-dot" />
          <span className="mvm-pill-bar mvm-pill-bar-a" />
          <span className="mvm-pill-bar mvm-pill-bar-b" />
        </div>

        {/* Morph flash — sudden bloom at merge point */}
        <div className="mvm-flash" aria-hidden />

        {/* MASTER clip — the merged hero result */}
        <div className="mvm-master">
          {/* Loop all three videos stacked, each fading in/out, behind the chrome.
              For simplicity & weight, we just play clip2 here (the cool one is
              the most cinematic on its own). Swap if you want. */}
          <video
            src={clipSrcs[1]}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="mvm-video"
          />
          <div className="mvm-vignette-top" />
          <div className="mvm-vignette-bottom" />
          <div className="mvm-master-tag">
            <span className="mvm-master-tag-bar" />
          </div>
          <div className="mvm-master-play">
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path d="M7 5v14l12-7L7 5z" fill="#0d99ff" />
            </svg>
          </div>
          <div className="mvm-master-scrubber">
            <div className="mvm-master-scrubber-fill" />
            <div className="mvm-master-scrubber-dot" />
          </div>
        </div>

        {/* CURSOR — Figma-style sharp arrow */}
        <div className="mvm-cursor">
          <svg viewBox="0 0 24 32" width="18" height="22">
            <path
              d="M2 2 L2 25 L9 19 L13 28 L17 26 L12.5 17.5 L22 17.5 Z"
              fill="#fff"
              stroke="#0a0a12"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* All animation + layout CSS lives in a single scoped <style> tag. */}
      <style jsx>{`
        .mvm-root {
          position: absolute;
          inset: 0;
          background: #0a0a12;
          border-radius: inherit;
          overflow: hidden;
          --blue: #0d99ff;
          --card-w: 22%;
          --card-h: 32%;
        }
        .mvm-portrait {
          --card-w: 26%;
          --card-h: 25%;
        }

        /* ── Background glow ────────────────────────────────────────────── */
        .mvm-glow {
          position: absolute;
          inset: 10% 10%;
          background: radial-gradient(
            circle at center,
            rgba(13, 153, 255, 0.35) 0%,
            rgba(13, 153, 255, 0.12) 35%,
            rgba(13, 153, 255, 0) 70%
          );
          filter: blur(20px);
          opacity: 0;
          animation: mvm-glow 5s ease-out infinite;
        }
        @keyframes mvm-glow {
          0%   { opacity: 0; transform: scale(0.7); }
          10%  { opacity: 0.6; }
          80%  { opacity: 0.6; transform: scale(0.85); }
          90%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.85; transform: scale(1); }
        }

        /* ── Dot grid (subtle Figma canvas feel) ────────────────────────── */
        .mvm-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            circle,
            #1a1a26 1px,
            transparent 1.2px
          );
          background-size: 22px 22px;
          opacity: 0;
          animation: mvm-fade-in 5s ease-out infinite;
        }
        @keyframes mvm-fade-in {
          0%   { opacity: 0; }
          10%  { opacity: 0.5; }
          85%  { opacity: 0.5; }
          95%  { opacity: 0.3; }
          100% { opacity: 0.3; }
        }

        /* ── Clip card base ─────────────────────────────────────────────── */
        .mvm-clip {
          position: absolute;
          width: var(--card-w);
          aspect-ratio: 9 / 16;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #2a2a3c;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          transform-origin: center;
          opacity: 0;
        }
        .mvm-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .mvm-vignette-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 35%;
          background: linear-gradient(to bottom, rgba(0,0,0,0.45), transparent);
          pointer-events: none;
        }
        .mvm-vignette-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40%;
          background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
          pointer-events: none;
        }

        /* REC indicator (top-left) */
        .mvm-rec {
          position: absolute;
          top: 7px;
          left: 7px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .mvm-rec-dot {
          width: 6px;
          height: 6px;
          background: #ef4444;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
          animation: mvm-pulse 1.4s ease-in-out infinite;
        }
        @keyframes mvm-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        .mvm-rec-bar {
          width: 14px;
          height: 2px;
          background: rgba(255, 255, 255, 0.85);
          border-radius: 1px;
        }

        /* Duration pill (top-right) */
        .mvm-duration {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 3px 5px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 3px;
          display: flex;
        }
        .mvm-duration-bar {
          width: 18px;
          height: 2px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 1px;
        }

        /* Play button — circular, centered */
        .mvm-play {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(4px);
          border: 1.2px solid rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 1.5px;
        }

        /* Scrubber (bottom) */
        .mvm-scrubber {
          position: absolute;
          left: 10%;
          right: 10%;
          bottom: 10px;
          height: 2px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 1px;
        }
        .mvm-scrubber-fill {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          border-radius: 1px;
          animation: mvm-scrub 2.6s linear infinite;
        }
        .mvm-scrubber-dot {
          position: absolute;
          top: 50%;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          border: 1.5px solid #fff;
          transform: translate(-50%, -50%);
          animation: mvm-scrub-dot 2.6s linear infinite;
        }
        @keyframes mvm-scrub {
          0%   { width: 5%; }
          100% { width: 85%; }
        }
        @keyframes mvm-scrub-dot {
          0%   { left: 5%; }
          100% { left: 85%; }
        }
        .mvm-scrubber-fill-1 { background: #fb923c; animation-delay: -0.4s; }
        .mvm-scrubber-dot-1  { background: #fb923c; animation-delay: -0.4s; }
        .mvm-scrubber-fill-2 { background: #22d3ee; animation-delay: -1.1s; }
        .mvm-scrubber-dot-2  { background: #22d3ee; animation-delay: -1.1s; }
        .mvm-scrubber-fill-3 { background: #a78bfa; animation-delay: -1.8s; }
        .mvm-scrubber-dot-3  { background: #a78bfa; animation-delay: -1.8s; }

        /* ── Selection border (cyan) — sits OVER the card during selected window */
        .mvm-sel-border {
          position: absolute;
          inset: -3px;
          border: 1.5px solid var(--blue);
          border-radius: 12px;
          opacity: 0;
          pointer-events: none;
          box-shadow: 0 0 0 1px rgba(13, 153, 255, 0.15);
          animation: mvm-sel-border 5s ease-out infinite;
        }
        @keyframes mvm-sel-border {
          0%, 52%  { opacity: 0; transform: scale(1.04); }
          55%      { opacity: 1; transform: scale(1); }
          78%      { opacity: 1; transform: scale(1); }
          82%      { opacity: 0; transform: scale(0.9); }
          100%     { opacity: 0; }
        }

        /* Selection handles (4 corners) */
        .mvm-handle {
          position: absolute;
          width: 7px;
          height: 7px;
          background: #fff;
          border: 1px solid var(--blue);
          border-radius: 1px;
          opacity: 0;
          animation: mvm-handle 5s ease-out infinite;
        }
        @keyframes mvm-handle {
          0%, 53%  { opacity: 0; transform: scale(0.4); }
          56%      { opacity: 1; transform: scale(1.15); }
          60%      { opacity: 1; transform: scale(1); }
          70%      { opacity: 1; transform: scale(1); }
          73%      { opacity: 0; }
          100%     { opacity: 0; }
        }
        .mvm-handle-tl { top: -4px; left: -4px; }
        .mvm-handle-tr { top: -4px; right: -4px; }
        .mvm-handle-br { bottom: -4px; right: -4px; }
        .mvm-handle-bl { bottom: -4px; left: -4px; }

        /* ── Per-clip layout + flight to center ─────────────────────────── */
        /* Portrait layout: 2 cards top, 1 bottom (triangle) */
        .mvm-portrait .mvm-clip-1 { left: 9%;  top: 14%; animation: mvm-clip-portrait-1 5s ease-out infinite; }
        .mvm-portrait .mvm-clip-2 { right: 9%; top: 14%; animation: mvm-clip-portrait-2 5s ease-out infinite; }
        .mvm-portrait .mvm-clip-3 { left: 37%; top: 58%; animation: mvm-clip-portrait-3 5s ease-out infinite; }

        @keyframes mvm-clip-portrait-1 {
          0%   { opacity: 0; transform: translate(0, 8px) scale(0.85); }
          12%  { opacity: 1; transform: translate(0, 0) scale(1); }
          70%  { opacity: 1; transform: translate(0, 0) scale(1); }
          82%  { opacity: 0.95; transform: translate(85%, 120%) scale(0.55); }
          84%  { opacity: 0; transform: translate(85%, 120%) scale(0.4); }
          100% { opacity: 0; transform: translate(85%, 120%) scale(0.4); }
        }
        @keyframes mvm-clip-portrait-2 {
          0%   { opacity: 0; transform: translate(0, 8px) scale(0.85); }
          14%  { opacity: 1; transform: translate(0, 0) scale(1); }
          70%  { opacity: 1; transform: translate(0, 0) scale(1); }
          82%  { opacity: 0.95; transform: translate(-85%, 120%) scale(0.55); }
          84%  { opacity: 0; transform: translate(-85%, 120%) scale(0.4); }
          100% { opacity: 0; transform: translate(-85%, 120%) scale(0.4); }
        }
        @keyframes mvm-clip-portrait-3 {
          0%   { opacity: 0; transform: translate(0, 8px) scale(0.85); }
          16%  { opacity: 1; transform: translate(0, 0) scale(1); }
          70%  { opacity: 1; transform: translate(0, 0) scale(1); }
          82%  { opacity: 0.95; transform: translate(0, -75%) scale(0.55); }
          84%  { opacity: 0; transform: translate(0, -75%) scale(0.4); }
          100% { opacity: 0; transform: translate(0, -75%) scale(0.4); }
        }

        /* Landscape layout: 3 cards in a row */
        .mvm-landscape .mvm-clip-1 { left: 12%; top: 25%; animation: mvm-clip-landscape-1 5s ease-out infinite; }
        .mvm-landscape .mvm-clip-2 { left: 39%; top: 25%; animation: mvm-clip-landscape-2 5s ease-out infinite; }
        .mvm-landscape .mvm-clip-3 { left: 66%; top: 25%; animation: mvm-clip-landscape-3 5s ease-out infinite; }

        @keyframes mvm-clip-landscape-1 {
          0%   { opacity: 0; transform: translate(0, 8px) scale(0.85); }
          12%  { opacity: 1; transform: translate(0, 0) scale(1); }
          70%  { opacity: 1; transform: translate(0, 0) scale(1); }
          82%  { opacity: 0.95; transform: translate(115%, 0) scale(0.55); }
          84%  { opacity: 0; transform: translate(115%, 0) scale(0.4); }
          100% { opacity: 0; transform: translate(115%, 0) scale(0.4); }
        }
        @keyframes mvm-clip-landscape-2 {
          0%   { opacity: 0; transform: translate(0, 8px) scale(0.85); }
          14%  { opacity: 1; transform: translate(0, 0) scale(1); }
          70%  { opacity: 1; transform: translate(0, 0) scale(1); }
          82%  { opacity: 0.95; transform: translate(0, 0) scale(0.55); }
          84%  { opacity: 0; transform: translate(0, 0) scale(0.4); }
          100% { opacity: 0; }
        }
        @keyframes mvm-clip-landscape-3 {
          0%   { opacity: 0; transform: translate(0, 8px) scale(0.85); }
          16%  { opacity: 1; transform: translate(0, 0) scale(1); }
          70%  { opacity: 1; transform: translate(0, 0) scale(1); }
          82%  { opacity: 0.95; transform: translate(-115%, 0) scale(0.55); }
          84%  { opacity: 0; transform: translate(-115%, 0) scale(0.4); }
          100% { opacity: 0; transform: translate(-115%, 0) scale(0.4); }
        }

        /* ── Marquee selection rectangle ────────────────────────────────── */
        .mvm-marquee {
          position: absolute;
          left: 5%;
          top: 8%;
          width: 0;
          height: 0;
          border: 1px solid var(--blue);
          background: rgba(13, 153, 255, 0.08);
          border-radius: 2px;
          opacity: 0;
          animation: mvm-marquee 5s linear infinite;
        }
        .mvm-portrait .mvm-marquee { left: 5%; top: 10%; }
        @keyframes mvm-marquee {
          0%, 25%  { opacity: 0; width: 0; height: 0; }
          26%      { opacity: 1; width: 0; height: 0; }
          50%      { opacity: 1; width: 90%; height: 78%; }
          53%      { opacity: 1; width: 90%; height: 78%; }
          55%      { opacity: 0; width: 90%; height: 78%; }
          100%     { opacity: 0; width: 0; height: 0; }
        }

        /* ── "3 selected" pill ──────────────────────────────────────────── */
        .mvm-pill {
          position: absolute;
          right: 4%;
          bottom: 6%;
          padding: 5px 12px;
          background: var(--blue);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          opacity: 0;
          transform: scale(0.7) translateY(8px);
          box-shadow: 0 4px 14px rgba(13, 153, 255, 0.45);
          animation: mvm-pill 5s ease-out infinite;
        }
        .mvm-pill-dot {
          width: 6px; height: 6px;
          background: #fff;
          border-radius: 50%;
        }
        .mvm-pill-bar {
          height: 2px;
          background: #fff;
          border-radius: 1px;
        }
        .mvm-pill-bar-a { width: 24px; opacity: 0.95; }
        .mvm-pill-bar-b { width: 16px; opacity: 0.7; }
        @keyframes mvm-pill {
          0%, 56%   { opacity: 0; transform: scale(0.7) translateY(8px); }
          60%       { opacity: 1; transform: scale(1.05) translateY(0); }
          63%       { opacity: 1; transform: scale(1) translateY(0); }
          70%       { opacity: 1; transform: scale(1) translateY(0); }
          74%       { opacity: 0; transform: scale(0.9) translateY(0); }
          100%      { opacity: 0; }
        }

        /* ── Morph flash ────────────────────────────────────────────────── */
        .mvm-flash {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 30%;
          aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.9) 0%,
            rgba(13, 153, 255, 0.5) 40%,
            transparent 70%
          );
          transform: translate(-50%, -50%) scale(0.4);
          opacity: 0;
          filter: blur(8px);
          animation: mvm-flash 5s ease-out infinite;
        }
        @keyframes mvm-flash {
          0%, 82%  { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          85%      { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          92%      { opacity: 0; transform: translate(-50%, -50%) scale(2); }
          100%     { opacity: 0; }
        }

        /* ── MASTER clip (hero result) ──────────────────────────────────── */
        .mvm-master {
          position: absolute;
          left: 50%;
          top: 50%;
          width: calc(var(--card-w) * 1.55);
          aspect-ratio: 9 / 16;
          border-radius: 14px;
          overflow: hidden;
          border: 2px solid var(--blue);
          box-shadow:
            0 0 0 1px rgba(13, 153, 255, 0.2),
            0 14px 40px rgba(13, 153, 255, 0.35),
            0 6px 18px rgba(0, 0, 0, 0.5);
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.5);
          animation: mvm-master 5s ease-out infinite;
        }
        @keyframes mvm-master {
          0%, 84%  { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          87%      { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
          92%      { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100%     { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .mvm-master .mvm-video {
          filter: saturate(1.1) contrast(1.05);
        }
        .mvm-master-tag {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 10px;
          background: var(--blue);
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(13, 153, 255, 0.5);
        }
        .mvm-master-tag-bar {
          display: block;
          width: 30px;
          height: 2px;
          background: #fff;
          border-radius: 1px;
        }
        .mvm-master-play {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 2px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
        .mvm-master-scrubber {
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: 12px;
          height: 3px;
          background: rgba(255, 255, 255, 0.35);
          border-radius: 1.5px;
        }
        .mvm-master-scrubber-fill {
          position: absolute;
          inset: 0;
          background: var(--blue);
          border-radius: 1.5px;
          box-shadow: 0 0 8px rgba(13, 153, 255, 0.7);
        }
        .mvm-master-scrubber-dot {
          position: absolute;
          right: 0;
          top: 50%;
          width: 9px;
          height: 9px;
          background: #fff;
          border: 2px solid var(--blue);
          border-radius: 50%;
          transform: translate(50%, -50%);
        }

        /* ── Cursor ─────────────────────────────────────────────────────── */
        .mvm-cursor {
          position: absolute;
          left: 0;
          top: 0;
          width: 18px;
          height: 22px;
          opacity: 0;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
          animation: mvm-cursor 5s ease-out infinite;
        }
        /* Portrait cursor path: enters top-right, moves to top-left of selection,
           drags down-right to bottom-right corner, then settles. */
        .mvm-portrait .mvm-cursor {
          animation-name: mvm-cursor-portrait;
        }
        @keyframes mvm-cursor-portrait {
          0%   { opacity: 0; left: 95%; top: -10%; }
          18%  { opacity: 0; left: 95%; top: -10%; }
          24%  { opacity: 1; left: 4%; top: 9%; }
          26%  { opacity: 1; left: 4%; top: 9%; }
          50%  { opacity: 1; left: 91%; top: 84%; }
          55%  { opacity: 1; left: 91%; top: 84%; }
          62%  { opacity: 1; left: 88%; top: 80%; }
          72%  { opacity: 1; left: 88%; top: 80%; }
          76%  { opacity: 0; left: 88%; top: 80%; }
          100% { opacity: 0; left: 88%; top: 80%; }
        }
        .mvm-landscape .mvm-cursor {
          animation-name: mvm-cursor-landscape;
        }
        @keyframes mvm-cursor-landscape {
          0%   { opacity: 0; left: 95%; top: -10%; }
          18%  { opacity: 0; left: 95%; top: -10%; }
          24%  { opacity: 1; left: 4%; top: 15%; }
          26%  { opacity: 1; left: 4%; top: 15%; }
          50%  { opacity: 1; left: 92%; top: 78%; }
          55%  { opacity: 1; left: 92%; top: 78%; }
          62%  { opacity: 1; left: 89%; top: 74%; }
          72%  { opacity: 1; left: 89%; top: 74%; }
          76%  { opacity: 0; left: 89%; top: 74%; }
          100% { opacity: 0; left: 89%; top: 74%; }
        }

        /* ── prefers-reduced-motion: tame the animations ────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .mvm-glow,
          .mvm-grid,
          .mvm-clip,
          .mvm-cursor,
          .mvm-marquee,
          .mvm-pill,
          .mvm-flash,
          .mvm-master,
          .mvm-sel-border,
          .mvm-handle,
          .mvm-scrubber-fill,
          .mvm-scrubber-dot,
          .mvm-rec-dot {
            animation-duration: 12s;
          }
        }
      `}</style>
    </div>
  );
}
