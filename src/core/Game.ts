import * as THREE from 'three';
import { ThreeApp } from '../render/ThreeApp';
import { IsoCamera } from '../render/IsoCamera';
import { RenderSync } from '../render/RenderSync';
import { Feedback } from '../render/Feedback';
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
  private feedback!: Feedback;
  private hud: HUD;
  private clock = new THREE.Clock();
  private acc = 0;
  private speedIdx = 0;
  private paused = false;
  private selected: Entity | null = null;
  private playerEntity: Entity = 0;
  private selectedObj: string | null = null;
  private objHits: THREE.Object3D[] = [];
  private objHighlight!: THREE.Mesh;
  private panelDirty = true;     // request an immediate panel refresh
  private panelTimer = 0;        // throttle background refreshes to ~6.7/s (not every frame)

  constructor(canvas: HTMLCanvasElement) {
    this.app = new ThreeApp(canvas);
    this.cam = new IsoCamera();
    this.input = new InputManager(canvas, this.bus);
    this.input.attachTapEnd(canvas);

    this.sim = new Simulation(this.bus);
    this.sim.generate();
    buildPrison(this.app.scene, this.sim.map, this.sim.rooms);
    const dressed = dressRooms(this.app.scene, this.sim.map, this.sim.rooms);
    const doors = this.buildDoorObjects();        // register doors/gates as interactables
    this.objHits = [...dressed.hitMeshes, ...doors.hitMeshes];
    this.sim.setInteractables([...dressed.interactables, ...doors.defs]);
    // selection highlight ring under the picked object
    this.objHighlight = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.objHighlight.rotation.x = -Math.PI / 2; this.objHighlight.position.y = 0.07; this.objHighlight.visible = false; this.app.scene.add(this.objHighlight);
    this.sync = new RenderSync(this.app.scene, this.sim.ecs);
    this.feedback = new Feedback();
    // character-focused camera: clamp to the prison, follow the player prisoner
    this.cam.setBounds(this.sim.map.width / 2 - 5, this.sim.map.height / 2 - 5);
    this.playerEntity = this.sim.player();
    const sp = this.sim.ecs.get<Position>(this.playerEntity, 'Position');
    this.cam.focus(sp ? sp.x : 0, sp ? sp.z : 0);

    this.hud = new HUD({
      onPause: () => { this.paused = !this.paused; this.hud.setSpeed(this.paused ? '❚❚' : SPEEDS[this.speedIdx] + '×'); },
      onSpeed: () => { this.speedIdx = (this.speedIdx + 1) % SPEEDS.length; this.paused = false; this.hud.setSpeed(SPEEDS[this.speedIdx] + '×'); },
      onSave: () => { const ok = SaveManager.save(this.sim.serialize()); this.hud.alert(ok ? 'Game saved' : 'Save failed (storage unavailable)', ok ? 'guard' : 'fight'); },
      onLoad: () => this.load(),
      onDeselect: () => this.select(this.playerEntity),
      hasSave: () => SaveManager.has(),
      onAction: (key) => this.doAction(key),
      onItem: (key) => { const r = this.sim.dropItem(key); if (r) this.hud.alert(r, 'trade'); this.panelDirty = true; this.refreshPanel(); }
    });
    this.select(this.playerEntity);   // panel shows the player by default

    this.bus.on('pan', ({ dx, dy }) => this.cam.pan(dx, dy));
    this.bus.on('zoom', ({ factor }) => this.cam.zoomBy(factor));
    this.bus.on('tap', ({ x, y }) => this.onTap(x, y));
    this.bus.on('alert', ({ text, type }) => this.hud.alert(text, type));
    this.bus.on('impact', ({ x, z }) => this.addImpact(x, z));
    this.bus.on('float', ({ x, z, text, color }) => this.feedback.float(x, z, text, color));
    this.bus.on('bubble', ({ e, text, kind, dur }) => this.feedback.bubble(e, text, kind, dur));
    this.bus.on('actionResult', ({ text }) => this.hud.alert(text, 'info'));

    window.addEventListener('resize', () => { this.app.resize(); this.cam.resize(); });
    // debug hook (only with ?debug): inspect sim/door state + run an invariant self-test
    if (/[?&]debug/.test(location.search)) { (window as any).__game = this; console.info('[selfTest]', this.sim.selfTest()); }
    this.loop();
  }

  private doorVisuals: { id: string; pivot: THREE.Object3D; baseRot: number; lampMat: THREE.MeshStandardMaterial }[] = [];
  private static RESTRICTED_ROOMS = ['guardroom', 'intake', 'storage', 'solitary'];

  // register each room's door/gate as an interactable object (hitbox + visible, stateful leaf)
  private buildDoorObjects(): { defs: any[]; hitMeshes: THREE.Object3D[] } {
    const defs: any[] = []; const hitMeshes: THREE.Object3D[] = [];
    const map = this.sim.map;
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hitGeo = new THREE.BoxGeometry(1.4, 2.4, 1.4);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.7, metalness: 0.4 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.6 });
    for (const r of this.sim.rooms) {
      if (r.door == null) continue;
      const t = map.tileXY(r.door); const w = map.toWorld(t.x, t.y);
      const restricted = Game.RESTRICTED_ROOMS.includes(r.type);
      // wall orientation: a door in a horizontal wall has walkable tiles above/below
      const vertWall = map.isWalkable(t.x, t.y - 1) && map.isWalkable(t.x, t.y + 1);  // movement runs N-S → leaf spans X
      const baseRot = vertWall ? 0 : Math.PI / 2;
      // interaction point = an adjacent walkable, non-door tile (stand beside, not on, the door)
      let ix = w.x, iz = w.z;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = t.x + dx, ny = t.y + dy;
        if (map.isWalkable(nx, ny) && map.idx(nx, ny) !== r.door) { const nw = map.toWorld(nx, ny); ix = nw.x; iz = nw.z; break; }
      }
      const id = 'door_' + r.id;
      const isGate = !!r.gate;
      defs.push({ id, type: isGate ? 'gate' : 'door', name: r.name + (isGate ? ' Gate' : ' Door'), room: r.id, x: w.x, z: w.z, ix, iz, facing: Math.atan2(w.x - ix, w.z - iz), restricted });

      // visible door/gate (the ONLY door geometry — WorldRenderer draws signs/stripes only):
      // static frame posts + lintel + a swinging barred leaf hinged at the left post + a state lamp
      const halfW = isGate ? 1.05 : 0.55, leafW = isGate ? 1.95 : 1.05, nbars = isGate ? 8 : 4;
      const grp = new THREE.Group(); grp.position.set(w.x, 0, w.z); grp.rotation.y = baseRot;
      grp.add(this.makeBox(0.16, 2.4, 0.18, frameMat, -halfW, 1.2, 0));
      grp.add(this.makeBox(0.16, 2.4, 0.18, frameMat, halfW, 1.2, 0));
      grp.add(this.makeBox(halfW * 2 + 0.2, 0.18, 0.2, frameMat, 0, 2.25, 0));   // lintel
      const pivot = new THREE.Group(); pivot.position.set(-halfW + 0.05, 0, 0);  // hinge at left post
      const gap = leafW / nbars;
      for (let i = 0; i < nbars; i++) pivot.add(this.makeCyl(0.045, 1.9, barMat, 0.1 + i * gap, 0.95, 0));
      pivot.add(this.makeBox(leafW, 0.1, 0.1, barMat, leafW / 2, 1.85, 0));
      pivot.add(this.makeBox(leafW, 0.1, 0.1, barMat, leafW / 2, 0.25, 0));
      grp.add(pivot);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0x33ff66, emissiveIntensity: 1.2 });
      grp.add(this.makeBox(0.2, 0.2, 0.2, lampMat, 0, 2.5, 0));
      this.app.scene.add(grp);
      this.doorVisuals.push({ id, pivot, baseRot, lampMat });

      const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.set(w.x, 1.2, w.z); hb.userData.objId = id; this.app.scene.add(hb); hitMeshes.push(hb);
    }
    return { defs, hitMeshes };
  }
  private makeBox(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
  private makeCyl(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), mat); m.position.set(x, y, z); m.castShadow = true; return m; }

  // reflect each door/gate's open/locked/restricted state into its mesh (read-only view of sim)
  private updateDoors(dt: number) {
    const chaos = this.sim.alarm.active || this.sim.lockdown.active || this.sim.riotLevel === 'event';
    const flash = chaos ? 0.5 + Math.abs(Math.sin(this.clock.elapsedTime * 6)) * 1.2 : 1.2;
    for (const d of this.doorVisuals) {
      const o = this.sim.getObj(d.id); if (!o) continue;
      const target = o.open ? Math.PI * 0.46 : 0;                   // swing the leaf open/closed
      d.pivot.rotation.y += (target - d.pivot.rotation.y) * Math.min(1, dt * 8);
      const col = o.restricted ? 0xff3322 : o.locked ? 0xffaa22 : o.open ? 0x33ff66 : 0xccbb44;
      d.lampMat.emissive.setHex(col); d.lampMat.color.setHex(col & 0x222222);
      d.lampMat.emissiveIntensity = (chaos && (o.locked || o.restricted)) ? flash : 1.2;
    }
  }

  private onTap(x: number, y: number) {
    const ray = this.cam.raycaster(x, y);
    const e = this.sync.pick(ray);
    if (e != null) { this.select(e); return; }
    const objId = this.pickObject(ray);
    if (objId) { this.selectObject(objId); return; }
    // empty floor → walk the player there + drop a destination marker
    const g = this.cam.screenToGround(x, y);
    if (g) { const dest = this.sim.playerMoveTo(g.x, g.z); if (dest) this.setMarker(dest.x, dest.z); else if (g) this.setInvalidMarker(g.x, g.z); }
  }
  private pickObject(ray: THREE.Raycaster): string | null {
    const hits = ray.intersectObjects(this.objHits, false);
    for (const h of hits) { const id = h.object.userData.objId; if (id) return id as string; }
    return null;
  }
  private selectObject(id: string) {
    this.selectedObj = id; this.selected = null;
    const o = this.sim.getObj(id);
    if (o) {
      this.objHighlight.position.set(o.x, 0.07, o.z); this.objHighlight.visible = true;
      if (/[?&]debug/.test(location.search)) console.debug('[obj]', o.id, o.type, { room: o.room, open: o.open, locked: o.locked, restricted: o.restricted, reservedBy: o.reservedBy, stash: o.stash.length });
    }
    this.panelDirty = true; this.refreshObjectPanel();
  }
  // camera always follows the player prisoner; selection only changes the inspected panel
  private followTarget(): Entity { return this.playerEntity; }
  private select(e: Entity | null) {
    this.selected = e ?? this.playerEntity;
    this.selectedObj = null; this.objHighlight.visible = false;
    this.panelDirty = true; this.refreshPanel();
  }
  private refreshObjectPanel() {
    const id = this.selectedObj; if (!id) return;
    const o = this.sim.getObj(id); if (!o) { this.selectedObj = null; this.objHighlight.visible = false; return; }
    const room = this.sim.rooms.find((r) => r.id === o.room);
    const isDoor = o.type === 'door' || o.type === 'gate';
    const meta: string[] = [];
    if (o.restricted) meta.push('Staff Only');
    else if (isDoor && o.locked) meta.push(this.sim.lockdown.active ? 'Lockdown' : 'Locked Down');
    if (isDoor) meta.push(o.open ? 'Open' : 'Closed');
    if (o.stash.length) meta.push(`Hidden: ${o.stash.length}`);
    if (o.room) { const t = this.sim.tensionAt(o.room); if (t.value >= 25) meta.push(`Area: ${t.label}`); }
    const actions: PanelAction[] = this.sim.objActions(id).map((a) => ({
      key: a.key, label: a.label, disabled: a.disabled, reason: a.reason,
      kind: (a.key === 'search' || a.key === 'hide' || a.key === 'take') ? 'risky' : 'object',
      danger: false
    }));
    this.hud.showPanel({
      name: o.name, role: 'Object', player: false, object: true,
      gang: undefined, gangColor: undefined, state: isDoor ? (o.restricted ? 'staff only' : o.locked ? 'locked' : o.open ? 'open' : 'closed') : 'idle',
      room: room?.name ?? '', traits: [], meta, needs: [], items: [], actions
    });
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
  // Convenience needs actions. Each routes to the NEAREST REACHABLE matching interactable object
  // (see Simulation.requestNearestObjectAction) — not a room-only stat change. If nothing is
  // reachable the sim returns a clear reason ("Find a bed.", "No reachable shower.", …).
  private playerActions(_e: Entity): PanelAction[] {
    const a: PanelAction[] = [];
    const chaos = this.sim.playerChaosActions();
    // during a lockdown the needs stations are out of reach — lead with the chaos actions only
    if (!this.sim.lockdown.active) {
      a.push({ key: 'rest', label: 'Rest', kind: 'object' }, { key: 'wash', label: 'Wash', kind: 'object' },
        { key: 'eat', label: 'Eat', kind: 'object' }, { key: 'train', label: 'Train', kind: 'object' }, { key: 'work', label: 'Work', kind: 'object' });
    }
    // chaos context actions (Comply / Return to Cell / Hide / Calm Down / Help Guard / Attempt Escape)
    for (const c of chaos) a.push({ key: c.key, label: c.label, kind: c.key === 'escape' ? 'risky' : 'guard', disabled: c.disabled, reason: c.reason, danger: c.key === 'escape' });
    return a;
  }
  private npcActions(e: Entity, role: string): PanelAction[] {
    if (role === 'guard') return [{ key: 'talk', label: 'Talk', kind: 'social' }, { key: 'comply', label: 'Comply', kind: 'guard' }, { key: 'argue', label: 'Argue', kind: 'risky' }];
    const tinv = this.sim.ecs.get<Inventory>(e, 'Inventory');
    const canTrade = !!tinv && tinv.items.length > 0;
    return [
      { key: 'talk', label: 'Talk', kind: 'social' },
      { key: 'trade', label: 'Trade', kind: 'social', disabled: !canTrade, reason: canTrade ? '' : 'they have nothing to trade' },
      { key: 'favor', label: 'Favor', kind: 'social' },
      { key: 'insult', label: 'Insult', kind: 'risky' },
      { key: 'threaten', label: 'Threaten', kind: 'risky' },
      { key: 'fight', label: 'Fight', kind: 'risky', danger: true },
      { key: 'backoff', label: 'Back Off' }
    ];
  }
  private static SELF_KEYS = ['rest', 'wash', 'eat', 'train', 'work'];
  private static CHAOS_KEYS = ['comply', 'returncell', 'hide', 'calm', 'helpguard'];
  private doAction(key: string) {
    this.panelDirty = true;
    if (this.selectedObj) {
      const status = this.sim.requestObjectAction(this.selectedObj, key);
      if (status) this.hud.alert(status, 'info');
      this.refreshObjectPanel();
      return;
    }
    const sel = this.selected ?? this.playerEntity;
    const isPlayerSel = sel === this.playerEntity || !!this.sim.ecs.get<Brain>(sel, 'Brain')?.isPlayer;
    let status: string;
    if (isPlayerSel && key === 'escape') status = this.sim.requestEscape();
    else if (isPlayerSel && Game.CHAOS_KEYS.includes(key)) status = this.sim.requestChaosAction(key);
    // player "convenience" needs actions route to the nearest reachable real object (not room shortcuts)
    else if (isPlayerSel && Game.SELF_KEYS.includes(key)) status = this.sim.requestNearestObjectAction(key);
    else status = this.sim.requestAction(sel, key as InteractAction);
    if (status) this.hud.alert(status, key === 'fight' || key === 'escape' ? 'fight' : 'info');
    this.refreshPanel();
  }

  private load() {
    const data = SaveManager.load();
    if (!data) { this.hud.alert('No save found', 'fight'); return; }
    this.sim.hydrate(data);
    this.sync.reset();
    this.feedback.reset();
    this.sync.setEcs(this.sim.ecs);
    this.playerEntity = this.sim.player();
    this.panelDirty = true;
    this.hud.clearAlerts();             // drop any stale alert lines from before the load
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
    (this.marker.material as THREE.MeshBasicMaterial).color.setHex(0x9fe0ff);
    this.marker.position.set(x, 0.06, z); this.marker.visible = true; this.markerLife = 1.5;
  }
  private setInvalidMarker(x: number, z: number) {
    this.setMarker(x, z);
    if (this.marker) (this.marker.material as THREE.MeshBasicMaterial).color.setHex(0xff5a4d);
    this.markerLife = 0.5;
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
    this.updateDoors(dt);
    this.feedback.update(dt, this.cam.camera, (e) => this.sync.worldOf(e));
    this.hud.setAction(this.sim.actionLabel(), this.sim.actionProgress());

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

    // panel: refresh on demand (selection/action/inventory) or a few times a second — never every frame
    this.panelTimer -= dt;
    if (this.panelDirty || this.panelTimer <= 0) {
      if (this.selectedObj) this.refreshObjectPanel(); else this.refreshPanel();
      this.panelDirty = false; this.panelTimer = 0.15;
    }
    // chaos-driven HUD: eased heat + riot pressure, lockdown chip + chaos banner
    const riot = this.sim.riotPressure;
    this.hud.setTop(this.sim.day, this.sim.hour, phaseAt(this.sim.hour).name, this.sim.heat, riot);
    this.hud.setAlarm(this.sim.alarm.active || this.sim.riotLevel === 'event' ? 1 : riot);
    this.hud.setChaos({
      lockdown: this.sim.lockdown.active, lockdownTimer: this.sim.lockdown.timer, lockdownReason: this.sim.lockdown.reason,
      alarm: this.sim.alarm.active, level: this.sim.riotLevel, objective: this.sim.playerObjective
    });

    this.app.renderer.render(this.app.scene, this.cam.camera);
    requestAnimationFrame(this.loop);
  };
}
