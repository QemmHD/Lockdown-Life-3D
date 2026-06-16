import * as THREE from 'three';

// Transparent grime/dirt overlay (stains, worn paths, dirt patches) laid over floors/walls.
export function createGrimeTexture(): THREE.Texture {
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 6 + Math.random() * 46;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    const a = 0.05 + Math.random() * 0.18;
    g.addColorStop(0, `rgba(20,16,10,${a})`); g.addColorStop(1, 'rgba(20,16,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // worn path streaks
  ctx.strokeStyle = 'rgba(10,8,6,0.18)';
  for (let i = 0; i < 8; i++) { ctx.lineWidth = 4 + Math.random() * 8; ctx.beginPath(); ctx.moveTo(Math.random() * S, 0); ctx.lineTo(Math.random() * S, S); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
