"use client";

import { Upload, Film, Clock, Loader2 } from "lucide-react";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { toast } from "@/components/Toaster";
import { useContent } from "@/lib/useContent";

type Props = {
  onVideoSelected: (file: File) => void;
};

// Launch-window cap: keeps each export under the Vercel Pro 60s function
// timeout. Bump (or remove the check entirely) once render moves to a
// dedicated queue post-launch — see task #135 / #136.
const MAX_VIDEO_SECONDS = 60;

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => { const d = v.duration; cleanup(); resolve(d); };
    v.onerror = () => { cleanup(); resolve(0); };
  });
}

export default function VideoUploader({ onVideoSelected }: Props) {
  // CMS-driven copy for the drop zone — Liat asked for a softer call-to-action
  const dropTitle    = useContent("uploader.dropTitle") as string;
  const dragingTitle = useContent("uploader.dragingTitle") as string;
  const checkingTitle= useContent("uploader.checkingTitle") as string;
  const formatsLine  = useContent("uploader.formatsLine") as string;
  const durationNote = useContent("uploader.durationNote") as string;
  const tooLongTpl   = useContent("uploader.error.tooLongTpl") as string;
  const checkingSub  = useContent("uploader.checkingSubtitle") as string;
  const [isDragging, setIsDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function accept(file: File) {
    if (!file.type.startsWith("video/")) return;
    setChecking(true);
    const dur = await probeDuration(file);
    setChecking(false);
    if (dur > MAX_VIDEO_SECONDS + 0.5) {
      toast.error(
        tooLongTpl
          .replace("{{max}}", String(MAX_VIDEO_SECONDS))
          .replace("{{dur}}", String(Math.round(dur))),
      );
      return;
    }
    onVideoSelected(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void accept(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void accept(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!checking) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => { if (!checking) inputRef.current?.click(); }}
      className={`
        relative ${checking ? "cursor-wait" : "cursor-pointer"} rounded-3xl border-2 border-dashed
        transition-all duration-300 p-16 text-center
        ${isDragging
          ? "border-brand bg-brand/10 scale-[1.02]"
          : "border-white/20 bg-bg-panel hover:border-brand/50 hover:bg-bg-card"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleChange}
        className="hidden"
      />

      {/* In-zone busy overlay — covers everything else with a clear spinner +
          message the moment the user picks a file. Mobile-friendly because the
          page-level loader takes a beat to appear. */}
      {checking && (
        <div className="absolute inset-0 bg-bg-dark/85 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-3 z-10">
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
          <div className="text-base font-bold text-white">{checkingTitle}</div>
          <div className="text-xs text-white/60">{checkingSub}</div>
        </div>
      )}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-brand/30 blur-2xl rounded-full" />
          <div className="relative bg-gradient-to-br from-brand to-accent-pink p-5 rounded-2xl">
            {isDragging ? (
              <Film className="w-12 h-12 text-white" />
            ) : (
              <Upload className="w-12 h-12 text-white" />
            )}
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-2">
            {checking ? checkingTitle : isDragging ? dragingTitle : dropTitle}
          </h3>
          <p className="text-white/60 text-sm">
            {formatsLine}
          </p>
        </div>

        {/* Launch-window notice. Remove the entire pill once we lift the
            duration cap (post-launch render queue). */}
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>{durationNote}</span>
        </div>
      </div>
    </div>
  );
}
