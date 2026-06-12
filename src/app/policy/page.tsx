"use client";

import Link from "next/link";
import { Shield, Lock, FileText, Mail, ArrowLeft } from "lucide-react";
import { useContent } from "@/lib/useContent";
import SiteHeader from "@/components/SiteHeader";

/**
 * Public-facing Terms of Service + Privacy Policy.
 * All copy is CMS-driven via `legal.*` keys so admin can rewrite without
 * touching code.
 */
export default function PolicyPage() {
  const title       = useContent("legal.title");
  const subtitle    = useContent("legal.subtitle");
  const lastUpdate  = useContent("legal.lastUpdate");
  const privHeader  = useContent("legal.privacyHeader");
  const privBody    = useContent("legal.privacyBody");
  const termsHeader = useContent("legal.termsHeader");
  const termsBody   = useContent("legal.termsBody");
  const cnHeader    = useContent("legal.contactHeader");
  const cnBody      = useContent("legal.contactBody");

  return (
    <div dir="rtl" className="min-h-screen text-white relative">
      <div className="relative max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8"><SiteHeader /></div>
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4 shadow-lg shadow-brand/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">{title}</h1>
          <p className="text-sm text-white/60">{subtitle}</p>
          <p className="text-[11px] text-white/30 mt-1">{lastUpdate}</p>
        </div>

        {/* Privacy section — the big one users care about */}
        <Section icon={<Lock className="w-5 h-5" />} title={privHeader} body={privBody}
                 accent="from-emerald-500/15 to-teal-500/5" iconBg="bg-emerald-500/20 text-emerald-200" />

        {/* Terms */}
        <Section icon={<FileText className="w-5 h-5" />} title={termsHeader} body={termsBody}
                 accent="from-violet-500/15 to-fuchsia-500/5" iconBg="bg-violet-500/20 text-violet-200" />

        {/* Contact */}
        <Section icon={<Mail className="w-5 h-5" />} title={cnHeader} body={cnBody}
                 accent="from-cyan-500/15 to-blue-500/5" iconBg="bg-cyan-500/20 text-cyan-200" />

        <div className="text-center mt-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> חזרה לאפליקציה
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, body, accent, iconBg }: {
  icon: React.ReactNode; title: string; body: string; accent: string; iconBg: string;
}) {
  return (
    <section className={`bg-gradient-to-br ${accent} border border-white/10 rounded-2xl p-6 md:p-8 mb-5`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
        <h2 className="text-lg md:text-xl font-bold">{title}</h2>
      </div>
      <div className="text-sm text-white/75 leading-relaxed space-y-3">
        {body.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}
