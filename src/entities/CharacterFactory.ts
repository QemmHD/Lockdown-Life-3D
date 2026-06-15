import * as THREE from 'three';

export type AnimState =
  | 'idle' | 'walk' | 'sprint' | 'punch' | 'block' | 'shove'
  | 'hit' | 'ko' | 'interact' | 'eat' | 'train' | 'sleep' | 'pickup';

export interface CharacterOptions {
  height: number;       // build scale
  skin: number;
  hair: number;
  hairStyle: 'short' | 'bald' | 'mohawk' | 'cap' | 'beanie' | 'long';
  uniform: number;      // body color
  accentColor: number;  // armband / faction marker
  guard?: boolean;
  staff?: boolean;
  accent?: 'glasses' | 'beard' | 'scar' | 'none';
  ringColor?: number;
  showRing?: boolean;
}

function mat(color: number, flat = true): THREE.Material {
  return new THREE.MeshStandardMaterial({ color, flatShading: flat, roughness: 0.72, metalness: 0.04 });
}

// Shared toon outline material (rendered on the back faces of a slightly enlarged shell)
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x0a0a0c, side: THREE.BackSide });

// Attach a black back-face shell to a mesh so it reads with a thick silhouette.
function shell(mesh: THREE.Mesh, scale = 1.1) {
  const s = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
  s.scale.setScalar(scale);
  mesh.add(s);
  return mesh;
}

export class CharacterRig {
  group = new THREE.Group();
  private parts: Record<string, THREE.Object3D> = {};
  private armL!: THREE.Object3D;
  private armR!: THREE.Object3D;
  private legL!: THREE.Object3D;
  private legR!: THREE.Object3D;
  private torso!: THREE.Object3D;
  private head!: THREE.Object3D;
  private body = new THREE.Group();
  private ring?: THREE.Mesh;
  private exclaim?: THREE.Sprite;

  state: AnimState = 'idle';
  private prevState: AnimState = 'idle';
  private animTime = 0;
  private walkPhase = 0;
  facing = 0; // radians
  private h: number;

  constructor(opts: CharacterOptions) {
    this.h = opts.height;
    this.build(opts);
  }

  private build(o: CharacterOptions) {
    const h = o.height;
    const skinMat = mat(o.skin);
    const uni = mat(o.uniform);
    const dark = mat(0x222222);

    // contact shadow (cheap fake)
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42 * h, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.group.add(shadow);

    // selection / faction ring
    if (o.showRing) {
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(0.44 * h, 0.56 * h, 24),
        new THREE.MeshBasicMaterial({ color: o.ringColor ?? 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.04;
      this.group.add(this.ring);
    }

    this.body.scale.setScalar(1);
    this.group.add(this.body);

    // Legs (pivot at hip)
    this.legL = this.makeLimb(0.19 * h, 0.62 * h, 0.22 * h, uni);
    this.legL.position.set(-0.13 * h, 0.62 * h, 0);
    this.legR = this.makeLimb(0.19 * h, 0.62 * h, 0.22 * h, uni);
    this.legR.position.set(0.13 * h, 0.62 * h, 0);
    // shoes
    for (const leg of [this.legL, this.legR]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22 * h, 0.12 * h, 0.3 * h), dark);
      shoe.position.set(0, -0.62 * h + 0.06 * h, 0.04 * h);
      shoe.castShadow = true;
      leg.add(shoe);
    }
    this.body.add(this.legL, this.legR);

    // Torso
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.62 * h, 0);
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52 * h, 0.66 * h, 0.32 * h), uni);
    torsoMesh.position.y = 0.33 * h;
    torsoMesh.castShadow = true;
    shell(torsoMesh, 1.07);
    this.torso.add(torsoMesh);

    // faction armband
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.16 * h, 0.16 * h, 0.34 * h), mat(o.accentColor));
    band.position.set(-0.3 * h, 0.42 * h, 0);
    this.torso.add(band);

    // guard accessories: vest + baton hint, staff: apron
    if (o.guard) {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56 * h, 0.4 * h, 0.36 * h), mat(0x1b2430));
      vest.position.y = 0.36 * h;
      this.torso.add(vest);
    } else if (o.staff) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5 * h, 0.4 * h, 0.34 * h), mat(0xeeeeee));
      apron.position.y = 0.3 * h;
      this.torso.add(apron);
    }
    this.body.add(this.torso);

    // Arms (pivot at shoulder, hang down)
    this.armL = this.makeLimb(0.15 * h, 0.56 * h, 0.18 * h, uni, skinMat);
    this.armL.position.set(-0.34 * h, 0.56 * h, 0);
    this.armR = this.makeLimb(0.15 * h, 0.56 * h, 0.18 * h, uni, skinMat);
    this.armR.position.set(0.34 * h, 0.56 * h, 0);
    this.torso.add(this.armL, this.armR);

    // Head
    this.head = new THREE.Group();
    this.head.position.y = 0.72 * h;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34 * h, 0.36 * h, 0.34 * h), skinMat);
    headMesh.castShadow = true;
    shell(headMesh, 1.08);
    this.head.add(headMesh);
    // eyes
    const eyeGeo = new THREE.BoxGeometry(0.05 * h, 0.05 * h, 0.02 * h);
    const eyeMat = mat(0x111111);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.08 * h, 0.02 * h, 0.18 * h);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.08 * h, 0.02 * h, 0.18 * h);
    this.head.add(eyeL, eyeR);

    // hair / hat
    this.addHair(o, h);
    if (o.accent === 'glasses') {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.3 * h, 0.06 * h, 0.02 * h), mat(0x111111));
      g.position.set(0, 0.02 * h, 0.19 * h);
      this.head.add(g);
    }
    if (o.accent === 'beard') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.26 * h, 0.14 * h, 0.06 * h), mat(o.hair));
      b.position.set(0, -0.14 * h, 0.16 * h);
      this.head.add(b);
    }
    if (o.accent === 'scar') {
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.03 * h, 0.16 * h, 0.02 * h), mat(0x9b4a3a));
      sc.position.set(0.1 * h, 0.04 * h, 0.18 * h);
      this.head.add(sc);
    }
    this.torso.add(this.head);

    this.parts = { torso: this.torso, head: this.head };
    this.group.castShadow = true;
  }

  private addHair(o: CharacterOptions, h: number) {
    const hairMat = mat(o.hair);
    if (o.hairStyle === 'bald') return;
    if (o.hairStyle === 'cap') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38 * h, 0.16 * h, 0.38 * h), o.guard ? mat(0x1b2430) : hairMat);
      cap.position.y = 0.2 * h;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.38 * h, 0.05 * h, 0.16 * h), o.guard ? mat(0x1b2430) : hairMat);
      brim.position.set(0, 0.14 * h, 0.24 * h);
      this.head.add(cap, brim);
      return;
    }
    if (o.hairStyle === 'beanie') {
      const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.2 * h, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
      beanie.position.y = 0.14 * h;
      this.head.add(beanie);
      return;
    }
    if (o.hairStyle === 'mohawk') {
      const mh = new THREE.Mesh(new THREE.BoxGeometry(0.08 * h, 0.18 * h, 0.34 * h), hairMat);
      mh.position.y = 0.26 * h;
      this.head.add(mh);
      return;
    }
    if (o.hairStyle === 'long') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.38 * h, 0.14 * h, 0.38 * h), hairMat);
      top.position.y = 0.2 * h;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.36 * h, 0.34 * h, 0.1 * h), hairMat);
      back.position.set(0, 0.0 * h, -0.2 * h);
      this.head.add(top, back);
      return;
    }
    // short
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.38 * h, 0.12 * h, 0.38 * h), hairMat);
    top.position.y = 0.2 * h;
    this.head.add(top);
  }

  private makeLimb(w: number, hgt: number, d: number, m: THREE.Material, handMat?: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), m);
    mesh.position.y = -hgt / 2;
    mesh.castShadow = true;
    shell(mesh, 1.12);
    g.add(mesh);
    if (handMat) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, w * 1.1, d * 1.1), handMat);
      hand.position.y = -hgt;
      g.add(hand);
    }
    return g;
  }

  setRingVisible(v: boolean) { if (this.ring) this.ring.visible = v; }
  setRingColor(c: number) { if (this.ring) (this.ring.material as THREE.MeshBasicMaterial).color.setHex(c); }

  showExclaim(scene: THREE.Object3D, show: boolean) {
    if (show && !this.exclaim) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', 32, 52);
      const tex = new THREE.CanvasTexture(cv);
      this.exclaim = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      this.exclaim.scale.set(0.5, 0.5, 0.5);
      this.exclaim.position.y = 2.4 * this.h;
      this.group.add(this.exclaim);
    }
    if (this.exclaim) this.exclaim.visible = show;
  }

  setState(s: AnimState) {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.animTime = 0;
  }

  isBusy(): boolean {
    return ['punch', 'shove', 'hit', 'pickup', 'interact'].includes(this.state) && this.animTime < 0.4;
  }

  update(dt: number, speed: number) {
    this.animTime += dt;
    this.group.rotation.y = this.facing;
    const h = this.h;

    // reset
    let alBob = 0, legSwing = 0, armSwing = 0, headBob = 0;

    if (this.state === 'ko') {
      this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, Math.PI / 2.1, 0.1);
      this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, 0.1, 0.1);
      this.armL.rotation.x = 0; this.armR.rotation.x = 0;
      return;
    } else {
      this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, 0, 0.2);
      this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, 0, 0.2);
    }

    if (this.state === 'walk' || this.state === 'sprint') {
      const rate = this.state === 'sprint' ? 12 : 8;
      this.walkPhase += dt * rate * (0.6 + speed);
      legSwing = Math.sin(this.walkPhase) * (this.state === 'sprint' ? 0.9 : 0.6);
      armSwing = Math.sin(this.walkPhase) * 0.5;
      alBob = Math.abs(Math.sin(this.walkPhase)) * 0.05 * h;
    } else if (this.state === 'idle') {
      headBob = Math.sin(this.animTime * 2) * 0.02 * h;
      armSwing = Math.sin(this.animTime * 1.5) * 0.05;
    } else if (this.state === 'sleep') {
      this.body.rotation.z = Math.PI / 2.1;
      this.body.position.y = 0.1;
    }

    this.legL.rotation.x = legSwing;
    this.legR.rotation.x = -legSwing;
    this.body.position.y = (this.state === 'walk' || this.state === 'sprint') ? alBob : THREE.MathUtils.lerp(this.body.position.y, 0, 0.2);
    this.head.position.y = 0.72 * h + headBob;

    // action poses (time-based blend)
    const a = this.animTime;
    if (this.state === 'punch') {
      const p = Math.sin(Math.min(a / 0.25, 1) * Math.PI);
      this.armR.rotation.x = -p * 1.7;
      this.armL.rotation.x = armSwing;
      if (a > 0.3) this.setState('idle');
    } else if (this.state === 'shove') {
      const p = Math.sin(Math.min(a / 0.25, 1) * Math.PI);
      this.armR.rotation.x = -p * 1.4;
      this.armL.rotation.x = -p * 1.4;
      if (a > 0.3) this.setState('idle');
    } else if (this.state === 'block') {
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, -1.9, 0.3);
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -1.9, 0.3);
      this.armL.rotation.z = 0.3; this.armR.rotation.z = -0.3;
    } else if (this.state === 'hit') {
      const p = Math.sin(Math.min(a / 0.2, 1) * Math.PI);
      this.body.rotation.x = -p * 0.4;
      if (a > 0.25) this.setState('idle');
    } else if (this.state === 'pickup' || this.state === 'interact') {
      const p = Math.sin(Math.min(a / 0.3, 1) * Math.PI);
      this.armR.rotation.x = -p * 1.2;
      this.armL.rotation.x = -p * 1.2;
      if (a > 0.4) this.setState('idle');
    } else if (this.state === 'eat') {
      this.armR.rotation.x = -1.2 + Math.sin(a * 8) * 0.3;
      if (a > 0.6) this.setState('idle');
    } else if (this.state === 'train') {
      this.armL.rotation.x = -1.4 + Math.sin(a * 6) * 0.5;
      this.armR.rotation.x = -1.4 + Math.sin(a * 6 + Math.PI) * 0.5;
    } else {
      // default arm rest with swing
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, armSwing, 0.3);
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -armSwing, 0.3);
      this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, 0.08, 0.2);
      this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, -0.08, 0.2);
      this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, 0, 0.2);
    }
  }

  dispose() {
    this.group.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mm = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose()); else mm.dispose();
      }
    });
  }
}
