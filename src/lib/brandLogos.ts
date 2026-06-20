/**
 * Brand recognition — when the speaker mentions a known brand, overlay its
 * logo on the video. Same detection runs in live preview and in the final
 * export pipeline.
 *
 * Logo source: simpleicons.org CDN (free, no API key required).
 *   URL pattern: https://cdn.simpleicons.org/<slug>/<hex_color_no_hash>
 *
 * IMPORTANT — Hebrew regex: JavaScript's \b (word boundary) is ASCII-only and
 * does NOT recognize Hebrew letter boundaries. A pattern like /\bאינסטגרם\b/
 * will FAIL TO MATCH "אמרתי על אינסטגרם שזה" because the boundaries between
 * a space and a Hebrew letter are not considered word boundaries by \b.
 *
 * Solution: omit \b entirely for Hebrew brands and rely on the distinctiveness
 * of brand names. For English patterns we still use \b since it works for
 * ASCII letters.
 */

import type { Subtitle } from "./types";
import { heWord } from "./hebrewRegex";
import { getContent } from "./contentStore";

export type BrandLogo = {
  id: string;
  /** Display name (Hebrew preferred) */
  name: string;
  /** simpleicons.org slug — also used as CDN path */
  slug: string;
  /** Brand color (no #), used for SVG tint and badge fallback */
  color: string;
  /** Detection patterns — Hebrew (no \b) + English (\b OK) variants */
  patterns: RegExp[];
};

// All Hebrew patterns use heWord() for proper word boundaries.
// English patterns use \b (works fine for ASCII).
export const BRAND_LOGOS: BrandLogo[] = [
  {
    id: "aliexpress",
    name: "AliExpress",
    slug: "aliexpress",
    color: "E62E04",
    patterns: [
      heWord("אליאקספרס"), heWord("אלי\\s*אקספרס"),
      /\baliexpress\b/i, /\bali\s*express\b/i,
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    slug: "amazon",
    color: "FF9900",
    patterns: [heWord("אמזון"), /\bamazon\b/i],
  },
  {
    id: "apple",
    name: "Apple",
    slug: "apple",
    color: "FFFFFF",
    patterns: [
      heWord("אפל"), heWord("אייפון"), heWord("אייפד"), heWord("מקבוק"),
      /\bapple\b/i, /\biphone\b/i, /\bipad\b/i, /\bmac\s*book\b/i,
    ],
  },
  {
    id: "google",
    name: "Google",
    slug: "google",
    color: "4285F4",
    patterns: [
      heWord("גוגל"), heWord("גימייל"), heWord("כרום"),
      /\bgoogle\b/i, /\bgmail\b/i, /\bchrome\b/i,
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    slug: "facebook",
    color: "1877F2",
    patterns: [
      // Whisper transcribes "Facebook" multiple ways in Hebrew: double-yod
      // "פייסבוק", single-yod "פיסבוק", and even no-yod "פסבוק". We list
      // every common spelling so the logo always fires.
      heWord("פייסבוק"), heWord("פייסבוקי"), heWord("פיסבוק"),
      heWord("פסבוק"), heWord("מטא"),
      /\bfacebook\b/i, /\bfb\b/i, /\bmeta\b/i,
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    slug: "instagram",
    color: "E4405F",
    patterns: [
      // Whisper alt spellings: אינסטגרם / אינסטרגם / אינסטה / אינסטא
      heWord("אינסטגרם"), heWord("אינסטרגם"), heWord("אינסטה"), heWord("אינסטא"),
      heWord("רילס"), heWord("רילסים"),
      /\binstagram\b/i, /\binsta\b/i, /\breels?\b/i,
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    slug: "tiktok",
    color: "000000",
    patterns: [
      // טיקטוק / טיק-טוק / טיק טוק / טיקטוקי
      heWord("טיקטוק"), heWord("טיקטוקי"),
      /\btiktok\b/i, /\btik\s*tok\b/i,
      /טיק[\s\-]*טוק/u,
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    slug: "youtube",
    color: "FF0000",
    patterns: [
      heWord("יוטיוב"), heWord("שורטס"),
      /\byoutube\b/i, /\byt\b/i, /\byou\s*tube\b/i, /\bshorts\b/i,
    ],
  },
  {
    id: "samsung",
    name: "Samsung",
    slug: "samsung",
    color: "1428A0",
    patterns: [heWord("סמסונג"), heWord("גלקסי"), /\bsamsung\b/i, /\bgalaxy\b/i],
  },
  {
    id: "netflix",
    name: "Netflix",
    slug: "netflix",
    color: "E50914",
    patterns: [heWord("נטפליקס"), /\bnetflix\b/i],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    slug: "whatsapp",
    color: "25D366",
    patterns: [
      heWord("וואטסאפ"), heWord("וואצאפ"), heWord("ווצאפ"),
      /\bwhatsapp\b/i, /\bwhats?\s*app\b/i,
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    slug: "spotify",
    color: "1ED760",
    patterns: [heWord("ספוטיפי"), heWord("ספוטיפיי"), /\bspotify\b/i],
  },
  {
    id: "tesla",
    name: "Tesla",
    slug: "tesla",
    color: "CC0000",
    patterns: [
      heWord("טסלה"), heWord("אלון\\s*מאסק"), heWord("מאסק"),
      /\btesla\b/i, /\belon\b/i,
    ],
  },
  {
    id: "openai",
    name: "ChatGPT",
    slug: "openai",
    color: "10A37F",
    patterns: [
      heWord("צ'אט\\s*ג'פיטי"), heWord("ג'פיטי"),
      /\bchat\s*gpt\b/i, /\bopenai\b/i, /\bgpt\b/i,
    ],
  },
  {
    id: "anthropic",
    name: "Claude",
    slug: "anthropic",
    color: "D97757",
    patterns: [
      heWord("קלוד"), heWord("אנת'רופיק"),
      /\bclaude\b/i, /\banthropic\b/i,
    ],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    slug: "x",
    color: "000000",
    patterns: [heWord("טוויטר"), heWord("טויטר"), /\btwitter\b/i],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    slug: "linkedin",
    color: "0A66C2",
    patterns: [
      heWord("לינקדאין"), heWord("לינקדין"),
      /\blinkedin\b/i, /\blinked\s*in\b/i,
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    slug: "shopify",
    color: "7AB55C",
    patterns: [heWord("שופיפי"), heWord("שופיפיי"), heWord("שופיף"), /\bshopify\b/i],
  },
  {
    id: "paypal",
    name: "PayPal",
    slug: "paypal",
    color: "00457C",
    patterns: [heWord("פייפאל"), heWord("פייפל"), /\bpaypal\b/i, /\bpay\s*pal\b/i],
  },
  {
    id: "uber",
    name: "Uber",
    slug: "uber",
    color: "000000",
    patterns: [heWord("אובר"), /\buber\b/i],
  },
  {
    id: "airbnb",
    name: "Airbnb",
    slug: "airbnb",
    color: "FF5A5F",
    patterns: [
      heWord("איירבי\\s*אנבי"), heWord("איירבנבי"),
      /\bairbnb\b/i, /\bair\s*bnb\b/i,
    ],
  },
];

/**
 * Resolve the EFFECTIVE brand list — applies CMS overrides on top of the
 * built-in BRAND_LOGOS. Admin controls:
 *   - brands.hidden:        string[]  — IDs to skip in detection + glossary
 *   - brands.nameOverrides: Record<id, string> — change Hebrew label
 *   - brands.custom:        BrandLogo-like[] — add new brands with plain
 *                           word patterns (wrapped to RegExp here)
 *
 * Custom brands' `patterns` arrive as plain strings from the admin's array
 * editor. We wrap Hebrew tokens with `heWord` and English tokens with `\b`.
 */
export function resolveBrandLogos(): BrandLogo[] {
  const hidden = new Set((getContent("brands.hidden") as string[]) ?? []);
  const nameOv = (getContent("brands.nameOverrides") as Record<string, string>) ?? {};
  const custom = (getContent("brands.custom") as Array<{
    id: string; name: string; slug: string; color: string; patterns: string[];
  }>) ?? [];

  const base = BRAND_LOGOS
    .filter((b) => !hidden.has(b.id))
    .map((b) => nameOv[b.id] ? { ...b, name: nameOv[b.id] } : b);

  const extras: BrandLogo[] = custom
    .filter((c) => c && c.id && c.slug && Array.isArray(c.patterns))
    .filter((c) => !hidden.has(c.id))
    .map((c) => ({
      id: c.id,
      name: nameOv[c.id] ?? c.name ?? c.id,
      slug: c.slug,
      color: (c.color ?? "111111").replace(/^#/, ""),
      patterns: c.patterns.map((word) => {
        const w = String(word).trim();
        if (!w) return /^_no_match_$/;
        // Hebrew detection: any Hebrew letter present → use heWord
        return /[֐-׿]/.test(w)
          ? heWord(w)
          : new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      }),
    }));

  return [...base, ...extras];
}

/**
 * Look up a single brand by id (built-in OR admin-custom). Used by the
 * per-subtitle "מותגים" picker tab — the user picks a brand and we attach
 * its id to the subtitle, then resolve it back here at render time.
 */
export function getBrandById(id: string): BrandLogo | undefined {
  return resolveBrandLogos().find((b) => b.id === id);
}

export type BrandEvent = {
  /** Time in OUTPUT timeline (seconds) */
  time: number;
  durationSec: number;
  brand: BrandLogo;
  matchedText: string;
};

/**
 * Find brand mentions across subtitles. De-duplicates same brand within 4s.
 */
export function detectBrands(subtitles: Subtitle[]): BrandEvent[] {
  const events: BrandEvent[] = [];
  const brands = resolveBrandLogos();

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;

    for (const brand of brands) {
      for (const pat of brand.patterns) {
        const m = sub.text.match(pat);
        if (!m) continue;

        const matchIdx = sub.text.indexOf(m[0]);
        const ratio = sub.text.length > 0 ? matchIdx / sub.text.length : 0;
        const subDur = sub.end - sub.start;
        let time = sub.start + ratio * subDur;

        // Word-level refinement: find the word whose text overlaps the match
        if (sub.words) {
          const cleanMatch = m[0].toLowerCase().trim();
          const wordHit = sub.words.find((w) => {
            const wLow = w.word.toLowerCase();
            return wLow.includes(cleanMatch) || cleanMatch.includes(wLow);
          });
          if (wordHit) time = wordHit.start;
        }

        // De-dupe same brand within 4 seconds
        const recent = events.find(
          (e) => e.brand.id === brand.id && Math.abs(e.time - time) < 4,
        );
        if (recent) continue;

        events.push({
          time,
          durationSec: 1.4,
          brand,
          matchedText: m[0],
        });
        break;
      }
    }
  }

  return events.sort((a, b) => a.time - b.time);
}

/**
 * Returns a colored SVG URL for a brand's logo.
 *
 * Source: Iconify API serving the simple-icons collection. We switched
 * AWAY from cdn.simpleicons.org because it started returning 404 for
 * trademark-sensitive brands (Amazon, OpenAI, LinkedIn) — Liat noticed
 * empty squares in the admin brand-logos panel. Iconify mirrors the
 * full simple-icons catalogue and serves all of them with a
 * `?color=#hex` query so the brand color still applies.
 */
export function brandLogoCdnUrl(brand: BrandLogo): string {
  return `https://api.iconify.design/simple-icons:${brand.slug}.svg?color=%23${brand.color}`;
}
