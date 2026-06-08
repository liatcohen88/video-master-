"use client";

import { Brain, Check, User, Crop, Wand2 } from "lucide-react";
import type { VideoAnalysis } from "@/lib/types";

const MODE_LABEL: Record<string, string> = {
  subtitles_only: "כתוביות בלבד",
  basic_effects: "אפקטים בסיס",
  podcast: "פודקאסט",
  advanced_effects: "אפקטים מתקדמים",
};

type Props = {
  analysis: VideoAnalysis;
  onMaximize?: () => void;
};

export default function AiDecisionsBanner({ analysis, onMaximize }: Props) {
  return (
    <div className="bg-gradient-to-r from-brand/20 via-accent-pink/15 to-brand/20 border border-brand/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-brand/30 rounded-lg">
          <Brain className="w-4 h-4 text-brand-light" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold">AI ערך לך את הסרטון</h3>
          <p className="text-[11px] text-white/50">
            בדקי, ערכי טקסטים אם צריך, ולחצי ייצוא
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Decision
          icon={<User className="w-3.5 h-3.5" />}
          label="זיהוי דובר"
          value={
            analysis.is_talking_head
              ? `${Math.round(analysis.face_detection_rate * 100)}% מהזמן`
              : "לא זוהה"
          }
          confident={analysis.is_talking_head}
        />
        <Decision
          icon={<Crop className="w-3.5 h-3.5" />}
          label="יחס תצוגה"
          value={analysis.recommended_aspect === "original" ? "מקורי" : analysis.recommended_aspect}
          confident={true}
        />
        <Decision
          icon={<Wand2 className="w-3.5 h-3.5" />}
          label="סגנון עריכה"
          value={MODE_LABEL[analysis.recommended_mode] || analysis.recommended_mode}
          confident={true}
        />
        <Decision
          icon={<Check className="w-3.5 h-3.5" />}
          label="תבנית כתוביות"
          value={analysis.recommended_template}
          confident={true}
        />
      </div>

      {analysis.is_talking_head && (
        <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
          ✨ AI מצאה את הפנים שלך ב-{Math.round(analysis.face_detection_rate * 100)}% מהפריימים.
          החיתוך ל-{analysis.recommended_aspect} שומר אותך במרכז הפריים אוטומטית.
        </p>
      )}

      {/* "ערוך לי הכל" button removed — AI already auto-applies its
          recommendations on transcription, so this was redundant.
          Code retained in case we want to re-enable as an advanced override.
      {onMaximize && (
        <button onClick={onMaximize}>
          ⚡ ערוך לי הכל במצב הכי מקצועי
        </button>
      )}
      */}
    </div>
  );
}

function Decision({
  icon, label, value, confident,
}: { icon: React.ReactNode; label: string; value: string; confident: boolean }) {
  return (
    <div
      className={`
        rounded-xl p-2.5 border
        ${confident
          ? "bg-bg-card border-brand/30"
          : "bg-bg-panel border-white/10 opacity-60"}
      `}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-white/50 uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-bold truncate">{value}</div>
    </div>
  );
}
