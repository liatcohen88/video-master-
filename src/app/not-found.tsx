"use client";

import Link from "next/link";
import { Home, Search, ArrowRight } from "lucide-react";
import { useContent } from "@/lib/useContent";
import LogoMark from "@/components/LogoMark";

export default function NotFound() {
  const heading = useContent("error.404.heading") as string;
  const body    = useContent("error.404.body") as string;
  const homeCta = useContent("error.404.homeCta") as string;
  const helpCta = useContent("error.404.helpCta") as string;

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-6"><LogoMark size={64} /></div>
        <div className="text-7xl font-black bg-gradient-to-br from-brand to-accent-pink bg-clip-text text-transparent mb-3">404</div>
        <h1 className="text-2xl font-extrabold mb-2">{heading}</h1>
        <p className="text-white/60 mb-8">{body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-5 py-2.5 rounded-lg">
            <Home className="w-4 h-4" /> {homeCta}
          </Link>
          <Link href="/help" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold px-5 py-2.5 rounded-lg">
            <Search className="w-4 h-4" /> {helpCta} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
