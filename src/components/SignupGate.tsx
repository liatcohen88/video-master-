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

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (mode === "signup" && password.length < 8) {
      setErr(passShortMsg);
      return;
    }
    if (!isSupabaseConfigured()) { setErr("מערכת ההרשמה לא מוגדרת. פני למפתחת."); return; }
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
        <p className="text-center text-white/60 text-sm mb-6">{subtitle}</p>

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
