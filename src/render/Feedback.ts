import * as THREE from 'three';
import { Entity } from '../ecs/world';

interface Float { el: HTMLDivElement; x: number; y: number; z: number; life: number; max: number; }
interface Bubble { el: HTMLDivElement; entity: Entity; life: number; max: number; }

type WorldOf = (e: Entity) => { x: number; z: number } | null;

// Lightweight world-anchored feedback (floating text + speech/icon bubbles).
// Pure presentation driven by EventBus events — never touches sim state.
export class Feedback {
  private layer: HTMLDivElement;
  private floats: Float[] = [];
  private bubbles: Bubble[] = [];
  private _v = new THREE.Vector3();

  constructor() {
    this.layer = document.createElement('div');
    this.layer.id = 'fx-layer';
    document.getElementById('ui-root')!.appendChild(this.layer);
  }

  float(x: number, z: number, text: string, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'float-fx'; el.textContent = text; el.style.color = color;
    this.layer.appendChild(el);
    this.floats.push({ el, x, y: 1.9, z, life: 0, max: 1.3 });
  }

  bubble(entity: Entity, text: string, kind = 'talk', dur = 1.4) {
    // one bubble per entity at a time
    const existing = this.bubbles.find((b) => b.entity === entity);
    if (existing) { existing.el.remove(); this.bubbles.splice(this.bubbles.indexOf(existing), 1); }
    const el = document.createElement('div');
    el.className = 'bubble-fx bubble-' + kind; el.textContent = text;
    this.layer.appendChild(el);
    this.bubbles.push({ el, entity, life: 0, max: dur });
  }

  update(dt: number, camera: THREE.Camera, worldOf: WorldOf) {
    const W = window.innerWidth, H = window.innerHeight;
    const project = (x: number, y: number, z: number) => {
      this._v.set(x, y, z).project(camera);
      return { sx: (this._v.x * 0.5 + 0.5) * W, sy: (-this._v.y * 0.5 + 0.5) * H, vis: this._v.z < 1 };
    };
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.life += dt; f.y += dt * 0.9;
      const p = project(f.x, f.y, f.z);
      f.el.style.left = p.sx + 'px'; f.el.style.top = p.sy + 'px';
      f.el.style.opacity = String(Math.max(0, 1 - f.life / f.max));
      if (f.life >= f.max || !p.vis) { f.el.remove(); this.floats.splice(i, 1); }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]; b.life += dt;
      const w = worldOf(b.entity);
      if (!w || b.life >= b.max) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      const p = project(w.x, 2.05, w.z);
      b.el.style.left = p.sx + 'px'; b.el.style.top = p.sy + 'px';
      b.el.style.opacity = String(b.life > b.max - 0.3 ? Math.max(0, (b.max - b.life) / 0.3) : 1);
      b.el.style.display = p.vis ? 'block' : 'none';
    }
  }

  reset() { for (const f of this.floats) f.el.remove(); for (const b of this.bubbles) b.el.remove(); this.floats = []; this.bubbles = []; }
}
