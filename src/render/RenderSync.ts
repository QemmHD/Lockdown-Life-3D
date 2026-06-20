import * as THREE from 'three';
import { ECS, Entity } from '../ecs/world';
import { Position, Render, Brain, Needs, Agent, Social } from '../ecs/components';
import { makeCharacter, setIcon, updateBars, CharView } from './CharacterFactory';

// Reads sim state and animates Three.js characters. Never writes to the simulation.
export class RenderSync {
  private views = new Map<Entity, CharView>();
  pickList: THREE.Object3D[] = [];

  constructor(private scene: THREE.Scene, private ecs: ECS) {}

  setEcs(ecs: ECS) { this.ecs = ecs; }
  reset() {
    for (const v of this.views.values()) this.scene.remove(v.group);
    this.views.clear(); this.pickList.length = 0;
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
      const moving = !!ag?.path && ag.path.length > 0;

      // smooth follow of sim position + facing
      v.group.position.x = THREE.MathUtils.lerp(v.group.position.x, p.x, Math.min(1, dt * 12));
      v.group.position.z = THREE.MathUtils.lerp(v.group.position.z, p.z, Math.min(1, dt * 12));
      v.group.rotation.y = THREE.MathUtils.lerp(v.group.rotation.y, p.facing, Math.min(1, dt * 10));

      this.animate(v, b?.state ?? 'idle', b?.cphase, moving, dt, time, e);

      const isPlayer = !!b?.isPlayer;
      v.ring.visible = isPlayer || e === selected;
      v.glow.visible = v.ring.visible;
      if (v.ring.visible) {
        const tint = isPlayer ? 0xffd24a : 0x6dff9e;
        (v.ring.material as THREE.MeshBasicMaterial).color.setHex(tint);
        const s = (isPlayer ? 1.05 : 1) + Math.sin(time * 5) * 0.09; v.ring.scale.set(s, s, s);
        (v.glow.material as THREE.MeshBasicMaterial).color.setHex(tint);
        const gs = (isPlayer ? 1.05 : 1) + Math.sin(time * 5) * 0.06; v.glow.scale.set(gs, gs, gs);
      }
      const n = this.ecs.get<Needs>(e, 'Needs');
      if (b && n) { setIcon(v, this.icon(b, n)); if (v.icon.visible) v.icon.position.y = 1.85 + Math.sin(time * 4 + e) * 0.06; }

      // Stage 3.8A: in-world status bars — show on selected or hurt characters
      if (n) {
        const soc = this.ecs.get<Social>(e, 'Social');
        const showBars = e === selected || isPlayer || n.health < 0.85;
        updateBars(v, n.health, n.energy, soc?.suspicion ?? 0, showBars);
        // make bars face the camera (billboard)
        v.barGroup.quaternion.copy(v.group.quaternion).invert();
      }
    }
  }

  private animate(v: CharView, state: string, cphase: string | undefined, moving: boolean, dt: number, time: number, e: Entity) {
    // reset body transform that 'down' may have set
    if (state === 'down') {
      v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, Math.PI / 2.1, 0.15);
      v.rig.position.y = THREE.MathUtils.lerp(v.rig.position.y, 0.1, 0.15);
      return;
    }
    v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, 0, 0.2);

    if (moving) {
      v.walkPhase += dt * 9;
      const sw = Math.sin(v.walkPhase) * 0.7;
      v.legL.rotation.x = sw; v.legR.rotation.x = -sw;
      v.armL.rotation.x = -sw * 0.7; v.armR.rotation.x = sw * 0.7;
      v.rig.position.y = Math.abs(Math.sin(v.walkPhase)) * 0.05;
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0.1, 0.2); // lean into movement
      // Stage 3.8A: head bob while walking
      v.head.rotation.z = Math.sin(v.walkPhase * 0.5) * 0.04;
    } else if (state === 'fight') {
      // read the sim's combat phase and pose accordingly (read-only)
      const k = Math.min(1, dt * 16);
      let aL = -0.6, aR = -1.0, lL = 0.18, lR = -0.18, leanX = 0, leanZ = 0, lift = 0;
      switch (cphase) {
        case 'windup': aR = 0.9; aL = -0.4; leanX = -0.12; leanZ = -0.15; break;     // pull back
        case 'strike': aR = -2.1; aL = -0.3; leanX = 0.3; lift = 0.04; break;          // snap forward
        case 'block': aL = -1.5; aR = -1.5; leanX = -0.18; break;                       // arms up
        case 'dodge': aL = -0.5; aR = -0.5; leanZ = 0.35; break;                        // shift aside
        case 'hitReact': aL = -0.2; aR = -0.2; leanX = -0.35; break;                    // jerk back
        case 'stumble': aL = -0.1; aR = -0.1; leanX = -0.3; leanZ = Math.sin(time * 18 + e) * 0.18; break;
        default: { const j = Math.abs(Math.sin(time * 7 + e)) * 0.25; aR = -1.0 - j; aL = -0.6; }   // squareUp bob
      }
      v.armR.rotation.x = THREE.MathUtils.lerp(v.armR.rotation.x, aR, k);
      v.armL.rotation.x = THREE.MathUtils.lerp(v.armL.rotation.x, aL, k);
      v.legL.rotation.x = THREE.MathUtils.lerp(v.legL.rotation.x, lL, k);
      v.legR.rotation.x = THREE.MathUtils.lerp(v.legR.rotation.x, lR, k);
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, leanX, k);
      v.rig.rotation.z = THREE.MathUtils.lerp(v.rig.rotation.z, leanZ, k);
      v.rig.position.y = THREE.MathUtils.lerp(v.rig.position.y, lift, k);
    } else {
      // idle breathing + slight arm sway; guards stand alert (arms slightly out)
      const breathe = Math.sin(time * 2 + e) * 0.02;
      v.legL.rotation.x = THREE.MathUtils.lerp(v.legL.rotation.x, 0, 0.2);
      v.legR.rotation.x = THREE.MathUtils.lerp(v.legR.rotation.x, 0, 0.2);
      const armBase = state === 'respond' ? -0.35 : 0.04 + breathe;
      v.armL.rotation.x = THREE.MathUtils.lerp(v.armL.rotation.x, armBase, 0.15);
      v.armR.rotation.x = THREE.MathUtils.lerp(v.armR.rotation.x, armBase, 0.15);
      v.rig.position.y = breathe;
      v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0, 0.2);
      // Stage 3.8A: subtle idle head turn
      v.head.rotation.y = THREE.MathUtils.lerp(v.head.rotation.y, Math.sin(time * 0.8 + e * 2) * 0.12, 0.05);
      v.head.rotation.z = THREE.MathUtils.lerp(v.head.rotation.z, 0, 0.1);
    }
  }

  pick(ray: THREE.Raycaster): Entity | null {
    const hits = ray.intersectObjects(this.pickList, false);
    for (const h of hits) { const e = h.object.userData.entity; if (e != null) return e as Entity; }
    return null;
  }
  worldOf(e: Entity) { const v = this.views.get(e); return v ? { x: v.group.position.x, z: v.group.position.z } : null; }
}
