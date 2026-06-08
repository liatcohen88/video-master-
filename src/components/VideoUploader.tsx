"use client";

import { Upload, Film } from "lucide-react";
import { useState, useRef, DragEvent, ChangeEvent } from "react";

type Props = {
  onVideoSelected: (file: File) => void;
};

export default function VideoUploader({ onVideoSelected }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      onVideoSelected(file);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onVideoSelected(file);
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
            {isDragging ? "שחררי כאן" : "גררי את הסרטון לכאן"}
          </h3>
          <p className="text-white/60 text-sm">
            או לחצי לבחירת קובץ • MP4, MOV, AVI, MKV
          </p>
        </div>
      </div>
    </div>
  );
}
