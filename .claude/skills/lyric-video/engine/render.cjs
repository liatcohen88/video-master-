// Frame-by-frame renderer: drives index.html's renderFrame(t) in headless Chromium
// and pipes the screenshots into ffmpeg. Long timelines split across workers.
//   node render.cjs out=out/preview.mp4 [start=0 end=5.2 fps=30 workers=3 audio=song.mp3 audioStart=0]
//     faster drafts: img=jpeg preset=medium
//   node render.cjs stills=0.3,1.2,2.0 dir=out/stills
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return [a.slice(0, i), a.slice(i + 1)];
}));
const W = 1080, H = 1920;
const FPS = +(args.fps || 30);
const CRF = String(args.crf || 17);
const IMG = args.img === 'jpeg' ? 'jpeg' : 'png';
const PRESET = args.preset || 'slow';
const PAGE = 'file://' + path.resolve(__dirname, args.page || 'index.html');

async function openPage() {
  const browser = await chromium.launch({
    args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return { browser, page };
}

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: 'inherit' });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
  });
}

async function renderSegment(f0, f1, start, file) {
  const { browser, page } = await openPage();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', IMG === 'jpeg' ? 'mjpeg' : 'png',
    '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-pix_fmt', 'yuv420p', '-r', String(FPS), file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise(r => ff.on('close', r));
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderFrame(t), start + f / FPS);
    const buf = await page.screenshot(IMG === 'jpeg' ? { type: 'jpeg', quality: 95 } : { type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 30 === 0) console.log(`[${f0}-${f1}] frame ${f}`);
  }
  ff.stdin.end();
  await closed;
  await browser.close();
}

(async () => {
  if (args.stills) {
    const dir = path.resolve(__dirname, args.dir || 'out/stills');
    fs.mkdirSync(dir, { recursive: true });
    const { browser, page } = await openPage();
    for (const s of args.stills.split(',')) {
      const t = +s;
      await page.evaluate(t => window.renderFrame(t), t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2)}.png`) });
    }
    await browser.close();
    console.log('stills ->', dir);
    return;
  }

  if (args.segment) {
    await renderSegment(+args.f0, +args.f1, +args.start, args.segment);
    return;
  }

  const start = +(args.start || 0);
  let end = +args.end;
  if (!end) {
    const { browser, page } = await openPage();
    end = await page.evaluate(() => window.DURATION);
    await browser.close();
  }
  const out = path.resolve(__dirname, args.out || 'out/preview.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const n = Math.round((end - start) * FPS);
  const workers = Math.max(1, +(args.workers || 3));
  const per = Math.ceil(n / workers);
  const t0 = Date.now();

  const segs = [], jobs = [];
  for (let i = 0; i < workers && i * per < n; i++) {
    const seg = `${out}.part${i}.mp4`;
    segs.push(seg);
    jobs.push(run(process.execPath, [__filename, `page=${args.page || 'index.html'}`, `fps=${FPS}`, `crf=${CRF}`, `img=${IMG}`, `preset=${PRESET}`,
      `segment=${seg}`, `f0=${i * per}`, `f1=${Math.min(n, (i + 1) * per)}`, `start=${start}`]));
  }
  await Promise.all(jobs);

  const list = `${out}.txt`;
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const mux = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (args.audio) {
    mux.push('-ss', String(+(args.audioStart || 0) + start), '-i', path.resolve(args.audio),
      '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  }
  mux.push('-c:v', 'copy', '-movflags', '+faststart', out);
  await run('ffmpeg', mux);
  for (const f of [...segs, list]) fs.unlinkSync(f);
  console.log('done ->', out, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
})();
