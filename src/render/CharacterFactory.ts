import * as THREE from 'three';

export interface CharView {
  group: THREE.Group;
  body: THREE.Mesh;     // visible body
  hit: THREE.Mesh;      // invisible large tap target (raycast)
  ring: THREE.Mesh;     // selection ring
  icon: THREE.Sprite;   // status icon above head
  iconTex: THREE.CanvasTexture;
  iconCanvas: HTMLCanvasElement;
  lastIcon: string;
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0a0a0c, side: THREE.BackSide });
function shell(mesh: THREE.Mesh, s = 1.12) { const m = new THREE.Mesh(mesh.geometry, OUTLINE); m.scale.setScalar(s); mesh.add(m); }

export function makeCharacter(kind: 'prisoner' | 'guard', color: number): CharView {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; group.add(shadow);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.58, 24),
    new THREE.MeshBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false; group.add(ring);

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.6, 4, 10), mat);
  body.position.y = 0.62; body.castShadow = true; shell(body, 1.1); group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.7 }));
  head.position.y = 1.18; head.castShadow = true; shell(head, 1.08); group.add(head);

  if (kind === 'guard') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x1b2a3a }));
    cap.position.y = 1.34; group.add(cap);
  }

  // large invisible tap/raycast target (finger-friendly on mobile)
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 2.2, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.position.y = 1.1; group.add(hit);

  // status icon sprite
  const iconCanvas = document.createElement('canvas'); iconCanvas.width = iconCanvas.height = 64;
  const iconTex = new THREE.CanvasTexture(iconCanvas);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, depthTest: false, transparent: true }));
  icon.scale.set(0.7, 0.7, 0.7); icon.position.y = 1.8; icon.visible = false; group.add(icon);

  return { group, body, hit, ring, icon, iconTex, iconCanvas, lastIcon: '' };
}

export function setIcon(v: CharView, text: string) {
  if (v.lastIcon === text) return;
  v.lastIcon = text;
  if (!text) { v.icon.visible = false; return; }
  const ctx = v.iconCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.font = '48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 36);
  v.iconTex.needsUpdate = true;
  v.icon.visible = true;
}
