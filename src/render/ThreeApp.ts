import * as THREE from 'three';
import { THEME } from './VisualTheme';

// Owns renderer + scene + lights. Draws only; never mutates simulation state.
export class ThreeApp {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(THEME.bg);
    this.scene.fog = new THREE.Fog(THEME.fog.color, THEME.fog.near, THEME.fog.far);

    this.scene.add(new THREE.AmbientLight(THEME.lights.ambient, THEME.lights.ambientI));

    const dir = new THREE.DirectionalLight(THEME.lights.key, THEME.lights.keyI);
    dir.position.set(26, 44, 18);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const d = 38;
    dir.shadow.camera.left = -d; dir.shadow.camera.right = d;
    dir.shadow.camera.top = d; dir.shadow.camera.bottom = -d;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 140;
    dir.shadow.bias = -0.0004;
    this.scene.add(dir);

    this.scene.add(new THREE.HemisphereLight(THEME.lights.hemiSky, THEME.lights.hemiGround, THEME.lights.hemiI));
  }

  resize() { this.renderer.setSize(window.innerWidth, window.innerHeight); }
}
