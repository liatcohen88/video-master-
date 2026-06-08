/**
 * Checkout endpoint — creates a payment session.
 *
 * Flow:
 *  1. Client POSTs { packageId, packageOverride? } with the CMS-defined
 *     package (id, credits, priceIls).
 *  2. If PayPlus is configured (env keys present), we create a hosted
 *     payment-page link and return { url } for the client to redirect.
 *  3. After payment, PayPlus POSTs to /api/payplus/webhook which credits
 *     the user.
 *  4. If PayPlus is NOT configured → dev stub: return creditsToAdd so the
 *     client adds the credits locally without real payment.
 */

import { NextRequest, NextResponse } from "next/server";
import { CREDIT_PACKAGES } from "@/lib/credits";
import { createPaymentLink, isConfigured as payplusConfigured } from "@/lib/payplus";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { packageId, packageOverride, customerEmail } = await req.json().catch(() => ({}));

  let pkg: { id: string; credits: number; priceIls: number } | undefined =
    CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg && packageOverride
      && typeof packageOverride.credits === "number" && packageOverride.credits > 0
      && typeof packageOverride.priceIls === "number" && packageOverride.priceIls > 0) {
    pkg = {
      id: String(packageOverride.id ?? packageId),
      credits: packageOverride.credits,
      priceIls: packageOverride.priceIls,
    };
  }
  if (!pkg) {
    return NextResponse.json({ error: "חבילה לא מזוהה" }, { status: 400 });
  }

  // ── DEV mode: no PayPlus credentials → grant credits locally ──
  if (!payplusConfigured()) {
    return NextResponse.json({
      mode: "dev-stub",
      message: "מצב פיתוח (PayPlus לא מוגדר) — נוסף קרדיט מקומית בלי תשלום אמיתי",
      creditsToAdd: pkg.credits,
    });
  }

  // ── PRODUCTION: ask PayPlus for a hosted payment-page URL ──
  try {
    const origin = req.nextUrl.origin;
    const result = await createPaymentLink({
      packageId: pkg.id,
      amountIls: pkg.priceIls,
      credits: pkg.credits,
      customerEmail: typeof customerEmail === "string" ? customerEmail : undefined,
      successUrl: `${origin}/credits?status=success`,
      cancelUrl:  `${origin}/credits?status=cancel`,
      webhookUrl: `${origin}/api/payplus/webhook`,
    });
    if (!result) {
      return NextResponse.json({ error: "PayPlus לא מאופיין כראוי" }, { status: 500 });
    }
    return NextResponse.json({ url: result.paymentUrl, pageRequestUid: result.pageRequestUid });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
