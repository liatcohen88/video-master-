"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Film, Sparkles, X, Loader2, Download, Wand2, Scissors, ArrowRight } from "lucide-react";
import MasterCoin from "@/components/MasterCoin";
import { splitScript } from "@/lib/multiVideo";
import { getCredits, spend } from "@/lib/credits";
import { useContent } from "@/lib/useContent";
import { hashVideoFile, saveCurrentVideo } from "@/lib/projectStorage";
import AILoadingOverlay from "@/components/AILoadingOverlay";
import LogoMark from "@/components/LogoMark";
import { toast } from "@/components/Toaster";

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
  thumbnails: string[];
  durationSec: number;
  transitions: "none" | "auto";
};

export default function MultiEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [script, setScript] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [result, setResult] = useState<EditResult | null>(null);
  // Auto-transition toggle — only meaningful after a first result exists.
  const [transitions, setTransitions] = useState(false);
  const [retiming, setRetiming] = useState(false);
  // Full-screen overlay for download / transfer-to-editor actions.
  const [overlay, setOverlay] = useState<{ title: string; subtitle?: string; hint?: string } | null>(null);

  const router = useRouter();
  const multiCost = Number(useContent("pricing.cost.multi_video") ?? 20);

  // Live credit balance for the header pill (updates after a paid download).
  const [credits, setCreditsLocal] = useState(0);
  useEffect(() => {
    setCreditsLocal(getCredits());
    const refresh = () => setCreditsLocal(getCredits());
    window.addEventListener("credits-change", refresh);
    return () => window.removeEventListener("credits-change", refresh);
  }, []);

  // CMS-editable copy (admin → "חיבור סרטונים")
  const cTitle      = useContent("multi.title") as string;
  const cSubtitle   = useContent("multi.subtitle") as string;
  const cScriptLabel= useContent("multi.scriptLabel") as string;
  const cScriptHelp = useContent("multi.scriptHelp") as string;
  const cCta        = useContent("multi.cta") as string;
  const cBottomNote = useContent("multi.bottomNote") as string;
  const appName     = useContent("brand.appName") as string;
  const tagline     = useContent("brand.tagline") as string;
  const logoSize    = Number(useContent("brand.headerLogoSize") ?? 56);
  const currency    = (useContent("brand.currencyName") as string) || "קרדיטים";
  // Extended runtime copy — toasts, status, loaders, picker (all CMS).
  const cErrMin           = useContent("multi.error.minFiles") as string;
  const cErrScriptReq     = useContent("multi.error.scriptRequired") as string;
  const cErrGeneric       = useContent("multi.error.generic") as string;
  const cMergeTitle       = useContent("multi.loader.merging.title") as string;
  const cMergeSubtitle    = useContent("multi.loader.merging.subtitle") as string;
  const cMergeHint        = useContent("multi.loader.merging.hint") as string;
  const cStatusDoneTpl    = useContent("multi.status.done") as string;
  const cStatusUpdatedTpl = useContent("multi.status.updated") as string;
  const cStatusAddTr      = useContent("multi.status.addingTransitions") as string;
  const cStatusRmTr       = useContent("multi.status.removingTransitions") as string;
  const cStatusReassign   = useContent("multi.status.reassigning") as string;
  const cInsufficientTpl  = useContent("multi.toast.insufficient") as string;
  const cInsufficientShort= useContent("multi.toast.insufficientShort") as string;
  const cDownloadedTpl    = useContent("multi.toast.downloaded") as string;
  const cDownloadErr      = useContent("multi.toast.downloadError") as string;
  const cTransferErr      = useContent("multi.toast.transferError") as string;
  const cPrepDlTitle      = useContent("multi.loader.preparingDownload.title") as string;
  const cPrepDlSubtitle   = useContent("multi.loader.preparingDownload.subtitle") as string;
  const cTransferTitle    = useContent("multi.loader.transferring.title") as string;
  const cTransferSubtitle = useContent("multi.loader.transferring.subtitle") as string;
  const cTipHome          = useContent("multi.tooltip.home") as string;
  const cBackHome         = useContent("multi.backHome") as string;
  const cSourcesLabel     = useContent("multi.sources.label") as string;
  const cScriptPh         = useContent("multi.script.placeholder") as string;
  const cScriptEmpty      = useContent("multi.script.emptyHint") as string;
  const cSplitPrefix      = useContent("multi.script.splitPrefix") as string;
  const cSplitSuffix      = useContent("multi.script.splitSuffix") as string;
  const cPerVideoTpl      = useContent("multi.script.perVideoTpl") as string;
  const cBtnBusy          = useContent("multi.btn.busy") as string;
  const cPreviewEmpty     = useContent("multi.preview.empty") as string;
  const cTrTitle          = useContent("multi.transitions.title") as string;
  const cTrOn             = useContent("multi.transitions.onDesc") as string;
  const cTrOff            = useContent("multi.transitions.offDesc") as string;
  const cTrToggleTitle    = useContent("multi.transitions.toggleTitle") as string;
  const cTrBusyOn         = useContent("multi.transitions.busy.on") as string;
  const cTrBusyOff        = useContent("multi.transitions.busy.off") as string;
  const cBtnDl            = useContent("multi.btn.download") as string;
  const cBtnTransfer      = useContent("multi.btn.transferToEditor") as string;
  const cAssignHeading    = useContent("multi.assign.heading") as string;
  const cAssignHelp       = useContent("multi.assign.help") as string;
  const cAssignVideoTpl   = useContent("multi.assign.videoLabelTpl") as string;

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
      setStatus("error"); setStatusMsg(cErrMin);
      return;
    }
    if (script.trim().length < 5) {
      setStatus("error"); setStatusMsg(cErrScriptReq);
      return;
    }
    setStatus("working");
    setStatusMsg("");
    setOverlay({ title: cMergeTitle, subtitle: cMergeSubtitle, hint: cMergeHint });
    setResult(null);

    const fd = new FormData();
    fd.append("script", script);
    fd.append("transitions", transitions ? "auto" : "none");
    for (const f of files) fd.append("video", f);

    try {
      const { browserClient } = await import("@/lib/supabase");
      const sb = browserClient();
      const token = (await sb?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/multi-edit", {
        method: "POST",
        body: fd,
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || cErrGeneric);
      setResult(j as EditResult);
      setStatus("done");
      setStatusMsg(cStatusDoneTpl.replace("{{n}}", String(j.picks.length)).replace("{{sec}}", j.durationSec.toFixed(1)));
    } catch (e: unknown) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setOverlay(null);
    }
  }

  /**
   * Re-join cached picks — sends them back so the server skips transcription
   * (fast, no Whisper). Shared by the transitions toggle and the manual
   * video-per-segment picker. `recompute` re-derives clip timing when the
   * user changed which video fills a segment.
   */
  async function reprocess(picks: ResultPick[], transitionsOn: boolean, recompute: boolean, msg: string) {
    if (files.length < 2) return;
    setRetiming(true);
    setStatusMsg(msg);

    const fd = new FormData();
    fd.append("transitions", transitionsOn ? "auto" : "none");
    fd.append("picks", JSON.stringify(picks));
    if (recompute) fd.append("recomputeTiming", "1");
    for (const f of files) fd.append("video", f);

    try {
      const { browserClient } = await import("@/lib/supabase");
      const sb = browserClient();
      const token = (await sb?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/multi-edit", {
        method: "POST",
        body: fd,
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || cErrGeneric);
      setResult(j as EditResult);
      setStatus("done");
      setStatusMsg(cStatusUpdatedTpl.replace("{{sec}}", j.durationSec.toFixed(1)));
    } catch (e: unknown) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRetiming(false);
    }
  }

  function reprocessWithTransitions(next: boolean) {
    setTransitions(next);
    if (!result) return;
    reprocess(result.picks, next, /* recompute */ false,
      next ? cStatusAddTr : cStatusRmTr);
  }

  /** Manual picker: assign a different source video to one script segment. */
  function assignVideo(scriptIdx: number, videoIdx: number) {
    if (!result || retiming) return;
    const nextPicks = result.picks.map((p) =>
      p.scriptIdx === scriptIdx ? { ...p, videoIdx } : p,
    );
    reprocess(nextPicks, transitions, /* recompute */ true, cStatusReassign);
  }

  /**
   * Download the combined video — costs `multiCost` credits. Shows a loading
   * overlay, deducts credits, then triggers the browser download.
   */
  async function downloadVideo() {
    if (!result) return;
    if (getCredits() < multiCost) {
      toast.error(cInsufficientTpl.replace("{{currency}}", currency).replace("{{cost}}", String(multiCost)));
      router.push("/credits");
      return;
    }
    setOverlay({ title: cPrepDlTitle, subtitle: cPrepDlSubtitle });
    // Let the overlay paint before the (sync) download work.
    await new Promise((r) => setTimeout(r, 600));
    try {
      if (!spend(multiCost)) {
        setOverlay(null);
        toast.error(cInsufficientShort.replace("{{currency}}", currency));
        return;
      }
      const blob = b64ToBlob(result.videoBase64, "video/mp4");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `master-video-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      setOverlay(null);
      toast.success(cDownloadedTpl.replace("{{cost}}", String(multiCost)).replace("{{currency}}", currency));
    } catch (e: unknown) {
      setOverlay(null);
      toast.error(e instanceof Error ? e.message : cDownloadErr);
    }
  }

  /**
   * Hand the combined video to the main AI editor: stash it in IndexedDB and
   * navigate home, where it auto-loads ready for transcription + editing.
   */
  async function transferToEditor() {
    if (!result) return;
    setOverlay({ title: cTransferTitle, subtitle: cTransferSubtitle });
    try {
      const blob = b64ToBlob(result.videoBase64, "video/mp4");
      const file = new File([blob], `master-video-${Date.now()}.mp4`, { type: "video/mp4" });
      const hash = await hashVideoFile(file);
      await saveCurrentVideo(file, hash);
      sessionStorage.setItem("vm_autoload_video", "1");
      router.push("/");
    } catch (e: unknown) {
      setOverlay(null);
      toast.error(e instanceof Error ? e.message : cTransferErr);
    }
  }

  const videoUrl = result
    ? URL.createObjectURL(b64ToBlob(result.videoBase64, "video/mp4"))
    : null;

  return (
    <div dir="rtl" className="min-h-screen p-6 text-white">
      {/* Full-screen loader for download / transfer */}
      {overlay && <AILoadingOverlay title={overlay.title} subtitle={overlay.subtitle} hint={overlay.hint ?? ""} />}

      <div className="max-w-5xl mx-auto">
        {/* Top bar — logo (home) on the right, back link on the left */}
        <header className="flex items-center justify-between mb-6">
          <a href="/" className="flex items-center gap-2 group min-w-0" title={cTipHome}>
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-brand blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
              <LogoMark size={logoSize} mode="static" className="relative" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-black tracking-tight truncate group-hover:text-brand-light transition-colors leading-tight">{appName}</h1>
              <p className="text-[11px] text-white/40 leading-tight">{tagline}</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            {/* Credits pill — links to the purchase page */}
            <a href="/credits"
               className="bg-gradient-to-r from-violet-500/15 to-pink-500/15 border border-white/10 hover:border-brand/40 px-3 py-2 rounded-full text-sm flex items-center gap-1.5 transition-colors group">
              <MasterCoin size={16} />
              <span className="font-bold text-white">{credits.toLocaleString()}</span>
              <span className="hidden sm:inline text-[11px] text-white/50">{currency}</span>
              <span className="bg-brand/30 group-hover:bg-brand/50 text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center transition-colors">+</span>
            </a>
            {/* Back to home */}
            <a href="/" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white bg-bg-card border border-white/10 hover:border-brand/40 rounded-full px-4 py-2 transition-colors">
              <span className="hidden sm:inline">{cBackHome}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </header>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-brand/20">
            <Sparkles className="w-6 h-6 text-brand-light" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{cTitle}</h1>
            <p className="text-xs text-white/50">{cSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: inputs */}
          <div className="space-y-4">
            <div className="bg-bg-card border border-white/10 rounded-xl p-4">
              <label className="text-sm font-bold flex items-center gap-2 mb-3">
                <Film className="w-4 h-4" />
                {cSourcesLabel} ({files.length}/8)
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
              <label className="text-sm font-bold mb-2 block">{cScriptLabel}</label>
              <p className="text-[11px] text-white/40 mb-2 leading-relaxed">{cScriptHelp}</p>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={10}
                placeholder={cScriptPh}
                className="w-full bg-bg-input border border-white/10 rounded-md px-3 py-2 text-sm leading-relaxed resize-none"
              />
              <div className="text-[11px] text-white/40 mt-1.5">
                {!script.trim() ? (
                  cScriptEmpty
                ) : (
                  <>
                    {cSplitPrefix}
                    <span className="text-brand-light font-bold">{splitScript(script, Math.max(1, files.length)).length}</span>
                    {" "}{cSplitSuffix}
                    {files.length >= 2 && (
                      <span className="text-white/30"> · {cPerVideoTpl.replace("{{n}}", String(files.length))}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={status === "working"}
              className="w-full py-3 bg-brand hover:bg-brand/80 disabled:bg-brand/30 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              {status === "working" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {status === "working" ? cBtnBusy : cCta}
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
                  {cPreviewEmpty}
                </div>
              )}
            </div>

            {/* ── Auto-transition toggle — appears once a result exists ── */}
            {result && (
              <div className="bg-bg-card border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-lg transition-colors ${transitions ? "bg-brand/30 text-brand-light" : "bg-white/10 text-white/50"}`}>
                      {transitions ? <Wand2 className="w-4 h-4" /> : <Scissors className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{cTrTitle}</div>
                      <div className="text-[11px] text-white/40">
                        {transitions ? cTrOn : cTrOff}
                      </div>
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={() => reprocessWithTransitions(!transitions)}
                    disabled={retiming}
                    className={`relative shrink-0 w-12 h-6 rounded-full transition-colors disabled:opacity-50
                      ${transitions ? "bg-brand" : "bg-white/15"}`}
                    title={cTrToggleTitle}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all
                      ${transitions ? "right-0.5" : "right-6"}`} />
                  </button>
                </div>
                {retiming && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-brand-light">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {transitions ? cTrBusyOn : cTrBusyOff}
                  </div>
                )}
              </div>
            )}

            {videoUrl && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Download — costs credits */}
                <button
                  onClick={downloadVideo}
                  disabled={retiming || !!overlay}
                  className="py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
                >
                  <Download className="w-4 h-4" />
                  {cBtnDl}
                  <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-[11px]">
                    <MasterCoin size={13} /> {multiCost}
                  </span>
                </button>

                {/* Transfer to the main AI editor for subtitles + effects */}
                <button
                  onClick={transferToEditor}
                  disabled={retiming || !!overlay}
                  className="py-3 bg-gradient-to-r from-brand to-pink-500 hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand/20 transition"
                >
                  <Wand2 className="w-4 h-4" />
                  {cBtnTransfer}
                </button>
              </div>
            )}

            {result?.picks?.length ? (
              <div className="bg-bg-card border border-white/10 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                  {cAssignHeading}
                </h3>
                <p className="text-[11px] text-white/40 mb-4">
                  {cAssignHelp}
                </p>
                <ol className="space-y-4">
                  {result.picks.map((p) => (
                    <li key={p.scriptIdx} className="flex gap-3">
                      <span className="w-5 h-5 rounded bg-brand/30 flex items-center justify-center font-mono shrink-0 text-[11px] mt-0.5">
                        {p.scriptIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white/90 mb-2">&ldquo;{p.scriptText}&rdquo;</div>
                        {/* Thumbnail picker — one per source video */}
                        <div className="flex flex-wrap gap-2">
                          {files.map((_, vIdx) => {
                            const selected = p.videoIdx === vIdx;
                            const thumb = result.thumbnails?.[vIdx];
                            return (
                              <button
                                key={vIdx}
                                onClick={() => assignVideo(p.scriptIdx, vIdx)}
                                disabled={retiming}
                                title={cAssignVideoTpl.replace("{{n}}", String(vIdx + 1))}
                                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all disabled:opacity-50
                                  ${selected
                                    ? "border-brand ring-2 ring-brand/40 scale-105"
                                    : "border-white/10 hover:border-white/40 opacity-70 hover:opacity-100"}`}
                              >
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumb} alt={cAssignVideoTpl.replace("{{n}}", String(vIdx + 1))} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-xs">
                                    {vIdx + 1}
                                  </div>
                                )}
                                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-bold rounded px-1">
                                  {vIdx + 1}
                                </span>
                                {selected && (
                                  <span className="absolute top-0.5 left-0.5 bg-brand text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
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
          💡 {cBottomNote}
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
