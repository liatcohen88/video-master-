"use client";

import { useEffect, useState } from "react";
import { Wand2, Download, Sparkles, ArrowLeft } from "lucide-react";

import VideoUploader from "@/components/VideoUploader";
import ModeSelector from "@/components/ModeSelector";
import SubtitleSettingsPanel from "@/components/SubtitleSettingsPanel";
import ExportFormatToggle from "@/components/ExportFormatToggle";
import VideoPreview from "@/components/VideoPreview";
import StylePanel from "@/components/StylePanel";
import SubtitleEditor from "@/components/SubtitleEditor";
import AiDetectedPanel from "@/components/AiDetectedPanel";
import ReferenceStyleGallery from "@/components/ReferenceStyleGallery";
import ReferenceUploader from "@/components/ReferenceUploader";
import type { ReferenceStyle } from "@/lib/referenceStyles";

import {
  MODE_DEFAULT_EFFECTS,
  MODE_DEFAULT_SETTINGS,
  MODE_DEFAULT_TEMPLATE,
  type EditMode,
  type ExportFormat,
  type Subtitle,
  type SubtitleSettings,
  type SubtitleStyle,
  type VideoAnalysis,
  type VideoEffects,
} from "@/lib/types";
import { TEMPLATES, type SubtitleTemplate } from "@/lib/templates";
import { useContent } from "@/lib/useContent";
import { Coins } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import SavedIndicator from "@/components/SavedIndicator";
import { useAutoSavedState } from "@/lib/useAutoSave";
import { toast } from "@/components/Toaster";

export default function HomePage() {
  // Credit cost per mode — pulled from CMS so admin edits take effect instantly.
  const costSubtitles = useContent("pricing.cost.subtitles_only");
  const costBasic     = useContent("pricing.cost.basic_effects");
  const costPodcast   = useContent("pricing.cost.podcast");
  const costAdvanced  = useContent("pricing.cost.advanced_effects");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // ── Auto-saved project state — survives a page refresh.
  // The video File itself can't be persisted; user has to re-upload if they
  // refresh mid-edit. But subtitles + styling + effects ARE persisted so
  // they don't lose hours of fine-tuning when the browser crashes.
  const [mode, setMode, modeMeta] = useAutoSavedState<EditMode>("mode", "subtitles_only");
  const [exportFormat, setExportFormat] = useAutoSavedState<ExportFormat>("exportFormat", "mp4");
  const [settings, setSettings] = useAutoSavedState<SubtitleSettings>("settings", MODE_DEFAULT_SETTINGS.subtitles_only);

  // After transcription, user picks a template — initialized from mode default
  const initialTemplate = TEMPLATES.find((t) => t.id === MODE_DEFAULT_TEMPLATE.subtitles_only)!;
  const [templateId, setTemplateId] = useAutoSavedState<string>("templateId", initialTemplate.id);
  const [style, setStyle] = useAutoSavedState<SubtitleStyle>("style", initialTemplate.style);

  const [subtitles, setSubtitles] = useAutoSavedState<Subtitle[]>("subtitles", []);
  const [currentTime, setCurrentTime] = useState(0);
  const [phase, setPhase] = useState<"setup" | "editing">("setup");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [whisperModel, setWhisperModel] = useAutoSavedState<string>("whisperModel", "ivrit-ai/whisper-large-v3-turbo-ct2");
  const [effects, setEffects] = useAutoSavedState<VideoEffects>("effects", MODE_DEFAULT_EFFECTS.subtitles_only);

  // Toast once on first paint if we restored saved state from a prior session.
  useEffect(() => {
    if (modeMeta.wasRestored) {
      toast.info("המשך מאיפה שהפסקת — העלי את הסרטון לעריכה");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [activeReferenceId, setActiveReferenceId] = useState<string | undefined>(undefined);

  function handleVideo(file: File) {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    // Reset effects to clean default — drops any leftover depth/parallax
    // toggles from a previous session that could confuse the export.
    setEffects(MODE_DEFAULT_EFFECTS[mode]);
    setDownloadSuccess(null);
    setErrorMessage(null);
  }

  function handleModeChange(m: EditMode) {
    setMode(m);
    // Adjust default settings, template, and effects to match the chosen mode
    setSettings(MODE_DEFAULT_SETTINGS[m]);
    setEffects(MODE_DEFAULT_EFFECTS[m]);
    const tpl = TEMPLATES.find((t) => t.id === MODE_DEFAULT_TEMPLATE[m])!;
    setTemplateId(tpl.id);
    setStyle(tpl.style);
  }

  function handleTemplateChange(t: SubtitleTemplate) {
    setTemplateId(t.id);
    setStyle(t.style);
  }

  function applyReferenceStyle(ref: ReferenceStyle) {
    // Snap mode / template / settings / effects into the preset.
    // Preserve face data and emphasis moments from analysis (those are
    // video-specific, not style-specific).
    setMode(ref.preset.mode);
    setSettings({
      ...MODE_DEFAULT_SETTINGS[ref.preset.mode],
      ...ref.preset.settings,
    });
    const tpl = TEMPLATES.find((t) => t.id === ref.preset.templateId);
    if (tpl) {
      setTemplateId(tpl.id);
      setStyle(tpl.style);
    }
    const merged: VideoEffects = {
      ...MODE_DEFAULT_EFFECTS[ref.preset.mode],
      ...ref.preset.effectsOverride,
      // Keep video-derived fields
      faceCenterX: analysis?.face_detected ? analysis.face_center_x : undefined,
      faceCenterY: analysis?.face_detected ? analysis.face_center_y : undefined,
      emphasisMoments: analysis?.emphasis_moments ?? [],
    };
    setEffects(merged);
    setActiveReferenceId(ref.id);
  }

  async function startTranscription() {
    if (!videoFile) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMessage("מעלה את הסרטון לשרת...");

    try {
      // Run transcription AND analysis in parallel — both need the same upload.
      // We submit twice for simplicity; could be optimized to one upload later.
      const transcribeFd = new FormData();
      transcribeFd.append("video", videoFile);
      transcribeFd.append("maxWordsPerLine", String(settings.maxWordsPerLine));
      transcribeFd.append("model", whisperModel);

      const analyzeFd = new FormData();
      analyzeFd.append("video", videoFile);

      // Run TRANSCRIPTION first (heavy: faster-whisper + 1.5GB model)
      // and ANALYSIS second (MediaPipe). Running both in parallel caused
      // Windows Access Violation crashes (memory contention between
      // native libs). Sequential is slightly slower but reliable.
      setProgressMessage("AI מתמלל את הסרטון...");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: transcribeFd,
      });

      if (!transcribeRes.ok) {
        const errBody = await transcribeRes.json().catch(() => ({}));
        throw new Error(errBody.error || `תמלול נכשל: ${transcribeRes.status}`);
      }

      const transcribeData = await transcribeRes.json();
      if (!transcribeData.subtitles || transcribeData.subtitles.length === 0) {
        throw new Error("לא זוהה דיבור בסרטון");
      }

      setSubtitles(transcribeData.subtitles as Subtitle[]);

      // Now run analysis (face detect + emphasis + recommendations)
      setProgressMessage("AI מנתח את הסרטון (מזהה דובר, מציע סגנון)...");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        body: analyzeFd,
      });

      // Apply analysis recommendations automatically (AI does the editing for you)
      if (analyzeRes.ok) {
        const ana: VideoAnalysis = await analyzeRes.json();
        if (!(ana as unknown as { error?: string }).error) {
          applyAnalysisRecommendations(ana);
        }
      }

      setPhase("editing");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
    }
  }

  function applyAnalysisRecommendations(ana: VideoAnalysis) {
    setAnalysis(ana);

    // 1. Apply recommended mode (sets default settings + effects + template)
    const m = ana.recommended_mode as EditMode;
    setMode(m);
    setSettings(MODE_DEFAULT_SETTINGS[m]);
    const newEffects = { ...MODE_DEFAULT_EFFECTS[m] };

    // 2. Override aspect ratio with recommendation
    newEffects.aspectRatio = ana.recommended_aspect;

    // 3. Use face position for smart cropping
    if (ana.face_detected) {
      newEffects.faceCenterX = ana.face_center_x;
      newEffects.faceCenterY = ana.face_center_y;
    }

    // 4. Use emphasis moments for smart punch zoom
    if (ana.emphasis_moments && ana.emphasis_moments.length > 0) {
      newEffects.emphasisMoments = ana.emphasis_moments;
    }

    // Hard-disable depth/parallax — the feature is hidden from UI but legacy
    // state could still carry it. Force off so export stays clean.
    newEffects.backgroundDepth = false;
    newEffects.backgroundPattern = undefined;

    setEffects(newEffects);

    // 4. Apply recommended template
    const tpl = TEMPLATES.find((t) => t.id === ana.recommended_template);
    if (tpl) {
      setTemplateId(tpl.id);
      setStyle(tpl.style);
    }
  }

  async function exportProject() {
    if (exportFormat === "srt") {
      const srt = subtitles.map((s, i) => {
        const fmt = (t: number) => {
          const h = Math.floor(t / 3600);
          const m = Math.floor((t % 3600) / 60);
          const sec = Math.floor(t % 60);
          const ms = Math.round((t - Math.floor(t)) * 1000);
          return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
        };
        return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`;
      }).join("\n");

      const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "subtitles.srt";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // MP4 export — call /api/render to burn subtitles with FFmpeg
    if (!videoFile) {
      setErrorMessage("חסר קובץ וידאו");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMessage("צורבת כתוביות לוידאו (זה יכול לקחת דקה או שתיים)...");

    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("subtitles", JSON.stringify(subtitles));
      fd.append("style", JSON.stringify(style));
      fd.append("effects", JSON.stringify(effects));
      // Enable per-word highlighting only when highlight differs from main color
      const hasHighlight =
        style.highlightColor.toLowerCase() !== style.color.toLowerCase();
      fd.append("perWordHighlight", String(hasHighlight));

      const res = await fetch("/api/render", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `שגיאת שרת ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const dateStamp = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const filename = `video-master-${dateStamp}.mp4`;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadSuccess(filename);
      toast.success(`✓ ${filename} ירד בהצלחה`);
      // Auto-clear the success message after 10 seconds
      setTimeout(() => setDownloadSuccess(null), 10000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(`שגיאת ייצוא: ${msg}`);
      toast.error(`שגיאת ייצוא: ${msg.slice(0, 80)}`);
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto">
      <Header />

      {phase === "setup" && (
        <div className="space-y-8 mt-8">
          {!videoFile ? (
            <>
              <a
                href="/multi"
                className="block group bg-gradient-to-br from-brand/15 via-purple-500/10 to-cyan-500/5 border border-brand/30 hover:border-brand/60 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-brand/30 group-hover:bg-brand/40 transition-colors">
                    <Sparkles className="w-7 h-7 text-brand-light" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">מולטי-וידאו AI Editor</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white">✨ חדש</span>
                    </div>
                    <p className="text-xs text-white/60 mt-0.5">
                      העלי כמה סרטונים + הדביקי תסריט. ה-AI יחתוך, יבחר ויאחד לסרטון אחד.
                    </p>
                  </div>
                  <div className="text-brand-light group-hover:translate-x-1 transition-transform text-2xl">←</div>
                </div>
              </a>
              <VideoUploader onVideoSelected={handleVideo} />
            </>
          ) : (
            <div className="bg-bg-panel border border-brand/30 rounded-2xl p-4 flex items-center gap-4">
              <div className="p-3 bg-brand/20 rounded-xl">
                <Sparkles className="w-6 h-6 text-brand-light" />
              </div>
              <div className="flex-1">
                <div className="font-bold">{videoFile.name}</div>
                <div className="text-sm text-white/50">
                  {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
              <button
                onClick={() => {
                  setVideoFile(null);
                  setVideoUrl(null);
                }}
                className="text-sm text-white/50 hover:text-white px-3 py-1"
              >
                החלף
              </button>
            </div>
          )}

          {videoFile && (
            <>
              <ModeSelector selected={mode} onChange={handleModeChange} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SubtitleSettingsPanel
                  settings={settings}
                  onChange={setSettings}
                  modelId={whisperModel}
                  onModelChange={setWhisperModel}
                />
                <div className="bg-bg-panel border border-white/10 rounded-2xl p-6">
                  <ExportFormatToggle value={exportFormat} onChange={setExportFormat} />
                </div>
              </div>

              <button
                onClick={startTranscription}
                disabled={isProcessing}
                className="
                  w-full bg-gradient-to-r from-brand to-accent-pink
                  text-white font-bold py-5 rounded-2xl
                  flex items-center justify-center gap-3
                  hover:shadow-2xl hover:shadow-brand/40
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-all duration-200 text-lg
                "
              >
                {isProcessing ? (
                  <>
                    <LogoMark size={26} mode="spinning" />
                    {progressMessage || "AI מתמלל..."}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-6 h-6" />
                    תני ל-AI לתמלל ולערוך
                  </>
                )}
              </button>

              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-4 text-sm">
                  <div className="font-bold mb-1">⚠️ שגיאה בתמלול</div>
                  <div className="text-red-300/80">{errorMessage}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {phase === "editing" && videoUrl && (
        <div className="space-y-6 mt-6">
          <button
            onClick={() => setPhase("setup")}
            className="
              inline-flex items-center gap-2 text-sm text-white/60
              hover:text-white transition-colors
            "
          >
            <ArrowLeft className="w-4 h-4" />
            חזרה להגדרות AI
          </button>

          <AiDetectedPanel
            subtitles={subtitles}
            elementOverrides={effects.elementOverrides ?? {}}
            disabledElements={effects.disabledElements ?? []}
            elementSfxOverrides={effects.elementSfxOverrides ?? {}}
            onOverrideChange={(key, emoji) => {
              setEffects({
                ...effects,
                elementOverrides: {
                  ...(effects.elementOverrides ?? {}),
                  [key]: emoji,
                },
              });
            }}
            onDisable={(key) => {
              setEffects({
                ...effects,
                disabledElements: [
                  ...(effects.disabledElements ?? []),
                  key,
                ],
              });
            }}
            onSfxOverrideChange={(key, sfxId) => {
              const next = { ...(effects.elementSfxOverrides ?? {}) };
              if (sfxId === undefined) delete next[key];
              else next[key] = sfxId;
              setEffects({ ...effects, elementSfxOverrides: next });
            }}
          />

          {/* "כתוביות מוכנות" gallery moved INTO StylePanel as topSlot (right column)
              per Liat's request — keeps subtitle-design controls together. */}

          {/* ReferenceUploader temporarily hidden — re-enable here when ready.
              The component, API route, and Python analyzer all remain in the
              codebase intact.
          <ReferenceUploader
            onAnalyzed={(matched) => applyReferenceStyle(matched)}
          />
          */}

          {/* AiDecisionsBanner hidden per user request — the AI applies its
              decisions automatically, so the explanatory banner was redundant.
              The analysis state is still set so face crop / emphasis still work.
              Re-enable here if needed for debugging. */}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
            <div className="space-y-6 min-w-0">
              <VideoPreview
                videoUrl={videoUrl}
                subtitles={subtitles}
                style={style}
                effects={effects}
                onTimeUpdate={setCurrentTime}
              />

              <SubtitleEditor
                subtitles={subtitles}
                onChange={setSubtitles}
                currentTime={currentTime}
                elementOverrides={effects.elementOverrides ?? {}}
                positionOverrides={effects.elementPositionOverrides ?? {}}
                disabledElements={effects.disabledElements ?? []}
                elementSfxOverrides={effects.elementSfxOverrides ?? {}}
                onAutoElementChange={(key, override) => {
                  setEffects((prev) => {
                    const next = { ...prev };
                    if (override.emoji !== undefined) {
                      next.elementOverrides = {
                        ...(prev.elementOverrides ?? {}),
                        [key]: override.emoji,
                      };
                    }
                    if (override.position !== undefined) {
                      next.elementPositionOverrides = {
                        ...(prev.elementPositionOverrides ?? {}),
                        [key]: override.position,
                      };
                    }
                    if (override.disabled) {
                      next.disabledElements = [
                        ...(prev.disabledElements ?? []),
                        key,
                      ];
                    }
                    if ("sfxId" in override) {
                      const sfx = { ...(prev.elementSfxOverrides ?? {}) };
                      if (override.sfxId === undefined) delete sfx[key];
                      else sfx[key] = override.sfxId;
                      next.elementSfxOverrides = sfx;
                    }
                    return next;
                  });
                }}
              />
            </div>

            <div className="space-y-4 lg:sticky lg:top-4">
              <StylePanel
                style={style}
                onChange={setStyle}
                templateId={templateId}
                onTemplateChange={handleTemplateChange}
                effects={effects}
                onEffectsChange={setEffects}
                hideEffects={mode === "subtitles_only"}
                topSlot={
                  <ReferenceStyleGallery
                    activeId={activeReferenceId}
                    onApply={applyReferenceStyle}
                  />
                }
              />

              <button
                onClick={exportProject}
                disabled={isProcessing}
                className="
                  w-full bg-gradient-to-r from-green-500 to-emerald-600
                  text-white font-bold py-4 rounded-2xl
                  flex items-center justify-center gap-3
                  hover:shadow-2xl hover:shadow-emerald-500/30
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-all duration-200
                "
              >
                {isProcessing ? (
                  <>
                    <LogoMark size={24} mode="spinning" />
                    {progressMessage || "מעבד..."}
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    ייצוא {exportFormat === "mp4" ? "וידאו (MP4)" : "כתוביות (SRT)"}
                    {exportFormat === "mp4" && (() => {
                      const cost = mode === "advanced_effects" ? costAdvanced
                        : mode === "podcast" ? costPodcast
                        : mode === "basic_effects" ? costBasic
                        : costSubtitles;
                      return (
                        <span className="mr-2 inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold">
                          <Coins className="w-3.5 h-3.5" /> {cost} קרדיט
                        </span>
                      );
                    })()}
                  </>
                )}
              </button>

              {errorMessage && phase === "editing" && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-4 text-sm">
                  <div className="font-bold mb-1">⚠️ שגיאה</div>
                  <div className="text-red-300/80 text-xs">{errorMessage}</div>
                </div>
              )}

              {downloadSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-100 rounded-xl p-4 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-emerald-500/30 rounded-full p-1.5 mt-0.5">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-0.5">הסרטון ירד בהצלחה! 🎉</div>
                    <div className="text-[12px] text-emerald-200/80 font-mono break-all">
                      {downloadSuccess}
                    </div>
                  </div>
                  <button
                    onClick={() => setDownloadSuccess(null)}
                    className="text-emerald-200/60 hover:text-emerald-100 text-lg leading-none"
                    title="סגירה"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Header() {
  // Title + tagline come from CMS (admin → תוכן → מיתוג). Logo image is
  // also CMS-controlled inside LogoMark itself.
  const appName = useContent("brand.appName");
  const tagline = useContent("brand.tagline");
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-brand blur-2xl opacity-40" />
          <LogoMark size={52} mode="static" className="relative" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{appName}</h1>
          <p className="text-xs text-white/40">{tagline}</p>
          <div className="mt-0.5"><SavedIndicator /></div>
        </div>
      </div>
      <a href="/dashboard"
         className="bg-bg-panel border border-white/10 hover:border-brand/40 px-3 py-1.5 rounded-full text-xs flex items-center gap-2 text-white/70 hover:text-white">
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-[11px] font-black text-white">ל</span>
        החשבון שלי
      </a>
    </header>
  );
}
