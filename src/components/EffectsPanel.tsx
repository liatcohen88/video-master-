"use client";

import { Crop, Scissors, ZoomIn, Palette, Sparkles, Layers, ImagePlus, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { VideoEffects, AspectRatio } from "@/lib/types";
import { ASPECT_RATIO_INFO } from "@/lib/types";
import { ANIMATIONS } from "@/lib/subtitleAnimations";
import { DYNAMIC_BACKGROUNDS } from "@/lib/dynamicBackgrounds";
import LottieGallery from "./LottieGallery";

type Props = {
  effects: VideoEffects;
  onChange: (e: VideoEffects) => void;
};

const ASPECT_RATIOS: AspectRatio[] = ["original", "9:16", "1:1", "16:9", "4:5"];

export default function EffectsPanel({ effects, onChange }: Props) {
  const update = <K extends keyof VideoEffects>(
    key: K,
    value: VideoEffects[K],
  ) => onChange({ ...effects, [key]: value });

  return (
    <div className="space-y-5">
      {/* Aspect ratio */}
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

      {/* Silence cut */}
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

      {/* Zoom */}
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
      </Section>

      {/* Subtitle entrance animation */}
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
        {effects.subtitleAnimation === "auto-mix" && (
          <p className="text-[11px] text-emerald-300/80 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
            🎲 AI ייתן לכל כתובית אנימציה שונה — לא משעמם, ואו!
          </p>
        )}
      </Section>

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

      {/* Brand logos — global background toggle + custom logo upload */}
      <Section icon={<ImagePlus className="w-4 h-4" />} title="לוגואים">
        <Toggle
          label="הסר רקע מהלוגואים"
          hint="לוגואים צפים על הוידאו ללא הקלף הלבן (עם drop-shadow)"
          checked={effects.transparentLogoBg ?? false}
          onChange={(v) => update("transparentLogoBg", v)}
        />
        <CustomLogoSection
          logos={effects.customLogos ?? []}
          onChange={(logos) => update("customLogos", logos)}
        />
      </Section>

      {/* Cinematic color grading */}
      <Section icon={<Palette className="w-4 h-4" />} title="תיקון צבע קולנועי">
        <Toggle
          label="לוק קולנועי אוטומטי"
          hint="הרמת צללים, חימום highlights, עלייה קלה בריוויית - מראה מקצועי"
          checked={effects.cinematicColor ?? false}
          onChange={(v) => update("cinematicColor", v)}
        />
      </Section>
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
  logos, onChange,
}: { logos: CustomLogo[]; onChange: (v: CustomLogo[]) => void }) {
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
          <div className="text-xs text-white/70 font-medium">לוגו הלקוח (Watermark)</div>
          <div className="text-[10px] text-white/40">
            מוצג כל הסרטון בפינה — מיתוג קבוע
          </div>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand-light px-2.5 py-1 rounded-md disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "מעלה..." : "+ העלי לוגו"}
        </button>
      </div>
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

                {/* Size + transparent toggle, side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-white/40 mb-1">גודל</div>
                    <div className="grid grid-cols-3 gap-1">
                      {LOGO_SIZES.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateLogo(i, { size: s })}
                          className={`py-1 rounded border text-[11px] font-bold transition-all ${
                            size === s
                              ? "border-brand bg-brand/25 text-white"
                              : "border-white/10 bg-bg-card text-white/50 hover:border-white/30"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
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
