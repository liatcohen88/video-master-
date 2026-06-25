"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Film, Clock, Plus, Bell, Download, Trash2, Pencil,
  AlertTriangle, Sparkles, Receipt, ArrowUpRight, Layers, History, Play,
} from "lucide-react";
import MasterCoin from "@/components/MasterCoin";
import LogoMark from "@/components/LogoMark";
import SiteHeader from "@/components/SiteHeader";
import { useContent } from "@/lib/useContent";
import { sanitizeCmsHtml } from "@/lib/sanitizeHtml";
import { ArrowRight } from "lucide-react";
import { listSnapshots, deleteSnapshot, loadCurrentVideo, wipeAllProjectStorage, type ProjectSnapshot } from "@/lib/projectStorage";
import { clearAutoSavedProject } from "@/lib/useAutoSave";
import {
  getProfile, updateProfile, listMyVideos, deleteVideo,
  listNotifications, markNotificationRead, clearAllNotifications,
  listInvoices, getUserStats, resetUserStore,
  type UserVideo, type UserNotification,
} from "@/lib/userStore";
import { getCredits } from "@/lib/credits";
import { downloadExportedVideo } from "@/lib/videoDelivery";
import { confirm } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toaster";
import { useAuth } from "@/lib/useAuth";
import { fetchVideoRows, fetchNotifRows, markNotifRowRead } from "@/lib/userData";

// Default mode labels. Per-row Hebrew label is now CMS-overridable via
// dashboard.modeLabel.* — see useModeLabel() below.
const MODE_LABEL_DEFAULT: Record<UserVideo["mode"], string> = {
  subtitles_only: "כתוביות",
  basic_effects:  "אפקטים",
  podcast:        "פודקאסט",
  advanced_effects: "מתקדם",
  multi_video:    "מולטי",
};

/**
 * Minimalist dashboard — fewer columns, less color, more whitespace.
 * Stats compressed to a single row of 3. Profile + invoices collapsed
 * by default. Notifications as a bell-button popover (not always-visible).
 */
export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [credits, setCredits] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  // Cross-device videos + notifications from Supabase (null = use localStorage).
  const [cloudVideos, setCloudVideos] = useState<UserVideo[] | null>(null);
  const [cloudNotifs, setCloudNotifs] = useState<UserNotification[] | null>(null);
  const [hasSavedVideo, setHasSavedVideo] = useState(false);
  const auth = useAuth();
  const currency = (useContent("brand.currencyName") as string) || "קרדיטים";
  const appName  = useContent("brand.appName") as string;
  const tagline  = useContent("brand.tagline") as string;
  const logoSize = Number(useContent("brand.headerLogoSize") ?? 56);
  // Dashboard copy — pulled here (NOT inside JSX conditionals!) so React's
  // Rules of Hooks are obeyed: same number of hooks every render.
  const dashGreeting    = useContent("dashboard.greeting") as string;
  const dashHistory     = useContent("dashboard.sections.history") as string;
  const dashInvoices    = useContent("dashboard.sections.invoices") as string;
  const dashEmptyNone   = useContent("dashboard.empty.noHistory") as string;
  const dashEmptySaved  = useContent("dashboard.empty.savedVideo") as string;
  // Extended dashboard copy — every user-visible string editable from admin.
  const cEditBtn        = useContent("dashboard.editBtn") as string;
  const cCloseBtn       = useContent("dashboard.closeBtn") as string;
  const cStatsLine      = useContent("dashboard.statsLineFull") as string;
  const cStatVideos     = useContent("dashboard.stat.videos") as string;
  const cStatMonths     = useContent("dashboard.stat.monthsActive") as string;
  const cStatMember     = useContent("dashboard.stat.memberSince") as string;
  const cQATitle        = useContent("dashboard.quickAction.title") as string;
  const cMyVidsHeading  = useContent("dashboard.myVideos.heading") as string;
  const cMyVidsTotal    = useContent("dashboard.myVideos.totalSuffix") as string;
  const cMyVidsEmpty    = useContent("dashboard.myVideos.empty") as string;
  const cMyVidsEmptyCta = useContent("dashboard.myVideos.emptyCta") as string;
  const cDelVidTitle    = useContent("dashboard.confirm.deleteVideo.title") as string;
  const cDelVidBodyTpl  = useContent("dashboard.confirm.deleteVideo.body") as string;
  const cDelVidBtn      = useContent("dashboard.confirm.deleteVideo.btn") as string;
  const cVidDeletedToast= useContent("dashboard.toast.videoDeleted") as string;
  const cDelSnapTitle   = useContent("dashboard.confirm.deleteSnapshot.title") as string;
  const cDelSnapBody    = useContent("dashboard.confirm.deleteSnapshot.body") as string;
  const cDelSnapBtn     = useContent("dashboard.confirm.deleteSnapshot.btn") as string;
  const cSnapDeletedToast= useContent("dashboard.toast.snapshotDeleted") as string;
  const cSnapCountHint  = useContent("dashboard.snapshots.countHint") as string;
  const cSnapResumeBtn  = useContent("dashboard.snapshots.resumeBtn") as string;
  const cSnapEmptyHas   = useContent("dashboard.snapshots.empty.hasVideo") as string;
  const cSnapEmptyNo    = useContent("dashboard.snapshots.empty.noVideo") as string;
  const cSnapCountSuffix= useContent("dashboard.snapshots.countSuffix") as string;
  const cSnapRestoreBtn = useContent("dashboard.snapshots.restoreBtn") as string;
  const cSnapDelTooltip = useContent("dashboard.snapshots.deleteTooltip") as string;
  const cSnapRetention  = useContent("dashboard.snapshots.retentionNotice") as string;
  const cInvCountHint   = useContent("dashboard.invoices.countHint") as string;
  const cInvDlTooltip   = useContent("dashboard.invoices.downloadTooltip") as string;
  const cDangerTitle    = useContent("dashboard.danger.title") as string;
  const cDangerBody     = useContent("dashboard.danger.body") as string;
  const cDangerCfTitle  = useContent("dashboard.danger.confirm.title") as string;
  const cDangerCfBody   = useContent("dashboard.danger.confirm.body") as string;
  const cDangerCfBtn    = useContent("dashboard.danger.confirm.btn") as string;
  const cWipeAllToast   = useContent("dashboard.toast.wipeAll") as string;
  const cDangerBtn      = useContent("dashboard.danger.btn") as string;
  const cDemoCfTitle    = useContent("dashboard.demoReset.confirm.title") as string;
  const cDemoCfBody     = useContent("dashboard.demoReset.confirm.body") as string;
  const cDemoCfBtn      = useContent("dashboard.demoReset.confirm.btn") as string;
  const cDemoResetToast = useContent("dashboard.toast.demoReset") as string;
  const cDemoBtn        = useContent("dashboard.demoReset.btn") as string;
  const cNotifTitle     = useContent("header.notifications.title") as string;
  const cNotifMark      = useContent("header.notifications.markAllRead") as string;
  const cNotifEmpty     = useContent("header.notifications.empty") as string;
  // Mode-label overrides (keyed by mode id, with fall-back to defaults)
  const modeLabels: Record<UserVideo["mode"], string> = {
    subtitles_only:   (useContent("dashboard.modeLabel.subtitles_only") as string) || MODE_LABEL_DEFAULT.subtitles_only,
    basic_effects:    (useContent("dashboard.modeLabel.basic_effects") as string) || MODE_LABEL_DEFAULT.basic_effects,
    podcast:          (useContent("dashboard.modeLabel.podcast") as string) || MODE_LABEL_DEFAULT.podcast,
    advanced_effects: (useContent("dashboard.modeLabel.advanced_effects") as string) || MODE_LABEL_DEFAULT.advanced_effects,
    multi_video:      (useContent("dashboard.modeLabel.multi_video") as string) || MODE_LABEL_DEFAULT.multi_video,
  };

  useEffect(() => {
    setHydrated(true);
    setCredits(getCredits());
    const refresh = () => setCredits(getCredits());
    window.addEventListener("credits-change", refresh);
    // Load saved project snapshots from IndexedDB
    (async () => {
      setSnapshots(await listSnapshots());
      setHasSavedVideo(Boolean(await loadCurrentVideo()));
    })();
    return () => window.removeEventListener("credits-change", refresh);
  }, [tick]);

  // Pull videos + notifications from Supabase (cross-device). Falls back to
  // localStorage when null (guest / migration not applied / offline).
  useEffect(() => {
    if (auth.status !== "user") return;
    let cancelled = false;
    (async () => {
      const [v, n] = await Promise.all([fetchVideoRows(), fetchNotifRows()]);
      if (cancelled) return;
      if (v) setCloudVideos(v);
      if (n) setCloudNotifs(n);
    })();
    return () => { cancelled = true; };
  }, [auth.status, tick]);

  async function removeSnapshot(id: number) {
    const ok = await confirm({ title: cDelSnapTitle, body: cDelSnapBody, confirmLabel: cDelSnapBtn, destructive: true });
    if (!ok) return;
    await deleteSnapshot(id);
    setSnapshots(await listSnapshots());
    toast.success(cSnapDeletedToast);
  }

  if (!hydrated) return <div className="min-h-screen" />;

  // Real Supabase profile takes precedence over the mock userStore fixture.
  // Liat 2026-06-17: dashboard was showing "היי ליאת" + liat@example.com +
  // wrong credit count for everyone because getProfile() reads a hardcoded
  // demo object. Now we hydrate from useAuth() and fall back to the mock
  // only when Supabase isn't configured (dev).
  const mockProfile  = getProfile();
  const authProfile  = auth.status === "user" ? auth.profile : null;
  const realName     = authProfile?.display_name
    || authProfile?.email?.split("@")[0]
    || mockProfile.name;
  const realEmail    = authProfile?.email ?? mockProfile.email;
  const realCredits  = authProfile?.credits ?? credits;
  const realJoinedAt = authProfile?.created_at ?? mockProfile.joinedAt;
  const realAvatar   = authProfile?.avatar_url || mockProfile.avatarUrl || undefined;
  const profile = { ...mockProfile, name: realName, email: realEmail, joinedAt: realJoinedAt, avatarUrl: realAvatar };
  const stats         = getUserStats();
  const videos        = cloudVideos ?? listMyVideos();
  const notifications = cloudNotifs ?? listNotifications();
  const invoices      = listInvoices();
  const unread        = notifications.filter((n) => !n.read).length;

  return (
    <div dir="rtl" className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Shared SiteHeader — Liat: "אני צריכה שתמיד יהיה את התפריט בהדר
            גם בפרופיל". Same nav (בית / חבילות / עזרה), credits pill,
            profile dropdown on every page. */}
        <div className="mb-8"><SiteHeader /></div>

        {/* ── HERO Profile card at the top — cover + avatar + greeting + stats ── */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-white/10 bg-bg-card">
          {/* Top: bell + credits sit ABOVE the cover gradient */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <Link href="/credits"
              className="flex items-center gap-2 bg-black/40 backdrop-blur border border-white/15 hover:border-brand/40 rounded-full pl-3 pr-2 py-1.5 transition-colors group">
              <MasterCoin size={16} />
              <span className="text-sm font-bold">{realCredits.toLocaleString()}</span>
              <span className="text-[10px] text-white/60">{currency}</span>
              <span className="bg-brand/40 group-hover:bg-brand/60 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center mr-1 transition-colors">+</span>
            </Link>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-full bg-black/40 backdrop-blur border border-white/15 hover:border-brand/40 transition-colors">
                <Bell className="w-4 h-4 text-white/80" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute left-0 top-11 w-80 bg-bg-card border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-3 z-50">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="text-xs font-bold">{cNotifTitle}</div>
                    {unread > 0 && (
                      <button onClick={() => { clearAllNotifications(); setTick(tick + 1); }}
                        className="text-[10px] text-white/40 hover:text-white">{cNotifMark}</button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {notifications.slice(0, 8).map((n) => (
                      <NotifRow key={n.id} n={n}
                        onClick={() => { markNotificationRead(n.id); void markNotifRowRead(n.id); setTick(tick + 1); }} />
                    ))}
                    {notifications.length === 0 && (
                      <div className="text-center text-xs text-white/30 py-4">{cNotifEmpty}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cover gradient banner */}
          <div className="h-28 bg-gradient-to-br from-violet-600/50 via-fuchsia-600/40 to-pink-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(168,85,247,0.5),transparent_50%),radial-gradient(circle_at_80%_50%,rgba(236,72,153,0.4),transparent_50%)]" />
          </div>

          <div className="px-5 pb-5 -mt-10 relative">
            <div className="flex items-end gap-3 mb-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-3xl font-black border-4 border-bg-card shadow-xl">
                {profile.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.name.charAt(0)
                )}
              </div>
              <div className="flex-1 pb-1">
                <div className="text-2xl font-black leading-tight">{dashGreeting.replace("{{name}}", profile.name)}</div>
                <div className="text-xs text-white/50 mt-0.5">{profile.email}</div>
              </div>
              <button onClick={() => setProfileEditing(!profileEditing)}
                className="bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                <Pencil className="w-3 h-3" />
                {profileEditing ? cCloseBtn : cEditBtn}
              </button>
            </div>

            {/* Personalized stats sentence */}
            {!profileEditing && (
              <p
                className="text-sm text-white/75 leading-relaxed mb-4"
                // Renders the CMS template with bold colored stat values
                // (videos / saved minutes / used credits). HTML is built from
                // CMS placeholders only — no user input.
                dangerouslySetInnerHTML={{
                  __html: sanitizeCmsHtml(cStatsLine
                    .replace("{{videos}}", `<span class="text-violet-300 font-bold">${stats.videosCount}</span>`)
                    .replace("{{savedMin}}", `<span class="text-emerald-300 font-bold">${stats.savedMin}</span>`)
                    .replace("{{used}}", `<span class="text-amber-300 font-bold">${stats.creditsUsed}</span>`)
                    .replace("{{currency}}", `<span class="text-amber-300 font-bold">${currency}</span>`)),
                }}
              />
            )}

            {/* Inline stats strip */}
            {!profileEditing && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg py-2.5">
                  <div className="text-base font-bold">{stats.videosCount}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{cStatVideos}</div>
                </div>
                <div className="bg-white/5 rounded-lg py-2.5">
                  <div className="text-base font-bold">{stats.monthsActive}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{cStatMonths}</div>
                </div>
                <div className="bg-white/5 rounded-lg py-2.5">
                  <div className="text-base font-bold">{new Date(profile.joinedAt).toLocaleDateString("he-IL", { month: "short", year: "2-digit" })}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{cStatMember}</div>
                </div>
              </div>
            )}

            {profileEditing && (
              <ProfileEditor profile={profile} editing={true} setEditing={setProfileEditing} onChange={() => setTick(tick + 1)} />
            )}
          </div>
        </div>

        {/* ── Quick action: just one primary button ── */}
        <Link href="/"
          className="flex items-center justify-between bg-bg-card border border-white/10 hover:border-brand/40 rounded-2xl p-5 mb-10 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/15 text-brand-light">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">{cQATitle}</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
        </Link>

        {/* ── My videos — clean list, less per-row noise ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">{cMyVidsHeading}</h2>
            <span className="text-xs text-white/30">{videos.length} {cMyVidsTotal}</span>
          </div>
          {videos.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
              <Film className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40 mb-3">{cMyVidsEmpty}</p>
              <Link href="/" className="text-xs text-brand-light hover:text-white">{cMyVidsEmptyCta}</Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {videos.map((v) => (
                <VideoRow key={v.id} video={v}
                  modeLabels={modeLabels}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: cDelVidTitle,
                      body: cDelVidBodyTpl.replace("{{title}}", v.title),
                      confirmLabel: cDelVidBtn, destructive: true,
                    });
                    if (!ok) return;
                    deleteVideo(v.id); setTick(tick + 1);
                    toast.success(cVidDeletedToast);
                  }}
                />
              ))}
            </div>
          )}
        </section>


        {/* ── Saved project versions (snapshots from the editor) ────────── */}
        <details className="group mb-4 bg-bg-card/50 border border-white/5 rounded-xl" open={snapshots.length > 0}>
          <summary className="cursor-pointer flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-violet-500/15 text-violet-300">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold">{dashHistory}</div>
                <div className="text-[11px] text-white/40">
                  {snapshots.length === 0
                    ? hasSavedVideo ? dashEmptySaved : dashEmptyNone
                    : cSnapCountHint.replace("{{n}}", String(snapshots.length))}
                </div>
              </div>
            </div>
            {hasSavedVideo && (
              <Link href="/" className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-brand/20 hover:bg-brand/30 text-brand-light px-3 py-1.5 rounded-lg font-bold transition">
                <Play className="w-3 h-3" /> {cSnapResumeBtn}
              </Link>
            )}
          </summary>
          <div className="px-4 pb-4 border-t border-white/5 pt-3">
            {snapshots.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-4">
                {hasSavedVideo ? cSnapEmptyHas : cSnapEmptyNo}
              </p>
            ) : (
              <div className="space-y-1.5">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-xs py-2 px-2 rounded-lg hover:bg-white/5 group/row">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0">
                      <History className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{s.label}</div>
                      <div className="text-[10px] text-white/40">
                        {new Date(s.at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {s.payload.subtitles.length} {cSnapCountSuffix}
                      </div>
                    </div>
                    <Link href={s.id ? `/?restore=${s.id}` : "/"} className="px-2.5 py-1 rounded-md bg-brand/20 hover:bg-brand/40 text-brand-light text-[10px] font-bold transition">
                      {cSnapRestoreBtn}
                    </Link>
                    <button onClick={() => s.id && removeSnapshot(s.id)} className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/row:opacity-100 transition" title={cSnapDelTooltip}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {snapshots.length > 0 && (
              <p className="mt-3 text-[11px] text-amber-200/80 bg-amber-500/5 border border-amber-400/20 rounded-lg px-3 py-2 leading-relaxed">
                {cSnapRetention}
              </p>
            )}
          </div>
        </details>

        <details className="group mb-10 bg-bg-card/50 border border-white/5 rounded-xl">
          <summary className="cursor-pointer flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold">{dashInvoices}</div>
                <div className="text-[11px] text-white/40">{cInvCountHint.replace("{{n}}", String(invoices.length))}</div>
              </div>
            </div>
          </summary>
          <div className="px-4 pb-4 border-t border-white/5 space-y-1.5 pt-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 text-xs py-1">
                <span className="flex-1 text-white/70">{inv.package} — {inv.credits} {currency}</span>
                <span className="text-white/40 text-[10px]">{new Date(inv.date).toLocaleDateString("he-IL")}</span>
                <span className="text-emerald-300 font-bold">₪{inv.amountIls}</span>
                <a href={inv.url} className="p-1 text-white/40 hover:text-white" title={cInvDlTooltip}>
                  <Download className="w-3 h-3" />
                </a>
              </div>
            ))}
            {/* Footer hint with link to support — Liat 2026-06-17 */}
            <div className="text-[11px] text-white/40 pt-3 mt-2 border-t border-white/5">
              לא מצאת את החשבונית שחיפשת?{" "}
              <Link href="/contact" className="text-brand-light hover:underline font-bold">
                צור איתנו קשר
              </Link>
            </div>
          </div>
        </details>

        {/* Dev reset tools (wipe storage + demo reset) — HIDDEN for launch per
            Liat ("תמחק את הטאב הזה — אפילו תסתיר, נוסיף בעתיד"). These are
            destructive testing tools, not for end users. Re-enable later by
            removing the `false &&` guard. */}
        {false && (
        <>
        {/* ── DANGER ZONE — wipe stored videos + clear auto-saved project state ── */}
        <div className="mt-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🗑️</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-red-200">{cDangerTitle}</div>
              <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(cDangerBody) }} />
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: cDangerCfTitle,
                  body: cDangerCfBody,
                  confirmLabel: cDangerCfBtn,
                  destructive: true,
                });
                if (!ok) return;
                await wipeAllProjectStorage();
                clearAutoSavedProject();
                setTick(tick + 1);
                setSnapshots([]);
                setHasSavedVideo(false);
                toast.success(cWipeAllToast);
              }}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 px-3 py-2 rounded-md whitespace-nowrap font-bold transition-colors"
            >
              {cDangerBtn}
            </button>
          </div>
        </div>

        <button onClick={async () => {
            const ok = await confirm({ title: cDemoCfTitle, body: cDemoCfBody, confirmLabel: cDemoCfBtn, destructive: true });
            if (!ok) return;
            resetUserStore(); setTick(tick + 1);
            toast.success(cDemoResetToast);
          }}
          className="w-full text-[10px] text-white/20 hover:text-white/50 py-2 transition-colors">
          {cDemoBtn}
        </button>
        </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components — pared down, less ornamentation ──

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card p-4 text-center">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function VideoRow({ video, onDelete, modeLabels }: {
  video: UserVideo;
  onDelete: () => void;
  modeLabels: Record<UserVideo["mode"], string>;
}) {
  const isProcessing = video.status === "processing";
  const isFailed = video.status === "failed";
  const dlTooltip = useContent("dashboard.video.downloadTooltip") as string;
  const delTooltip = useContent("dashboard.video.deleteTooltip") as string;
  const [dling, setDling] = useState(false);
  async function handleDownload() {
    if (dling) return;
    setDling(true);
    try {
      const safe = (video.title || "video").replace(/[\\/:*?"<>|]/g, "").trim() || "video";
      const r = await downloadExportedVideo(video.id, `${safe}.mp4`);
      if (r === "shared") toast.success("✓ יש לבחור 'שמור וידאו' — והסרטון בגלריה 📸");
      else if (r === "downloaded") toast.success("✓ הסרטון ירד אלייך");
      else if (r === "gone") toast.error("הסרטון כבר לא זמין להורדה חוזרת (נשמר עד 24 שעות מהייצוא)");
      else toast.error("ההורדה נכשלה — אפשר לנסות שוב");
    } finally { setDling(false); }
  }
  return (
    <div className="flex items-center gap-3 py-3 group">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl shrink-0">
        {isProcessing ? (
          <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
        ) : isFailed ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : (
          video.thumbnailEmoji
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{video.title}</div>
        <div className="text-[11px] text-white/40 flex items-center gap-1.5">
          <span>{modeLabels[video.mode]}</span>
          <span>·</span>
          <span>{Math.round(video.durationSec)}s</span>
          <span>·</span>
          <span>{new Date(video.createdAt).toLocaleDateString("he-IL")}</span>
        </div>
      </div>
      {video.status === "done" && (
        <button onClick={handleDownload} disabled={dling}
          className="p-1.5 text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100 disabled:text-brand-light" title={dlTooltip}>
          <Download className={`w-3.5 h-3.5 ${dling ? "animate-pulse" : ""}`} />
        </button>
      )}
      <button onClick={onDelete}
        className="p-1.5 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title={delTooltip}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NotifRow({ n, onClick }: { n: UserNotification; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-right flex gap-2 rounded-md p-2 transition-colors
        ${n.read ? "opacity-50 hover:opacity-90" : "bg-white/5 hover:bg-white/10"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{n.title}</div>
        <div className="text-[11px] text-white/50 leading-tight line-clamp-2">{n.body}</div>
      </div>
      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-light shrink-0 mt-1.5" />}
    </button>
  );
}

function ProfileEditor({ profile, editing, setEditing, onChange }: {
  profile: ReturnType<typeof getProfile>;
  editing: boolean; setEditing: (b: boolean) => void; onChange: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [avatarBusy, setAvatarBusy] = useState(false);
  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    try {
      const { browserClient } = await import("@/lib/supabase");
      const sb = browserClient();
      const token = (await sb?.auth.getSession())?.data.session?.access_token;
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "העלאה נכשלה");
      setAvatarUrl(j.url);
      updateProfile({ avatarUrl: j.url });        // instant local display
      await sb?.auth.updateUser({ data: { avatar_url: j.url } }); // cross-device
      onChange();
      toast.success("התמונה עודכנה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "העלאה נכשלה");
    } finally {
      setAvatarBusy(false);
    }
  }
  const namePh    = useContent("dashboard.profile.namePlaceholder") as string;
  const saveBtn   = useContent("dashboard.profile.saveBtn") as string;
  const cancelBtn = useContent("dashboard.profile.cancelBtn") as string;
  const labelName = useContent("dashboard.profile.labelName") as string;
  const labelEmail= useContent("dashboard.profile.labelEmail") as string;
  const labelMs   = useContent("dashboard.profile.labelMemberSince") as string;
  const editBtn   = useContent("dashboard.profile.editBtn") as string;
  const updToast  = useContent("dashboard.toast.profileUpdated") as string;
  async function save() {
    setBusy(true);
    const cleanPhone = phone.trim();
    // Email is intentionally NOT editable — it's the account identity
    // (Liat: "אל תיתן אפשרות לשנות את המייל"). Save name + optional phone.
    updateProfile({ name, phone: cleanPhone });
    // Persist to Supabase so name + phone survive across devices AND show up in
    // the admin users table (Liat: "אראה באדמין את המס").
    try {
      const { browserClient } = await import("@/lib/supabase");
      const sb = browserClient();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser();
        // 1) profiles table — THIS is what useAuth reads for display_name, so
        //    the rename actually sticks (auth metadata alone wasn't reflected →
        //    Liat: "שיניתי את השם וזה לא באמת נשמר").
        if (user) await sb.from("profiles").update({ display_name: name }).eq("id", user.id);
        // 2) auth metadata — phone (admin reads it here) + display_name mirror.
        await sb.auth.updateUser({ data: { display_name: name, phone: cleanPhone } });
      }
    } catch { /* best-effort — the local copy is already saved */ }
    setBusy(false);
    setEditing(false);
    onChange();
    toast.success(updToast);
  }
  if (editing) {
    return (
      <div className="space-y-2 pt-3">
        {/* Profile picture */}
        <div className="flex items-center gap-3 pb-1">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-brand to-pink-500 flex items-center justify-center text-xl font-black shrink-0">
            {avatarUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : (name.charAt(0) || "🙂")}
          </div>
          <div>
            <label className={`text-xs bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg cursor-pointer inline-block ${avatarBusy ? "opacity-50 pointer-events-none" : ""}`}>
              {avatarBusy ? "מעלה…" : "החלפת תמונה"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
            </label>
            <p className="text-[10px] text-white/30 mt-1">JPG / PNG / WEBP עד 2MB</p>
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">{labelName}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={namePh}
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        </div>
        {/* Email — read-only. The account identity can't be changed here. */}
        <div>
          <label className="block text-[10px] text-white/40 mb-1">{labelEmail}</label>
          <input value={profile.email} readOnly disabled dir="ltr"
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/40 cursor-not-allowed" />
          <p className="text-[10px] text-white/30 mt-0.5">לא ניתן לשנות את כתובת המייל</p>
        </div>
        {/* Phone — optional; saved to Supabase so it appears in admin. */}
        <div>
          <label className="block text-[10px] text-white/40 mb-1">טלפון (אופציונלי)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" dir="ltr"
            inputMode="tel" placeholder="050-0000000"
            className="w-full bg-bg-input border border-white/10 rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy}
            className="flex-1 py-1.5 bg-brand text-white text-xs font-bold rounded disabled:opacity-60">{busy ? "שומר…" : saveBtn}</button>
          <button onClick={() => setEditing(false)} className="py-1.5 px-3 bg-white/5 text-xs rounded">{cancelBtn}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-xs pt-3">
      <div className="flex justify-between"><span className="text-white/40">{labelName}</span><span>{profile.name}</span></div>
      <div className="flex justify-between"><span className="text-white/40">{labelEmail}</span><span className="text-white/70 truncate max-w-[200px]" dir="ltr">{profile.email}</span></div>
      {profile.phone && (
        <div className="flex justify-between"><span className="text-white/40">טלפון</span><span className="text-white/70" dir="ltr">{profile.phone}</span></div>
      )}
      <div className="flex justify-between"><span className="text-white/40">{labelMs}</span><span>{new Date(profile.joinedAt).toLocaleDateString("he-IL")}</span></div>
      <button onClick={() => setEditing(true)}
        className="mt-2 text-[11px] text-brand-light hover:text-white flex items-center gap-1">
        <Pencil className="w-3 h-3" /> {editBtn}
      </button>
    </div>
  );
}
