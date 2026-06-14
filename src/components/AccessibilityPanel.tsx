"use client";

import { useEffect, useState, useCallback } from "react";
import { Accessibility, X, Type, Eye, Link2, BookOpen, MousePointer2, ZapOff, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/useContent";

/**
 * In-house accessibility panel — replaces paid third-party widgets.
 *
 * Floating ♿ button bottom-left, opens a drawer with 6 toggles. State persists
 * in localStorage and applies via CSS classes on the <html> element so every
 * page picks it up.
 *
 * Linked from the footer and a dedicated /accessibility-statement page that
 * names the in-house panel as the assistive technology + provides a contact
 * for accessibility complaints.
 *
 * Why in-house: UserWay free has poor RTL; Nagish costs ₪49/mo. This panel is
 * ~150 lines and covers the user-facing toggles a Hebrew SaaS lawsuit would
 * realistically check for.
 */

type Settings = {
  textScale: 1 | 1.15 | 1.3 | 1.5;   // -, base, +, ++
  highContrast: boolean;
  linkHighlight: boolean;
  dyslexicFont: boolean;
  bigCursor: boolean;
  reduceMotion: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  textScale: 1,
  highContrast: false,
  linkHighlight: false,
  dyslexicFont: false,
  bigCursor: false,
  reduceMotion: false,
};

const STORAGE_KEY = "a11y-settings-v1";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applySettings(s: Settings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.style.fontSize = `${100 * s.textScale}%`;
  html.classList.toggle("a11y-high-contrast", s.highContrast);
  html.classList.toggle("a11y-link-highlight", s.linkHighlight);
  html.classList.toggle("a11y-dyslexic-font", s.dyslexicFont);
  html.classList.toggle("a11y-big-cursor", s.bigCursor);
  html.classList.toggle("a11y-reduce-motion", s.reduceMotion);
}

export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);

  // Every label/hint is CMS-editable (a11yPanel.*)
  const c = {
    openLabel:     useContent("a11yPanel.openLabel") as string,
    label:         useContent("a11yPanel.label") as string,
    heading:       useContent("a11yPanel.heading") as string,
    close:         useContent("a11yPanel.close") as string,
    sectionText:   useContent("a11yPanel.section.textSize") as string,
    sizeNormal:    useContent("a11yPanel.textSize.normal") as string,
    sizeMedium:    useContent("a11yPanel.textSize.medium") as string,
    sizeLarge:     useContent("a11yPanel.textSize.large") as string,
    sizeXl:        useContent("a11yPanel.textSize.xl") as string,
    contrastLabel: useContent("a11yPanel.contrast.label") as string,
    contrastHint:  useContent("a11yPanel.contrast.hint") as string,
    linksLabel:    useContent("a11yPanel.links.label") as string,
    linksHint:     useContent("a11yPanel.links.hint") as string,
    dyslexiaLabel: useContent("a11yPanel.dyslexia.label") as string,
    dyslexiaHint:  useContent("a11yPanel.dyslexia.hint") as string,
    bigCursorLabel:useContent("a11yPanel.bigCursor.label") as string,
    bigCursorHint: useContent("a11yPanel.bigCursor.hint") as string,
    motionLabel:   useContent("a11yPanel.reduceMotion.label") as string,
    motionHint:    useContent("a11yPanel.reduceMotion.hint") as string,
    reset:         useContent("a11yPanel.reset") as string,
    statementLink: useContent("a11yPanel.statementLink") as string,
  };

  // Load + apply on mount
  useEffect(() => {
    const loaded = loadSettings();
    setS(loaded);
    applySettings(loaded);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      applySettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setS(DEFAULT_SETTINGS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    applySettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <>
      {/* Floating launcher — bottom-left so it doesn't fight with chat
          widgets / scroll-to-top buttons that usually live bottom-right */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={c.openLabel}
        className="fixed bottom-4 left-4 z-[60] w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/40 flex items-center justify-center transition-all hover:scale-105 focus:outline-none focus:ring-4 focus:ring-violet-400/50"
      >
        <Accessibility className="w-6 h-6" aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-stretch"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={c.label}
        >
          <aside
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-panel border-l border-white/10 w-full max-w-sm h-full overflow-y-auto p-5 ms-auto animate-in slide-in-from-left duration-200"
          >
            <header className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-violet-300" aria-hidden />
                <h2 className="text-lg font-bold">{c.heading}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={c.close}
                className="text-white/60 hover:text-white p-1 rounded-md hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </header>

            {/* Text size */}
            <Section icon={<Type className="w-4 h-4" />} title={c.sectionText}>
              <div className="grid grid-cols-4 gap-1 bg-bg-card rounded-lg p-1">
                {[1, 1.15, 1.3, 1.5].map((v, i) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update({ textScale: v as Settings["textScale"] })}
                    aria-pressed={s.textScale === v}
                    className={`py-2 rounded-md text-sm font-bold transition-colors ${
                      s.textScale === v ? "bg-violet-600 text-white" : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {[c.sizeNormal, c.sizeMedium, c.sizeLarge, c.sizeXl][i]}
                  </button>
                ))}
              </div>
            </Section>

            <Toggle
              icon={<Eye className="w-4 h-4" />}
              label={c.contrastLabel}
              hint={c.contrastHint}
              value={s.highContrast}
              onChange={(v) => update({ highContrast: v })}
            />
            <Toggle
              icon={<Link2 className="w-4 h-4" />}
              label={c.linksLabel}
              hint={c.linksHint}
              value={s.linkHighlight}
              onChange={(v) => update({ linkHighlight: v })}
            />
            <Toggle
              icon={<BookOpen className="w-4 h-4" />}
              label={c.dyslexiaLabel}
              hint={c.dyslexiaHint}
              value={s.dyslexicFont}
              onChange={(v) => update({ dyslexicFont: v })}
            />
            <Toggle
              icon={<MousePointer2 className="w-4 h-4" />}
              label={c.bigCursorLabel}
              hint={c.bigCursorHint}
              value={s.bigCursor}
              onChange={(v) => update({ bigCursor: v })}
            />
            <Toggle
              icon={<ZapOff className="w-4 h-4" />}
              label={c.motionLabel}
              hint={c.motionHint}
              value={s.reduceMotion}
              onChange={(v) => update({ reduceMotion: v })}
            />

            <button
              type="button"
              onClick={reset}
              className="w-full mt-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              {c.reset}
            </button>

            <a
              href="/accessibility-statement"
              className="block mt-3 text-center text-xs text-violet-300 hover:text-violet-200 underline underline-offset-2"
            >
              {c.statementLink}
            </a>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
        <span className="text-violet-300" aria-hidden>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Toggle({ icon, label, hint, value, onChange }: {
  icon: React.ReactNode; label: string; hint: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="w-full flex items-start gap-3 p-3 mb-2 bg-bg-card border border-white/10 rounded-lg text-right hover:border-white/25 transition-colors"
    >
      <span className={`mt-0.5 p-1.5 rounded-md ${value ? "bg-violet-500/30 text-violet-200" : "bg-white/5 text-white/40"}`} aria-hidden>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>
      </div>
      <span
        className={`relative w-10 h-5 rounded-full transition-colors mt-1.5 ${value ? "bg-violet-500" : "bg-white/15"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? "right-0.5" : "right-[22px]"}`}
        />
      </span>
    </button>
  );
}
