"use client";

import { Crop, Scissors, ZoomIn, Palette, Sparkles, Layers, ImagePlus, X, Type, Wand2, Music, Volume2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { VideoEffects, AspectRatio, EditMode, Subtitle } from "@/lib/types";
import { detectBrands, brandLogoCdnUrl } from "@/lib/brandLogos";
import { ASPECT_RATIO_INFO } from "@/lib/types";
import { ANIMATIONS } from "@/lib/subtitleAnimations";
import { DYNAMIC_BACKGROUNDS } from "@/lib/dynamicBackgrounds";
import { modeCapabilities } from "@/lib/modeCapabilities";
import { COLOR_FILTERS } from "@/lib/colorFilters";
import { resolveIntroAnimations } from "@/lib/introAnimations";
import { useContent } from "@/lib/useContent";
import { getSfxAsset } from "@/lib/sfxLibrary";
import { saveCurrentMusic, clearCurrentMusic } from "@/lib/projectStorage";
import SfxPicker from "./SfxPicker";
import LottieGallery from "./LottieGallery";

/** Internal tabs the user switches between inside the effects panel. We
 *  group features by intent (special effects / color / brand+aspect /
 *  subtitle-look) so the panel doesn't read as one infinite scroll. */
type EffectsTab = "magic" | "color" | "brand" | "sound" | "captions";

type Props = {
  effects: VideoEffects;
  onChange: (e: VideoEffects) => void;
  /** The currently picked edit mode — controls which feature blocks appear,
   *  matching the bullets on the mode-selector cards. */
  mode?: EditMode;
  /** Subtitles — used to detect brand mentions and let the user dial in
   *  size (px) + position per detected brand directly from this panel. */
  subtitles?: Subtitle[];
};

const ASPECT_RATIOS: AspectRatio[] = ["original", "9:16", "1:1", "16:9", "4:5"];

export default function EffectsPanel({ effects, onChange, mode = "advanced_effects", subtitles }: Props) {
  const update = <K extends keyof VideoEffects>(
    key: K,
    value: VideoEffects[K],
  ) => onChange({ ...effects, [key]: value });

  const caps = modeCapabilities(mode);
  const hiddenIntros = useContent("intro.hidden") as Record<string, true>;
  // Intro presets with admin label/desc overrides applied
  const visibleIntros = resolveIntroAnimations().filter((i) => !hiddenIntros?.[i.id]);

  // CMS-editable tab + section copy
  const c = {
    tabMagic:       useContent("effects.tab.magic") as string,
    tabColor:       useContent("effects.tab.color") as string,
    tabBrand:       useContent("effects.tab.brand") as string,
    tabSound:       useContent("effects.tab.sound") as string,
    tabCaptions:    useContent("effects.tab.captions") as string,
    secAspect:      useContent("effects.section.aspect") as string,
    cropFocus:      useContent("effects.field.cropFocus") as string,
    cfTop:          useContent("effects.cropFocus.top") as string,
    cfCenter:       useContent("effects.cropFocus.center") as string,
    cfBottom:       useContent("effects.cropFocus.bottom") as string,
    secIntro:       useContent("effects.section.intro") as string,
    introHint:      useContent("effects.intro.hint") as string,
    secSilence:     useContent("effects.section.silenceCut") as string,
    silenceToggleLabel: useContent("effects.silenceCut.toggleLabel") as string,
    silenceToggleHint:  useContent("effects.silenceCut.toggleHint") as string,
    silenceThresholdLabelTpl: useContent("effects.silenceCut.thresholdLabelTpl") as string,
    silenceThresholdHint:     useContent("effects.silenceCut.thresholdHint") as string,
    silenceMinDurationLabelTpl:useContent("effects.silenceCut.minDurationLabelTpl") as string,
    secZoom:        useContent("effects.section.zoom") as string,
    zoomNoneLabel:  useContent("effects.zoom.opt.none.label") as string,
    zoomNoneDesc:   useContent("effects.zoom.opt.none.desc") as string,
    zoomPunchLabel: useContent("effects.zoom.opt.punch.label") as string,
    zoomPunchDesc:  useContent("effects.zoom.opt.punch.desc") as string,
    zoomSubtleLabel:useContent("effects.zoom.opt.subtle.label") as string,
    zoomSubtleDesc: useContent("effects.zoom.opt.subtle.desc") as string,
    zoomKbLabel:    useContent("effects.zoom.opt.kenburns.label") as string,
    zoomKbDesc:     useContent("effects.zoom.opt.kenburns.desc") as string,
    zoomEmphasisTpl:useContent("effects.zoom.emphasisHintTpl") as string,
    zoomIntensityTpl:useContent("effects.zoom.intensityLabelTpl") as string,
    wowBeatLabel:   useContent("effects.wow.beatDrop.label") as string,
    wowBeatHint:    useContent("effects.wow.beatDrop.hint") as string,
    wowParticleLabel:useContent("effects.wow.particle.label") as string,
    wowParticleHint:useContent("effects.wow.particle.hint") as string,
    wowShakeLabel:  useContent("effects.wow.punchShake.label") as string,
    wowShakeHint:   useContent("effects.wow.punchShake.hint") as string,
    wowDramaLabel:  useContent("effects.wow.drama.label") as string,
    wowDramaHint:   useContent("effects.wow.drama.hint") as string,
    secSubIntro:    useContent("effects.section.subtitleIntro") as string,
    secBgMusic:     useContent("effects.section.bgMusic") as string,
    secSfxVolume:   useContent("effects.section.sfxVolume") as string,
    sfxVolumeHint:  useContent("effects.sfx.volumeHint") as string,
    secColorFilter: useContent("effects.section.colorFilter") as string,
    colorFilterHint:useContent("effects.colorFilter.longHint") as string,
    secBrandLogo:   useContent("effects.section.brandLogo") as string,
    secAutoLogos:   useContent("effects.section.autoLogos") as string,
    autoLogosLabel: useContent("effects.autoLogos.label") as string,
    autoLogosExtra: useContent("effects.autoLogos.extraHint") as string,
    brandExplainLead:useContent("effects.brandDetect.explainLead") as string,
    brandExplainBody:useContent("effects.brandDetect.explainBody") as string,
    brandAliases:   useContent("effects.brandDetect.aliases") as string,
    brandTransparentLabel:useContent("effects.brandDetect.transparentLabel") as string,
    brandTransparentHint: useContent("effects.brandDetect.transparentHint") as string,
    brandEmptyHint: useContent("effects.brandDetect.emptyHint") as string,
    brandFoundHeadingTpl:useContent("effects.brandDetect.foundHeadingTpl") as string,
    cineHeading:    useContent("effects.cinematic.heading") as string,
    cineLabel:      useContent("effects.cinematic.label") as string,
    cineHint:       useContent("effects.cinematic.hint") as string,
    introSfxHeading:useContent("effects.introSfx.heading") as string,
    introSfxNone:   useContent("effects.introSfx.noneLabel") as string,
    introSfxDisabled:useContent("effects.introSfx.disabledLabel") as string,
    introSfxPick:   useContent("effects.introSfx.clickToPick") as string,
    bgMusicUploadHint: useContent("effects.bgMusic.uploadHint") as string,
    bgMusicFallback:useContent("effects.bgMusic.activeFallback") as string,
    bgMusicStatus:  useContent("effects.bgMusic.activeStatus") as string,
    bgMusicRemoveTitle:useContent("effects.bgMusic.removeTitle") as string,
    bgMusicVideoVol:useContent("effects.bgMusic.videoVolume") as string,
    bgMusicMusicVol:useContent("effects.bgMusic.musicVolume") as string,
    bgMusicBalanceTip:useContent("effects.bgMusic.balanceTip") as string,
    logoPersonalTitle:useContent("effects.logo.personalTitle") as string,
    logoPersonalHint: useContent("effects.logo.personalHint") as string,
    logoUploadBtn:  useContent("effects.logo.uploadBtn") as string,
    logoUploadingBtn:useContent("effects.logo.uploadingBtn") as string,
    logoTooLargeTpl:useContent("effects.logo.tooLargeErrTpl") as string,
    logoReadErr:    useContent("effects.logo.readErr") as string,
    logoCornerLabel:useContent("effects.logo.cornerLabel") as string,
    logoSizeLabel:  useContent("effects.logo.sizeLabel") as string,
    logoSizeSmall:  useContent("effects.logo.sizeSmall") as string,
    logoSizeMedium: useContent("effects.logo.sizeMedium") as string,
    logoSizeLarge:  useContent("effects.logo.sizeLarge") as string,
    logoBgLabel:    useContent("effects.logo.bgLabel") as string,
    logoBgProcessing:useContent("effects.logo.bgProcessing") as string,
    logoBgRemoved:  useContent("effects.logo.bgRemoved") as string,
    logoBgRemovedTitle:useContent("effects.logo.bgRemovedTitle") as string,
    logoBgOriginal: useContent("effects.logo.bgOriginal") as string,
    logoAdvClose:   useContent("effects.logo.advancedToggleClose") as string,
    logoAdvOpen:    useContent("effects.logo.advancedToggleOpen") as string,
    logoWatermark:  useContent("effects.logo.watermarkLabel") as string,
    logoFromLabel:  useContent("effects.logo.fromLabel") as string,
    logoForLabel:   useContent("effects.logo.forLabel") as string,
    logoSecAbbr:    useContent("effects.logo.secAbbr") as string,
    logoEmptyH:     useContent("effects.logo.emptyHelpHeading") as string,
    logoEmptyPK:    useContent("effects.logo.emptyHelpPersonalKey") as string,
    logoEmptyPB:    useContent("effects.logo.emptyHelpPersonalBody") as string,
    logoEmptyBK:    useContent("effects.logo.emptyHelpBrandsKey") as string,
    logoEmptyBB:    useContent("effects.logo.emptyHelpBrandsBody") as string,
  };

  // Which tabs to show. A tab disappears when EVERY block inside it is
  // disabled for the current edit mode — so "subtitles_only" gets the
  // skinniest panel (only Captions + maybe Color), not 4 empty boxes.
  const tabsAvailable: { id: EffectsTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    {
      id: "magic",
      label: c.tabMagic,
      icon: <Wand2 className="w-3.5 h-3.5" />,
      visible: caps.silenceCut || caps.faceZoom || caps.aspectCrop,
    },
    {
      id: "color",
      label: c.tabColor,
      icon: <Palette className="w-3.5 h-3.5" />,
      // Color filters are pure CSS — available in every mode (subtitles_only
      // included). Cinematic toggle stays gated by colorGrade cap.
      visible: true,
    },
    {
      id: "brand",
      label: c.tabBrand,
      icon: <ImagePlus className="w-3.5 h-3.5" />,
      visible: caps.logo,
    },
    {
      id: "sound",
      label: c.tabSound,
      icon: <Music className="w-3.5 h-3.5" />,
      // Sounds tab is universal — every mode can attach music and tune
      // volumes, even subtitles_only.
      visible: true,
    },
    {
      id: "captions",
      label: c.tabCaptions,
      icon: <Type className="w-3.5 h-3.5" />,
      visible: true,
    },
  ];
  const visibleTabs = tabsAvailable.filter((t) => t.visible);
  const [tab, setTab] = useState<EffectsTab>(() => visibleTabs[0]?.id ?? "captions");

  return (
    <div className="space-y-4">
      {/* Tab strip — small chips, RTL, equal width so it doesn't sprawl */}
      <div
        className="grid gap-1 bg-bg-card/60 border border-white/10 rounded-xl p-1"
        style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
      >
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-bold transition-colors ${
              tab === t.id
                ? "bg-brand text-white shadow shadow-brand/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Aspect ratio (under "אפקטים מיוחדים" tab — it's output format, not branding) ── */}
      {tab === "magic" && caps.aspectCrop && (
      <Section icon={<Crop className="w-4 h-4" />} title={c.secAspect}>
        <div className="grid grid-cols-5 gap-2">
          {ASPECT_RATIOS.map((ar) => {
            const info = ASPECT_RATIO_INFO[ar];
            const isSelected = effects.aspectRatio === ar;
            return (
              <button
                key={ar}
                onClick={() => update("aspectRatio", ar)}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg border transition-all
                  ${isSelected
                    ? "border-brand bg-brand/20 text-white shadow-md shadow-brand/20"
                    : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}
                `}
              >
                <AspectIcon ratio={ar} active={isSelected} />
                <span className="text-[10px] font-bold">{info.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-white/40 mt-2">
          {ASPECT_RATIO_INFO[effects.aspectRatio].description}
        </p>

        {effects.aspectRatio !== "original" && (
          <div className="mt-3">
            <label className="block text-xs text-white/60 mb-1.5">
              {c.cropFocus}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["top", "center", "bottom"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => update("cropFocus", f)}
                  className={`
                    py-2 rounded-lg text-xs border transition-all
                    ${effects.cropFocus === f
                      ? "border-brand bg-brand/20"
                      : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}
                  `}
                >
                  {f === "top" ? c.cfTop : f === "center" ? c.cfCenter : c.cfBottom}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>
      )}

      {/* Intro animation (under "אפקטים מיוחדים" tab) — every mode, since
          a punchy opener is value even for "subtitles_only". */}
      {tab === "magic" && (
      <Section icon={<Sparkles className="w-4 h-4" />} title={c.secIntro}>
        <div className="grid grid-cols-3 gap-2">
          {visibleIntros.map((opt) => {
            const active = (effects.introAnimation ?? "none") === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => update("introAnimation", opt.id)}
                className={`py-2 px-2 rounded-lg text-xs border transition-all text-right ${
                  active ? "border-brand bg-brand/20" : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"
                }`}
              >
                <div className="font-bold mb-0.5">{opt.emoji} {opt.label}</div>
                <div className="text-[10px] text-white/40">{opt.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-white/40 mt-2">
          {c.introHint}
        </p>

        {/* Intro SFX picker — appears only when an animation is selected.
            Liat: "בסאונד אפקט התכוונתי שיהיה באנימציית כניסה". The chosen
            SFX plays at t=0 in sync with the visual intro. */}
        {effects.introAnimation && effects.introAnimation !== "none" && (
          <IntroSfxPicker
            currentSfxId={effects.introSfxId}
            onChange={(v) => update("introSfxId", v)}
          />
        )}
      </Section>
      )}

      {/* Silence cut (under "אפקטים מיוחדים" tab) */}
      {tab === "magic" && caps.silenceCut && (
      <Section icon={<Scissors className="w-4 h-4" />} title={c.secSilence}>
        <Toggle
          label={c.silenceToggleLabel}
          hint={c.silenceToggleHint}
          checked={effects.cutSilence}
          onChange={(v) => update("cutSilence", v)}
        />
        {effects.cutSilence && (
          <>
            <Field label={c.silenceThresholdLabelTpl.replace("{{db}}", String(effects.silenceThresholdDb))} hint={c.silenceThresholdHint}>
              <input
                type="range" min={-60} max={-20}
                value={effects.silenceThresholdDb}
                onChange={(e) => update("silenceThresholdDb", parseInt(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field label={c.silenceMinDurationLabelTpl.replace("{{sec}}", effects.silenceMinDurationSec.toFixed(1))}>
              <input
                type="range" min={0.3} max={3} step={0.1}
                value={effects.silenceMinDurationSec}
                onChange={(e) => update("silenceMinDurationSec", parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
          </>
        )}
      </Section>
      )}

      {/* Zoom + WOW toggles (under "אפקטים מיוחדים" tab) */}
      {tab === "magic" && caps.faceZoom && (
      <Section icon={<ZoomIn className="w-4 h-4" />} title={c.secZoom}>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "none",     label: c.zoomNoneLabel,   desc: c.zoomNoneDesc },
            { id: "punch",    label: c.zoomPunchLabel,  desc: c.zoomPunchDesc },
            { id: "subtle",   label: c.zoomSubtleLabel, desc: c.zoomSubtleDesc },
            { id: "kenburns", label: c.zoomKbLabel,     desc: c.zoomKbDesc },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => update("zoomEffect", opt.id)}
              className={`
                py-2 px-2 rounded-lg text-xs border transition-all text-right
                ${effects.zoomEffect === opt.id
                  ? "border-brand bg-brand/20"
                  : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}
              `}
            >
              <div className="font-bold mb-0.5">{opt.label}</div>
              <div className="text-[10px] text-white/40">{opt.desc}</div>
            </button>
          ))}
        </div>
        {effects.zoomEffect === "punch" && effects.emphasisMoments && effects.emphasisMoments.length > 0 && (
          <p className="text-[11px] text-emerald-300/80 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
            {c.zoomEmphasisTpl.replace("{{n}}", String(effects.emphasisMoments.length))}
          </p>
        )}

        {effects.zoomEffect !== "none" && (
          <Field label={c.zoomIntensityTpl.replace("{{pct}}", String(Math.round(effects.zoomIntensity * 100)))}>
            <input
              type="range" min={2} max={30}
              value={effects.zoomIntensity * 100}
              onChange={(e) => update("zoomIntensity", parseInt(e.target.value) / 100)}
              className="w-full"
            />
          </Field>
        )}

        {/* WOW: Beat-Drop Zoom — punch on power-words */}
        <Toggle
          label={c.wowBeatLabel}
          hint={c.wowBeatHint}
          checked={effects.beatDropZoom ?? false}
          onChange={(v) => update("beatDropZoom", v)}
        />
        <Toggle
          label={c.wowParticleLabel}
          hint={c.wowParticleHint}
          checked={effects.particleBurst ?? false}
          onChange={(v) => update("particleBurst", v)}
        />
        <Toggle
          label={c.wowShakeLabel}
          hint={c.wowShakeHint}
          checked={effects.punchShake ?? false}
          onChange={(v) => update("punchShake", v)}
        />
        <Toggle
          label={c.wowDramaLabel}
          hint={c.wowDramaHint}
          checked={effects.dramaMode ?? false}
          onChange={(v) => update("dramaMode", v)}
        />
      </Section>
      )}

      {/* Subtitle entrance animation (under "כתוביות" tab) — every mode */}
      {tab === "captions" && (
      <Section icon={<Sparkles className="w-4 h-4" />} title={c.secSubIntro}>
        <div className="grid grid-cols-3 gap-2">
          {ANIMATIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => update("subtitleAnimation", opt.id)}
              className={`
                py-2 px-2 rounded-lg text-xs border transition-all text-right
                ${(effects.subtitleAnimation ?? "none") === opt.id
                  ? "border-brand bg-brand/20"
                  : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}
              `}
            >
              <div className="font-bold mb-0.5">{opt.emoji} {opt.label}</div>
              <div className="text-[10px] text-white/40">{opt.description}</div>
            </button>
          ))}
        </div>
      </Section>
      )}

      {/* ── Sounds tab — bg music + master SFX volume ── */}
      {tab === "sound" && (
      <>
        <Section icon={<Music className="w-4 h-4" />} title={c.secBgMusic}>
          <BgMusicControls
            url={effects.bgMusicUrl}
            videoVolume={effects.videoVolume ?? 1}
            musicVolume={effects.bgMusicVolume ?? 0.25}
            onUrl={(v) => update("bgMusicUrl", v)}
            onVideoVolume={(v) => update("videoVolume", v)}
            onMusicVolume={(v) => update("bgMusicVolume", v)}
            uploadHint={c.bgMusicUploadHint}
            activeFallback={c.bgMusicFallback}
            activeStatus={c.bgMusicStatus}
            removeTitle={c.bgMusicRemoveTitle}
            videoVolLabel={c.bgMusicVideoVol}
            musicVolLabel={c.bgMusicMusicVol}
            balanceTip={c.bgMusicBalanceTip}
          />
        </Section>

        {/* Master SFX volume — one knob that scales every sound effect
            (auto-elements, manual emojis, intro SFX, logo SFX, Lottie SFX)
            so the user can balance speech vs effects without touching each
            element individually. */}
        <Section icon={<Volume2 className="w-4 h-4" />} title={c.secSfxVolume}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/70">{c.sfxVolumeHint}</span>
              <span className="text-white/40 text-xs">
                {Math.round((effects.sfxMasterVolume ?? 1) * 100)}%
              </span>
            </div>
            {(() => {
              const v = effects.sfxMasterVolume ?? 1;
              const pct = Math.round((v / 2) * 100);
              return (
                <input
                  type="range" min={0} max={200} step={5}
                  value={Math.round(v * 100)}
                  onChange={(e) => update("sfxMasterVolume", parseInt(e.target.value, 10) / 100)}
                  style={{
                    background: `linear-gradient(to left, rgba(124,58,237,0.85) 0%, rgba(124,58,237,0.85) ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`,
                  }}
                  className="w-full h-2 appearance-none rounded-full cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
                />
              );
            })()}
            <div className="flex justify-between text-[10px] text-white/40">
              <span>0%</span><span>100%</span><span>200%</span>
            </div>
          </div>
        </Section>
      </>
      )}

      {/* ── Color Filter presets (under "צבע" tab) — 6 pre-canned vibes ── */}
      {tab === "color" && (
      <Section icon={<Palette className="w-4 h-4" />} title={c.secColorFilter}>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_FILTERS.map((f) => {
            const active = (effects.colorFilter ?? "none") === f.id;
            return (
              <button
                key={f.id}
                onClick={() => update("colorFilter", f.id)}
                className={`py-2 px-2 rounded-lg text-xs border transition-all text-right ${
                  active ? "bg-brand/20 text-white" : "bg-bg-input text-white/70 hover:border-white/30"
                }`}
                style={{ borderColor: active ? f.chipColor : undefined, borderWidth: active ? 2 : 1 }}
              >
                <div className="font-bold mb-0.5">{f.emoji} {f.label}</div>
                <div className="text-[10px] text-white/40">{f.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-white/40 mt-2">
          {c.colorFilterHint}
        </p>
      </Section>
      )}

      {/* Depth/Parallax mode hidden — the segmentation-based pipeline produces
          unexpected results for users (only a person silhouette visible over
          a pattern, rest of frame replaced). Kept in code for future when we
          have client-side segmentation preview + better UX.
      <Section icon={<Layers className="w-4 h-4" />} title="עומק תלת-ממדי (Parallax)">
        ...
      </Section>
      */}

      {/* Lottie gallery hidden per Liat 2026-06-07 — Lottie animations are now
          added directly from the subtitle editor (✨ button per subtitle),
          alongside emojis, with per-element duration + sound picker. Old
          standalone gallery kept available via /lottie-test for debugging. */}

      {/* Personal brand logo (under "לוגואים" tab) */}
      {tab === "brand" && caps.logo && (
      <Section icon={<ImagePlus className="w-4 h-4" />} title={c.secBrandLogo}>
        <CustomLogoSection
          logos={effects.customLogos ?? []}
          onChange={(logos) => update("customLogos", logos)}
          transparentBg={effects.transparentLogoBg ?? false}
          onTransparentBgChange={(v) => update("transparentLogoBg", v)}
          labels={{
            personalTitle: c.logoPersonalTitle,
            personalHint:  c.logoPersonalHint,
            uploadBtn:     c.logoUploadBtn,
            uploadingBtn:  c.logoUploadingBtn,
            tooLargeTpl:   c.logoTooLargeTpl,
            readErr:       c.logoReadErr,
            cornerLabel:   c.logoCornerLabel,
            sizeLabel:     c.logoSizeLabel,
            sizeSmall:     c.logoSizeSmall,
            sizeMedium:    c.logoSizeMedium,
            sizeLarge:     c.logoSizeLarge,
            bgLabel:       c.logoBgLabel,
            bgProcessing:  c.logoBgProcessing,
            bgRemoved:     c.logoBgRemoved,
            bgRemovedTitle:c.logoBgRemovedTitle,
            bgOriginal:    c.logoBgOriginal,
            advClose:      c.logoAdvClose,
            advOpen:       c.logoAdvOpen,
            watermark:     c.logoWatermark,
            fromLabel:     c.logoFromLabel,
            forLabel:      c.logoForLabel,
            secAbbr:       c.logoSecAbbr,
            emptyH:        c.logoEmptyH,
            emptyPK:       c.logoEmptyPK,
            emptyPB:       c.logoEmptyPB,
            emptyBK:       c.logoEmptyBK,
            emptyBB:       c.logoEmptyBB,
          }}
        />
      </Section>
      )}

      {/* AI brand-logo detection — full block. Order per Liat:
          (1) toggle, (2) explanation paragraph, (3) linked transparency
          toggle, (4) detected brands list with size + position controls. */}
      {tab === "brand" && caps.logo && (
      <Section icon={<Sparkles className="w-4 h-4" />} title={c.secAutoLogos}>
        {/* 1. The master toggle */}
        <Toggle
          label={c.autoLogosLabel}
          hint={c.autoLogosExtra}
          checked={effects.brandLogosDetect !== false}
          onChange={(v) => update("brandLogosDetect", v)}
        />

        {/* 2 + 3. Explanation + linked transparency toggle. Only show when
            detection is on — otherwise it's noise. */}
        {effects.brandLogosDetect !== false && (
          <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-lg p-3 space-y-2.5 mt-3">
            <div className="text-[11px] text-cyan-200/90 leading-relaxed">
              💡 <span className="font-bold">{c.brandExplainLead}</span>{" "}
              {c.brandExplainBody.split("{{aliases}}").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="font-mono">{c.brandAliases}</span>}
                </span>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 pt-2 border-t border-cyan-500/20 cursor-pointer">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">{c.brandTransparentLabel}</div>
                <div className="text-[10px] text-white/50">
                  {c.brandTransparentHint}
                </div>
              </div>
              <input
                type="checkbox"
                className="shrink-0 w-9 h-5 appearance-none bg-white/10 rounded-full relative cursor-pointer transition-colors checked:bg-brand
                           before:absolute before:top-0.5 before:right-0.5 before:w-4 before:h-4 before:rounded-full before:bg-white
                           before:transition-all checked:before:right-[1.125rem]"
                checked={effects.transparentLogoBg ?? false}
                onChange={(e) => update("transparentLogoBg", e.target.checked)}
              />
            </label>
          </div>
        )}

        {/* 4. Per-occurrence size + position controls for detected brand logos.
            Liat: "הכוונה שלי הייתה ללוגו מותגים כמו אליאקספרס אמזון..." —
            she wants these tunable from this tab, not just from the
            top-of-page "AI זיהה" chips. */}
        {effects.brandLogosDetect !== false && subtitles && subtitles.length > 0 && (
          <DetectedBrandsControls
            subtitles={subtitles}
            sizePx={effects.brandSizePx ?? {}}
            position={effects.brandPosition ?? {}}
            onSize={(k, px) => {
              const next = { ...(effects.brandSizePx ?? {}) };
              if (px === undefined) delete next[k]; else next[k] = px;
              update("brandSizePx", next);
            }}
            onPosition={(k, p) => {
              const next = { ...(effects.brandPosition ?? {}) };
              if (p === undefined) delete next[k]; else next[k] = p;
              update("brandPosition", next);
            }}
            emptyHint={c.brandEmptyHint}
            foundHeadingTpl={c.brandFoundHeadingTpl}
            sizeLabel={c.logoSizeLabel}
            resetTitle={"ברירת מחדל"}
          />
        )}
      </Section>
      )}

      {/* Cinematic color grading (under "צבע" tab, advanced mode only) */}
      {tab === "color" && caps.colorGrade && (
      <Section icon={<Palette className="w-4 h-4" />} title={c.cineHeading}>
        <Toggle
          label={c.cineLabel}
          hint={c.cineHint}
          checked={effects.cinematicColor ?? false}
          onChange={(v) => update("cinematicColor", v)}
        />
      </Section>
      )}
    </div>
  );
}

type BrandPos = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
const BRAND_POSITIONS: { id: BrandPos; icon: string; title: string }[] = [
  { id: "top-left",      icon: "↖", title: "שמאל למעלה" },
  { id: "top-center",    icon: "↑", title: "מרכז למעלה" },
  { id: "top-right",     icon: "↗", title: "ימין למעלה" },
  { id: "bottom-left",   icon: "↙", title: "שמאל למטה" },
  { id: "bottom-center", icon: "↓", title: "מרכז למטה" },
  { id: "bottom-right",  icon: "↘", title: "ימין למטה" },
];

/** Lists every brand the AI matched in the transcript and lets Liat dial
 *  PX size + 6-corner position per occurrence — without having to scroll
 *  back up to the "AI זיהה" chips. Liat: "הכוונה שלי הייתה ללוגו מותגים
 *  כמו אליאקספרס אמזון". */
function DetectedBrandsControls({
  subtitles, sizePx, position, onSize, onPosition,
  emptyHint, foundHeadingTpl, sizeLabel, resetTitle,
}: {
  subtitles: Subtitle[];
  sizePx: Record<string, number>;
  position: Record<string, BrandPos>;
  onSize: (key: string, px: number | undefined) => void;
  onPosition: (key: string, p: BrandPos | undefined) => void;
  emptyHint: string;
  foundHeadingTpl: string;
  sizeLabel: string;
  resetTitle: string;
}) {
  const brands = detectBrands(subtitles);
  if (brands.length === 0) {
    return (
      <div className="mt-3 text-[10px] text-white/40 border-t border-white/5 pt-3">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
        {foundHeadingTpl.replace("{{n}}", String(brands.length))}
      </div>
      {brands.map((b, i) => {
        const k = `${b.brand.id}-${Math.round(b.time * 10)}`;
        const curPx = sizePx[k];
        const curPos = position[k];
        return (
          <div key={`${b.brand.id}-${i}`} className="bg-bg-input border border-white/10 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-white rounded-md p-1 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brandLogoCdnUrl(b.brand)} alt={b.brand.name} width={18} height={18} style={{ display: "block" }} />
              </div>
              <span className="text-xs font-bold flex-1" style={{ color: `#${b.brand.color}` }}>{b.brand.name}</span>
              <span className="text-[10px] text-white/40 font-mono">{b.time.toFixed(1)}s</span>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-white/50 mb-0.5">
                <span>{sizeLabel}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-brand-light">{curPx ?? 80}px</span>
                  {typeof curPx === "number" && (
                    <button onClick={() => onSize(k, undefined)}
                      className="text-white/40 hover:text-white" title={resetTitle}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range" min={16} max={240} step={1}
                value={curPx ?? 80}
                onChange={(e) => onSize(k, parseInt(e.target.value, 10))}
                style={{
                  background: `linear-gradient(to left, rgba(124,58,237,0.85) 0%, rgba(124,58,237,0.85) ${((curPx ?? 80) - 16) / (240 - 16) * 100}%, rgba(255,255,255,0.15) ${((curPx ?? 80) - 16) / (240 - 16) * 100}%, rgba(255,255,255,0.15) 100%)`,
                }}
                className="w-full h-2 appearance-none rounded-full cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-light
                           [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-brand/40
                           [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                           [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:bg-brand-light [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
              />
            </div>
            <div className="grid grid-cols-6 gap-1">
              {BRAND_POSITIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPosition(k, curPos === p.id ? undefined : p.id)}
                  className={`py-1 rounded text-sm border transition-colors ${
                    curPos === p.id
                      ? "border-brand bg-brand/25 text-white"
                      : "border-white/10 bg-bg-card text-white/40 hover:border-white/30"
                  }`}
                  title={p.title}
                >
                  {p.icon}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Background music controls — upload a track + two volume sliders.
 *  Stored as an object-URL in effects.bgMusicUrl so the snapshot system
 *  picks it up automatically (volume fields too). Persistence across page
 *  reloads requires re-uploading; that's the tradeoff for not pushing big
 *  audio blobs into IndexedDB on the MVP. */
/** Intro animation sound — opens the same SfxPicker used everywhere else.
 *  Lives inline under the intro grid so it reads as a clear next-step:
 *  "you picked an animation, now (optionally) pick a sound to go with it". */
function IntroSfxPicker({ currentSfxId, onChange }: { currentSfxId?: string; onChange: (v: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const noneLabel    = useContent("effects.introSfx.noneLabel") as string;
  const disabledLabel= useContent("effects.introSfx.disabledLabel") as string;
  const heading      = useContent("effects.introSfx.heading") as string;
  const pickLabel    = useContent("effects.introSfx.clickToPick") as string;
  const label = !currentSfxId ? noneLabel
    : currentSfxId === "none" ? disabledLabel
    : getSfxAsset(currentSfxId)?.label ?? currentSfxId;
  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="text-[10px] text-white/40 mb-1.5">{heading}</div>
      <button
        onClick={(e) => { setAnchor(e.currentTarget.getBoundingClientRect()); setOpen(true); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors ${
          currentSfxId && currentSfxId !== "none"
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
            : "border-white/10 bg-bg-input text-white/70 hover:border-white/30"
        }`}
      >
        <span>{currentSfxId && currentSfxId !== "none" ? "🎵" : "🔇"} {label}</span>
        <span className="text-white/40">{pickLabel}</span>
      </button>
      {open && (
        <SfxPicker
          open
          currentSfxId={currentSfxId}
          defaultLabel={noneLabel}
          onSelect={(id) => { onChange(id); setOpen(false); }}
          onClose={() => setOpen(false)}
          anchorRect={anchor}
        />
      )}
    </div>
  );
}

function BgMusicControls({
  url, videoVolume, musicVolume,
  onUrl, onVideoVolume, onMusicVolume,
  uploadHint, activeFallback, activeStatus, removeTitle,
  videoVolLabel, musicVolLabel, balanceTip,
}: {
  url?: string;
  videoVolume: number;
  musicVolume: number;
  onUrl: (v: string | undefined) => void;
  onVideoVolume: (v: number) => void;
  onMusicVolume: (v: number) => void;
  uploadHint: string;
  activeFallback: string;
  activeStatus: string;
  removeTitle: string;
  videoVolLabel: string;
  musicVolLabel: string;
  balanceTip: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string>("");

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const obj = URL.createObjectURL(f);
    setName(f.name);
    onUrl(obj);
    // Persist the audio BYTES to IndexedDB so the music survives a page
    // reload (the blob: URL above dies on reload). On restore we rebuild a
    // fresh blob: URL from these bytes; on export we read them directly.
    void saveCurrentMusic(f, f.name, f.type);
  }
  function clearMusic() {
    if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }
    setName("");
    onUrl(undefined);
    void clearCurrentMusic();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {!url ? (
        <>
          <p className="text-[11px] text-white/40">
            {uploadHint}
          </p>
          <label className="block">
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              onChange={handlePick}
              className="block w-full text-xs file:mr-2 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-brand file:text-white file:cursor-pointer hover:file:bg-brand-light"
            />
          </label>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 bg-bg-input border border-emerald-500/30 rounded-lg p-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-emerald-300 truncate">
              🎵 {name || activeFallback}
            </div>
            <div className="text-[10px] text-white/40">{activeStatus}</div>
          </div>
          <button onClick={clearMusic}
            className="p-1.5 text-white/50 hover:text-red-300" title={removeTitle}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label className="block">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-white/80">
              <Volume2 className="w-3.5 h-3.5" /> {videoVolLabel}
            </span>
            <span className="text-white/40">{Math.round(videoVolume * 100)}%</span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(videoVolume * 100)}
            onChange={(e) => onVideoVolume(parseInt(e.target.value) / 100)}
            className="w-full mt-1" />
        </label>
        <label className="block">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-white/80">
              <Music className="w-3.5 h-3.5" /> {musicVolLabel}
            </span>
            <span className="text-white/40">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(musicVolume * 100)}
            onChange={(e) => onMusicVolume(parseInt(e.target.value) / 100)}
            className="w-full mt-1" />
        </label>
        <p className="text-[10px] text-white/40">
          {balanceTip}
        </p>
      </div>
    </div>
  );
}

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="block text-xs text-white/60 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="
          w-10 h-6 rounded-full bg-bg-input border border-white/10
          peer-checked:bg-brand peer-checked:border-brand
          transition-colors
        ">
          <div className={`
            absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
            transition-transform
            ${checked ? "translate-x-[-1rem]" : "translate-x-[-0.125rem]"}
          `} />
        </div>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium group-hover:text-white">{label}</div>
        {hint && <div className="text-xs text-white/40 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

type CustomLogo = NonNullable<VideoEffects["customLogos"]>[number];

/** Only the four corners — a watermark in the center looks wrong. */
const LOGO_POSITIONS: { id: CustomLogo["position"]; icon: string }[] = [
  { id: "top-left",     icon: "↖" },
  { id: "top-right",    icon: "↗" },
  { id: "bottom-left",  icon: "↙" },
  { id: "bottom-right", icon: "↘" },
];

const LOGO_SIZES: NonNullable<CustomLogo["size"]>[] = ["S", "M", "L"];

type CustomLogoLabels = {
  personalTitle: string; personalHint: string;
  uploadBtn: string; uploadingBtn: string;
  tooLargeTpl: string; readErr: string;
  cornerLabel: string;
  sizeLabel: string; sizeSmall: string; sizeMedium: string; sizeLarge: string;
  bgLabel: string; bgProcessing: string; bgRemoved: string; bgRemovedTitle: string; bgOriginal: string;
  advClose: string; advOpen: string; watermark: string;
  fromLabel: string; forLabel: string; secAbbr: string;
  emptyH: string; emptyPK: string; emptyPB: string; emptyBK: string; emptyBB: string;
};

function CustomLogoSection({
  logos, onChange, transparentBg, onTransparentBgChange, labels,
}: {
  logos: CustomLogo[];
  onChange: (v: CustomLogo[]) => void;
  /** Whether AI-detected brand logos (AliExpress etc.) should be auto-cleaned of white background. */
  transparentBg: boolean;
  onTransparentBgChange: (v: boolean) => void;
  labels: CustomLogoLabels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-logo "advanced" panel state — collapsed by default
  const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({});
  // Which logos are currently being processed for BG removal
  const [removingBg, setRemovingBg] = useState<Record<number, boolean>>({});

  /** Toggle "transparent" for a logo. On first switch ON we call the
   *  background-removal API to produce a new no-bg version. Result is
   *  cached on the logo so subsequent toggles are instant. */
  async function toggleTransparent(idx: number, makeTransparent: boolean) {
    const logo = logos[idx];
    if (!makeTransparent) {
      // Switching OFF — revert to original
      updateLogo(idx, {
        transparent: false,
        src: logo.srcOriginal ?? logo.src,
      });
      return;
    }
    // Switching ON — use cached transparent version if we already built it
    if (logo.srcTransparent) {
      updateLogo(idx, { transparent: true, src: logo.srcTransparent });
      return;
    }
    // Otherwise, build it via API
    setRemovingBg({ ...removingBg, [idx]: true });
    try {
      const res = await fetch("/api/remove-logo-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: logo.srcOriginal ?? logo.src }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `שגיאה ${res.status}`);
      }
      const { url } = await res.json();
      updateLogo(idx, {
        transparent: true,
        src: url,
        srcTransparent: url,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingBg({ ...removingBg, [idx]: false });
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Read as a data URL so the logo stays embedded in the project state.
      // We were posting to /api/upload-logo and saving under public/, but that
      // folder is ephemeral inside the Coolify container — each redeploy wiped
      // the file, leaving a broken image icon. Data URLs survive everything
      // (IndexedDB autosave, project export, page reload).
      if (file.size > 5 * 1024 * 1024) throw new Error(labels.tooLargeTpl.replace("{{mb}}", "5"));
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(labels.readErr));
        reader.readAsDataURL(file);
      });
      onChange([
        ...logos,
        {
          src: url,
          srcOriginal: url,
          name: file.name.replace(/\.[^.]+$/, ""),
          persistent: true, // watermark by default
          time: 0,
          durationSec: 999,
          position: "top-right",
          transparent: false, // start with original — user toggles "ללא רקע" to remove
          size: "M",
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updateLogo(idx: number, patch: Partial<CustomLogo>) {
    onChange(logos.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLogo(idx: number) {
    onChange(logos.filter((_, i) => i !== idx));
  }

  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/70 font-medium">{labels.personalTitle}</div>
          <div className="text-[10px] text-white/40">
            {labels.personalHint}
          </div>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand-light px-2.5 py-1 rounded-md disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? labels.uploadingBtn : labels.uploadBtn}
        </button>
      </div>
      {/* AI brand-logo explanation + transparent-bg toggle MOVED out of
          this section — Liat asked for a cleaner ordering: custom logo
          first, then a separate "זיהוי לוגואים" block with its own toggle,
          explanation, and detected brands list. See the section below
          in EffectsPanel's brand tab. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden"
        onChange={handleUpload}
      />

      {error && (
        <div className="text-[11px] bg-red-500/10 border border-red-500/30 text-red-200 rounded p-2">
          ⚠️ {error}
        </div>
      )}

      {/* Empty-state hint — Liat asked where size/position controls are.
          They appear PER-LOGO after upload (see the card below). For
          auto-detected brand logos (Amazon, Instagram, etc.) the same
          PX + 6-position popover lives in the "AI זיהה" panel above the
          editor — tap any brand chip to open it. */}
      {logos.length === 0 && (
        <div className="text-[10px] text-white/40 leading-relaxed border-t border-white/5 pt-2">
          💡 <strong>{labels.emptyH}</strong>
          <br />
          • <span className="text-white/60">{labels.emptyPK}</span>: {labels.emptyPB}
          <br />
          • <span className="text-white/60">{labels.emptyBK}</span>: {labels.emptyBB}
        </div>
      )}

      {logos.length > 0 && (
        <div className="space-y-2">
          {logos.map((logo, i) => {
            const showAdvanced = advancedOpen[i] ?? false;
            const size = logo.size ?? "M";
            const persistent = logo.persistent ?? true;
            return (
              <div
                key={i}
                className="bg-bg-input border border-white/10 rounded-lg p-2.5 space-y-2.5"
              >
                {/* Top row: thumbnail, name, delete */}
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.src}
                    alt={logo.name || "logo"}
                    style={{
                      width: 36, height: 36, objectFit: "contain",
                      background: logo.transparent ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
                      borderRadius: 4,
                      padding: 3,
                    }}
                  />
                  <div className="flex-1 text-xs font-medium truncate">
                    {logo.name || "logo"}
                  </div>
                  <button
                    onClick={() => removeLogo(i)}
                    className="p-1 text-white/40 hover:text-red-300 hover:bg-red-500/10 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Position: 4 corners */}
                <div>
                  <div className="text-[10px] text-white/40 mb-1">{labels.cornerLabel}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {LOGO_POSITIONS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => updateLogo(i, { position: p.id })}
                        className={`py-1 rounded border text-sm transition-all ${
                          logo.position === p.id
                            ? "border-brand bg-brand/25 text-white"
                            : "border-white/10 bg-bg-card text-white/50 hover:border-white/30"
                        }`}
                      >
                        {p.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size + transparent toggle, side by side. Liat: replace
                    S/M/L + number input with a single slider (same UX as
                    the volume slider she liked). Default 80px = roughly M. */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-white/40 mb-1 flex items-center justify-between">
                      <span>{labels.sizeLabel}</span>
                      <span className="text-[10px] font-mono text-brand-light">{logo.sizePx ?? 80}px</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={240}
                      step={1}
                      value={logo.sizePx ?? 80}
                      onChange={(e) => updateLogo(i, { sizePx: parseInt(e.target.value, 10), size: undefined })}
                      // Visible track — Liat: "הפס לא קיים הוא שקוף".
                      // Native range tracks render invisibly on dark themes.
                      // Linear-gradient gives a colored fill up to the thumb
                      // and a grey rail after it. RTL → fill goes right→left.
                      style={{
                        background: `linear-gradient(to left, rgba(124,58,237,0.85) 0%, rgba(124,58,237,0.85) ${((logo.sizePx ?? 80) - 16) / (240 - 16) * 100}%, rgba(255,255,255,0.15) ${((logo.sizePx ?? 80) - 16) / (240 - 16) * 100}%, rgba(255,255,255,0.15) 100%)`,
                      }}
                      className="w-full h-2 appearance-none rounded-full cursor-pointer accent-brand
                                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-light
                                 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-brand/40
                                 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                                 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                                 [&::-moz-range-thumb]:bg-brand-light [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                    />
                    <div className="flex items-center justify-between text-[9px] text-white/30 mt-0.5">
                      <span>{labels.sizeSmall}</span><span>{labels.sizeMedium}</span><span>{labels.sizeLarge}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 mb-1">
                      {labels.bgLabel} {removingBg[i] && <span className="text-brand-light">{labels.bgProcessing}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => toggleTransparent(i, true)}
                        disabled={removingBg[i]}
                        className={`py-1 rounded border text-[10px] transition-all disabled:opacity-50 ${
                          logo.transparent
                            ? "border-brand bg-brand/25 text-white"
                            : "border-white/10 bg-bg-card text-white/50 hover:border-white/30"
                        }`}
                        title={labels.bgRemovedTitle}
                      >
                        {labels.bgRemoved}
                      </button>
                      <button
                        onClick={() => toggleTransparent(i, false)}
                        disabled={removingBg[i]}
                        className={`py-1 rounded border text-[10px] transition-all disabled:opacity-50 ${
                          !logo.transparent
                            ? "border-brand bg-brand/25 text-white"
                            : "border-white/10 bg-bg-card text-white/50 hover:border-white/30"
                        }`}
                      >
                        {labels.bgOriginal}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced (collapsed): timed appearance */}
                <button
                  onClick={() => setAdvancedOpen({ ...advancedOpen, [i]: !showAdvanced })}
                  className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  {showAdvanced ? labels.advClose : labels.advOpen}
                </button>
                {showAdvanced && (
                  <div className="space-y-2 pl-3 border-l-2 border-white/5">
                    <label className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={persistent}
                        onChange={(e) => updateLogo(i, { persistent: e.target.checked })}
                      />
                      <span className="text-white/70">{labels.watermark}</span>
                    </label>
                    {!persistent && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-white/40">{labels.fromLabel}</span>
                        <input
                          type="number" min={0} step={0.5}
                          value={logo.time ?? 0}
                          onChange={(e) => updateLogo(i, { time: parseFloat(e.target.value) || 0 })}
                          className="w-16 bg-bg-card border border-white/10 rounded px-1 py-0.5"
                        />
                        <span className="text-white/40">{labels.forLabel}</span>
                        <input
                          type="number" min={0.5} step={0.5}
                          value={logo.durationSec ?? 2}
                          onChange={(e) => updateLogo(i, { durationSec: parseFloat(e.target.value) || 1 })}
                          className="w-16 bg-bg-card border border-white/10 rounded px-1 py-0.5"
                        />
                        <span className="text-white/40">{labels.secAbbr}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AspectIcon({ ratio, active }: { ratio: AspectRatio; active: boolean }) {
  const dims: Record<AspectRatio, { w: number; h: number }> = {
    original: { w: 16, h: 11 },
    "9:16": { w: 9, h: 16 },
    "1:1": { w: 12, h: 12 },
    "16:9": { w: 18, h: 10 },
    "4:5": { w: 12, h: 15 },
  };
  const { w, h } = dims[ratio];
  return (
    <div
      className={`border-2 rounded ${active ? "border-white" : "border-white/40"}`}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}
