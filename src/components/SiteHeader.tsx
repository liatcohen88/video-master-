"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import LogoMark from "./LogoMark";
import MasterCoin from "./MasterCoin";
import { useContent } from "@/lib/useContent";
import { getCredits } from "@/lib/credits";
import { listNotifications, markNotificationRead, clearAllNotifications } from "@/lib/userStore";
import { useAuth } from "@/lib/useAuth";

/**
 * Shared header used across every page (home, /dashboard, /credits, /multi,
 * /help, /contact). Liat: "אני צריכה שתמיד יהיה את התפריט בהדר גם בפרופיל".
 *
 * Identical UX everywhere: brand lockup right (RTL), 3-link nav center,
 * credits pill + notifications + profile dropdown left. Mobile gets a
 * hamburger sheet with the full menu.
 *
 * Each page used to inline its own header copy. That meant any tweak (new
 * link, icon change, balance counter style) had to be applied 5 times.
 * Now: edit this one file → every page picks it up.
 */
export default function SiteHeader() {
  const appName  = useContent("brand.appName") as string;
  const tagline  = useContent("brand.tagline") as string;
  const logoSize = Number(useContent("brand.headerLogoSize") ?? 44);

  const auth = useAuth();
  const isGuest = auth.status === "guest";
  // For credits: prefer the Supabase profile balance when we have one,
  // otherwise fall back to the localStorage credit (legacy + offline mode).
  const [localCredits, setLocalCredits] = useState(0);
  const credits = auth.profile?.credits ?? localCredits;
  const userName = auth.profile?.display_name || auth.profile?.email?.split("@")[0] || "משתמש";

  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLocalCredits(getCredits());
    setUnread(listNotifications().filter((n) => !n.read).length);
    const refresh = () => {
      setLocalCredits(getCredits());
      setUnread(listNotifications().filter((n) => !n.read).length);
    };
    window.addEventListener("credits-change", refresh);
    return () => window.removeEventListener("credits-change", refresh);
  }, [tick]);

  const initial = userName.charAt(0) || "מ";
  const notifications = listNotifications();

  return (
    <header className="flex items-center justify-between gap-3 relative">
      {/* RIGHT (RTL first) — brand lockup */}
      <a href="/" className="flex items-center gap-2.5 min-w-0 group" title="לדף הבית">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-brand blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
          <LogoMark size={logoSize} mode="static" className="relative" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-black tracking-tight truncate group-hover:text-brand-light transition-colors leading-tight">{appName}</h1>
          <p className="text-[10px] md:text-[11px] text-white/40 leading-tight">{tagline}</p>
        </div>
      </a>

      {/* CENTER — main nav (desktop only) */}
      <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <a href="/" className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">בית</a>
        <a href="/credits" className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">חבילות</a>
        <a href="/help" className="px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">עזרה</a>
      </nav>

      {/* LEFT — credits + notifications + profile */}
      <div className="flex items-center gap-2 shrink-0">
        <a href="/credits"
           className="bg-gradient-to-r from-violet-500/15 to-pink-500/15 border border-white/10 hover:border-brand/40 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-colors"
           title="היתרה שלך — לחצי לקניית חבילה">
          <MasterCoin size={16} />
          <span className="font-bold text-white">{credits.toLocaleString()}</span>
        </a>

        {/* Bell */}
        <div className="relative">
          <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="relative p-2 rounded-full bg-bg-panel border border-white/10 hover:border-brand/40 transition-colors">
            <Bell className="w-4 h-4 text-white/70" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute left-0 top-12 w-80 bg-bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-3 z-50">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-xs font-bold">התראות</div>
                  {unread > 0 && (
                    <button onClick={() => { clearAllNotifications(); setTick(tick + 1); }}
                      className="text-[10px] text-white/40 hover:text-white">סמן הכל כנקרא</button>
                  )}
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {notifications.slice(0, 8).map((n) => (
                    <button key={n.id}
                      onClick={() => { markNotificationRead(n.id); setTick(tick + 1); }}
                      className={`w-full text-right flex gap-2 rounded-md p-2 transition-colors
                        ${n.read ? "opacity-50 hover:opacity-90" : "bg-white/5 hover:bg-white/10"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{n.title}</div>
                        <div className="text-[11px] text-white/50 leading-tight line-clamp-2">{n.body}</div>
                      </div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-light shrink-0 mt-1.5" />}
                    </button>
                  ))}
                  {notifications.length === 0 && (
                    <div className="text-center text-xs text-white/30 py-4">אין התראות חדשות</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Auth area (desktop) — login/signup buttons when guest, profile menu when logged in */}
        {isGuest ? (
          <div className="hidden md:flex items-center gap-2">
            <a href="/login" className="text-sm text-white/80 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors whitespace-nowrap">התחברי</a>
            <a href="/signup" className="text-sm bg-gradient-to-r from-brand to-accent-pink text-white font-bold px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap">הרשמי</a>
          </div>
        ) : (
        <div className="relative hidden md:block">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="bg-bg-panel border border-white/10 hover:border-brand/40 px-2 py-1.5 rounded-full text-xs flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            title="התפריט שלך"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-[11px] font-black text-white shrink-0">{initial}</span>
            <span className="hidden lg:inline whitespace-nowrap font-medium">{userName}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" className={`text-white/50 transition-transform ${profileOpen ? "rotate-180" : ""}`}>
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute left-0 top-12 w-52 bg-bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-1.5 z-50">
                <ProfileMenuItem href="/dashboard" icon="👤" label="פרופיל ודאשבורד" />
                <ProfileMenuItem href="/dashboard#videos" icon="📂" label="הסרטונים שלי" />
                <ProfileMenuItem href="/credits" icon="💎" label="קניית מאסטרים" highlight />
                <ProfileMenuItem href="/help" icon="❓" label="עזרה" />
                <div className="my-1 border-t border-white/10" />
                <ProfileMenuItem href="/contact" icon="✉️" label="צור קשר" />
                <button
                  onClick={() => { setProfileOpen(false); auth.signOut(); }}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <span>🚪</span><span>התנתקי</span>
                </button>
              </div>
            </>
          )}
        </div>
        )}

        {/* Hamburger (mobile) */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-full bg-bg-panel border border-white/10 text-white/80"
          aria-label="תפריט"
        >
          {mobileMenuOpen ? (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu sheet */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-16 right-2 left-2 bg-bg-card border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-3 z-50 md:hidden">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-sm font-black text-white">{initial}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{userName}</div>
                <div className="text-[10px] text-white/40">{credits.toLocaleString()} מאסטרים</div>
              </div>
            </div>
            <ProfileMenuItem href="/" icon="🏠" label="בית" />
            <ProfileMenuItem href="/credits" icon="💎" label="חבילות וקניה" highlight />
            <ProfileMenuItem href="/help" icon="❓" label="עזרה" />
            <div className="my-1 border-t border-white/10" />
            {!isGuest && <ProfileMenuItem href="/dashboard" icon="👤" label="פרופיל ודאשבורד" />}
            {!isGuest && <ProfileMenuItem href="/dashboard#videos" icon="📂" label="הסרטונים שלי" />}
            <ProfileMenuItem href="/contact" icon="✉️" label="צור קשר" />
            {isGuest ? (
              <>
                <div className="my-1 border-t border-white/10" />
                <ProfileMenuItem href="/login" icon="🔓" label="התחברי" />
                <ProfileMenuItem href="/signup" icon="✨" label="הרשמי" highlight />
              </>
            ) : (
              <>
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={() => { setMobileMenuOpen(false); auth.signOut(); }}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <span>🚪</span><span>התנתקי</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}

function ProfileMenuItem({ href, icon, label, highlight }: { href: string; icon: string; label: string; highlight?: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        highlight
          ? "bg-brand/20 text-white font-bold hover:bg-brand/30"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </a>
  );
}
