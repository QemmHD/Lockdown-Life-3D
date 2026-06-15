import * as THREE from 'three';

export class CameraController {
  camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3();
  private current = new THREE.Vector3();
  private zoom = 17;          // viewport half-height in world units (smaller = more zoomed in)
  private minZoom = 10;
  private maxZoom = 40;
  private shakeAmt = 0;
  private shakeEnabled = true;
  // isometric offset direction (45deg yaw, ~35deg pitch)
  private offset = new THREE.Vector3(28, 34, 28);

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.updateProjection();
  }

  setShakeEnabled(v: boolean) { this.shakeEnabled = v; }

  resize() { this.updateProjection(); }

  private updateProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    const h = this.zoom;
    const w = h * aspect;
    this.camera.left = -w; this.camera.right = w;
    this.camera.top = h; this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  setZoom(delta: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + delta, this.minZoom, this.maxZoom);
    this.updateProjection();
  }

  snapTo(x: number, z: number) {
    this.target.set(x, 0, z);
    this.current.copy(this.target);
    this.apply();
  }

  shake(amt: number) { if (this.shakeEnabled) this.shakeAmt = Math.min(1.5, this.shakeAmt + amt); }

  update(x: number, z: number, dt: number) {
    this.target.set(x, 0, z);
    this.current.lerp(this.target, Math.min(1, dt * 4));
    this.apply();
    this.shakeAmt *= Math.max(0, 1 - dt * 5);
  }

  private apply() {
    const s = this.shakeAmt;
    const sx = (Math.random() - 0.5) * s * 2;
    const sz = (Math.random() - 0.5) * s * 2;
    this.camera.position.set(
      this.current.x + this.offset.x + sx,
      this.offset.y,
      this.current.z + this.offset.z + sz
    );
    this.camera.lookAt(this.current.x, 0, this.current.z);
  }
}
