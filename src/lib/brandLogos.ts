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

  for (const sub of subtitles) {
    if (!sub.text.trim()) continue;

    for (const brand of BRAND_LOGOS) {
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
 * Returns the simpleicons.org CDN URL for a brand's logo SVG.
 */
export function brandLogoCdnUrl(brand: BrandLogo): string {
  return `https://cdn.simpleicons.org/${brand.slug}/${brand.color}`;
}
