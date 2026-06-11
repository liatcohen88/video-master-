"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { Subtitle, SubtitleStyle, VideoEffects } from "@/lib/types";
import { ASPECT_RATIO_INFO } from "@/lib/types";
import { fontClassFor } from "@/lib/fonts";
import { resolveAnimation } from "@/lib/subtitleAnimations";
import { detectElements, type ElementEvent } from "@/lib/keywordElements";
import { detectBeatDrops, beatDropZoomAt } from "@/lib/wowEffects";
import { colorFilterCss } from "@/lib/colorFilters";
import { detectDramaMoments, dramaActiveAt, pickDramaSting } from "@/lib/dramaEffects";
import { introFrameAt } from "@/lib/introAnimations";
import { getSfxAsset, DEFAULT_SFX_FOR_KIND } from "@/lib/sfxLibrary";
import { playSfxCapped } from "@/lib/playSfxCapped";
import { detectBrands, brandLogoCdnUrl, type BrandEvent } from "@/lib/brandLogos";
import { DYNAMIC_BG_MAP } from "@/lib/dynamicBackgrounds";
import LottiePreviewOverlay from "./LottiePreviewOverlay";
import WowOverlay from "./WowOverlay";

type Props = {
  videoUrl: string;
  subtitles: Subtitle[];
  style: SubtitleStyle;
  effects?: VideoEffects;
  onTimeUpdate?: (t: number) => void;
};

export default function VideoPreview({
  videoUrl, subtitles, style, effects, onTimeUpdate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  // Natural aspect of the uploaded video (e.g. "9/16" for a vertical phone clip)
  const [naturalAspect, setNaturalAspect] = useState<string | null>(null);

  // ── SFX playback in live preview ─────────────────────────────────────────
  // Mirrors what the export pipeline does — same 4 trigger sources:
  // auto-detected keyword elements / manualEmojis / customLogos timed / Lottie.
  // Plays via HTMLAudioElement synced to currentTime so users can hear the
  // SFX before exporting. Re-arms on backward scrub.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !effects) return;

    type Trig = { time: number; url: string };
    const triggers: Trig[] = [];
    const disabled = new Set(effects.disabledElements ?? []);
    const sfxOverrides = effects.elementSfxOverrides ?? {};

    if (effects.contextualElements && effects.contextualSfx) {
      for (const ev of detectElements(subtitles)) {
        const key = `${ev.category.id}-${Math.round(ev.time * 10)}`;
        if (disabled.has(key)) continue;
        const ov = sfxOverrides[key];
        if (ov === "none") continue;
        const sfxId = ov ?? DEFAULT_SFX_FOR_KIND[ev.category.sfx];
        const url = getSfxAsset(sfxId)?.url;
        if (url) triggers.push({ time: ev.time, url });
      }
    }
    for (const sub of subtitles) {
      // Subtitle-level SFX (no emoji/Lottie needed) — fires once at start
      if (sub.sfxId && sub.sfxId !== "none") {
        const url = getSfxAsset(sub.sfxId)?.url;
        if (url) triggers.push({ time: sub.start, url });
      }
      for (const em of sub.manualEmojis ?? []) {
        if (!em.sfxId || em.sfxId === "none") continue;
        const url = getSfxAsset(em.sfxId)?.url;
        if (url) triggers.push({ time: sub.start, url });
      }
    }
    for (const lot of effects.lottieElements ?? []) {
      if (!lot.sfxId || lot.sfxId === "none") continue;
      const url = getSfxAsset(lot.sfxId)?.url;
      if (url) triggers.push({ time: lot.time, url });
    }
    for (const logo of effects.customLogos ?? []) {
      if (logo.persistent !== false || typeof logo.time !== "number") continue;
      if (!logo.sfxId || logo.sfxId === "none") continue;
      const url = getSfxAsset(logo.sfxId)?.url;
      if (url) triggers.push({ time: logo.time, url });
    }
    if (triggers.length === 0) return;
    triggers.sort((a, b) => a.time - b.time);

    // Per-trigger live handle from playSfxCapped — lets us stop a still-
    // playing instance before re-firing on a seek-back, and guarantees the
    // 3.5s cap + fade-out (no more 10-second loops drowning out the video).
    const handles = new Map<number, { stop: () => void }>();
    const played = new Set<number>();
    let lastTime = v.currentTime;

    const onTime = () => {
      const t = v.currentTime;
      if (t < lastTime - 0.4) {
        // Backward scrub → re-arm everything and stop anything mid-play.
        played.clear();
        handles.forEach((h) => h.stop());
        handles.clear();
      }
      lastTime = t;
      if (v.paused) return;
      triggers.forEach((trig, i) => {
        if (played.has(i)) return;
        if (t >= trig.time && t < trig.time + 0.3) {
          // Stop any prior handle for this index (re-arm path) and start
          // a fresh capped play.
          handles.get(i)?.stop();
          handles.set(i, playSfxCapped(trig.url, 0.6 * (effects?.sfxMasterVolume ?? 1)));
          played.add(i);
        }
      });
    };
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      handles.forEach((h) => h.stop());
      handles.clear();
    };
  }, [
    subtitles,
    effects?.contextualElements,
    effects?.contextualSfx,
    effects?.disabledElements,
    effects?.elementSfxOverrides,
    effects?.lottieElements,
    effects?.customLogos,
    effects,
  ]);

  useEffect(() => {
    const v = videoRef.current;
    const c = containerRef.current;
    if (!v || !c) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      onTimeUpdate?.(v.currentTime);
    };
    const onMeta = () => {
      setDuration(v.duration || 0);
      if (v.videoWidth && v.videoHeight) {
        setNaturalAspect(`${v.videoWidth} / ${v.videoHeight}`);
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    const ro = new ResizeObserver(() => setContainerHeight(c.clientHeight));
    ro.observe(c);
    setContainerHeight(c.clientHeight);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      ro.disconnect();
    };
  }, [onTimeUpdate]);

  // --- Background music — mirrors video play/pause/seek/volume ----------
  // The user uploads a track (URL stored as object-URL in effects.bgMusicUrl).
  // We mount a hidden <audio> and shadow the video's transport so the BG
  // music stays in lockstep with playback. Two independent volume sliders:
  // videoVolume for the video's own audio, bgMusicVolume for the bed.
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Always apply the video's own-audio volume
    v.volume = Math.max(0, Math.min(1, effects?.videoVolume ?? 1));
    const a = bgAudioRef.current;
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, effects?.bgMusicVolume ?? 0.25));
  }, [effects?.videoVolume, effects?.bgMusicVolume, effects?.bgMusicUrl]);

  useEffect(() => {
    const v = videoRef.current;
    const a = bgAudioRef.current;
    if (!v || !a || !effects?.bgMusicUrl) return;
    const sync = () => {
      // Keep BG music in time with the video. Allow ~0.15s drift before a
      // hard seek (browsers stutter if we re-seek every frame).
      if (Math.abs(a.currentTime - v.currentTime) > 0.15) {
        try { a.currentTime = v.currentTime; } catch {/* noop */}
      }
    };
    const onPlay  = () => { sync(); a.play().catch(() => {}); };
    const onPause = () => { a.pause(); };
    const onSeek  = () => { sync(); };
    const onEnded = () => { a.pause(); a.currentTime = 0; };
    v.addEventListener("play",  onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeek);
    v.addEventListener("ended", onEnded);
    // If the video is already playing when this mounts, kick BG.
    if (!v.paused) onPlay();
    return () => {
      v.removeEventListener("play",  onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeek);
      v.removeEventListener("ended", onEnded);
      a.pause();
    };
  }, [effects?.bgMusicUrl]);

  // --- Silence skip during playback --------------------------------------
  // Compute "silent gaps" = stretches with no subtitle that exceed the
  // configured minimum silence duration. When playback enters a gap, jump
  // to its end. Approximates what FFmpeg silenceremove will do at export.
  const silentGaps = useMemo(() => {
    if (!effects?.cutSilence || subtitles.length === 0) return [];
    const minDur = effects.silenceMinDurationSec;
    const gaps: Array<{ start: number; end: number }> = [];
    const sorted = [...subtitles].sort((a, b) => a.start - b.start);
    // Gap from 0 → first subtitle
    if (sorted[0].start > minDur) {
      gaps.push({ start: 0, end: sorted[0].start - 0.1 });
    }
    // Gaps between consecutive subtitles
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapDur = sorted[i + 1].start - sorted[i].end;
      if (gapDur > minDur) {
        gaps.push({ start: sorted[i].end, end: sorted[i + 1].start - 0.1 });
      }
    }
    return gaps;
  }, [subtitles, effects?.cutSilence, effects?.silenceMinDurationSec]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || silentGaps.length === 0) return;
    const handler = () => {
      const t = v.currentTime;
      const gap = silentGaps.find((g) => t >= g.start + 0.05 && t < g.end);
      if (gap) v.currentTime = gap.end;
    };
    v.addEventListener("timeupdate", handler);
    return () => v.removeEventListener("timeupdate", handler);
  }, [silentGaps]);

  // --- Aspect-ratio / crop ----------------------------------------------
  const aspectRatio = effects?.aspectRatio ?? "original";
  const target = ASPECT_RATIO_INFO[aspectRatio];
  const hasAspect = target.width !== null && target.height !== null;
  const ratioStr = hasAspect ? `${target.width} / ${target.height}` : undefined;

  const objectPosition = (() => {
    if (!hasAspect) return "center";
    if (
      effects?.faceCenterX !== undefined &&
      effects?.faceCenterY !== undefined
    ) {
      const x = Math.round(effects.faceCenterX * 100);
      const y = Math.round(effects.faceCenterY * 100);
      return `${x}% ${y}%`;
    }
    if (effects?.cropFocus === "top") return "center top";
    if (effects?.cropFocus === "bottom") return "center bottom";
    return "center center";
  })();

  // No artificial framing zoom — the export crops only to hit the target
  // aspect (centered on the face). Preview just uses object-fit:cover +
  // object-position so the same region is shown. Keeping scale at 1 here
  // matches that exactly.
  const smartFramingScale = 1;
  const smartFramingOrigin = "center center";

  // --- Beat-Drop Zoom (wow) — detected once per subtitle change ---------
  const beatDrops = useMemo(
    () => effects?.beatDropZoom ? detectBeatDrops(subtitles) : [],
    [effects?.beatDropZoom, subtitles],
  );

  // --- Drama Mode — B&W flash + sting on "אני לא מאמין" lines ----------
  const dramaMoments = useMemo(
    () => effects?.dramaMode ? detectDramaMoments(subtitles) : [],
    [effects?.dramaMode, subtitles],
  );
  const activeDrama = effects?.dramaMode ? dramaActiveAt(currentTime, dramaMoments) : null;

  // --- Intro animation — first ~0.5-0.9s of the video ------------------
  // Architecture decision: the intro animation lives on a SEPARATE wrapper
  // div around the video. React keeps writing zoom/pan transform on the
  // video element. The wrapper handles intro scale/translate/rotate via
  // direct DOM (rAF loop) — no React re-render, no fighting transforms.
  // GPU composes them naturally (parent scale × child scale).
  //
  // Why this design:
  //  - timeupdate is 4-66Hz (choppy). rAF is 60Hz (smooth).
  //  - React state inside rAF would re-render this entire heavy component
  //    every frame → stutter from JS work, not from the animation itself.
  //  - Direct DOM writes on a dedicated wrapper cost ~0ms and isolate the
  //    animation from React's render cycle.
  //  - On animation pick: rewind to 0 + play so the user actually sees
  //    what they chose ("שיתחיל את הסרטון מהתחלה").
  const introWrapperRef = useRef<HTMLDivElement>(null);
  const introOverlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    const wrapper = introWrapperRef.current;
    const overlay = introOverlayRef.current;
    const id = effects?.introAnimation;
    if (!v || !wrapper) return;

    // Wipe any stale intro state from a previous selection.
    wrapper.style.transform = "";
    wrapper.style.transformOrigin = "center center";
    v.style.removeProperty("clip-path");
    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.background = "transparent";
    }

    if (!id || id === "none") return;

    // Rewind + play so the user sees the intro from frame 0.
    try {
      v.currentTime = 0;
      v.play().catch(() => {});
    } catch { /* ignore */ }

    // Intro SFX — fire ONCE at the start, alongside the visual animation.
    // Capped at 3.5s like all other SFX in the editor for consistency.
    if (effects?.introSfxId && effects.introSfxId !== "none") {
      const url = getSfxAsset(effects.introSfxId)?.url;
      if (url) {
        playSfxCapped(url, 0.85 * (effects?.sfxMasterVolume ?? 1));
      }
    }

    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const t = v.currentTime;
      const f = introFrameAt(t, id);

      // Apply transform to the wrapper (NOT the video). Composes via GPU
      // with the React-written transform on the video element.
      wrapper.style.transform = `scale(${f.scaleMul}) translate(${f.translateX}%, ${f.translateY}%) rotate(${f.rotate}deg)`;
      wrapper.style.opacity = String(f.opacity);
      if (f.clipPath) v.style.clipPath = f.clipPath;
      else v.style.removeProperty("clip-path");

      if (overlay) {
        if (f.overlayBg && (f.overlayOpacity ?? 0) > 0) {
          overlay.style.background = f.overlayBg;
          overlay.style.opacity = String(f.overlayOpacity);
        } else {
          overlay.style.opacity = "0";
        }
      }

      const stillRunning = t < 1.2;
      if (stillRunning) raf = requestAnimationFrame(tick);
      else {
        // Reset to passthrough after intro ends.
        wrapper.style.transform = "";
        wrapper.style.opacity = "1";
        v.style.removeProperty("clip-path");
        if (overlay) overlay.style.opacity = "0";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [effects?.introAnimation, effects?.introSfxId, videoUrl]);

  // Drama Mode is now VISUAL ONLY (B&W flash). The auto-sting was removed
  // 2026-06-11 — every sting we tried was either too long ("אותו סאונד 5
  // שניות") or repeated unpredictably. Better UX: let the user attach their
  // own SFX per subtitle via the 🔊 button on each subtitle row. That gives
  // creative control, no surprises.
  //
  // The visual side (grayscale filter via dramaActiveAt) stays — that's the
  // good part of the trope and it costs zero CPU.

  // --- Zoom / Ken Burns / Punch -----------------------------------------
  const progress = duration > 0 ? currentTime / duration : 0;
  const zoomScale = useMemo(() => {
    // Always add beat-drop pulses on top, even when zoomEffect is "none" —
    // the wow feature stands on its own.
    const beat = beatDropZoomAt(currentTime, beatDrops);
    if (!effects || effects.zoomEffect === "none") return 1 + beat;

    if (effects.zoomEffect === "punch") {
      // Match the FFmpeg punch zoom curve: ramp-in (150ms) → hold (400ms)
      // → ramp-out (300ms) around each emphasis moment.
      const moments = effects.emphasisMoments ?? [];
      const rampIn = 0.15, hold = 0.4, rampOut = 0.3;
      const t = currentTime;
      const peak = effects.zoomIntensity;
      let add = 0;
      for (const m of moments) {
        if (t >= m - rampIn && t < m) add += peak * (t - (m - rampIn)) / rampIn;
        else if (t >= m && t < m + hold) add += peak;
        else if (t >= m + hold && t < m + hold + rampOut) add += peak * ((m + hold + rampOut) - t) / rampOut;
      }
      return 1 + add + beat;
    }

    return 1 + effects.zoomIntensity * progress + beat;
  }, [effects, progress, currentTime, beatDrops]);

  const panX = useMemo(() => {
    if (effects?.zoomEffect !== "kenburns") return 0;
    return Math.sin(progress * Math.PI) * 4; // percent
  }, [effects?.zoomEffect, progress]);

  const panY = useMemo(() => {
    if (effects?.zoomEffect !== "kenburns") return 0;
    return Math.cos(progress * Math.PI) * 2;
  }, [effects?.zoomEffect, progress]);

  // --- Subtitle scaling ------------------------------------------------
  // Style numbers are designed for 1080p; scale to container size
  const subtitleScale = containerHeight > 0 ? containerHeight / 1080 : 0.5;

  const currentSubtitleIndex = subtitles.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end,
  );
  const currentSubtitle = currentSubtitleIndex >= 0 ? subtitles[currentSubtitleIndex] : undefined;

  // Whip-flash overlay: brief white flash at each cut boundary in preview.
  // Mirrors what FFmpeg does in export (whip-zoom at cut points).
  const [whipFlashKey, setWhipFlashKey] = useState<number | null>(null);
  useEffect(() => {
    if (silentGaps.length === 0) return;
    const flash = silentGaps.find(
      (g) => currentTime >= g.end && currentTime < g.end + 0.05,
    );
    if (flash) setWhipFlashKey(Math.round(flash.end * 100));
  }, [currentTime, silentGaps]);

  // Emphasis glow: warm pulse at each emphasis moment.
  // Mirrors FFmpeg eq color flash in cinematicColorFilter.
  const [emphasisGlowKey, setEmphasisGlowKey] = useState<number | null>(null);
  useEffect(() => {
    const moments = effects?.emphasisMoments;
    if (!moments || moments.length === 0) return;
    const m = moments.find(
      (t) => currentTime >= t && currentTime < t + 0.05,
    );
    if (m !== undefined) setEmphasisGlowKey(Math.round(m * 100));
  }, [currentTime, effects?.emphasisMoments]);

  // Contextual elements: detect from subtitles, show as floating emoji.
  // Apply user emoji/position overrides + drop disabled ones.
  const elements = useMemo<ElementEvent[]>(() => {
    const auto: ElementEvent[] = effects?.contextualElements
      ? detectElements(subtitles)
      : [];
    const overrides = effects?.elementOverrides ?? {};
    const posOverrides = effects?.elementPositionOverrides ?? {};
    const disabled = new Set(effects?.disabledElements ?? []);
    const autoWithOverrides = auto
      .filter((e) => !disabled.has(`${e.category.id}-${Math.round(e.time * 10)}`))
      .map((e) => {
        const key = `${e.category.id}-${Math.round(e.time * 10)}`;
        const newCat = { ...e.category };
        if (overrides[key]) newCat.emoji = overrides[key];
        if (posOverrides[key]) newCat.position = posOverrides[key];
        return { ...e, category: newCat };
      });

    // Manual emojis added by the user in the subtitle editor.
    // SKIP lottie-type entries — they render via LottiePreviewOverlay below.
    const manual: ElementEvent[] = [];
    for (const sub of subtitles) {
      if (!sub.manualEmojis) continue;
      for (const me of sub.manualEmojis) {
        if (me.lottieIconId) continue; // lottie path handled separately
        manual.push({
          time: sub.start,
          durationSec: me.durationSec ?? Math.max(0.6, sub.end - sub.start),
          matchedText: "",
          category: {
            id: `manual-${sub.id}-${me.emoji}`,
            emoji: me.emoji,
            sfx: "ding",
            patterns: [],
            position: me.position,
            previewBg: "from-fuchsia-500 to-purple-700",
          },
        });
      }
    }

    return [...autoWithOverrides, ...manual];
  }, [
    subtitles,
    effects?.contextualElements,
    effects?.elementOverrides,
    effects?.elementPositionOverrides,
    effects?.disabledElements,
  ]);

  // Which elements are currently on-screen?
  const visibleElements = useMemo(
    () => elements.filter(
      (el) => currentTime >= el.time && currentTime < el.time + el.durationSec,
    ),
    [elements, currentTime],
  );

  // Brand logos — detected from subtitles. Requires BOTH contextualElements
  // (the global auto-add toggle) AND the explicit brand-logo flag. The flag
  // defaults to ON (undefined treated as true for back-compat with old
  // projects), but Liat can flip it off independently if she only wants
  // emoji elements without brand badges.
  const brands = useMemo<BrandEvent[]>(() => {
    if (!effects?.contextualElements) return [];
    if (effects.brandLogosDetect === false) return [];
    return detectBrands(subtitles);
  }, [subtitles, effects?.contextualElements, effects?.brandLogosDetect]);

  const visibleBrands = useMemo(
    () => brands.filter(
      (b) => currentTime >= b.time && currentTime < b.time + b.durationSec,
    ),
    [brands, currentTime],
  );

  // Container aspect: use the chosen target ratio if cropping, otherwise the
  // video's OWN natural aspect (so a vertical phone clip shows tall, not
  // letterboxed inside a wide 16:9 box).
  const effectiveRatio = hasAspect ? ratioStr : (naturalAspect ?? undefined);
  const containerStyle: React.CSSProperties = effectiveRatio
    ? {
        aspectRatio: effectiveRatio,
        maxHeight: "70vh",
        maxWidth: "100%",
        margin: "0 auto",
      }
    : {};

  return (
    <div className="space-y-3">
      {(effects && (effects.aspectRatio !== "original" || effects.zoomEffect !== "none" || effects.cutSilence)) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/40 font-medium">חל על הסרטון:</span>
          {effects.aspectRatio !== "original" && (
            <span className="px-2 py-1 bg-white/10 text-white/70 rounded-full">
              חיתוך {effects.aspectRatio}
            </span>
          )}
          {effects.zoomEffect !== "none" && (
            <span className="px-2 py-1 bg-white/10 text-white/70 rounded-full">
              {effects.zoomEffect === "subtle" ? "זום עדין" : "Ken Burns"} ({Math.round(zoomScale * 100)}%)
            </span>
          )}
          {effects.cutSilence && silentGaps.length > 0 && (
            <span className="px-2 py-1 bg-white/10 text-white/70 rounded-full">
              ✂️ דילוג {silentGaps.length} שתיקות
            </span>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden bg-black border border-white/10"
        style={containerStyle}
      >
        {/* Dynamic background pattern — visible only when depth mode is on
            AND a non-original pattern is selected. Mirrors what FFmpeg
            generates in the burned MP4. */}
        {effects?.backgroundDepth &&
          effects?.backgroundPattern &&
          effects.backgroundPattern !== "original" &&
          DYNAMIC_BG_MAP[effects.backgroundPattern] && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: DYNAMIC_BG_MAP[effects.backgroundPattern].cssBackground,
                animation:
                  DYNAMIC_BG_MAP[effects.backgroundPattern].cssAnimation === "none"
                    ? undefined
                    : DYNAMIC_BG_MAP[effects.backgroundPattern].cssAnimation,
                zIndex: 0,
              }}
            />
          )}
        {/* Intro wrapper — receives scale/translate/rotate/opacity from the
            rAF loop (direct DOM, no React re-render). The video inside keeps
            its own zoom/pan from React render. GPU composes them. */}
        <div
          ref={introWrapperRef}
          className="w-full h-full"
          style={{ transformOrigin: "center center", willChange: "transform, opacity" }}
        >
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="block w-full h-full"
          style={{
            objectFit: hasAspect ? "cover" : "contain",
            objectPosition,
            transform: `scale(${zoomScale * smartFramingScale}) translate(${panX}%, ${panY}%)`,
            transformOrigin: smartFramingOrigin,
            // Live preview of the "cinematic look" toggle — approximates the
            // FFmpeg eq=contrast=1.06:saturation=1.12:gamma=0.96 +
            // increase_contrast + warm-highlights grade so the user SEES the
            // effect change immediately (before it only showed in export).
            // Stack: drama flash (highest priority — when active, overrides
            // the preset to mono) + color-filter preset + cinematic toggle.
            // All pure CSS, GPU-accelerated. The drama flash takes over
            // because B&W is the whole point of the moment.
            filter: activeDrama
              ? "grayscale(1) contrast(1.25) brightness(0.96)"
              : ([
                  colorFilterCss(effects?.colorFilter),
                  effects?.cinematicColor ? "contrast(1.08) saturate(1.16) brightness(1.02) sepia(0.06)" : "",
                ].filter(Boolean).join(" ") || undefined),
            transition: "transform 0.08s linear, filter 0.3s ease",
            // The video sits just above the (usually absent) dynamic BG layer.
            // IMPORTANT: keep this z-index LOW so all overlays (subtitles,
            // emojis, logos) which follow in the DOM render ABOVE the video.
            position: "relative",
            zIndex: 1,
          }}
        />
        </div>{/* /introWrapper */}

        {/* Background music — hidden audio element shadowing the video's
            play/pause/seek. Volume managed via effects.bgMusicVolume. */}
        {effects?.bgMusicUrl && (
          <audio
            ref={bgAudioRef}
            src={effects.bgMusicUrl}
            preload="auto"
            loop
            style={{ display: "none" }}
          />
        )}

        {/* Intro flash/fade overlay — written to by the rAF loop (direct
            DOM, no React re-render). Starts invisible, the loop animates
            background + opacity for flashWhite / fadeIn presets. */}
        <div
          ref={introOverlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 9, opacity: 0, background: "transparent" }}
          aria-hidden
        />

        {currentSubtitle && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            <SubtitleOverlay
              // Re-mount on subtitle change so the entrance animation re-plays
              key={currentSubtitle.id}
              subtitle={currentSubtitle}
              subtitleIndex={currentSubtitleIndex}
              style={style}
              currentTime={currentTime}
              scale={subtitleScale}
              animationType={effects?.subtitleAnimation ?? "none"}
            />
          </div>
        )}

        {/* Whip flash on cut boundaries — mirrors FFmpeg whip-zoom transition */}
        {whipFlashKey !== null && (
          <div
            key={`whip-${whipFlashKey}`}
            className="absolute inset-0 pointer-events-none bg-white"
            style={{
              animation: "whip-flash 220ms ease-out forwards",
              mixBlendMode: "overlay",
            }}
          />
        )}

        {/* Emphasis glow at each AI-detected emphasis moment */}
        {emphasisGlowKey !== null && (
          <div
            key={`emp-${emphasisGlowKey}`}
            className="absolute inset-0 pointer-events-none"
            style={{
              animation: "emphasis-glow 450ms ease-out forwards",
              background:
                "radial-gradient(circle at center, rgba(252, 211, 77, 0.4), transparent 70%)",
              mixBlendMode: "overlay",
            }}
          />
        )}

        {/* All emoji/logo overlays sit in a high-z-index layer above the video */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Contextual emoji elements at keyword timestamps */}
        {visibleElements.map((el) => (
          <ElementOverlay
            key={`${el.category.id}-${el.time}`}
            element={el}
            containerHeight={containerHeight}
          />
        ))}

        {/* Brand logos at brand mention timestamps. Per-occurrence size /
            position overrides come from AiDetectedPanel. Key shape matches
            what the panel writes: "<brandId>-<round(time*10)>". */}
        {visibleBrands.map((b, i) => {
          const k = `${b.brand.id}-${Math.round(b.time * 10)}`;
          return (
          <BrandOverlay
            key={`${b.brand.id}-${b.time}`}
            brand={b}
            containerHeight={containerHeight}
            slot={i}
            transparentBg={effects?.transparentLogoBg ?? false}
            sizePxOverride={effects?.brandSizePx?.[k]}
            positionOverride={effects?.brandPosition?.[k]}
          /> );
        })}

        {/* User-uploaded custom logos. Persistent ones show throughout the
            video; timed ones show only within their window. */}
        {(effects?.customLogos ?? [])
          .filter((logo) => {
            if (logo.persistent ?? true) return true;
            const t0 = logo.time ?? 0;
            const dur = logo.durationSec ?? 0;
            return currentTime >= t0 && currentTime < t0 + dur;
          })
          .map((logo, i) => (
            <CustomLogoOverlay
              key={`custom-${logo.src}-${i}`}
              logo={logo}
              containerHeight={containerHeight}
            />
          ))}

        {/* Animated Lottie icons — sources:
            (1) standalone effects.lottieElements (legacy/EffectsPanel)
            (2) per-subtitle manualEmojis with lottieIconId (new editor flow) */}
        <LottiePreviewOverlay
          elements={[
            ...(effects?.lottieElements ?? []),
            ...subtitles.flatMap((sub) =>
              (sub.manualEmojis ?? [])
                .filter((m) => m.lottieIconId)
                .map((m) => ({
                  iconId: m.lottieIconId!,
                  time: sub.start,
                  durationSec: m.durationSec ?? 2,
                  position: m.position,
                  color: m.color,
                  sizeRatio: 0.2,
                }))
            ),
          ]}
          currentTime={currentTime}
          containerHeight={containerHeight}
        />

        {/* WOW layer — particle bursts + micro shake on power-words */}
        <WowOverlay
          subtitles={subtitles}
          currentTime={currentTime}
          enabled={effects?.particleBurst ?? false}
          shake={effects?.punchShake ?? false}
        />
        </div>
      </div>
    </div>
  );
}

function BrandOverlay({
  brand, containerHeight, slot, transparentBg = false,
  sizePxOverride, positionOverride,
}: {
  brand: BrandEvent;
  containerHeight: number;
  slot: number;
  transparentBg?: boolean;
  sizePxOverride?: number;
  positionOverride?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // Exact-px overrides win over the default 14% scale. Min 16 so a typo'd
  // 0 doesn't make the logo vanish.
  const logoSize = typeof sizePxOverride === "number" && sizePxOverride > 0
    ? Math.max(16, sizePxOverride)
    : Math.max(64, containerHeight * 0.14);
  const cardPadding = logoSize * 0.18;

  // When transparentBg: float the logo+text directly over the video with
  // a heavy drop shadow so it stays readable on any background.
  const containerStyle: React.CSSProperties = transparentBg
    ? {
        padding: 0,
        background: "transparent",
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))",
        display: "flex",
        alignItems: "center",
        gap: `${cardPadding * 0.7}px`,
      }
    : {
        background: "rgba(255,255,255,0.96)",
        padding: `${cardPadding}px ${cardPadding * 1.4}px`,
        borderRadius: `${cardPadding * 0.7}px`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: `${cardPadding * 0.7}px`,
      };

  // Position override (from AiDetectedPanel popover). When unset, fall back
  // to the original stacked top-right pattern so multiple brands don't
  // overlap. Margin from edges is 8%.
  const MARGIN = 8;
  const corner: React.CSSProperties = (() => {
    if (!positionOverride) {
      return { top: `${10 + slot * 12}%`, right: `${8 + slot * 4}%` };
    }
    switch (positionOverride) {
      case "top-right":     return { top: `${MARGIN}%`, right: `${MARGIN}%` };
      case "top-left":      return { top: `${MARGIN}%`, left: `${MARGIN}%` };
      case "top-center":    return { top: `${MARGIN}%`, left: "50%", transform: "translateX(-50%)" };
      case "bottom-right":  return { bottom: `${MARGIN}%`, right: `${MARGIN}%` };
      case "bottom-left":   return { bottom: `${MARGIN}%`, left: `${MARGIN}%` };
      case "bottom-center": return { bottom: `${MARGIN}%`, left: "50%", transform: "translateX(-50%)" };
    }
  })();

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...corner,
        animation: "element-enter 320ms cubic-bezier(0.16,1,0.3,1) forwards",
        willChange: "transform, opacity",
      }}
    >
      <div style={containerStyle}>
        {!imgFailed ? (
          <img
            src={brandLogoCdnUrl(brand.brand)}
            alt={brand.brand.name}
            width={logoSize}
            height={logoSize}
            onError={() => setImgFailed(true)}
            style={{ display: "block", width: logoSize, height: logoSize }}
          />
        ) : (
          // Image fallback ONLY when the CDN failed — never alongside the
          // logo. Liat's note: "תראה אמזון זה לא תואם צריך שממש יהיה את
          // האיקון הלוגו שלהם" — the text was a fallback meant for
          // unavailable logos, not an addition to a working one.
          <span
            style={{
              fontSize: `${logoSize * 0.42}px`,
              fontWeight: 800,
              color: transparentBg ? "#FFFFFF" : `#${brand.brand.color}`,
              whiteSpace: "nowrap",
              textShadow: transparentBg ? "0 2px 8px rgba(0,0,0,0.8)" : undefined,
            }}
          >
            {brand.brand.name}
          </span>
        )}
      </div>
    </div>
  );
}

function CustomLogoOverlay({
  logo, containerHeight,
}: {
  logo: NonNullable<VideoEffects["customLogos"]>[number];
  containerHeight: number;
}) {
  // Watermark — anchored to the CORNER (not the middle of an area).
  // We use top/right/bottom/left CSS properties directly, no translate.
  const margin = Math.max(8, containerHeight * 0.025); // ~2.5% from edge
  const corner: React.CSSProperties = (() => {
    switch (logo.position) {
      case "top-right":    return { top: margin, right: margin };
      case "top-left":     return { top: margin, left: margin };
      case "bottom-right": return { bottom: margin, right: margin };
      case "bottom-left":  return { bottom: margin, left: margin };
    }
  })();

  // Exact px > S/M/L scale. If the user dialed in a specific size we trust
  // it (clamped to a sane min so they can't accidentally zero it out).
  const sizeScale = logo.size === "S" ? 0.07 : logo.size === "L" ? 0.14 : 0.10;
  const size = typeof logo.sizePx === "number" && logo.sizePx > 0
    ? Math.max(8, logo.sizePx)
    : Math.max(40, containerHeight * sizeScale);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...corner,
        // Persistent logos shouldn't re-animate per frame; fade in once.
        animation: "sub-fade 250ms ease-out forwards",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt={logo.name || "logo"}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: "contain",
          background: logo.transparent ? "transparent" : "rgba(255,255,255,0.95)",
          padding: logo.transparent ? 0 : `${size * 0.08}px`,
          borderRadius: logo.transparent ? 0 : Math.round(size * 0.12),
          boxShadow: logo.transparent
            ? "none"
            : "0 4px 16px rgba(0,0,0,0.35)",
          filter: logo.transparent
            ? "drop-shadow(0 2px 6px rgba(0,0,0,0.6))"
            : "none",
          display: "block",
        }}
      />
    </div>
  );
}

function ElementOverlay({
  element, containerHeight,
}: { element: ElementEvent; containerHeight: number }) {
  // Position in % of container, matches ass.ts elementPosition().
  // Edge positions pulled in from the very corners so the emoji is fully
  // visible (not clipped) but still off the speaker's face in the center.
  const positions = {
    "top-right":    { left: "78%", top: "20%" },
    "top-left":     { left: "22%", top: "20%" },
    "bottom-right": { left: "78%", top: "75%" },
    "bottom-left":  { left: "22%", top: "75%" },
    "top-center":   { left: "50%", top: "15%" },
  } as const;
  const pos = positions[element.category.position];
  const size = Math.max(40, containerHeight * 0.10);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...pos,
        transform: "translate(-50%, -50%)",
        fontSize: `${size}px`,
        lineHeight: 1,
        // Simple stable entrance — scales in once and STAYS at scale(1).
        // Forwards fill-mode ensures no snap-back to scale(0) at end.
        animation: "element-enter 320ms cubic-bezier(0.16,1,0.3,1) forwards",
        textShadow: "0 4px 24px rgba(0,0,0,0.7)",
        willChange: "transform, opacity",
      }}
    >
      {element.category.emoji}
    </div>
  );
}

function SubtitleOverlay({
  subtitle, subtitleIndex, style, currentTime, scale, animationType,
}: {
  subtitle: Subtitle;
  subtitleIndex: number;
  style: SubtitleStyle;
  currentTime: number;
  scale: number;
  animationType: import("@/lib/subtitleAnimations").SubtitleAnimationType;
}) {
  const animDef = resolveAnimation(animationType, subtitleIndex);
  const words = subtitle.words ?? subtitle.text.split(/\s+/).map((w, i, arr) => {
    const dur = subtitle.end - subtitle.start;
    return {
      word: w,
      start: subtitle.start + (i / arr.length) * dur,
      end: subtitle.start + ((i + 1) / arr.length) * dur,
    };
  });

  const fontSizePx = style.fontSize * scale;
  const strokePx = style.strokeWidth * scale;
  const offsetPx = style.positionOffset * scale;

  const bgHex =
    style.backgroundOpacity > 0
      ? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255).toString(16).padStart(2, "0")}`
      : "transparent";

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none flex"
      style={{
        top:
          style.position === "top"
            ? `${offsetPx}px`
            : style.position === "middle"
            ? `calc(50% + ${offsetPx}px)`
            : "auto",
        bottom:
          style.position === "bottom"
            ? `${offsetPx}px`
            : "auto",
        // ALWAYS center the subtitle block horizontally — this mirrors the
        // export, which anchors every subtitle at centerX = videoWidth/2
        // regardless of textAlign. (textAlign only affects multi-line text
        // alignment WITHIN the centered block, set on the inner div.) Honoring
        // textAlign here pushed the block to the right edge and clipped it,
        // making preview ≠ export.
        justifyContent: "center",
        padding: `0 ${24 * scale}px`,
        transform: style.position === "middle" ? "translateY(-50%)" : undefined,
      }}
    >
      <div
        className={fontClassFor(style.fontFamily)}
        dir="rtl"
        style={{
          fontSize: `${fontSizePx}px`,
          fontWeight: style.fontWeight,
          paintOrder: "stroke fill",
          WebkitTextStroke: strokePx > 0
            ? `${strokePx}px ${style.strokeColor}`
            : undefined,
          background: bgHex,
          padding: style.backgroundOpacity > 0
            ? `${8 * scale}px ${18 * scale}px`
            : "0",
          borderRadius: `${12 * scale}px`,
          textShadow: style.shadow
            ? `0 ${4 * scale}px ${16 * scale}px rgba(0,0,0,0.85)`
            : "none",
          display: "inline-block",
          lineHeight: 1.3,
          maxWidth: "92%",
          whiteSpace: "normal",
          textAlign: "center",
          color: style.color,
          animation: animDef.cssAnimation,
          transformOrigin: "center center",
        }}
      >
        <bdi>
          {(() => {
            const isHighlightSame =
              style.highlightColor.toLowerCase() === style.color.toLowerCase();
            // CONTINUOUS highlight, matching the export exactly: at any time
            // inside the subtitle, the active word is the LAST word whose start
            // has passed. This removes the "no word highlighted" gaps between
            // word timings that made the color appear to vanish in preview.
            let activeIdx = -1;
            for (let i = 0; i < words.length; i++) {
              if (currentTime >= words[i].start) activeIdx = i;
            }
            // Before the first word's start (but subtitle already on screen) →
            // highlight the first word so the color is always visible.
            if (activeIdx === -1 && words.length > 0) activeIdx = 0;
            return words.map((w, i) => (
              <span key={i}>
                {i > 0 && " "}
                <span
                  style={{
                    color: i === activeIdx && !isHighlightSame
                      ? style.highlightColor
                      : style.color,
                    transition: "color 0.12s ease",
                  }}
                >
                  {w.word}
                </span>
              </span>
            ));
          })()}
        </bdi>
      </div>
    </div>
  );
}
