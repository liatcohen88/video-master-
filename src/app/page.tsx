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
import { listNotifications, markNotificationRead, clearAllNotifications, addVideo } from "@/lib/userStore";
import { pushVideoRow } from "@/lib/userData";
import { applySubtitleSettings, flattenWords, type TimedWord } from "@/lib/subtitleSettings";
import LandingSections from "@/components/LandingSections";
import MobilePip from "@/components/MobilePip";
import AuthSuccessModal from "@/components/AuthSuccessModal";
import InsufficientCreditsModal, { type InsufficientInfo } from "@/components/InsufficientCreditsModal";
import { useAutoSavedState } from "@/lib/useAutoSave";
import { acquireWakeLock, releaseWakeLock, type WakeLockHandle } from "@/lib/wakeLock";
import { toast } from "@/components/Toaster";
import ResumeProjectBanner from "@/components/ResumeProjectBanner";
import SaveSnapshotButton from "@/components/SaveSnapshotButton";
import AILoadingOverlay from "@/components/AILoadingOverlay";
import SignupGate from "@/components/SignupGate";
import { useAuth } from "@/lib/useAuth";
import SiteHeader from "@/components/SiteHeader";
import { detectDramaMoments, detectWowMoments } from "@/lib/dramaEffects";
import {
  hashVideoFile,
  saveCurrentVideo,
  clearCurrentVideo,
  saveTranscription,
  loadTranscription,
  clearTranscriptionForHash,
  saveSnapshot,
  listSnapshots,
  loadCurrentVideo,
  storedToFile,
  loadCurrentMusic,
  clearCurrentMusic,
  type ProjectSnapshot,
} from "@/lib/projectStorage";

// ── Auto subtitle STYLE + COLOR matched to the video ──────────────────────
// Liat: "the AI always puts the same subtitle style; I need the style and
// color to match the video itself." We pick a template by the clip's ENERGY
// (loud emphasis peaks per 10s) + COLORFULNESS, and recolor the highlighted
// word with the vivid ACCENT color sampled from the footage. Deterministic
// per video (same clip → same look), but different clips look different.
function pickAutoSubtitleStyle(
  ana: VideoAnalysis,
  mode: EditMode,
): { templateId: string; style: SubtitleStyle } {
  const dur = ana.duration_sec || 0;
  const peaks = ana.emphasis_moments?.length ?? 0;
  const emphDensity = dur > 0 ? peaks / (dur / 10) : 0; // loud moments per 10s
  const colorful = ana.colorfulness ?? 0;

  const energetic = emphDensity >= 2.2 || colorful >= 0.45;
  const calm = !energetic && (ana.is_talking_head || emphDensity < 1.0);

  // Candidate template per mode, split by vibe. Each pick is a genuinely
  // different look so two clips rarely land on the same one.
  let templateId: string;
  switch (mode) {
    case "subtitles_only":
      templateId = energetic ? "ali" : "minimal"; // clean family, still varies
      break;
    case "podcast":
      templateId = energetic ? "tiktok" : "ali";
      break;
    case "advanced_effects":
      templateId = energetic ? "hormozi" : calm ? "tiktok" : "bold-pop";
      break;
    case "basic_effects":
    default:
      templateId = energetic ? "instagram" : calm ? "ali" : "tiktok";
      break;
  }

  const base = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const style: SubtitleStyle = { ...base.style };

  // Recolor the highlighted word with the video's own accent color so the
  // captions feel "on brand" with the clip. Main text stays light + the
  // template's stroke keeps it readable over any footage.
  const accent = ana.accent_color;
  if (accent && /^#[0-9A-Fa-f]{6}$/.test(accent)) {
    style.highlightColor = accent.toUpperCase();
  }

  return { templateId, style };
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// CLIENT-SIDE color sampling. The server analysis (cv2/mediapipe) isn't
// installed in prod, so /api/analyze 500s and never colored anything — which
// is why every clip looked identical. We instead grab a few frames from the
// already-loaded video in the browser, find the dominant vivid hue → a punchy
// accent color, plus brightness/colorfulness. Pure canvas, no server.
async function extractVideoAccent(
  file: File,
): Promise<{ accent: string; brightness: number; colorfulness: number } | null> {
  try {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("load"));
      setTimeout(() => rej(new Error("timeout")), 8000);
    });
    const dur = v.duration || 0;
    const W = 64, H = 36;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { URL.revokeObjectURL(url); return null; }
    const times = dur > 0.2 ? [dur * 0.2, dur * 0.5, dur * 0.8] : [0];
    const hue = new Array(360).fill(0);
    let brightAcc = 0, satAcc = 0, frames = 0;
    for (const tt of times) {
      await new Promise<void>((res) => {
        const done = () => { v.removeEventListener("seeked", done); res(); };
        v.addEventListener("seeked", done);
        try { v.currentTime = Math.max(0, Math.min(tt, Math.max(0, dur - 0.05))); } catch { res(); }
        setTimeout(res, 1500);
      });
      try {
        ctx.drawImage(v, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);
        let fb = 0, fs = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
          const val = max, sat = max === 0 ? 0 : d / max;
          fb += val; fs += sat; n++;
          if (sat > 0.25 && val > 0.2 && d > 0) {
            let h: number;
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60; if (h < 0) h += 360;
            hue[Math.floor(h) % 360] += sat * val;
          }
        }
        if (n > 0) { brightAcc += fb / n; satAcc += fs / n; frames++; }
      } catch { /* tainted/black frame — skip */ }
    }
    URL.revokeObjectURL(url);
    if (frames === 0) return null;
    const brightness = brightAcc / frames, colorfulness = satAcc / frames;
    let bestH = -1, bestV = 0;
    for (let h = 0; h < 360; h++) {
      let sum = 0;
      for (let k = -10; k <= 10; k++) sum += hue[(h + k + 360) % 360];
      if (sum > bestV) { bestV = sum; bestH = h; }
    }
    // Readable punchy accent at the video's dominant hue (or a safe yellow).
    const accent = bestH >= 0 ? hslToHex(bestH, 0.85, 0.62) : "#FACC15";
    return { accent, brightness, colorfulness };
  } catch { return null; }
}

// Curated style presets per mode — each clip deterministically lands on one,
// so DIFFERENT videos get DIFFERENT looks (and the same video stays stable).
// Earlier we relied only on in-browser color sampling, but it often returned
// nothing (offscreen frame capture is flaky) AND talking-head clips are
// skin-dominated → every clip looked the same. Presets guarantee real variety.
const STYLE_PRESETS: Record<string, { templateId: string; accent: string }[]> = {
  subtitles_only: [
    { templateId: "ali",     accent: "#FACC15" },
    { templateId: "minimal", accent: "#22D3EE" },
    { templateId: "ali",     accent: "#F472B6" },
    { templateId: "minimal", accent: "#34D399" },
    { templateId: "ali",     accent: "#A78BFA" },
    { templateId: "minimal", accent: "#FB923C" },
  ],
  podcast: [
    { templateId: "ali",     accent: "#FACC15" },
    { templateId: "minimal", accent: "#22D3EE" },
    { templateId: "ali",     accent: "#F472B6" },
    { templateId: "minimal", accent: "#A78BFA" },
  ],
  basic_effects: [
    { templateId: "tiktok",    accent: "#FACC15" },
    { templateId: "instagram", accent: "#FCD34D" },
    { templateId: "ali",       accent: "#22D3EE" },
    { templateId: "karaoke",   accent: "#EC4899" },
  ],
  advanced_effects: [
    { templateId: "hormozi",  accent: "#22C55E" },
    { templateId: "bold-pop", accent: "#FACC15" },
    { templateId: "tiktok",   accent: "#F472B6" },
    { templateId: "beast",    accent: "#FACC15" },
  ],
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Auto subtitle STYLE+COLOR that VISIBLY varies per video. Each clip gets a
// deterministic preset (template + accent) from its fingerprint; when the clip
// is colorful enough we also borrow its real dominant color for the highlight
// word so it matches the footage. NEVER returns null — always applies a look.
async function autoStyleFromVideo(
  file: File, mode: EditMode, seedStr: string,
): Promise<{ templateId: string; style: SubtitleStyle }> {
  const presets = STYLE_PRESETS[mode] ?? STYLE_PRESETS.subtitles_only;
  const seed = hashStr(seedStr || `${file.name}-${file.size}`);
  const preset = presets[seed % presets.length];
  let accent = preset.accent;
  try {
    const acc = await extractVideoAccent(file);
    // Only adopt the sampled color when the clip is genuinely colorful — keeps
    // skin-toned talking-head clips on their distinct preset color instead.
    if (acc && acc.colorfulness >= 0.28) accent = acc.accent;
  } catch { /* sampling failed — preset color stands */ }
  const base = TEMPLATES.find((t) => t.id === preset.templateId) ?? TEMPLATES[0];
  const style: SubtitleStyle = { ...base.style, highlightColor: accent };
  return { templateId: preset.templateId, style };
}

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
  // Stable, always-punctuated word stream — the source of truth for re-deriving
  // subtitles when the user changes words-per-line / commas / stretch settings.
  const baseWordsRef = useRef<TimedWord[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [phase, setPhase] = useState<"setup" | "editing">("setup");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  // How the finished file was actually delivered, so the success popup tells
  // the truth: "share" = OS share-sheet opened (gallery IF the user picked
  // "Save Video"); "download" = went to the Downloads/Files folder.
  const [exportSavedVia, setExportSavedVia] = useState<"share" | "download">("download");
  // Background export job — the render runs server-side; this drives a
  // non-blocking "מייצא ברקע" badge so the user can keep working / leave.
  const [exportJob, setExportJob] = useState<{ id: string; filename: string; status: "rendering" | "done" } | null>(null);
  const exportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The finished MP4 is pre-fetched here when the job completes, so the
  // "save to gallery" tap can call navigator.share() SYNCHRONOUSLY (iOS drops
  // share permission if you await between the tap and the share call).
  const exportBlobRef = useRef<Blob | null>(null);
  const [insufficientInfo, setInsufficientInfo] = useState<InsufficientInfo | null>(null);
  const [whisperModel, setWhisperModel] = useAutoSavedState<string>("whisperModel", "ivrit-ai/whisper-large-v3-turbo-ct2");
  const [effects, setEffects] = useAutoSavedState<VideoEffects>("effects", MODE_DEFAULT_EFFECTS.subtitles_only);

  // Toast once on first paint if we restored saved state from a prior session.
  useEffect(() => {
    // Dashboard "שחזר גרסה" → /?restore=<snapshotId>: restore that EXACT saved
    // version (not just the latest), so a user can roll back to an earlier
    // styled version after a reset (Liat lost her styling on a reload).
    if (typeof window !== "undefined") {
      const restoreId = new URLSearchParams(window.location.search).get("restore");
      if (restoreId) {
        // Clean the URL immediately so a later refresh doesn't re-restore.
        window.history.replaceState({}, "", "/");
        (async () => {
          const v = await loadCurrentVideo();
          if (!v) { toast.error("לא נמצא הסרטון לשחזור — נסו להעלות אותו שוב"); return; }
          const snaps = await listSnapshots();
          const snap = snaps.find((s) => String(s.id) === restoreId);
          await handleResume(storedToFile(v), snap);
        })();
        return;
      }
    }
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
    // Refresh mid-edit: if the user was actively editing in THIS tab (not a
    // long-ago abandoned session), silently re-attach the cached video and
    // skip the "Continue from edit?" banner. Scoped to sessionStorage so it
    // only triggers on refresh/navigation inside the same tab — closing the
    // tab clears the flag and a fresh visit lands on the home page as normal.
    if (typeof window !== "undefined" && sessionStorage.getItem("vm_active_edit") === "1") {
      (async () => {
        const v = await loadCurrentVideo();
        if (!v) {
          sessionStorage.removeItem("vm_active_edit"); // stale flag
          return;
        }
        const file = storedToFile(v);
        // Critical: handleVideo() RESETS effects/subtitles to defaults — never
        // use it on a refresh, it wipes the user's work. Prefer the per-video
        // snapshot (keyed by hash). If no snapshot matches (hash drift, first
        // edit before the 1s autosave, etc.) fall back to handleResume WITHOUT
        // a snapshot — it re-attaches the video and enters editing while
        // LEAVING the per-field useAutoSavedState values (effects/subtitles/
        // style, restored from localStorage on mount) intact. Either way the
        // user keeps everything. Liat: "כל מה שעשיתי נמחק" — this is the fix.
        try {
          const hash = await hashVideoFile(file);
          const snaps = await listSnapshots();
          const latest = snaps
            .filter((s) => s.videoHash === hash)
            .sort((a, b) => b.at - a.at)[0];
          await handleResume(file, latest);
        } catch {
          // Even on error, resume (no reset) rather than handleVideo.
          await handleResume(file);
        }
      })();
      return;
    }
    if (modeMeta.wasRestored) {
      toast.info(toastResume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background-export polling + badge now live in the global <ExportJobBadge>
  // (mounted in the root layout) so the badge survives navigation between
  // pages — Liat: "כשאני עובר עמודים הייצוא ברקע נעלם". The export button just
  // fires a `vm-export-started` event + writes localStorage; the global badge
  // picks it up, polls, shows progress, and delivers the file.

  // OAuth welcome detection. /signup and /login set sessionStorage flags
  // before navigating, but Supabase OAuth (Google) redirects back to "/"
  // outside our control — we can't set a flag from there. Instead, when
  // auth resolves to "user" and we haven't greeted this session yet,
  // check how old the profile is: <60s = fresh OAuth signup (welcome
  // popup), older = OAuth login (returning popup). Then dispatch the
  // custom event AuthSuccessModal listens for, and mark the session
  // greeted so refresh/navigation doesn't re-fire.
  // OAuth ONLY fires the SIGNUP welcome popup, never the returning-login one.
  // Liat 2026-06-16: "פופאפ התחברות שלא יהיה כל פעם שמשתמש קיים נכנס לאתר
  // אלא רק שמתחבר ידני". Returning users in a new tab were getting the
  // login popup on every visit because sessionStorage is per-tab.
  //
  // New rule: the login popup only fires when /login explicitly sets
  // sessionStorage["vm_auth_event"]="login" right before navigating to "/".
  // For OAuth returning users we say nothing. For OAuth fresh signups
  // (profile age < 60s) we still fire the welcome popup since /signup
  // can't set the flag for an OAuth-redirect flow.
  useEffect(() => {
    if (auth.status !== "user" || !auth.profile) return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("vm_session_greeted")) return;
      if (sessionStorage.getItem("vm_auth_event")) return; // password flow handles itself
      const createdAt = new Date(auth.profile.created_at).getTime();
      const ageSec = (Date.now() - createdAt) / 1000;
      // Only fire for fresh signups (<60s old). Returning users → silent.
      if (ageSec < 0 || ageSec >= 60) {
        sessionStorage.setItem("vm_session_greeted", "1");
        return;
      }
      sessionStorage.setItem("vm_session_greeted", "1");
      window.dispatchEvent(new CustomEvent("vm-auth-popup", { detail: { kind: "signup" } }));
    } catch {/* sessionStorage unavailable */}
  }, [auth.status, auth.profile]);

  // Auto-snapshot during editing — debounced. Liat: guests who upload, edit,
  // and then sign up via email confirmation lose all their edits because
  // the confirmation link reloads the page and the only snapshot we'd saved
  // was the post-transcription one (subtitles only). With this effect, any
  // change to subtitles/style/effects/settings/template/mode is captured
  // within ~3s so "המשך עריכה" restores the FULL state including effects,
  // SFX, music, color filters, logos, etc.
  // Keep the latest editor state in a ref so the pagehide flush (below)
  // always saves the CURRENT values, not a stale closure.
  const snapshotPayloadRef = useRef({ mode, exportFormat, settings, templateId, style, subtitles, effects, whisperModel });
  snapshotPayloadRef.current = { mode, exportFormat, settings, templateId, style, subtitles, effects, whisperModel };

  // Capture the base word stream the first time real subtitles appear (after a
  // restore/cache-load where handleTranscribe didn't set it), so the live
  // re-chunk / commas / stretch settings have a stable source to rebuild from.
  useEffect(() => {
    if (baseWordsRef.current.length === 0 && subtitles.some((s) => s.words && s.words.length)) {
      baseWordsRef.current = flattenWords(subtitles);
    }
  }, [subtitles]);

  useEffect(() => {
    if (phase !== "editing" || !videoHash) return;
    // 1s debounce (was 3s). The snapshot is what "המשך עריכה"/refresh
    // restores from; at 3s, adding effects then reloading within 3s meant
    // the latest snapshot was the post-transcription one (subtitles only,
    // default effects) → effects appeared "not saved". 1s captures edits
    // far more reliably.
    const id = window.setTimeout(() => {
      saveSnapshot({
        at: Date.now(),
        label: "שמירה אוטומטית",
        auto: true,
        videoHash,
        payload: snapshotPayloadRef.current,
      }).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(id);
  }, [phase, videoHash, mode, exportFormat, settings, templateId, style, subtitles, effects, whisperModel]);

  // Belt-and-suspenders: flush a snapshot the instant the tab is hidden or
  // about to unload (refresh, close, navigate). Guarantees the freshest
  // effects/style/etc are persisted even if the user reloads sub-second
  // after a change, before the 1s debounce fires.
  useEffect(() => {
    if (phase !== "editing" || !videoHash) return;
    const flush = () => {
      saveSnapshot({
        at: Date.now(),
        label: "שמירה אוטומטית",
        auto: true,
        videoHash,
        payload: snapshotPayloadRef.current,
      }).catch(() => {});
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, videoHash]);

  // Always flag "actively editing" while in the editor so ANY refresh
  // re-enters the editor and restores state — not just refreshes that
  // happened to go through handleVideo/handleResume.
  useEffect(() => {
    if (phase === "editing") {
      try { sessionStorage.setItem("vm_active_edit", "1"); } catch {}
    }
  }, [phase]);

  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [activeReferenceId, setActiveReferenceId] = useState<string | undefined>(undefined);

  async function handleVideo(file: File) {
    // Full-screen loader so mobile users see clear feedback while the file
    // is hashed + persisted to IndexedDB — on a big video this is several
    // seconds and was previously a silent freeze. We also enforce a minimum
    // visible duration (900ms) so the loader doesn't FLASH on small files —
    // on mobile, after the OS file picker dismisses the user needs a beat
    // to register what's happening or the page seems to jump unexpectedly.
    const loaderShownAt = Date.now();
    setIsProcessing(true);
    setProgressMessage(progLoadVideo);
    try {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      // FRESH START for every new upload. A new video must be edited from
      // scratch — it must NOT inherit the previous video's captions, colors,
      // design or settings (Liat: "כשאני מעלה סרטון חדש הוא עורך עם אותם
      // כתוביות אותו עיצוב וצבע כמו הקודם — אני לא רוצה! שיערוך מהתחלה לפי
      // הסרטון עצמו"). Reset every per-video editing field to the current
      // mode's defaults; the new video gets transcribed fresh.
      setSubtitles([]);
      baseWordsRef.current = []; // fresh video → recapture the word stream
      setEffects(MODE_DEFAULT_EFFECTS[mode]);
      setSettings(MODE_DEFAULT_SETTINGS[mode]);
      const freshTpl = TEMPLATES.find((t) => t.id === MODE_DEFAULT_TEMPLATE[mode]);
      if (freshTpl) { setTemplateId(freshTpl.id); setStyle(freshTpl.style); }
      setAnalysis(null);
      setActiveReferenceId(undefined);
      // Fresh project → drop any bg-music bytes saved for the previous video
      // so they can't re-attach on a later reload.
      void clearCurrentMusic();
      setDownloadSuccess(null);
      setErrorMessage(null);
      // Persist the blob to IndexedDB so hot-reload/refresh doesn't lose it.
      // Hash first so transcription-cache lookups work consistently.
      try {
        const hash = await hashVideoFile(file);
        setVideoHash(hash);
        saveCurrentVideo(file, hash).catch(() => {/* best-effort */});
      } catch { /* IDB unavailable — fall back to in-memory only */ }
      // Mark this tab as "actively editing" so a refresh re-enters the editor
      // instead of dropping back to the home page.
      try { sessionStorage.setItem("vm_active_edit", "1"); } catch {}
    } finally {
      // Min-duration: keep the overlay up at least 900ms so the user clearly
      // registers it even when hashing finishes in 200ms.
      const remaining = 900 - (Date.now() - loaderShownAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setIsProcessing(false);
      setProgressMessage("");
      // Scroll to the top of the editor on mobile — otherwise the page stays
      // at whatever scroll position the upload-zone was at, which leaves the
      // brand-new video preview off-screen. (Liat: "ישר קופץ למטה ולא לראש".)
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    }
  }

  /**
   * After a reload, restore the background music from IndexedDB. The persisted
   * audio BYTES are the source of truth (saved at upload time); the snapshot's
   * effects.bgMusicUrl is unreliable — it's a dead blob: URL at best, and was
   * often null (a prior session dropped it, or the snapshot fired before the
   * url propagated). So DON'T gate on what the snapshot says: if music bytes
   * exist in IndexedDB, rebuild a fresh, playable blob: URL from them. If
   * there are no bytes (project never had music, or it was removed — clearMusic
   * + handleVideo both clear the bytes), drop any leftover dead blob ref so the
   * preview/export don't choke on it.
   */
  async function reconcileBgMusic() {
    try {
      const m = await loadCurrentMusic();
      if (m?.blob && m.blob.size > 0) {
        const fresh = URL.createObjectURL(m.blob);
        setEffects((e) => (e.bgMusicUrl === fresh ? e : { ...e, bgMusicUrl: fresh }));
      } else {
        setEffects((e) =>
          typeof e.bgMusicUrl === "string" && e.bgMusicUrl.startsWith("blob:")
            ? { ...e, bgMusicUrl: undefined }
            : e,
        );
      }
    } catch { /* IDB unavailable — leave as-is */ }
  }

  /**
   * Restore from a previously-saved project: re-attach the file, hash it,
   * and if a snapshot was selected, hydrate all editor state from it and
   * jump straight to the editing phase.
   */
  // Tag the autosaved subtitles with the current video hash, so a later "שחזר"
  // can tell whether the localStorage subtitles are THIS video's real edits
  // (vs a previous/other project) and restore them race-free.
  useEffect(() => {
    if (typeof window !== "undefined" && videoHash) {
      try { localStorage.setItem("vm_project_v1.subtitlesHash", videoHash); } catch { /* ignore */ }
    }
  }, [videoHash]);

  async function handleResume(file: File, snap?: ProjectSnapshot) {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setErrorMessage(null);
    setDownloadSuccess(null);
    try { sessionStorage.setItem("vm_active_edit", "1"); } catch {}
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
        // Rebuild the bg-music blob URL from IndexedDB so the music plays
        // again (snapshot's bgMusicUrl is unreliable — bytes are the truth).
        void reconcileBgMusic();
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
      // Prefer the user's OWN edits when localStorage holds subtitles tagged for
      // THIS exact video (the autosave-flush keeps them fresh on close). This
      // must win over the ORIGINAL cached transcription below — otherwise a
      // resume after editing-without-a-snapshot reverts their edits. Read
      // straight from localStorage so it's race-free (React state may not have
      // hydrated yet). Liat: "שחזר לפעמים עובד לפעמים לא".
      try {
        const lsHash = localStorage.getItem("vm_project_v1.subtitlesHash");
        const lsRaw  = localStorage.getItem("vm_project_v1.subtitles");
        if (lsHash === hash && lsRaw) {
          const edited = JSON.parse(lsRaw) as Subtitle[];
          if (edited?.length) {
            setSubtitles(edited);
            setPhase("editing");
            void reconcileBgMusic();
            if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
            toast.success(`שוחזרה העריכה האחרונה (${edited.length} כתוביות)`);
            return;
          }
        }
      } catch { /* fall through to the cached transcription */ }

      const cachedSubs = await loadTranscription(hash);
      if (cachedSubs && cachedSubs.length > 0) {
        setSubtitles(cachedSubs);
        setPhase("editing");
        // Rebuild the music blob URL from the persisted bytes in IndexedDB.
        void reconcileBgMusic();
        // Snap to top so the user sees the video preview + first caption,
        // not the bottom of the editor panel where they were before transcription.
        if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
        toast.success(`הסרטון והתמלול שוחזרו (${cachedSubs.length} כתוביות)`);
        return;
      }

      // No per-video snapshot and no cached transcription for THIS hash —
      // but the per-field autosave (useAutoSavedState) may still hold the
      // last project's subtitles in localStorage. If so, the user was
      // mid-edit; re-enter the editor and let those hydrated values stand
      // (effects/style/subtitles already restored on mount). Only truly
      // empty projects fall back to setup.
      let lsSubs = 0;
      try {
        const raw = localStorage.getItem("vm_project_v1.subtitles");
        if (raw) lsSubs = (JSON.parse(raw) as unknown[])?.length ?? 0;
      } catch { /* ignore */ }
      if (lsSubs > 0) {
        setPhase("editing");
        void reconcileBgMusic();
        if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
        toast.success("הפרויקט שוחזר");
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
    // Liat 2026-06-16: "כשאני לוחצת על תבנית מוכנה זה ממש מוחק לי את כל
    // האפקטים שעשיתי. שישנה רק את הכתוביות בלי האפקטים". So a reference
    // style now only touches subtitle visuals — template + style + the
    // animation type — and leaves the user's mode, settings, and effects
    // alone. The full-look swap was overstepping.
    const tpl = TEMPLATES.find((t) => t.id === ref.preset.templateId);
    if (tpl) {
      setTemplateId(tpl.id);
      setStyle(tpl.style);
    }
    // The animation type is the one effect field that belongs to "subtitle
    // visuals" — every other field (zoom, color, drama, SFX, logos, music)
    // is left untouched.
    setEffects({ ...effects, subtitleAnimation: ref.preset.effectsOverride.subtitleAnimation });
    setActiveReferenceId(ref.id);
  }

  async function startTranscription(opts?: { force?: boolean }) {
    if (!videoFile) return;
    setIsProcessing(true);
    setErrorMessage(null);
    // Keep the screen awake for the whole job. On mobile the screen dimming +
    // locking lets the browser throttle/suspend the tab, which can abort the
    // upload/transcription mid-request (Liat: "שגיאה בתמלול... אולי בגלל
    // שהמסך בטלפון נכבה?"). Released in the finally below.
    let wakeLock: WakeLockHandle | null = null;
    try { wakeLock = await acquireWakeLock(); } catch {}

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
      // FIRST: if the user already has SAVED EDITS for this exact video
      // (styling, effects, edited subtitles) restore that snapshot instead of
      // re-deriving from scratch. Re-loading the same video must NEVER wipe
      // their work (Liat: "עשיתי טעינה שוב וזה מחק לי את עיצוב הכתוביות וכל
      // העריכה"). Snapshots keep the last 10 versions in IndexedDB.
      try {
        const snaps = await listSnapshots();
        const snap = snaps
          .filter((s) => s.videoHash === videoHash)
          .sort((a, b) => b.at - a.at)[0];
        if (snap) {
          const p = snap.payload;
          setMode(p.mode);
          setExportFormat(p.exportFormat);
          setSettings(p.settings);
          setTemplateId(p.templateId);
          setStyle(p.style);
          baseWordsRef.current = flattenWords(p.subtitles);
          setSubtitles(p.subtitles);
          setEffects(p.effects);
          setWhisperModel(p.whisperModel);
          setPhase("editing");
          void reconcileBgMusic();
          if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
          setIsProcessing(false);
          await releaseWakeLock(wakeLock);
          toast.success(`שוחזרה העריכה שלך (${p.subtitles.length} כתוביות) — לא נמחקו ${currency}`);
          return;
        }
      } catch { /* no snapshot → fall through to cached transcription */ }

      const cached = await loadTranscription(videoHash);
      if (cached && cached.length > 0) {
        // No prior edits — re-chunk the cached transcription through current
        // settings (punctuation/silence breaking) and derive a per-video style.
        baseWordsRef.current = flattenWords(cached);
        setSubtitles(applySubtitleSettings(cached, settings, baseWordsRef.current));
        // Match subtitle style+color to THIS video (client-side, since server
        // analysis is unavailable) — only for a never-edited cached video.
        try {
          const auto = await autoStyleFromVideo(videoFile, mode, videoHash || "");
          if (auto) { setTemplateId(auto.templateId); setStyle(auto.style); }
        } catch {}
        setPhase("editing");
        // Snap to top so the user sees the video preview + first caption,
        // not the bottom of the editor panel where they were before transcription.
        if (typeof window !== "undefined") setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
        setIsProcessing(false);
        await releaseWakeLock(wakeLock);
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

      const freshSubs = transcribeData.subtitles as Subtitle[];
      // Keep the punctuated word stream as the source of truth, then apply the
      // current settings (words-per-line / commas / stretch) so the checkboxes
      // are honored from the first render.
      baseWordsRef.current = flattenWords(freshSubs);
      setSubtitles(applySubtitleSettings(freshSubs, settings, baseWordsRef.current));
      // Match subtitle style+color to THIS video, client-side. The server
      // analyze route (cv2/mediapipe) isn't installed in prod, so we can't
      // rely on it — sample the video's accent color in the browser instead.
      try {
        const auto = await autoStyleFromVideo(videoFile, mode, videoHash || "");
        if (auto) { setTemplateId(auto.templateId); setStyle(auto.style); }
      } catch {}
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
      await releaseWakeLock(wakeLock);
      // Liat 2026-06-16: after the AI pipeline finishes, the page often
      // sat at the bottom (where the "Start" button was), leaving the new
      // editor + preview off-screen — confusing especially on mobile. The
      // scrollTo MUST run after the editor phase has rendered, otherwise
      // the new DOM mounting underneath us shifts the scroll position back
      // to where the (taller) editor pushed it. Two rAFs + a 150ms fallback
      // guarantees the swap finished before we scroll.
      try {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }));
        setTimeout(() => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }, 150);
      } catch {}
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

    // 4. Auto subtitle STYLE + COLOR matched to THIS video. Previously the AI
    // re-used the same template every time (and skipped subtitles_only
    // entirely), so every clip looked identical. Now we pick a template by the
    // clip's energy/colorfulness and recolor the highlighted word with the
    // accent color sampled from the footage — in every mode.
    const auto = pickAutoSubtitleStyle(ana, userPickedMode);
    setTemplateId(auto.templateId);
    setStyle(auto.style);
  }

  // ───────────────── Background export job (poll + deliver) ─────────────────
  // The MP4 render runs server-side and can take minutes. Instead of blocking
  // on a spinner, the export starts a background job; we poll its status and
  // deliver the file when ready, so the user can keep working or leave.
  async function exportAuthHeader(): Promise<Record<string, string>> {
    try {
      const { browserClient } = await import("@/lib/supabase");
      const token = (await browserClient()?.auth.getSession())?.data.session?.access_token;
      return token ? { authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }

  // Can this device hand a video file to the OS share-sheet (→ "Save to
  // Photos"/gallery)? True on mobile Safari/Chrome, false on desktop.
  function canShareVideoFiles(): boolean {
    try {
      const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof navAny.share !== "function" || typeof navAny.canShare !== "function") return false;
      const probe = new File([new Uint8Array([0])], "probe.mp4", { type: "video/mp4" });
      return navAny.canShare({ files: [probe] });
    } catch { return false; }
  }

  // Hand the (already in-memory) blob to the gallery. MUST run synchronously
  // from a user tap on iOS — no await before navigator.share().
  async function deliverExportFile(blob: Blob, filename: string): Promise<boolean> {
    const file = new File([blob], filename, { type: "video/mp4" });
    const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof navAny.share === "function" && typeof navAny.canShare === "function" && navAny.canShare({ files: [file] })) {
      try { await navAny.share({ files: [file], title: filename }); return true; }
      catch (e) { if (!(e instanceof Error) || e.name !== "AbortError") console.warn("[export] share failed", e); }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return false;
  }

  function clearExportJob() {
    if (exportPollRef.current) { clearInterval(exportPollRef.current); exportPollRef.current = null; }
    exportBlobRef.current = null;
    setExportJob(null);
    try { localStorage.removeItem("vm_export_job"); } catch {}
  }

  // Fetch the finished MP4 bytes into memory (so the gallery-save tap is
  // instant + keeps the iOS user-gesture). Returns true on success.
  async function fetchExportBlob(jobId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/render-result/${jobId}`, { headers: await exportAuthHeader() });
      if (!res.ok) throw new Error(`status ${res.status}`);
      exportBlobRef.current = await res.blob();
      return true;
    } catch { return false; }
  }

  // Called by the badge's "save to gallery / download" tap (a real user
  // gesture). Uses the pre-fetched blob so share() fires immediately.
  async function saveExportNow(jobId: string, filename: string) {
    if (!exportBlobRef.current) await fetchExportBlob(jobId);
    if (!exportBlobRef.current) { toast.error("ההורדה נכשלה — אפשר לנסות שוב"); return; }
    const shared = await deliverExportFile(exportBlobRef.current, filename);
    setExportSavedVia(shared ? "share" : "download");
    setDownloadSuccess(filename);
    toast.success(shared ? "✓ יש לבחור 'שמור וידאו' בחלון — והסרטון בגלריה 📸" : "✓ הסרטון ירד לתיקיית ההורדות");
    setTimeout(() => setDownloadSuccess(null), 12000);
  }

  async function pollExportStatus(jobId: string, filename: string) {
    try {
      const res = await fetch(`/api/render-status/${jobId}`, { headers: await exportAuthHeader() });
      if (res.status === 404) { clearExportJob(); toast.error("הייצוא לא נמצא — אפשר לנסות שוב"); return; }
      if (!res.ok) return; // transient — keep polling
      const { status } = await res.json();
      if (status === "done") {
        if (exportPollRef.current) { clearInterval(exportPollRef.current); exportPollRef.current = null; }
        try { localStorage.removeItem("vm_export_job"); } catch {}
        // Pre-fetch the bytes so the save/download is instant.
        await fetchExportBlob(jobId);
        setExportJob({ id: jobId, filename, status: "done" });
        if (canShareVideoFiles()) {
          // MOBILE: don't auto-deliver — the "Save to gallery" share-sheet only
          // works from a user TAP. Prompt the user to tap the badge button.
          toast.success("🎉 הסרטון מוכן! יש ללחוץ 'שמור לגלריה' לשמירה ישירה בטלפון");
        } else {
          // DESKTOP: just download it (goes to the Downloads folder, expected).
          if (exportBlobRef.current) await deliverExportFile(exportBlobRef.current, filename);
          setExportSavedVia("download");
          setDownloadSuccess(filename);
          toast.success("✓ הסרטון מוכן והורד בהצלחה!");
          setTimeout(() => setDownloadSuccess(null), 12000);
        }
      } else if (status === "failed") {
        clearExportJob();
        toast.error("הייצוא נכשל — המאסטרים שלך הוחזרו. אפשר לנסות שוב 🙏");
      }
      // queued / rendering → keep polling
    } catch { /* network hiccup — keep polling */ }
  }

  function beginExportJob(jobId: string, filename: string) {
    if (exportPollRef.current) clearInterval(exportPollRef.current);
    setExportJob({ id: jobId, filename, status: "rendering" });
    try { localStorage.setItem("vm_export_job", JSON.stringify({ id: jobId, filename })); } catch {}
    exportPollRef.current = setInterval(() => { void pollExportStatus(jobId, filename); }, 4000);
    void pollExportStatus(jobId, filename); // immediate first check
  }

  async function exportProject() {
    // Block a SECOND concurrent export — renders queue server-side, and a
    // pile-up makes each one slow. One at a time (Liat: "שיקפוץ פופאפ שאי
    // אפשר לייצא שני סרטונים במקביל"). The global badge clears this key on
    // done/fail.
    try {
      if (localStorage.getItem("vm_export_job")) {
        toast.error("אי אפשר לייצא שני סרטונים במקביל 🙏 יש ייצוא שעדיין רץ — כשהוא יסתיים הוא יירד אוטומטית.");
        return;
      }
    } catch { /* ignore */ }

    // Guests must sign up before the download starts. SignupGate opens an
    // inline popup with the 25-master gift framing; on success the gate's
    // onSuccess closes the modal and we resume the export automatically.
    if (auth.status === "guest") {
      // Belt + suspenders: capture the CURRENT edit state right now, even
      // if the 3s debounce hasn't fired yet. If signup needs email
      // confirmation, the confirm-link reloads the page → the only way
      // back to this exact edit is via a snapshot in IndexedDB.
      if (videoHash) {
        saveSnapshot({
          at: Date.now(),
          label: "לפני הרשמה",
          videoHash,
          payload: { mode, exportFormat, settings, templateId, style, subtitles, effects, whisperModel },
        }).catch(() => {});
      }
      setShowSignupGate(true);
      return;
    }
    // Pre-flight credit check for MP4 export — fire the "insufficient
    // masters" popup BEFORE we spin up the renderer. Previously the user
    // saw a long loader, then a generic error toast. Now: instant popup
    // with a "buy" / "back" CTA, no wait.
    // SRT export is free, so this guard only applies to mp4.
    if (exportFormat === "mp4") {
      const { total: cost } = calcDynamicCost(mode, effects);
      const balance = auth.profile?.credits ?? 0;
      if (balance < cost) {
        setInsufficientInfo({ need: cost, have: balance });
        return;
      }
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
    // Keep the screen awake during export too — same reason as transcription.
    let exportWakeLock: WakeLockHandle | null = null;
    try { exportWakeLock = await acquireWakeLock(); } catch {}

    // Pause any playing preview videos before the loader overlays the screen
    // (Liat 2026-06-16: "כשאני לוחצת על יצוא הסרטון מתנגן ברקע וזה חופר").
    // Hitting every <video> on the page covers both the main preview and
    // the PiP card without coupling this code to those component refs.
    if (typeof document !== "undefined") {
      document.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch {} });
    }

    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("subtitles", JSON.stringify(subtitles));
      fd.append("style", JSON.stringify(style));
      // ANY blob: URL anywhere in effects (custom logos, AI brand logos,
      // uploaded images, bg media, etc.) is a browser-only object URL the
      // server-side Remotion render cannot fetch — it 404s. Deep-walk the
      // whole effects object and convert EVERY blob: string to an inline
      // data: URL (base64), which headless Chromium renders fine. http(s)/
      // data values pass through untouched. Cached per-URL so a blob reused
      // across fields is fetched once.
      const blobCache = new Map<string, string>();
      const blobToDataUrl = async (url: string): Promise<string> => {
        const cached = blobCache.get(url);
        if (cached) return cached;
        const blob = await fetch(url).then((r) => r.blob());
        const data = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        blobCache.set(url, data);
        return data;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deepConvertBlobs = async (val: any): Promise<any> => {
        if (typeof val === "string") {
          if (val.startsWith("blob:")) {
            // A blob: object URL is browser-session-scoped and DIES on page
            // reload. After autosave restores a project, its blob refs (e.g.
            // a custom logo or bg-music uploaded in a prior session) point at
            // nothing, so fetch() throws. If we returned the dead URL the
            // server would try to load "/public/blob:..." and 404 the ENTIRE
            // render. Drop it instead — a missing logo/music beats a failed
            // export. (New uploads are stored as data: URLs and survive.)
            try { return await blobToDataUrl(val); } catch { return undefined; }
          }
          return val;
        }
        if (Array.isArray(val)) return Promise.all(val.map(deepConvertBlobs));
        if (val && typeof val === "object") {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(val)) out[k] = await deepConvertBlobs(v);
          return out;
        }
        return val;
      };
      const effectsForExport = (await deepConvertBlobs(effects)) as typeof effects;
      // Background music: send the actual audio BYTES as a file (the proven
      // static-file render path), not a giant inlined data: URL. Re-fetch the
      // client-side blob and attach it; the server stages it and points
      // bgMusicUrl at the staged filename. If the blob is dead (page was
      // reloaded → object URL gone), the fetch throws and we leave no file +
      // null bgMusicUrl so the render simply omits music instead of failing.
      let bgMusicSent = false;
      if (effects.bgMusicUrl) {
        try {
          // Prefer the bytes persisted in IndexedDB — they survive reload and
          // don't depend on the blob: URL still being live. Fall back to
          // fetching the in-memory blob URL (e.g. brand-new upload before the
          // IDB write settled, or an http(s) music source).
          const stored = await loadCurrentMusic();
          let blob: Blob | null = stored?.blob ?? null;
          if (!blob || blob.size === 0) {
            blob = await fetch(effects.bgMusicUrl).then((r) => r.blob());
          }
          if (blob && blob.size > 0) {
            fd.append("bgMusic", blob, stored?.name || "bgmusic");
            bgMusicSent = true;
          }
        } catch { /* no usable bytes — server treats missing as no music */ }
      }
      // Don't ship a redundant (and possibly multi-MB) data: URL for music
      // when the bytes already go as a file; the server overrides bgMusicUrl
      // from the uploaded file. Drop any leftover blob: too so it can't 404.
      if (
        bgMusicSent ||
        (typeof effectsForExport.bgMusicUrl === "string" &&
          effectsForExport.bgMusicUrl.startsWith("blob:"))
      ) {
        effectsForExport.bgMusicUrl = undefined;
      }
      fd.append("effects", JSON.stringify(effectsForExport));
      // mode is needed by the server-side credit spend (audit C1).
      fd.append("mode", mode);
      // Natural video dimensions so the export canvas can match the source
      // aspect when aspectRatio = "original" (preview shows the full frame).
      // ALSO the real video DURATION — without it the server falls back to a
      // 10s default and the export gets truncated (Liat: "מסרטון של 24 שניות
      // שמר רק 10 שניות"). Pull both from the main <video> element.
      let exportDurationSec = 0;
      try {
        const vids = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
        const vEl = vids.find((v) => v.videoWidth && v.duration && isFinite(v.duration)) || vids[0] || null;
        if (vEl?.videoWidth && vEl?.videoHeight) {
          fd.append("naturalWidth", String(vEl.videoWidth));
          fd.append("naturalHeight", String(vEl.videoHeight));
        }
        if (vEl?.duration && isFinite(vEl.duration) && vEl.duration > 0) {
          fd.append("durationSec", String(vEl.duration));
          exportDurationSec = vEl.duration;
        }
      } catch { /* best effort */ }
      // Enable per-word highlighting only when highlight differs from main color
      const hasHighlight =
        style.highlightColor.toLowerCase() !== style.color.toLowerCase();
      fd.append("perWordHighlight", String(hasHighlight));

      // /api/render now requires auth (security audit C2). Fetch the
      // Supabase session token and include it; guests never reach this
      // path because SignupGate fires earlier.
      const { browserClient } = await import("@/lib/supabase");
      const sb = browserClient();
      const token = (await sb?.auth.getSession())?.data.session?.access_token;
      // Engine dispatch — NEXT_PUBLIC_EXPORT_ENGINE=remotion routes to the
      // parity-verified Remotion path. Default stays "ffmpeg" so we don't
      // disrupt paying customers during the migration.
      const engine = process.env.NEXT_PUBLIC_EXPORT_ENGINE === "remotion"
        ? "/api/render-remotion"
        : "/api/render";
      const headers = token ? { authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(engine, { method: "POST", body: fd, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `שגיאת שרת ${res.status}`);
      }

      const now = new Date();
      const dateStamp = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const filename = `video-master-${dateStamp}.mp4`;

      // Remotion path returns 202 + { jobId } and renders in the BACKGROUND so
      // the user isn't stuck on a spinner for minutes (Liat: "יצוא לוקח המון
      // זמן... מחכה כבר 10 דקות"). Start the poller + non-blocking badge and
      // bail; the poller delivers the MP4 when it's ready. The legacy FFmpeg
      // engine still streams the blob directly (handled below).
      const contentType = res.headers.get("content-type") || "";
      if (res.status === 202 || contentType.includes("application/json")) {
        const { jobId } = await res.json().catch(() => ({} as { jobId?: string }));
        if (!jobId) throw new Error("לא התקבל מזהה ייצוא מהשרת");
        // Hand off to the GLOBAL <ExportJobBadge> (root layout): persist the
        // job + fire an event. It polls progress and delivers the file, and
        // survives navigating between pages.
        try { localStorage.setItem("vm_export_job", JSON.stringify({ id: jobId, filename })); } catch {}
        window.dispatchEvent(new CustomEvent("vm-export-started", { detail: { jobId, filename } }));
        // Record this export in the user's profile ("הסרטונים שלי") so it shows
        // up there immediately as "בעיבוד"; ExportJobBadge flips it to done/failed.
        try {
          let vidTitle = `סרטון ${dateStamp}`;
          const firstCap = (subtitles?.[0] as { text?: string } | undefined)?.text?.trim();
          if (firstCap) vidTitle = firstCap.length > 40 ? `${firstCap.slice(0, 40)}…` : firstCap;
          const creditsUsed = calcDynamicCost(mode, effects).total;
          addVideo({ id: jobId, title: vidTitle, durationSec: exportDurationSec, mode, creditsUsed, status: "processing" });
          // Cross-device copy in Supabase (best-effort; falls back to local).
          void pushVideoRow({
            id: jobId, title: vidTitle, thumbnailEmoji: "🎬",
            durationSec: exportDurationSec, mode, creditsUsed,
            status: "processing", createdAt: new Date().toISOString(),
          });
        } catch { /* profile recording is best-effort */ }
        toast.success("🎬 הסרטון בעיבוד — אפשר להמשיך לעבוד, נודיע לך כשמוכן");
        return; // finally{} closes the loader; the global badge tracks progress
      }

      const blob = await res.blob();
      const shared = await deliverExportFile(blob, filename);
      setDownloadSuccess(filename);
      toast.success(shared ? "✓ נשמר בגלריה שלך!" : `✓ ${filename} ירד בהצלחה`);
      // Auto-clear the success message after 10 seconds
      setTimeout(() => setDownloadSuccess(null), 10000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(`שגיאת ייצוא: ${msg}`);
      toast.error(`שגיאת ייצוא: ${msg.slice(0, 80)}`);
    } finally {
      setIsProcessing(false);
      setProgressMessage("");
      await releaseWakeLock(exportWakeLock);
    }
  }

  // Headline shown in the AI loader overlay — varies by what's running:
  //  - editing phase → MP4 export (FFmpeg burn-in)
  //  - setup + loadVideo progress → just the upload step (hash+IDB persist).
  //    Liat 2026-06-16: "כשעולה סרטון במובייל זה מראה מסך טעינה של מתמלל
  //    לך — מה קשור?" — the old logic showed the transcription title
  //    during the brief file-load window because it only branched on
  //    phase. Now we look at progressMessage to tell the two apart.
  //  - setup + anything else → transcription (wording differs per mode)
  const loaderTitle = phase === "editing"
    ? "מייצא לך את הסרטון ל-MP4"
    : progressMessage === progLoadVideo
      ? "מעלים את הסרטון שלך"
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

      {/* Background-export badge moved to the GLOBAL <ExportJobBadge> in the
          root layout so it survives navigation between pages. */}

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
                {/* Free-trial gift banner — directly under the trust badges,
                    above the uploader, so a first-time visitor sees the offer
                    right where they start (Liat). */}
                <div className="flex justify-center pt-1">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-brand/25 to-accent-pink/20 border border-brand/40 text-white font-bold text-sm md:text-base rounded-full px-5 py-2.5 shadow-lg shadow-brand/20">
                    נסו אותנו, 25 מאסטרים עלינו במתנה 😉🎁
                  </div>
                </div>
              </div>

              {/* Browser mockup moved down to LandingSections — between "How it
                  works" and "Features" — per Liat's request. Less visual noise
                  at the top, more reward after the user reads the 3 steps. */}

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
                  try { sessionStorage.removeItem("vm_active_edit"); } catch {}
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
                  onChange={(next) => {
                    // Re-derive subtitles live when a setting that affects them
                    // changes: words-per-line (re-chunk), commas (keep/strip),
                    // stretch (fill gaps). Only on real change so we don't wipe
                    // edits on unrelated tweaks. Liat: "רק אם המשתמש מסמן".
                    const affects =
                      next.maxWordsPerLine !== settings.maxWordsPerLine ||
                      next.addPunctuation !== settings.addPunctuation ||
                      next.stretchSubtitles !== settings.stretchSubtitles;
                    setSettings(next);
                    if (affects && subtitles.length > 0) {
                      setSubtitles(applySubtitleSettings(subtitles, next, baseWordsRef.current));
                    }
                  }}
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
                  🔄 מחיקת התמלול ותמלול מחדש
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
            elementPosition={effects.elementPositionOverrides ?? {}}
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
              const next = { ...(effects.elementPositionOverrides ?? {}) };
              if (pos === undefined) delete next[key]; else next[key] = pos;
              setEffects({ ...effects, elementPositionOverrides: next });
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
              {/* Mobile: live preview is a draggable floating PiP card
                  (default top-right, user can move). Stays visible while
                  editing subtitles/settings + reflects every change in
                  real-time because it's the same VideoPreview instance.
                  Desktop: MobilePip becomes lg:contents (no-op). */}
              <MobilePip>
                <VideoPreview
                  videoUrl={videoUrl}
                  subtitles={subtitles}
                  style={style}
                  effects={effects}
                  onTimeUpdate={setCurrentTime}
                  onEffectsChange={setEffects}
                />
              </MobilePip>

              <SubtitleEditor
                subtitles={subtitles}
                onChange={setSubtitles}
                currentTime={currentTime}
                allowElements={modeCapabilities(mode).elements}
                /* When dramaMode is on, label rows that will fire either a
                   drama (B&W flash) or wow (warm pop) effect so the user
                   sees the link between transcript line and on-screen beat.
                   Liat 2026-06-16: "כשאתה מוסיף את האפקט שיהיה מידע ב
                   עריכת כתוביות שהוא דלוק". */
                dramaSubIds={(() => {
                  // Detect drama/wow lines ALWAYS (not only when the toggle is
                  // on) so we can show a "כבוי — להפעלה" chip on matching lines
                  // even when the effect is off — matching the power chip's
                  // pattern. Liat: drama should offer one-click enable like WOW.
                  const ids = new Set<string>();
                  const inWindow = (t: number) => subtitles.find((s) => t >= s.start && t <= s.end + 0.05)?.id;
                  for (const d of detectDramaMoments(subtitles)) { const id = inWindow(d.t); if (id) ids.add(`drama:${id}`); }
                  for (const w of detectWowMoments(subtitles))   { const id = inWindow(w.t); if (id) ids.add(`wow:${id}`); }
                  return ids;
                })()}
                /* Drama (B&W flash) global state + one-click enable, mirroring
                   the power chip. When off, matching lines show "כבוי — להפעלה". */
                dramaOn={!!effects.dramaMode}
                onEnableDrama={() => setEffects((e) => ({ ...e, dramaMode: true }))}
                /* "פעימה" power chip reflects whether the particle/shake/zoom
                   effects are actually ON. When off, the chip shows "כבוי" and
                   one click enables them (Liat: "שיראה סימן שהאפקט כבוי + להדליק"). */
                powerEffectsOn={!!(effects.beatDropZoom || effects.particleBurst || effects.punchShake)}
                onEnablePowerEffects={() => setEffects((e) => ({ ...e, beatDropZoom: true, particleBurst: true, punchShake: true }))}
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
                    if ("sizePx" in override) {
                      const sz = { ...(prev.elementSizePx ?? {}) };
                      if (override.sizePx === undefined) delete sz[key];
                      else sz[key] = override.sizePx;
                      next.elementSizePx = sz;
                    }
                    return next;
                  });
                }}
                elementSizePx={effects.elementSizePx ?? {}}
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

              {/* Manual "save version" button removed per Liat — she already has
                  a save-version control elsewhere; the auto-save (+ protected
                  snapshots) still safeguards work without this extra button. */}
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
                    <h3 className="text-2xl font-extrabold mb-2">הסרטון מוכן! 🎉</h3>
                    {/* Tell the truth about WHERE it landed. share = the OS
                        share-sheet opened → in the gallery ONLY if the user
                        tapped "Save Video / שמור בתמונות". download = it went
                        to the Downloads / Files folder. */}
                    {exportSavedVia === "share" ? (
                      <p className="text-sm text-white/70 mb-5 leading-relaxed">
                        בחלון השיתוף שנפתח, יש לבחור <strong className="text-emerald-300">&quot;שמור וידאו&quot; / &quot;שמירה בתמונות&quot;</strong> — והסרטון יישמר ל<strong className="text-emerald-300">גלריה</strong> 📱
                        <br />
                        <span className="text-xs text-white/50">אם החלון נסגר — הסרטון באפליקציית &quot;קבצים&quot; / ההורדות.</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-white/70 mb-3">
                          הסרטון נשמר ב<strong className="text-emerald-300">תיקיית ההורדות</strong> (אפליקציית &quot;קבצים&quot; → הורדות) 📁
                        </p>
                        <div className="text-xs text-white/50 font-mono break-all bg-bg-card border border-white/10 rounded-lg p-3 mb-5 max-md:hidden">
                          {downloadSuccess}
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => setDownloadSuccess(null)}
                      className="w-full bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity"
                    >
                      סגירה
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
      {/* Post-signup / post-login welcome popups. Self-mounting — reads a
          sessionStorage flag set by /signup or /login right before they
          redirect to "/", then clears it so a refresh doesn'\''t re-fire. */}
      <AuthSuccessModal />
      {/* Pre-export "insufficient credits" popup. Fires before the loader so
          the user gets an instant "buy more" / "back to edit" choice instead
          of waiting through a doomed render. */}
      <InsufficientCreditsModal info={insufficientInfo} onClose={() => setInsufficientInfo(null)} />
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
      {/* RIGHT (RTL first) — brand lockup: logo tight to name + tagline.
          The logo links to "/" so it always works as "home". Since this
          header IS the home page, a same-URL click does nothing by default —
          we intercept and scroll back to the top so the click still feels
          responsive (Liat 2026-06-16: "הלוגו לא מעביר לדף הבית אלא לאותו דף"). */}
      <a
        href="/"
        className="flex items-center gap-2.5 min-w-0 group"
        title="לדף הבית"
        onClick={(e) => {
          if (typeof window !== "undefined" && window.location.pathname === "/") {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      >
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
           title="היתרה — ללחיצה לקניית חבילה">
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
