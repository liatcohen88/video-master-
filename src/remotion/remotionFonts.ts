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

const OPTS = {
  weights: ["400", "700", "800", "900"],
  subsets: ["hebrew", "latin"],
  ignoreTooManyRequestsWarning: true,
} as const;

const rubik = loadRubik("normal", OPTS);
const heebo = loadHeebo("normal", OPTS);
const assistant = loadAssistant("normal", OPTS);

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
