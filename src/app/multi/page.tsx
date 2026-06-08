"use client";

import { useState } from "react";
import { Film, Sparkles, X, Loader2, Download } from "lucide-react";

type ResultPick = {
  scriptIdx: number;
  scriptText: string;
  videoIdx: number;
  srcStart: number;
  srcEnd: number;
  matchScore: number;
  matchedSubText: string;
};
type EditResult = {
  videoBase64: string;
  picks: ResultPick[];
  durationSec: number;
};

export default function MultiEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [script, setScript] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [result, setResult] = useState<EditResult | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= 8) break;
      next.push(f);
    }
    setFiles(next);
  }

  async function submit() {
    if (files.length < 2) {
      setStatus("error"); setStatusMsg("צריך לפחות 2 סרטונים");
      return;
    }
    if (script.trim().length < 5) {
      setStatus("error"); setStatusMsg("הדביקי תסריט");
      return;
    }
    setStatus("working");
    setStatusMsg("מתמלל סרטונים ומאחד...");
    setResult(null);

    const fd = new FormData();
    fd.append("script", script);
    for (const f of files) fd.append("video", f);

    try {
      const res = await fetch("/api/multi-edit", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "שגיאה");
      setResult(j as EditResult);
      setStatus("done");
      setStatusMsg(`הושלם — ${j.picks.length} פלחים, ${j.durationSec.toFixed(1)} שניות`);
    } catch (e: unknown) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const videoUrl = result
    ? URL.createObjectURL(b64ToBlob(result.videoBase64, "video/mp4"))
    : null;

  return (
    <div dir="rtl" className="min-h-screen bg-bg p-6 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-brand/20">
            <Sparkles className="w-6 h-6 text-brand-light" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">מולטי-וידאו AI Editor</h1>
            <p className="text-xs text-white/50">
              העלי 2–8 סרטונים, הדביקי תסריט/נרטיב, וה-AI יחתוך ויאחד לסרטון אחד
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: inputs */}
          <div className="space-y-4">
            <div className="bg-bg-card border border-white/10 rounded-xl p-4">
              <label className="text-sm font-bold flex items-center gap-2 mb-3">
                <Film className="w-4 h-4" />
                סרטוני מקור ({files.length}/8)
              </label>
              <input
                type="file" multiple accept="video/*"
                onChange={(e) => addFiles(e.target.files)}
                className="w-full text-xs text-white/60 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-brand/20 file:text-brand-light hover:file:bg-brand/30"
              />
              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs bg-bg-input rounded-md px-2 py-1.5">
                      <span className="w-5 h-5 rounded bg-brand/30 flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-white/40">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="text-white/40 hover:text-red-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-bg-card border border-white/10 rounded-xl p-4">
              <label className="text-sm font-bold mb-2 block">תסריט / נרטיב</label>
              <p className="text-[11px] text-white/40 mb-2">
                שורה לכל פלח, או פסיקים. ה-AI יבחר איזה וידאו לשים לפי המילים שמופיעות בכל פלח.
              </p>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={10}
                placeholder="היי, היום אני אספר לכם על השבוע הזה.&#10;התחלנו בבוקר במשרד.&#10;אחר כך נסענו לפגישה חשובה.&#10;לסיום, הופתעתי לטובה מהתוצאות."
                className="w-full bg-bg-input border border-white/10 rounded-md px-3 py-2 text-sm leading-relaxed resize-none"
              />
              <div className="text-[10px] text-white/30 mt-1">
                {script.split(/(?<=[.!?])\s+|\n+/g).filter((s) => s.trim()).length} פלחים זוהו
              </div>
            </div>

            <button
              onClick={submit}
              disabled={status === "working"}
              className="w-full py-3 bg-brand hover:bg-brand/80 disabled:bg-brand/30 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              {status === "working" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {status === "working" ? "מעבד..." : "צרי סרטון מאוחד"}
            </button>

            {statusMsg && (
              <div className={`text-xs rounded-lg p-3 border
                ${status === "error" ? "bg-red-500/10 border-red-500/30 text-red-200" :
                  status === "done" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" :
                  "bg-white/5 border-white/10 text-white/70"}`}>
                {statusMsg}
              </div>
            )}
          </div>

          {/* Right: result */}
          <div className="space-y-4">
            <div className="bg-bg-card border border-white/10 rounded-xl p-4 min-h-[280px] flex items-center justify-center">
              {videoUrl ? (
                <video src={videoUrl} controls className="w-full rounded-lg" />
              ) : (
                <div className="text-center text-white/40 text-sm">
                  הסרטון המאוחד יופיע כאן אחרי עיבוד
                </div>
              )}
            </div>

            {videoUrl && (
              <a
                href={videoUrl}
                download={`multi-edit-${Date.now()}.mp4`}
                className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> הורדה
              </a>
            )}

            {result?.picks?.length ? (
              <div className="bg-bg-card border border-white/10 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
                  שיוך פלחים → סרטוני מקור
                </h3>
                <ol className="space-y-2">
                  {result.picks.map((p) => (
                    <li key={p.scriptIdx} className="text-[11px] flex gap-2">
                      <span className="w-5 h-5 rounded bg-brand/30 flex items-center justify-center font-mono shrink-0">
                        {p.scriptIdx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-white/90">&ldquo;{p.scriptText}&rdquo;</div>
                        <div className="text-white/40 mt-0.5">
                          וידאו #{p.videoIdx + 1} · {p.srcStart.toFixed(1)}s–{p.srcEnd.toFixed(1)}s
                          {p.matchScore > 0
                            ? ` · התאמה ${p.matchScore.toFixed(2)}: "${p.matchedSubText}"`
                            : " · ברירת מחדל (אין התאמה טקסטואלית)"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-white/30">
          💡 הסרטון המאוחד הוא MP4 גולמי בלי כתוביות — אחרי שתאשרי, אפשר להעלות אותו ל-/ הראשי לעריכת כתוביות + אפקטים.
        </div>
      </div>
    </div>
  );
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
