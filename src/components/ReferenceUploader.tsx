"use client";

import { useRef, useState, ChangeEvent } from "react";
import { Film, Sparkles, CheckCircle2 } from "lucide-react";
import { REFERENCE_STYLES, type ReferenceStyle } from "@/lib/referenceStyles";

type ReferenceResult = {
  aspect_ratio: string;
  video_aspect: string;
  avg_saturation: number;
  scene_cuts_per_minute: number;
  audio_dynamics_db: number;
  has_face: boolean;
  estimated_style_id: string;
};

type Props = {
  /** Called when analysis completes — caller applies the matched preset */
  onAnalyzed: (matched: ReferenceStyle, raw: ReferenceResult) => void;
};

export default function ReferenceUploader({ onAnalyzed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReferenceResult | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("reference", file);
      const res = await fetch("/api/analyze-reference", { method: "POST", body: fd });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `שגיאה ${res.status}`);
      }
      const data: ReferenceResult = await res.json();
      setResult(data);
      const matched = REFERENCE_STYLES.find((s) => s.id === data.estimated_style_id);
      if (matched) onAnalyzed(matched, data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div className="bg-gradient-to-br from-fuchsia-500/10 via-purple-600/10 to-indigo-500/10 border border-fuchsia-400/30 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold">או — תני לי דוגמת סרטון 🎯</h3>
          <p className="text-xs text-white/50 mt-0.5">
            העלי סרטון רפרנס - AI ינתח את הסטייל ויחיל אותו על הוידאו שלך
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={onChange}
        className="hidden"
      />

      {!busy && !result && (
        <button
          onClick={() => inputRef.current?.click()}
          className="
            w-full py-3 px-4 rounded-xl border-2 border-dashed border-fuchsia-400/40
            bg-fuchsia-500/5 hover:bg-fuchsia-500/15 hover:border-fuchsia-400/60
            transition-all flex items-center justify-center gap-2 text-sm
          "
        >
          <Sparkles className="w-4 h-4 text-fuchsia-300" />
          העלי סרטון רפרנס לניתוח
        </button>
      )}

      {busy && (
        <div className="flex items-center gap-3 text-sm text-fuchsia-200 py-3">
          <div className="w-4 h-4 border-2 border-fuchsia-300/30 border-t-fuchsia-300 rounded-full animate-spin" />
          AI מנתח את הרפרנס... (יכול לקחת 30-60 שניות)
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-bold text-emerald-200">הוחל אוטומטית!</div>
              <div className="text-xs text-emerald-200/70 mt-0.5">
                תואם הכי טוב ל-{REFERENCE_STYLES.find((s) => s.id === result.estimated_style_id)?.name ?? result.estimated_style_id}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Stat label="יחס תצוגה" value={result.aspect_ratio} />
            <Stat label="חיתוכים לדקה" value={result.scene_cuts_per_minute.toFixed(1)} />
            <Stat label="ריוויית" value={`${Math.round(result.avg_saturation * 100)}%`} />
            <Stat label="דינמיקת אודיו" value={`${result.audio_dynamics_db.toFixed(1)} dB`} />
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-fuchsia-300/70 hover:text-fuchsia-200 underline"
          >
            נסי רפרנס אחר
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-input rounded-md px-2 py-1.5">
      <div className="text-white/40 text-[10px]">{label}</div>
      <div className="font-bold text-xs">{value}</div>
    </div>
  );
}
