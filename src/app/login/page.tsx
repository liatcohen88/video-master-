"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, AlertCircle, Home } from "lucide-react";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import { useContent } from "@/lib/useContent";
import LogoMark from "@/components/LogoMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // CMS-driven copy so Liat can rephrase from admin without code changes.
  const heading      = useContent("auth.login.heading") as string;
  const subheading   = useContent("auth.login.subheading") as string;
  const emailLabel   = useContent("auth.field.email") as string;
  const passLabel    = useContent("auth.field.password") as string;
  const submitLabel  = useContent("auth.login.submit") as string;
  const submitBusy   = useContent("auth.login.submitBusy") as string;
  const noAccountQ   = useContent("auth.login.noAccount") as string;
  const signupLink   = useContent("auth.login.signupCta") as string;
  const dividerText  = useContent("auth.divider") as string;
  const googleLabel  = useContent("auth.oauth.google") as string;
  // appleLabel removed 2026-06-16 — Apple sign-in button is hidden.
  const backHome     = useContent("auth.backHome") as string;
  const forgotLabel  = useContent("auth.login.forgot") as string;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!isSupabaseConfigured()) {
      setErr("מערכת ההרשמה לא מוגדרת. יש לפנות לתמיכה.");
      return;
    }
    const sb = browserClient();
    if (!sb) return;

    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid")) setErr("אימייל או סיסמה שגויים. יש לנסות שוב.");
      else if (msg.includes("email not confirmed")) setErr("צריך לאשר את האימייל קודם. יש לבדוק את התיבה.");
      else setErr(error.message);
      return;
    }
    // Set the returning-user popup flag for the home page to pick up.
    try { sessionStorage.setItem("vm_auth_event", "login"); } catch {}
    router.push("/");
  }

  async function oauth(provider: "google" | "apple") {
    setErr(null);
    if (!isSupabaseConfigured()) {
      setErr("מערכת ההרשמה לא מוגדרת.");
      return;
    }
    const sb = browserClient();
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        // Return to /dashboard after the OAuth roundtrip.
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
    // success → Supabase redirects out of the page; no need to setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6">
          <Home className="w-3.5 h-3.5" /> <span>{backHome}</span>
        </Link>
        <div className="flex justify-center mb-6"><LogoMark size={56} /></div>
        <h1 className="text-3xl font-extrabold text-center mb-2">{heading}</h1>
        <p className="text-center text-white/60 mb-8">{subheading}</p>

        <div className="bg-bg-panel/80 border border-white/10 rounded-2xl p-6 backdrop-blur space-y-4">
          {/* OAuth buttons — top so users don't scroll past them */}
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
          {/* Apple sign-in removed 2026-06-16 per Liat — see signup page. */}

          <div className="relative flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">{dividerText}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
                placeholder="••••••••"
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
              <LogIn className="w-4 h-4" />
              {busy ? submitBusy : submitLabel}
            </button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-[12px] text-white/50 hover:text-white underline">
                {forgotLabel}
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-white/60 mt-6 text-sm">
          {noAccountQ}{" "}
          <Link href="/signup" className="text-brand-light font-semibold hover:underline">
            {signupLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
