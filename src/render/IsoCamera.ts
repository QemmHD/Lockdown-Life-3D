import * as THREE from 'three';
import { THEME } from './VisualTheme';

// Orthographic isometric camera with a smooth character-follow + manual pan/zoom.
// Fixed yaw so depth sorting stays stable.
export class IsoCamera {
  camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3(0, 0, 0);
  private zoom = THEME.camera.zoom;
  private minZoom = THEME.camera.min;
  private maxZoom = THEME.camera.max;
  private offset = new THREE.Vector3(THEME.camera.offset.x, THEME.camera.offset.y, THEME.camera.offset.z);
  private right = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  // follow state
  private follow: { x: number; z: number } | null = null;
  private manualTimer = 0;                 // seconds of suspended auto-follow after a manual pan
  private bx = 28; private bz = 20;        // clamp bounds (set from map)
  private frameRight = THEME.camera.frameRight; // push subject left of centre (clear of the panel)

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.computeBasis();
    this.updateProjection();
    this.apply();
  }

  setBounds(hx: number, hz: number) { this.bx = hx; this.bz = hz; }

  private computeBasis() {
    this.fwd.set(-this.offset.x, 0, -this.offset.z).normalize();
    this.right.set(this.fwd.z, 0, -this.fwd.x).normalize();
  }
  private updateProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    const h = this.zoom, w = h * aspect;
    this.camera.left = -w; this.camera.right = w; this.camera.top = h; this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }
  resize() { this.updateProjection(); }

  private apply() {
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }
  private clamp() {
    this.target.x = THREE.MathUtils.clamp(this.target.x, -this.bx, this.bx);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -this.bz, this.bz);
  }

  // --- follow API ---
  setFollow(x: number, z: number) { this.follow = { x, z }; }
  recenter() { this.manualTimer = 0; }          // resume follow immediately (on selection)
  isFollowing() { return this.follow && this.manualTimer <= 0; }

  // called every frame; smoothly tracks the follow point unless the user is panning manually
  tick(dt: number) {
    if (this.manualTimer > 0) this.manualTimer -= dt;
    if (this.follow && this.manualTimer <= 0) {
      // frame the subject slightly left of centre so the right-side panel doesn't cover them
      const dx = this.follow.x + this.right.x * this.frameRight;
      const dz = this.follow.z + this.right.z * this.frameRight;
      this.target.x = THREE.MathUtils.lerp(this.target.x, dx, Math.min(1, dt * 4.5));
      this.target.z = THREE.MathUtils.lerp(this.target.z, dz, Math.min(1, dt * 4.5));
      this.clamp();
      this.apply();
    }
  }

  // manual controls
  pan(screenDx: number, screenDy: number) {
    this.manualTimer = THEME.camera.panHold;   // suspend auto-follow briefly
    const scale = this.zoom / 320;
    this.target.addScaledVector(this.right, -screenDx * scale);
    this.target.addScaledVector(this.fwd, -screenDy * scale);
    this.clamp(); this.apply();
  }
  zoomBy(factor: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.updateProjection();
  }
  focus(x: number, z: number) { this.target.set(x, 0, z); this.clamp(); this.apply(); }
  zoomLevel() { return this.zoom; }

  screenToGround(px: number, py: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  raycaster(px: number, py: number): THREE.Raycaster {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    return ray;
  }
}
