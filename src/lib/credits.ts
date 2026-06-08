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
const NEW_USER_GIFT = 25;

export const CREDIT_PACKAGES: ReadonlyArray<{
  id: "mini" | "starter" | "pro" | "business";
  credits: number;
  priceIls: number;
  label: string;
  /** Optional badge displayed above the card */
  highlight?: string;
}> = [
  { id: "mini",     credits: 25,  priceIls: 10,                                  label: "התחלה" },
  { id: "starter",  credits: 50,  priceIls: 25,                                  label: "פופולרי", highlight: "הכי נמכר" },
  { id: "pro",      credits: 100, priceIls: 50,                                  label: "פרו" },
  { id: "business", credits: 200, priceIls: 100,                                 label: "ביזנס",  highlight: "הכי משתלם" },
];

export const CREDIT_COSTS = {
  subtitles_only: 10,
  basic_effects: 20,
  podcast: 20,
  advanced_effects: 40,
  multi_video: 30,
} as const;

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
