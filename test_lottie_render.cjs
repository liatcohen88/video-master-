// Try to render a Lottie frame to PNG server-side using lottie-web + napi canvas
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');

// Minimal DOM shim for lottie-web canvas renderer
const napiCanvas = createCanvas(300, 300);
global.window = { devicePixelRatio: 1, requestAnimationFrame: () => {}, cancelAnimationFrame: () => {} };
global.navigator = { userAgent: 'node' };
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(300, 300);
    return { style:{}, getContext:()=>({}), appendChild:()=>{}, setAttribute:()=>{} };
  },
  createElementNS: () => ({ style:{}, setAttribute:()=>{}, appendChild:()=>{} }),
  getElementsByTagName: () => [],
};

try {
  const lottie = require('lottie-web');
  const data = JSON.parse(fs.readFileSync('public/lottie/money.json','utf8'));
  const ctx = napiCanvas.getContext('2d');
  const anim = lottie.loadAnimation({
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: data,
    rendererSettings: { context: ctx, clearCanvas: true },
  });
  anim.goToAndStop(Math.floor(anim.totalFrames/2), true);
  const buf = napiCanvas.toBuffer('image/png');
  fs.writeFileSync('lottie_frame_test.png', buf);
  console.log('SUCCESS: rendered Lottie frame, PNG bytes:', buf.length, 'totalFrames:', anim.totalFrames);
} catch(e) {
  console.log('FAILED:', e.message.slice(0,200));
}
