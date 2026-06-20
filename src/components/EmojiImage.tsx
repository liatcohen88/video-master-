"use client";

import { appleEmojiUrl, twemojiUrl } from "@/lib/twemoji";

/**
 * Renders an emoji as an Apple-style image (emoji-datasource-apple) with a
 * Twemoji fallback if the glyph is missing — so editor chips match the
 * preview + export exactly, instead of the host OS font (Liat: "באלי אמוגים
 * של אפל"). Used wherever a raw emoji char would otherwise render.
 */
export default function EmojiImage({
  emoji, size = 20, className,
}: { emoji: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={appleEmojiUrl(emoji)}
      alt={emoji}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "middle" }}
      onError={(ev) => {
        const img = ev.currentTarget;
        if (img.dataset.fb !== "1") { img.dataset.fb = "1"; img.src = twemojiUrl(emoji); }
      }}
    />
  );
}
