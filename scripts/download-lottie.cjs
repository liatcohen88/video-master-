#!/usr/bin/env node
/**
 * One-shot Lottie JSON downloader. Pulls a curated set of vector animations
 * from LottieFiles' legacy CDN to public/lottie/{slug}.json
 *
 * Run: node scripts/download-lottie.cjs
 *
 * URLs were researched + HTTP-200 verified individually. If LottieFiles
 * retires the legacy assets1-10 CDN, switch to .lottie zip ingestion.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const LOTTIES = [
  { slug: "trophy",         url: "https://assets9.lottiefiles.com/packages/lf20_touohxv0.json" },
  { slug: "checkmark",      url: "https://assets6.lottiefiles.com/packages/lf20_jbrw3hcz.json" },
  { slug: "food",           url: "https://assets10.lottiefiles.com/packages/lf20_K0864uP6eC.json" },
  { slug: "robot",          url: "https://assets2.lottiefiles.com/packages/lf20_GbabwrUY2k.json" },
  { slug: "hand-pointer",   url: "https://assets7.lottiefiles.com/packages/lf20_Yc2PU8DdfX.json" },
  { slug: "party-confetti", url: "https://assets1.lottiefiles.com/packages/lf20_xvz0dpbn.json" },
  { slug: "clock",          url: "https://assets2.lottiefiles.com/private_files/lf30_vcwnens3.json" },
  { slug: "heart",          url: "https://assets1.lottiefiles.com/packages/lf20_u4j3xm6r.json" },
  { slug: "gift",           url: "https://assets2.lottiefiles.com/packages/lf20_wsywufs8.json" },
  { slug: "hello",          url: "https://assets9.lottiefiles.com/packages/lf20_M9p23l.json" },
  { slug: "cloud-upload",   url: "https://assets4.lottiefiles.com/private_files/lf30_t26law.json" },
  { slug: "phone",          url: "https://assets7.lottiefiles.com/packages/lf20_nDZD95BlQM.json" },
  { slug: "namaste",        url: "https://assets1.lottiefiles.com/private_files/lf30_QLsD8M.json" },
  { slug: "gift-new",       url: "https://assets3.lottiefiles.com/packages/lf20_UJNc2t.json" },
  { slug: "chat",           url: "https://assets9.lottiefiles.com/packages/lf20_hKebN8.json" },
  { slug: "chart-up",       url: "https://assets3.lottiefiles.com/packages/lf20_zhl8lan4.json" },
  { slug: "analytics",      url: "https://assets5.lottiefiles.com/packages/lf20_yvkok161.json" },
  { slug: "meditate",       url: "https://assets7.lottiefiles.com/packages/lf20_7fCbvNSmFD.json" },
  { slug: "wave",           url: "https://assets5.lottiefiles.com/packages/lf20_V9t630.json" },
  { slug: "sanitizer",      url: "https://assets1.lottiefiles.com/private_files/lf30_yQtj4O.json" },
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
        console.log(`FAIL ${slug}: HTTP ${res.statusCode}`);
        res.resume();
        return resolve({ slug, ok: false });
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        // basic Lottie sanity check
        const head = buf.slice(0, 50).toString();
        if (!head.includes('"v"')) {
          console.log(`FAIL ${slug}: not Lottie JSON (head=${head.slice(0,40)})`);
          return resolve({ slug, ok: false });
        }
        fs.writeFileSync(dst, buf);
        console.log(`OK   ${slug}  ${(buf.length / 1024).toFixed(1)} KB`);
        resolve({ slug, ok: true, size: buf.length });
      });
    }).on("error", (e) => { console.log(`ERR ${slug}: ${e.message}`); resolve({ slug, ok: false }); });
  });
}

(async () => {
  console.log(`Downloading ${LOTTIES.length} Lotties to ${OUT_DIR} ...`);
  const queue = [...LOTTIES];
  const results = [];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) results.push(await dl(queue.shift()));
  });
  await Promise.all(workers);
  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone. ${ok}/${LOTTIES.length} succeeded.`);
})();
