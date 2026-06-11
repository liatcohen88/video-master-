"use client";

import { useEffect, useState } from "react";
import { Sparkles, Gift } from "lucide-react";
import LogoMark from "./LogoMark";
import { useContent } from "@/lib/useContent";

/**
 * Two completely separate things:
 *
 *  1. SPLASH (every load): a brief reveal of the brand logo on every
 *     page mount. Plays for 1.8s then disappears. Plays for EVERYONE,
 *     every time — this is the brand intro animation.
 *
 *  2. WELCOME POPUP (post-registration ONLY): a single "ברוכים הבאים,
 *     קיבלת X קרדיטים" popup. NOT shown on first visit, NOT shown on
 *     every load — only ONCE after a successful registration.
 *
 *     Trigger from anywhere:
 *       localStorage.setItem("vm_just_registered", "1")  →  shows on
 *                                                            next mount
 *     Or for testing:
 *       visit any page with `?welcome=1` in the URL.
 *
 *     Once shown, the flag is cleared so it never repeats.
 */

const REGISTERED_FLAG = "vm_just_registered";
const SHOWN_FLAG      = "vm_welcome_shown";

export default function OnboardingSplash() {
  const credits = Number(useContent("welcome.freeCredits") ?? 25);
  const title   = useContent("welcome.title")   as string;
  const msg     = (useContent("welcome.message") as string).replace("{{credits}}", String(credits));
  const ctaTxt  = useContent("welcome.cta")     as string;
  const currency = (useContent("brand.currencyName") as string) || "קרדיטים";

  const [showSplash,  setShowSplash]  = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [closing,     setClosing]     = useState(false);

  // 1) Splash logo — every page load, 1.8s.
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  // 2) Welcome popup — only after registration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const triggered =
      params.get("welcome") === "1" ||
      localStorage.getItem(REGISTERED_FLAG) === "1";
    if (triggered && localStorage.getItem(SHOWN_FLAG) !== "1") {
      // Wait for splash to finish before showing the popup.
      const t = setTimeout(() => setShowWelcome(true), 1900);
      return () => clearTimeout(t);
    }
  }, []);

  function closeWelcome() {
    setClosing(true);
    setTimeout(() => {
      try {
        localStorage.removeItem(REGISTERED_FLAG);
        localStorage.setItem(SHOWN_FLAG, "1");
        // Clean ?welcome=1 out of the URL so refresh doesn't re-trigger.
        const url = new URL(window.location.href);
        if (url.searchParams.has("welcome")) {
          url.searchParams.delete("welcome");
          window.history.replaceState({}, "", url.toString());
        }
      } catch {}
      setShowWelcome(false);
      setClosing(false);
    }, 250);
  }

  if (!showSplash && !showWelcome) return null;

  return (
    <div dir="rtl" className={`fixed inset-0 z-[150] flex items-center justify-center bg-bg/95 backdrop-blur-md ${closing ? "animate-fade-out" : "animate-fade-in"}`}>
      {showSplash ? (
        <div className="flex items-center justify-center animate-splash-up">
          <LogoMark size={140} mode="reveal" />
        </div>
      ) : (
        <div className="relative max-w-md w-[90vw] mx-auto bg-bg-card border border-brand/40 rounded-2xl p-7 shadow-2xl shadow-brand/30 animate-card-up text-center">
          {/* Gift icon with confetti glow */}
          <div className="relative mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center shadow-lg shadow-brand/40">
            <Gift className="w-10 h-10 text-white" />
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-pulse" />
            <Sparkles className="absolute -bottom-1 -left-2 w-5 h-5 text-pink-300 animate-pulse" style={{ animationDelay: "0.4s" }} />
          </div>

          <h2 className="text-2xl font-black mb-2 bg-gradient-to-r from-brand to-pink-400 bg-clip-text text-transparent">
            {title}
          </h2>

          {/* Big credit number */}
          <div className="my-4 flex items-center justify-center gap-2">
            <span className="text-5xl font-black text-white">{credits}</span>
            <span className="text-xl text-white/70 font-bold">{currency} מתנה ✨</span>
          </div>

          <p className="text-sm text-white/70 leading-relaxed mb-6">{msg}</p>

          <button
            onClick={closeWelcome}
            className="w-full py-3.5 bg-gradient-to-r from-brand to-pink-500 hover:opacity-90 text-white font-bold rounded-xl text-base shadow-lg shadow-brand/30 transition">
            {ctaTxt}
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out  { from { opacity: 1; } to { opacity: 0; } }
        @keyframes splash-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes card-up   { from { transform: translateY(30px) scale(0.92); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-fade-in    { animation: fade-in 220ms ease-out; }
        .animate-fade-out   { animation: fade-out 220ms ease-out; }
        .animate-splash-up  { animation: splash-up 600ms ease-out; }
        .animate-card-up    { animation: card-up 380ms cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
