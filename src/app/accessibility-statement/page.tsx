"use client";

import Link from "next/link";
import { Accessibility, Mail, Phone, ArrowLeft } from "lucide-react";
import { useContent } from "@/lib/useContent";
import SiteHeader from "@/components/SiteHeader";

/**
 * /accessibility-statement — required compliance page (IL accessibility law,
 * WCAG 2.1 AA). Names the in-house AccessibilityPanel as the assistive tool,
 * lists known limitations, gives a complaint contact (footer email + phone).
 *
 * All copy lives in the CMS (a11y.* keys) so the admin can adjust phrasing
 * without a deploy.
 */
export default function AccessibilityStatementPage() {
  const title         = useContent("a11y.title") as string;
  const intro         = useContent("a11y.intro") as string;
  const panelTitle    = useContent("a11y.panel.title") as string;
  const panelBody     = useContent("a11y.panel.body") as string;
  const standardTitle = useContent("a11y.standard.title") as string;
  const standardBody  = useContent("a11y.standard.body") as string;
  const limitsTitle   = useContent("a11y.limits.title") as string;
  const limitsBody    = useContent("a11y.limits.body") as string;
  const contactTitle  = useContent("a11y.contact.title") as string;
  const contactBody   = useContent("a11y.contact.body") as string;
  const responsible   = useContent("a11y.contact.responsible") as string;
  const updated       = useContent("a11y.updated") as string;
  const email         = useContent("footer.contactEmail") as string;
  const phone         = useContent("footer.contactPhone") as string;

  return (
    <div dir="rtl" className="min-h-screen text-white">
      <div className="px-6 pt-6"><SiteHeader /></div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 mb-4 shadow-lg shadow-violet-500/30">
            <Accessibility className="w-7 h-7 text-white" aria-hidden />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{title}</h1>
          <p className="text-white/65 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">{intro}</p>
        </div>

        <Section title={panelTitle} body={panelBody} />
        <Section title={standardTitle} body={standardBody} />
        <Section title={limitsTitle} body={limitsBody} />

        <section className="bg-bg-card border border-white/10 rounded-2xl p-6 md:p-7 mb-5">
          <h2 className="text-lg md:text-xl font-bold mb-3">{contactTitle}</h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">{contactBody}</p>
          <div className="text-sm text-white/85 mb-3">{responsible}</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`mailto:${email}`}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600/20 border border-violet-400/40 hover:bg-violet-600/30 text-violet-100 rounded-lg py-2.5 px-4 transition-colors"
            >
              <Mail className="w-4 h-4" aria-hidden />
              <span dir="ltr">{email}</span>
            </a>
            <a
              href={`tel:${phone.replace(/\D/g, "")}`}
              className="flex-1 flex items-center justify-center gap-2 bg-pink-600/20 border border-pink-400/40 hover:bg-pink-600/30 text-pink-100 rounded-lg py-2.5 px-4 transition-colors"
            >
              <Phone className="w-4 h-4" aria-hidden />
              <span dir="ltr">{phone}</span>
            </a>
          </div>
        </section>

        <div className="text-center mt-8 text-xs text-white/40">{updated}</div>

        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="w-4 h-4" aria-hidden /> חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-bg-card border border-white/10 rounded-2xl p-6 md:p-7 mb-5">
      <h2 className="text-lg md:text-xl font-bold mb-3">{title}</h2>
      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{body}</p>
    </section>
  );
}
