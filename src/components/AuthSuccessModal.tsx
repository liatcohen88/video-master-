"use client";

/**
 * Post-auth welcome / welcome-back modal. Shown once on the home page after
 * signup or login. Triggered via sessionStorage flags that signup/login set
 * right before redirecting to "/":
 *   - vm_auth_event = "signup" → welcome popup (2 CTAs: upload + profile)
 *   - vm_auth_event = "login"  → returning popup (1 CTA: home)
 *
 * Strings + button hrefs all come from the CMS so Liat can rephrase or
 * point the buttons elsewhere from /admin without a deploy.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Upload, User, X } from "lucide-react";
import { useContent } from "@/lib/useContent";

type EventKind = "signup" | "login" | null;

export default function AuthSuccessModal() {
  const [event, setEvent] = useState<EventKind>(null);

  // Welcome (new user)
  const wTitle  = useContent("auth.welcome.title") as string;
  const wBody   = useContent("auth.welcome.body") as string;
  const wCta1   = useContent("auth.welcome.ctaUpload") as string;
  const wHref1  = useContent("auth.welcome.ctaUploadHref") as string;
  const wCta2   = useContent("auth.welcome.ctaProfile") as string;
  const wHref2  = useContent("auth.welcome.ctaProfileHref") as string;
  // Returning (existing user)
  const rTitle  = useContent("auth.returning.title") as string;
  const rBody   = useContent("auth.returning.body") as string;
  const rCta    = useContent("auth.returning.cta") as string;
  const rHref   = useContent("auth.returning.ctaHref") as string;

  // Read the flag once on mount and clear it so a refresh doesn't re-fire.
  useEffect(() => {
    try {
      const v = sessionStorage.getItem("vm_auth_event");
      if (v === "signup" || v === "login") {
        setEvent(v);
        sessionStorage.removeItem("vm_auth_event");
      }
    } catch {/* sessionStorage unavailable — just don't show */}
  }, []);

  if (!event) return null;
  const close = () => setEvent(null);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-8 animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-bg-panel border border-brand/40 rounded-3xl max-w-md w-full p-8 text-center shadow-2xl shadow-brand/30 animate-in zoom-in-95 duration-300"
      >
        <button
          onClick={close}
          aria-label="סגרי"
          className="absolute top-3 left-3 text-white/40 hover:text-white p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-brand/30 to-accent-pink/20 border border-brand/40 mb-4">
          <Sparkles className="w-10 h-10 text-brand-light" />
        </div>

        <h3 className="text-2xl font-extrabold mb-2 text-white">
          {event === "signup" ? wTitle : rTitle}
        </h3>
        <p className="text-sm text-white/75 mb-6 leading-relaxed whitespace-pre-line">
          {event === "signup" ? wBody : rBody}
        </p>

        {event === "signup" ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href={wHref1 || "/"}
              onClick={close}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity"
            >
              <Upload className="w-4 h-4" /> {wCta1}
            </Link>
            <Link
              href={wHref2 || "/dashboard"}
              onClick={close}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl transition-colors border border-white/15"
            >
              <User className="w-4 h-4" /> {wCta2}
            </Link>
          </div>
        ) : (
          <Link
            href={rHref || "/"}
            onClick={close}
            className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity"
          >
            {rCta}
          </Link>
        )}
      </div>
    </div>
  );
}
