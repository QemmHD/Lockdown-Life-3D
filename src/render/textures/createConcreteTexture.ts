import * as THREE from 'three';

// Noisy concrete with stains + hairline cracks. Tintable via material color.
export function createConcreteTexture(base = '#8d9098', repeat = 6): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  // speckle noise
  const img = ctx.getImageData(0, 0, 256, 256); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 34;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // stains
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 8 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.05 + Math.random() * 0.12})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // cracks
  ctx.strokeStyle = 'rgba(20,20,24,0.4)';
  for (let i = 0; i < 6; i++) {
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
