// Lyric engine: turns window.LYRICS (lines + tapped times + beat grid) into the
// song-length part of the video, in the same western-poster worlds as the intro.
// Loaded after index.html's inline script and uses its helpers (ease, lerp, rng, ...).
(() => {
  const D = window.LYRICS;
  if (!D || !Array.isArray(D.lines) || !D.lines.some(l => l.t != null)) return;

  const OPENER = 5.2;   // opener length inside the intro timeline
  const E = window.LyricEngine = { active: true };
  const lines = D.lines.filter(l => l.t != null && String(l.text || '').trim()).map((l, i) => ({
    i, text: String(l.text).trim(), label: String(l.label || '').trim(), t: +l.t,
    world: l.world || null, given: Array.isArray(l.words) ? l.words : null,
  }));
  const KW = Object.assign({ good: '^ו?ה?טוב$', bad: '^ו?ה?רע$', hero: '^ו?[עא]ודיה$' }, D.keywords || {});
  const KWRE = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new RegExp(v)]));
  const TITLE = Object.assign({ l1: ['הטוב', 'הרע'], l2: 'ועודיה' }, D.title || {});
  lines.sort((a, b) => a.t - b.t);
  const first = lines[0].t;
  const END = D.end != null ? +D.end : lines.at(-1).t + 3.5;
  const beats = (D.audio && D.audio.beats) || [];
  const onsets = (D.audio && D.audio.onsets) || [];
  const OUTRO = 4.5;
  E.start = first - .12;
  E.duration = +(D.duration || (D.audio && D.audio.duration && Math.min(D.audio.duration, END + OUTRO)) || END + OUTRO).toFixed(3);
  window.DURATION = E.duration;

  // ---------- intro placement: the intro has to end right before the first sung line ----------
  const avail = E.start - .1;
  if (avail >= T.end) E.introTime = t => t;                         // full intro, wall holds until the vocals
  else if (avail >= OPENER + 1.4) {                                  // squeeze the credits
    const k = (T.end - OPENER) / (avail - OPENER);
    E.introTime = t => t <= OPENER ? t : OPENER + (t - OPENER) * k;
  } else if (avail >= 2.4) E.introTime = t => t * Math.min(OPENER, T.lockHit + .5) / avail;  // opener only, faster
  else E.introTime = t => t * 2;
  E.isLyrics = t => t >= E.start;

  // ---------- sections and worlds ----------
  const WORLDS = ['yellow', 'red', 'wall', 'night', 'dusk'];
  const count = new Map();
  for (const l of lines) count.set(l.text, (count.get(l.text) || 0) + 1);
  const sections = [];
  const hasLabels = lines.some(l => l.label);
  for (const l of lines) {
    const prev = sections.at(-1);
    const lastLine = prev && prev.lines.at(-1);
    const split = hasLabels ? !prev || prev.label !== l.label
      : !prev || (l.t - lastLine.t > 2.6 && prev.lines.length >= 2) || prev.lines.length >= 6;
    if (split) sections.push({ label: l.label, lines: [l] });
    else prev.lines.push(l);
  }
  let rot = 0;
  for (const s of sections) {
    const repeated = s.lines.filter(l => count.get(l.text) > 1).length / s.lines.length;
    const chorus = /פזמון|chorus|הוק|hook/i.test(s.label) || (!s.label && repeated >= .5) || /אודיה/.test(s.label);
    s.world = (D.worlds && D.worlds[s.label]) || (chorus ? 'dusk' : WORLDS[rot++ % 4]);
    for (const l of s.lines) l.world = l.world || s.world;
  }

  // ---------- timing: show window per line, word times snapped to the song's onsets ----------
  const nearest = (arr, x) => {
    let lo = 0, hi = arr.length - 1;
    if (hi < 0) return null;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; }
    const c = arr[lo], p = lo > 0 ? arr[lo - 1] : c;
    return Math.abs(p - x) < Math.abs(c - x) ? p : c;
  };
  lines.forEach((l, i) => {
    const next = i + 1 < lines.length ? lines[i + 1].t : END;
    if (l.given) {   // exact word times (composed songs)
      l.words = l.given.map(w => ({ text: String(w.text), t: +w.t }));
      l.lastWord = l.words.at(-1).t;
      l.out = Math.min(next, l.lastWord + 2.6);
      l.gapAfter = next - l.out;
      return;
    }
    const words = l.text.split(/\s+/).filter(Boolean);
    const spread = Math.max(.25, Math.min((next - l.t) * .82, .4 * words.length + .5));
    const wts = words.map(w => 1 + w.replace(/[^א-תA-Za-z0-9]/g, '').length * .35);
    const total = wts.reduce((a, b) => a + b, 0);
    let acc = 0, prevT = -1;
    l.words = words.map((w, k) => {
      let tw = l.t + spread * acc / total;
      acc += wts[k];
      const o = nearest(onsets, tw);
      if (o != null && Math.abs(o - tw) < (k ? .09 : .06) && o > prevT + .07) tw = o;
      prevT = tw;
      return { text: w, t: tw };
    });
    l.lastWord = l.words.at(-1).t;
    l.out = Math.min(next, l.lastWord + 2.6);       // leaves early when an instrumental gap follows
    l.gapAfter = next - l.out;
  });

  // ---------- styles ----------
  const css = document.createElement('style');
  css.textContent = `
  #sceneL .world { position: absolute; inset: 0; visibility: hidden; }
  #sceneL [data-world="yellow"] .base { background: radial-gradient(ellipse 70% 55% at 50% 42%, #f4bb45 0%, #e3a42c 48%, #c07e18 100%); }
  #sceneL [data-world="red"] .base { background: radial-gradient(ellipse 70% 55% at 50% 46%, #cc2429 0%, #a4161a 50%, #5e090c 100%); }
  #sceneL [data-world="dusk"] .base { background: linear-gradient(to bottom, #0b0403 0%, #1a0a06 20%, #37120a 40%, #722210 58%, #c2431c 72%, #ec7c2d 81%, #f6b157 88%, #f6b157 100%); }
  #sceneL [data-world="wall"] .wood { background-color: #3a2213; background-size: 100% 100%; }
  #sceneL [data-world="wall"] .lamp { background: radial-gradient(ellipse 72% 52% at 50% 42%, rgba(255, 196, 120, .30) 0%, rgba(255, 170, 90, .08) 45%, rgba(0, 0, 0, .45) 100%); mix-blend-mode: soft-light; }
  #sceneL .lhost { position: absolute; inset: 0; z-index: 5; }
  #sceneL .lfx, #sceneL .llock { z-index: 6; }
  #sceneL .wsun { position: absolute; left: 540px; top: 1080px; width: 860px; height: 860px; margin: -430px 0 0 -430px; border-radius: 50%;
    background: radial-gradient(circle at 50% 30%, #fff4d0 0%, #ffda84 24%, #f8a53d 56%, #e8692b 82%, #d24a21 100%);
    -webkit-mask-image: linear-gradient(to bottom, #000 0 57%, transparent 57% 59%, #000 59% 66%, transparent 66% 69.5%, #000 69.5% 75.5%, transparent 75.5% 80%, #000 80% 85.5%, transparent 85.5% 91%, #000 91%); }
  #sceneL .wglow { position: absolute; left: 540px; top: 1080px; width: 1800px; height: 1800px; margin: -900px 0 0 -900px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 190, 100, .6) 0%, rgba(245, 120, 46, .3) 28%, rgba(200, 60, 20, 0) 62%); mix-blend-mode: screen; }
  #sceneL .night { background: radial-gradient(ellipse 90% 60% at 50% 20%, #2a1a2e 0%, #160d18 45%, #0a0609 100%); }
  #sceneL .moon { position: absolute; left: 790px; top: 330px; width: 190px; height: 190px; margin: -95px 0 0 -95px; border-radius: 50%;
    background: radial-gradient(circle at 40% 38%, #fff8e6 0%, #f3e3bf 55%, #d9c49a 100%); box-shadow: 0 0 80px 20px rgba(255, 236, 190, .25); }
  #sceneL .ridge { position: absolute; left: -160px; right: -160px; bottom: -160px; height: 520px; background: #07040a;
    clip-path: polygon(0 40%, 12% 30%, 22% 36%, 35% 18%, 48% 30%, 60% 22%, 72% 34%, 86% 20%, 100% 32%, 100% 100%, 0 100%); }
  .lwrap { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); }
  .lline { width: 920px; display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; column-gap: .26em; row-gap: .02em;
    font-family: "Suez One", serif; line-height: 1.14; text-align: center; direction: rtl; }
  .lline .wd { display: inline-block; position: relative; opacity: 0; transform-origin: 50% 70%; white-space: nowrap; }
  .lline.w-yellow .wd { color: #140b07; text-shadow: -7px 5px 0 rgba(168, 24, 22, .5); }
  .lline.w-red .wd { color: #f7e8c8; }
  .lline.w-dusk .wd { color: #fcedcf; }
  .lline.w-wall .wd { color: #1a0f08; background: #ecdcb8; padding: .02em .2em .06em; border-radius: 2px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, .5), inset 0 0 26px rgba(110, 66, 20, .45); margin-block: .08em; }
  .lline.w-night .wd { color: #fbeed3; text-shadow: 0 0 26px rgba(255, 196, 120, .55), -4px 4px 0 rgba(0, 0, 0, .65); }
  .lline .wd.kw-good { color: #f3b63e; }
  .lline.w-yellow .wd.kw-good { color: #140b07; }
  .lline .wd.kw-bad { color: #ee3d30; }
  .lline.w-red .wd.kw-bad { color: #f7e8c8; }
  .lline.w-wall .wd.kw-good { color: #9a6a06; }
  .lline.w-wall .wd.kw-bad { color: #a4161a; }
  .lline .wd.kw-hero { color: #ffd27a; }
  #lyricLock { font-family: "Suez One", serif; text-align: center; line-height: 1.1; opacity: 0; white-space: nowrap; }
  #lyricLock .l1 span { display: inline-block; }
  #lyricLock .l1, #lyricLock .l2 { width: max-content; margin-inline: auto; }
  `;
  document.head.appendChild(css);

  // ---------- particles / flashes / kicks owned by the lyric part ----------
  const myEmitters = [], myFlashes = [], myKicks = [];

  // ---------- build ----------
  let scene, host, worldEls = {}, holes = [], sparkles = [];
  E.build = () => {
    scene = document.createElement('section');
    scene.id = 'sceneL'; scene.className = 'scene';
    $('cam').insertBefore(scene, $('burnSvg'));
    const clone = (sel, root) => [...root.querySelectorAll(sel)].map(n => { const c = n.cloneNode(true); c.removeAttribute('id'); return c; });
    const mk = (name, nodes) => {
      const w = document.createElement('div');
      w.className = 'world'; w.dataset.world = name;
      nodes.forEach(n => w.appendChild(n));
      scene.appendChild(w);
      worldEls[name] = w;
      return w;
    };
    mk('yellow', clone('.bg.base, .rays, .bg.halftone, .bg.paper', $('sceneA')));
    mk('red', clone('.bg.base, .rings, .cross, .bg.halftone, .bg.paper', $('sceneB')));
    const dusk = mk('dusk', clone('.bg.base', $('sceneC')));
    const glow = document.createElement('div'); glow.className = 'wglow';
    const sun = document.createElement('div'); sun.className = 'wsun';
    dusk.append(glow, sun, ...clone(':scope > svg.layer:not(#fxC)', $('sceneC')));
    mk('wall', clone('.bg.wood, .bg.lamp', $('sceneD')));
    const night = mk('night', []);
    night.innerHTML = '<div class="bg night"></div><div class="moon"></div><div class="ridge"></div>';
    worldEls.yellowRays = worldEls.yellow.querySelector('.rays');
    worldEls.redRings = worldEls.red.querySelector('.rings');
    worldEls.sun = sun; worldEls.glow = glow;

    host = document.createElement('div');
    host.className = 'lhost';
    scene.appendChild(host);
    const fx = svg('svg', { class: 'layer lfx', viewBox: '0 0 1080 1920' }, scene);
    fx.style.overflow = 'visible';

    // the title lockup for instrumental gaps and the outro
    const lock = document.createElement('div');
    lock.className = 'anchor llock'; lock.style.left = '540px'; lock.style.top = '900px';
    lock.innerHTML = '<div class="lwrap" id="lyricLock"><div class="l1"><span class="g"></span> <span class="b"></span></div><div class="l2"></div></div>';
    scene.appendChild(lock);
    const lk = $('lyricLock');
    lk.querySelector('.g').textContent = TITLE.l1[0];
    lk.querySelector('.b').textContent = TITLE.l1[1];
    lk.querySelector('.l2').textContent = TITLE.l2;
    lk.style.direction = D.dir || 'rtl';
    if (D.upper) lk.style.textTransform = 'uppercase';
    lk.querySelector('.l1').style.fontSize = '150px';
    lk.querySelector('.g').style.cssText = `color:#f3b63e; text-shadow:${blockShadow(12, '#160704', 4)}`;
    lk.querySelector('.b').style.cssText = `color:#ee3d30; text-shadow:${blockShadow(12, '#160704', 4)}`;
    const l2 = lk.querySelector('.l2');
    l2.style.fontSize = '290px'; l2.style.color = '#fcedcf';
    l2.style.textShadow = blockShadow(18, '#1c0805', 6, ['-30px 40px 50px rgba(20,4,0,.5)']);
    fit(lk.querySelector('.l1'), 900, 150);
    fit(l2, 900, 290);

    const shadows = {
      red: blockShadow(16, '#1a0505', 4, ['-26px 30px 34px rgba(0,0,0,.35)']),
      dusk: blockShadow(14, '#1c0805', 5, ['-24px 32px 40px rgba(20,4,0,.45)']),
    };
    for (const l of lines) {
      const a = document.createElement('div');
      a.className = 'anchor'; a.style.left = '540px'; a.style.top = '900px'; a.style.visibility = 'hidden';
      const wrap = document.createElement('div'); wrap.className = 'lwrap';
      const box = document.createElement('div'); box.className = 'lline w-' + l.world;
      box.style.direction = D.dir || 'rtl';
      if (D.upper) box.style.textTransform = 'uppercase';
      const r = rng(1000 + l.i);
      l.words.forEach(w => {
        const s = document.createElement('span');
        s.className = 'wd'; s.textContent = w.text;
        const bare = w.text.replace(/[^א-תA-Za-z]/g, '').toLowerCase();
        if (KWRE.good.test(bare)) w.kw = 'good';
        else if (KWRE.bad.test(bare)) w.kw = 'bad';
        else if (KWRE.hero.test(bare)) w.kw = 'hero';
        if (w.kw) s.classList.add('kw-' + w.kw);
        if (shadows[l.world]) s.style.textShadow = shadows[l.world];
        w.jitter = (r() - .5) * (l.world === 'wall' ? 7 : 10);
        w.el = s;
        box.appendChild(s);
      });
      wrap.appendChild(box); a.appendChild(wrap); host.appendChild(a);
      l.el = a; l.box = box;
      // fit: largest size that keeps the line within three rows and the safe area
      let size = l.world === 'wall' ? 300 : 340;   // short lines go big, long ones shrink to fit
      a.style.visibility = 'visible';
      for (; size > 64; size -= 6) {
        box.style.fontSize = size + 'px';
        const tooWide = l.words.some(w => w.el.offsetWidth > 900);
        if (!tooWide && box.offsetHeight <= Math.min(660, size * 1.14 * 3.3)) break;
      }
      a.style.visibility = 'hidden';
      l.size = size;
      l.wordPos = l.words.map(w => ({ x: 540 + (w.el.offsetLeft + w.el.offsetWidth / 2 - box.offsetWidth / 2), y: 900 + (w.el.offsetTop + w.el.offsetHeight / 2 - box.offsetHeight / 2) }));
      l.h = box.offsetHeight;
    }

    // keyword hits: dust, flashes, kicks, bullet holes, star glints
    lines.forEach((l, li) => {
      l.words.forEach((w, k) => {
        const p = l.wordPos[k];
        if (l.world === 'yellow' || l.world === 'red') myKicks.push({ t: w.t + .05, a: k ? 4 : 9 });
        if (!w.kw) return;
        myKicks.push({ t: w.t + .05, a: 16 });
        if (w.kw === 'bad' && D.holes !== false) {
          myFlashes.push({ t: w.t, a: .35, d: .07 });
          const g = svg('g', { opacity: 0 }, fx);
          svg('circle', { r: 22, fill: '#f1d9a8' }, g);
          svg('circle', { r: 15, fill: '#0d0303' }, g);
          const rr = rng(300 + li * 31 + k);
          for (let j = 0; j < 7; j++) {
            const an = j / 7 * Math.PI * 2 + rr() * .5, len = 14 + rr() * 26;
            svg('path', { d: `M${(Math.cos(an) * 18).toFixed(1)} ${(Math.sin(an) * 18).toFixed(1)} L${(Math.cos(an) * (18 + len)).toFixed(1)} ${(Math.sin(an) * (18 + len)).toFixed(1)}`, stroke: '#1a0505', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
          }
          holes.push({ g, t: w.t, until: l.out, x: p.x + (rr() - .5) * 60, y: p.y - l.size * .1 });
        } else if (w.kw !== 'bad') {
          const sp = svg('path', { d: 'M0 -70 C9 -9 9 -9 70 0 C9 9 9 9 0 70 C-9 9 -9 9 -70 0 C-9 -9 -9 -9 0 -70 Z', fill: '#fffbe9', opacity: 0 }, fx);
          sparkles.push({ el: sp, t: w.t + .1, x: p.x + l.size * .35, y: p.y - l.size * .45 });
        }
        emit('puff', w.t + .05, { x0: p.x - 80, x1: p.x + 80, y: p.y + l.size * .5, jy: 10, n: 14, rgb: l.world === 'yellow' ? '120,70,20' : '255,226,186', alpha: .22, size: [14, 30], grow: 110, spread: 220, rise: [30, 140], drag: 3.2, g: 90, life: [.5, .9], from: E.start, to: l.out }, myEmitters);
      });
    });
    // a softer dust line under each line's first word in the poster worlds
    lines.forEach(l => {
      if (l.world !== 'yellow' && l.world !== 'red') return;
      emit('puff', l.t + .06, { x0: 260, x1: 820, y: 900 + l.h / 2 + 10, jy: 14, n: 16, rgb: l.world === 'yellow' ? '255,238,200' : '50,6,6', alpha: .16, size: [22, 44], grow: 140, spread: 380, rise: [10, 90], drag: 3.2, g: 80, life: [.6, 1], from: E.start, to: l.out }, myEmitters);
    });
    // world changes get a flash
    lines.forEach((l, i) => { if (i && l.world !== lines[i - 1].world) myFlashes.push({ t: l.t - .02, a: .3, d: .1 }); });
  };

  // ---------- per-frame ----------
  const worldAt = t => {
    let cur = lines[0].world, prev = null, since = -1e9;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t - .12 > t) break;
      if (i && lines[i].world !== lines[i - 1].world) { prev = lines[i - 1].world; since = lines[i].t - .12; }
      cur = lines[i].world;
    }
    return { cur, prev, since };
  };
  const interlude = t => {
    if (t >= END) return { on: true, from: END, outro: true };
    for (let i = 0; i < lines.length - 1; i++) {
      const l = lines[i];
      if (l.gapAfter > 2.2 && t >= l.out && t < lines[i + 1].t - .12) return { on: true, from: l.out, until: lines[i + 1].t - .12 };
    }
    return { on: false };
  };

  function wordIn(w, world, d) {
    const s = w.el.style;
    if (d < 0) { s.opacity = 0; return; }
    let tr = '', f = 'none', op = 1;
    if (world === 'yellow' || world === 'red') {
      const p = clamp(d / .14);
      let sc = lerp(2.1, 1, ease.outExpo(p));
      if (p >= 1) { const d2 = d - .14; sc = 1 - .035 * Math.exp(-d2 * 12) * Math.sin(d2 * 38); }
      tr = `scale(${sc.toFixed(4)})`;
      const b = 10 * (1 - ease.outCubic(p));
      if (b > .3) f = `blur(${b.toFixed(1)}px)`;
      op = clamp(d / .03);
    } else if (world === 'dusk') {
      const p = clamp(d / .4);
      tr = `translateY(${lerp(-280, 0, ease.outBounce(p)).toFixed(1)}px) rotate(${lerp(w.jitter, 0, ease.outCubic(clamp(d / .3))).toFixed(2)}deg)`;
      op = clamp(d / .05);
    } else if (world === 'wall') {
      const p = clamp(d / .13);
      let sc = lerp(1.55, 1, ease.outExpo(p));
      if (p >= 1) { const d2 = d - .13; sc = 1 - .03 * Math.exp(-d2 * 13) * Math.cos(d2 * 40); }
      tr = `rotate(${lerp(w.jitter * 2.2, w.jitter, ease.outCubic(p)).toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      op = clamp(d / .03);
    } else {
      const p = clamp(d / .32);
      tr = `translateY(${lerp(56, 0, ease.outCubic(p)).toFixed(1)}px)`;
      const b = 9 * (1 - p);
      if (b > .3) f = `blur(${b.toFixed(1)}px)`;
      op = ease.outCubic(p);
    }
    if (w.kw) {   // keywords get an extra beat of emphasis
      const k = d >= 0 ? 1 + .08 * Math.exp(-Math.max(0, d - .1) * 6) : 1;
      tr += ` scale(${k.toFixed(4)})`;
    }
    s.opacity = op.toFixed(3); s.transform = tr; s.filter = f;
  }

  E.render = (t, lyr) => {
    scene.style.visibility = lyr ? 'visible' : 'hidden';
    if (!lyr) return;
    const W = worldAt(t), il = interlude(t);
    const showWorld = il.on ? 'dusk' : W.cur;
    const trans = !il.on && W.prev && t - W.since < .24 ? (t - W.since) / .24 : null;
    for (const name of WORLDS) {
      const el = worldEls[name];
      const vis = name === showWorld || (trans != null && name === W.prev);
      el.style.visibility = vis ? 'visible' : 'hidden';
      el.style.clipPath = name === showWorld && trans != null ? `circle(${(lerp(40, 2300, ease.inCubic(trans))).toFixed(1)}px at 540px 900px)` : 'none';
      el.style.zIndex = name === showWorld ? 2 : 1;
    }
    worldEls.yellowRays.style.transform = `rotate(${(t * 9).toFixed(2)}deg)`;
    worldEls.redRings.style.transform = `scale(${(1 + (t % 8) * .04).toFixed(4)})`;
    // the sun breathes with the song and sets in the outro
    const outroP = prog(t, END, E.duration);
    const sunY = 1080 + 900 * ease.inCubic(outroP);
    worldEls.sun.style.top = worldEls.glow.style.top = sunY.toFixed(1) + 'px';
    worldEls.glow.style.opacity = (.85 + .15 * Math.sin(t * 2.1)).toFixed(3);

    for (const l of lines) {
      const visible = !il.on && t >= l.t - .12 && t < l.out + .2;
      l.el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) continue;
      const leaving = t >= l.out ? (t - l.out) / .2 : 0;
      l.words.forEach(w => wordIn(w, l.world, t - w.t));
      const wrap = l.el.firstChild;
      if (leaving > 0) {
        const p = ease.inCubic(clamp(leaving));
        wrap.style.transform = l.world === 'dusk' ? `translate(-50%, -50%) translateY(${(420 * p).toFixed(1)}px)` : `translate(-50%, -50%) scale(${(1 - .35 * p).toFixed(4)})`;
        wrap.style.opacity = (1 - p).toFixed(3);
      } else { wrap.style.transform = 'translate(-50%, -50%)'; wrap.style.opacity = 1; }
    }
    // the title card fills instrumental gaps and closes the song
    const lk = $('lyricLock');
    if (il.on) {
      const d = t - il.from, p = clamp(d / .35);
      let sc = lerp(1.6, 1, ease.outExpo(p));
      if (p >= 1) sc = 1 + .02 * Math.sin((d - .35) * 2);
      const fade = il.outro ? 1 - prog(t, E.duration - 1.2, E.duration) : 1;
      lk.style.opacity = (clamp(d / .08) * fade).toFixed(3);
      lk.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(4)})`;
    } else lk.style.opacity = 0;

    for (const h of holes) {
      const d = t - h.t, on = d >= 0 && t < h.until + .2 && !il.on;
      h.g.setAttribute('opacity', on ? 1 : 0);
      if (on) h.g.setAttribute('transform', `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) scale(${(1 + .6 * Math.exp(-d * 26)).toFixed(3)})`);
    }
    for (const s of sparkles) spark(s.el, t, s.t, .38, s.x, s.y, 1);
    E.camera(t);
  };

  E.camera = t => {
    let x = 0, y = 0, r = 0, s = 1;
    for (const k of myKicks) {
      const d = t - k.t;
      if (d < 0 || d > .6) continue;
      const e = k.a * Math.exp(-d * 10);
      x += e * Math.sin(d * 71 + k.t * 17);
      y += e * Math.sin(d * 89 + k.t * 29 + 1.3);
      r += e * .02 * Math.sin(d * 63 + k.t * 5);
    }
    if (beats.length) {   // a small push on every beat
      const b = nearest(beats, t);
      const d = t - (b <= t ? b : b - 60 / ((D.audio && D.audio.bpm) || 100));
      if (d >= 0 && d < .5) s += .012 * Math.exp(-d * 9);
    }
    s *= 1 + .025 * Math.sin(t * .35);
    x += Math.sin(t * 5.3) * .9 + Math.sin(t * 13.1 + 2) * .5;
    y += Math.sin(t * 4.1 + 1) * 1.1 + Math.sin(t * 11.7) * .4;
    $('cam').style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
  };
  E.flash = t => {
    let fa = 0;
    for (const f of myFlashes) { const d = t - f.t; if (d >= 0 && d < f.d) fa = Math.max(fa, f.a * (1 - d / f.d)); }
    return fa;
  };
  E.drawParticles = (ctx, t) => {
    const w = worldAt(t).cur;
    if (w === 'dusk' || w === 'night' || interlude(t).on) drawSky(ctx, t);
    drawParticles(ctx, t, myEmitters);
  };
})();
