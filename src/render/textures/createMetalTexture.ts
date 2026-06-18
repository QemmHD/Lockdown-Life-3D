import * as THREE from 'three';

// Brushed / scuffed metal for bars, counters, desks, lockers. Vertical brush streaks + scratches
// + a few rust freckles so steel reads as worn institutional metal, not a flat plastic block.
export function createMetalTexture(base = '#8f96a0', repeat = 1, vertical = true): THREE.Texture {
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  // soft top-to-bottom sheen gradient
  const grad = ctx.createLinearGradient(0, 0, vertical ? 0 : S, vertical ? S : 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.16)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);
  // fine brushed streaks
  for (let i = 0; i < 130; i++) {
    const p = Math.random() * S; const light = Math.random() < 0.5;
    ctx.strokeStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${0.02 + Math.random() * 0.05})`; ctx.lineWidth = 0.7;
    ctx.beginPath();
    if (vertical) { ctx.moveTo(p, 0); ctx.lineTo(p + (Math.random() - 0.5) * 3, S); } else { ctx.moveTo(0, p); ctx.lineTo(S, p + (Math.random() - 0.5) * 3); }
    ctx.stroke();
  }
  // scratches + rust freckles
  for (let i = 0; i < 8; i++) { ctx.strokeStyle = 'rgba(20,22,26,0.25)'; ctx.lineWidth = 0.8; ctx.beginPath(); const x = Math.random() * S, y = Math.random() * S; ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 12); ctx.stroke(); }
  for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(${120 + Math.random() * 40 | 0},${60 + Math.random() * 30 | 0},40,${0.06 + Math.random() * 0.08})`; const x = Math.random() * S, y = Math.random() * S; ctx.beginPath(); ctx.arc(x, y, 1 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
