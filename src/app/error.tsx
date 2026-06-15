"use client";

import { Home, RefreshCw, AlertTriangle } from "lucide-react";
import { useContent } from "@/lib/useContent";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const heading = useContent("error.500.heading") as string;
  const body    = useContent("error.500.body") as string;
  const retry   = useContent("error.500.retry") as string;
  const homeCta = useContent("error.500.homeCta") as string;

  // Liat: "הכפתורים גם בנסה שוב או חזור לבית לא עובדים בכלל". The Next.js
  // `reset()` re-renders the same React tree — if the underlying error
  // fires every render (e.g. a useEffect throwing), the user just sees
  // the same error page and feels like the button is dead. Same problem
  // with <Link href="/"> on a poisoned root layout. Force a HARD reload
  // and a HARD navigation so the JS bundle restarts clean — this always
  // works, at the cost of one extra HTTP round-trip.
  function hardReload() {
    try { reset(); } catch {}
    if (typeof window !== "undefined") window.location.reload();
  }
  function hardHome() {
    if (typeof window !== "undefined") window.location.href = "/";
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-bg-dark via-bg-panel to-bg-dark text-white">
      <div className="max-w-md text-center">
        <div className="inline-flex p-4 rounded-2xl bg-red-500/10 border border-red-500/30 mb-6">
          <AlertTriangle className="w-12 h-12 text-red-300" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">{heading}</h1>
        <p className="text-white/60 mb-8">{body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={hardReload}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-5 py-2.5 rounded-lg">
            <RefreshCw className="w-4 h-4" /> {retry}
          </button>
          <button type="button" onClick={hardHome}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold px-5 py-2.5 rounded-lg">
            <Home className="w-4 h-4" /> {homeCta}
          </button>
        </div>
      </div>
    </div>
  );
}
