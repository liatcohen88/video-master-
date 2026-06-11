"use client";

import { useState } from "react";
import { Palette, Type, MoveVertical, ChevronDown, Layout, Sparkles, Wand2 } from "lucide-react";
import type { SubtitleStyle, SubtitlePosition, VideoEffects, Subtitle } from "@/lib/types";
import { HEBREW_FONTS } from "@/lib/types";
import { TEMPLATES, type SubtitleTemplate } from "@/lib/templates";
import { fontClassFor } from "@/lib/fonts";
import EffectsPanel from "./EffectsPanel";
import type { EditMode } from "@/lib/types";

type Props = {
  style: SubtitleStyle;
  onChange: (s: SubtitleStyle) => void;
  templateId: string;
  onTemplateChange: (t: SubtitleTemplate) => void;
  effects?: VideoEffects;
  onEffectsChange?: (e: VideoEffects) => void;
  /** Optional content rendered at the top of the panel (e.g. ready-templates gallery) */
  topSlot?: React.ReactNode;
  /** Hide the AI-effects accordion entirely (used for "subtitles only" mode) */
  hideEffects?: boolean;
  /** Edit mode → which effect sections are exposed (advanced vs podcast). */
  mode?: EditMode;
  /** Subtitles — forwarded to EffectsPanel so the "לוגואים" tab can list
   *  detected brand mentions with PX + position controls per occurrence. */
  subtitles?: Subtitle[];
};

type SectionId = "templates" | "effects" | "typography" | "colors" | "background" | "position";

export default function StylePanel({
  style, onChange, templateId, onTemplateChange, effects, onEffectsChange, topSlot, hideEffects, mode, subtitles,
}: Props) {
  const [openSection, setOpenSection] = useState<SectionId | null>("templates");

  const update = <K extends keyof SubtitleStyle>(
    key: K,
    value: SubtitleStyle[K],
  ) => onChange({ ...style, [key]: value });

  const toggle = (id: SectionId) =>
    setOpenSection((cur) => (cur === id ? null : id));

  return (
    <div className="bg-bg-panel border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
      <div className="flex items-center gap-2 p-4">
        <Palette className="w-5 h-5 text-accent-pink" />
        <h3 className="text-lg font-bold flex-1">עריכת הסרטון</h3>
      </div>

      {topSlot && <div className="p-4 border-t border-white/5">{topSlot}</div>}

      <Accordion
        icon={<Sparkles className="w-4 h-4" />}
        title="סגנון כתוביות"
        subtitle={TEMPLATES.find((t) => t.id === templateId)?.name ?? "לא נבחר"}
        open={openSection === "templates"}
        onToggle={() => toggle("templates")}
      >
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((tpl) => {
            const isSelected = tpl.id === templateId;
            return (
              <button
                key={tpl.id}
                onClick={() => onTemplateChange(tpl)}
                className={`
                  relative aspect-square rounded-lg overflow-hidden text-center
                  border transition-all
                  ${isSelected
                    ? "border-brand shadow-md shadow-brand/40 scale-[1.04]"
                    : "border-white/10 hover:border-white/30"}
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${tpl.previewBg}`} />
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative h-full w-full flex items-center justify-center p-1">
                  <span
                    className={fontClassFor(tpl.style.fontFamily)}
                    dir="rtl"
                    style={{
                      fontSize: "10px",
                      fontWeight: tpl.style.fontWeight,
                      color: tpl.style.color,
                      paintOrder: "stroke fill",
                      WebkitTextStroke: tpl.style.strokeWidth > 0
                        ? `0.5px ${tpl.style.strokeColor}`
                        : undefined,
                      textShadow: tpl.style.shadow ? "0 1px 2px rgba(0,0,0,0.8)" : "none",
                      lineHeight: 1.1,
                    }}
                  >
                    שלום
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm py-1">
                  <span className="text-[10px] font-medium text-white truncate block px-1">
                    {tpl.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Accordion>

      {effects && onEffectsChange && !hideEffects && (
        <Accordion
          icon={<Wand2 className="w-4 h-4" />}
          // Renamed from "אפקטי AI" — Liat: users thought the AI was applying
          // these automatically. They're MANUAL toggles you opt into and
          // each one adds to the master count. Title now signals that
          // explicitly: "אפקטים נוספים (כל אפקט = +2 מאסטרים)".
          title="אפקטים נוספים"
          subtitle={`${effectsSubtitle(effects)} · כל אפקט מוסיף 2-3 מאסטרים`}
          open={openSection === "effects"}
          onToggle={() => toggle("effects")}
        >
          <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-lg text-[11px] text-amber-200/90 leading-relaxed">
            💡 <strong>תוספת אופציונלית</strong> — ה-AI לא מפעיל אותם אוטומטית.
            תוכלי לבחור בכל אחד מהם, ולשלם רק עבור מה שבחרת.
            המחיר מתעדכן בזמן אמת על כפתור הייצוא.
          </div>
          <EffectsPanel effects={effects} onChange={onEffectsChange} mode={mode} subtitles={subtitles} />
        </Accordion>
      )}

      <Accordion
        icon={<Type className="w-4 h-4" />}
        title="טיפוגרפיה"
        subtitle={`${style.fontFamily} · ${style.fontSize}px`}
        open={openSection === "typography"}
        onToggle={() => toggle("typography")}
      >
        <Field label="פונט">
          <select
            value={style.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
            className="w-full bg-bg-input border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            {HEBREW_FONTS.map((f) => (
              <option key={f.value} value={f.value}>{f.name}</option>
            ))}
          </select>
        </Field>

        <Field label={`גודל: ${style.fontSize}px`}>
          <input type="range" min={20} max={120} value={style.fontSize}
            onChange={(e) => update("fontSize", parseInt(e.target.value))}
            className="w-full" />
        </Field>

        <Field label="עובי">
          <div className="grid grid-cols-4 gap-2">
            {[400, 600, 800, 900].map((w) => (
              <button key={w}
                onClick={() => update("fontWeight", w)}
                className={`py-2 rounded-lg text-xs border transition-all
                  ${style.fontWeight === w
                    ? "border-brand bg-brand/20 text-white"
                    : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}`}
                style={{ fontWeight: w }}>
                {w === 400 ? "רגיל" : w === 600 ? "סמיבולד" : w === 800 ? "בולד" : "שחור"}
              </button>
            ))}
          </div>
        </Field>
      </Accordion>

      <Accordion
        icon={<Palette className="w-4 h-4" />}
        title="צבעים"
        subtitle={style.color}
        open={openSection === "colors"}
        onToggle={() => toggle("colors")}
      >
        <ColorField label="צבע הטקסט" value={style.color} onChange={(v) => update("color", v)} />
        <ColorField label="צבע הקו (Stroke)" value={style.strokeColor} onChange={(v) => update("strokeColor", v)} />
        <Field label={`עובי קו: ${style.strokeWidth}px`}>
          <input type="range" min={0} max={12} value={style.strokeWidth}
            onChange={(e) => update("strokeWidth", parseInt(e.target.value))} className="w-full" />
        </Field>
        <ColorField label="צבע הדגשה (מילה פעילה)" value={style.highlightColor}
          onChange={(v) => update("highlightColor", v)} />
        <p className="text-xs text-white/40 -mt-1">
          טיפ: צבע זהה לצבע הטקסט = ללא הדגשה
        </p>
      </Accordion>

      <Accordion
        icon={<Layout className="w-4 h-4" />}
        title="רקע"
        subtitle={style.backgroundOpacity > 0 ? `${Math.round(style.backgroundOpacity * 100)}%` : "ללא"}
        open={openSection === "background"}
        onToggle={() => toggle("background")}
      >
        <ColorField label="צבע רקע" value={style.backgroundColor}
          onChange={(v) => update("backgroundColor", v)} />
        <Field label={`שקיפות רקע: ${Math.round(style.backgroundOpacity * 100)}%`}>
          <input type="range" min={0} max={100} value={style.backgroundOpacity * 100}
            onChange={(e) => update("backgroundOpacity", parseInt(e.target.value) / 100)}
            className="w-full" />
        </Field>
      </Accordion>

      <Accordion
        icon={<MoveVertical className="w-4 h-4" />}
        title="מיקום"
        subtitle={`${style.position === "top" ? "למעלה" : style.position === "middle" ? "אמצע" : "למטה"} · ${style.positionOffset}px`}
        open={openSection === "position"}
        onToggle={() => toggle("position")}
      >
        <Field label="מיקום אנכי">
          <div className="grid grid-cols-3 gap-2">
            {(["top", "middle", "bottom"] as SubtitlePosition[]).map((p) => (
              <button key={p} onClick={() => update("position", p)}
                className={`py-2 rounded-lg text-xs border transition-all
                  ${style.position === p
                    ? "border-brand bg-brand/20"
                    : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}`}>
                {p === "top" ? "למעלה" : p === "middle" ? "אמצע" : "למטה"}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`היסט: ${style.positionOffset}px`}>
          <input type="range" min={0} max={400} value={style.positionOffset}
            onChange={(e) => update("positionOffset", parseInt(e.target.value))} className="w-full" />
        </Field>
        <Field label="יישור טקסט">
          <div className="grid grid-cols-3 gap-2">
            {(["right", "center", "left"] as const).map((a) => (
              <button key={a} onClick={() => update("textAlign", a)}
                className={`py-2 rounded-lg text-xs border transition-all
                  ${style.textAlign === a
                    ? "border-brand bg-brand/20"
                    : "border-white/10 bg-bg-input text-white/60 hover:border-white/30"}`}>
                {a === "right" ? "ימין" : a === "center" ? "מרכז" : "שמאל"}
              </button>
            ))}
          </div>
        </Field>
      </Accordion>
    </div>
  );
}

function effectsSubtitle(e: VideoEffects): string {
  const bits: string[] = [];
  if (e.aspectRatio !== "original") bits.push(e.aspectRatio);
  if (e.cutSilence) bits.push("חיתוך שתיקות");
  if (e.zoomEffect !== "none") bits.push(e.zoomEffect === "subtle" ? "זום עדין" : "Ken Burns");
  return bits.length ? bits.join(" · ") : "ללא אפקטים";
}

function Accordion({
  icon, title, subtitle, open, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors text-right"
      >
        <span className={open ? "text-brand-light" : "text-white/50"}>{icon}</span>
        <span className="flex-1 text-right">
          <span className="block text-sm font-semibold">{title}</span>
          {subtitle && (
            <span className="block text-[11px] text-white/40 mt-0.5 truncate">
              {subtitle}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">{children}</div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-12 h-9 rounded-lg cursor-pointer bg-bg-input border border-white/10" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-bg-input border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
          dir="ltr" />
      </div>
    </div>
  );
}
