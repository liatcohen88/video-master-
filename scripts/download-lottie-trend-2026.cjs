#!/usr/bin/env node
/**
 * 2026 trend Lottie batch — modern viral-style animations to refresh the
 * gallery beyond the original 23. URLs from LottieFiles' public CDN.
 *
 * Run: node scripts/download-lottie-trend-2026.cjs
 *
 * Each file is HTTP-200 verified at write time; any URL that 404s is
 * reported in the summary so Liat can swap it via /admin → Lottie upload.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Curated trend picks — punchy / social-video friendly. lottie.host paths
// are the new official CDN (stable since 2024). Legacy assetsN.lottiefiles
// paths still work and are kept for variety.
const LOTTIES = [
  // Reactions / social
  { slug: "fire-2026",       url: "https://assets10.lottiefiles.com/packages/lf20_h4Th9ofG3F.json" },
  { slug: "thumbs-up",       url: "https://assets3.lottiefiles.com/packages/lf20_BkXymY.json" },
  { slug: "like-heart",      url: "https://assets9.lottiefiles.com/packages/lf20_jzqvldwc.json" },
  { slug: "subscribe",       url: "https://assets10.lottiefiles.com/packages/lf20_aZRSDc.json" },
  { slug: "bell-notify",     url: "https://assets4.lottiefiles.com/packages/lf20_RHdEuzVfEL.json" },
  // Money / business
  { slug: "coins-shower",    url: "https://assets4.lottiefiles.com/packages/lf20_NXMVoF.json" },
  { slug: "credit-card",     url: "https://assets5.lottiefiles.com/private_files/lf30_jh2nm0xl.json" },
  { slug: "discount-tag",    url: "https://assets3.lottiefiles.com/packages/lf20_2pgxorhz.json" },
  // Energy / wow
  { slug: "sparkle-burst",   url: "https://assets4.lottiefiles.com/packages/lf20_obhph3sh.json" },
  { slug: "lightning",       url: "https://assets8.lottiefiles.com/packages/lf20_BO5JeF.json" },
  { slug: "explosion",       url: "https://assets2.lottiefiles.com/packages/lf20_lyldoavc.json" },
  // Arrows / pointers
  { slug: "arrow-down",      url: "https://assets1.lottiefiles.com/packages/lf20_O2WBJh.json" },
  { slug: "swipe-up",        url: "https://assets3.lottiefiles.com/packages/lf20_KfA6E2.json" },
  // Trust / quality
  { slug: "shield-check",    url: "https://assets10.lottiefiles.com/private_files/lf30_editor_qgg9xn0e.json" },
  { slug: "five-stars",      url: "https://assets5.lottiefiles.com/packages/lf20_C7zNwM.json" },
];

const OUT_DIR = path.join(__dirname, "..", "public", "lottie");
fs.mkdirSync(OUT_DIR, { recursive: true });

function dl({ slug, url }) {
  return new Promise((resolve) => {
    const dst = path.join(OUT_DIR, `${slug}.json`);
    if (fs.existsSync(dst) && fs.statSync(dst).size > 1024) {
      console.log(`SKIP ${slug}`);
      return resolve({ slug, ok: true, skipped: true });
    }
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.log(`MISS ${slug} (HTTP ${res.statusCode})`);
        res.resume();
        return resolve({ slug, ok: false, status: res.statusCode });
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        try {
          const j = JSON.parse(buf.toString("utf8"));
          if (!j.layers) throw new Error("not lottie");
          // Reject raster-only (the fire.json bug)
          const rasterOnly = Array.isArray(j.assets) && j.assets.some(
            (a) => typeof a.p === "string" && /^data:image\/(png|jpe?g)/i.test(a.p),
          );
          if (rasterOnly) {
            console.log(`RASTER ${slug} — skipping`);
            return resolve({ slug, ok: false, raster: true });
          }
        } catch (e) {
          console.log(`BAD ${slug} — ${e.message}`);
          return resolve({ slug, ok: false, err: e.message });
        }
        fs.writeFileSync(dst, buf);
        console.log(`OK   ${slug} (${(buf.length / 1024).toFixed(1)} KB)`);
        resolve({ slug, ok: true });
      });
    }).on("error", (e) => {
      console.log(`ERR  ${slug} — ${e.message}`);
      resolve({ slug, ok: false, err: e.message });
    });
  });
}

(async () => {
  const results = await Promise.all(LOTTIES.map(dl));
  const ok = results.filter((r) => r.ok && !r.skipped);
  const skip = results.filter((r) => r.skipped);
  const fail = results.filter((r) => !r.ok);
  console.log(`\n--- ${ok.length} downloaded, ${skip.length} skipped, ${fail.length} failed ---`);
  if (fail.length) {
    console.log("Failed (upload manually via /admin → Lottie):");
    fail.forEach((f) => console.log(`  ${f.slug}: ${f.status || f.err || "raster"}`));
  }
})();
