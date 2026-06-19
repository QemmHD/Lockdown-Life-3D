import * as THREE from 'three';
import { THEME } from './VisualTheme';
import { groundGlow } from './Glow';

export interface CharView {
  group: THREE.Group;
  rig: THREE.Group;       // body (bob/lean applied here, not the shadow/ring)
  torso: THREE.Group;
  legL: THREE.Group; legR: THREE.Group;
  armL: THREE.Group; armR: THREE.Group;
  head: THREE.Group;
  hit: THREE.Mesh;        // invisible large tap target
  ring: THREE.Mesh;       // selection ring
  glow: THREE.Mesh;       // soft ground pool of light under player/selected
  icon: THREE.Sprite;
  iconTex: THREE.CanvasTexture;
  iconCanvas: HTMLCanvasElement;
  lastIcon: string;
  walkPhase: number;
  // in-world status bars (Stage 3.8A)
  barGroup: THREE.Group;
  barHealth: THREE.Mesh;
  barEnergy: THREE.Mesh;
  barSuspicion: THREE.Mesh;
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b0b0e, side: THREE.BackSide });
function shell(mesh: THREE.Mesh, s = 1.12) { const m = new THREE.Mesh(mesh.geometry, OUTLINE); m.scale.setScalar(s); mesh.add(m); }
function pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)]; }

function limb(w: number, h: number, d: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(w, d) / 2, h - Math.min(w, d), 3, 8), mat);
  m.position.y = -h / 2; m.castShadow = true; shell(m, 1.12); g.add(m);
  return g;
}

// hair style builders
function hairBuzz(mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), mat);
  m.scale.set(1, 1.02, 1); return m;
}
function hairFlat(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.34), mat);
  top.position.y = 0.2; g.add(top);
  const sides = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat);
  sides.scale.set(1, 0.8, 1); g.add(sides);
  return g;
}
function hairMohawk(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), mat);
    spike.position.set(0, 0.22, i * 0.07); g.add(spike);
  }
  return g;
}
function hairLong(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.6), mat);
  top.scale.set(1, 1.05, 1); g.add(top);
  // back drape
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.14), mat);
  back.position.set(0, -0.12, -0.12); g.add(back);
  return g;
}
function hairAfro(mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mat);
  m.scale.set(1, 1.1, 1); m.position.y = 0.06; return m;
}
const HAIR_BUILDERS = [hairBuzz, hairFlat, hairMohawk, hairLong, hairAfro];

// status bar helpers
function makeBarBg(w: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false })
  );
  return m;
}
function makeBarFill(w: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, 0.05),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false })
  );
  return m;
}

export interface AppearanceOpt { skin: number; hair: number; accent: number; build: 'slim' | 'average' | 'stocky'; }
export function makeCharacter(kind: 'prisoner' | 'guard', color: number, look?: AppearanceOpt): CharView {
  const group = new THREE.Group();
  // body build affects proportions, not just uniform scale
  const buildKey = look?.build ?? pick(['slim', 'average', 'stocky'] as const);
  const buildDef = {
    slim:    { scale: 1.05, torsoW: 0.42, torsoD: 0.24, shoulderW: 0.28, legW: 0.15, armW: 0.11 },
    average: { scale: 1.15, torsoW: 0.50, torsoD: 0.30, shoulderW: 0.33, legW: 0.18, armW: 0.14 },
    stocky:  { scale: 1.28, torsoW: 0.58, torsoD: 0.36, shoulderW: 0.38, legW: 0.20, armW: 0.16 }
  }[buildKey];

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18),
    new THREE.MeshBasicMaterial({ color: THEME.contactShadow, transparent: true, opacity: 0.45, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; group.add(shadow);

  // soft ground glow under the picked/player inmate (additive pool of light)
  const glow = groundGlow(THEME.selection, 1.8, 0.4); glow.visible = false; group.add(glow);

  // selection ring (thick + bright so the picked inmate pops)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28),
    new THREE.MeshBasicMaterial({ color: THEME.selection, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; group.add(ring);

  const rig = new THREE.Group(); rig.scale.setScalar(buildDef.scale); group.add(rig);

  const skinColor = look ? look.skin : (kind === 'guard' ? THEME.guard.skin : pick(THEME.prisoners.skins));
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75 });
  const uniColor = kind === 'guard' ? THEME.guard.uniform : (look ? look.accent : color);
  const uniMat = new THREE.MeshStandardMaterial({ color: uniColor, roughness: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: kind === 'guard' ? THEME.guard.trousers : THEME.prisonerTrousers, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x252528, roughness: 0.8 });

  // --- LEGS (hips at y=0.58) ---
  const legH = 0.58;
  const legL = limb(buildDef.legW, legH, buildDef.legW + 0.04, legMat); legL.position.set(-0.13, legH, 0);
  const legR = limb(buildDef.legW, legH, buildDef.legW + 0.04, legMat); legR.position.set(0.13, legH, 0);
  // shoes
  for (const lg of [legL, legR]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.32), shoeMat);
    sh.position.set(0, -legH / 2 - 0.04, 0.04); sh.castShadow = true; lg.add(sh);
  }
  rig.add(legL, legR);

  // --- TORSO ---
  const torso = new THREE.Group(); torso.position.y = legH; rig.add(torso);
  const torsoH = 0.60;
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(buildDef.torsoW, torsoH, buildDef.torsoD), uniMat);
  torsoMesh.position.y = torsoH / 2 + 0.02; torsoMesh.castShadow = true; shell(torsoMesh, 1.05); torso.add(torsoMesh);
  // shoulder cap (wider than torso for a more readable silhouette)
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(buildDef.torsoW + 0.14, 0.1, buildDef.torsoD + 0.02), uniMat);
  shoulders.position.y = torsoH + 0.02; torso.add(shoulders);

  // collar detail for prisoners
  if (kind === 'prisoner') {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(buildDef.torsoW * 0.55, 0.06, buildDef.torsoD + 0.02),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 }));
    collar.position.y = torsoH + 0.04; torso.add(collar);
  }

  // --- ARMS (shoulders) ---
  const armH = 0.52;
  const armL = limb(buildDef.armW, armH, buildDef.armW + 0.02, uniMat);
  armL.position.set(-(buildDef.torsoW / 2 + buildDef.armW / 2 + 0.04), torsoH - 0.02, 0);
  const armR = limb(buildDef.armW, armH, buildDef.armW + 0.02, uniMat);
  armR.position.set((buildDef.torsoW / 2 + buildDef.armW / 2 + 0.04), torsoH - 0.02, 0);
  // forearm skin (lower arm visible)
  for (const a of [armL, armR]) {
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(buildDef.armW / 2 - 0.01, 0.15, 2, 6), skinMat);
    forearm.position.y = -armH * 0.7; a.add(forearm);
  }
  // hands (slightly larger, more readable)
  for (const a of [armL, armR]) {
    const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skinMat);
    hnd.position.y = -armH - 0.02; a.add(hnd);
  }
  torso.add(armL, armR);

  // --- NECK + HEAD ---
  const headGroup = new THREE.Group();
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 8), skinMat);
  neck.position.y = torsoH + 0.1; torso.add(neck);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  headMesh.scale.set(1, 1.1, 0.95); headMesh.castShadow = true; shell(headMesh, 1.05);
  headGroup.add(headMesh);
  headGroup.position.y = torsoH + 0.26;
  torso.add(headGroup);

  // --- FACE (facing +z) ---
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x14140f });
  for (const ex of [-0.075, 0.075]) {
    // eye white
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat);
    ew.position.set(ex, 0.03, 0.18); ew.scale.set(1, 0.75, 0.5); headGroup.add(ew);
    // pupil
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), pupilMat);
    ep.position.set(ex, 0.03, 0.20); headGroup.add(ep);
  }
  // eyebrows
  const browMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  for (const ex of [-0.075, 0.075]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), browMat);
    brow.position.set(ex, 0.075, 0.19); headGroup.add(brow);
  }
  // nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), skinMat);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, -0.01, 0.22); headGroup.add(nose);
  // mouth line
  const mouthMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinColor).multiplyScalar(0.6).getHex(), roughness: 0.9 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.01), mouthMat);
  mouth.position.set(0, -0.06, 0.2); headGroup.add(mouth);
  // ears
  for (const ex of [-0.2, 0.2]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), skinMat);
    ear.scale.set(0.5, 0.8, 0.6); ear.position.set(ex, 0.0, 0.02); headGroup.add(ear);
  }

  // --- HAIR / GUARD CAP ---
  if (kind === 'guard') {
    // guard cap with visor
    const capMat = new THREE.MeshStandardMaterial({ color: THEME.guard.cap, roughness: 0.5 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 14), capMat);
    cap.position.y = 0.18; headGroup.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.22), capMat);
    brim.position.set(0, 0.14, 0.15); headGroup.add(brim);
    // badge on chest
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8),
      new THREE.MeshStandardMaterial({ color: THEME.guard.badge, emissive: THEME.guard.badge, emissiveIntensity: 0.3 }));
    badge.position.set(-0.12, torsoH * 0.7, buildDef.torsoD / 2 + 0.01); torso.add(badge);
    // utility belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(buildDef.torsoW + 0.04, 0.08, buildDef.torsoD + 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.7 }));
    belt.position.y = 0.06; torso.add(belt);
    // radio on shoulder
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111114 }));
    radio.position.set(-(buildDef.torsoW / 2), torsoH + 0.02, 0); torso.add(radio);
    // baton
    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.44, 6),
      new THREE.MeshStandardMaterial({ color: 0x222226 }));
    baton.position.set(0.28, 0.12, 0.06); armR.add(baton);
  } else {
    // prisoner hair — pick a random style
    const hairColor = look ? look.hair : pick(THEME.prisoners.hair);
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
    if (Math.random() > 0.12) { // 12% bald
      const builder = pick(HAIR_BUILDERS);
      const hairObj = builder(hairMat);
      hairObj.position.y = 0.1;
      headGroup.add(hairObj);
    }
  }

  // --- TAP TARGET (bigger for touch) ---
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 2.2, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.position.y = 1.1; group.add(hit);

  // --- STATUS ICON (emoji above head) ---
  const iconCanvas = document.createElement('canvas'); iconCanvas.width = iconCanvas.height = 64;
  const iconTex = new THREE.CanvasTexture(iconCanvas);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, depthTest: false, transparent: true }));
  icon.scale.set(0.65, 0.65, 0.65); icon.position.y = 2.1; icon.visible = false; group.add(icon);

  // --- IN-WORLD STATUS BARS (Stage 3.8A) ---
  const barGroup = new THREE.Group();
  barGroup.position.y = 2.0;
  barGroup.visible = false;
  const barW = 0.7;
  // health bar
  const hBg = makeBarBg(barW); hBg.position.y = 0.1; barGroup.add(hBg);
  const barHealth = makeBarFill(barW, 0xe74c3c); barHealth.position.y = 0.1; barHealth.position.z = 0.001; barGroup.add(barHealth);
  // energy bar
  const eBg = makeBarBg(barW); eBg.position.y = 0.02; barGroup.add(eBg);
  const barEnergy = makeBarFill(barW, 0x2ecc71); barEnergy.position.y = 0.02; barEnergy.position.z = 0.001; barGroup.add(barEnergy);
  // suspicion bar (only visible when > 0)
  const sBg = makeBarBg(barW); sBg.position.y = -0.06; barGroup.add(sBg);
  const barSuspicion = makeBarFill(barW, 0xf39c12); barSuspicion.position.y = -0.06; barSuspicion.position.z = 0.001; barGroup.add(barSuspicion);
  group.add(barGroup);

  return {
    group, rig, torso, legL, legR, armL, armR, head: headGroup,
    hit, ring, glow, icon, iconTex, iconCanvas, lastIcon: '', walkPhase: Math.random() * 6,
    barGroup, barHealth, barEnergy, barSuspicion
  };
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

// update in-world status bar widths (called from RenderSync)
export function updateBars(v: CharView, health: number, energy: number, suspicion: number, isVisible: boolean) {
  v.barGroup.visible = isVisible;
  if (!isVisible) return;
  const barW = 0.7;
  // scale X to show fill percentage, offset X to keep left-aligned
  v.barHealth.scale.x = Math.max(0.001, health);
  v.barHealth.position.x = -(barW * (1 - health)) / 2;
  v.barEnergy.scale.x = Math.max(0.001, energy);
  v.barEnergy.position.x = -(barW * (1 - energy)) / 2;
  v.barSuspicion.scale.x = Math.max(0.001, suspicion / 100);
  v.barSuspicion.position.x = -(barW * (1 - suspicion / 100)) / 2;
  // hide suspicion bar background when suspicion is 0
  const sBg = v.barGroup.children[4]; // 5th child = suspicion bg
  if (sBg) (sBg as THREE.Mesh).visible = suspicion > 0;
  v.barSuspicion.visible = suspicion > 0;
}
