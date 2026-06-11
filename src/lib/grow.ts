/**
 * Grow (גראו, formerly Meshulam) payment adapter — Israel.
 *
 * Grow is an Israeli payment gateway: local cards, Bit, Apple/Google Pay,
 * installments (תשלומים). API access itself is free — you pay only a
 * per-transaction commission. Good fit for an Israeli-audience product.
 *
 * This module focuses on the WEBHOOK (server-to-server notification Grow
 * sends after a payment). Grow calls this a "callback" / "indicator".
 *
 * Environment variables (set in .env.local — never commit real values):
 *   GROW_PAGE_CODE        — your payment-page code from the Grow dashboard
 *   GROW_USER_ID          — your Grow account user id (for API verification)
 *   GROW_API_KEY          — secret API key (for the verify-transaction call)
 *   GROW_WEBHOOK_SECRET   — a random string YOU choose; sent back inside a
 *                           custom field so we can confirm the call is real
 *   GROW_USE_PROD         — "true" for live, otherwise sandbox
 *
 * ⚠️ Field names below follow Grow's documented webhook shape, but EXACT
 * keys can vary by account/version. Confirm against the first real payload
 * (Grow shows received webhooks in its dashboard) and adjust if needed.
 */

export function isConfigured(): boolean {
  return !!(process.env.GROW_PAGE_CODE && process.env.GROW_API_KEY && process.env.GROW_USER_ID);
}

/**
 * Normalized view of a Grow webhook, regardless of whether Grow sent it as
 * application/x-www-form-urlencoded (the common case) or JSON.
 */
export type GrowWebhook = {
  /** Grow's transaction id / asmachta — store for reconciliation */
  transactionId?: string;
  asmachta?: string;
  /** Amount actually charged, in shekels */
  sum?: number;
  /** "1"/approved markers — Grow uses statusCode / transactionTypeId */
  statusCode?: string;
  /** Our own round-tripped data (packageId / credits / userId) */
  packageId?: string;
  credits?: number;
  userId?: string;
  /** The shared secret we planted, used to verify authenticity */
  secret?: string;
  /** Everything else, for debugging the first real payload */
  raw: Record<string, string>;
};

/**
 * Parse a Grow webhook body. Grow typically POSTs form-urlencoded with keys
 * like `data[sum]`, `data[transactionId]`, `data[customFields][cField1]`.
 * We flatten those and pull the fields we care about. Custom fields carry the
 * values we set when creating the payment page (packageId/credits/userId/secret).
 */
export function parseGrowWebhook(rawBody: string, contentType: string | null): GrowWebhook {
  const flat: Record<string, string> = {};

  if (contentType && contentType.includes("application/json")) {
    try {
      const j = JSON.parse(rawBody) as Record<string, unknown>;
      flatten(j, "", flat);
    } catch { /* fall through to empty */ }
  } else {
    // form-urlencoded
    const params = new URLSearchParams(rawBody);
    for (const [k, v] of params.entries()) flat[k] = v;
  }

  // Grow nests most fields under data[...] — accept both nested and flat.
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      if (flat[k] !== undefined) return flat[k];
      if (flat[`data[${k}]`] !== undefined) return flat[`data[${k}]`];
    }
    return undefined;
  };

  // Custom fields hold our round-tripped values. Grow exposes them as
  // data[customFields][cField1..]. We document a stable mapping below.
  const cf = (n: number) =>
    flat[`data[customFields][cField${n}]`] ?? flat[`customFields[cField${n}]`] ?? flat[`cField${n}`];

  const creditsStr = cf(2);
  return {
    transactionId: get("transactionId", "transactionToken", "processToken"),
    asmachta:      get("asmachta"),
    sum:           num(get("sum", "fullPaySum", "firstPaymentSum")),
    statusCode:    get("statusCode", "status", "transactionTypeId"),
    packageId:     cf(1),
    credits:       creditsStr ? Number(creditsStr) : undefined,
    userId:        cf(3),
    secret:        cf(4),
    raw: flat,
  };
}

/**
 * Confirm the webhook is genuinely from Grow (not an attacker faking
 * "payment success" to mint free credits).
 *
 * Layer 1 (here): match the shared secret we planted in a custom field
 * against GROW_WEBHOOK_SECRET. Cheap and blocks naive forgery.
 *
 * Layer 2 (RECOMMENDED for production, TODO): re-query Grow's API with your
 * GROW_API_KEY + transactionId to independently confirm the charge really
 * happened and for the right amount. This is the authoritative check —
 * a leaked secret alone shouldn't be enough to grant credits.
 */
export function verifyGrowWebhook(hook: GrowWebhook): boolean {
  const secret = process.env.GROW_WEBHOOK_SECRET;
  if (!secret) return false;            // not configured → never auto-credit
  return hook.secret === secret;
}

/** Grow marks an approved charge with statusCode "1" (sandbox/live may differ). */
export function isApproved(hook: GrowWebhook): boolean {
  return hook.statusCode === "1" || hook.statusCode === "2";
}

/* ── helpers ── */
function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function flatten(obj: Record<string, unknown>, prefix: string, out: Record<string, string>) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object") flatten(v as Record<string, unknown>, key, out);
    else out[key] = String(v);
  }
}
