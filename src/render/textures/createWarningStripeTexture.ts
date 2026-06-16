import * as THREE from 'three';

// Hazard stripes for restricted thresholds / floor markings.
export function createWarningStripeTexture(a = '#d8a72c', b = '#1c1c1c'): THREE.Texture {
  const S = 64; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = a; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = b;
  for (let i = -S; i < S * 2; i += 18) { ctx.save(); ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 9, 0); ctx.lineTo(i + 9 - S, S); ctx.lineTo(i - S, S); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // worn edges
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
