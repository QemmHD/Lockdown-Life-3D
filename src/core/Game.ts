import * as THREE from 'three';
import { ThreeApp } from '../render/ThreeApp';
import { IsoCamera } from '../render/IsoCamera';
import { RenderSync } from '../render/RenderSync';
import { buildPrison } from '../render/WorldRenderer';
import { dressRooms } from '../render/PropRenderer';
import { Simulation } from '../sim/Simulation';
import { EventBus } from './EventBus';
import { InputManager } from './InputManager';
import { SaveManager } from './SaveManager';
import { HUD, PanelInfo } from '../ui/HUD';
import { Entity } from '../ecs/world';
import { Brain, Needs, Position, Agent } from '../ecs/components';
import { phaseAt } from '../data/content';

const FIXED = 1 / 30;
const SPEEDS = [1, 2, 4];

export class Game {
  private app: ThreeApp;
  private cam: IsoCamera;
  private bus = new EventBus();
  private input: InputManager;
  private sim: Simulation;
  private sync: RenderSync;
  private hud: HUD;
  private clock = new THREE.Clock();
  private acc = 0;
  private speedIdx = 0;
  private paused = false;
  private selected: Entity | null = null;
  private playerEntity: Entity | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new ThreeApp(canvas);
    this.cam = new IsoCamera();
    this.input = new InputManager(canvas, this.bus);
    this.input.attachTapEnd(canvas);

    this.sim = new Simulation(this.bus);
    this.sim.generate();
    buildPrison(this.app.scene, this.sim.map, this.sim.rooms);
    dressRooms(this.app.scene, this.sim.map, this.sim.rooms);
    this.sync = new RenderSync(this.app.scene, this.sim.ecs);
    // character-focused camera: clamp to the prison, follow a prisoner by default
    this.cam.setBounds(this.sim.map.width / 2 - 5, this.sim.map.height / 2 - 5);
    this.playerEntity = this.pickPlayer();
    const sp = this.playerEntity != null ? this.sim.ecs.get<Position>(this.playerEntity, 'Position') : null;
    this.cam.focus(sp ? sp.x : 0, sp ? sp.z : 0);

    this.hud = new HUD({
      onPause: () => { this.paused = !this.paused; this.hud.setSpeed(this.paused ? '❚❚' : SPEEDS[this.speedIdx] + '×'); },
      onSpeed: () => { this.speedIdx = (this.speedIdx + 1) % SPEEDS.length; this.paused = false; this.hud.setSpeed(SPEEDS[this.speedIdx] + '×'); },
      onSave: () => { SaveManager.save(this.sim.serialize()); this.hud.alert('Game saved', 'guard'); },
      onLoad: () => this.load(),
      onDeselect: () => this.select(null),
      hasSave: () => SaveManager.has()
    });

    this.bus.on('pan', ({ dx, dy }) => this.cam.pan(dx, dy));
    this.bus.on('zoom', ({ factor }) => this.cam.zoomBy(factor));
    this.bus.on('tap', ({ x, y }) => this.onTap(x, y));
    this.bus.on('alert', ({ text, type }) => this.hud.alert(text, type));
    this.bus.on('impact', ({ x, z }) => this.addImpact(x, z));

    window.addEventListener('resize', () => { this.app.resize(); this.cam.resize(); });
    this.loop();
  }

  private onTap(x: number, y: number) {
    const ray = this.cam.raycaster(x, y);
    const e = this.sync.pick(ray);
    if (e != null) this.select(e);    // tapping empty space keeps current follow target
  }
  // default "player" prisoner the camera falls back to when nothing is selected
  private pickPlayer(): Entity | null {
    for (const e of this.sim.ecs.query('Brain')) if (this.sim.ecs.get<Brain>(e, 'Brain')!.role === 'prisoner') return e;
    return null;
  }
  private followTarget(): Entity | null {
    if (this.selected != null && this.sim.ecs.has(this.selected, 'Position')) return this.selected;
    if (this.playerEntity != null && this.sim.ecs.has(this.playerEntity, 'Position')) return this.playerEntity;
    return this.playerEntity = this.pickPlayer();
  }
  private select(e: Entity | null) {
    this.selected = e;
    if (e == null) { this.hud.showPanel(null); return; }
    this.cam.recenter();              // resume smooth follow toward the newly selected inmate
    this.refreshPanel();
  }
  private refreshPanel() {
    if (this.selected == null) return;
    const b = this.sim.ecs.get<Brain>(this.selected, 'Brain');
    const n = this.sim.ecs.get<Needs>(this.selected, 'Needs');
    if (!b || !n) { this.hud.showPanel(null); return; }
    const info: PanelInfo = {
      name: b.name, role: b.role, gang: b.gang, state: b.state, traits: b.traits,
      needs: [
        { label: 'Health', value: n.health, color: '#e74c3c' },
        { label: 'Hunger', value: 1 - n.hunger, color: '#e67e22' },
        { label: 'Energy', value: n.energy, color: '#2ecc71' },
        { label: 'Hygiene', value: 1 - n.hygiene, color: '#3498db' },
        { label: 'Anger', value: n.anger, color: '#c0392b' },
        { label: 'Fear', value: n.fear, color: '#9b59b6' }
      ]
    };
    this.hud.showPanel(info);
  }

  private load() {
    const data = SaveManager.load();
    if (!data) { this.hud.alert('No save found', 'fight'); return; }
    this.sim.hydrate(data);
    this.sync.reset();
    this.sync.setEcs(this.sim.ecs);
    this.select(null);
    this.hud.alert('Game loaded', 'guard');
  }

  private fxRings: { mesh: THREE.Mesh; life: number }[] = [];
  private addImpact(x: number, z: number) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.34, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 1.0, z);
    this.app.scene.add(mesh);
    this.fxRings.push({ mesh, life: 0 });
  }
  private updateFx(dt: number) {
    for (let i = this.fxRings.length - 1; i >= 0; i--) {
      const f = this.fxRings[i]; f.life += dt;
      const s = 1 + f.life * 10; f.mesh.scale.set(s, s, s);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - f.life * 3);
      if (f.life > 0.35) { this.app.scene.remove(f.mesh); (f.mesh.material as THREE.Material).dispose(); this.fxRings.splice(i, 1); }
    }
  }

  private riotRisk(): number {
    const ps = this.sim.ecs.query('Needs', 'Brain').filter((e) => this.sim.ecs.get<Brain>(e, 'Brain')!.role === 'prisoner');
    if (!ps.length) return 0;
    let a = 0, h = 0;
    for (const e of ps) { const n = this.sim.ecs.get<Needs>(e, 'Needs')!; a += n.anger; h += n.hunger; }
    return Math.min(1, (a / ps.length) * 0.7 + (h / ps.length) * 0.4);
  }

  private loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const speed = this.paused ? 0 : SPEEDS[this.speedIdx];
    this.acc += dt * speed;
    let steps = 0;
    while (this.acc >= FIXED && steps < 8) { this.sim.step(FIXED); this.acc -= FIXED; steps++; }

    this.sync.update(dt, this.selected, t);
    this.updateFx(dt);

    // character-focused follow: track selected-or-player prisoner with a small movement lead
    const ft = this.followTarget();
    if (ft != null) {
      const w = this.sync.worldOf(ft) ?? this.sim.ecs.get<Position>(ft, 'Position');
      if (w) {
        const pos = this.sim.ecs.get<Position>(ft, 'Position');
        const moving = !!this.sim.ecs.get<Agent>(ft, 'Agent')?.path;
        const lead = moving && pos ? 2 : 0;
        this.cam.setFollow(w.x + (pos ? Math.sin(pos.facing) * lead : 0), w.z + (pos ? Math.cos(pos.facing) * lead : 0));
      }
    }
    this.cam.tick(dt);

    if (this.selected != null) this.refreshPanel();
    const riot = this.riotRisk();
    this.hud.setTop(this.sim.day, this.sim.hour, phaseAt(this.sim.hour).name, 0, riot);
    this.hud.setAlarm(riot);

    this.app.renderer.render(this.app.scene, this.cam.camera);
    requestAnimationFrame(this.loop);
  };
}
