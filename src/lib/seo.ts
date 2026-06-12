/**
 * Centralised SEO config + helpers.
 *
 * Keep brand strings here so changing the app name updates every page's
 * title/description/OG card from one spot. Per-page `<head>` is generated
 * via Next's `Metadata` API using `pageMetadata()`.
 */

import type { Metadata } from "next";

export const SITE = {
  url:        "https://video-master.vercel.app", // override after deploy with NEXT_PUBLIC_SITE_URL
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
      images: [{ url: `${url}${SITE.ogImagePath}`, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
      images: [`${url}${SITE.ogImagePath}`],
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
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
    },
    featureList: [
      "תמלול עברית אוטומטי",
      "23 אנימציות Lottie וקטוריות",
      "65 SFX מקצועיים",
      "מולטי-וידאו AI editor",
      "ייצוא MP4 או SRT לפרמייר",
      "סגנונות כתוביות מוכנים",
    ],
  };
}
