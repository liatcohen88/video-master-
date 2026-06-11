"use client";

import { useContent } from "./useContent";
import { LOTTIE_ICONS, type LottieIcon } from "./lottieRegistry";

/**
 * Returns the merged Lottie list = built-in registry + admin custom uploads,
 * with hidden ones filtered out and rename/recolor overrides applied.
 *
 * The raw registry (`LOTTIE_ICONS`) stays the source of truth for runtime
 * rendering and AI-pick keyword patterns. This hook is what the *picker UI*
 * should consume — so Liat's admin choices (hide / rename / recolor /
 * upload) reflect immediately without touching code.
 *
 * Old videos that already reference a hidden iconId keep rendering: we only
 * filter the gallery the user picks NEW icons from.
 */
export function useEffectiveLotties(): LottieIcon[] {
  const hidden = useContent("lottie.hidden") as Record<string, true>;
  const names  = useContent("lottie.names")  as Record<string, string>;
  const colors = useContent("lottie.colors") as Record<string, string>;
  const custom = useContent("lottie.custom") as Array<{
    id: string; name: string; jsonPath: string; defaultColor?: string;
  }>;

  const customAsIcons: LottieIcon[] = (custom ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    jsonPath: c.jsonPath,
    patterns: [], // user-uploaded → no AI keyword auto-pick
    defaultColor: c.defaultColor,
  }));

  return [...LOTTIE_ICONS, ...customAsIcons]
    .filter((i) => !hidden?.[i.id])
    .map((i) => ({
      ...i,
      name: names?.[i.id] ?? i.name,
      defaultColor: colors?.[i.id] ?? i.defaultColor,
    }));
}
