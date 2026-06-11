"use client";

import Link from "next/link";
import { Phone, MessageCircle, Mail, Clock, ArrowLeft, MapPin } from "lucide-react";
import { useContent } from "@/lib/useContent";

export default function ContactPage() {
  const title       = useContent("contact.title");
  const subtitle    = useContent("contact.subtitle");
  const phone       = useContent("footer.contactPhone");
  const email       = useContent("footer.contactEmail");
  const phoneTitle  = useContent("contact.phoneTitle");
  const phoneHint   = useContent("contact.phoneHint");
  const waTitle     = useContent("contact.whatsappTitle");
  const waHint      = useContent("contact.whatsappHint");
  const emailTitle  = useContent("contact.emailTitle");
  const emailHint   = useContent("contact.emailHint");
  const hoursTitle  = useContent("contact.hoursTitle");
  const hoursBody   = useContent("contact.hoursBody");

  // Build wa.me link from phone (strip non-digits, prefix 972 for Israel)
  const waPhone = phone.replace(/\D/g, "").replace(/^0/, "972");

  return (
    <div dir="rtl" className="min-h-screen text-white relative">
      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4 shadow-lg shadow-brand/30">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">{title}</h1>
          <p className="text-sm text-white/60">{subtitle}</p>
        </div>

        {/* 3 contact methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <ContactCard
            href={`tel:${phone.replace(/\D/g, "")}`}
            icon={<Phone className="w-6 h-6" />}
            title={phoneTitle}
            value={phone}
            hint={phoneHint}
            gradient="from-violet-500/20 to-purple-700/5"
            iconBg="bg-violet-500/25 text-violet-200"
          />
          <ContactCard
            href={`https://wa.me/${waPhone}`}
            external
            icon={<WhatsAppIcon className="w-6 h-6" />}
            title={waTitle}
            value={phone}
            hint={waHint}
            gradient="from-emerald-500/20 to-green-700/5"
            iconBg="bg-emerald-500/25 text-emerald-200"
            featured
          />
          <ContactCard
            href={`mailto:${email}`}
            icon={<Mail className="w-6 h-6" />}
            title={emailTitle}
            value={email}
            hint={emailHint}
            gradient="from-cyan-500/20 to-blue-700/5"
            iconBg="bg-cyan-500/25 text-cyan-200"
          />
        </div>

        {/* Hours */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-200 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold mb-1">{hoursTitle}</div>
            <div className="text-xs text-white/60 whitespace-pre-line leading-relaxed">{hoursBody}</div>
          </div>
        </div>

        {/* Quick note */}
        <div className="mt-6 text-center text-xs text-white/40">
          לבעיות טכניות מומלץ ב<a href={`https://wa.me/${waPhone}`} className="text-emerald-300 hover:underline mx-1">וואטסאפ</a>·
          להצעות עסקיות ושיתופי פעולה ב<a href={`mailto:${email}`} className="text-cyan-300 hover:underline mx-1">מייל</a>
        </div>

        <div className="text-center mt-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> חזרה לאפליקציה
          </Link>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ href, external, icon, title, value, hint, gradient, iconBg, featured }: {
  href: string; external?: boolean; icon: React.ReactNode; title: string; value: string;
  hint: string; gradient: string; iconBg: string; featured?: boolean;
}) {
  const Wrapper = href.startsWith("http") || external ? "a" : "a";
  const linkProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Wrapper href={href} {...linkProps}
      className={`group block bg-gradient-to-br ${gradient} border rounded-2xl p-5 transition-all hover:-translate-y-1
        ${featured ? "border-emerald-400/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-400/30" : "border-white/10 hover:border-white/25"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
        {featured && (
          <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-400 text-emerald-900 px-2 py-0.5 rounded-full">
            המומלץ
          </span>
        )}
      </div>
      <div className="text-xs text-white/50 mb-0.5">{title}</div>
      <div className="text-base font-bold mb-2 group-hover:text-white/95" dir="ltr">{value}</div>
      <div className="text-[11px] text-white/40 leading-snug">{hint}</div>
      <div className="mt-3 text-xs text-white/60 group-hover:text-white inline-flex items-center gap-1">
        לחיצה כדי לשלוח <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
      </div>
    </Wrapper>
  );
}

// Inline WhatsApp glyph — Lucide doesn't ship one
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zm-7.01 15.24h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01s-.43.06-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.02 2.57.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.18-.48-.31z" />
    </svg>
  );
}
