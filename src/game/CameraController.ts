import * as THREE from 'three';

export class CameraController {
  camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3();
  private current = new THREE.Vector3();
  private baseZoom = 7;        // viewport half-height in world units (smaller = more zoomed in)
  private minZoom = 5;
  private maxZoom = 34;
  private focus = 0;           // dynamic zoom-in bias (combat/tension)
  private focusTarget = 0;
  private shakeAmt = 0;
  private shakeEnabled = true;
  // isometric offset direction (45deg yaw, ~35deg pitch)
  private offset = new THREE.Vector3(20, 26, 20);

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.updateProjection();
  }

  setShakeEnabled(v: boolean) { this.shakeEnabled = v; }
  resize() { this.updateProjection(); }

  private effectiveZoom() { return THREE.MathUtils.clamp(this.baseZoom - this.focus, this.minZoom * 0.7, this.maxZoom); }

  private updateProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    const h = this.effectiveZoom();
    const w = h * aspect;
    this.camera.left = -w; this.camera.right = w;
    this.camera.top = h; this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  setZoom(delta: number) {
    this.baseZoom = THREE.MathUtils.clamp(this.baseZoom + delta, this.minZoom, this.maxZoom);
    this.updateProjection();
  }

  // Push the camera in for focused moments (0 = none, ~2 = tight)
  setFocus(amount: number) { this.focusTarget = amount; }

  snapTo(x: number, z: number) {
    this.target.set(x, 0, z);
    this.current.copy(this.target);
    this.apply();
  }

  shake(amt: number) { if (this.shakeEnabled) this.shakeAmt = Math.min(1.5, this.shakeAmt + amt); }

  // leadX/leadZ: look-ahead toward movement so the character stays the focal point
  update(x: number, z: number, dt: number, leadX = 0, leadZ = 0) {
    this.target.set(x + leadX, 0, z + leadZ);
    this.current.lerp(this.target, Math.min(1, dt * 6));
    // smooth dynamic focus zoom
    const prevFocus = this.focus;
    this.focus = THREE.MathUtils.lerp(this.focus, this.focusTarget, Math.min(1, dt * 3));
    if (Math.abs(this.focus - prevFocus) > 0.001) this.updateProjection();
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
    this.camera.lookAt(this.current.x, 0.6, this.current.z);
  }
}
