import * as THREE from 'three';
import { THEME } from './VisualTheme';

// Orthographic isometric camera with mobile pan/zoom. Fixed yaw so depth sorting stays stable.
export class IsoCamera {
  camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3(0, 0, 0);
  private zoom = THEME.camera.zoom;
  private minZoom = THEME.camera.min;
  private maxZoom = THEME.camera.max;
  private offset = new THREE.Vector3(THEME.camera.offset.x, THEME.camera.offset.y, THEME.camera.offset.z);
  // ground-plane basis for screen-aligned panning
  private right = new THREE.Vector3();
  private fwd = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.computeBasis();
    this.updateProjection();
    this.apply();
  }

  private computeBasis() {
    // forward = projection of view direction onto ground
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

  pan(screenDx: number, screenDy: number) {
    const scale = this.zoom / 320;
    this.target.addScaledVector(this.right, -screenDx * scale);
    this.target.addScaledVector(this.fwd, -screenDy * scale);
    this.clamp();
    this.apply();
  }
  zoomBy(factor: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.updateProjection();
  }
  focus(x: number, z: number) { this.target.set(x, 0, z); this.clamp(); this.apply(); }
  private clamp() { this.target.x = THREE.MathUtils.clamp(this.target.x, -40, 40); this.target.z = THREE.MathUtils.clamp(this.target.z, -32, 32); }

  // screen px -> world point on ground plane (y=0)
  screenToGround(px: number, py: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  raycaster(px: number, py: number): THREE.Raycaster {
    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }
}
