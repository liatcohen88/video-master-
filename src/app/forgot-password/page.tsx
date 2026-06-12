"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Send, AlertCircle, CheckCircle2, Home } from "lucide-react";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import { useContent } from "@/lib/useContent";
import LogoMark from "@/components/LogoMark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const heading     = useContent("auth.forgot.heading") as string;
  const subheading  = useContent("auth.forgot.subheading") as string;
  const emailLabel  = useContent("auth.field.email") as string;
  const submitLabel = useContent("auth.forgot.submit") as string;
  const submitBusy  = useContent("auth.forgot.submitBusy") as string;
  const sentTitle   = useContent("auth.forgot.sentTitle") as string;
  const sentBody    = useContent("auth.forgot.sentBody") as string;
  const backToLogin = useContent("auth.forgot.backToLogin") as string;
  const backHome    = useContent("auth.backHome") as string;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!isSupabaseConfigured()) { setErr("מערכת ההרשמה לא מוגדרת."); return; }
    const sb = browserClient();
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/account?reset=1` : undefined,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
        <div className="max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold mb-2">{sentTitle}</h1>
          <p className="text-white/70 mb-6">{sentBody.replace("{{email}}", email)}</p>
          <Link href="/login" className="inline-block bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-6 py-2.5 rounded-lg">
            {backToLogin}
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
        <p className="text-center text-white/60 mb-8">{subheading}</p>

        <form onSubmit={handleSubmit} className="bg-bg-panel/80 border border-white/10 rounded-2xl p-6 backdrop-blur space-y-4">
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
              className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand"
              placeholder="liat@example.com"
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
            <Send className="w-4 h-4" />
            {busy ? submitBusy : submitLabel}
          </button>
        </form>

        <p className="text-center text-white/60 mt-6 text-sm">
          <Link href="/login" className="text-brand-light font-semibold hover:underline">
            ← {backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
