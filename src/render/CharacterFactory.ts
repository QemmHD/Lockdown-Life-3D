import * as THREE from 'three';
import { THEME } from './VisualTheme';

export interface CharView {
  group: THREE.Group;
  rig: THREE.Group;       // body (bob/lean applied here, not the shadow/ring)
  torso: THREE.Group;
  legL: THREE.Group; legR: THREE.Group;
  armL: THREE.Group; armR: THREE.Group;
  hit: THREE.Mesh;        // invisible large tap target
  ring: THREE.Mesh;       // selection ring
  icon: THREE.Sprite;
  iconTex: THREE.CanvasTexture;
  iconCanvas: HTMLCanvasElement;
  lastIcon: string;
  walkPhase: number;
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b0b0e, side: THREE.BackSide });
function shell(mesh: THREE.Mesh, s = 1.12) { const m = new THREE.Mesh(mesh.geometry, OUTLINE); m.scale.setScalar(s); mesh.add(m); }
function pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)]; }

function limb(w: number, h: number, d: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(w, d) / 2, h - Math.min(w, d), 2, 6), mat);
  m.position.y = -h / 2; m.castShadow = true; shell(m, 1.14); g.add(m);
  return g;
}

export function makeCharacter(kind: 'prisoner' | 'guard', color: number): CharView {
  const group = new THREE.Group();
  const scale = 1.08 + Math.random() * 0.22;

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18),
    new THREE.MeshBasicMaterial({ color: THEME.contactShadow, transparent: true, opacity: 0.4, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; group.add(shadow);

  // selection ring (thick + bright so the picked inmate pops)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 28),
    new THREE.MeshBasicMaterial({ color: THEME.selection, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; group.add(ring);

  const rig = new THREE.Group(); rig.scale.setScalar(scale); group.add(rig);

  const skinMat = new THREE.MeshStandardMaterial({ color: kind === 'guard' ? THEME.guard.skin : pick(THEME.prisoners.skins), roughness: 0.8 });
  const uniMat = new THREE.MeshStandardMaterial({ color: kind === 'guard' ? THEME.guard.uniform : color, roughness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ color: kind === 'guard' ? THEME.guard.trousers : THEME.prisonerTrousers, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.8 });

  // legs (hips at y=0.55)
  const legL = limb(0.17, 0.55, 0.2, legMat); legL.position.set(-0.12, 0.55, 0);
  const legR = limb(0.17, 0.55, 0.2, legMat); legR.position.set(0.12, 0.55, 0);
  for (const lg of [legL, legR]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), shoeMat); sh.position.set(0, -0.52, 0.05); sh.castShadow = true; lg.add(sh); }
  rig.add(legL, legR);

  // torso
  const torso = new THREE.Group(); torso.position.y = 0.55; rig.add(torso);
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.28), uniMat);
  torsoMesh.position.y = 0.28; torsoMesh.castShadow = true; shell(torsoMesh, 1.06); torso.add(torsoMesh);
  // chest taper
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), uniMat); chest.scale.set(1, 0.6, 0.62); chest.position.y = 0.5; torso.add(chest);

  // arms (shoulders ~y=0.48)
  const armL = limb(0.13, 0.5, 0.15, uniMat); armL.position.set(-0.31, 0.48, 0);
  const armR = limb(0.13, 0.5, 0.15, uniMat); armR.position.set(0.31, 0.48, 0);
  // hands
  for (const a of [armL, armR]) { const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skinMat); hnd.position.y = -0.5; a.add(hnd); }
  torso.add(armL, armR);

  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8), skinMat); neck.position.y = 0.6; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skinMat); head.scale.set(1, 1.08, 1); head.position.y = 0.78; head.castShadow = true; shell(head, 1.06); torso.add(head);
  // eyes (facing +z)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14140f });
  for (const ex of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat); e.position.set(ex, 0.8, 0.18); torso.add(e); }

  if (kind === 'guard') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), new THREE.MeshStandardMaterial({ color: THEME.guard.cap, roughness: 0.6 }));
    cap.position.y = 0.95; torso.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.18), new THREE.MeshStandardMaterial({ color: THEME.guard.cap }));
    brim.position.set(0, 0.92, 0.2); torso.add(brim);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshStandardMaterial({ color: THEME.guard.badge, emissive: THEME.guard.badge, emissiveIntensity: 0.3 }));
    badge.position.set(-0.14, 0.38, 0.145); torso.add(badge);
    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x222226 }));
    baton.position.set(0.34, 0.12, 0.06); armR.add(baton);
  } else {
    const hairMat = new THREE.MeshStandardMaterial({ color: pick(THEME.prisoners.hair), roughness: 1 });
    if (Math.random() > 0.25) { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat); hair.scale.set(1, 1.05, 1); hair.position.y = 0.82; torso.add(hair); }
  }

  // tap target
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.y = 1.0; group.add(hit);

  // status icon
  const iconCanvas = document.createElement('canvas'); iconCanvas.width = iconCanvas.height = 64;
  const iconTex = new THREE.CanvasTexture(iconCanvas);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, depthTest: false, transparent: true }));
  icon.scale.set(0.6, 0.6, 0.6); icon.position.y = 1.85; icon.visible = false; group.add(icon);

  return { group, rig, torso, legL, legR, armL, armR, hit, ring, icon, iconTex, iconCanvas, lastIcon: '', walkPhase: Math.random() * 6 };
}

export function setIcon(v: CharView, text: string) {
  if (v.lastIcon === text) return;
  v.lastIcon = text;
  if (!text) { v.icon.visible = false; return; }
  const ctx = v.iconCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.font = '46px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 36);
  v.iconTex.needsUpdate = true; v.icon.visible = true;
}
