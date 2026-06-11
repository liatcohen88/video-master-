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
import { INTRO_ANIMATIONS } from "@/lib/introAnimations";
import { useContent } from "@/lib/useContent";
import { getSfxAsset } from "@/lib/sfxLibrary";
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
  const visibleIntros = INTRO_ANIMATIONS.filter((i) => !hiddenIntros?.[i.id]);

  // Which tabs to show. A tab disappears when EVERY block inside it is
  // disabled for the current edit mode — so "subtitles_only" gets the
  // skinniest panel (only Captions + maybe Color), not 4 empty boxes.
  const tabsAvailable: { id: EffectsTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    {
      id: "magic",
      label: "אפקטים מיוחדים",
      icon: <Wand2 className="w-3.5 h-3.5" />,
      visible: caps.silenceCut || caps.faceZoom || caps.aspectCrop,
    },
    {
      id: "color",
      label: "צבע",
      icon: <Palette className="w-3.5 h-3.5" />,
      // Color filters are pure CSS — available in every mode (subtitles_only
      // included). Cinematic toggle stays gated by colorGrade cap.
      visible: true,
    },
    {
      id: "brand",
      label: "לוגואים",
      icon: <ImagePlus className="w-3.5 h-3.5" />,
      visible: caps.logo,
    },
    {
      id: "sound",
      label: "סאונדים",
      icon: <Music className="w-3.5 h-3.5" />,
      // Sounds tab is universal — every mode can attach music and tune
      // volumes, even subtitles_only.
      visible: true,
    },
    {
      id: "captions",
      label: "כתוביות",
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
      <Section icon={<Crop className="w-4 h-4" />} title="יחס תצוגה">
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
              מיקוד החיתוך
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
                  {f === "top" ? "למעלה" : f === "center" ? "מרכז" : "למטה"}
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
      <Section icon={<Sparkles className="w-4 h-4" />} title="אנימציית כניסה לסרטון">
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
          האנימציה רצה רק בשנייה הראשונה. נגן את התצוגה מהתחלה כדי לראות.
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
      <Section icon={<Scissors className="w-4 h-4" />} title="חיתוך שתיקות">
        <Toggle
          label="חיתוך אוטומטי של שתיקות"
          hint="הסר רגעים שקטים ארוכים בין משפטים — וידאו, אודיו וכתוביות מסונכרנים"
          checked={effects.cutSilence}
          onChange={(v) => update("cutSilence", v)}
        />
        {effects.cutSilence && (
          <>
            <Field label={`רגישות: ${effects.silenceThresholdDb} dB`} hint="ערך נמוך = חיתוך רק שקט מוחלט. ערך גבוה = חיתוך גם רעש רקע">
              <input
                type="range" min={-60} max={-20}
                value={effects.silenceThresholdDb}
                onChange={(e) => update("silenceThresholdDb", parseInt(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field label={`מינ' משך שתיקה: ${effects.silenceMinDurationSec.toFixed(1)} שנ'`}>
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
      <Section icon={<ZoomIn className="w-4 h-4" />} title="זום על דובר">
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "none", label: "ללא", desc: "וידאו מקורי" },
            { id: "punch", label: "פאנץ' חכם 🎯", desc: "זום ברגעי אמפזיס בלבד" },
            { id: "subtle", label: "עדין", desc: "זום קל איטי לאורך הסרטון" },
            { id: "kenburns", label: "Ken Burns", desc: "זום + תנועה" },
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
            🎯 AI מצא {effects.emphasisMoments.length} רגעי אמפזיס בסרטון — זום יופעל רק שם.
          </p>
        )}

        {effects.zoomEffect !== "none" && (
          <Field label={`עוצמת זום: ${Math.round(effects.zoomIntensity * 100)}%`}>
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
          label="🔥 Beat-Drop Zoom (וואו!)"
          hint="זום קצרצר (3%) על מילים חזקות: וואו, אש, חייבים, מטורף, ענק... זה הטריק של עורכי רילס מקצועיים"
          checked={effects.beatDropZoom ?? false}
          onChange={(v) => update("beatDropZoom", v)}
        />
        <Toggle
          label="✨ Particle Burst (חלקיקים)"
          hint="פריצת חלקיקים צבעוניים על מילות מפתח. נראה כמו רילס ויראלי"
          checked={effects.particleBurst ?? false}
          onChange={(v) => update("particleBurst", v)}
        />
        <Toggle
          label="💥 Punch-Shake (רעידת מסך)"
          hint="רעידה עדינה (~200ms) על מילות מפתח. הופך את המסר לחזק וקולנועי"
          checked={effects.punchShake ?? false}
          onChange={(v) => update("punchShake", v)}
        />
        <Toggle
          label="🎭 מצב דרמה (שחור-לבן + סטינג)"
          hint='כשהדובר אומר "אני לא מאמין", "זה לא קורה לי", "אין מצב" — הוידאו קופץ לשחור-לבן ל-1.2 שניות + סטינג דרמטי. הטריק של ריילס ויראליים.'
          checked={effects.dramaMode ?? false}
          onChange={(v) => update("dramaMode", v)}
        />
      </Section>
      )}

      {/* Subtitle entrance animation (under "כתוביות" tab) — every mode */}
      {tab === "captions" && (
      <Section icon={<Sparkles className="w-4 h-4" />} title="אנימציית כניסה לכתוביות">
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
        <Section icon={<Music className="w-4 h-4" />} title="מוזיקת רקע">
          <BgMusicControls
            url={effects.bgMusicUrl}
            videoVolume={effects.videoVolume ?? 1}
            musicVolume={effects.bgMusicVolume ?? 0.25}
            onUrl={(v) => update("bgMusicUrl", v)}
            onVideoVolume={(v) => update("videoVolume", v)}
            onMusicVolume={(v) => update("bgMusicVolume", v)}
          />
        </Section>

        {/* Master SFX volume — one knob that scales every sound effect
            (auto-elements, manual emojis, intro SFX, logo SFX, Lottie SFX)
            so the user can balance speech vs effects without touching each
            element individually. */}
        <Section icon={<Volume2 className="w-4 h-4" />} title="עוצמת סאונד אפקטים">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/70">משפיע על כל הצלילים בסרטון</span>
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
      <Section icon={<Palette className="w-4 h-4" />} title="פילטר צבע">
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
          הפילטרים מוחלים על כל הסרטון בתצוגה החיה ובייצוא. ניתן לשלב עם הלוק הקולנועי.
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
      <Section icon={<ImagePlus className="w-4 h-4" />} title="לוגו אישי ומיתוג">
        <CustomLogoSection
          logos={effects.customLogos ?? []}
          onChange={(logos) => update("customLogos", logos)}
          transparentBg={effects.transparentLogoBg ?? false}
          onTransparentBgChange={(v) => update("transparentLogoBg", v)}
        />
      </Section>
      )}

      {/* AI brand-logo detection — full block. Order per Liat:
          (1) toggle, (2) explanation paragraph, (3) linked transparency
          toggle, (4) detected brands list with size + position controls. */}
      {tab === "brand" && caps.logo && (
      <Section icon={<Sparkles className="w-4 h-4" />} title="זיהוי לוגואים אוטומטי">
        {/* 1. The master toggle */}
        <Toggle
          label="זיהוי לוגואים של מותגים גדולים"
          hint="ה-AI יזהה אזכורים של אמזון, אינסטגרם, אפל וכו׳ בכתוביות ויציג את הלוגו על הוידאו. כיבוי = הלוגואים לא יופיעו."
          checked={effects.brandLogosDetect !== false}
          onChange={(v) => update("brandLogosDetect", v)}
        />

        {/* 2 + 3. Explanation + linked transparency toggle. Only show when
            detection is on — otherwise it's noise. */}
        {effects.brandLogosDetect !== false && (
          <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-lg p-3 space-y-2.5 mt-3">
            <div className="text-[11px] text-cyan-200/90 leading-relaxed">
              💡 <span className="font-bold">ה-AI מזהה לוגואים של חברות גדולות.</span> רשמו בכתוביות
              {" "}<span className="font-mono">אינסטגרם</span>, <span className="font-mono">אליאקספרס</span>, <span className="font-mono">שופיפיי</span>{" "}
              וכו׳ — הלוגו יזוהה ויתווסף אוטומטית לסרטון.
            </div>
            <label className="flex items-center justify-between gap-3 pt-2 border-t border-cyan-500/20 cursor-pointer">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">הסר רקע לבן מהלוגו שזוהה</div>
                <div className="text-[10px] text-white/50">
                  אם הלוגו על רקע לבן — מסיר אותו כך שהלוגו צף נקי על הסרטון
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
          />
        )}
      </Section>
      )}

      {/* Cinematic color grading (under "צבע" tab, advanced mode only) */}
      {tab === "color" && caps.colorGrade && (
      <Section icon={<Palette className="w-4 h-4" />} title="תיקון צבע קולנועי">
        <Toggle
          label="לוק קולנועי אוטומטי"
          hint="הרמת צללים, חימום highlights, עלייה קלה בריוויית - מראה מקצועי"
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
}: {
  subtitles: Subtitle[];
  sizePx: Record<string, number>;
  position: Record<string, BrandPos>;
  onSize: (key: string, px: number | undefined) => void;
  onPosition: (key: string, p: BrandPos | undefined) => void;
}) {
  const brands = detectBrands(subtitles);
  if (brands.length === 0) {
    return (
      <div className="mt-3 text-[10px] text-white/40 border-t border-white/5 pt-3">
        עוד לא זוהו מותגים בכתוביות. ברגע שהדובר יזכיר אמזון / אינסטגרם / אפל וכו׳, יופיע כאן כרטיס לכל מותג עם בקרות גודל ומיקום.
      </div>
    );
  }
  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
        {brands.length} מותגים זוהו — גודל ומיקום לכל אחד
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
                <span>גודל</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-brand-light">{curPx ?? 80}px</span>
                  {typeof curPx === "number" && (
                    <button onClick={() => onSize(k, undefined)}
                      className="text-white/40 hover:text-white" title="ברירת מחדל">
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
  const label = !currentSfxId ? "ללא צליל"
    : currentSfxId === "none" ? "מבוטל"
    : getSfxAsset(currentSfxId)?.label ?? currentSfxId;
  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="text-[10px] text-white/40 mb-1.5">🔊 צליל לאנימציה (אופציונלי)</div>
      <button
        onClick={(e) => { setAnchor(e.currentTarget.getBoundingClientRect()); setOpen(true); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors ${
          currentSfxId && currentSfxId !== "none"
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
            : "border-white/10 bg-bg-input text-white/70 hover:border-white/30"
        }`}
      >
        <span>{currentSfxId && currentSfxId !== "none" ? "🎵" : "🔇"} {label}</span>
        <span className="text-white/40">לחצי לבחירה</span>
      </button>
      {open && (
        <SfxPicker
          open
          currentSfxId={currentSfxId}
          defaultLabel="ללא צליל"
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
}: {
  url?: string;
  videoVolume: number;
  musicVolume: number;
  onUrl: (v: string | undefined) => void;
  onVideoVolume: (v: number) => void;
  onMusicVolume: (v: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string>("");

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const obj = URL.createObjectURL(f);
    setName(f.name);
    onUrl(obj);
  }
  function clearMusic() {
    if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }
    setName("");
    onUrl(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {!url ? (
        <>
          <p className="text-[11px] text-white/40">
            העלי קובץ MP3 / WAV / OGG — הוא יתנגן ברקע ויסונכרן עם הנגינה והעצירה של הסרטון.
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
              🎵 {name || "מוזיקת רקע"}
            </div>
            <div className="text-[10px] text-white/40">פעיל — סנכרון עם הסרטון</div>
          </div>
          <button onClick={clearMusic}
            className="p-1.5 text-white/50 hover:text-red-300" title="הסר">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label className="block">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-white/80">
              <Volume2 className="w-3.5 h-3.5" /> ווליום הסרטון
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
              <Music className="w-3.5 h-3.5" /> ווליום המוזיקה
            </span>
            <span className="text-white/40">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(musicVolume * 100)}
            onChange={(e) => onMusicVolume(parseInt(e.target.value) / 100)}
            className="w-full mt-1" />
        </label>
        <p className="text-[10px] text-white/40">
          טיפ: השאירי את המוזיקה ב-15-30% — הקול שלך חייב להוביל.
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

function CustomLogoSection({
  logos, onChange, transparentBg, onTransparentBgChange,
}: {
  logos: CustomLogo[];
  onChange: (v: CustomLogo[]) => void;
  /** Whether AI-detected brand logos (AliExpress etc.) should be auto-cleaned of white background. */
  transparentBg: boolean;
  onTransparentBgChange: (v: boolean) => void;
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
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/upload-logo", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `שגיאה ${res.status}`);
      }
      const { url } = await res.json();
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
          <div className="text-xs text-white/70 font-medium">לוגו אישי</div>
          <div className="text-[10px] text-white/40">
            מיתוג קבוע — ניתן לבחור מיקום
          </div>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand-light px-2.5 py-1 rounded-md disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "מעלה..." : "+ העלה לוגו"}
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
          💡 <strong>איפה הגודל והמיקום?</strong>
          <br />
          • <span className="text-white/60">לוגו אישי</span>: בקרות גודל (S/M/L + PX) ומיקום (4 פינות)
          יופיעו <strong>אחרי שתעלי לוגו</strong> ☝️
          <br />
          • <span className="text-white/60">לוגואי מותגים (אמזון/אינסטגרם)</span>: לחיצה על השבב
          בפאנל <strong>"AI זיהה"</strong> בראש הדף פותחת בורר PX + 6 מיקומים.
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
                  <div className="text-[10px] text-white/40 mb-1">פינה</div>
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
                      <span>גודל</span>
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
                      <span>קטן</span><span>בינוני</span><span>גדול</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 mb-1">
                      רקע {removingBg[i] && <span className="text-brand-light">(מעבד...)</span>}
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
                        title="הסרה אוטומטית של צבע הרקע מהתמונה"
                      >
                        ללא רקע
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
                        מקורי
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced (collapsed): timed appearance */}
                <button
                  onClick={() => setAdvancedOpen({ ...advancedOpen, [i]: !showAdvanced })}
                  className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  {showAdvanced ? "▾" : "▸"} מתקדם (להציג רק חלק מהזמן)
                </button>
                {showAdvanced && (
                  <div className="space-y-2 pl-3 border-l-2 border-white/5">
                    <label className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={persistent}
                        onChange={(e) => updateLogo(i, { persistent: e.target.checked })}
                      />
                      <span className="text-white/70">תמיד גלוי (watermark קבוע)</span>
                    </label>
                    {!persistent && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-white/40">מ-</span>
                        <input
                          type="number" min={0} step={0.5}
                          value={logo.time ?? 0}
                          onChange={(e) => updateLogo(i, { time: parseFloat(e.target.value) || 0 })}
                          className="w-16 bg-bg-card border border-white/10 rounded px-1 py-0.5"
                        />
                        <span className="text-white/40">שנ' למשך</span>
                        <input
                          type="number" min={0.5} step={0.5}
                          value={logo.durationSec ?? 2}
                          onChange={(e) => updateLogo(i, { durationSec: parseFloat(e.target.value) || 1 })}
                          className="w-16 bg-bg-card border border-white/10 rounded px-1 py-0.5"
                        />
                        <span className="text-white/40">שנ'</span>
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
