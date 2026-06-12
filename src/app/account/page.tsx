"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Download, Trash2, AlertCircle, CheckCircle2, KeyRound, Shield } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { browserClient, isSupabaseConfigured } from "@/lib/supabase";
import { useContent } from "@/lib/useContent";
import SiteHeader from "@/components/SiteHeader";

/**
 * /account — user self-service: change password, export own data (GDPR),
 * delete account. All copy via CMS so Liat can rewrite without code.
 */
export default function AccountPage() {
  const auth = useAuth();
  const [newPass, setNewPass] = useState("");
  const [busyPass, setBusyPass] = useState(false);
  const [busyDel, setBusyDel]   = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const heading        = useContent("account.heading") as string;
  const subheading     = useContent("account.subheading") as string;
  const passTitle      = useContent("account.password.title") as string;
  const passHint       = useContent("account.password.hint") as string;
  const passPlace      = useContent("account.password.placeholder") as string;
  const passSubmit     = useContent("account.password.submit") as string;
  const passSubmitBusy = useContent("account.password.submitBusy") as string;
  const passOk         = useContent("account.password.ok") as string;
  const exportTitle    = useContent("account.export.title") as string;
  const exportHint     = useContent("account.export.hint") as string;
  const exportBtn      = useContent("account.export.button") as string;
  const dangerTitle    = useContent("account.danger.title") as string;
  const dangerHint     = useContent("account.danger.hint") as string;
  const dangerBtn      = useContent("account.danger.button") as string;
  const dangerBusy     = useContent("account.danger.busy") as string;
  const dangerConfirm  = useContent("account.danger.confirm") as string;
  const guestNotice    = useContent("account.guestNotice") as string;
  const goToLogin      = useContent("account.goToLogin") as string;

  if (auth.status === "loading") {
    return <div className="min-h-screen" />;
  }
  if (auth.status === "guest") {
    return (
      <div dir="rtl" className="min-h-screen text-white">
        <div className="px-6 pt-6"><SiteHeader /></div>
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-white/40" />
          <p className="text-white/70 mb-6">{guestNotice}</p>
          <Link href="/login" className="inline-block bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-6 py-2.5 rounded-lg">
            {goToLogin}
          </Link>
        </div>
      </div>
    );
  }

  const profile = auth.profile;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPass.length < 8) { setMsg({ kind: "err", text: "הסיסמה צריכה להיות לפחות 8 תווים." }); return; }
    if (!isSupabaseConfigured()) return;
    const sb = browserClient();
    if (!sb) return;
    setBusyPass(true);
    const { error } = await sb.auth.updateUser({ password: newPass });
    setBusyPass(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else { setMsg({ kind: "ok", text: passOk }); setNewPass(""); }
  }

  function exportData() {
    // Client-side export of the profile we already have. The Supabase row +
    // any localStorage state we keep. Plain JSON — GDPR-friendly.
    const payload = {
      profile,
      exportedAt: new Date().toISOString(),
      localStorage: Object.fromEntries(
        Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]),
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master-video-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!window.confirm(dangerConfirm)) return;
    setBusyDel(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "מחיקה נכשלה");
      // signed out by server; reload home
      window.location.href = "/";
    } catch (e: unknown) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
      setBusyDel(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen text-white">
      <div className="px-6 pt-6"><SiteHeader /></div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">{heading}</h1>
          <p className="text-sm text-white/60">{subheading}</p>
        </div>

        {msg && (
          <div className={`flex items-start gap-2 text-sm rounded-lg p-3 mb-6 ${
            msg.kind === "ok" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
                              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}>
            {msg.kind === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Change password */}
        <form onSubmit={changePassword} className="bg-bg-card border border-white/10 rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-200"><KeyRound className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold">{passTitle}</h2>
              <p className="text-xs text-white/50">{passHint}</p>
            </div>
          </div>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full bg-bg-input border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand"
            placeholder={passPlace}
            dir="ltr"
          />
          <button type="submit" disabled={busyPass || !newPass}
            className="mt-3 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg">
            {busyPass ? passSubmitBusy : passSubmit}
          </button>
        </form>

        {/* Export data */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-200"><Download className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold">{exportTitle}</h2>
              <p className="text-xs text-white/50">{exportHint}</p>
            </div>
          </div>
          <button type="button" onClick={exportData}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-bold px-5 py-2 rounded-lg">
            {exportBtn}
          </button>
        </div>

        {/* Delete account */}
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-300"><Trash2 className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-red-200">{dangerTitle}</h2>
              <p className="text-xs text-white/50">{dangerHint}</p>
            </div>
          </div>
          <button type="button" onClick={deleteAccount} disabled={busyDel}
            className="bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-200 font-bold px-5 py-2 rounded-lg">
            {busyDel ? dangerBusy : dangerBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
