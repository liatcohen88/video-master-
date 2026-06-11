import type { Metadata, Viewport } from "next";
import { Heebo, Rubik, Assistant, Varela_Round, Secular_One, Suez_One, Frank_Ruhl_Libre, Bellefair } from "next/font/google";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import Toaster from "@/components/Toaster";
import OnboardingSplash from "@/components/OnboardingSplash";
import SfxCustomLoader from "@/components/SfxCustomLoader";
import ConfirmDialogRoot from "@/components/ConfirmDialog";
import AnimatedBackground from "@/components/AnimatedBackground";
import { pageMetadata, softwareJsonLd, getSiteUrl } from "@/lib/seo";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = `${heebo.variable} ${rubik.variable} ${assistant.variable} ${varela.variable} ${secular.variable} ${suez.variable} ${frank.variable} ${bellefair.variable}`;
  return (
    <html lang="he" dir="rtl" className={fontVars}>
      <head>
        {/* JSON-LD structured data — tells Google what this app IS */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd()) }}
        />
      </head>
      <body className="font-sans antialiased">
        <AnimatedBackground />
        {children}
        <SiteFooter />
        <Toaster />
        <OnboardingSplash />
        <ConfirmDialogRoot />
        <SfxCustomLoader />
      </body>
    </html>
  );
}
