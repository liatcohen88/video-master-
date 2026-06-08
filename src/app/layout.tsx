import type { Metadata } from "next";
import { Heebo, Rubik, Assistant, Varela_Round, Secular_One, Suez_One, Frank_Ruhl_Libre, Bellefair } from "next/font/google";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import Toaster from "@/components/Toaster";
import OnboardingSplash from "@/components/OnboardingSplash";
import ConfirmDialogRoot from "@/components/ConfirmDialog";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });
const assistant = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-assistant", display: "swap" });
const varela = Varela_Round({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-varela", display: "swap" });
const secular = Secular_One({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-secular", display: "swap" });
const suez = Suez_One({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-suez", display: "swap" });
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], variable: "--font-frank", display: "swap" });
const bellefair = Bellefair({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-bellefair", display: "swap" });

export const metadata: Metadata = {
  title: "סטודיו כתוביות",
  description: "אפליקציה לעריכת כתוביות בעברית — Whisper מקומי, חינמי",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = `${heebo.variable} ${rubik.variable} ${assistant.variable} ${varela.variable} ${secular.variable} ${suez.variable} ${frank.variable} ${bellefair.variable}`;
  return (
    <html lang="he" dir="rtl" className={fontVars}>
      <body className="font-sans antialiased">
        {children}
        <SiteFooter />
        <Toaster />
        <OnboardingSplash />
        <ConfirmDialogRoot />
      </body>
    </html>
  );
}
