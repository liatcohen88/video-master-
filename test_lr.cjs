(async () => {
  const { createCanvas } = require('@napi-rs/canvas');
  const fs = require('fs'); const { join } = require('path');
  const { spawn } = require('child_process');
  global.window = { devicePixelRatio:1, requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{} };
  global.navigator = { userAgent:'node' };
  global.document = { createElement:(t)=>t==='canvas'?createCanvas(1,1):{style:{},getContext:()=>({}),appendChild:()=>{},setAttribute:()=>{}}, createElementNS:()=>({style:{},setAttribute:()=>{},appendChild:()=>{}}), getElementsByTagName:()=>[] };
  const lottie = require('lottie-web');
  const data = JSON.parse(fs.readFileSync('public/lottie/fire.json','utf8'));
  const size=200, fps=24, dur=1.5;
  const canvas = createCanvas(size,size); const ctx = canvas.getContext('2d');
  const anim = lottie.loadAnimation({renderer:'canvas',loop:false,autoplay:false,animationData:data,rendererSettings:{context:ctx,clearCanvas:true}});
  const tf = Math.floor(anim.totalFrames); const out = Math.round(dur*fps);
  const fd = join(process.cwd(),'_lrtest'); fs.mkdirSync(fd,{recursive:true});
  for(let i=0;i<out;i++){ anim.goToAndStop(i%tf,true); fs.writeFileSync(join(fd,`f${String(i).padStart(5,'0')}.png`),canvas.toBuffer('image/png')); }
  anim.destroy();
  const FF='C:/Users/PC/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
  await new Promise((res)=>{ const p=spawn(FF,['-y','-framerate',String(fps),'-i',join(fd,'f%05d.png'),'-c:v','qtrle','-pix_fmt','argb','test_lottie.mov']); let e=''; p.stderr.on('data',d=>e+=d); p.on('close',c=>{console.log('encode exit',c); if(c)console.log(e.slice(-300)); res();}); });
  console.log('frames:',out,'totalFrames:',tf);
  fs.rmSync(fd,{recursive:true,force:true});
})();
