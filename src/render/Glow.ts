import * as THREE from 'three';

// Cheap fake-bloom: an additive radial sprite parented to an emissive prop so it
// "glows" without a post-processing pipeline (mobile-friendly, zero extra passes).
// One shared soft-disc texture is reused for every halo.

let _tex: THREE.Texture | null = null;
function glowTex(): THREE.Texture {
  if (_tex) return _tex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  _tex = new THREE.CanvasTexture(c); _tex.colorSpace = THREE.SRGBColorSpace;
  return _tex;
}

// A camera-facing additive halo. `size` is world diameter; `intensity` scales opacity.
export function glowSprite(color: number, size = 1.4, intensity = 0.7): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color, transparent: true, opacity: intensity,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false
  }));
  s.scale.set(size, size, size);
  return s;
}

// A flat additive disc that lies on the ground (selection/player pool of light).
export function groundGlow(color: number, size = 1.3, intensity = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(size / 2, 24),
    new THREE.MeshBasicMaterial({
      map: glowTex(), color, transparent: true, opacity: intensity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04;
  return m;
}
