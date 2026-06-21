/**
 * Centralised SEO config + helpers.
 *
 * Keep brand strings here so changing the app name updates every page's
 * title/description/OG card from one spot. Per-page `<head>` is generated
 * via Next's `Metadata` API using `pageMetadata()`.
 */

import type { Metadata } from "next";

export const SITE = {
  url:        "https://master-video.co.il", // override with NEXT_PUBLIC_SITE_URL if needed
  name:       "Master Video — מאסטר וידאו",
  tagline:    "עריכת וידאו חכמה מבוססת AI · פיתוח ישראלי",
  description:
    "אפליקציה חינמית לתמלול עברית מקצועי, עיצוב כתוביות לרילס וטיקטוק, " +
    "ייצוא MP4 מוכן לעלייה. AI אוטומטי לעריכת סרטונים בעברית.",
  locale:     "he_IL",
  language:   "he",
  ogImagePath: "/og-image.png",
} as const;

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
}

/**
 * Build Next.js metadata for a specific page.
 *   export const metadata = pageMetadata({
 *     title: "פאנל ניהול",
 *     description: "ניהול משתמשים, קרדיט, ותוכן",
 *     path: "/admin",
 *   });
 */
export function pageMetadata(opts: {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
}): Metadata {
  const url = getSiteUrl();
  const fullTitle = opts.title ? `${opts.title} · ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
  const desc = opts.description ?? SITE.description;
  const canonical = opts.path ? `${url}${opts.path}` : url;

  return {
    title: fullTitle,
    description: desc,
    alternates: { canonical, languages: { "he-IL": canonical } },
    robots: opts.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE.name,
      title: fullTitle,
      description: desc,
      locale: SITE.locale,
      // OG image comes from src/app/opengraph-image.tsx (generated 1200×630
      // card) via Next's file convention — no static /og-image.png needed.
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
    },
    formatDetection: { telephone: false, email: false, address: false },
    // No explicit icons override — Next.js auto-discovers src/app/icon.png
    // and src/app/apple-icon.png. Override here would BLOCK auto-detection.
  };
}

/**
 * JSON-LD structured data for the homepage. Tells Google "this is a
 * SoftwareApplication that does video subtitle editing in Hebrew."
 * Gets us into rich-result panels.
 */
export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    description: SITE.description,
    url: getSiteUrl(),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    inLanguage: "he",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "ILS",
      description: "25 קרדיט מתנה למשתמש חדש",
    },
    featureList: [
      "תמלול עברית אוטומטי",
      "אמוג'ים, לוגו מותגים ואפקטים ויראליים",
      "65 SFX מקצועיים",
      "מולטי-וידאו AI editor",
      "ייצוא MP4 או SRT לפרמייר",
      "סגנונות כתוביות מוכנים",
    ],
  };
}
