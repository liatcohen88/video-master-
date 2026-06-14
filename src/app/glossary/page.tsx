"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, Film, Tag } from "lucide-react";
import { useContent } from "@/lib/useContent";
import { resolveBrandLogos, brandLogoCdnUrl } from "@/lib/brandLogos";
import { DRAMA_WORDS_BASE } from "@/lib/dramaEffects";
import { KEYWORD_CATEGORIES } from "@/lib/keywordElements";
import SiteHeader from "@/components/SiteHeader";

/**
 * /glossary — public reference of EVERYTHING the AI auto-detects:
 *   - Brand logos (Amazon, AliExpress, etc.) + admin-added brands once we
 *     wire the registry to a CMS key (today: hard-coded list).
 *   - Drama words → triggers black-and-white filter + dramatic sting sound
 *   - Keyword categories → triggers animated elements (money, love, fire…)
 *
 * Liat: "המילון יראה טוב ויכלול הכל. כל מה שאני מעלה באדמין משנה
 *       שישתנה אוטומטית בהכל וגם שם."
 * → Every CMS-driven extras list (drama.extraWords etc.) shows up here
 *   automatically because the source-of-truth IS the CMS.
 */
export default function GlossaryPage() {
  // CMS additions — drama and keywords let the admin add custom words
  const dramaExtras = (useContent("drama.extraWords") as string[]) ?? [];
  const dramaHidden = (useContent("drama.hiddenWords") as string[]) ?? [];
  const dramaHiddenSet = new Set(dramaHidden);

  const intro     = useContent("glossary.intro") as string;
  const brandsTitle  = useContent("glossary.brands.title") as string;
  const brandsBody   = useContent("glossary.brands.body") as string;
  const dramaTitle   = useContent("glossary.drama.title") as string;
  const dramaBody    = useContent("glossary.drama.body") as string;
  const elementsTitle= useContent("glossary.elements.title") as string;
  const elementsBody = useContent("glossary.elements.body") as string;
  const backToApp    = useContent("glossary.backToApp") as string;

  return (
    <div dir="rtl" className="min-h-screen text-white">
      <div className="px-6 pt-6"><SiteHeader /></div>

      <div className="relative max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4 shadow-lg shadow-brand/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3">המילון של מאסטר וידאו</h1>
          <p className="text-white/60 text-sm max-w-2xl mx-auto">{intro}</p>
        </div>

        {/* ── Brands ── */}
        <Section
          icon={<Tag className="w-5 h-5" />}
          title={brandsTitle}
          body={brandsBody}
          accent="from-violet-500/15 to-purple-500/5"
          iconBg="bg-violet-500/20 text-violet-200"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {resolveBrandLogos().map((b) => (
              <div key={b.id}
                className="bg-bg-card border border-white/10 rounded-xl p-3 flex flex-col items-center text-center hover:border-white/25 transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoCdnUrl(b)}
                  alt={b.name}
                  className="w-10 h-10 mb-2 object-contain"
                  loading="lazy"
                  style={{ filter: `drop-shadow(0 0 8px #${b.color}55)` }}
                />
                <div className="text-sm font-bold">{b.name}</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {previewPattern(b.patterns[0])}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Drama words ── */}
        <Section
          icon={<Film className="w-5 h-5" />}
          title={dramaTitle}
          body={dramaBody}
          accent="from-red-500/15 to-orange-500/5"
          iconBg="bg-red-500/20 text-red-200"
        >
          <div className="flex flex-wrap gap-2">
            {DRAMA_WORDS_BASE.filter((p) => !dramaHiddenSet.has(p.key)).map((p) => (
              <span key={p.key}
                className="inline-flex items-center gap-1 bg-red-500/10 border border-red-400/30 text-red-200 text-sm px-3 py-1 rounded-full">
                🎬 {p.key}
              </span>
            ))}
            {dramaExtras.map((w) => (
              <span key={`x-${w}`}
                className="inline-flex items-center gap-1 bg-red-500/15 border border-red-300/40 text-red-100 text-sm px-3 py-1 rounded-full">
                ➕ {w}
              </span>
            ))}
          </div>
        </Section>

        {/* ── Keyword categories ── */}
        <Section
          icon={<Sparkles className="w-5 h-5" />}
          title={elementsTitle}
          body={elementsBody}
          accent="from-amber-500/15 to-yellow-500/5"
          iconBg="bg-amber-500/20 text-amber-200"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KEYWORD_CATEGORIES.map((cat) => (
              <div key={cat.id}
                className="bg-bg-card border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="font-bold text-sm">{categoryLabel(cat.id)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.patterns.slice(0, 8).map((p, i) => (
                    <span key={i}
                      className="bg-white/5 border border-white/10 text-white/80 text-xs px-2 py-0.5 rounded">
                      {previewPattern(p)}
                    </span>
                  ))}
                  {cat.patterns.length > 8 && (
                    <span className="text-[10px] text-white/40 px-1 py-0.5">+ {cat.patterns.length - 8} עוד</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="text-center mt-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> {backToApp}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, body, accent, iconBg, children }: {
  icon: React.ReactNode; title: string; body: string;
  accent: string; iconBg: string; children: React.ReactNode;
}) {
  return (
    <section className={`bg-gradient-to-br ${accent} border border-white/10 rounded-2xl p-6 md:p-7 mb-5`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
        <h2 className="text-lg md:text-xl font-bold">{title}</h2>
      </div>
      <p className="text-sm text-white/65 leading-relaxed mb-5">{body}</p>
      {children}
    </section>
  );
}

/**
 * Turn a RegExp pattern into a readable Hebrew phrase for display.
 * Strips lookarounds, non-capturing groups, alternation, quantifiers, and
 * escapes — so users see "אני לא מאמין" instead of
 * /(?:^|\s)(?:אני|אנחנו)\s+לא\s+מאמין(?=\s|$)/u (with the `?:` and `?` and
 * `|` characters leaking through).
 *
 * If the cleaned form is still messy (multiple alternatives, complex
 * groups), returns the longest readable alternative inside the pattern.
 */
function previewPattern(re: RegExp): string {
  let s = re.source
    // Strip all lookarounds: (?=...) (?!...) (?<=...) (?<!...)
    .replace(/\(\?<?[=!][^)]*\)/g, "")
    // Strip non-capturing group MARKERS (?:  — keep contents, just drop the marker
    .replace(/\(\?:/g, "(")
    // Strip word boundaries and common whitespace patterns
    .replace(/\\b/g, "")
    .replace(/\\s\+/g, " ")
    .replace(/\\s\*/g, " ")
    .replace(/\\s\?/g, " ")
    // Collapse remaining double-backslash
    .replace(/\\\\/g, "\\")
    // Unescape punctuation we'd otherwise show with a backslash
    .replace(/\\([.()\[\]+*?|])/g, "$1");

  // If the (cleaned) pattern has alternation, prefer the first/longest
  // alternative so we don't show "אני|אנחנו לא מאמין".
  if (s.includes("|")) {
    // Pick the longest alternative on the TOP level inside the outermost group
    const inner = s.match(/^\(([^()]*)\)/)?.[1] ?? s.replace(/^\(|\)$/g, "");
    const alts = inner.split("|");
    s = alts.reduce((a, b) => (b.trim().length > a.trim().length ? b : a), "");
  }

  // Remove leftover parens + standalone quantifiers
  return s
    .replace(/[()]/g, "")
    .replace(/\?(?![^ ]*[א-ת])/g, "") // drop ? quantifiers but keep Hebrew "?" punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function categoryLabel(id: string): string {
  const map: Record<string, string> = {
    money:       "כסף",
    speed:       "מהירות / זריזות",
    important:   "חשוב / דחוף",
    question:    "שאלה",
    love:        "אהבה",
    growth:      "צמיחה / הצלחה",
    free:        "חינם / מתנה",
    secret:      "סוד",
    cta:         "קריאה לפעולה",
    fire:        "אש / לוהט",
    car:         "רכב",
    food:        "אוכל",
    place:       "מקום",
    time:        "זמן",
    winner:      "ניצחון",
    thinking:    "חשיבה",
    shocked:     "הלם / הפתעה",
    warning:     "אזהרה",
    celebration: "חגיגה",
    party:       "מסיבה",
    travel:      "טיולים",
    music:       "מוזיקה",
    sports:      "ספורט",
    tech:        "טכנולוגיה",
    nature:      "טבע",
    star:        "כוכב / סלב",
  };
  return map[id] ?? id;
}
