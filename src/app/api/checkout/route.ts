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
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Block abuse: max 10 checkout attempts per IP per minute
  const limited = rateLimit(req, { key: "checkout", max: 10, windowSec: 60 });
  if (limited) return limited;

  const { packageId, customerEmail } = await req.json().catch(() => ({}));

  // Pricing is ALWAYS server-side. We deliberately do NOT accept any
  // packageOverride from the client — that bypass let an attacker pay ₪1
  // for a "1,000,000 credits" override. The only trusted source is the
  // server-side CREDIT_PACKAGES list (which mirrors the admin's CMS
  // pricing.packages array — pricing edits ship via deploy + cms-sync).
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
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
      successUrl: `${origin}/credits/success?pkg=${encodeURIComponent(pkg.id)}&credits=${pkg.credits}`,
      cancelUrl:  `${origin}/credits/success?status=fail`,
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
