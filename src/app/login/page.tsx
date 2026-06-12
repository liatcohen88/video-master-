"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import LogoMark from "@/components/LogoMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      // Hebrew-friendly messages for the common cases
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid")) setErr("אימייל או סיסמה שגויים. נסי שוב.");
      else if (msg.includes("email not confirmed")) setErr("צריך לאשר את האימייל קודם. בדקי את התיבה.");
      else setErr(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark size={56} />
        </Link>
        <h1 className="text-3xl font-extrabold text-center mb-2">ברוכה השבה</h1>
        <p className="text-center text-white/60 mb-8">היכנסי לחשבון שלך</p>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-panel/80 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur"
        >
          <label className="block">
            <span className="text-xs text-white/60 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> אימייל
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
              <Lock className="w-3.5 h-3.5" /> סיסמה
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
            {busy ? "מתחברת..." : "התחברי"}
          </button>
        </form>

        <p className="text-center text-white/60 mt-6 text-sm">
          אין לך חשבון?{" "}
          <Link href="/signup" className="text-brand-light font-semibold hover:underline">
            הירשמי עכשיו
          </Link>
        </p>
      </div>
    </div>
  );
}
