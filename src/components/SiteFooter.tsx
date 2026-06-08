"use client";

import { useContent } from "@/lib/useContent";

/**
 * Global footer rendered at the bottom of every page. Text is editable
 * via the admin CMS (/admin → תוכן → כותרת תחתונה).
 */
export default function SiteFooter() {
  const text = useContent("footer.text");
  return (
    <footer
      dir="rtl"
      className="w-full text-center text-xs text-white/30 py-6 mt-12 border-t border-white/5"
    >
      {text}
    </footer>
  );
}
