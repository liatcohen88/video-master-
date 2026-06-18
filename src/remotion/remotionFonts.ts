/**
 * Load EVERY subtitle font the template picker offers, into the Remotion
 * render — same Google source the live preview uses via next/font, so the
 * exported text matches the preview's family + weight + metrics 1:1.
 *
 * The picker exposes 8 Hebrew families. Previously only 3 were loaded, so
 * picking e.g. "Varela Round" fell back to a thin system font in the export.
 *
 * Each font is loaded only with weights it actually publishes (single-weight
 * display fonts like Secular One / Suez One / Varela Round / Bellefair only
 * have 400 — requesting a missing weight throws). loadFont() holds
 * delayRender() until the woff2 is fetched, so no frame renders unfonted.
 */
import { loadFont as loadHeebo } from "@remotion/google-fonts/Heebo";
import { loadFont as loadRubik } from "@remotion/google-fonts/Rubik";
import { loadFont as loadAssistant } from "@remotion/google-fonts/Assistant";
import { loadFont as loadVarelaRound } from "@remotion/google-fonts/VarelaRound";
import { loadFont as loadSecularOne } from "@remotion/google-fonts/SecularOne";
import { loadFont as loadSuezOne } from "@remotion/google-fonts/SuezOne";
import { loadFont as loadFrankRuhl } from "@remotion/google-fonts/FrankRuhlLibre";
import { loadFont as loadBellefair } from "@remotion/google-fonts/Bellefair";

const HE = ["hebrew", "latin"];
const common = { subsets: HE, ignoreTooManyRequestsWarning: true } as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const heebo     = loadHeebo("normal",     { weights: ["400", "700", "800", "900"], ...common } as any);
const rubik     = loadRubik("normal",     { weights: ["400", "700", "800", "900"], ...common } as any);
const assistant = loadAssistant("normal", { weights: ["400", "700", "800"], ...common } as any);
const varela    = loadVarelaRound("normal", { weights: ["400"], ...common } as any);
const secular   = loadSecularOne("normal",  { weights: ["400"], ...common } as any);
const suez      = loadSuezOne("normal",      { weights: ["400"], ...common } as any);
const frank     = loadFrankRuhl("normal",    { weights: ["400", "700", "900"], ...common } as any);
// Bellefair is latin-only (no hebrew subset) — request latin to avoid throw.
const bellefair = loadBellefair("normal",    { weights: ["400"], subsets: ["latin"], ignoreTooManyRequestsWarning: true } as any);
/* eslint-enable @typescript-eslint/no-explicit-any */

// Map every template display-name → the actual loaded family string.
const FAMILY: Record<string, string> = {
  "Heebo": heebo.fontFamily,
  "Rubik": rubik.fontFamily,
  "Assistant": assistant.fontFamily,
  "Varela Round": varela.fontFamily,
  "Secular One": secular.fontFamily,
  "Suez One": suez.fontFamily,
  "Frank Ruhl Libre": frank.fontFamily,
  "Bellefair": bellefair.fontFamily,
};

/** Resolve a template font name to the loaded family, Heebo fallback. */
export function resolveRemotionFont(name: string | undefined): string {
  if (!name) return `${heebo.fontFamily}, sans-serif`;
  const fam = FAMILY[name];
  return fam ? `"${fam}", sans-serif` : `"${name}", "${heebo.fontFamily}", sans-serif`;
}
