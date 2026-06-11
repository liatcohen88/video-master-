"use client";

import { FileText, Sparkles, Mic, Flame, Check } from "lucide-react";
import type { EditMode } from "@/lib/types";
import { useContent } from "@/lib/useContent";
import MasterCoin from "@/components/MasterCoin";

const VISUAL: Record<EditMode, {
  icon: typeof Flame;
  gradient: string;
  status: "ready" | "beta" | "coming-soon";
}> = {
  subtitles_only:   { icon: FileText, gradient: "from-slate-500 via-slate-600 to-slate-800",   status: "ready" },
  basic_effects:    { icon: Sparkles, gradient: "from-cyan-400 via-blue-500 to-purple-600",    status: "beta"  },
  podcast:          { icon: Mic,      gradient: "from-amber-400 via-orange-500 to-red-600",    status: "beta"  },
  advanced_effects: { icon: Flame,    gradient: "from-pink-500 via-fuchsia-500 to-purple-700", status: "ready" },
};

// "basic_effects" intentionally omitted — only 3 user-facing modes.
// The type/defaults still include it for backward compatibility with old saved
// projects, but it's never offered in the picker.
const ORDER: EditMode[] = ["subtitles_only", "podcast", "advanced_effects"];


type Props = {
  selected: EditMode;
  onChange: (mode: EditMode) => void;
};

export default function ModeSelector({ selected, onChange }: Props) {
  // ALL strings pulled from CMS — admin can edit each one in /admin → תוכן
  const sectionTitle    = useContent("mode.sectionTitle");
  const sectionSubtitle = useContent("mode.sectionSubtitle");
  const currency        = (useContent("brand.currencyName") as string) || "קרדיטים";

  const subTitle = useContent("mode.subtitles_only.title");
  const subTag   = useContent("mode.subtitles_only.tagline");
  const subDesc  = useContent("mode.subtitles_only.desc");
  const subFeat  = useContent("mode.subtitles_only.features");

  const basTitle = useContent("mode.basic_effects.title");
  const basTag   = useContent("mode.basic_effects.tagline");
  const basDesc  = useContent("mode.basic_effects.desc");
  const basFeat  = useContent("mode.basic_effects.features");

  const podTitle = useContent("mode.podcast.title");
  const podTag   = useContent("mode.podcast.tagline");
  const podDesc  = useContent("mode.podcast.desc");
  const podFeat  = useContent("mode.podcast.features");

  const advTitle = useContent("mode.advanced_effects.title");
  const advTag   = useContent("mode.advanced_effects.tagline");
  const advDesc  = useContent("mode.advanced_effects.desc");
  const advFeat  = useContent("mode.advanced_effects.features");

  // Credit cost per mode — also from CMS
  const costSubtitles = useContent("pricing.cost.subtitles_only");
  const costBasic     = useContent("pricing.cost.basic_effects");
  const costPodcast   = useContent("pricing.cost.podcast");
  const costAdvanced  = useContent("pricing.cost.advanced_effects");

  const TEXT: Record<EditMode, { title: string; tagline: string; description: string; features: string[]; cost: number }> = {
    subtitles_only:   { title: subTitle, tagline: subTag, description: subDesc, features: parseFeatures(subFeat), cost: costSubtitles },
    basic_effects:    { title: basTitle, tagline: basTag, description: basDesc, features: parseFeatures(basFeat), cost: costBasic },
    podcast:          { title: podTitle, tagline: podTag, description: podDesc, features: parseFeatures(podFeat), cost: costPodcast },
    advanced_effects: { title: advTitle, tagline: advTag, description: advDesc, features: parseFeatures(advFeat), cost: costAdvanced },
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold">{sectionTitle}</h3>
        <p className="text-sm text-white/50 mt-1">{sectionSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ORDER.map((id) => {
          const v = VISUAL[id];
          const t = TEXT[id];
          const Icon = v.icon;
          const isSelected = selected === id;
          const disabled = v.status === "coming-soon";

          return (
            <button
              key={id}
              onClick={() => !disabled && onChange(id)}
              disabled={disabled}
              className={`
                relative overflow-hidden rounded-2xl p-4 text-right card-glow
                border-2 transition-all duration-200 h-full flex flex-col
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                ${isSelected
                  ? "border-brand bg-bg-card shadow-xl shadow-brand/20"
                  : "border-white/10 bg-bg-panel hover:border-white/30"}
              `}
            >
              {isSelected && (
                <div className="absolute top-3 left-3 bg-brand rounded-full p-1 shadow-lg shadow-brand/50">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${v.gradient}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>

              <h4 className="text-base font-bold mb-1">{t.title}</h4>
              <p className="text-xs text-white/50 mb-3">{t.tagline}</p>

              {/* Credit cost — hero element of the card. Advanced mode is
                  DYNAMIC: shows a range "25-40" because each extra effect
                  the user enables raises the price up to the 40 cap. The
                  other modes are fixed (subtitles_only: 10, podcast: 20). */}
              <div className="flex flex-col gap-1 mb-3">
                <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-400/20 to-amber-500/10 border border-yellow-400/40 text-yellow-200 text-sm font-bold px-3 py-1.5 rounded-xl">
                  <MasterCoin size={16} />
                  {id === "advanced_effects" ? (
                    <>
                      <span className="text-base font-black">{t.cost}-40</span>
                      <span className="text-[11px] font-normal">{currency} לסרטון</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base font-black">{t.cost}</span>
                      <span className="text-[11px] font-normal">{currency} לסרטון</span>
                    </>
                  )}
                </div>
                {id === "advanced_effects" && (
                  <span className="text-[10px] text-yellow-400/70 pr-1">
                    💡 משתנה לפי כמות האפקטים — עד 40 מאסטרים
                  </span>
                )}
              </div>

              <ul className="space-y-1 pt-2 border-t border-white/5">
                {t.features.map((f, i) => (
                  <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                    <span className="text-brand-light mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function parseFeatures(raw: string): string[] {
  return raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}
