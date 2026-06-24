import type { Metadata, Viewport } from "next";
import { Heebo, Rubik, Assistant, Varela_Round, Secular_One, Suez_One, Frank_Ruhl_Libre, Bellefair } from "next/font/google";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import Toaster from "@/components/Toaster";
import OnboardingSplash from "@/components/OnboardingSplash";
import SfxCustomLoader from "@/components/SfxCustomLoader";
import ConfirmDialogRoot from "@/components/ConfirmDialog";
import AnimatedBackground from "@/components/AnimatedBackground";
import AccessibilityPanel from "@/components/AccessibilityPanel";
import ExportJobBadge from "@/components/ExportJobBadge";
import PresenceBeacon from "@/components/PresenceBeacon";
import { pageMetadata, softwareJsonLd, getSiteUrl } from "@/lib/seo";
import { loadOverridesServer } from "@/lib/contentStoreServer";
import ContentProvider from "@/lib/ContentProvider";
import type { Content } from "@/lib/contentStore";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });
const assistant = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-assistant", display: "swap" });
const varela = Varela_Round({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-varela", display: "swap" });
const secular = Secular_One({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-secular", display: "swap" });
const suez = Suez_One({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-suez", display: "swap" });
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], variable: "--font-frank", display: "swap" });
const bellefair = Bellefair({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-bellefair", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  ...pageMetadata({}),
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = `${heebo.variable} ${rubik.variable} ${assistant.variable} ${varela.variable} ${secular.variable} ${suez.variable} ${frank.variable} ${bellefair.variable}`;
  // SSR the CMS overrides into window.__CMS_OVERRIDES__ so the very first
  // render already has Liat's edited copy. Without this, useContent() reads
  // from localStorage which is empty on first visit → defaults flash for
  // ~1.5s until hydrateFromCloud() finishes its fetch.
  const overrides = (await loadOverridesServer()) as Content;
  const overridesJson = JSON.stringify(overrides).replace(/</g, "\\u003c");
  // Google Analytics 4 — Master Video property. Override via env if needed.
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-XWDE4DZRS8";
  // Microsoft Clarity — session recordings + heatmaps. Override via env if needed.
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID || "xc3q3bqbf1";
  return (
    <html lang="he" dir="rtl" className={fontVars}>
      <head>
        {/* JSON-LD structured data — tells Google what this app IS */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd()) }}
        />
        {/* Google Analytics 4 (gtag.js) */}
        {gaId && (
          <>
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        )}
        {/* Microsoft Clarity — session recordings + heatmaps */}
        {clarityId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`,
            }}
          />
        )}
        {/* Inline CMS overrides BEFORE any client component mounts — kills
            the first-paint flash of default copy. contentStore reads this. */}
        <script
          dangerouslySetInnerHTML={{ __html: `window.__CMS_OVERRIDES__=${overridesJson};` }}
        />
      </head>
      <body className="font-sans antialiased">
        <ContentProvider initial={overrides}>
          <AnimatedBackground />
          {children}
          <SiteFooter />
          <Toaster />
          {/* Global background-export badge — shows the rendering progress +
              save/download on EVERY page (was imported but never mounted, so
              it appeared nowhere — Liat: "הייצוא ברקע נעלם לגמרי במובייל"). */}
          <ExportJobBadge />
          <PresenceBeacon />
          <OnboardingSplash />
          <ConfirmDialogRoot />
          <SfxCustomLoader />
          <AccessibilityPanel />
        </ContentProvider>
      </body>
    </html>
  );
}
