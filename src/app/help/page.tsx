"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, HelpCircle, Sparkles, Coins, Download, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { useContent } from "@/lib/useContent";
import SiteHeader from "@/components/SiteHeader";

type FAQ = { cat: string; q: string; a: string };
type CategoryDef = { id: string; icon: React.ComponentType<{ className?: string }> };

/**
 * Category visuals (icon + ID) stay in code — they're not user-facing copy.
 * Labels and FAQ corpus come from the CMS so the admin can edit any question
 * or answer without a deploy. Adding a new category = add it here + add
 * faqs entries with the matching `cat` id from the admin.
 */
const CATEGORY_DEFS: CategoryDef[] = [
  { id: "general",  icon: Sparkles },
  { id: "credits",  icon: Coins },
  { id: "export",   icon: Download },
  { id: "problems", icon: AlertTriangle },
  { id: "advanced", icon: SettingsIcon },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const appName = useContent("brand.appName") as string;
  const heading = useContent("help.heading") as string;
  const subheading = (useContent("help.subheading") as string).replace("{{appName}}", appName);
  const searchPh = useContent("help.searchPlaceholder") as string;
  const emptyText = useContent("help.emptyResults") as string;
  const cardTitle = useContent("help.contactCard.title") as string;
  const cardBody = useContent("help.contactCard.body") as string;
  const cardCta = useContent("help.contactCard.cta") as string;
  const backToApp = useContent("help.backToApp") as string;
  const contactEmail = useContent("footer.contactEmail") as string;

  const catLabels: Record<string, string> = {
    general:  useContent("help.cat.general.label") as string,
    credits:  useContent("help.cat.credits.label") as string,
    export:   useContent("help.cat.export.label") as string,
    problems: useContent("help.cat.problems.label") as string,
    advanced: useContent("help.cat.advanced.label") as string,
  };

  const allFaqs = (useContent("help.faqs") as FAQ[]) ?? [];

  // Group by category, preserving CATEGORY_DEFS order. Filter by query.
  const grouped = CATEGORY_DEFS.map((def) => {
    const faqs = allFaqs.filter((f) =>
      f.cat === def.id &&
      (!query
        || f.q.toLowerCase().includes(query.toLowerCase())
        || f.a.toLowerCase().includes(query.toLowerCase()))
    );
    return { ...def, label: catLabels[def.id] ?? def.id, faqs };
  }).filter((c) => c.faqs.length > 0);

  return (
    <div dir="rtl" className="min-h-screen text-white relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-violet-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative px-6 pt-6"><SiteHeader /></div>
      <div className="relative max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-3">
            <HelpCircle className="w-6 h-6 text-white" aria-hidden />
          </div>
          <h1 className="text-3xl font-black mb-2">{heading}</h1>
          <p className="text-sm text-white/50">{subheading}</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPh}
            className="w-full bg-bg-card border border-white/10 focus:border-brand/50 rounded-xl pr-10 pl-4 py-3 text-sm placeholder-white/30 outline-none"
          />
        </div>

        {grouped.length === 0 && (
          <div className="text-center py-12 text-white/40">
            {emptyText}
          </div>
        )}

        {grouped.map((cat) => (
          <div key={cat.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3 text-sm text-white/60 font-bold uppercase tracking-wider">
              <cat.icon className="w-4 h-4" aria-hidden />
              {cat.label}
            </div>
            <div className="space-y-2">
              {cat.faqs.map((f, i) => <FaqItem key={`${cat.id}-${i}`} faq={f} />)}
            </div>
          </div>
        ))}

        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 mt-10 text-center">
          <div className="text-sm font-bold mb-2">{cardTitle}</div>
          <p className="text-xs text-white/50 mb-3">{cardBody}</p>
          <a href={`mailto:${contactEmail}`}
             className="inline-block bg-brand hover:bg-brand/80 text-white px-5 py-2 rounded-lg text-sm font-bold">
            {cardCta}
          </a>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-white/40 hover:text-white">{backToApp}</Link>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors
      ${open ? "border-brand/40 bg-bg-card" : "border-white/10 bg-bg-card/50 hover:border-white/20"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right"
      >
        <span className={`font-medium text-sm ${open ? "text-white" : "text-white/85"}`}>{faq.q}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-white/70 leading-relaxed border-t border-white/5 pt-3 whitespace-pre-line">
          {faq.a}
        </div>
      )}
    </div>
  );
}
