import * as THREE from 'three';
import { THEME } from './VisualTheme';

// Stage 3.8A: dual-mode camera — orthographic iso (default) + toggleable perspective "character camera".
// All existing API (screenToGround, raycaster, pan, zoom, etc.) works with both modes.
export class IsoCamera {
  // Orthographic iso camera (existing default)
  camera: THREE.OrthographicCamera;
  // Perspective character camera (Stage 3.8A addition)
  private perspCam: THREE.PerspectiveCamera;
  private _charMode = false;

  private target = new THREE.Vector3(0, 0, 0);
  private zoom = THEME.camera.zoom;
  private minZoom = THEME.camera.min;
  private maxZoom = THEME.camera.max;
  private offset = new THREE.Vector3(THEME.camera.offset.x, THEME.camera.offset.y, THEME.camera.offset.z);
  private right = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  // follow state
  private follow: { x: number; z: number } | null = null;
  private followFacing = 0;            // player facing for character camera
  private manualTimer = 0;             // seconds of suspended auto-follow after a manual pan
  private bx = 28; private bz = 20;   // clamp bounds (set from map)
  private frameRight = THEME.camera.frameRight;

  // character camera orbital state (smooth)
  private charAngle = 0;
  private charHeight = THEME.charCamera.height;
  private charDist = THEME.charCamera.distance;
  // optional wall test (world x,z -> true if a tall wall blocks the camera there)
  private occluder: ((wx: number, wz: number) => boolean) | null = null;

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.perspCam = new THREE.PerspectiveCamera(THEME.charCamera.fov, window.innerWidth / window.innerHeight, 0.5, 300);
    this.computeBasis();
    this.updateProjection();
    this.apply();
  }

  /** The camera to use for rendering + raycasting — switches based on mode. */
  get activeCamera(): THREE.Camera {
    return this._charMode ? this.perspCam : this.camera;
  }
  get isCharMode() { return this._charMode; }

  toggleMode() {
    this._charMode = !this._charMode;
    if (this._charMode) {
      // entering character mode: snap behind the follow target
      this.charAngle = this.followFacing + Math.PI;
      this.manualTimer = 0;
    }
  }

  setBounds(hx: number, hz: number) { this.bx = hx; this.bz = hz; }
  setOccluder(fn: (wx: number, wz: number) => boolean) { this.occluder = fn; }

  private computeBasis() {
    this.fwd.set(-this.offset.x, 0, -this.offset.z).normalize();
    this.right.set(this.fwd.z, 0, -this.fwd.x).normalize();
  }
  private updateProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    const h = this.zoom, w = h * aspect;
    this.camera.left = -w; this.camera.right = w; this.camera.top = h; this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
    this.perspCam.aspect = aspect;
    this.perspCam.updateProjectionMatrix();
  }
  resize() { this.updateProjection(); }

  private apply() {
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }
  private applyPersp() {
    const cfg = THEME.charCamera;
    const tx = this.target.x + Math.sin(this.followFacing) * cfg.lookAhead;
    const tz = this.target.z + Math.cos(this.followFacing) * cfg.lookAhead;
    // camera orbits behind the player; pull it in if a wall sits between them so the view never
    // clips through / hides behind a corridor wall
    const dirX = -Math.sin(this.charAngle), dirZ = -Math.cos(this.charAngle);
    let dist = this.charDist;
    const minD = (cfg as any).minDistance ?? 3.5;
    if (this.occluder) {
      for (let d = 1.5; d <= dist; d += 0.5) {
        if (this.occluder(this.target.x + dirX * d, this.target.z + dirZ * d)) { dist = Math.max(minD, d - 0.7); break; }
      }
    }
    const cx = this.target.x + dirX * dist;
    const cz = this.target.z + dirZ * dist;
    const h = Math.max(minD, this.charHeight * (dist / this.charDist));   // keep the down-angle as it pulls in
    this.perspCam.position.set(cx, h, cz);
    this.perspCam.lookAt(tx, cfg.lookHeight, tz);
  }
  private clamp() {
    this.target.x = THREE.MathUtils.clamp(this.target.x, -this.bx, this.bx);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -this.bz, this.bz);
  }

  // --- follow API ---
  setFollow(x: number, z: number, facing?: number) {
    this.follow = { x, z };
    if (facing != null) this.followFacing = facing;
  }
  recenter() { this.manualTimer = 0; }
  isFollowing() { return this.follow && this.manualTimer <= 0; }

  tick(dt: number) {
    if (this.manualTimer > 0) this.manualTimer -= dt;
    if (this.follow && this.manualTimer <= 0) {
      if (this._charMode) {
        // character camera: smoothly follow player, orbit behind them
        this.target.x = THREE.MathUtils.lerp(this.target.x, this.follow.x, Math.min(1, dt * 6));
        this.target.z = THREE.MathUtils.lerp(this.target.z, this.follow.z, Math.min(1, dt * 6));
        // smoothly rotate camera behind the player's facing direction
        const desiredAngle = this.followFacing + Math.PI;
        let da = desiredAngle - this.charAngle;
        // shortest rotation
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        this.charAngle += da * Math.min(1, dt * 3);
        this.clamp();
        this.applyPersp();
      } else {
        // iso camera: existing behavior
        const dx = this.follow.x + this.right.x * this.frameRight;
        const dz = this.follow.z + this.right.z * this.frameRight;
        this.target.x = THREE.MathUtils.lerp(this.target.x, dx, Math.min(1, dt * 4.5));
        this.target.z = THREE.MathUtils.lerp(this.target.z, dz, Math.min(1, dt * 4.5));
        this.clamp();
        this.apply();
      }
    }
  }

  // manual controls
  pan(screenDx: number, screenDy: number) {
    this.manualTimer = THEME.camera.panHold;
    if (this._charMode) {
      // in character mode, pan rotates the orbital camera
      this.charAngle -= screenDx * 0.005;
      this.charHeight = THREE.MathUtils.clamp(this.charHeight + screenDy * 0.02, 2, 18);
    } else {
      const scale = this.zoom / 320;
      this.target.addScaledVector(this.right, -screenDx * scale);
      this.target.addScaledVector(this.fwd, -screenDy * scale);
      this.clamp(); this.apply();
    }
  }
  zoomBy(factor: number) {
    if (this._charMode) {
      this.charDist = THREE.MathUtils.clamp(this.charDist * factor, 4, 25);
    } else {
      this.zoom = THREE.MathUtils.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
      this.updateProjection();
    }
  }
  focus(x: number, z: number) { this.target.set(x, 0, z); this.clamp(); this.apply(); }
  zoomLevel() { return this.zoom; }

  screenToGround(px: number, py: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.activeCamera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  raycaster(px: number, py: number): THREE.Raycaster {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.activeCamera);
    return ray;
  }
}
