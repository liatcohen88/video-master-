/**
 * Standalone Lottie → transparent MOV renderer (runs in its OWN Node process
 * so the DOM shim never pollutes the Next.js server process).
 *
 * Usage:
 *   node render-lottie.cjs <jsonPath> <outMov> <size> <fps> <durationSec> [colorHex] [ffmpegPath]
 *
 * Prints "OK" on success, "FAIL <reason>" on error.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createCanvas } = require("@napi-rs/canvas");

// ── DOM shim (isolated to this process) ──────────────────────────────────
global.window = {
  devicePixelRatio: 1,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  location: { protocol: "http:", href: "http://localhost/", host: "localhost" },
};
global.navigator = { userAgent: "node" };
global.document = {
  createElement: (tag) =>
    tag === "canvas"
      ? createCanvas(1, 1)
      : { style: {}, getContext: () => ({}), appendChild: () => {}, setAttribute: () => {} },
  createElementNS: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
  getElementsByTagName: () => [],
};

function applyColor(data, hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      if ((n.ty === "fl" || n.ty === "st") && n.c && Array.isArray(n.c.k) && n.c.k.length >= 3) {
        n.c.k = [r, g, b, n.c.k[3] != null ? n.c.k[3] : 1];
      }
      Object.values(n).forEach(walk);
    }
  };
  walk(data);
  return data;
}

async function main() {
  const [jsonPath, outMov, sizeS, fpsS, durS, colorHex, ffmpegArg] = process.argv.slice(2);
  const size = parseInt(sizeS, 10);
  const fps = parseInt(fpsS, 10);
  const durationSec = parseFloat(durS);
  const ffmpeg = ffmpegArg || process.env.FFMPEG_PATH || "ffmpeg";

  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (e) {
    console.log("FAIL read-json " + e.message);
    process.exit(1);
  }
  if (colorHex && colorHex !== "orig") applyColor(data, colorHex);

  const lottie = require("lottie-web");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  let anim;
  try {
    anim = lottie.loadAnimation({
      renderer: "canvas",
      loop: false,
      autoplay: false,
      animationData: data,
      rendererSettings: { context: ctx, clearCanvas: true },
    });
  } catch (e) {
    console.log("FAIL load " + e.message);
    process.exit(1);
  }

  const totalFrames = Math.max(1, Math.floor(anim.totalFrames));
  const outFrames = Math.max(1, Math.round(durationSec * fps));
  const framesDir = outMov + ".frames";
  fs.mkdirSync(framesDir, { recursive: true });
  for (let i = 0; i < outFrames; i++) {
    anim.goToAndStop(i % totalFrames, true);
    fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(5, "0")}.png`), canvas.toBuffer("image/png"));
  }
  anim.destroy();

  await new Promise((res) => {
    const p = spawn(ffmpeg, [
      "-y", "-framerate", String(fps),
      "-i", path.join(framesDir, "f%05d.png"),
      "-c:v", "qtrle", "-pix_fmt", "argb", outMov,
    ]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
      if (code === 0) { console.log("OK"); res(); }
      else { console.log("FAIL encode " + err.slice(-200)); process.exit(1); }
    });
    p.on("error", (e) => { console.log("FAIL spawn " + e.message); process.exit(1); });
  });
}

main().catch((e) => { console.log("FAIL " + e.message); process.exit(1); });
