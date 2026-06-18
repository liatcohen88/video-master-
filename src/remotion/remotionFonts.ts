/**
 * Load the SAME Google Fonts the live preview uses (via next/font) into the
 * Remotion render. Without this, headless Chromium has no Hebrew web-font
 * and falls back to a thin system font — the exported subtitle looked
 * thinner/different from the bold preview. @remotion/google-fonts pulls
 * from the same Google source next/font does, so weights + metrics match
 * 1:1. loadFont() registers a FontFace and holds delayRender() until the
 * woff2 is fetched, so frames don't render before the font is ready.
 *
 * Templates expose Heebo / Rubik / Assistant as subtitle fonts. We load
 * the weights subtitles actually use (regular + bolds) for hebrew+latin
 * ("no way"/"omg" etc. need latin). Fonts cache after the first render.
 */
import { loadFont as loadRubik } from "@remotion/google-fonts/Rubik";
import { loadFont as loadHeebo } from "@remotion/google-fonts/Heebo";
import { loadFont as loadAssistant } from "@remotion/google-fonts/Assistant";

// Each font's loadFont() narrows weights/subsets to its own literal union,
// so a shared const object won't satisfy all three. Build per-call and let
// each loadFont validate; the values are valid for all three fonts.
const weights = ["400", "700", "800", "900"];
const subsets = ["hebrew", "latin"];

const rubik = loadRubik("normal", {
  weights: weights as ("400" | "700" | "800" | "900")[],
  subsets: subsets as ("hebrew" | "latin")[],
  ignoreTooManyRequestsWarning: true,
});
const heebo = loadHeebo("normal", {
  weights: weights as ("400" | "700" | "800" | "900")[],
  subsets: subsets as ("hebrew" | "latin")[],
  ignoreTooManyRequestsWarning: true,
});
const assistant = loadAssistant("normal", {
  // Assistant tops out at 800 (no 900 weight available).
  weights: ["400", "700", "800"] as ("400" | "700" | "800")[],
  subsets: subsets as ("hebrew" | "latin")[],
  ignoreTooManyRequestsWarning: true,
});

const FAMILY: Record<string, string> = {
  Rubik: rubik.fontFamily,
  Heebo: heebo.fontFamily,
  Assistant: assistant.fontFamily,
};

/** Map a template font name to the loaded family, with a sane fallback. */
export function resolveRemotionFont(name: string | undefined): string {
  if (!name) return `${heebo.fontFamily}, sans-serif`;
  return FAMILY[name] ? `${FAMILY[name]}, sans-serif` : `${name}, ${heebo.fontFamily}, sans-serif`;
}
