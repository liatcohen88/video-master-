"use client";

/**
 * /connect-whatsapp?phone=&token=
 * Landing page for the link the WhatsApp bot sends. Self-contained auth so the
 * user never leaves the flow: if logged in we link immediately; if not, we offer
 * Google or a passwordless magic-link — both return here and then auto-link.
 * The signed `token` proves the link was issued for THIS phone (see /api/whatsapp/link).
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";

type Status = "loading" | "guest" | "linking" | "done" | "error";

function ConnectInner() {
  const params = useSearchParams();
  const phone = params.get("phone") || "";
  const token = params.get("token") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) { setStatus("error"); setMsg("מערכת ההרשמה לא מוגדרת כרגע."); return; }
      const sb = browserClient();
      if (!sb) { setStatus("error"); setMsg("שגיאה זמנית."); return; }
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) { setStatus("guest"); return; }

      setStatus("linking");
      try {
        const res = await fetch("/api/whatsapp/link", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ phone, token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) { setStatus("done"); }
        else {
          setStatus("error");
          setMsg(data.error === "invalid token"
            ? "הקישור אינו תקין או שפג תוקפו. נסו לשלוח שוב סרטון בוואטסאפ כדי לקבל קישור חדש."
            : "החיבור נכשל. אפשר לנסות שוב בעוד רגע.");
        }
      } catch { setStatus("error"); setMsg("החיבור נכשל. אפשר לנסות שוב בעוד רגע."); }
    })();
  }, [phone, token]);

  async function google() {
    const sb = browserClient();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    });
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    const sb = browserClient();
    if (!sb || !email) return;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    });
    setMsg(error ? error.message : "שלחנו קישור התחברות למייל 📧 לחצו עליו כדי להשלים את החיבור.");
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white">
      <div className="w-full max-w-md bg-bg-panel/80 border border-white/10 rounded-2xl p-7 backdrop-blur text-center space-y-4">
        <div className="text-4xl">🎬</div>
        <h1 className="text-2xl font-extrabold">חיבור וואטסאפ למאסטר וידאו</h1>

        {status === "loading" && <p className="text-white/60">רגע, בודקים...</p>}

        {status === "linking" && <p className="text-white/60">מחברים את המספר לחשבון...</p>}

        {status === "done" && (
          <div className="space-y-3">
            <div className="text-3xl">✅</div>
            <p className="text-lg font-bold">מחובר!</p>
            <p className="text-white/70">אפשר לחזור לוואטסאפ ולשלוח את הסרטון — נחזיר אותו ערוך עם כתוביות ✨</p>
          </div>
        )}

        {status === "guest" && (
          <div className="space-y-4">
            <p className="text-white/70">כדי לקבל את הסרטון ערוך, מתחברים פעם אחת לחשבון (או נרשמים — חינם):</p>
            <button
              onClick={google}
              className="w-full flex items-center justify-center gap-2 bg-white !text-black hover:bg-white/90 font-bold py-2.5 rounded-lg"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.85a4.15 4.15 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.69-3.89 2.69-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.46-.81 5.94-2.18l-2.92-2.26c-.81.54-1.84.86-3.02.86-2.32 0-4.28-1.57-4.98-3.67H.92v2.33A9 9 0 009 18z"/>
                <path fill="#FBBC05" d="M4.02 10.74A5.41 5.41 0 013.74 9c0-.6.1-1.18.28-1.74V4.93H.92A8.99 8.99 0 000 9c0 1.45.35 2.83.92 4.07l3.1-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.97 8.97 0 009 0 9 9 0 00.92 4.93l3.1 2.33C4.72 5.16 6.68 3.58 9 3.58z"/>
              </svg>
              <span className="text-black">המשך עם Google</span>
            </button>
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white/40">או</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <form onSubmit={magic} className="space-y-3">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com" dir="ltr"
                className="w-full bg-bg-card border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-brand"
              />
              <button type="submit" className="w-full bg-brand hover:bg-brand/90 font-bold py-2.5 rounded-lg">
                שליחת קישור התחברות למייל
              </button>
            </form>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <div className="text-3xl">⚠️</div>
            <p className="text-white/70">{msg || "משהו השתבש."}</p>
          </div>
        )}

        {msg && status === "guest" && <p className="text-sm text-brand-light">{msg}</p>}
      </div>
    </div>
  );
}

export default function ConnectWhatsappPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-dark" />}>
      <ConnectInner />
    </Suspense>
  );
}
