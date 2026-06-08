/**
 * SFX library with human-readable Hebrew names.
 *
 * 65 sounds total. Names are HEURISTIC (chosen by file weight + Mixkit
 * naming patterns, since we can't auto-listen). The user can rename any
 * entry from the admin CMS later. The category field powers the
 * categorized picker UI.
 */

import type { SfxKind } from "./keywordElements";

export type SfxCategory =
  | "clicks"      // UI clicks, taps, pops
  | "notifications" // dings, bells, chimes
  | "transitions" // whooshes, swipes, risers
  | "impacts"     // booms, hits, slams
  | "money"       // cha-ching, coin drops
  | "viral"       // vine boom, anime wow, bruh
  | "vehicles"    // car, engine, horn
  | "celebration" // applause, fanfare, win
  | "voice"       // human laughs/gasps
  | "fx";         // misc effects

export type SfxAsset = {
  id: string;
  url: string;
  /** Hebrew name shown in picker */
  label: string;
  category: SfxCategory;
  weight: "tiny" | "short" | "medium" | "long";
};

// HONEST naming: I can't listen to these files, so old labels like
// "vine boom" or "cha-ching" were guesses that often missed.
// New scheme: generic "{category short prefix} #N" with the length tag.
// Liat picks by ear via the Play button in SfxPicker, and can rename
// any entry via the admin CMS once she finds a good fit.
//
// Length tag: T=טיני, S=קצר, M=בינוני, L=ארוך
const RAW_NUMBERED = [
  // clicks
  ["clicks", "tiny",   ["1019","1082","1115","1565","1062","1022","1016","1031","2010"]],
  ["clicks", "short",  ["2017","2876","1034","2022"]],
  // notifications
  ["notifications", "short",  ["1432","2870","2872","2997","2998","2999","3000","2003","219","220","1438"]],
  ["notifications", "medium", ["270","1437"]],
  ["notifications", "long",   ["2871"]],
  // transitions
  ["transitions", "short",  ["1109","1077","1108","1044","2014","2019"]],
  ["transitions", "medium", ["1025","1037","1053","1095","1148","1151"]],
  // impacts
  ["impacts", "short",  ["2448"]],
  ["impacts", "medium", ["951","1090","1100","1066","1028","1056","1058"]],
  // money
  ["money", "short",  ["888","2018"]],
  ["money", "medium", ["2425"]],
  ["money", "long",   ["1442"]],
  // viral
  ["viral", "medium", ["1445"]],
  ["viral", "long",   ["1996","1997","1057","1040","1149"]],
  // celebration
  ["celebration", "medium", ["941"]],
  ["celebration", "long",   ["2664","1050","1070","1047","2007","2440","2444"]],
] as const;

const CAT_PREFIX: Record<SfxCategory, string> = {
  clicks:        "קליק",
  notifications: "התראה",
  transitions:   "מעבר",
  impacts:       "אימפקט",
  money:         "כסף",
  viral:         "ויראלי",
  celebration:   "חגיגה",
  vehicles:      "רכב",
  voice:         "קול",
  fx:            "אפקט",
};

const RAW: Array<Omit<SfxAsset, "url">> = [];
{
  // Build numbered labels per (category, weight) group
  const perCatCounter: Record<string, number> = {};
  for (const [category, weight, ids] of RAW_NUMBERED) {
    for (const id of ids) {
      const cat = category as SfxCategory;
      const w = weight as SfxAsset["weight"];
      perCatCounter[cat] = (perCatCounter[cat] ?? 0) + 1;
      const n = perCatCounter[cat];
      RAW.push({
        id,
        label: `${CAT_PREFIX[cat]} #${n}`,
        category: cat,
        weight: w,
      });
    }
  }
}

export const SFX_LIBRARY: SfxAsset[] = RAW.map((a) => ({
  ...a,
  url: `/sfx/sfx_${a.id}.mp3`,
}));

const BY_ID: Record<string, SfxAsset> = Object.fromEntries(
  SFX_LIBRARY.map((a) => [a.id, a]),
);

export function getSfxAsset(id: string | undefined): SfxAsset | null {
  if (!id || id === "none") return null;
  return BY_ID[id] ?? null;
}

/** Group SFX by category (preserves insertion order within each group). */
export function listSfxByCategory(): Array<{ category: SfxCategory; items: SfxAsset[] }> {
  const order: SfxCategory[] = [
    "clicks", "notifications", "transitions", "impacts",
    "money", "viral", "celebration", "vehicles", "voice", "fx",
  ];
  return order
    .map((c) => ({ category: c, items: SFX_LIBRARY.filter((a) => a.category === c) }))
    .filter((g) => g.items.length > 0);
}

export const SFX_CATEGORY_LABEL: Record<SfxCategory, string> = {
  clicks:        "קליקים ופופים",
  notifications: "התראות ודינג",
  transitions:   "מעברים (וושש)",
  impacts:       "אימפקטים ובום",
  money:         "כסף ועסקים",
  viral:         "ויראלי",
  celebration:   "חגיגה וזכייה",
  vehicles:      "רכב ותחבורה",
  voice:         "קולות אנושיים",
  fx:            "אפקטים שונים",
};

/**
 * Defaults for the 6 legacy SfxKind values (used when admin hasn't picked
 * an override for a specific element). Picked by intent → category fit.
 */
export const DEFAULT_SFX_FOR_KIND: Record<SfxKind, string> = {
  ding: "1432",         // דינג התראה
  zap: "2018",          // צ'ה־צ'ינג (sharp + electric)
  whoosh: "1109",       // וושש קצר
  "cha-ching": "888",   // מטבעות
  boom: "951",          // אימפקט קולנועי
  chime: "270",         // ניצחון משחק
};

export function defaultUrlForKind(kind: SfxKind): string {
  const id = DEFAULT_SFX_FOR_KIND[kind];
  return BY_ID[id]?.url ?? "";
}

export function sfxFilePath(id: string, projectRoot: string): string {
  return require("path").join(projectRoot, "public", "sfx", `sfx_${id}.mp3`);
}
