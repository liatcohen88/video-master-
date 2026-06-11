/**
 * Builds public/lottie/multi-video-merge.json
 *
 * AESTHETIC: Figma-meets-video-editor. Premium minimal, but every "card" is
 * unmistakably a video clip: 9:16 thumbnail, big Play button, scrubber/timeline,
 * subtle REC dot, and a softly-lit scene gradient in the background.
 *
 *   - Deep navy canvas with a soft cyan radial glow at the merge point
 *   - 3 portrait video clips with distinct cinematic scene gradients
 *     (warm sunset / cool ocean / twilight)
 *   - Figma's iconic CYAN MARQUEE SELECT — cursor drags a rectangle that
 *     wraps all three thumbnails simultaneously
 *   - Corner SELECTION HANDLES (the little white squares) snap on
 *   - Thumbnails fly to center and morph into one Master clip
 *   - Custom cubic-bezier easings throughout
 *
 * Two builds:
 *   `node build-multi-video-lottie.cjs`           → landscape 600x400
 *   `node build-multi-video-lottie.cjs portrait`  → portrait 360x640
 */
const fs = require("fs");
const path = require("path");

const MODE = process.argv[2] === "portrait" ? "portrait" : "landscape";
const W = MODE === "portrait" ? 360 : 600;
const H = MODE === "portrait" ? 640 : 400;
const FPS = 30;
const DUR = 150; // 5 seconds

// ───────── Color palette ─────────
const C = {
  bgFill: "#0a0a12",
  glow: "#0d99ff",           // soft cyan glow behind the merge point
  grid: "#1a1a26",
  cardEdge: "#2a2a3c",       // thin border on every card
  playFill: "#ffffff",
  playInner: "#0a0a12",      // dark inner of play triangle
  scrubberBase: "#ffffff",
  recDot: "#ef4444",
  figmaBlue: "#0d99ff",
  handleFill: "#ffffff",
  handleStroke: "#0d99ff",
  cursor: "#ffffff",
  cursorOutline: "#0a0a12",
  pillBg: "#0d99ff",
  // Cinematic scene gradients per clip — two stops each
  scene1A: "#fb923c", scene1B: "#be185d",  // sunset orange → deep magenta
  scene2A: "#22d3ee", scene2B: "#1e3a8a",  // bright teal → deep ocean blue
  scene3A: "#a78bfa", scene3B: "#9d174d",  // soft violet → wine
  // Master scene (the merged result) — cyan-tinted hero
  masterA: "#0d99ff", masterB: "#1e1b4b",
};

// ───────── Easing presets ─────────
const EASE = {
  snappy:    { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } },
  smooth:    { o: { x: [0.5],  y: [0] }, i: { x: [0.5], y: [1] } },
  overshoot: { o: { x: [0.34], y: [1.56] }, i: { x: [0.64], y: [1] } },
  linear:    { o: { x: [0.4], y: [0.4] }, i: { x: [0.6], y: [0.6] } },
};

// ───────── Helpers ─────────
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    1,
  ];
};

let layerIdSeq = 1;
const nextId = () => layerIdSeq++;
const sval = (v) => ({ a: 0, k: v });

const aval = (kfs) => ({
  a: 1,
  k: kfs.map((kf, i) => {
    const next = kfs[i + 1];
    const k = { t: kf.t, s: Array.isArray(kf.v) ? kf.v : [kf.v] };
    if (next) {
      const e = kf.ease || EASE.smooth;
      k.o = e.o;
      k.i = e.i;
    } else {
      k.h = 1;
    }
    return k;
  }),
});

// ───────── Shape primitives ─────────
const fillRgb = (hex, opacity = 100) => {
  const [r, g, b, a] = hexToRgb(hex);
  return { ty: "fl", c: sval([r, g, b, a]), o: sval(opacity), r: 1, bm: 0 };
};
const strokeRgb = (hex, width, opacity = 100) => {
  const [r, g, b, a] = hexToRgb(hex);
  return {
    ty: "st",
    c: sval([r, g, b, a]),
    o: sval(opacity),
    w: sval(width),
    lc: 2, lj: 2,
  };
};
const trIdentity = (p = [0, 0]) => ({
  ty: "tr",
  p: sval(p), a: sval([0, 0]),
  s: sval([100, 100]), r: sval(0), o: sval(100),
});

const rect = ({ w, h, r }) => ({ ty: "rc", s: sval([w, h]), p: sval([0, 0]), r: sval(r) });
const ellipse = ({ w, h }) => ({ ty: "el", s: sval([w, h]), p: sval([0, 0]) });

// Linear gradient fill (corner to corner)
const linearGradientFill = ({ w, h, colorA, colorB, opacity = 100 }) => {
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  return {
    ty: "gf",
    o: sval(opacity),
    r: 1,
    bm: 0,
    g: { p: 2, k: sval([0, r1, g1, b1, 1, r2, g2, b2]) },
    s: sval([-w / 2, -h / 2]),
    e: sval([w / 2, h / 2]),
    t: 1,
  };
};

// Radial gradient (used for soft background glow)
const radialGradientFill = ({ size, colorCenter, colorEdge, opacity = 100 }) => {
  const [r1, g1, b1] = hexToRgb(colorCenter);
  const [r2, g2, b2] = hexToRgb(colorEdge);
  return {
    ty: "gf",
    o: sval(opacity),
    r: 1,
    bm: 0,
    g: { p: 2, k: sval([0, r1, g1, b1, 1, r2, g2, b2]) },
    s: sval([0, 0]),
    e: sval([size / 2, 0]),
    t: 2,
    h: sval(0),
    a: sval(0),
  };
};

// Play triangle pointing right
const playTriangle = (size, color) => ({
  ty: "gr",
  nm: "PlayTri",
  it: [
    {
      ty: "sh",
      ks: {
        a: 0,
        k: {
          c: true,
          v: [[-size * 0.4, -size * 0.5], [size * 0.55, 0], [-size * 0.4, size * 0.5]],
          i: [[0, 0], [0, 0], [0, 0]],
          o: [[0, 0], [0, 0], [0, 0]],
        },
      },
    },
    fillRgb(color),
    trIdentity([2, 0]),
  ],
});

// Cursor — Figma-style sharp arrow
const cursorShape = () => ({
  ty: "gr",
  nm: "Cursor",
  it: [
    {
      ty: "sh",
      ks: {
        a: 0,
        k: {
          c: true,
          v: [
            [0, 0], [0, 22], [5.5, 17], [9.5, 25.5], [13, 24], [9, 15.5], [16, 15.5],
          ],
          i: Array(7).fill([0, 0]),
          o: Array(7).fill([0, 0]),
        },
      },
    },
    fillRgb(C.cursor),
    strokeRgb(C.cursorOutline, 1.5),
    trIdentity(),
  ],
});

// Tiny grid dot
const gridDot = () => ({
  ty: "gr",
  nm: "Dot",
  it: [ellipse({ w: 1.5, h: 1.5 }), fillRgb(C.grid), trIdentity()],
});

// Selection handle (Figma-style)
const handle = () => ({
  ty: "gr",
  nm: "Handle",
  it: [
    rect({ w: 7, h: 7, r: 0.5 }),
    fillRgb(C.handleFill),
    strokeRgb(C.handleStroke, 1.2),
    trIdentity(),
  ],
});

// ── THE RICH VIDEO CLIP CARD ──
// Contains: scene gradient, vignette, big play button, scrubber + progress
//   dot, REC indicator. All composed as one shape layer's `shapes` array.
function videoClipShapes({ w, h, r = 6, sceneA, sceneB, progress = 0.4, dotColor }) {
  const scrubberY = h / 2 - 10;
  const scrubberWidth = w - 18;
  const scrubberX = -scrubberWidth / 2;
  const dotX = scrubberX + scrubberWidth * progress;

  return [
    // 1. Card body — scene gradient fill + subtle edge stroke
    {
      ty: "gr",
      nm: "ClipBody",
      it: [
        rect({ w, h, r }),
        linearGradientFill({ w, h, colorA: sceneA, colorB: sceneB, opacity: 100 }),
        strokeRgb(C.cardEdge, 1),
        trIdentity(),
      ],
    },
    // 2. Top vignette — darken the top for filmic depth
    {
      ty: "gr",
      nm: "TopVignette",
      it: [
        rect({ w: w - 1, h: h * 0.45, r: r - 1 }),
        fillRgb("#000000", 22),
        { ...trIdentity(), p: sval([0, -h * 0.275]) },
      ],
    },
    // 3. Bottom vignette — darker, holds the scrubber
    {
      ty: "gr",
      nm: "BottomVignette",
      it: [
        rect({ w: w - 1, h: h * 0.35, r: r - 1 }),
        fillRgb("#000000", 45),
        { ...trIdentity(), p: sval([0, h * 0.325]) },
      ],
    },
    // 4. Play button — translucent white circle
    {
      ty: "gr",
      nm: "PlayCircleBg",
      it: [
        ellipse({ w: 28, h: 28 }),
        fillRgb("#ffffff", 18),
        strokeRgb("#ffffff", 1.5, 90),
        { ...trIdentity(), p: sval([0, -4]) }, // slightly above center
      ],
    },
    // 5. Play triangle inside the circle
    {
      ty: "gr",
      nm: "PlayTriWrap",
      it: [
        ...playTriangle(12, C.playFill).it,
        { ...trIdentity([2, -4]) },
      ],
    },
    // 6. Scrubber background — thin line full width
    {
      ty: "gr",
      nm: "ScrubberBase",
      it: [
        rect({ w: scrubberWidth, h: 1.5, r: 0.75 }),
        fillRgb(C.scrubberBase, 35),
        { ...trIdentity(), p: sval([0, scrubberY]) },
      ],
    },
    // 7. Scrubber progress — colored portion up to the dot
    {
      ty: "gr",
      nm: "ScrubberFill",
      it: [
        rect({ w: scrubberWidth * progress, h: 1.5, r: 0.75 }),
        fillRgb(dotColor, 100),
        { ...trIdentity(), p: sval([scrubberX + (scrubberWidth * progress) / 2, scrubberY]) },
      ],
    },
    // 8. Scrubber playhead dot
    {
      ty: "gr",
      nm: "ScrubberDot",
      it: [
        ellipse({ w: 5, h: 5 }),
        fillRgb(dotColor),
        strokeRgb("#ffffff", 1, 80),
        { ...trIdentity(), p: sval([dotX, scrubberY]) },
      ],
    },
    // 9. REC dot — small red dot top-left
    {
      ty: "gr",
      nm: "RecDot",
      it: [
        ellipse({ w: 4, h: 4 }),
        fillRgb(C.recDot),
        { ...trIdentity(), p: sval([-w / 2 + 9, -h / 2 + 9]) },
      ],
    },
    // 10. "REC" bar — short white bar next to the dot
    {
      ty: "gr",
      nm: "RecBar",
      it: [
        rect({ w: 12, h: 2, r: 1 }),
        fillRgb("#ffffff", 80),
        { ...trIdentity(), p: sval([-w / 2 + 22, -h / 2 + 9]) },
      ],
    },
    // 11. Duration pill — small dark rounded rect top-right
    {
      ty: "gr",
      nm: "DurationPill",
      it: [
        rect({ w: 22, h: 9, r: 2 }),
        fillRgb("#000000", 50),
        { ...trIdentity(), p: sval([w / 2 - 16, -h / 2 + 9]) },
      ],
    },
    // 12. Duration "text" — fake it with 3 little white bars
    {
      ty: "gr",
      nm: "DurationBars",
      it: [
        rect({ w: 14, h: 1.5, r: 0.75 }),
        fillRgb("#ffffff", 85),
        { ...trIdentity(), p: sval([w / 2 - 16, -h / 2 + 9]) },
      ],
    },
  ];
}

// Master card — bigger, hero version with cyan glow stroke
function masterClipShapes({ w, h, r = 8 }) {
  return [
    {
      ty: "gr",
      nm: "MasterBody",
      it: [
        rect({ w, h, r }),
        linearGradientFill({ w, h, colorA: C.masterA, colorB: C.masterB, opacity: 100 }),
        strokeRgb(C.figmaBlue, 2),
        trIdentity(),
      ],
    },
    // Inner subtle highlight stroke for depth
    {
      ty: "gr",
      nm: "MasterInnerLine",
      it: [
        rect({ w: w - 6, h: h - 6, r: r - 1 }),
        strokeRgb("#ffffff", 1, 12),
        trIdentity(),
      ],
    },
    // Top vignette
    {
      ty: "gr",
      nm: "MTopV",
      it: [
        rect({ w: w - 1, h: h * 0.45, r: r - 1 }),
        fillRgb("#000000", 25),
        { ...trIdentity(), p: sval([0, -h * 0.275]) },
      ],
    },
    // Bottom vignette
    {
      ty: "gr",
      nm: "MBottomV",
      it: [
        rect({ w: w - 1, h: h * 0.35, r: r - 1 }),
        fillRgb("#000000", 50),
        { ...trIdentity(), p: sval([0, h * 0.325]) },
      ],
    },
    // Big white play button — circle + triangle
    {
      ty: "gr",
      nm: "MPlayBg",
      it: [
        ellipse({ w: 44, h: 44 }),
        fillRgb("#ffffff", 95),
        { ...trIdentity(), p: sval([0, -2]) },
      ],
    },
    {
      ty: "gr",
      nm: "MPlayTri",
      it: [
        ...playTriangle(18, C.masterA).it,
        { ...trIdentity([2, -2]) },
      ],
    },
    // Scrubber base
    {
      ty: "gr",
      nm: "MScrubberBase",
      it: [
        rect({ w: w - 22, h: 2, r: 1 }),
        fillRgb("#ffffff", 40),
        { ...trIdentity(), p: sval([0, h / 2 - 13]) },
      ],
    },
    // Scrubber filled — 100% to show "complete master"
    {
      ty: "gr",
      nm: "MScrubberFill",
      it: [
        rect({ w: w - 22, h: 2, r: 1 }),
        fillRgb(C.figmaBlue, 100),
        { ...trIdentity(), p: sval([0, h / 2 - 13]) },
      ],
    },
    // Playhead dot at the end (right side, RTL-friendly = end of scrubber)
    {
      ty: "gr",
      nm: "MScrubberDot",
      it: [
        ellipse({ w: 7, h: 7 }),
        fillRgb("#ffffff"),
        strokeRgb(C.figmaBlue, 1.5),
        { ...trIdentity(), p: sval([w / 2 - 13, h / 2 - 13]) },
      ],
    },
    // "MASTER" tag — small cyan pill, top-right
    {
      ty: "gr",
      nm: "MasterPill",
      it: [
        rect({ w: 32, h: 10, r: 3 }),
        fillRgb(C.figmaBlue),
        { ...trIdentity(), p: sval([w / 2 - 22, -h / 2 + 10]) },
      ],
    },
    {
      ty: "gr",
      nm: "MasterPillBars",
      it: [
        rect({ w: 22, h: 2, r: 1 }),
        fillRgb("#ffffff", 95),
        { ...trIdentity(), p: sval([w / 2 - 22, -h / 2 + 10]) },
      ],
    },
  ];
}

// ───────── Layer wrapper ─────────
function shapeLayer({
  name, shapes, position, scale, rotation, opacity,
  anchor = [0, 0], ip = 0, op = DUR,
}) {
  return {
    ddd: 0, ind: nextId(), ty: 4, nm: name, sr: 1,
    ks: {
      o: typeof opacity === "object" ? opacity : sval(opacity ?? 100),
      r: typeof rotation === "object" ? rotation : sval(rotation ?? 0),
      p: typeof position === "object" && position.a !== undefined ? position : sval(position),
      a: sval(anchor),
      s: typeof scale === "object" && scale.a !== undefined ? scale : sval(scale ?? [100, 100]),
    },
    ao: 0, shapes, ip, op, st: 0, bm: 0,
  };
}

// ───────── Layout ─────────
// PORTRAIT video clips (9:16 aspect — same shape as Reels/TikTok)
const CARD = MODE === "portrait"
  ? { w: 78, h: 138, r: 8 }
  : { w: 88, h: 156, r: 9 };

const MASTER = MODE === "portrait"
  ? { w: 130, h: 230, r: 12 }
  : { w: 130, h: 230, r: 12 };

const THUMBS = MODE === "portrait"
  ? [
      { x: W * 0.22, y: H * 0.30, sceneA: C.scene1A, sceneB: C.scene1B, progress: 0.35, dotColor: C.scene1A },
      { x: W * 0.78, y: H * 0.30, sceneA: C.scene2A, sceneB: C.scene2B, progress: 0.55, dotColor: C.scene2A },
      { x: W * 0.50, y: H * 0.72, sceneA: C.scene3A, sceneB: C.scene3B, progress: 0.20, dotColor: C.scene3A },
    ]
  : [
      { x: W * 0.22, y: H * 0.5, sceneA: C.scene1A, sceneB: C.scene1B, progress: 0.35, dotColor: C.scene1A },
      { x: W * 0.50, y: H * 0.5, sceneA: C.scene2A, sceneB: C.scene2B, progress: 0.55, dotColor: C.scene2A },
      { x: W * 0.78, y: H * 0.5, sceneA: C.scene3A, sceneB: C.scene3B, progress: 0.20, dotColor: C.scene3A },
    ];

const TAB_CENTER = { x: W / 2, y: H / 2 };

// ───────── Timeline ─────────
const F = {
  bgIn: 10,
  thumb1In: 18,
  thumb2In: 24,
  thumb3In: 30,
  cursorIn: 38,
  marqueeStart: 48,
  marqueeEnd: 75,
  selectionSnap: 80,
  pillIn: 85,
  pillOut: 105,
  gatherStart: 102,
  gatherEnd: 122,
  morphFlash: 126,
  masterIn: 138,
  masterSettle: 150,
};

// Marquee bounds — wrap all 3 cards + padding
const SEL_BOUNDS = (() => {
  const pad = 26;
  const xs = THUMBS.map(t => t.x);
  const ys = THUMBS.map(t => t.y);
  return {
    left: Math.min(...xs) - CARD.w / 2 - pad,
    right: Math.max(...xs) + CARD.w / 2 + pad,
    top: Math.min(...ys) - CARD.h / 2 - pad,
    bottom: Math.max(...ys) + CARD.h / 2 + pad,
  };
})();

const MARQUEE_START_PT = { x: SEL_BOUNDS.left + 8, y: SEL_BOUNDS.top + 8 };
const MARQUEE_END_PT = { x: SEL_BOUNDS.right - 8, y: SEL_BOUNDS.bottom - 8 };
const CURSOR_OFFSCREEN = { x: -40, y: -40 };

// ───────── Build layers (back-to-front) ─────────
const layers = [];

// Base BG plate
layers.push(
  shapeLayer({
    name: "BG",
    position: [W / 2, H / 2],
    shapes: [rect({ w: W, h: H, r: 0 }), fillRgb(C.bgFill), trIdentity()],
  })
);

// Soft cyan radial glow at center — adds depth, gently pulses
layers.push(
  shapeLayer({
    name: "CenterGlow",
    position: [TAB_CENTER.x, TAB_CENTER.y],
    opacity: aval([
      { t: 0, v: 0, ease: EASE.smooth },
      { t: F.bgIn, v: 18, ease: EASE.smooth },
      { t: F.masterIn - 6, v: 18, ease: EASE.smooth },
      { t: F.masterIn, v: 35, ease: EASE.smooth },
      { t: DUR, v: 28 },
    ]),
    scale: aval([
      { t: F.bgIn, v: [70, 70], ease: EASE.smooth },
      { t: 60, v: [85, 85], ease: EASE.smooth },
      { t: F.masterIn - 6, v: [70, 70], ease: EASE.smooth },
      { t: F.masterIn + 4, v: [110, 110] },
    ]),
    shapes: [
      {
        ty: "gr",
        nm: "Glow",
        it: [
          ellipse({ w: Math.min(W, H) * 0.9, h: Math.min(W, H) * 0.9 }),
          radialGradientFill({ size: Math.min(W, H), colorCenter: C.glow, colorEdge: C.bgFill, opacity: 100 }),
          trIdentity(),
        ],
      },
    ],
  })
);

// Subtle dot grid — kept light, fewer dots than v1
const gridStep = MODE === "portrait" ? 50 : 60;
for (let gx = gridStep / 2; gx < W; gx += gridStep) {
  for (let gy = gridStep / 2; gy < H; gy += gridStep) {
    layers.push(
      shapeLayer({
        name: `Dot_${gx}_${gy}`,
        position: [gx, gy],
        opacity: aval([
          { t: 0, v: 0, ease: EASE.smooth },
          { t: F.bgIn, v: 45 },
        ]),
        shapes: [gridDot()],
      })
    );
  }
}

// ───────── Three video clip cards ─────────
function buildClip(i) {
  const t = THUMBS[i];
  const inFrame = [F.thumb1In, F.thumb2In, F.thumb3In][i];

  return shapeLayer({
    name: `Clip${i + 1}`,
    position: aval([
      { t: 0, v: [t.x, t.y] },
      { t: F.gatherStart, v: [t.x, t.y], ease: EASE.snappy },
      { t: F.gatherEnd, v: [TAB_CENTER.x, TAB_CENTER.y] },
    ]),
    opacity: aval([
      { t: 0, v: 0, ease: EASE.smooth },
      { t: inFrame - 6, v: 0, ease: EASE.snappy },
      { t: inFrame, v: 100, ease: EASE.smooth },
      { t: F.gatherEnd - 4, v: 100, ease: EASE.smooth },
      { t: F.gatherEnd, v: 0 },
    ]),
    scale: aval([
      { t: inFrame - 6, v: [88, 88], ease: EASE.overshoot },
      { t: inFrame + 4, v: [100, 100], ease: EASE.smooth },
      { t: F.gatherStart, v: [100, 100], ease: EASE.snappy },
      { t: F.gatherEnd, v: [55, 55] },
    ]),
    shapes: videoClipShapes({
      w: CARD.w, h: CARD.h, r: CARD.r,
      sceneA: t.sceneA, sceneB: t.sceneB,
      progress: t.progress, dotColor: t.dotColor,
    }),
  });
}
layers.push(buildClip(0));
layers.push(buildClip(1));
layers.push(buildClip(2));

// ───────── Cyan selection borders ─────────
function buildSelectionBorder(i) {
  const t = THUMBS[i];
  return shapeLayer({
    name: `SelBorder${i + 1}`,
    position: aval([
      { t: 0, v: [t.x, t.y] },
      { t: F.gatherStart, v: [t.x, t.y], ease: EASE.snappy },
      { t: F.gatherEnd, v: [TAB_CENTER.x, TAB_CENTER.y] },
    ]),
    scale: aval([
      { t: F.selectionSnap - 3, v: [108, 108], ease: EASE.overshoot },
      { t: F.selectionSnap + 4, v: [100, 100], ease: EASE.smooth },
      { t: F.gatherStart, v: [100, 100], ease: EASE.snappy },
      { t: F.gatherEnd, v: [55, 55] },
    ]),
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.selectionSnap - 3, v: 0, ease: EASE.smooth },
      { t: F.selectionSnap, v: 100, ease: EASE.smooth },
      { t: F.gatherEnd - 4, v: 100, ease: EASE.smooth },
      { t: F.gatherEnd, v: 0 },
    ]),
    shapes: [
      {
        ty: "gr",
        nm: "Border",
        it: [
          rect({ w: CARD.w + 4, h: CARD.h + 4, r: CARD.r + 2 }),
          strokeRgb(C.figmaBlue, 1.5),
          trIdentity(),
        ],
      },
    ],
  });
}
layers.push(buildSelectionBorder(0));
layers.push(buildSelectionBorder(1));
layers.push(buildSelectionBorder(2));

// ───────── Selection handles (4 per card) ─────────
function buildHandles(i) {
  const t = THUMBS[i];
  const hx = CARD.w / 2 + 2;
  const hy = CARD.h / 2 + 2;
  const corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];

  return corners.map((c, ci) => shapeLayer({
    name: `H${i + 1}_${ci}`,
    position: aval([
      { t: 0, v: [t.x + c[0], t.y + c[1]] },
      { t: F.gatherStart, v: [t.x + c[0], t.y + c[1]], ease: EASE.snappy },
      { t: F.gatherEnd, v: [TAB_CENTER.x + c[0] * 0.55, TAB_CENTER.y + c[1] * 0.55] },
    ]),
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.selectionSnap - 2, v: 0, ease: EASE.smooth },
      { t: F.selectionSnap + 2, v: 100, ease: EASE.smooth },
      { t: F.gatherStart - 2, v: 100, ease: EASE.smooth },
      { t: F.gatherStart + 8, v: 0 },
    ]),
    scale: aval([
      { t: F.selectionSnap - 2, v: [40, 40], ease: EASE.overshoot },
      { t: F.selectionSnap + 4, v: [100, 100] },
    ]),
    shapes: [handle()],
  }));
}
layers.push(...buildHandles(0));
layers.push(...buildHandles(1));
layers.push(...buildHandles(2));

// ───────── Marquee select rectangle ─────────
const marqueeMidStart = MARQUEE_START_PT;
const marqueeMidEnd = { x: (MARQUEE_START_PT.x + MARQUEE_END_PT.x) / 2, y: (MARQUEE_START_PT.y + MARQUEE_END_PT.y) / 2 };
const marqueeFinalW = MARQUEE_END_PT.x - MARQUEE_START_PT.x;
const marqueeFinalH = MARQUEE_END_PT.y - MARQUEE_START_PT.y;

layers.push(
  shapeLayer({
    name: "Marquee",
    position: aval([
      { t: F.marqueeStart, v: [marqueeMidStart.x, marqueeMidStart.y], ease: EASE.linear },
      { t: F.marqueeEnd, v: [marqueeMidEnd.x, marqueeMidEnd.y] },
    ]),
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.marqueeStart, v: 100 },
      { t: F.selectionSnap, v: 100, ease: EASE.smooth },
      { t: F.selectionSnap + 4, v: 0 },
    ]),
    scale: aval([
      { t: F.marqueeStart, v: [0.5, 0.5], ease: EASE.linear },
      { t: F.marqueeEnd, v: [100, 100] },
    ]),
    shapes: [
      {
        ty: "gr",
        nm: "MarqueeRect",
        it: [
          rect({ w: marqueeFinalW, h: marqueeFinalH, r: 1 }),
          (() => {
            const [r, g, b] = hexToRgb(C.figmaBlue);
            return { ty: "fl", c: sval([r, g, b, 1]), o: sval(8), r: 1, bm: 0 };
          })(),
          strokeRgb(C.figmaBlue, 1),
          trIdentity(),
        ],
      },
    ],
  })
);

// ───────── "3 selected" pill ─────────
layers.push(
  shapeLayer({
    name: "Pill",
    position: [MARQUEE_END_PT.x + 28, MARQUEE_END_PT.y + 22],
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.pillIn - 3, v: 0, ease: EASE.smooth },
      { t: F.pillIn, v: 100, ease: EASE.smooth },
      { t: F.pillOut - 6, v: 100, ease: EASE.smooth },
      { t: F.pillOut, v: 0 },
    ]),
    scale: aval([
      { t: F.pillIn - 3, v: [80, 80], ease: EASE.overshoot },
      { t: F.pillIn + 4, v: [100, 100] },
    ]),
    shapes: [
      { ty: "gr", nm: "PillBody", it: [rect({ w: 60, h: 22, r: 11 }), fillRgb(C.pillBg), trIdentity()] },
      { ty: "gr", nm: "PillDot", it: [ellipse({ w: 6, h: 6 }), fillRgb("#ffffff"), { ...trIdentity(), p: sval([-18, 0]) }] },
      { ty: "gr", nm: "PillBars", it: [rect({ w: 22, h: 2, r: 1 }), fillRgb("#ffffff", 90), { ...trIdentity(), p: sval([6, -3]) }] },
      { ty: "gr", nm: "PillBars2", it: [rect({ w: 16, h: 2, r: 1 }), fillRgb("#ffffff", 70), { ...trIdentity(), p: sval([3, 3]) }] },
    ],
  })
);

// ───────── Master Clip (hero, cyan-glowing) ─────────
layers.push(
  shapeLayer({
    name: "MasterClip",
    position: [TAB_CENTER.x, TAB_CENTER.y],
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.masterIn - 8, v: 0, ease: EASE.smooth },
      { t: F.masterIn - 4, v: 100 },
    ]),
    scale: aval([
      { t: F.masterIn - 8, v: [55, 55], ease: EASE.overshoot },
      { t: F.masterIn, v: [110, 110], ease: EASE.smooth },
      { t: F.masterSettle, v: [100, 100] },
    ]),
    shapes: masterClipShapes({ w: MASTER.w, h: MASTER.h, r: MASTER.r }),
  })
);

// ───────── Morph flash ─────────
layers.push(
  shapeLayer({
    name: "MorphFlash",
    position: [TAB_CENTER.x, TAB_CENTER.y],
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.morphFlash - 3, v: 0, ease: EASE.smooth },
      { t: F.morphFlash, v: 55, ease: EASE.smooth },
      { t: F.morphFlash + 8, v: 0 },
    ]),
    scale: aval([
      { t: F.morphFlash - 3, v: [60, 60], ease: EASE.smooth },
      { t: F.morphFlash + 8, v: [180, 180] },
    ]),
    shapes: [
      {
        ty: "gr",
        nm: "Flash",
        it: [
          ellipse({ w: 100, h: 100 }),
          radialGradientFill({ size: 100, colorCenter: "#ffffff", colorEdge: C.figmaBlue, opacity: 100 }),
          trIdentity(),
        ],
      },
    ],
  })
);

// ───────── Cursor ─────────
layers.push(
  shapeLayer({
    name: "Cursor",
    anchor: [0, 0],
    opacity: aval([
      { t: 0, v: 0 },
      { t: F.cursorIn - 6, v: 0, ease: EASE.smooth },
      { t: F.cursorIn, v: 100, ease: EASE.smooth },
      { t: F.gatherStart, v: 100, ease: EASE.smooth },
      { t: F.gatherStart + 8, v: 0 },
    ]),
    position: aval([
      { t: 0, v: [CURSOR_OFFSCREEN.x, CURSOR_OFFSCREEN.y] },
      { t: F.cursorIn, v: [MARQUEE_START_PT.x, MARQUEE_START_PT.y], ease: EASE.linear },
      { t: F.marqueeEnd, v: [MARQUEE_END_PT.x, MARQUEE_END_PT.y], ease: EASE.smooth },
      { t: F.pillIn, v: [MARQUEE_END_PT.x + 6, MARQUEE_END_PT.y + 6], ease: EASE.smooth },
      { t: F.gatherStart, v: [MARQUEE_END_PT.x + 6, MARQUEE_END_PT.y + 6] },
    ]),
    scale: sval([110, 110]),
    shapes: [cursorShape()],
  })
);

// ───────── Final JSON ─────────
const json = {
  v: "5.7.4",
  fr: FPS,
  ip: 0,
  op: DUR,
  w: W,
  h: H,
  nm: "MultiVideoMerge",
  ddd: 0,
  assets: [],
  layers: layers.slice().reverse().map((l, i) => ({ ...l, ind: i + 1 })),
};

const outDir = path.join(__dirname, "..", "public", "lottie");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const fname = MODE === "portrait" ? "multi-video-merge-portrait.json" : "multi-video-merge.json";
const outPath = path.join(outDir, fname);
fs.writeFileSync(outPath, JSON.stringify(json));
console.log(`✓ Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${json.layers.length} layers, ${MODE} ${W}x${H})`);
