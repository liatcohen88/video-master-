"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, UserPlus, AlertCircle, CheckCircle2, Home } from "lucide-react";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import { useContent } from "@/lib/useContent";
import LogoMark from "@/components/LogoMark";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // CMS-driven copy
  const heading      = useContent("auth.signup.heading") as string;
  const subheading   = useContent("auth.signup.subheading") as string;
  const badge        = useContent("auth.signup.badge") as string;
  const nameLabel    = useContent("auth.field.name") as string;
  const emailLabel   = useContent("auth.field.email") as string;
  const passLabel    = useContent("auth.field.password") as string;
  const passPlace    = useContent("auth.signup.passPlaceholder") as string;
  const submitLabel  = useContent("auth.signup.submit") as string;
  const submitBusy   = useContent("auth.signup.submitBusy") as string;
  const termsAgree   = useContent("auth.signup.terms") as string;
  const haveAccountQ = useContent("auth.signup.haveAccount") as string;
  const loginLink    = useContent("auth.signup.loginCta") as string;
  const dividerText  = useContent("auth.divider") as string;
  const googleLabel  = useContent("auth.oauth.google") as string;
  // appleLabel removed 2026-06-16 — Apple sign-in button is hidden.
  const backHome     = useContent("auth.backHome") as string;
  const confirmTitle = useContent("auth.signup.confirmTitle") as string;
  const confirmBody  = useContent("auth.signup.confirmBody") as string;
  const confirmCta   = useContent("auth.signup.confirmCta") as string;
  const namePlace    = useContent("auth.signup.namePlaceholder") as string;
  const termsLink    = useContent("auth.signup.termsLinkLabel") as string;
  const passShortMsg = useContent("auth.error.passwordTooShort") as string;
  const emailExists  = useContent("auth.signup.error.emailExists") as string;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < 8) {
      setErr(passShortMsg);
      return;
    }
    if (!isSupabaseConfigured()) {
      setErr("מערכת ההרשמה לא מוגדרת. יש לפנות לתמיכה.");
      return;
    }
    const sb = browserClient();
    if (!sb) return;

    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    setBusy(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered")) setErr(emailExists);
      else setErr(error.message);
      return;
    }

    // Supabase quirk: with email-confirm ON, signing up an EXISTING email
    // returns success + a fake user object with identities=[] (enumeration
    // prevention). Without this check the user thinks they registered when
    // they didn't. Surface the duplicate-email message explicitly.
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setErr(emailExists);
      return;
    }

    if (data.session) {
      // Set the welcome-popup flag for the home page to pick up on mount.
      // Cleared by AuthSuccessModal after showing once.
      try { sessionStorage.setItem("vm_auth_event", "signup"); } catch {}
      router.push("/");
    } else setDone(true);
  }

  async function oauth(provider: "google" | "apple") {
    setErr(null);
    if (!isSupabaseConfigured()) { setErr("מערכת ההרשמה לא מוגדרת."); return; }
    const sb = browserClient();
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      setBusy(false);
      const msg = error.message.toLowerCase();
      if (msg.includes("provider is not enabled")) {
        setErr(provider === "google"
          ? "התחברות עם Google עוד לא הופעלה. (מנהלת — הפעילי ב-Supabase → Authentication → Providers → Google)"
          : "התחברות עם Apple עוד לא הופעלה. (מנהלת — הפעילי ב-Supabase → Authentication → Providers → Apple)");
      } else setErr(error.message);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
        <div className="max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold mb-2">{confirmTitle}</h1>
          <p className="text-white/70 mb-6">
            {confirmBody.replace("{{email}}", email)}
          </p>
          <Link
            href="/login"
            className="inline-block bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-6 py-2.5 rounded-lg"
          >
            {confirmCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6">
          <Home className="w-3.5 h-3.5" /> <span>{backHome}</span>
        </Link>
        <div className="flex justify-center mb-6"><LogoMark size={56} /></div>
        <h1 className="text-3xl font-extrabold text-center mb-2">{heading}</h1>
        <p className="text-center text-white/60 mb-2">{subheading}</p>
        <div className="flex justify-center mb-8">
          <span className="inline-block bg-brand/20 border border-brand/40 text-brand-light text-xs px-3 py-1 rounded-full">
            ✨ {badge}
          </span>
        </div>

        <div className="bg-bg-panel/80 border border-white/10 rounded-2xl p-6 backdrop-blur space-y-4">
          <button
            type="button"
            onClick={() => oauth("google")}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-white !text-black hover:bg-white/90 disabled:opacity-50 font-bold py-2.5 rounded-lg transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.85a4.15 4.15 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.69-3.89 2.69-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.46-.81 5.94-2.18l-2.92-2.26c-.81.54-1.84.86-3.02.86-2.32 0-4.28-1.57-4.98-3.67H.92v2.33A9 9 0 009 18z"/>
              <path fill="#FBBC05" d="M4.02 10.74A5.41 5.41 0 013.74 9c0-.6.1-1.18.28-1.74V4.93H.92A8.99 8.99 0 000 9c0 1.45.35 2.83.92 4.07l3.1-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.97 8.97 0 009 0 9 9 0 00.92 4.93l3.1 2.33C4.72 5.16 6.68 3.58 9 3.58z"/>
            </svg>
            <span className="text-black">{googleLabel || "Google"}</span>
          </button>
          {/* Apple sign-in button removed 2026-06-16 per Liat. Apple OAuth
              needs a $99/yr Apple Developer account that isn'\''t worth it for
              launch; Google + email already cover the case. Block of code
              kept commented in git history if we ever re-add it. */}

          <div className="relative flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">{dividerText}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs text-white/60 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> {nameLabel}
              </span>
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
                placeholder={namePlace}
              />
            </label>

            <label className="block">
              <span className="text-xs text-white/60 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {emailLabel}
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
                placeholder="name@example.com"
                dir="ltr"
              />
            </label>

            <label className="block">
              <span className="text-xs text-white/60 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> {passLabel}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
                placeholder={passPlace}
                dir="ltr"
              />
            </label>

            {err && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-opacity"
            >
              <UserPlus className="w-4 h-4" />
              {busy ? submitBusy : submitLabel}
            </button>

            <p className="text-[10px] text-white/40 text-center pt-1">
              {termsAgree}{" "}
              <Link href="/policy" className="underline">{termsLink}</Link>
            </p>
          </form>
        </div>

        <p className="text-center text-white/60 mt-6 text-sm">
          {haveAccountQ}{" "}
          <Link href="/login" className="text-brand-light font-semibold hover:underline">
            {loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
