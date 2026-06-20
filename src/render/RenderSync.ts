import * as THREE from 'three';
import { ECS, Entity } from '../ecs/world';
import { Position, Render, Brain, Needs, Agent, Social, Inventory } from '../ecs/components';
import { makeCharacter, setIcon, updateBars, setWeapon, setBrows, WeaponKind, CharView } from './CharacterFactory';
import { ITEMS } from '../data/items';

// Reads sim state and animates Three.js characters. Never writes to the simulation.
export class RenderSync {
  private views = new Map<Entity, CharView>();
  private anim = new Map<Entity, { last: string; victoryT: number }>();   // render-only memory (not serialized)
  pickList: THREE.Object3D[] = [];

  constructor(private scene: THREE.Scene, private ecs: ECS) {}

  setEcs(ecs: ECS) { this.ecs = ecs; }
  reset() {
    for (const v of this.views.values()) this.scene.remove(v.group);
    this.views.clear(); this.anim.clear(); this.pickList.length = 0;
  }

  private ensure(e: Entity, r: Render): CharView {
    let v = this.views.get(e);
    if (!v) {
      v = makeCharacter(r.kind, r.color, r.appearance);
      v.hit.userData.entity = e;
      this.scene.add(v.group);
      this.views.set(e, v);
      this.pickList.push(v.hit);
    }
    return v;
  }

  private memOf(e: Entity) {
    let m = this.anim.get(e);
    if (!m) { m = { last: 'idle', victoryT: 0 }; this.anim.set(e, m); }
    return m;
  }

  // strongest carried weapon → which held-weapon mesh to show (read-only)
  private weaponKind(e: Entity): WeaponKind {
    const inv = this.ecs.get<Inventory>(e, 'Inventory'); if (!inv) return '';
    let best: WeaponKind = '', bc = 0;
    for (const id of inv.items) {
      const c = ITEMS[id]?.combat ?? 0;
      if (c > bc) { bc = c; best = id === 'club' ? 'club' : id === 'blade' ? 'blade' : id === 'tool' ? 'tool' : 'shiv'; }
    }
    return bc > 0 ? best : '';
  }

  private icon(b: Brain, n: Needs): string {
    if (b.state === 'breakdown') return '😵';
    if (b.state === 'fight') return '⚔️';
    if (b.state === 'down') return '💫';
    if (b.state === 'respond') return '❗';
    if (n.health < 0.35) return '🩸';
    if (n.anger > 0.8) return '😡';
    if (n.fear > 0.8) return '😱';
    if (n.hunger > 0.85) return '🍽️';
    if (n.sleep > 0.9) return '💤';
    return '';
  }

  update(dt: number, selected: Entity | null, time: number) {
    for (const e of this.ecs.query('Position', 'Render')) {
      const p = this.ecs.get<Position>(e, 'Position')!;
      const r = this.ecs.get<Render>(e, 'Render')!;
      const v = this.ensure(e, r);
      const b = this.ecs.get<Brain>(e, 'Brain');
      const ag = this.ecs.get<Agent>(e, 'Agent');
      const n = this.ecs.get<Needs>(e, 'Needs');
      const moving = !!ag?.path && ag.path.length > 0;

      // smooth follow of sim position + facing
      v.group.position.x = THREE.MathUtils.lerp(v.group.position.x, p.x, Math.min(1, dt * 12));
      v.group.position.z = THREE.MathUtils.lerp(v.group.position.z, p.z, Math.min(1, dt * 12));
      v.group.rotation.y = THREE.MathUtils.lerp(v.group.rotation.y, p.facing, Math.min(1, dt * 10));

      this.animate(v, b, moving, dt, time, e, n);

      const isPlayer = !!b?.isPlayer;
      // show a held weapon only in violent / inspected moments; angle brows to mood
      const showW = b?.state === 'fight' || b?.state === 'threatening' || isPlayer || e === selected;
      setWeapon(v, showW ? this.weaponKind(e) : '');
      if (n) setBrows(v, n.anger - n.fear);

      v.ring.visible = isPlayer || e === selected;
      v.glow.visible = v.ring.visible;
      if (v.ring.visible) {
        const tint = isPlayer ? 0xffd24a : 0x6dff9e;
        (v.ring.material as THREE.MeshBasicMaterial).color.setHex(tint);
        const s = (isPlayer ? 1.05 : 1) + Math.sin(time * 5) * 0.09; v.ring.scale.set(s, s, s);
        (v.glow.material as THREE.MeshBasicMaterial).color.setHex(tint);
        const gs = (isPlayer ? 1.05 : 1) + Math.sin(time * 5) * 0.06; v.glow.scale.set(gs, gs, gs);
      }
      if (b && n) { setIcon(v, this.icon(b, n)); if (v.icon.visible) v.icon.position.y = 1.85 + Math.sin(time * 4 + e) * 0.06; }

      // Stage 3.8A: in-world status bars — show on selected or hurt characters
      if (n) {
        const soc = this.ecs.get<Social>(e, 'Social');
        const showBars = e === selected || isPlayer || n.health < 0.85;
        updateBars(v, n.health, n.energy, soc?.suspicion ?? 0, showBars);
        v.barGroup.quaternion.copy(v.group.quaternion).invert();   // billboard
      }
    }
  }

  private animate(v: CharView, b: Brain | undefined, moving: boolean, dt: number, time: number, e: Entity, n: Needs | undefined) {
    const state = b?.state ?? 'idle';
    const cphase = b?.cphase;
    const injured = (b?.injuredT ?? 0) > 0;
    const mem = this.memOf(e);

    // KO / down — face-down sprawl
    if (state === 'down') {
      v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, Math.PI / 2.1, 0.15);
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0.25, 0.12);
      v.rig.position.y = THREE.MathUtils.lerp(v.rig.position.y, 0.12, 0.15);
      v.armL.rotation.x = THREE.MathUtils.lerp(v.armL.rotation.x, -0.4, 0.12);
      v.armR.rotation.x = THREE.MathUtils.lerp(v.armR.rotation.x, 0.5, 0.12);
      mem.last = state; mem.victoryT = 0;
      return;
    }
    v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, 0, 0.2);

    // became a winner (was fighting, now not) → trigger a brief victory pump
    if (mem.last === 'fight' && state !== 'fight') mem.victoryT = 1.1;

    if (moving) {
      v.walkPhase += dt * 9 * (injured ? 0.6 : 1);
      const sw = Math.sin(v.walkPhase) * 0.7;
      v.legL.rotation.x = sw; v.legR.rotation.x = injured ? -sw * 0.4 : -sw;   // drag a leg when hurt
      v.armL.rotation.x = -sw * 0.7; v.armR.rotation.x = sw * 0.7;
      v.rig.position.y = Math.abs(Math.sin(v.walkPhase)) * 0.05;
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, injured ? 0.22 : 0.1, 0.2);
      v.head.rotation.z = Math.sin(v.walkPhase * 0.5) * 0.04;
      v.torso.rotation.x = THREE.MathUtils.lerp(v.torso.rotation.x, 0, 0.2);
    } else if (state === 'fight') {
      const k = Math.min(1, dt * 16);
      let aL = -0.6, aR = -1.0, lL = 0.18, lR = -0.18, leanX = 0, leanZ = 0, lift = 0;
      switch (cphase) {
        case 'windup': aR = 0.9; aL = -0.4; leanX = -0.12; leanZ = -0.15; break;
        case 'strike': aR = -2.1; aL = -0.3; leanX = 0.3; lift = 0.04; break;
        case 'block': aL = -1.5; aR = -1.5; leanX = -0.18; break;
        case 'dodge': aL = -0.5; aR = -0.5; leanZ = 0.35; break;
        case 'hitReact': aL = -0.2; aR = -0.2; leanX = -0.35; break;
        case 'stumble': aL = -0.1; aR = -0.1; leanX = -0.3; leanZ = Math.sin(time * 18 + e) * 0.18; break;
        default: { const j = Math.abs(Math.sin(time * 7 + e)) * 0.25; aR = -1.0 - j; aL = -0.6; }
      }
      v.armR.rotation.x = THREE.MathUtils.lerp(v.armR.rotation.x, aR, k);
      v.armL.rotation.x = THREE.MathUtils.lerp(v.armL.rotation.x, aL, k);
      v.legL.rotation.x = THREE.MathUtils.lerp(v.legL.rotation.x, lL, k);
      v.legR.rotation.x = THREE.MathUtils.lerp(v.legR.rotation.x, lR, k);
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, leanX, k);
      v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, leanZ, k);
      v.rig.position.y = THREE.MathUtils.lerp(v.rig.position.y, lift, k);
      v.torso.rotation.x = THREE.MathUtils.lerp(v.torso.rotation.x, 0, 0.2);
    } else {
      this.poseFor(v, state, dt, time, e);
    }

    // breakdown — frantic shake on top of the idle pose
    if (state === 'breakdown') {
      v.rig.rotation.z = Math.sin(time * 38 + e) * 0.07;
      v.rig.position.y = Math.abs(Math.sin(time * 22)) * 0.03;
      v.armL.rotation.x = THREE.MathUtils.lerp(v.armL.rotation.x, -1.2 + Math.sin(time * 30) * 0.4, 0.3);
      v.armR.rotation.x = THREE.MathUtils.lerp(v.armR.rotation.x, -1.2 - Math.sin(time * 30) * 0.4, 0.3);
    }

    // injured hunch when standing (not in a fight pose)
    if (injured && !moving && state !== 'fight' && state !== 'breakdown') {
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0.22, 0.1);
      v.armL.rotation.x = THREE.MathUtils.lerp(v.armL.rotation.x, -0.6, 0.1);
    }

    // victory arm pump (overrides arms briefly after a win)
    if (mem.victoryT > 0) {
      mem.victoryT = Math.max(0, mem.victoryT - dt);
      const p = Math.abs(Math.sin((1.1 - mem.victoryT) * 12));
      v.armR.rotation.x = -2.0 - p * 0.5; v.armL.rotation.x = -1.8;
    }

    mem.last = state;
  }

  // pose table for all non-moving, non-fight, non-down states
  private poseFor(v: CharView, st: string, dt: number, time: number, e: Entity) {
    const L = (g: THREE.Group, ax: number, k = 0.18) => { g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, ax, k); };
    v.walkPhase += dt * 4; const ph = v.walkPhase;
    // settle baselines (cases override as needed)
    L(v.legL, 0, 0.2); L(v.legR, 0, 0.2);
    v.head.rotation.x = THREE.MathUtils.lerp(v.head.rotation.x, 0, 0.1);
    v.torso.rotation.x = THREE.MathUtils.lerp(v.torso.rotation.x, 0, 0.1);
    switch (st) {
      case 'resting':
        L(v.torso, -0.5, 0.06); L(v.legL, 1.0, 0.08); L(v.legR, 0.85, 0.08);
        v.rig.position.y = THREE.MathUtils.lerp(v.rig.position.y, 0.2, 0.06);
        v.head.rotation.z = THREE.MathUtils.lerp(v.head.rotation.z, -0.35, 0.06); break;
      case 'working': { const s = Math.sin(ph * 2.2); L(v.armR, -1.3 + s * 0.7, 0.3); L(v.armL, -0.3); v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0.16 + s * 0.04, 0.2); break; }
      case 'eating': { const s = (Math.sin(ph * 2) + 1) / 2; L(v.armR, -0.4 - s * 1.0, 0.3); v.head.rotation.x = THREE.MathUtils.lerp(v.head.rotation.x, s * 0.2, 0.2); break; }
      case 'washing': { const s = Math.sin(ph * 3); L(v.armR, -1.1 + s * 0.3); L(v.armL, -1.1 - s * 0.3); break; }
      case 'training': { const s = Math.abs(Math.sin(ph * 2.4)); v.rig.position.y = -s * 0.1; L(v.armR, -1.5 - s * 0.4); L(v.armL, -1.5 - s * 0.4); break; }
      case 'talking': case 'trading': case 'threatening': {
        const s = Math.sin(ph * 1.6); L(v.armR, -0.3 + s * 0.5, 0.2);
        v.head.rotation.y = THREE.MathUtils.lerp(v.head.rotation.y, s * 0.18, 0.1);
        if (st === 'threatening') v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0.12, 0.1);
        else v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0, 0.1);
        break;
      }
      case 'searching': case 'beingSearched': L(v.armL, -1.3); L(v.armR, -1.3); v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0, 0.1); break;
      case 'respond': case 'escorting': case 'escorted':
        L(v.armL, -0.35, 0.15); L(v.armR, -0.35, 0.15);
        v.rig.position.y = Math.sin(time * 2 + e) * 0.02;
        v.head.rotation.y = THREE.MathUtils.lerp(v.head.rotation.y, Math.sin(time * 1.5 + e) * 0.2, 0.05);
        v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0, 0.2); break;
      default: {
        const breathe = Math.sin(time * 2 + e) * 0.02; const sub = e % 3;
        L(v.armL, 0.04 + breathe, 0.15); L(v.armR, 0.04 + breathe, 0.15);
        v.rig.position.y = breathe;
        v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0, 0.2);
        if (sub === 0) v.head.rotation.y = THREE.MathUtils.lerp(v.head.rotation.y, Math.sin(time * 0.8 + e * 2) * 0.18, 0.05);
        else if (sub === 1) v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, Math.sin(time * 0.5 + e) * 0.04, 0.05);
        else v.head.rotation.x = THREE.MathUtils.lerp(v.head.rotation.x, Math.sin(time * 0.6 + e) * 0.06, 0.05);
        v.head.rotation.z = THREE.MathUtils.lerp(v.head.rotation.z, 0, 0.1);
      }
    }
  }

  pick(ray: THREE.Raycaster): Entity | null {
    const hits = ray.intersectObjects(this.pickList, false);
    for (const h of hits) { const e = h.object.userData.entity; if (e != null) return e as Entity; }
    return null;
  }
  worldOf(e: Entity) { const v = this.views.get(e); return v ? { x: v.group.position.x, z: v.group.position.z } : null; }
}
