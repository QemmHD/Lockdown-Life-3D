import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Read-only post-processing: a cheap filmic grade — contrast, gentle desat-to-warm, vignette, and a
// whisper of grain. No depth passes (keeps it fast + headless/swiftshader-safe). Never touches the sim.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.55 },
    uContrast: { value: 1.03 },
    uSaturation: { value: 1.08 },
    uTint: { value: new THREE.Color(0xfff1d8) },
    uGrain: { value: 0.03 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uVignette, uContrast, uSaturation, uGrain, uTime;
    uniform vec3 uTint;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      col = (col - 0.5) * uContrast + 0.5;                       // contrast around mid-grey
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSaturation);                      // saturation
      col *= mix(vec3(1.0), uTint, 0.12);                        // subtle warm institutional tint
      col *= 1.06;                                               // overall lift so the grade doesn't read dark
      vec2 d = vUv - 0.5;
      col *= clamp(1.0 - dot(d, d) * uVignette, 0.74, 1.0);      // gentler vignette (edges no longer crushed)
      col += (rand(vUv + fract(uTime)) - 0.5) * uGrain;          // film grain
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export class PostFX {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private grade: ShaderPass;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.grade = new ShaderPass(GradeShader as any);
    this.composer.addPass(this.grade);
  }

  setCamera(cam: THREE.Camera) { this.renderPass.camera = cam; }
  setSize(w: number, h: number) { this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); this.composer.setSize(w, h); }
  render(time: number) { (this.grade.uniforms as any).uTime.value = time; this.composer.render(); }
}
