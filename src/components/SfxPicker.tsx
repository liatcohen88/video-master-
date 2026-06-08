"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { listSfxByCategory, getSfxAsset, SFX_CATEGORY_LABEL } from "@/lib/sfxLibrary";
import { useContent } from "@/lib/useContent";

type Props = {
  open: boolean;
  /** Currently-selected sfx id ("none" = muted, undefined = default) */
  currentSfxId?: string;
  /** Label shown in the default option (e.g. "ברירת מחדל (whoosh)") */
  defaultLabel?: string;
  onSelect: (sfxId: string | undefined) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
};


export default function SfxPicker({
  open, currentSfxId, defaultLabel, onSelect, onClose, anchorRect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const labelOverrides = useContent("sfx.labels");
  const labelFor = (id: string, fallback: string) => labelOverrides[id] ?? fallback;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  // Stop any audio when the picker closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
  }, [open]);

  if (!open) return null;

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = "fixed";
    style.top = `${Math.min(anchorRect.bottom + 8, window.innerHeight - 460)}px`;
    style.left = `${Math.max(8, Math.min(anchorRect.left - 80, window.innerWidth - 340))}px`;
    style.zIndex = 100;
  }

  function play(id: string) {
    if (audioRef.current) audioRef.current.pause();
    const url = getSfxAsset(id)?.url;
    if (!url) return;
    const a = new Audio(url);
    a.volume = 0.7;
    a.play().catch(() => {});
    a.onended = () => setPlayingId((p) => (p === id ? null : p));
    audioRef.current = a;
    setPlayingId(id);
  }

  const groups = listSfxByCategory();

  const currentLabel =
    currentSfxId === "none"
      ? "ללא צליל"
      : currentSfxId
        ? labelFor(currentSfxId, getSfxAsset(currentSfxId)?.label ?? currentSfxId)
        : (defaultLabel ?? "ברירת מחדל");

  return (
    <div
      ref={ref}
      style={style}
      className="bg-bg-card border border-white/15 rounded-2xl shadow-2xl shadow-black/60 p-3 w-[330px] max-h-[460px] overflow-y-auto"
      dir="rtl"
    >
      <div className="text-xs text-white/40 mb-2 text-center">
        בחרי צליל (נוכחי: <span className="text-white/70">{currentLabel}</span>)
      </div>

      {/* Default + mute */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => { onSelect(undefined); onClose(); }}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border
            ${currentSfxId === undefined ? "bg-brand/30 border-brand text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
        >
          {defaultLabel ?? "ברירת מחדל"}
        </button>
        <button
          onClick={() => { onSelect("none"); onClose(); }}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border flex items-center justify-center gap-1
            ${currentSfxId === "none" ? "bg-red-500/30 border-red-400 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
        >
          <VolumeX className="w-3 h-3" /> ללא צליל
        </button>
      </div>

      {groups.map((g) => (
        <div key={g.category} className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1 px-1">
            {SFX_CATEGORY_LABEL[g.category]}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {g.items.map((a) => {
              const selected = currentSfxId === a.id;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-1 rounded-md border transition-colors
                    ${selected ? "bg-brand/20 border-brand/60" : "bg-white/5 border-transparent hover:bg-white/10"}`}
                >
                  <button
                    onClick={() => play(a.id)}
                    className="p-1.5 hover:bg-white/10 rounded-md text-white/70"
                    title="השמע"
                  >
                    {playingId === a.id
                      ? <Volume2 className="w-3.5 h-3.5 text-brand-light animate-pulse" />
                      : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { onSelect(a.id); onClose(); }}
                    className="flex-1 text-right text-xs px-1 py-1.5 text-white/80"
                  >
                    {labelFor(a.id, a.label)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
