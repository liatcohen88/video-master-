(async () => {
  const { createCanvas } = require('@napi-rs/canvas');
  const fs = require('fs'); const { join } = require('path'); const { spawn } = require('child_process');
  global.window={devicePixelRatio:1,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}};
  global.navigator={userAgent:'node'};
  global.document={createElement:(t)=>t==='canvas'?createCanvas(1,1):{style:{},getContext:()=>({}),appendChild:()=>{},setAttribute:()=>{}},createElementNS:()=>({style:{},setAttribute:()=>{},appendChild:()=>{}}),getElementsByTagName:()=>[]};
  const lottie=require('lottie-web');
  const data=JSON.parse(fs.readFileSync('public/lottie/money.json','utf8'));
  const size=200,fps=24,dur=1.0;
  const canvas=createCanvas(size,size); const ctx=canvas.getContext('2d');
  const anim=lottie.loadAnimation({renderer:'canvas',loop:false,autoplay:false,animationData:data,rendererSettings:{context:ctx,clearCanvas:true}});
  const tf=Math.floor(anim.totalFrames); const out=Math.round(dur*fps);
  const fd=join(process.cwd(),'_lr2'); fs.mkdirSync(fd,{recursive:true});
  // sample across the whole animation, not just first frames
  for(let i=0;i<out;i++){ anim.goToAndStop(Math.floor((i/out)*tf),true); fs.writeFileSync(join(fd,`f${String(i).padStart(5,'0')}.png`),canvas.toBuffer('image/png')); }
  anim.destroy();
  const FF='C:/Users/PC/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
  await new Promise(r=>{const p=spawn(FF,['-y','-framerate',String(fps),'-i',join(fd,'f%05d.png'),'-c:v','qtrle','-pix_fmt','argb','money.mov']);p.on('close',()=>r());});
  // composite on blue
  await new Promise(r=>{const p=spawn(FF,['-y','-f','lavfi','-i','color=c=blue:s=400x400:d=1','-i','money.mov','-filter_complex','[0][1]overlay=100:100','-frames:v','1','money_comp.png']);p.on('close',()=>r());});
  console.log('done, totalFrames:',tf,'movSize:',fs.statSync('money.mov').size,'compSize:',fs.statSync('money_comp.png').size);
  fs.rmSync(fd,{recursive:true,force:true});
})();
