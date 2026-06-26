/**
 * Best-effort WhatsApp alert to the admin (Liat) when a new payment lands, via
 * CallMeBot (a free WhatsApp relay). Liat: "אקבל התראה על כל תשלום שנכנס אליי".
 *
 * Gated on env so it's a complete no-op until the key is set — wire it by
 * adding to Coolify env, then redeploy:
 *   CALLMEBOT_PHONE   — the admin's number in intl form, e.g. 972535372699
 *   CALLMEBOT_APIKEY  — the key CallMeBot returns after the one-time activation
 *
 * PRIVACY: the text passes through CallMeBot's third-party servers, so we send
 * ONLY the amount + package + credits — never the customer's name or email.
 * Full details live in the admin "הכנסות" tab.
 *
 * Never throws — an alert failure must not affect payment fulfillment.
 */
export async function notifyAdminPayment(opts: {
  amountIls: number;
  credits: number;
  packageId?: string;
}): Promise<void> {
  try {
    const phone = process.env.CALLMEBOT_PHONE;
    const apikey = process.env.CALLMEBOT_APIKEY;
    if (!phone || !apikey) return; // not configured yet → no-op

    const pkg = opts.packageId ? ` · ${opts.packageId}` : "";
    const text = `💰 תשלום חדש ב-Master Video!\n${opts.amountIls}₪ · ${opts.credits} מאסטרים${pkg}`;
    const url =
      `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
      `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;

    // Short timeout so a slow/down CallMeBot can never hang the webhook.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    await fetch(url, { signal: ctrl.signal }).catch(() => {});
    clearTimeout(t);
  } catch {
    /* never let an alert break fulfillment */
  }
}
