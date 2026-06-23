/**
 * robots.txt — tells crawlers what to index.
 * Auto-served at /robots.txt by Next.js.
 */

import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",      // private admin panel
          "/api/",       // never index API
          "/dashboard",  // user-specific
          "/account",    // private user settings
          "/buy",        // transactional checkout
          "/credits/success", // post-payment confirmation
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl(),
  };
}
