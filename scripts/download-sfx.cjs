#!/usr/bin/env node
/**
 * One-shot download of free CC-licensed SFX from Mixkit's public CDN.
 * Pattern: https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3
 *
 * IDs below were probed in advance (HEAD 200). Run once:
 *   node scripts/download-sfx.cjs
 * Files land in public/sfx/  named  sfx_<id>.mp3 .
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const IDS = [
  // Probed batch A (UI/notification/click/ding range)
  270, 219, 220, 1057, 1109, 888, 941, 951, 1432, 1565,
  1996, 1997, 2003, 2017, 2018, 2425, 2664, 2870, 2871,
  2872, 2876, 2997, 2998, 2999, 3000,
  // Probed batch B (1016..1110 range — UI/transition/whoosh family)
  1016, 1019, 1022, 1025, 1028, 1031, 1034, 1037, 1040,
  1044, 1047, 1050, 1053, 1056, 1058, 1062, 1066, 1070,
  1077, 1082, 1090, 1095, 1100, 1108, 1115,
];

const OUT_DIR = path.join(__dirname, "..", "public", "sfx");
fs.mkdirSync(OUT_DIR, { recursive: true });

function dl(id) {
  return new Promise((resolve) => {
    const url = `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`;
    const dst = path.join(OUT_DIR, `sfx_${id}.mp3`);
    if (fs.existsSync(dst) && fs.statSync(dst).size > 1024) {
      console.log(`SKIP ${id} (exists)`);
      return resolve({ id, ok: true, skipped: true });
    }
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          console.log(`FAIL ${id} HTTP ${res.statusCode}`);
          res.resume();
          return resolve({ id, ok: false });
        }
        const f = fs.createWriteStream(dst);
        res.pipe(f);
        f.on("finish", () => {
          f.close();
          const sz = fs.statSync(dst).size;
          console.log(`OK   ${id}  ${(sz / 1024).toFixed(1)} KB`);
          resolve({ id, ok: true, size: sz });
        });
      })
      .on("error", (e) => {
        console.log(`ERR  ${id}  ${e.message}`);
        resolve({ id, ok: false });
      });
  });
}

(async () => {
  console.log(`Downloading ${IDS.length} SFX to ${OUT_DIR} ...`);
  const results = [];
  // Concurrency 6 to be kind to the CDN
  const queue = [...IDS];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      results.push(await dl(id));
    }
  });
  await Promise.all(workers);
  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone. ${ok}/${IDS.length} succeeded.`);
})();
