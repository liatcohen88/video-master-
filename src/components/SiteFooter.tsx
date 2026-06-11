"use client";

import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { useContent } from "@/lib/useContent";
import LogoMark from "./LogoMark";

/**
 * Full sitemap-style footer with 3 columns + bottom copyright row.
 * Inspired by polished SaaS sites (CapShenz reference): branding on
 * one side, contact in the middle, links on the other.
 */
export default function SiteFooter() {
  const appName  = useContent("brand.appName");
  const tagline  = useContent("footer.tagline");
  const address  = useContent("footer.address");
  const email    = useContent("footer.contactEmail");
  const phone    = useContent("footer.contactPhone");
  const copy     = useContent("footer.text");

  return (
    <footer dir="rtl" className="w-full border-t border-white/5 mt-16 pt-10 pb-5 px-6 bg-bg-card/30">
      <div className="max-w-6xl mx-auto">
        {/* Top: 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

          {/* Right (RTL first) — brand + tagline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LogoMark size={32} mode="static" />
              <span className="font-black text-base">{appName}</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed max-w-xs">{tagline}</p>
            {address && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
                <MapPin className="w-3 h-3" /> {address}
              </div>
            )}
          </div>

          {/* Middle — contact methods */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">צור קשר</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${email}`} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors group">
                  <Mail className="w-3.5 h-3.5 text-violet-300" />
                  <span dir="ltr">{email}</span>
                </a>
              </li>
              <li>
                <a href={`tel:${phone.replace(/\D/g, "")}`} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                  <Phone className="w-3.5 h-3.5 text-pink-300" />
                  <span dir="ltr">{phone}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Left — sitemap links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">מפת אתר</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/"          className="text-white/70 hover:text-white transition-colors">{useContent("footer.link.home")}</Link></li>
              <li><Link href="/multi"     className="text-white/70 hover:text-white transition-colors">{useContent("footer.link.multi")}</Link></li>
              <li><Link href="/credits"   className="text-white/70 hover:text-white transition-colors">{useContent("footer.link.credits")}</Link></li>
              <li><Link href="/help"      className="text-white/70 hover:text-white transition-colors">{useContent("footer.link.help")}</Link></li>
              <li><Link href="/contact"   className="text-white/70 hover:text-white transition-colors">{useContent("footer.link.contact")}</Link></li>
              <li><Link href="/policy"    className="text-white/70 hover:text-white transition-colors">{useContent("footer.link.policy")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom row — copyright + small links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-5 border-t border-white/5 text-[11px] text-white/30">
          <div>{copy}</div>
          <div className="flex items-center gap-4">
            <Link href="/policy" className="hover:text-white/60">{useContent("footer.bottom.terms")}</Link>
            <span className="text-white/10">·</span>
            <Link href="/policy" className="hover:text-white/60">{useContent("footer.bottom.privacy")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
