"use client";

import { useContent } from "@/lib/useContent";

/**
 * Floating WhatsApp bubble — a fixed button (bottom-right) that opens a direct
 * WhatsApp chat to the support number so messages reach Liat's phone. Liat:
 * "בועת ווצאפ ישר מגיע אליי".
 *
 * Position: bottom-RIGHT. The accessibility launcher lives bottom-left and the
 * export badge bottom-center, so the right corner is free (and it's the global
 * convention for chat widgets).
 *
 * CMS-editable (no deploy needed):
 *   - footer.contactPhone   → the destination number (shared with /contact)
 *   - whatsapp.bubbleEnabled → "0" hides the bubble
 *   - whatsapp.bubbleText    → the message pre-filled in the user's WhatsApp
 *   - whatsapp.bubbleLabel   → the hover label text
 */
export default function WhatsAppBubble() {
  const enabled = String(useContent("whatsapp.bubbleEnabled") ?? "1") !== "0";
  const phone   = (useContent("footer.contactPhone") as string) || "";
  const text    = (useContent("whatsapp.bubbleText") as string) || "";
  const label   = (useContent("whatsapp.bubbleLabel") as string) || "דברו איתנו";

  if (!enabled) return null;

  // Build a wa.me link: strip non-digits, prefix Israel's 972 (drop leading 0).
  const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
  if (digits.length < 8) return null;
  const href = `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="rtl"
      aria-label={`${label} — וואטסאפ`}
      title={label}
      className="group fixed bottom-4 right-4 z-[60] flex items-center gap-2"
    >
      {/* Hover label (desktop) — slides out from the button */}
      <span className="hidden md:inline-block max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-[#075E54] text-white text-sm font-bold px-0 py-2 opacity-0 transition-all duration-300 group-hover:max-w-[160px] group-hover:px-4 group-hover:opacity-100 shadow-lg">
        {label}
      </span>

      <span className="relative flex items-center justify-center">
        {/* Pulsing ring to draw the eye */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-wa-ping" />
        {/* The button */}
        <span className="relative w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] flex items-center justify-center shadow-xl shadow-[#25D366]/40 transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <svg viewBox="0 0 32 32" className="w-8 h-8" fill="white" aria-hidden="true">
            <path d="M16.004 5.333c-5.882 0-10.667 4.785-10.667 10.667 0 1.88.49 3.71 1.423 5.33L5.333 26.667l5.49-1.41a10.62 10.62 0 0 0 5.18 1.32h.004c5.882 0 10.667-4.785 10.667-10.667 0-2.85-1.11-5.53-3.126-7.546a10.6 10.6 0 0 0-7.544-3.031zm0 19.2h-.003a8.84 8.84 0 0 1-4.503-1.233l-.323-.192-3.258.838.87-3.175-.21-.326a8.82 8.82 0 0 1-1.353-4.69c0-4.884 3.974-8.858 8.862-8.858a8.8 8.8 0 0 1 6.262 2.596 8.8 8.8 0 0 1 2.594 6.266c0 4.885-3.974 8.858-8.86 8.858zm4.857-6.634c-.266-.133-1.575-.777-1.819-.866-.244-.089-.422-.133-.6.134-.177.266-.687.866-.842 1.043-.155.178-.31.2-.577.067-.266-.134-1.124-.414-2.141-1.32-.792-.706-1.326-1.578-1.481-1.844-.155-.267-.017-.41.117-.543.12-.12.266-.31.4-.466.133-.155.177-.266.266-.444.089-.178.044-.333-.022-.466-.067-.134-.6-1.446-.822-1.98-.216-.519-.436-.448-.6-.456l-.51-.01a.98.98 0 0 0-.71.333c-.244.266-.932.91-.932 2.222s.954 2.578 1.087 2.756c.133.178 1.878 2.867 4.551 4.022.636.274 1.132.438 1.519.561.638.203 1.219.174 1.678.106.512-.077 1.575-.644 1.797-1.266.222-.622.222-1.155.155-1.266-.066-.111-.244-.178-.51-.311z" />
          </svg>
        </span>
      </span>

      <style jsx>{`
        @keyframes wa-ping {
          0%   { transform: scale(1);    opacity: 0.55; }
          70%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        .animate-wa-ping { animation: wa-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>
    </a>
  );
}
