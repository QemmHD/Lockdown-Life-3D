import * as THREE from 'three';
import { ECS, Entity } from '../ecs/world';
import { Position, Render, Brain, Needs, Agent } from '../ecs/components';
import { makeCharacter, setIcon, CharView } from './CharacterFactory';

// Reads sim state and updates Three.js objects. Never writes to the simulation.
export class RenderSync {
  private views = new Map<Entity, CharView>();
  pickList: THREE.Object3D[] = [];

  constructor(private scene: THREE.Scene, private ecs: ECS) {}

  setEcs(ecs: ECS) { this.ecs = ecs; }
  reset() {
    for (const v of this.views.values()) this.scene.remove(v.group);
    this.views.clear();
    this.pickList.length = 0;
  }

  private ensure(e: Entity, r: Render): CharView {
    let v = this.views.get(e);
    if (!v) {
      v = makeCharacter(r.kind, r.color);
      v.hit.userData.entity = e;
      this.scene.add(v.group);
      this.views.set(e, v);
      this.pickList.push(v.hit);
    }
    return v;
  }

  private icon(b: Brain, n: Needs): string {
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
      // smooth toward sim position
      v.group.position.x = THREE.MathUtils.lerp(v.group.position.x, p.x, Math.min(1, dt * 12));
      v.group.position.z = THREE.MathUtils.lerp(v.group.position.z, p.z, Math.min(1, dt * 12));
      v.group.rotation.y = THREE.MathUtils.lerp(v.group.rotation.y, p.facing, Math.min(1, dt * 10));

      const ag = this.ecs.get<Agent>(e, 'Agent');
      const moving = !!ag?.path && ag.path.length > 0;
      const b = this.ecs.get<Brain>(e, 'Brain');
      // walk bob
      const bob = moving ? Math.abs(Math.sin(time * 9 + e)) * 0.06 : 0;
      v.group.position.y = bob;

      v.ring.visible = e === selected;
      const n = this.ecs.get<Needs>(e, 'Needs');
      if (b && n) setIcon(v, this.icon(b, n));
    }
  }

  pick(ray: THREE.Raycaster): Entity | null {
    const hits = ray.intersectObjects(this.pickList, false);
    for (const h of hits) { const e = h.object.userData.entity; if (e != null) return e as Entity; }
    return null;
  }

  worldOf(e: Entity): { x: number; z: number } | null {
    const v = this.views.get(e); return v ? { x: v.group.position.x, z: v.group.position.z } : null;
  }
}
