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
import { HUD, PanelInfo, PanelAction } from '../ui/HUD';
import { Entity } from '../ecs/world';
import { Brain, Needs, Position, Agent, Social, Inventory } from '../ecs/components';
import { phaseAt, GANG_MAP } from '../data/content';
import { ITEMS, isContraband } from '../data/items';
import { JOB_BY_ROOM } from '../data/jobs';
import { InteractAction } from '../sim/Simulation';

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
  private playerEntity: Entity = 0;

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
    // character-focused camera: clamp to the prison, follow the player prisoner
    this.cam.setBounds(this.sim.map.width / 2 - 5, this.sim.map.height / 2 - 5);
    this.playerEntity = this.sim.player();
    const sp = this.sim.ecs.get<Position>(this.playerEntity, 'Position');
    this.cam.focus(sp ? sp.x : 0, sp ? sp.z : 0);

    this.hud = new HUD({
      onPause: () => { this.paused = !this.paused; this.hud.setSpeed(this.paused ? '❚❚' : SPEEDS[this.speedIdx] + '×'); },
      onSpeed: () => { this.speedIdx = (this.speedIdx + 1) % SPEEDS.length; this.paused = false; this.hud.setSpeed(SPEEDS[this.speedIdx] + '×'); },
      onSave: () => { SaveManager.save(this.sim.serialize()); this.hud.alert('Game saved', 'guard'); },
      onLoad: () => this.load(),
      onDeselect: () => this.select(this.playerEntity),
      hasSave: () => SaveManager.has(),
      onAction: (key) => this.doAction(key),
      onItem: (key) => { const r = this.sim.dropItem(key); if (r) this.hud.alert(r, 'trade'); this.refreshPanel(); }
    });
    this.select(this.playerEntity);   // panel shows the player by default

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
    if (e != null) { this.select(e); return; }
    // empty floor → walk the player there + drop a destination marker
    const g = this.cam.screenToGround(x, y);
    if (g) { const dest = this.sim.playerMoveTo(g.x, g.z); if (dest) this.setMarker(dest.x, dest.z); }
  }
  // camera always follows the player prisoner; selection only changes the inspected panel
  private followTarget(): Entity { return this.playerEntity; }
  private select(e: Entity | null) {
    this.selected = e ?? this.playerEntity;
    this.refreshPanel();
  }
  private hex(n: number) { return '#' + (n >>> 0).toString(16).padStart(6, '0'); }
  private refreshPanel() {
    const e = this.selected ?? this.playerEntity;
    const b = this.sim.ecs.get<Brain>(e, 'Brain');
    const n = this.sim.ecs.get<Needs>(e, 'Needs');
    const s = this.sim.ecs.get<Social>(e, 'Social');
    const inv = this.sim.ecs.get<Inventory>(e, 'Inventory');
    if (!b || !n || !s) { this.hud.showPanel(null); return; }
    const isPlayer = !!b.isPlayer;
    const gang = b.gang ? GANG_MAP[b.gang] : undefined;
    const meta = isPlayer
      ? [`Rep ${Math.round(s.reputation)}`, `Respect ${Math.round(s.respect)}`, `Suspicion ${Math.round(s.suspicion)}`, `$${inv?.money ?? 0}`]
      : [`Respect ${Math.round(s.respect)}`, `Toward you: ${this.relWord(s.rel)}`];
    const items = (inv?.items ?? []).map((id) => ({ icon: ITEMS[id]?.icon ?? '▪', name: ITEMS[id]?.name ?? id, contraband: isContraband(id), key: id }));
    const actions: PanelAction[] = isPlayer ? this.playerActions(e) : this.npcActions(e, b.role);
    const info: PanelInfo = {
      name: b.name, role: isPlayer ? 'Player' : b.role, player: isPlayer,
      gang: gang?.name, gangColor: gang ? this.hex(gang.color) : undefined,
      state: b.action ?? b.state, room: this.sim.currentRoomName(e), traits: b.traits, meta,
      needs: [
        { label: 'Health', value: n.health, color: '#e74c3c' },
        { label: 'Energy', value: n.energy, color: '#2ecc71' },
        { label: 'Hunger', value: 1 - n.hunger, color: '#e67e22' },
        { label: 'Hygiene', value: 1 - n.hygiene, color: '#3498db' },
        { label: 'Anger', value: n.anger, color: '#c0392b' },
        { label: 'Fear', value: n.fear, color: '#9b59b6' }
      ],
      items, actions
    };
    this.hud.showPanel(info);
  }
  private relWord(v: number) { return v <= -50 ? 'enemy' : v <= -15 ? 'disliked' : v < 15 ? 'neutral' : v < 50 ? 'friendly' : 'ally'; }
  private playerActions(e: Entity): PanelAction[] {
    const room = this.sim.roomTypeAt(this.sim.ecs.get<Position>(e, 'Position')!);
    const a: PanelAction[] = [];
    if (room === 'cellblock') a.push({ key: 'rest', label: 'Rest' });
    if (room === 'shower') a.push({ key: 'wash', label: 'Wash' });
    if (room === 'cafeteria') a.push({ key: 'eat', label: 'Eat' });
    if (room === 'yard') a.push({ key: 'train', label: 'Train' });
    if (JOB_BY_ROOM[room]) a.push({ key: 'work', label: JOB_BY_ROOM[room].verb });
    return a;
  }
  private npcActions(_e: Entity, role: string): PanelAction[] {
    if (role === 'guard') return [{ key: 'talk', label: 'Talk' }, { key: 'comply', label: 'Comply' }, { key: 'argue', label: 'Argue' }];
    return [{ key: 'talk', label: 'Talk' }, { key: 'trade', label: 'Trade' }, { key: 'favor', label: 'Favor' },
      { key: 'insult', label: 'Insult' }, { key: 'threaten', label: 'Threaten' }, { key: 'fight', label: 'Fight', danger: true }, { key: 'backoff', label: 'Back Off' }];
  }
  private doAction(key: string) {
    const sel = this.selected ?? this.playerEntity;
    const selfKeys = ['rest', 'wash', 'eat', 'train', 'work'];
    let result: string;
    if (selfKeys.includes(key)) result = this.sim.selfAction(key as InteractAction);
    else result = this.sim.interact(sel, key as InteractAction);
    if (result) this.hud.alert(result, key === 'fight' ? 'fight' : 'info');
    this.refreshPanel();
  }

  private load() {
    const data = SaveManager.load();
    if (!data) { this.hud.alert('No save found', 'fight'); return; }
    this.sim.hydrate(data);
    this.sync.reset();
    this.sync.setEcs(this.sim.ecs);
    this.playerEntity = this.sim.player();
    this.select(this.playerEntity);
    this.hud.alert('Game loaded', 'guard');
  }

  private marker: THREE.Mesh | null = null;
  private markerLife = 0;
  private setMarker(x: number, z: number) {
    if (!this.marker) {
      this.marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      this.marker.rotation.x = -Math.PI / 2; this.app.scene.add(this.marker);
    }
    this.marker.position.set(x, 0.06, z); this.marker.visible = true; this.markerLife = 1.5;
  }
  private updateMarker(dt: number) {
    if (!this.marker || !this.marker.visible) return;
    this.markerLife -= dt;
    const s = 1 + Math.sin(this.clock.elapsedTime * 6) * 0.12; this.marker.scale.set(s, s, s);
    if (this.markerLife <= 0) this.marker.visible = false;
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
    this.updateMarker(dt);

    // character-focused follow: always track the player prisoner with a small movement lead
    const ft = this.followTarget();
    const w = this.sync.worldOf(ft) ?? this.sim.ecs.get<Position>(ft, 'Position');
    if (w) {
      const pos = this.sim.ecs.get<Position>(ft, 'Position');
      const moving = !!this.sim.ecs.get<Agent>(ft, 'Agent')?.path;
      const lead = moving && pos ? 2 : 0;
      this.cam.setFollow(w.x + (pos ? Math.sin(pos.facing) * lead : 0), w.z + (pos ? Math.cos(pos.facing) * lead : 0));
    }
    this.cam.tick(dt);

    this.refreshPanel();
    const riot = this.riotRisk();
    this.hud.setTop(this.sim.day, this.sim.hour, phaseAt(this.sim.hour).name, 0, riot);
    this.hud.setAlarm(riot);

    this.app.renderer.render(this.app.scene, this.cam.camera);
    requestAnimationFrame(this.loop);
  };
}
