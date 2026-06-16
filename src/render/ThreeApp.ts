import * as THREE from 'three';

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
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x0a0c10);
    this.scene.fog = new THREE.Fog(0x0a0c10, 60, 130);

    const amb = new THREE.AmbientLight(0x9aa3b8, 0.95);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xfff0d8, 1.1);
    dir.position.set(30, 50, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const d = 40;
    dir.shadow.camera.left = -d; dir.shadow.camera.right = d;
    dir.shadow.camera.top = d; dir.shadow.camera.bottom = -d;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 150;
    dir.shadow.bias = -0.0004;
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x33342c, 0.4));
  }

  resize() { this.renderer.setSize(window.innerWidth, window.innerHeight); }
}
