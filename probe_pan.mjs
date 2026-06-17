import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 1000, height: 720 });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:4173/?debug', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 4000));
const out = await pg.evaluate(() => {
  const g = window.__game; g.closeMenu();
  const THREE = g.app.scene.constructor; // not used
  const cam = g.cam; // iso mode by default
  // project a fixed world point to screen NDC
  const proj = () => { const v = new (g.cam.camera.position.constructor)(5, 0, 5); v.project(g.cam.camera); return { x: +v.x.toFixed(3), y: +v.y.toFixed(3) }; };
  const before = proj();
  cam.pan(60, 0);                 // finger swipes RIGHT
  const afterRight = proj();
  cam.pan(-60, 0);                // undo
  cam.pan(0, 60);                 // finger swipes DOWN (screen y down)
  const afterDown = proj();
  return { before, afterRight, afterDown };
});
console.log(JSON.stringify(out));
// interpret: NDC x+ = right, NDC y+ = UP (screen up). Finger right should move content right (ndc.x up) for "natural".
await b.close();
