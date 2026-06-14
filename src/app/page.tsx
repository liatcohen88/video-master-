"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, Download, Sparkles, ArrowLeft, Cloud, Coins, Languages, Zap, FileDown } from "lucide-react";

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
import { modeCapabilities } from "@/lib/modeCapabilities";
import { useContent } from "@/lib/useContent";
import { Bell } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import MasterCoin from "@/components/MasterCoin";
import SavedIndicator from "@/components/SavedIndicator";
import { getCredits, calcDynamicCost } from "@/lib/credits";
import { listNotifications, markNotificationRead, clearAllNotifications } from "@/lib/userStore";
import LandingSections from "@/components/LandingSections";
import { useAutoSavedState } from "@/lib/useAutoSave";
import { toast } from "@/components/Toaster";
import ResumeProjectBanner from "@/components/ResumeProjectBanner";
import SaveSnapshotButton from "@/components/SaveSnapshotButton";
import AILoadingOverlay from "@/components/AILoadingOverlay";
import SignupGate from "@/components/SignupGate";
import { useAuth } from "@/lib/useAuth";
import SiteHeader from "@/components/SiteHeader";
import {
  hashVideoFile,
  saveCurrentVideo,
  clearCurrentVideo,
  saveTranscription,
  loadTranscription,
  clearTranscriptionForHash,
  saveSnapshot,
  loadCurrentVideo,
  storedToFile,
  type ProjectSnapshot,
} from "@/lib/projectStorage";

export default function HomePage() {
  // Credit cost per mode — pulled from CMS so admin edits take effect instantly.
  const costSubtitles = useContent("pricing.cost.subtitles_only");
  const costBasic     = useContent("pricing.cost.basic_effects");
  const costPodcast   = useContent("pricing.cost.podcast");
  const costAdvanced  = useContent("pricing.cost.advanced_effects");
  const currency      = (useContent("brand.currencyName") as string) || "קרדיטים";
  // ── Visible home-page strings (CMS-driven) ──
  const multiTitle    = useContent("home.multi.title") as string;
  const multiBadge    = useContent("home.multi.badge") as string;
  const multiDesc     = useContent("home.multi.desc") as string;
  const replaceLabel  = useContent("home.replace") as string;
  const ctaTranscribe = useContent("home.cta.transcribe") as string;
  const ctaProcessing = useContent("home.cta.processing") as string;
  const retranscribeConfirm = useContent("home.retranscribe") as string;
  const errNoVideo    = useContent("home.error.noVideo") as string;
  const errNoSpeech   = useContent("home.error.noSpeech") as string;
  const progUpload    = useContent("home.progress.upload") as string;
  const progTranscribe= useContent("home.progress.transcribe") as string;
  const progAnalyze   = useContent("home.progress.analyze") as string;
  const progExport    = useContent("home.progress.export") as string;
  const progLoadVideo = useContent("home.progress.loadVideo") as string;
  const toastMultiReady = useContent("home.toast.multiReady") as string;
  const toastResume     = useContent("home.toast.resumeHint") as string;
  const toastVideoLoaded= useContent("home.toast.videoLoaded") as string;
  const heroGreeting     = useContent("home.hero.greeting") as string;
  const heroGreetingGuest= useContent("home.hero.greetingGuest") as string;
  const heroTagline      = useContent("home.hero.tagline") as string;
  const heroBadge1       = useContent("landing.badge.1") as string;
  const heroBadge2       = useContent("landing.badge.2") as string;
  const heroBadge3       = useContent("landing.badge.3") as string;
  const heroBadge4       = useContent("landing.badge.4") as string;
  const heroBadge5       = useContent("landing.badge.5") as string;
  const multiEnabled     = useContent("feature.multi.enabled") as boolean;

  // Auth — used to (a) personalize the hero greeting with display name,
  // and (b) gate the export button (guests get a signup popup instead).
  const auth = useAuth();
  const [showSignupGate, setShowSignupGate] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Content-hash of the current video file. Used to look up cached transcription
  // results (so re-uploading the same file skips Whisper) AND to tag snapshots
  // so we can restore the matching project state for the right video.
  const [videoHash, setVideoHash] = useState<string | null>(null);
  // Ref so landing-page CTAs can smooth-scroll back up to the upload area
  const uploadRef = useRef<HTMLDivElement>(null);

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
    // Coming from the multi-video joiner? Auto-load the combined video that
    // was stashed in IndexedDB and drop straight into the setup phase.
    if (typeof window !== "undefined" && sessionStorage.getItem("vm_autoload_video") === "1") {
      sessionStorage.removeItem("vm_autoload_video");
      (async () => {
        const v = await loadCurrentVideo();
        if (v) {
          await handleVideo(storedToFile(v));
          toast.success(toastMultiReady);
        }
      })();
      return;
    }
    if (modeMeta.wasRestored) {
      toast.info(toastResume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [activeReferenceId, setActiveReferenceId] = useState<string | undefined>(undefined);

  async function handleVideo(file: File) {
    // Full-screen loader so mobile users see clear feedback while the file
    // is hashed + persisted to IndexedDB — on a big video this is several
    // seconds and was previously a silent freeze.
    setIsProcessing(true);
    setProgressMessage(progLoadVideo);
    try {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      // Reset effects to clean default — drops any leftover depth/parallax
      // toggles from a previous session that could confuse the export.
      setEffects(MODE_DEFAULT_EFFECTS[mode]);
      setDownloadSuccess(null);
      setErrorMessage(null);
      // Persist the blob to IndexedDB so hot-reload/refresh doesn't lose it.
      // Hash first so transcription-cache lookups work consistently.
      try {
        const hash = await hashVideoFile(file);
        setVideoHash(hash);
        saveCurrentVideo(file, hash).catch(() => {/* best-effort */});
      } catch { /* IDB unavailable — fall back to in-memory only */ }
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
    }
  }

  /**
   * Restore from a previously-saved project: re-attach the file, hash it,
   * and if a snapshot was selected, hydrate all editor state from it and
   * jump straight to the editing phase.
   */
  async function handleResume(file: File, snap?: ProjectSnapshot) {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setErrorMessage(null);
    setDownloadSuccess(null);
    try {
      const hash = await hashVideoFile(file);
      setVideoHash(hash);

      // Best case: a full snapshot exists → restore every editor field and
      // jump straight to editing.
      if (snap) {
        const p = snap.payload;
        setMode(p.mode);
        setExportFormat(p.exportFormat);
        setSettings(p.settings);
        setTemplateId(p.templateId);
        setStyle(p.style);
        setSubtitles(p.subtitles);
        setEffects(p.effects);
        setWhisperModel(p.whisperModel);
        setPhase("editing");
        // Snap to top so the user sees the video preview + first caption,
        // not the bottom of the editor panel where they were before transcription.
        if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
        toast.success(`שוחזר: ${snap.label} (${p.subtitles.length} כתוביות)`);
        return;
      }

      // Fallback: no snapshot yet (e.g. user closed the tab before the first
      // auto-snapshot fired 5 minutes in), but the transcription itself was
      // cached when it originally completed. Use it + the auto-saved subtitle
      // styling/effects from localStorage to skip straight into editing.
      const cachedSubs = await loadTranscription(hash);
      if (cachedSubs && cachedSubs.length > 0) {
        setSubtitles(cachedSubs);
        setPhase("editing");
        // Snap to top so the user sees the video preview + first caption,
        // not the bottom of the editor panel where they were before transcription.
        if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
        toast.success(`הסרטון והתמלול שוחזרו (${cachedSubs.length} כתוביות)`);
        return;
      }

      // Worst case: video only, no transcription → land on setup so user
      // can pick mode/settings and run the AI.
      toast.info(toastVideoLoaded);
    } catch {/* ignore */}
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
      // Start from the user's CURRENT effects so picking a reference style
      // doesn't wipe their settings (transparentLogoBg, customLogos, SFX
      // tweaks, etc.). The preset only overrides the subtitle-related fields
      // it explicitly cares about.
      ...effects,
      ...ref.preset.effectsOverride,
      // Keep video-derived fields
      faceCenterX: analysis?.face_detected ? analysis.face_center_x : undefined,
      faceCenterY: analysis?.face_detected ? analysis.face_center_y : undefined,
      emphasisMoments: analysis?.emphasis_moments ?? [],
    };
    setEffects(merged);
    setActiveReferenceId(ref.id);
  }

  async function startTranscription(opts?: { force?: boolean }) {
    if (!videoFile) return;
    setIsProcessing(true);
    setErrorMessage(null);

    // If `force` is set we INTENTIONALLY skip the cache (Liat: "אני לא רואה
    // שינויים... אין דרך למחוק היסטוריה שלי שתמללתי שיעשה לי שוב?"). We
    // also drop the cache entry for this hash so a later non-force call
    // doesn't fall back to the stale version either.
    if (opts?.force && videoHash) {
      await clearTranscriptionForHash(videoHash).catch(() => {});
    }

    // Cache hit? Skip the API call — same file was transcribed before.
    // Saves the user 30-60s + avoids burning server CPU on duplicate work.
    if (!opts?.force && videoHash) {
      const cached = await loadTranscription(videoHash);
      if (cached && cached.length > 0) {
        setSubtitles(cached);
        setPhase("editing");
        // Snap to top so the user sees the video preview + first caption,
        // not the bottom of the editor panel where they were before transcription.
        if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
        setIsProcessing(false);
        toast.success(`תמלול הוטען מהמטמון (${cached.length} כתוביות) — לא נמחקו ${currency}`);
        return;
      }
    }

    setProgressMessage(progUpload);

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
      setProgressMessage(progTranscribe);
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
        throw new Error(errNoSpeech);
      }

      setSubtitles(transcribeData.subtitles as Subtitle[]);
      // Cache the transcription so next upload of same file is instant.
      if (videoHash) {
        saveTranscription(videoHash, transcribeData.subtitles).catch(() => {});
        // First-pass snapshot — captures the freshly-transcribed state so
        // if the user refreshes BEFORE the 5-minute auto-snapshot fires,
        // "המשך עריכה" still lands them in the editor with everything in place.
        saveSnapshot({
          at: Date.now(),
          label: "תמלול ראשוני",
          videoHash,
          payload: {
            mode, exportFormat, settings, templateId, style,
            subtitles: transcribeData.subtitles as Subtitle[],
            effects, whisperModel,
          },
        }).catch(() => {});
      }

      // Now run analysis (face detect + emphasis + recommendations)
      setProgressMessage(progAnalyze);
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

    // BUG FIX (2026-06-11): the AI was overriding the user's mode choice.
    // Liat picked "subtitles only", AI re-ranked it to advanced, and emoji+
    // sound suddenly appeared on her video. The user's pick wins now — we
    // only apply the AI's mode if they hadn't explicitly chosen one (which
    // is rare; mode picker is required upfront). Aspect / face / emphasis
    // recommendations still merge into the EXISTING mode's effects, never
    // upgrading the mode itself.
    const userPickedMode: EditMode = mode;
    setSettings(MODE_DEFAULT_SETTINGS[userPickedMode]);
    const newEffects = { ...MODE_DEFAULT_EFFECTS[userPickedMode] };

    // 2. Override aspect ratio with recommendation
    newEffects.aspectRatio = ana.recommended_aspect;

    // 3. Use face position for smart cropping
    if (ana.face_detected) {
      newEffects.faceCenterX = ana.face_center_x;
      newEffects.faceCenterY = ana.face_center_y;
    }

    // 4. Emphasis moments only matter when faceZoom is allowed — passing
    // them in for subtitles_only is wasted state (we'd never punch-zoom).
    if (ana.emphasis_moments && ana.emphasis_moments.length > 0 && userPickedMode !== "subtitles_only") {
      newEffects.emphasisMoments = ana.emphasis_moments;
    }

    // Hard-disable depth/parallax — the feature is hidden from UI but legacy
    // state could still carry it. Force off so export stays clean.
    newEffects.backgroundDepth = false;
    newEffects.backgroundPattern = undefined;

    setEffects(newEffects);

    // 4. Apply recommended template only when user is in a mode that allows
    // styling beyond subtitle defaults. subtitles_only keeps its picked tpl.
    if (userPickedMode !== "subtitles_only") {
      const tpl = TEMPLATES.find((t) => t.id === ana.recommended_template);
      if (tpl) {
        setTemplateId(tpl.id);
        setStyle(tpl.style);
      }
    }
  }

  async function exportProject() {
    // Guests must sign up before the download starts. SignupGate opens an
    // inline popup with the 25-master gift framing; on success the gate's
    // onSuccess closes the modal and we resume the export automatically.
    if (auth.status === "guest") {
      setShowSignupGate(true);
      return;
    }
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
      setErrorMessage(errNoVideo);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMessage(progExport);

    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("subtitles", JSON.stringify(subtitles));
      fd.append("style", JSON.stringify(style));
      fd.append("effects", JSON.stringify(effects));
      // Background music is stored client-side as a blob: URL, which the
      // server can't fetch. Re-fetch the blob here and attach as a file.
      if (effects.bgMusicUrl) {
        try {
          const blob = await fetch(effects.bgMusicUrl).then((r) => r.blob());
          if (blob && blob.size > 0) {
            fd.append("bgMusic", blob, "bgmusic");
          }
        } catch { /* ignore — server treats missing as no music */ }
      }
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

  // Headline shown in the AI loader overlay — varies by what's running:
  //  - setup phase   → transcription (wording differs per mode)
  //  - editing phase → MP4 export (FFmpeg burn-in)
  const loaderTitle = phase === "editing"
    ? "מייצא לך את הסרטון ל-MP4"
    : mode === "subtitles_only"
      ? "AI מתמלל לך את הסרטון"
      : "AI מתמלל ועורך לך את הסרטון";

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto">
      <SiteHeader />

      {/* Full-screen AI loader — covers BOTH heavy operations:
          transcription (setup phase) and MP4 export (editing phase). */}
      {isProcessing && (
        <AILoadingOverlay title={loaderTitle} subtitle={progressMessage || undefined} />
      )}

      {phase === "setup" && (
        <div className="space-y-8 mt-8">
          {!videoFile ? (
            <>
              {/* Hero — bold value prop + 1-line tagline + 5 trust badges,
                  all centered. Same pattern as polished SaaS landings
                  (video-to-frames style) so a first-time visitor reads
                  what the app does → why to trust it → uploads, in one
                  scroll-free frame. */}
              <div className="text-center mb-4 space-y-3">
                <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-brand via-purple-400 to-accent-pink bg-clip-text text-transparent leading-tight">
                  {auth.status === "user" && auth.profile?.display_name
                    ? heroGreeting.replace("{{name}}", auth.profile.display_name)
                    : heroGreetingGuest}
                </h1>
                <p className="text-sm md:text-base text-white/60 leading-relaxed max-w-xl mx-auto">
                  {heroTagline}
                </p>
                {/* 5 trust badges — same copy as LandingSections, exposed up
                    top so the user sees them BEFORE they have to scroll. */}
                <div className="flex flex-wrap justify-center gap-2 pt-2 text-[11px] md:text-xs">
                  <HeroBadge icon={<Cloud className="w-3.5 h-3.5" />}        color="violet">{heroBadge1}</HeroBadge>
                  <HeroBadge icon={<Coins className="w-3.5 h-3.5" />}        color="amber">{heroBadge2}</HeroBadge>
                  <HeroBadge icon={<Languages className="w-3.5 h-3.5" />}    color="fuchsia">{heroBadge3}</HeroBadge>
                  <HeroBadge icon={<Zap className="w-3.5 h-3.5" />}          color="cyan">{heroBadge4}</HeroBadge>
                  <HeroBadge icon={<FileDown className="w-3.5 h-3.5" />}     color="emerald">{heroBadge5}</HeroBadge>
                </div>
              </div>
              {multiEnabled && <a
                href="/multi"
                className="block group bg-gradient-to-br from-brand/15 via-purple-500/10 to-cyan-500/5 border border-brand/30 hover:border-brand/60 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-brand/30 group-hover:bg-brand/40 transition-colors">
                    <Sparkles className="w-7 h-7 text-brand-light" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{multiTitle}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white">{multiBadge}</span>
                    </div>
                    <p className="text-xs text-white/60 mt-0.5">
                      {multiDesc}
                    </p>
                  </div>
                  <div className="text-brand-light group-hover:translate-x-1 transition-transform text-2xl">←</div>
                </div>
              </a>}
              <div ref={uploadRef}>
                {/* If a previous video is still cached, show one-click resume.
                    Self-hides when no cached video exists. */}
                <ResumeProjectBanner onResume={handleResume} />
                <VideoUploader onVideoSelected={handleVideo} />
              </div>
              {/* ── Landing page sections — only when no video uploaded ── */}
              <LandingSections
                onScrollToUpload={() => uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              />
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
                  setVideoHash(null);
                  clearCurrentVideo().catch(() => {});
                }}
                className="text-sm text-white/50 hover:text-white px-3 py-1"
              >
                {replaceLabel}
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
                onClick={() => startTranscription()}
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
                    {progressMessage || ctaProcessing}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-6 h-6" />
                    {ctaTranscribe}
                  </>
                )}
              </button>

              {/* Force re-transcribe — clears the cached transcription for
                  this exact file and runs the AI again. Useful when Liat
                  changes settings or wants to test latest fixes without
                  re-uploading a different video. */}
              {!isProcessing && videoHash && (
                <button
                  onClick={() => {
                    if (!confirm(retranscribeConfirm)) return;
                    startTranscription({ force: true });
                  }}
                  className="w-full mt-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/70 hover:text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
                >
                  🔄 מחק תמלול ותמלל מחדש
                </button>
              )}

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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => setPhase("setup")}
              className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              חזרה להגדרות AI
            </button>
            {videoHash && (
              <SaveSnapshotButton
                buildSnapshot={() => ({
                  videoHash,
                  payload: { mode, exportFormat, settings, templateId, style, subtitles, effects, whisperModel },
                })}
              />
            )}
          </div>

          {/* Subtitles-only mode: never show the AI detected panel — Liat:
              "בכתוביות בלבד זה לא יחול עליה אלא רק התמלול". The panel
              suggests features the mode forbids, which confuses users. */}
          {mode !== "subtitles_only" && (
          <AiDetectedPanel
            subtitles={subtitles}
            elementOverrides={effects.elementOverrides ?? {}}
            disabledElements={effects.disabledElements ?? []}
            elementSfxOverrides={effects.elementSfxOverrides ?? {}}
            elementSizePx={effects.elementSizePx ?? {}}
            elementPosition={effects.elementPosition ?? {}}
            brandSizePx={effects.brandSizePx ?? {}}
            brandPosition={effects.brandPosition ?? {}}
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
            onElementSizeChange={(key, px) => {
              const next = { ...(effects.elementSizePx ?? {}) };
              if (px === undefined) delete next[key]; else next[key] = px;
              setEffects({ ...effects, elementSizePx: next });
            }}
            onElementPositionChange={(key, pos) => {
              const next = { ...(effects.elementPosition ?? {}) };
              if (pos === undefined) delete next[key]; else next[key] = pos;
              setEffects({ ...effects, elementPosition: next });
            }}
            onBrandSizeChange={(key, px) => {
              const next = { ...(effects.brandSizePx ?? {}) };
              if (px === undefined) delete next[key]; else next[key] = px;
              setEffects({ ...effects, brandSizePx: next });
            }}
            onBrandPositionChange={(key, pos) => {
              const next = { ...(effects.brandPosition ?? {}) };
              if (pos === undefined) delete next[key]; else next[key] = pos;
              setEffects({ ...effects, brandPosition: next });
            }}
          />
          )}

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
                allowElements={modeCapabilities(mode).elements}
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
                subtitles={subtitles}
                // Liat: "אני כן הייתי רוצה שיהיה בצד אפקטים מתקדמים" — also
                // in subtitles_only mode. Each effect she enables raises the
                // export price via calcDynamicCost.
                hideEffects={false}
                mode={mode}
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
                  // Overlay handles the visible progress; button shows a
                  // minimal disabled state so the layout doesn't shift.
                  <>
                    <Download className="w-5 h-5 opacity-60" />
                    מעבד...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    ייצוא {exportFormat === "mp4" ? "וידאו (MP4)" : "כתוביות (SRT)"}
                    {exportFormat === "mp4" && (() => {
                      // Dynamic cost — base price for the mode + per-feature
                      // add-ons for advanced_effects, capped at 40. Updates
                      // in real time as user toggles effects on/off.
                      const d = calcDynamicCost(
                        mode === "basic_effects" ? "basic_effects" : mode,
                        effects,
                      );
                      const showCap = mode === "advanced_effects" && d.cap;
                      return (
                        <span className="mr-2 inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold">
                          <MasterCoin size={14} />
                          {d.total} {currency}
                          {showCap && d.addons > 0 && (
                            <span className="text-white/60 text-[10px]">/ {d.cap}</span>
                          )}
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
                <div
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-8 animate-in fade-in duration-200"
                  onClick={() => setDownloadSuccess(null)}
                >
                  <div
                    className="bg-bg-panel border border-emerald-400/40 rounded-3xl max-w-md w-full p-8 text-center shadow-2xl shadow-emerald-500/20 animate-in zoom-in-95 duration-300"
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-600/15 border border-emerald-400/40 mb-4">
                      <svg className="w-10 h-10 text-emerald-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-extrabold mb-2">הסרטון ירד בהצלחה! 🎉</h3>
                    <div className="text-xs text-white/50 font-mono break-all bg-bg-card border border-white/10 rounded-lg p-3 mb-5">
                      {downloadSuccess}
                    </div>
                    <button
                      onClick={() => setDownloadSuccess(null)}
                      className="w-full bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity"
                    >
                      סגרי
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guest signup popup — opens when a guest hits the export button.
          On success, close the modal and call exportProject() again — the
          auth state will be "user" by then and the gate will pass through. */}
      <SignupGate
        open={showSignupGate}
        onClose={() => setShowSignupGate(false)}
        onSuccess={() => { setShowSignupGate(false); void exportProject(); }}
      />
    </main>
  );
}

// (Page-local Header() removed — replaced by the shared SiteHeader so nav,
// auth, and CMS keys live in one place. Stub kept to preserve line numbers
// while we audit references; will be deleted in a follow-up sweep.)
function _Header_DEPRECATED() {
  const appName  = useContent("brand.appName");
  const tagline  = useContent("brand.tagline");
  const logoSize = useContent("brand.headerLogoSize");
  const currency = (useContent("brand.currencyName") as string) || "קרדיטים";
  const [userName, setUserName] = useState("משתמש");
  const [credits, setCredits] = useState(0);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("vm_user_store_v1");
      if (raw) {
        const p = JSON.parse(raw) as { profile?: { name?: string } };
        if (p.profile?.name) setUserName(p.profile.name);
      }
    } catch {}
    setCredits(getCredits());
    setUnread(listNotifications().filter((n) => !n.read).length);
    const refreshCredits = () => setCredits(getCredits());
    window.addEventListener("credits-change", refreshCredits);
    return () => window.removeEventListener("credits-change", refreshCredits);
  }, [tick]);

  const initial = userName.charAt(0) || "מ";
  const notifications = listNotifications();

  return (
    <header className="flex items-center justify-between gap-3">
      {/* RIGHT (RTL first) — brand lockup: logo tight to name + tagline */}
      <a href="/" className="flex items-center gap-2.5 min-w-0 group" title="לדף הבית">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-brand blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
          <LogoMark size={logoSize} mode="static" className="relative" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-black tracking-tight truncate group-hover:text-brand-light transition-colors leading-tight">{appName}</h1>
          <p className="text-[10px] md:text-[11px] text-white/40 leading-tight">{tagline}</p>
        </div>
      </a>

      {/* CENTER — main nav (desktop). Three links is the magic number — more
          and users freeze (Hick's law). Hidden on mobile, where they live
          inside the profile dropdown instead. */}
      <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <a href="/" className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">בית</a>
        <a href="/credits" className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">חבילות</a>
        <a href="/help" className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">עזרה</a>
      </nav>

      {/* LEFT (RTL last) — credits + notifications + profile dropdown */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Credits pill — entire pill is clickable, no separate "+" button.
            The previous "+" badge confused users ("does this give me free
            credits?"). Now: tap balance → /credits. Simpler. */}
        <a href="/credits"
           className="bg-gradient-to-r from-violet-500/15 to-pink-500/15 border border-white/10 hover:border-brand/40 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-colors"
           title="היתרה שלך — לחצי לקניית חבילה">
          <MasterCoin size={16} />
          <span className="font-bold text-white">{credits.toLocaleString()}</span>
        </a>

        {/* Bell */}
        <div className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-full bg-bg-panel border border-white/10 hover:border-brand/40 hover:bg-bg-panel transition-colors">
            <Bell className="w-4 h-4 text-white/70" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>
            )}
          </button>
          {notifOpen && (
            <>
              {/* click-outside backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute left-0 top-12 w-80 bg-bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-3 z-50">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-xs font-bold">התראות</div>
                  {unread > 0 && (
                    <button onClick={() => { clearAllNotifications(); setTick(tick + 1); }}
                      className="text-[10px] text-white/40 hover:text-white">סמן הכל כנקרא</button>
                  )}
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {notifications.slice(0, 8).map((n) => (
                    <button key={n.id}
                      onClick={() => { markNotificationRead(n.id); setTick(tick + 1); }}
                      className={`w-full text-right flex gap-2 rounded-md p-2 transition-colors
                        ${n.read ? "opacity-50 hover:opacity-90" : "bg-white/5 hover:bg-white/10"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{n.title}</div>
                        <div className="text-[11px] text-white/50 leading-tight line-clamp-2">{n.body}</div>
                      </div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-light shrink-0 mt-1.5" />}
                    </button>
                  ))}
                  {notifications.length === 0 && (
                    <div className="text-center text-xs text-white/30 py-4">אין התראות חדשות</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile dropdown (desktop) — avatar with caret. Shows name on
            wider screens. Tapping opens a menu with all account links so
            we don't need to clutter the main nav with פרופיל / סרטונים /
            הגדרות / יציאה. Mobile users get the hamburger instead. */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="bg-bg-panel border border-white/10 hover:border-brand/40 px-2 py-1.5 rounded-full text-xs flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            title="התפריט שלך"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-[11px] font-black text-white shrink-0">{initial}</span>
            <span className="hidden lg:inline whitespace-nowrap font-medium">{userName}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" className={`text-white/50 transition-transform ${profileOpen ? "rotate-180" : ""}`}>
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute left-0 top-12 w-52 bg-bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-1.5 z-50">
                <ProfileMenuItem href="/dashboard" icon="👤" label="פרופיל ודאשבורד" />
                <ProfileMenuItem href="/dashboard#videos" icon="📂" label="הסרטונים שלי" />
                <ProfileMenuItem href="/credits" icon="💎" label="קניית מאסטרים" highlight />
                <ProfileMenuItem href="/help" icon="❓" label="עזרה" />
                <div className="my-1 border-t border-white/10" />
                <ProfileMenuItem href="/contact" icon="✉️" label="צור קשר" />
              </div>
            </>
          )}
        </div>

        {/* Hamburger (mobile only) — opens a sheet with nav + profile links */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-full bg-bg-panel border border-white/10 text-white/80"
          aria-label="תפריט"
        >
          {mobileMenuOpen ? (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu sheet — slides down under the header */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-16 right-2 left-2 bg-bg-card border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-3 z-50 md:hidden">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-sm font-black text-white">{initial}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{userName}</div>
                <div className="text-[10px] text-white/40">{credits.toLocaleString()} מאסטרים</div>
              </div>
            </div>
            <ProfileMenuItem href="/" icon="🏠" label="בית" />
            <ProfileMenuItem href="/credits" icon="💎" label="חבילות וקניה" highlight />
            <ProfileMenuItem href="/help" icon="❓" label="עזרה" />
            <div className="my-1 border-t border-white/10" />
            <ProfileMenuItem href="/dashboard" icon="👤" label="פרופיל ודאשבורד" />
            <ProfileMenuItem href="/dashboard#videos" icon="📂" label="הסרטונים שלי" />
            <ProfileMenuItem href="/contact" icon="✉️" label="צור קשר" />
          </div>
        </>
      )}
    </header>
  );
}

/** Single row inside the profile dropdown / mobile menu. Same shape for
 *  both so the dropdown feels consistent across viewport sizes. */
function ProfileMenuItem({ href, icon, label, highlight }: { href: string; icon: string; label: string; highlight?: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        highlight
          ? "bg-brand/20 text-white font-bold hover:bg-brand/30"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

/** Compact trust-pill rendered in the hero strip. Same visual language as the
 *  badges that used to live at the top of LandingSections — moved up here
 *  so first-time visitors see them BEFORE scrolling, alongside the headline
 *  + tagline + upload picker. Each color is a tailwind base; the chip uses
 *  a translucent fill + matching border + icon tint. */
function HeroBadge({
  icon, color, children,
}: {
  icon: React.ReactNode;
  color: "violet" | "amber" | "fuchsia" | "cyan" | "emerald";
  children: React.ReactNode;
}) {
  const palette: Record<typeof color, string> = {
    violet:   "bg-violet-500/12 border-violet-400/40 text-violet-100",
    amber:    "bg-amber-500/12 border-amber-400/40 text-amber-100",
    fuchsia:  "bg-fuchsia-500/12 border-fuchsia-400/40 text-fuchsia-100",
    cyan:     "bg-cyan-500/12 border-cyan-400/40 text-cyan-100",
    emerald:  "bg-emerald-500/12 border-emerald-400/40 text-emerald-100",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${palette[color]}`}>
      <span className="opacity-90" aria-hidden>{icon}</span>
      {children}
    </span>
  );
}
