import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { BrightnessContrastShader } from 'three/examples/jsm/shaders/BrightnessContrastShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

// Post-processing stack: bloom on highlights, a gritty color grade, vignette,
// tone mapping (OutputPass) and SMAA anti-aliasing. Used on "High" quality.
export class PostFX {
  composer: EffectComposer;
  private bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // ground-truth ambient occlusion for grounded depth in corners/under props (best-effort)
    try {
      const gtao = new GTAOPass(scene, camera as any, window.innerWidth, window.innerHeight);
      (gtao as any).output = (GTAOPass as any).OUTPUT?.Default ?? 0;
      const p: any = (gtao as any).updateGtaoMaterial ? gtao : null;
      if (p) (gtao as any).updateGtaoMaterial({ radius: 2.2, scale: 1.0, samples: 8 });
      this.composer.addPass(gtao);
    } catch (e) { /* GTAO unsupported — skip silently */ }

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,   // strength
      0.6,   // radius
      0.86   // threshold — only bright lights/highlights bloom
    );
    this.composer.addPass(this.bloom);

    const grade = new ShaderPass(BrightnessContrastShader);
    grade.uniforms['brightness'].value = -0.06;
    grade.uniforms['contrast'].value = 0.26;
    this.composer.addPass(grade);

    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms['offset'].value = 0.95;
    vignette.uniforms['darkness'].value = 0.8;
    this.composer.addPass(vignette);

    this.composer.addPass(new OutputPass());

    const smaa = new SMAAPass(window.innerWidth, window.innerHeight);
    this.composer.addPass(smaa);

    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  render() { this.composer.render(); }
}
