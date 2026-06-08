"use client";

import { FileVideo, FileText } from "lucide-react";
import type { ExportFormat } from "@/lib/types";

type Props = {
  value: ExportFormat;
  onChange: (v: ExportFormat) => void;
};

export default function ExportFormatToggle({ value, onChange }: Props) {
  return (
    <div>
      <h3 className="text-sm font-medium text-white/70 mb-3">פורמט יצוא</h3>
      <div className="grid grid-cols-2 gap-3">
        <FormatButton
          active={value === "mp4"}
          onClick={() => onChange("mp4")}
          icon={<FileVideo className="w-5 h-5" />}
          title="MP4"
          subtitle="וידאו עם כתוביות צרובות"
        />
        <FormatButton
          active={value === "srt"}
          onClick={() => onChange("srt")}
          icon={<FileText className="w-5 h-5" />}
          title="SRT"
          subtitle="קובץ כתוביות לפרמייר"
        />
      </div>
    </div>
  );
}

function FormatButton({
  active, onClick, icon, title, subtitle,
}: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 text-right
        transition-all duration-200
        ${active
          ? "border-brand bg-brand/10 shadow-md shadow-brand/20"
          : "border-white/10 bg-bg-panel hover:border-white/30"}
      `}
    >
      <div className={`
        p-2 rounded-lg
        ${active ? "bg-brand text-white" : "bg-bg-input text-white/60"}
      `}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-bold">{title}</div>
        <div className="text-xs text-white/50">{subtitle}</div>
      </div>
    </button>
  );
}
