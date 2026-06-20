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
  private baseOffset = new THREE.Vector3(THEME.camera.offset.x, THEME.camera.offset.y, THEME.camera.offset.z);
  private offset = new THREE.Vector3(THEME.camera.offset.x, THEME.camera.offset.y, THEME.camera.offset.z);
  private isoAngle = 0;                 // yaw rotation of the iso overview (Q/E)
  private right = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  // follow state
  private follow: { x: number; z: number } | null = null;
  private followFacing = 0;            // player facing for character camera
  private manualTimer = 0;             // seconds of suspended auto-follow after a manual pan
  private bx = 28; private bz = 20;   // clamp bounds (set from map)
  private frameRight = THEME.camera.frameRight;
  // world half-extent (iso screen-space) needed to frame the whole prison; drives a device-aware
  // max zoom-out so the entire map can fit on any aspect (tall iPhone portrait included)
  private fitExtent = THEME.camera.max;

  // character camera: fixed 3/4 viewing direction (radians) + horizontal pullback. Only manual
  // pan rotates the direction — it never auto-rotates to face the player (that caused spinning).
  private charAngle = Math.PI / 4;
  private charDist = THEME.charCamera.distance;
  private occluder: ((wx: number, wz: number) => boolean) | null = null;   // retained for API compatibility

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
    if (this._charMode) { this.charAngle = Math.PI / 4; this.charDist = THEME.charCamera.distance; this.manualTimer = 0; }
  }

  setBounds(hx: number, hz: number) { this.bx = hx; this.bz = hz; }
  // tell the camera the map size so "fully zoomed out" frames the whole prison on any screen.
  // iso view is rotated 45°, so the world footprint projects to a diamond of half-size ~0.707*(W/2+H/2).
  setWorldSize(w: number, h: number) { this.fitExtent = 0.7071 * (w / 2 + h / 2) * 1.06; this.updateProjection(); }
  setOccluder(fn: (wx: number, wz: number) => boolean) { this.occluder = fn; }

  private computeBasis() {
    // rotate the base iso offset by isoAngle around Y so the whole overview can orbit
    const a = this.isoAngle, bx = this.baseOffset.x, bz = this.baseOffset.z;
    this.offset.set(bx * Math.cos(a) - bz * Math.sin(a), this.baseOffset.y, bx * Math.sin(a) + bz * Math.cos(a));
    this.fwd.set(-this.offset.x, 0, -this.offset.z).normalize();
    this.right.set(this.fwd.z, 0, -this.fwd.x).normalize();
  }
  // Orbit the view by a continuous angle delta (radians) — two-finger swipe (touch) + Q/E (desktop).
  rotateBy(dRad: number) {
    if (this._charMode) { this.charAngle += dRad; this.applyPersp(); }
    else { this.isoAngle += dRad; this.computeBasis(); this.apply(); }
  }
  // discrete step for keyboard (Q/E, ← →)
  rotateView(dir: number) { this.rotateBy(dir * 0.13); }

  // Stage 4.28 — additive camera shake applied AFTER tick(); self-cancels each frame so it never drifts
  // even when follow isn't re-applying the position (manual pan / no target).
  private shakeApplied = new THREE.Vector3();
  addShakeOffset(s: number, t: number) {
    this.camera.position.sub(this.shakeApplied); this.perspCam.position.sub(this.shakeApplied);
    if (s <= 0.0005) { this.shakeApplied.set(0, 0, 0); return; }
    const m = s * s * 0.45;
    this.shakeApplied.set((Math.sin(t * 91) + Math.sin(t * 57)) * m, 0, Math.cos(t * 83) * m);
    this.camera.position.add(this.shakeApplied); this.perspCam.position.add(this.shakeApplied);
  }
  private updateProjection() {
    const aspect = window.innerWidth / window.innerHeight;
    // allow zooming out far enough to fit the whole prison given this aspect (narrow portrait needs more)
    this.maxZoom = Math.max(THEME.camera.max, this.fitExtent * Math.max(1, 1 / aspect));
    this.zoom = THREE.MathUtils.clamp(this.zoom, this.minZoom, this.maxZoom);
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
    // fixed high 3/4 angle: camera sits up and to one side of the player and looks straight at them.
    // height scales with the pullback so the down-angle stays constant while zooming (no spin, clears walls).
    const dirX = Math.sin(this.charAngle), dirZ = Math.cos(this.charAngle);
    const h = this.charDist * (cfg.height / cfg.distance);
    this.perspCam.position.set(this.target.x + dirX * this.charDist, h, this.target.z + dirZ * this.charDist);
    this.perspCam.lookAt(this.target.x, cfg.lookHeight, this.target.z);
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
        // character camera: smoothly follow the player's position only — the angle stays fixed
        this.target.x = THREE.MathUtils.lerp(this.target.x, this.follow.x, Math.min(1, dt * 6));
        this.target.z = THREE.MathUtils.lerp(this.target.z, this.follow.z, Math.min(1, dt * 6));
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
    // ONLY the character-focus close-up (char mode) rotates on a one-finger swipe. The default / overview
    // camera always PANS freely (drag it anywhere). Pinch switches between the two (see zoomBy).
    if (this._charMode) {
      this.rotateBy(-screenDx * 0.005);
    } else {
      this.manualTimer = 45;                      // free roam: the camera stays where you drag it
      const scale = this.zoom / 320;
      this.target.addScaledVector(this.right, screenDx * scale);
      this.target.addScaledVector(this.fwd, screenDy * scale);
      this.clamp(); this.apply();
    }
  }
  zoomBy(factor: number) {
    if (this._charMode) {
      // pinch/scroll OUT past the close-up's max distance → drop back to the free iso overview
      if (factor > 1 && this.charDist >= THEME.charCamera.maxDistance - 0.01) { this.toggleMode(); this.manualTimer = 0; return; }
      this.charDist = THREE.MathUtils.clamp(this.charDist * factor, THEME.charCamera.minDistance, THEME.charCamera.maxDistance);
    } else {
      // pinch/scroll IN past the iso min zoom → enter the character-focus close-up (the rotatable view)
      if (factor < 1 && this.zoom <= this.minZoom + 0.01) { this.toggleMode(); this.manualTimer = 0; return; }
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
