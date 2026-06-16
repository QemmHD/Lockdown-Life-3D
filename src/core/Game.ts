import * as THREE from 'three';
import { ThreeApp } from '../render/ThreeApp';
import { IsoCamera } from '../render/IsoCamera';
import { RenderSync } from '../render/RenderSync';
import { buildPrison } from '../render/WorldRenderer';
import { Simulation } from '../sim/Simulation';
import { EventBus } from './EventBus';
import { InputManager } from './InputManager';
import { SaveManager } from './SaveManager';
import { HUD, PanelInfo } from '../ui/HUD';
import { Entity } from '../ecs/world';
import { Brain, Needs } from '../ecs/components';
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

  constructor(canvas: HTMLCanvasElement) {
    this.app = new ThreeApp(canvas);
    this.cam = new IsoCamera();
    this.input = new InputManager(canvas, this.bus);
    this.input.attachTapEnd(canvas);

    this.sim = new Simulation(this.bus);
    this.sim.generate();
    buildPrison(this.app.scene, this.sim.map, this.sim.rooms);
    this.sync = new RenderSync(this.app.scene, this.sim.ecs);
    this.cam.focus(0, 0);

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

    window.addEventListener('resize', () => { this.app.resize(); this.cam.resize(); });
    this.loop();
  }

  private onTap(x: number, y: number) {
    const ray = this.cam.raycaster(x, y);
    const e = this.sync.pick(ray);
    this.select(e);
  }
  private select(e: Entity | null) {
    this.selected = e;
    if (e == null) this.hud.showPanel(null); else this.refreshPanel();
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
    if (this.selected != null) this.refreshPanel();
    this.hud.setTop(this.sim.day, this.sim.hour, phaseAt(this.sim.hour).name, 0, this.riotRisk());

    this.app.renderer.render(this.app.scene, this.cam.camera);
    requestAnimationFrame(this.loop);
  };
}
