"use client";

import { useEffect } from "react";
import { getContent } from "@/lib/contentStore";
import { registerCustomSfx } from "@/lib/sfxLibrary";

/**
 * Invisible bridge: reads admin-uploaded sounds from CMS ("sfx.custom") and
 * registers them into the SFX library so every picker/preview/export sees
 * them. Re-registers whenever the admin adds/removes one (content-change).
 * Mounted once in the root layout.
 */
export default function SfxCustomLoader() {
  useEffect(() => {
    const sync = () => {
      try {
        const list = getContent("sfx.custom") as Array<{ id: string; label: string; category: string; url: string }>;
        registerCustomSfx(Array.isArray(list) ? list : []);
      } catch { /* CMS unreadable — skip */ }
    };
    sync();
    window.addEventListener("content-change", sync);
    return () => window.removeEventListener("content-change", sync);
  }, []);
  return null;
}
