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
  const appleLabel   = useContent("auth.oauth.apple") as string;
  const backHome     = useContent("auth.backHome") as string;
  const forgotLabel  = useContent("auth.login.forgot") as string;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!isSupabaseConfigured()) {
      setErr("מערכת ההרשמה לא מוגדרת. פני למפתחת.");
      return;
    }
    const sb = browserClient();
    if (!sb) return;

    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid")) setErr("אימייל או סיסמה שגויים. נסי שוב.");
      else if (msg.includes("email not confirmed")) setErr("צריך לאשר את האימייל קודם. בדקי את התיבה.");
      else setErr(error.message);
      return;
    }
    router.push("/dashboard");
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
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
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
          <button
            type="button"
            onClick={() => oauth("apple")}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-black/90 disabled:opacity-50 font-bold py-2.5 rounded-lg transition-opacity border border-white/15"
          >
            <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
            </svg>
            {appleLabel}
          </button>

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
                placeholder="liat@example.com"
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
