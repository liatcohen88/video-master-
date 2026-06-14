"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ShoppingBag, Wand2, Sparkles } from "lucide-react";
import { useContent } from "@/lib/useContent";
import LogoMark from "@/components/LogoMark";

// useSearchParams() suspends during prerender, so the page must be wrapped
// in a Suspense boundary or Next 15 fails the build with "Error occurred
// prerendering". Force-dynamic avoids prerender entirely for this route —
// it's a payment-callback page that always needs fresh URL params anyway.
export const dynamic = "force-dynamic";

/**
 * /credits/success — PayPlus redirects here after the user finishes the
 * hosted payment page. URL params: ?pkg=<id>&credits=<n>  (on success)
 *                                   ?status=fail           (on cancel/decline)
 *
 * The actual credit grant happens server-side via the PayPlus webhook
 * (/api/payplus/webhook); this page is purely the visual receipt.
 */
export default function CreditsSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const failed     = sp.get("status") === "fail";
  const creditsStr = sp.get("credits");
  const credits    = creditsStr ? parseInt(creditsStr, 10) : NaN;

  const title       = useContent("purchase.title") as string;
  const body        = useContent("purchase.body") as string;
  const bodyNoQty   = useContent("purchase.bodyNoQty") as string;
  const ctaStart    = useContent("purchase.cta.start") as string;
  const ctaMore     = useContent("purchase.cta.more") as string;
  const errTitle    = useContent("purchase.error.title") as string;
  const errBody     = useContent("purchase.error.body") as string;
  const errRetry    = useContent("purchase.error.retry") as string;

  if (failed) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 rounded-2xl bg-red-500/10 border border-red-500/30 mb-6">
            <AlertCircle className="w-12 h-12 text-red-300" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2">{errTitle}</h1>
          <p className="text-white/60 mb-8">{errBody}</p>
          <Link href="/credits" className="inline-flex items-center gap-2 bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-6 py-3 rounded-xl">
            <ShoppingBag className="w-4 h-4" /> {errRetry}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white">
      <div className="max-w-md w-full">
        {/* Confetti-style header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-5 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-600/15 border border-emerald-400/40 mb-4 shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="w-14 h-14 text-emerald-300" />
          </div>
          <div className="flex justify-center mb-3">
            <LogoMark size={42} />
          </div>
        </div>

        {/* Success card */}
        <div className="bg-bg-panel border border-emerald-400/30 rounded-3xl p-8 text-center shadow-2xl">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-3">{title}</h1>
          <p className="text-white/70 mb-6">
            {Number.isFinite(credits) && credits > 0
              ? body.replace("{{credits}}", String(credits))
              : bodyNoQty}
          </p>

          {/* Big credits badge */}
          {Number.isFinite(credits) && credits > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-400/40 text-amber-200 text-lg font-extrabold px-5 py-2 rounded-full mb-6">
              <Sparkles className="w-5 h-5" />
              +{credits} מאסטרים
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 gap-2.5 mt-2">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-accent-pink hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity"
            >
              <Wand2 className="w-4 h-4" /> {ctaStart}
            </Link>
            <Link
              href="/credits"
              className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 text-white font-bold py-3 rounded-xl"
            >
              <ShoppingBag className="w-4 h-4" /> {ctaMore}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
