"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, User, UserPlus, AlertCircle, X, Gift, LogIn } from "lucide-react";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import { useContent } from "@/lib/useContent";
import LogoMark from "@/components/LogoMark";

/**
 * Modal shown when a guest tries to export. Inline signup keeps them on page;
 * after successful signup the modal calls onSuccess() so the caller can resume
 * the action that was gated (typically the export click that opened this).
 *
 * "25 מאסטרים במתנה" framing matches /signup so the offer feels consistent.
 */
export default function SignupGate({
  open, onClose, onSuccess,
}: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode]       = useState<"signup" | "login">("signup");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const title       = useContent("signupGate.title") as string;
  const subtitle    = useContent("signupGate.subtitle") as string;
  const giftBadge   = useContent("signupGate.giftBadge") as string;
  const nameLabel   = useContent("auth.field.name") as string;
  const emailLabel  = useContent("auth.field.email") as string;
  const passLabel   = useContent("auth.field.password") as string;
  const submitNew   = useContent("signupGate.submitNew") as string;
  const submitIn    = useContent("signupGate.submitIn") as string;
  const switchToIn  = useContent("signupGate.switchToLogin") as string;
  const switchToNew = useContent("signupGate.switchToSignup") as string;
  const termsAgree  = useContent("auth.signup.terms") as string;
  const termsLink   = useContent("auth.signup.termsLinkLabel") as string;
  const namePlace   = useContent("signupGate.namePlaceholder") as string;
  const passShortMsg= useContent("auth.error.passwordTooShort") as string;
  const invalidMsg  = useContent("auth.error.invalidCreds") as string;
  const emailExists = useContent("signupGate.error.emailExists") as string;
  const confirmEmail= useContent("signupGate.notice.confirmEmail") as string;
  const googleLabel = useContent("auth.oauth.google") as string;
  const dividerText = useContent("auth.divider") as string;

  if (!open) return null;

  async function googleSignIn() {
    setErr(null);
    if (!isSupabaseConfigured()) { setErr("מערכת ההרשמה לא מוגדרת. יש לפנות לתמיכה."); return; }
    const sb = browserClient();
    if (!sb) return;
    setBusy(true);
    // Mark the tab as actively editing so the post-OAuth redirect lands
    // back in the editor with the snapshot restored — not the home page.
    // sessionStorage survives a same-origin redirect, so this flag is still
    // there when Supabase brings us back to "/".
    try { sessionStorage.setItem("vm_active_edit", "1"); } catch {}
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      setBusy(false);
      const msg = error.message.toLowerCase();
      setErr(msg.includes("provider is not enabled")
        ? "התחברות עם Google עוד לא הופעלה."
        : error.message);
    }
    // On success Supabase navigates away — no need to clear busy.
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (mode === "signup" && password.length < 8) {
      setErr(passShortMsg);
      return;
    }
    if (!isSupabaseConfigured()) { setErr("מערכת ההרשמה לא מוגדרת. יש לפנות לתמיכה."); return; }
    const sb = browserClient();
    if (!sb) return;
    setBusy(true);

    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { display_name: name } },
      });
      setBusy(false);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered")) {
          setErr(emailExists);
          setMode("login");
        } else setErr(error.message);
        return;
      }
      if (data.session) onSuccess();
      else {
        setErr(confirmEmail);
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setErr(error.message.toLowerCase().includes("invalid")
          ? invalidMsg
          : error.message);
        return;
      }
      onSuccess();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div
        className="bg-bg-panel border border-white/15 rounded-3xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Close + branding */}
        <button onClick={onClose} className="absolute top-4 left-4 text-white/40 hover:text-white text-2xl leading-none">
          <X className="w-5 h-5" />
        </button>
        <div className="flex justify-center mb-3"><LogoMark size={52} /></div>

        {/* Gift badge — the offer that makes the gate friendly */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/25 to-yellow-500/15 border border-amber-400/40 text-amber-200 text-sm font-bold px-4 py-1.5 rounded-full">
            <Gift className="w-4 h-4" /> {giftBadge}
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-center mb-1">{title}</h2>
        <p className="text-center text-white/60 text-sm mb-4">{subtitle}</p>

        {/* Google OAuth — single-click signup/login. Liat: "בפופאפ הזה
            אפשרות הרשמה דרך גוגל גם". On success Supabase redirects to "/"
            and the page-level OAuth detector fires the welcome popup. */}
        <button
          type="button"
          onClick={googleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-white !text-black hover:bg-white/90 disabled:opacity-50 font-bold py-2.5 rounded-lg transition-opacity mb-3"
        >
          <svg viewBox="0 0 18 18" className="w-4 h-4">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.79 2.71v2.26h2.9c1.7-1.56 2.68-3.86 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.92v2.33A9 9 0 009 18z"/>
            <path fill="#FBBC05" d="M4.02 10.74A5.41 5.41 0 013.74 9c0-.6.1-1.18.28-1.74V4.93H.92A8.99 8.99 0 000 9c0 1.45.35 2.83.92 4.07l3.1-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.97 8.97 0 009 0 9 9 0 00.92 4.93l3.1 2.33C4.72 5.16 6.68 3.58 9 3.58z"/>
          </svg>
          <span className="text-black">{googleLabel || "המשך עם Google"}</span>
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-white/40">{dividerText || "או"}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs text-white/60 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> {nameLabel}
              </span>
              <input
                type="text" autoComplete="name" required
                value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand"
                placeholder={namePlace}
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs text-white/60 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {emailLabel}
            </span>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand"
              placeholder="liat@example.com" dir="ltr"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/60 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> {passLabel}
            </span>
            <input
              type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required
              minLength={mode === "signup" ? 8 : undefined}
              value={password} onChange={(e) => setPass(e.target.value)}
              className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand"
              placeholder={mode === "signup" ? "לפחות 8 תווים" : "••••••••"} dir="ltr"
            />
          </label>

          {err && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <button
            type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-opacity"
          >
            {mode === "signup" ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {busy ? "..." : (mode === "signup" ? submitNew : submitIn)}
          </button>

          {mode === "signup" && (
            <p className="text-[10px] text-white/40 text-center pt-1">
              {termsAgree}{" "}
              <Link href="/policy" className="underline">{termsLink}</Link>
            </p>
          )}
        </form>

        <div className="text-center mt-4 text-sm text-white/60">
          {mode === "signup" ? (
            <button onClick={() => { setMode("login"); setErr(null); }} className="text-brand-light font-bold hover:underline">
              {switchToIn}
            </button>
          ) : (
            <button onClick={() => { setMode("signup"); setErr(null); }} className="text-brand-light font-bold hover:underline">
              {switchToNew}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
