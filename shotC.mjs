import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] });
const p = await b.newPage();
await p.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1.5 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
await p.goto('http://localhost:4173/',{waitUntil:'networkidle2',timeout:30000});
await new Promise(r=>setTimeout(r,2000));
await p.screenshot({path:'cam-char.png'});                  // default Character Mode
// medium: pinch out a couple steps via wheel
await p.mouse.move(683,384); for(let i=0;i<4;i++){ await p.mouse.wheel({deltaY:120}); await new Promise(r=>setTimeout(r,80)); }
await new Promise(r=>setTimeout(r,600)); await p.screenshot({path:'cam-room.png'});
// far overview
for(let i=0;i<12;i++){ await p.mouse.wheel({deltaY:120}); await new Promise(r=>setTimeout(r,50)); }
await new Promise(r=>setTimeout(r,600)); await p.screenshot({path:'cam-over.png'});
console.log('ERRORS:',errs.filter(e=>!e.includes('404')).length); errs.filter(e=>!e.includes('404')).slice(0,8).forEach(e=>console.log(' ',e));
await b.close();
