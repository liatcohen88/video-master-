"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/credits";
import { useAuth } from "@/lib/useAuth";
import { browserClient } from "@/lib/supabase";
import { useContent } from "@/lib/useContent";
import MasterCoin from "@/components/MasterCoin";
import LogoMark from "@/components/LogoMark";

/**
 * /buy/[pkg] — pre-checkout landing.
 *
 * Why we need this page: Grow's hosted payment page doesn't collect email
 * in its minimal flow, and Grow URLs don't reliably round-trip a custom
 * `?u=USERID` parameter. So this page does two jobs:
 *
 *   1. Show a fully-branded, beautiful checkout screen (matches the
 *      mockup Liat shared — big gold coin + price + secure-pay CTA).
 *   2. On "המשך לתשלום" click, hit /api/buy which inserts a row in
 *      `pending_payments` tying THIS user to the expected amount, then
 *      redirects to Grow's hosted page. When Grow webhooks back, we
 *      match by amount + recency to figure out who paid.
 *
 * Guests are gated to /login first — we can't reserve a pending payment
 * for someone we don't know.
 */
export default function BuyPage({ params }: { params: Promise<{ pkg: string }> }) {
  const { pkg: pkgId } = use(params);
  const pkg = CREDIT_PACKAGES.find((p) => p.id === pkgId);
  const router = useRouter();
  const auth = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const currency       = (useContent("brand.currencyName") as string) || "מאסטרים";
  const headerTagline  = useContent("brand.tagline") as string;

  if (!pkg) {
    return (
      <Centered>
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">חבילה לא נמצאה</h1>
          <p className="text-white/60 mb-6 text-sm">החבילה שביקשת לא קיימת.</p>
          <Link href="/credits" className="inline-flex items-center gap-2 bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-5 py-2.5 rounded-xl">
            לחבילות
          </Link>
        </div>
      </Centered>
    );
  }

  if (!pkg.payUrl) {
    return (
      <Centered>
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-amber-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">החבילה הזו עדיין בהכנה</h1>
          <p className="text-white/60 mb-6 text-sm">החבילה הזו עוד לא מחוברת לסליקה. אפשר להתחיל מחבילת ההתחלה (₪10).</p>
          <Link href="/buy/mini" className="inline-flex items-center gap-2 bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-5 py-2.5 rounded-xl">
            לחבילת ההתחלה
          </Link>
        </div>
      </Centered>
    );
  }

  async function onCheckout() {
    if (submitting) return;
    setErr(null);

    if (auth.status !== "user") {
      // Guest — bounce to login and come back here.
      router.push(`/login?next=${encodeURIComponent(`/buy/${pkgId}`)}`);
      return;
    }

    setSubmitting(true);
    try {
      const sb = browserClient();
      const token = (await sb?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("התחברות לא תקפה — נסי להתחבר מחדש.");

      const res = await fetch("/api/buy", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: pkg!.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error ?? "כשל בהכנת התשלום");
      }
      // Hand-off to Grow.
      window.location.href = data.redirectUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white relative overflow-hidden">
      {/* Ambient brand glow — violet + pink to match the rest of the site */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[420px] h-[420px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[340px] h-[340px] rounded-full bg-accent-pink/20 blur-[120px]" />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-8">
        {/* Brand strip */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <LogoMark size={36} />
          <div className="text-right">
            <div className="font-extrabold text-base leading-none">MASTERS</div>
            <div className="text-[10px] text-white/40">{headerTagline}</div>
          </div>
        </div>

        {/* Hero card: coin + price */}
        <div className="bg-gradient-to-br from-bg-panel/90 to-bg-card/90 backdrop-blur border border-amber-400/25 rounded-3xl px-6 py-7 shadow-2xl shadow-amber-500/10">
          {/* Inviting headline, brand-voiced — frames the screen as a clear
              question rather than a generic checkout. */}
          <h1 className="text-center text-xl md:text-2xl font-extrabold mb-1 leading-snug">
            האם ברצונך לרכוש{" "}
            <span className="bg-gradient-to-r from-brand-light to-accent-pink bg-clip-text text-transparent">
              {pkg.credits} מאסטרים
            </span>
            ?
          </h1>
          <p className="text-center text-xs text-white/50 mb-5">המאסטרים יתווספו לחשבונך מיד לאחר התשלום</p>

          <div className="flex items-center gap-5 mb-6">
            {/* Coin with brand-tinted glow */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 -m-4 rounded-full bg-brand/35 blur-2xl animate-pulse" />
              <MasterCoin size={120} className="relative drop-shadow-[0_6px_20px_rgba(168,85,247,0.45)] animate-coin-tilt" />
            </div>
            {/* Side info */}
            <div className="flex-1 text-right">
              <div className="text-[11px] text-white/40 uppercase tracking-wider mb-1">חבילה נבחרת</div>
              <div className="text-3xl font-black leading-none mb-2">
                {pkg.credits} <span className="text-base text-white/60 font-normal">{currency}</span>
              </div>
              <div className="text-[11px] text-white/50 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand-light" /> {pkg.label}
              </div>
              <div className="inline-flex items-center gap-2 bg-bg-card border border-white/10 rounded-full px-3 py-1">
                <MasterCoin size={18} />
                <span className="font-bold">{pkg.credits}</span>
              </div>
            </div>
          </div>

          {/* Big price block — drop the .00 when whole; keep cents only when present */}
          <div className="bg-bg-card/70 border border-white/10 rounded-2xl px-5 py-4 mb-5">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] text-white/40">סה״כ לתשלום</div>
              <div>
                <span className="text-4xl font-black bg-gradient-to-b from-brand-light to-accent-pink bg-clip-text text-transparent">
                  ₪{pkg.priceIls % 1 === 0 ? pkg.priceIls : pkg.priceIls.toFixed(2)}
                </span>
                <div className="text-[10px] text-white/40 text-left">כולל מע״מ</div>
              </div>
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Checkout button */}
          {(() => {
            const priceDisplay = pkg.priceIls % 1 === 0 ? pkg.priceIls : pkg.priceIls.toFixed(2);
            return (
              <button
                type="button"
                disabled={submitting || auth.status === "loading"}
                onClick={onCheckout}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand via-accent-pink to-brand hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-opacity shadow-lg shadow-brand/40"
              >
                <Lock className="w-4 h-4" />
                {submitting
                  ? "מעבירים אותך לסליקה..."
                  : auth.status !== "user"
                    ? `התחברות והמשך לתשלום ₪${priceDisplay}`
                    : `המשך לתשלום ₪${priceDisplay}`}
                <ArrowRight className="w-4 h-4" />
              </button>
            );
          })()}

          {/* Trust strip */}
          <div className="flex items-center justify-center gap-4 mt-5 text-[10px] text-white/40">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> תשלום מאובטח</span>
            <span>·</span>
            <span>עמידה בתקן PCI</span>
            <span>·</span>
            <span>סליקה ע״י Grow</span>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/40 mt-5">
          המאסטרים יתווספו אוטומטית לחשבונך מיד לאחר השלמת התשלום ✓
        </p>

        <div className="text-center mt-3">
          <Link href="/credits" className="text-[11px] text-white/40 hover:text-white/70">
            ← חזרה לחבילות
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes coin-tilt {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50%      { transform: rotate(6deg) translateY(-6px); }
        }
        .animate-coin-tilt { animation: coin-tilt 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white">
      {children}
    </div>
  );
}
