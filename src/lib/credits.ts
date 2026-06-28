/**
 * Client-side credit balance — localStorage only (dev mode).
 *
 * Production path: this module reads/writes via `/api/credits` which
 * proxies to Supabase. Today everything is local and trivially
 * inspectable in devtools — DO NOT trust this in production.
 *
 * New users get 25 credits free on first load.
 */

const LS_KEY = "vm_credits_v1";
/** Free masters a new user gets on signup — also shown as a teaser balance to
 *  guests in the header (they can only spend them once registered). */
export const NEW_USER_GIFT = 25;

export const CREDIT_PACKAGES: ReadonlyArray<{
  id: "mini" | "starter" | "pro" | "business";
  credits: number;
  priceIls: number;
  label: string;
  /** Optional badge displayed above the card */
  highlight?: string;
  /** Grow.link permanent payment page URL for this package. Buyer reaches
   *  /buy/[pkg] (our page, collects email + writes pending_payments) and
   *  then we redirect them here. Add more as Liat creates pages in Grow. */
  payUrl?: string;
}> = [
  { id: "mini",     credits: 25,  priceIls: 10,  label: "התחלה",   payUrl: "https://pay.grow.link/NDMzNTA~a85f87a80f781ac09fb2bac7f7ef655f-MzU2MjI3OQ" },
  { id: "starter",  credits: 50,  priceIls: 25,  label: "פופולרי", highlight: "הכי נמכר",  payUrl: "https://pay.grow.link/NDMzNTA~58bbbdbdfe504b761313d10f4e1a76ee-MzU4MzMxMQ" },
  { id: "pro",      credits: 100, priceIls: 50,  label: "פרו",                            payUrl: "https://pay.grow.link/NDMzNTA~a20825dc617477fd3e758f97c76bda12-MzU4MzM0Ng" },
  { id: "business", credits: 200, priceIls: 100, label: "ביזנס",   highlight: "הכי משתלם", payUrl: "https://pay.grow.link/NDMzNTA~80015bb5753fa7b97f67cd7724559821-MzU4MzM1OA" },
];

/** Base price per mode. For `advanced_effects` this is the starting price —
 *  per-feature surcharges (calcDynamicCost) add on top, capped at 40. */
export const CREDIT_COSTS = {
  subtitles_only: 10,
  basic_effects: 20,
  podcast: 20,
  advanced_effects: 25,
  multi_video: 20,
  srt_export: 10, // download subtitles as an .srt for Premiere (no MP4 render)
} as const;

/** Hard ceiling for advanced_effects regardless of how many toggles fire. */
export const ADVANCED_EFFECTS_CAP = 40;

/** Per-feature surcharges (advanced_effects only). Subtitles-only & podcast
 *  are fixed price — their bullets are already baked into the base cost. */
const ADVANCED_FEATURE_COSTS = {
  faceZoom: 3,        // AI face detection + auto punch-zoom
  cinematicColor: 2,
  colorFilter: 2,     // any preset other than "none"
  introAnimation: 2,  // any preset other than "none"
  beatDropZoom: 2,
  particleBurst: 2,
  punchShake: 2,
  dramaMode: 2,
  bgMusic: 3,         // background music + sync
  brandLogos: 2,      // auto brand-logo overlay
} as const;

/** Live cost for a video given its mode + chosen effects. Cap-aware.
 *  Returns { base, addons, total } so the UI can show the breakdown.
 *  Liat (2026-06-11): "כל שינוי שהמשתמש עושה זה ישנה את כמו הקרדיט לסרטון".
 *  Add-ons now apply to EVERY mode — even subtitles_only — so a user who
 *  starts at 10 but adds a few effects pays for what they actually use,
 *  capped at 40. Each mode just sets the starting base. */
export function calcDynamicCost(
  mode: keyof typeof CREDIT_COSTS,
  effects: {
    zoomEffect?: string;
    cinematicColor?: boolean;
    colorFilter?: string;
    introAnimation?: string;
    beatDropZoom?: boolean;
    particleBurst?: boolean;
    punchShake?: boolean;
    dramaMode?: boolean;
    bgMusicUrl?: string;
    brandLogosDetect?: boolean;
    contextualElements?: boolean;
    cutSilence?: boolean;
  } | undefined,
): { base: number; addons: number; total: number; cap: number | null } {
  const base = CREDIT_COSTS[mode] ?? CREDIT_COSTS.subtitles_only;
  if (!effects) return { base, addons: 0, total: base, cap: ADVANCED_EFFECTS_CAP };

  // Add-ons that come "for free" because they're part of the mode's
  // bullet list (e.g. podcast pays 20 for silence-cut + emoji + intro etc
  // already; advanced pays 25 for face-zoom + auto-detect etc.). For those
  // we don't double-charge.
  const includedInBase: Partial<Record<keyof typeof ADVANCED_FEATURE_COSTS, boolean>> = {};
  if (mode === "podcast" || mode === "advanced_effects") {
    includedInBase.cinematicColor = true;
    includedInBase.introAnimation = true;
    includedInBase.brandLogos = true;
  }
  if (mode === "advanced_effects") {
    includedInBase.faceZoom = true;
  }

  let addons = 0;
  if (effects.zoomEffect && effects.zoomEffect !== "none" && !includedInBase.faceZoom)
    addons += ADVANCED_FEATURE_COSTS.faceZoom;
  if (effects.cinematicColor && !includedInBase.cinematicColor)
    addons += ADVANCED_FEATURE_COSTS.cinematicColor;
  if (effects.colorFilter && effects.colorFilter !== "none")
    addons += ADVANCED_FEATURE_COSTS.colorFilter;
  if (effects.introAnimation && effects.introAnimation !== "none" && !includedInBase.introAnimation)
    addons += ADVANCED_FEATURE_COSTS.introAnimation;
  if (effects.beatDropZoom)   addons += ADVANCED_FEATURE_COSTS.beatDropZoom;
  if (effects.particleBurst)  addons += ADVANCED_FEATURE_COSTS.particleBurst;
  if (effects.punchShake)     addons += ADVANCED_FEATURE_COSTS.punchShake;
  if (effects.dramaMode)      addons += ADVANCED_FEATURE_COSTS.dramaMode;
  if (effects.bgMusicUrl)     addons += ADVANCED_FEATURE_COSTS.bgMusic;
  if (effects.brandLogosDetect && !includedInBase.brandLogos)
    addons += ADVANCED_FEATURE_COSTS.brandLogos;

  const total = Math.min(ADVANCED_EFFECTS_CAP, base + addons);
  return { base, addons, total, cap: ADVANCED_EFFECTS_CAP };
}

export function getCredits(): number {
  if (typeof window === "undefined") return NEW_USER_GIFT;
  const v = localStorage.getItem(LS_KEY);
  if (v === null) {
    localStorage.setItem(LS_KEY, String(NEW_USER_GIFT));
    return NEW_USER_GIFT;
  }
  return parseInt(v) || 0;
}
export function setCredits(n: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, String(Math.max(0, n)));
  window.dispatchEvent(new Event("credits-change"));
}
export function addCredits(n: number) {
  setCredits(getCredits() + n);
}
export function canSpend(n: number) {
  return getCredits() >= n;
}
export function spend(n: number): boolean {
  if (!canSpend(n)) return false;
  setCredits(getCredits() - n);
  return true;
}
