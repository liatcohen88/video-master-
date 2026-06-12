"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import LogoMark from "@/components/LogoMark";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < 8) {
      setErr("הסיסמה צריכה להיות לפחות 8 תווים.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setErr("מערכת ההרשמה לא מוגדרת. פני למפתחת.");
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
      if (msg.includes("already registered")) setErr("האימייל כבר רשום. אולי שכחת סיסמה?");
      else setErr(error.message);
      return;
    }

    // If "Confirm email" is on in Supabase → no session yet; ask user to check inbox.
    // Otherwise we're logged in immediately and go to dashboard.
    if (data.session) {
      router.push("/dashboard");
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
        <div className="max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold mb-2">כמעט שם! 🎉</h1>
          <p className="text-white/70 mb-6">
            שלחנו לך אימייל אישור ל-<span className="font-mono text-white" dir="ltr">{email}</span>.
            <br />לחצי על הקישור במייל כדי להפעיל את החשבון.
          </p>
          <Link
            href="/login"
            className="inline-block bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-6 py-2.5 rounded-lg"
          >
            חזרה להתחברות
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark size={56} />
        </Link>
        <h1 className="text-3xl font-extrabold text-center mb-2">הרשמה חדשה</h1>
        <p className="text-center text-white/60 mb-2">25 מאסטרים במתנה</p>
        <div className="flex justify-center mb-8">
          <span className="inline-block bg-brand/20 border border-brand/40 text-brand-light text-xs px-3 py-1 rounded-full">
            ✨ זה לוקח 30 שניות
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-panel/80 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur"
        >
          <label className="block">
            <span className="text-xs text-white/60 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> שם
            </span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
              placeholder="ליאת"
            />
          </label>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
              placeholder="לפחות 8 תווים"
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
            {busy ? "יוצרת חשבון..." : "צרי חשבון"}
          </button>

          <p className="text-[10px] text-white/40 text-center pt-1">
            בלחיצה על &quot;צרי חשבון&quot; את מסכימה ל-
            <Link href="/policy" className="underline">תנאי השימוש</Link>
          </p>
        </form>

        <p className="text-center text-white/60 mt-6 text-sm">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="text-brand-light font-semibold hover:underline">
            התחברי
          </Link>
        </p>
      </div>
    </div>
  );
}
