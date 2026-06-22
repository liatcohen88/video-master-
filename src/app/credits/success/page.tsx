"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ShoppingBag, Wand2, Check } from "lucide-react";
import { useContent } from "@/lib/useContent";
import { useAuth } from "@/lib/useAuth";
import { browserClient } from "@/lib/supabase";
import MasterCoin from "@/components/MasterCoin";

// useSearchParams() suspends during prerender, so the page must be wrapped
// in a Suspense boundary. Force-dynamic avoids prerender entirely.
export const dynamic = "force-dynamic";

/**
 * /credits/success — Grow redirects here after the user completes payment.
 *
 * URL params:
 *   ?credits=<n>   how many credits were just purchased (display only)
 *   ?pkg=<id>      which package
 *   ?status=fail   on cancel/decline
 *
 * The actual credit grant happens server-side via /api/grow/webhook so this
 * page is purely visual. We poll the auth profile briefly after mount to
 * pick up the new balance if the webhook landed within ~5 seconds.
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

  const auth = useAuth();
  const [polledBalance, setPolledBalance] = useState<number | null>(null);

  // Webhook lands a moment after redirect — poll Supabase directly so the
  // balance card shows the fresh number without a manual page reload.
  // Stop after 8 ticks (~12 seconds) so we don't hammer the DB forever.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (failed || auth.status !== "user" || !auth.profile?.id || tick >= 8) return;
    const id = setTimeout(async () => {
      const sb = browserClient();
      if (!sb) return;
      const { data } = await sb.from("profiles").select("credits").eq("id", auth.profile!.id).maybeSingle();
      if (data?.credits != null) setPolledBalance(data.credits);
      setTick((t) => t + 1);
    }, 1500);
    return () => clearTimeout(id);
  }, [failed, auth.status, auth.profile, tick]);

  const liveBalance = polledBalance ?? (auth.status === "user" && auth.profile ? auth.profile.credits : null);

  // Show the REAL server balance — it already INCLUDES the credits just
  // purchased (the webhook credits within ~2-3s; we poll for it above). The
  // old code optimistically added the purchased amount to a "base" captured at
  // mount, but the webhook usually lands BEFORE the page mounts, so the base
  // was already post-purchase → double-count (Liat had 25+25=50 but the page
  // showed 75). The "+N" badge already communicates what was just bought.
  const displayBalance = liveBalance;

  const title       = useContent("purchase.title") as string;
  const body        = useContent("purchase.body") as string;
  const bodyNoQty   = useContent("purchase.bodyNoQty") as string;
  const ctaStart    = useContent("purchase.cta.start") as string;
  const ctaMore     = useContent("purchase.cta.more") as string;
  const errTitle    = useContent("purchase.error.title") as string;
  const errBody     = useContent("purchase.error.body") as string;
  const errRetry    = useContent("purchase.error.retry") as string;
  const balanceLabel = useContent("credits.balanceLabel") as string;
  const currency    = (useContent("brand.currencyName") as string) || "מאסטרים";

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
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white overflow-hidden relative">
      {/* Ambient brand glow — violet/pink halo around the coin, matching the
          Master Video site palette instead of the amber/gold tones. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-accent-pink/20 blur-[80px]" />
      </div>

      <div className="relative max-w-md w-full">
        {/* Floating-coin hero — big coin in center, smaller coins orbiting */}
        <div className="relative h-[260px] mb-2 flex items-center justify-center">
          {/* Orbit coins — pure CSS animations, randomized phases */}
          <FloatingCoin size={42} x={-110} y={-30} delay={0} />
          <FloatingCoin size={36} x={120}  y={-50} delay={0.4} />
          <FloatingCoin size={34} x={-130} y={70}  delay={0.8} />
          <FloatingCoin size={40} x={130}  y={60}  delay={1.2} />
          <FloatingCoin size={28} x={-30}  y={-100} delay={1.6} />
          <FloatingCoin size={30} x={40}   y={100} delay={2.0} />

          {/* Center coin */}
          <div className="relative">
            <div className="absolute inset-0 -m-8 rounded-full bg-brand/35 blur-2xl animate-pulse" />
            <MasterCoin size={170} className="relative drop-shadow-[0_8px_24px_rgba(168,85,247,0.5)] animate-coin-bob" />
          </div>
        </div>

        {/* Success card — brand violet border to match the site palette. */}
        <div className="bg-bg-panel/80 backdrop-blur border border-brand/40 rounded-3xl px-6 py-6 text-center shadow-2xl shadow-brand/15">
          {/* Check badge */}
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold px-3 py-1 rounded-full mb-3">
            <Check className="w-3 h-3" /> תשלום אושר
          </div>

          <h1 className="text-3xl font-black mb-2 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-white/70 text-sm mb-4">
            {Number.isFinite(credits) && credits > 0
              ? body.replace("{{credits}}", String(credits))
              : bodyNoQty}
          </p>

          {/* Big credits badge */}
          {Number.isFinite(credits) && credits > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-br from-brand/25 to-accent-pink/15 border border-brand/40 text-white text-base font-extrabold px-4 py-1.5 rounded-full mb-4">
              <MasterCoin size={18} /> +{credits}
            </div>
          )}

          {/* Balance card — shows the NEW total (incl. the credits just bought),
              self-correcting to the real number once the webhook lands. */}
          {displayBalance !== null && (
            <div className="bg-bg-card/70 border border-white/10 rounded-2xl px-4 py-3 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <MasterCoin size={20} />
                <span>{balanceLabel}</span>
              </div>
              <div className="text-2xl font-black bg-gradient-to-r from-brand-light to-accent-pink bg-clip-text text-transparent" key={displayBalance}>
                {displayBalance.toLocaleString()}{" "}
                <span className="text-[11px] text-white/40 font-normal">{currency}</span>
              </div>
            </div>
          )}

          {/* Primary CTA */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand via-accent-pink to-brand hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity shadow-lg shadow-brand/40"
          >
            <Wand2 className="w-4 h-4" /> {ctaStart}
          </Link>
          <Link
            href="/credits"
            className="block text-white/40 hover:text-white/70 text-xs mt-3"
          >
            {ctaMore}
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes coin-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-8px) rotate(2deg); }
        }
        .animate-coin-bob { animation: coin-bob 3.5s ease-in-out infinite; }
        @keyframes float-coin {
          0%   { transform: translate(var(--cx), var(--cy)) rotate(0deg);   opacity: 0; }
          15%  { opacity: 0.85; }
          50%  { transform: translate(calc(var(--cx) + 8px), calc(var(--cy) - 12px)) rotate(8deg); opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translate(var(--cx), var(--cy)) rotate(0deg);   opacity: 0; }
        }
        .float-coin { animation: float-coin 4s ease-in-out infinite; position: absolute; }
      `}</style>
    </div>
  );
}

function FloatingCoin({ size, x, y, delay }: { size: number; x: number; y: number; delay: number }) {
  return (
    <div
      className="float-coin"
      style={{
        ["--cx" as string]: `${x}px`,
        ["--cy" as string]: `${y}px`,
        animationDelay: `${delay}s`,
      } as React.CSSProperties}
    >
      <MasterCoin size={size} className="drop-shadow-[0_4px_8px_rgba(168,85,247,0.45)]" />
    </div>
  );
}
