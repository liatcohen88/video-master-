"use client";

import { Settings2, Cpu } from "lucide-react";
import type { SubtitleSettings } from "@/lib/types";
import { WHISPER_MODELS } from "@/lib/types";
import { useContent } from "@/lib/useContent";

type Props = {
  settings: SubtitleSettings;
  onChange: (settings: SubtitleSettings) => void;
  modelId: string;
  onModelChange: (modelId: string) => void;
};

export default function SubtitleSettingsPanel({
  settings, onChange, modelId, onModelChange,
}: Props) {
  const update = <K extends keyof SubtitleSettings>(
    key: K,
    value: SubtitleSettings[K],
  ) => onChange({ ...settings, [key]: value });

  // Editable model names + all panel labels via CMS
  const hebrewName    = useContent("whisper.modelName.hebrew");
  const universalName = useContent("whisper.modelName.universal");
  const hebrewDesc    = useContent("whisper.modelDesc.hebrew") as string;
  const universalDesc = useContent("whisper.modelDesc.universal") as string;
  const recBadge      = useContent("whisper.recommendedBadge") as string;
  const cTitle        = useContent("settings.title") as string;
  const cModelLabel   = useContent("settings.modelLabel") as string;
  const cMaxLabel     = useContent("settings.maxWords.label") as string;
  const cMaxHint      = useContent("settings.maxWords.hint") as string;
  const cMinLabel     = useContent("settings.minWords.label") as string;
  const cPunctLabel   = useContent("settings.punctuation.label") as string;
  const cPunctHint    = useContent("settings.punctuation.hint") as string;
  const cStretchLabel = useContent("settings.stretch.label") as string;
  const cStretchHint  = useContent("settings.stretch.hint") as string;
  function nameFor(m: { id: string; name: string }) {
    if (m.id === "ivrit-ai/whisper-large-v3-turbo-ct2") return hebrewName;
    if (m.id === "large-v3") return universalName;
    return m.name;
  }
  function descFor(m: { id: string; description: string }) {
    if (m.id === "ivrit-ai/whisper-large-v3-turbo-ct2") return hebrewDesc;
    if (m.id === "large-v3") return universalDesc;
    return m.description;
  }

  return (
    <div className="bg-bg-panel border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-5 h-5 text-brand-light" />
        <h3 className="text-lg font-bold">{cTitle}</h3>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-brand-light" />
          <label className="text-sm font-medium">{cModelLabel}</label>
        </div>
        <div className="space-y-2">
          {WHISPER_MODELS
            // Hide low-quality models per Liat 2026-06-07. Keep only the two
            // production-grade choices: עברית מקצועי + כללי מדויק.
            // Backend still accepts the others for crash-fallback.
            .filter((m) => m.id === "ivrit-ai/whisper-large-v3-turbo-ct2" || m.id === "large-v3")
            .map((m) => {
            const isSelected = modelId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModelChange(m.id)}
                className={`
                  w-full text-right p-3 rounded-xl border transition-all
                  ${isSelected
                    ? "border-brand bg-brand/10 shadow-md shadow-brand/20"
                    : "border-white/10 bg-bg-input hover:border-white/30"}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{nameFor(m)}</span>
                    {m.id === "ivrit-ai/whisper-large-v3-turbo-ct2" && (
                      <span className="text-[10px] bg-accent-pink/20 text-accent-pink px-1.5 py-0.5 rounded-full">
                        {recBadge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">{m.size}</span>
                </div>
                <p className="text-xs text-white/50 mb-2">{descFor(m)}</p>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-white/40">
                    דיוק עברית: <span className="text-yellow-400">{"★".repeat(m.hebrewQuality)}</span>
                    <span className="text-white/10">{"★".repeat(5 - m.hebrewQuality)}</span>
                  </span>
                  <span className="text-white/40">
                    מהירות: <span className="text-cyan-400">{"⚡".repeat(m.speedRealtime)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/5 pt-5" />

      <SliderRow
        label={cMaxLabel}
        hint={cMaxHint}
        value={settings.maxWordsPerLine}
        min={1}
        max={10}
        onChange={(v) => update("maxWordsPerLine", v)}
      />

      <SliderRow
        label={cMinLabel}
        value={settings.minWordsPerLine}
        min={1}
        max={settings.maxWordsPerLine}
        onChange={(v) => update("minWordsPerLine", v)}
      />

      <CheckboxRow
        label={cPunctLabel}
        hint={cPunctHint}
        checked={settings.addPunctuation}
        onChange={(v) => update("addPunctuation", v)}
      />

      <CheckboxRow
        label={cStretchLabel}
        hint={cStretchHint}
        checked={settings.stretchSubtitles}
        onChange={(v) => update("stretchSubtitles", v)}
      />
    </div>
  );
}

function SliderRow({
  label, hint, value, min, max, onChange,
}: {
  label: string; hint?: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-bold text-brand-light bg-brand/10 px-2 py-0.5 rounded-md min-w-[2.5rem] text-center">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function CheckboxRow({
  label, hint, checked, onChange,
}: {
  label: string; hint?: string; checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="
          w-5 h-5 rounded-md border-2 border-white/30 bg-bg-input
          peer-checked:bg-brand peer-checked:border-brand
          transition-colors
        ">
          {checked && (
            <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium group-hover:text-white">{label}</div>
        {hint && <div className="text-xs text-white/40 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}
