/**
 * PayPlus payment-gateway adapter (Israel).
 *
 * Why PayPlus: free API access (pay only per transaction ~1.9%), modern
 * REST API, includes invoice issuance via EZ Count partner.
 *
 * Docs: https://docs.payplus.co.il/
 *
 * Environment variables (set in .env.local or Lovable env settings):
 *   PAYPLUS_API_KEY        — provided in your PayPlus dashboard
 *   PAYPLUS_SECRET_KEY     — provided in your PayPlus dashboard
 *   PAYPLUS_PAGE_UID       — the "Payment Page" UID you create in PayPlus
 *   PAYPLUS_WEBHOOK_SECRET — random string you set yourself for IPN verify
 *   PAYPLUS_USE_PROD       — "true" to hit live API; otherwise sandbox
 *
 * If any of the first three are missing, this module returns null from
 * createPaymentLink and the /api/checkout route falls back to dev stub
 * mode (credits added locally without real payment).
 */

const PROD_BASE    = "https://restapi.payplus.co.il/api/v1.0";
const SANDBOX_BASE = "https://restapidev.payplus.co.il/api/v1.0";

function baseUrl(): string {
  return process.env.PAYPLUS_USE_PROD === "true" ? PROD_BASE : SANDBOX_BASE;
}

export function isConfigured(): boolean {
  return !!(process.env.PAYPLUS_API_KEY
    && process.env.PAYPLUS_SECRET_KEY
    && process.env.PAYPLUS_PAGE_UID);
}

export type PayPlusChargeInput = {
  /** Stable package id you defined in CMS (passed back in webhook) */
  packageId: string;
  /** Final amount in shekels */
  amountIls: number;
  /** Number of credits the customer is buying */
  credits: number;
  /** Optional user identifier — written into `more_info` for the webhook */
  userId?: string;
  /** Optional user email — speeds the user through PayPlus's page */
  customerEmail?: string;
  /** URL to send user to after successful payment */
  successUrl: string;
  /** URL to send user to if they cancel */
  cancelUrl: string;
  /** URL PayPlus will POST the IPN to (server-to-server confirmation) */
  webhookUrl: string;
};

export type PayPlusChargeResult = {
  /** Hosted payment-page URL — redirect the user here */
  paymentUrl: string;
  /** PayPlus's id for this attempt — store for reconciliation */
  pageRequestUid: string;
};

/**
 * Create a hosted payment page and return its URL.
 * Throws on API errors so the caller can return a meaningful 5xx.
 */
export async function createPaymentLink(
  input: PayPlusChargeInput,
): Promise<PayPlusChargeResult | null> {
  if (!isConfigured()) return null;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": JSON.stringify({
      api_key: process.env.PAYPLUS_API_KEY!,
      secret_key: process.env.PAYPLUS_SECRET_KEY!,
    }),
  };

  const body = {
    payment_page_uid: process.env.PAYPLUS_PAGE_UID!,
    charge_method: 1,                              // 1 = single charge
    amount: input.amountIls,
    currency_code: "ILS",
    sendEmailApproval: true,
    sendEmailFailure: false,
    refURL_success: input.successUrl,
    refURL_failure: input.cancelUrl,
    refURL_callback: input.webhookUrl,
    // `more_info` round-trips to the webhook so we can credit the right account
    more_info: JSON.stringify({
      packageId: input.packageId,
      credits: input.credits,
      userId: input.userId ?? "",
    }),
    items: [{
      name: `${input.credits} קרדיט ל-Video Master`,
      quantity: 1,
      price: input.amountIls,
    }],
    customer: input.customerEmail ? { email: input.customerEmail } : undefined,
  };

  const res = await fetch(`${baseUrl()}/PaymentPages/generateLink`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`PayPlus HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const j = await res.json() as {
    results?: { status?: string };
    data?: { payment_page_link?: string; page_request_uid?: string };
  };
  if (j.results?.status !== "success" || !j.data?.payment_page_link) {
    throw new Error(`PayPlus rejected request: ${JSON.stringify(j).slice(0, 300)}`);
  }
  return {
    paymentUrl: j.data.payment_page_link,
    pageRequestUid: j.data.page_request_uid ?? "",
  };
}

/**
 * Verify an IPN/webhook payload from PayPlus.
 *
 * PayPlus signs the body with HMAC-SHA256 using your secret key. We check
 * the signature header matches our expected hash so an attacker can't
 * fake a "payment completed" call to grant free credits.
 *
 * Returns the parsed payload if valid, or null if signature mismatch.
 */
export type PayPlusWebhookPayload = {
  status_code?: string;            // "000" = success, others = failure/pending
  transaction_uid?: string;
  page_request_uid?: string;
  more_info?: string;              // JSON string we set in createPaymentLink
  amount?: string;
  brand_name?: string;
  last_four_digits?: string;
};

export async function verifyAndParseWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<PayPlusWebhookPayload | null> {
  const secret = process.env.PAYPLUS_SECRET_KEY;
  if (!secret) return null;
  if (!signatureHeader) return null;

  // PayPlus signs the raw body with HMAC-SHA256 hex
  const crypto = await import("node:crypto");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // PayPlus header is sometimes raw hex, sometimes base64 — accept both
  const expectedB64 = Buffer.from(expected, "hex").toString("base64");
  const ok = signatureHeader === expected || signatureHeader === expectedB64;
  if (!ok) return null;

  try {
    return JSON.parse(rawBody) as PayPlusWebhookPayload;
  } catch {
    return null;
  }
}

/** "000" is PayPlus's "approved" status code. Anything else = treat as failed. */
export function isWebhookApproved(p: PayPlusWebhookPayload): boolean {
  return p.status_code === "000";
}

/**
 * Pull the (packageId, credits, userId) we stamped on the original
 * createPaymentLink call back out of the webhook's `more_info` field.
 */
export function extractMoreInfo(p: PayPlusWebhookPayload): {
  packageId?: string; credits?: number; userId?: string;
} {
  if (!p.more_info) return {};
  try {
    const j = JSON.parse(p.more_info) as { packageId?: string; credits?: number; userId?: string };
    return j;
  } catch {
    return {};
  }
}
