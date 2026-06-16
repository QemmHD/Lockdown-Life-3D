import * as THREE from 'three';

// Grid tile floor with seams + per-tile shade variation + optional wet sheen look.
export function createTileTexture(base = '#5a6b72', seam = '#262b30', tiles = 8, wet = false): THREE.Texture {
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const t = S / tiles;
  for (let y = 0; y < tiles; y++) for (let x = 0; x < tiles; x++) {
    const shade = (Math.random() - 0.5) * 22;
    ctx.fillStyle = shadeColor(base, shade);
    ctx.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
    if (wet && Math.random() < 0.18) { // puddle sheen
      const g = ctx.createRadialGradient(x * t + t / 2, y * t + t / 2, 1, x * t + t / 2, y * t + t / 2, t / 2);
      g.addColorStop(0, 'rgba(180,210,225,0.35)'); g.addColorStop(1, 'rgba(180,210,225,0)');
      ctx.fillStyle = g; ctx.fillRect(x * t, y * t, t, t);
    }
  }
  ctx.strokeStyle = seam; ctx.lineWidth = 2;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * t); ctx.lineTo(S, i * t); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadeColor(hexStr: string, amt: number) {
  const n = parseInt(hexStr.slice(1), 16);
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 255) + amt), b = clamp((n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}
function clamp(v: number) { return Math.max(0, Math.min(255, v | 0)); }
