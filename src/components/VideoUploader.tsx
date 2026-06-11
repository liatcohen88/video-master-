"use client";

import { Upload, Film, Clock } from "lucide-react";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { toast } from "@/components/Toaster";

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
        `הסרטון ארוך מ-${MAX_VIDEO_SECONDS} שניות (${Math.round(dur)} שנ׳). ` +
          `כרגע מעלים סרטונים עד דקה — חתכי או קצרי ונסי שוב.`,
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
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-3xl border-2 border-dashed
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
            {checking ? "בודק..." : isDragging ? "שחרר כאן" : "גרור את הסרטון לכאן"}
          </h3>
          <p className="text-white/60 text-sm">
            או לחץ לבחירת קובץ • MP4, MOV, AVI, MKV
          </p>
        </div>

        {/* Launch-window notice. Remove the entire pill once we lift the
            duration cap (post-launch render queue). */}
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>כרגע ניתן לעלות סרטונים עד דקה — בקרוב יוכלו יותר</span>
        </div>
      </div>
    </div>
  );
}
