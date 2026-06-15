import * as THREE from 'three';

interface FloatText { el: HTMLDivElement; pos: THREE.Vector3; vy: number; life: number; max: number; }
interface Particle { mesh: THREE.Object3D; vx: number; vy: number; vz: number; life: number; max: number; spin: number; }
interface Projectile { mesh: THREE.Mesh; sx: number; sz: number; tx: number; tz: number; t: number; dur: number; onHit: () => void; }

export class EffectsSystem {
  private floats: FloatText[] = [];
  private particles: Particle[] = [];
  private projectiles: Projectile[] = [];
  private layer: HTMLDivElement;

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    this.layer = document.createElement('div');
    this.layer.id = 'float-layer';
    document.getElementById('ui-root')!.appendChild(this.layer);
  }

  floatText(x: number, y: number, z: number, text: string, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color;
    this.layer.appendChild(el);
    this.floats.push({ el, pos: new THREE.Vector3(x, y, z), vy: 1.4, life: 0, max: 1.3 });
  }

  damageNumber(x: number, z: number, dmg: number, crit = false) {
    this.floatText(x, 1.8, z, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffdd33' : '#ff5544');
  }

  crowd(x: number, z: number) {
    const lines = ['OHHH!', 'FIGHT!', 'GET HIM!', 'WORLDSTAR!', 'DAMN!', 'SCRAP!'];
    this.floatText(x + (Math.random() - 0.5) * 4, 2.4, z + (Math.random() - 0.5) * 4, lines[Math.floor(Math.random() * lines.length)], '#ffcc66');
  }

  private burst(x: number, y: number, z: number, color: number, count: number, speed: number, size: number, gravity = true) {
    const geo = new THREE.SphereGeometry(size, 5, 4);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(x, y, z);
      this.scene.add(m);
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random());
      this.particles.push({
        mesh: m,
        vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp,
        vy: (gravity ? 2 + Math.random() * 2 : (Math.random() - 0.5) * sp),
        life: 0, max: 0.5 + Math.random() * 0.4, spin: 0
      });
    }
  }

  impact(x: number, z: number) {
    this.burst(x, 1.2, z, 0xffffff, 6, 4, 0.08);
    // impact ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.35, 18),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    this.scene.add(ring);
    this.particles.push({ mesh: ring, vx: 0, vy: 0, vz: 0, life: 0, max: 0.4, spin: 0 });
  }

  dust(x: number, z: number) { this.burst(x, 0.2, z, 0x9a8a6a, 5, 2, 0.1); }
  sweat(x: number, z: number) { this.burst(x, 1.5, z, 0x88bbff, 3, 1.5, 0.06); }

  // a thrown object that arcs to a target then fires its callback
  projectile(x0: number, z0: number, x1: number, z1: number, onHit: () => void) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xb9b9b9 }));
    m.position.set(x0, 1.2, z0);
    this.scene.add(m);
    const dur = Math.max(0.18, Math.hypot(x1 - x0, z1 - z0) / 22);
    this.projectiles.push({ mesh: m, sx: x0, sz: z0, tx: x1, tz: z1, t: 0, dur, onHit });
  }

  update(dt: number) {
    // floating text
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dt;
      f.pos.y += f.vy * dt;
      f.vy *= 0.96;
      const p = f.pos.clone().project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
      f.el.style.left = sx + 'px';
      f.el.style.top = sy + 'px';
      f.el.style.opacity = String(Math.max(0, 1 - f.life / f.max));
      if (f.life >= f.max || p.z > 1) { f.el.remove(); this.floats.splice(i, 1); }
    }
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const m = p.mesh as THREE.Mesh;
      if (m.geometry instanceof THREE.RingGeometry) {
        const s = 1 + p.life * 8;
        m.scale.setScalar(s);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p.life / p.max);
      } else {
        m.position.x += p.vx * dt;
        m.position.z += p.vz * dt;
        m.position.y += p.vy * dt;
        p.vy -= 9 * dt;
        if (m.position.y < 0.05) { m.position.y = 0.05; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; }
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p.life / p.max);
      }
      if (p.life >= p.max) {
        this.scene.remove(m);
        (m.material as THREE.Material).dispose?.();
        this.particles.splice(i, 1);
      }
    }
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      const f = Math.min(1, pr.t / pr.dur);
      pr.mesh.position.x = THREE.MathUtils.lerp(pr.sx, pr.tx, f);
      pr.mesh.position.z = THREE.MathUtils.lerp(pr.sz, pr.tz, f);
      pr.mesh.position.y = 1.2 + Math.sin(f * Math.PI) * 1.3;
      pr.mesh.rotation.x += dt * 12; pr.mesh.rotation.y += dt * 9;
      if (f >= 1) {
        this.scene.remove(pr.mesh);
        (pr.mesh.material as THREE.Material).dispose?.();
        this.projectiles.splice(i, 1);
        pr.onHit();
      }
    }
  }
}
