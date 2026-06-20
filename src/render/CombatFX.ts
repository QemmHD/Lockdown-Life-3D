import * as THREE from 'three';

// Read-only combat juice: a capped, recycled particle pool for blood + spark bursts on hits.
// Driven by EventBus 'impact' (spark) and 'blood' (blood). Never touches the simulation.
export class CombatFX {
  private pts: THREE.Points;
  private pos: Float32Array;   // live render colors (faded)
  private col: Float32Array;
  private base: Float32Array;  // seeded base colors (for fade math)
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private head = 0;
  private readonly CAP = 160;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.CAP * 3);
    this.col = new Float32Array(this.CAP * 3);
    this.base = new Float32Array(this.CAP * 3);
    this.vel = new Float32Array(this.CAP * 3);
    this.life = new Float32Array(this.CAP);
    this.max = new Float32Array(this.CAP);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95 });
    this.pts = new THREE.Points(g, mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 5;
    scene.add(this.pts);
  }

  private burst(x: number, z: number, count: number, r: number, gr: number, b: number, spread: number, up: number, y = 1.15) {
    for (let i = 0; i < count; i++) {
      const j = this.head++ % this.CAP;
      const k = j * 3;
      this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * spread;
      this.vel[k] = Math.cos(a) * sp;
      this.vel[k + 1] = up * (0.5 + Math.random());
      this.vel[k + 2] = Math.sin(a) * sp;
      const v = 0.85 + Math.random() * 0.15;
      this.base[k] = r * v; this.base[k + 1] = gr * v; this.base[k + 2] = b * v;
      this.col[k] = this.base[k]; this.col[k + 1] = this.base[k + 1]; this.col[k + 2] = this.base[k + 2];
      this.life[j] = 0.45 + Math.random() * 0.35;
      this.max[j] = this.life[j];
    }
  }

  spark(x: number, z: number) { this.burst(x, z, 7, 1.0, 0.92, 0.55, 2.6, 2.4); }   // bright contact spark
  blood(x: number, z: number) { this.burst(x, z, 11, 0.62, 0.06, 0.05, 2.0, 1.8); } // dark red splatter

  update(dt: number) {
    let any = false;
    for (let j = 0; j < this.CAP; j++) {
      if (this.life[j] <= 0) continue;
      any = true;
      const k = j * 3;
      this.life[j] -= dt;
      this.vel[k + 1] -= 7.5 * dt;            // gravity
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.04 || this.life[j] <= 0) {
        this.life[j] = 0; this.col[k] = this.col[k + 1] = this.col[k + 2] = 0;
      } else {
        const f = this.life[j] / this.max[j];   // 1 -> 0 fade
        this.col[k] = this.base[k] * f; this.col[k + 1] = this.base[k + 1] * f; this.col[k + 2] = this.base[k + 2] * f;
      }
    }
    if (any) {
      (this.pts.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.pts.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  reset() {
    this.life.fill(0);
    this.col.fill(0);
    this.head = 0;
    (this.pts.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
