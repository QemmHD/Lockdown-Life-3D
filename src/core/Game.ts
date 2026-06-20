import * as THREE from 'three';
import { ThreeApp } from '../render/ThreeApp';
import { IsoCamera } from '../render/IsoCamera';
import { RenderSync } from '../render/RenderSync';
import { Feedback } from '../render/Feedback';
import { CombatFX } from '../render/CombatFX';
import { PostFX } from '../render/PostFX';
import { AudioSystem } from '../audio/AudioSystem';
import { buildPrison } from '../render/WorldRenderer';
import { dressRooms } from '../render/PropRenderer';
import { Simulation } from '../sim/Simulation';
import { EventBus } from './EventBus';
import { InputManager } from './InputManager';
import { SaveManager } from './SaveManager';
import { HUD, PanelInfo, PanelAction } from '../ui/HUD';
import { Menus } from '../ui/Menus';
import { Entity } from '../ecs/world';
import { Brain, Needs, Position, Agent, Social, Inventory } from '../ecs/components';
import { phaseAt, GANG_MAP } from '../data/content';
import { ITEMS, isContraband } from '../data/items';
import { InteractAction } from '../sim/Simulation';
import { stashInfo, stashLabel } from '../sim/EconomySystem';

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
  private combatFx!: CombatFX;
  private post!: PostFX;
  private audio = new AudioSystem();
  private hud: HUD;
  private menus!: Menus;
  private clock = new THREE.Clock();
  private acc = 0;
  private speedIdx = 0;
  private paused = false;
  private selected: Entity | null = null;
  private playerEntity: Entity = 0;
  private selectedObj: string | null = null;
  private objHits: THREE.Object3D[] = [];
  private objHighlight!: THREE.Mesh;
  private interactableDefs: any[] = [];
  private panelDirty = true;     // request an immediate panel refresh
  private panelTimer = 0;        // throttle background refreshes to ~6.7/s (not every frame)
  private endingShown = false;   // run-end card shown once per run (sentence served / escape / death)

  constructor(canvas: HTMLCanvasElement) {
    this.app = new ThreeApp(canvas);
    this.cam = new IsoCamera();
    this.input = new InputManager(canvas, this.bus);
    this.input.attachTapEnd(canvas);

    this.sim = new Simulation(this.bus);
    this.sim.generate();
    buildPrison(this.app.scene, this.sim.map, this.sim.rooms);
    const dressed = dressRooms(this.app.scene, this.sim.map, this.sim.rooms, this.sim.cells);
    const doors = this.buildDoorObjects();        // register doors/gates as interactables
    this.buildCellGates();                        // barred sliding gates on each individual cell
    this.objHits = [...dressed.hitMeshes, ...doors.hitMeshes];
    this.interactableDefs = [...dressed.interactables, ...doors.defs];
    this.sim.setInteractables(this.interactableDefs);
    // selection highlight ring under the picked object
    this.objHighlight = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.objHighlight.rotation.x = -Math.PI / 2; this.objHighlight.position.y = 0.07; this.objHighlight.visible = false; this.app.scene.add(this.objHighlight);
    this.sync = new RenderSync(this.app.scene, this.sim.ecs);
    this.combatFx = new CombatFX(this.app.scene);
    this.post = new PostFX(this.app.renderer, this.app.scene, this.cam.activeCamera);
    this.feedback = new Feedback();
    // character-focused camera: clamp to the prison, follow the player prisoner
    this.cam.setBounds(this.sim.map.width / 2 - 5, this.sim.map.height / 2 - 5);
    // device-aware fit: pinch all the way out frames the whole prison on any screen (tall iPhone too)
    this.cam.setWorldSize(this.sim.map.width, this.sim.map.height);
    // character-cam wall test: keep the perspective camera from clipping behind corridor walls
    this.cam.setOccluder((wx, wz) => { const k = this.sim.map.worldToIdx(wx, wz); return k < 0 || this.sim.map.walkable[k] === 0; });
    this.playerEntity = this.sim.player();
    const sp = this.sim.ecs.get<Position>(this.playerEntity, 'Position');
    this.cam.focus(sp ? sp.x : 0, sp ? sp.z : 0);

    this.hud = new HUD({
      onPause: () => this.openMenu(),
      onSpeed: () => { this.speedIdx = (this.speedIdx + 1) % SPEEDS.length; this.paused = false; this.hud.setSpeed(SPEEDS[this.speedIdx] + '×'); },
      onSave: () => { const ok = SaveManager.save(this.sim.serialize()); this.hud.alert(ok ? 'Game saved' : 'Save failed (storage unavailable)', ok ? 'guard' : 'fight'); },
      onLoad: () => this.load(),
      onDeselect: () => this.select(this.playerEntity),
      hasSave: () => SaveManager.has(),
      onAction: (key) => this.doAction(key),
      onItem: (key) => { const r = this.sim.dropItem(key); if (r) this.hud.alert(r, 'trade'); this.panelDirty = true; this.refreshPanel(); },
      onToggleCam: () => { this.cam.toggleMode(); this.hud.setCamMode(this.cam.isCharMode); this.cam.recenter(); },
      onToggleSound: () => { const muted = this.audio.toggleMute(); this.audio.unlock(); this.hud.setMuted(muted); }
    });
    this.select(this.playerEntity);   // panel shows the player by default
    this.hud.setMuted(this.audio.isMuted());   // reflect persisted mute state

    // menus / title / pause / daily summary (Stage 3.4)
    this.menus = new Menus({
      onNewGame: () => this.menus.showSetup(),
      onContinue: () => { this.load(); this.closeMenu(); },
      onQuickStart: () => this.closeMenu(),
      onResume: () => this.closeMenu(),
      onSave: () => { const ok = SaveManager.save(this.sim.serialize()); this.hud.alert(ok ? 'Game saved' : 'Save failed', ok ? 'guard' : 'fight'); },
      onLoad: () => { this.load(); this.closeMenu(); },
      onMainMenu: () => { this.menus.showTitle(); this.paused = true; },
      onBeginRun: (setup) => this.beginRun(setup),
      onAcceptInvite: () => { const inv = this.sim.gang.invite; if (inv) { const r = this.sim.requestGangAction(inv.by, 'acceptinvite'); if (r) this.hud.alert(r, 'player'); } },
      onDeclineInvite: () => { const inv = this.sim.gang.invite; if (inv) { const r = this.sim.requestGangAction(inv.by, 'declineinvite'); if (r) this.hud.alert(r, 'info'); } },
      onLeaveGang: () => { const r = this.sim.leaveGang(); if (r) this.hud.alert(r, 'info'); },
      onUseItem: (id) => { const r = this.sim.useItem(id); if (r) this.hud.alert(r, 'info'); this.panelDirty = true; },
      onDropItem: (id) => { const r = this.sim.dropItem(id); if (r) this.hud.alert(r, 'trade'); this.panelDirty = true; },
      onStashItem: (id) => { const r = this.sim.stashNearest(id); if (r) this.hud.alert(r, 'trade'); this.panelDirty = true; },
      onCraft: (id) => { const r = this.sim.craft(id); if (r) this.hud.alert(r, 'info'); this.panelDirty = true; },
      onCoachDone: () => { try { localStorage.setItem('ll3d_seen_coach', '1'); } catch { /* ignore */ } this.closeMenu(); },
      onCommissaryBuy: (id) => { const r = this.sim.commissaryBuy(id); if (r) this.hud.alert(r, 'trade'); this.panelDirty = true; },
      onBuy: (seller, id) => { const r = this.sim.buyItem(seller, id); if (r) this.hud.alert(r, 'trade'); },
      onSell: (buyer, id) => { const r = this.sim.sellItem(buyer, id); if (r) this.hud.alert(r, 'trade'); },
      tradeData: (seller) => this.sim.tradePanel(seller),
      hasSave: () => SaveManager.has(),
      saveInfo: () => { const d: any = SaveManager.load(); return d && Array.isArray(d.ents) ? { name: (d.ents.find((e: any) => e.isPlayer)?.brain?.name) || 'Inmate', day: d.day || 1 } : null; },
      snapshot: () => this.sim.uiSnapshot(),
      version: 'v4.27.1-swipe'
    });
    this.menus.showTitle(); this.paused = true;   // start at the title screen

    this.bus.on('pan', ({ dx, dy }) => this.cam.pan(dx, dy));   // one-finger swipe → rotate (zoomed) / pan (overview), see IsoCamera.pan
    this.bus.on('zoom', ({ factor }) => this.cam.zoomBy(factor));
    this.bus.on('tap', ({ x, y }) => this.onTap(x, y));
    this.bus.on('alert', ({ text, type }) => this.hud.alert(text, type));
    this.bus.on('impact', ({ x, z }) => { this.addImpact(x, z); this.combatFx.spark(x, z); });
    this.bus.on('blood', ({ x, z }) => this.combatFx.blood(x, z));
    this.bus.on('float', ({ x, z, text, color }) => this.feedback.float(x, z, text, color));
    this.bus.on('bubble', ({ e, text, kind, dur }) => this.feedback.bubble(e, text, kind, dur));
    this.bus.on('actionResult', ({ text }) => this.hud.alert(text, 'info'));
    // audio (read-only presentation listeners): combat thud, typed event cues, UI confirm
    this.bus.on('impact', () => this.audio.hit());
    this.bus.on('alert', ({ type }) => this.audio.alert(type));
    this.bus.on('actionResult', ({ text }) => this.audio.result(text));   // confirm on success, soft 'no' on failure

    const onResize = () => { this.app.resize(); this.cam.resize(); this.post.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));   // iOS settles after rotate
    window.visualViewport?.addEventListener('resize', onResize);                     // iOS toolbar show/hide
    window.addEventListener('keydown', (ev) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = ev.key;
      if (k === 'c' || k === 'C') { this.cam.toggleMode(); this.hud.setCamMode(this.cam.isCharMode); this.cam.recenter(); }
      else if (k === 'q' || k === 'Q' || k === 'ArrowLeft') this.cam.rotateView(-1);
      else if (k === 'e' || k === 'E' || k === 'ArrowRight') this.cam.rotateView(1);
    });
    // debug hook (only with ?debug): inspect sim/door state + run an invariant self-test + draw overlays
    if (/[?&]debug/.test(location.search)) {
      (window as any).__game = this;
      console.info('[selfTest]', this.sim.selfTest());
      this.buildDebugOverlay();
      this.installCheats();
      window.addEventListener('keydown', (ev) => {
        if ((ev.target as HTMLElement)?.tagName === 'INPUT' || this.paused) return;
        const c = (window as any).__cheats; if (!c) return;
        const k = ev.key.toLowerCase();
        if (k === 'k') c.fight(); else if (k === 'b') c.breakdown(); else if (k === 'm') c.money();
        else if (k === 'j') c.give('club'); else if (k === 'g') { c.give('part'); c.give('part'); }
        else if (k === 'h') c.hearing(); else if (k === 'y') c.skipday();
      });
    }
    this.loop();
  }

  private doorVisuals: { id: string; pivot: THREE.Object3D; baseRot: number; lampMat: THREE.MeshStandardMaterial; lastOpen?: boolean }[] = [];
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
      // interaction point = an adjacent pathable, non-door tile (stand beside, not on, the door)
      let ix = w.x, iz = w.z;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = t.x + dx, ny = t.y + dy;
        if (map.isPathable(nx, ny) && map.idx(nx, ny) !== r.door) { const nw = map.toWorld(nx, ny); ix = nw.x; iz = nw.z; break; }
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

  // a barred sliding gate on the gap of every individual cell. Visual only — the gap tile stays
  // walkable so the occupant can always reach the bunk; the leaf reflects the owning block's
  // door state (open / closed / locked) so cells read as real and respond to lockdowns.
  private cellGates: { pivot: THREE.Object3D; blockDoorId: string; lampMat: THREE.MeshStandardMaterial }[] = [];
  private buildCellGates() {
    const map = this.sim.map;
    const barMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.5, metalness: 0.6 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.7, metalness: 0.4 });
    for (const c of this.sim.cells) {
      const t = map.tileXY(c.doorTile); const w = map.toWorld(t.x, t.y);
      const grp = new THREE.Group(); grp.position.set(w.x, 0, w.z); grp.rotation.y = 0;   // cell fronts run E-W → leaf spans X
      grp.add(this.makeBox(0.12, 2.0, 0.14, frameMat, -0.5, 1.0, 0));
      grp.add(this.makeBox(0.12, 2.0, 0.14, frameMat, 0.5, 1.0, 0));
      const pivot = new THREE.Group(); pivot.position.set(-0.45, 0, 0);                    // hinge at left post
      for (let i = 0; i < 4; i++) pivot.add(this.makeCyl(0.04, 1.7, barMat, 0.1 + i * 0.24, 0.85, 0));
      pivot.add(this.makeBox(0.9, 0.08, 0.08, barMat, 0.45, 1.6, 0));
      pivot.add(this.makeBox(0.9, 0.08, 0.08, barMat, 0.45, 0.2, 0));
      grp.add(pivot);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0x33ff66, emissiveIntensity: 0.9 });
      grp.add(this.makeBox(0.12, 0.12, 0.12, lampMat, 0.5, 1.95, 0));
      this.app.scene.add(grp);
      this.cellGates.push({ pivot, blockDoorId: 'door_' + c.room, lampMat });
    }
  }

  // reflect each door/gate's open/locked/restricted state into its mesh (read-only view of sim)
  private updateDoors(dt: number) {
    const chaos = this.sim.alarm.active || this.sim.lockdown.active || this.sim.riotLevel === 'event';
    const flash = chaos ? 0.5 + Math.abs(Math.sin(this.clock.elapsedTime * 6)) * 1.2 : 1.2;
    for (const d of this.doorVisuals) {
      const o = this.sim.getObj(d.id); if (!o) continue;
      if (d.lastOpen === undefined) d.lastOpen = o.open;            // prime; no sound on first frame
      else if (o.open !== d.lastOpen) { d.lastOpen = o.open; this.audio.door(o.open); }   // slide / clang on change
      const target = o.open ? Math.PI * 0.46 : 0;                   // swing the leaf open/closed
      d.pivot.rotation.y += (target - d.pivot.rotation.y) * Math.min(1, dt * 8);
      const col = o.restricted ? 0xff3322 : o.locked ? 0xffaa22 : o.open ? 0x33ff66 : 0xccbb44;
      d.lampMat.emissive.setHex(col); d.lampMat.color.setHex(col & 0x222222);
      d.lampMat.emissiveIntensity = (chaos && (o.locked || o.restricted)) ? flash : 1.2;
    }
    // cell gates mirror their block's main door state (open during cell time, locked in lockdown)
    for (const g of this.cellGates) {
      const o = this.sim.getObj(g.blockDoorId); if (!o) continue;
      const target = o.open ? Math.PI * 0.44 : 0;
      g.pivot.rotation.y += (target - g.pivot.rotation.y) * Math.min(1, dt * 8);
      const col = o.locked ? 0xffaa22 : o.open ? 0x33ff66 : 0xccbb44;
      g.lampMat.emissive.setHex(col); g.lampMat.emissiveIntensity = (chaos && o.locked) ? flash : 0.9;
    }
  }

  // ---- ?debug overlays: blocked tiles, door/anchor markers, live player path ----
  private dbgPath: THREE.Line | null = null;
  private buildDebugOverlay() {
    const map = this.sim.map; const root = new THREE.Group();
    // blocked prop solids (red) + structural walls already render as concrete
    const blkGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const blkMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.32, depthWrite: false });
    let nb = 0; for (let i = 0; i < map.blocked.length; i++) if (map.blocked[i]) nb++;
    const blk = new THREE.InstancedMesh(blkGeo, blkMat, Math.max(1, nb)); const m = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); const s = new THREE.Vector3(1, 1, 1); let bi = 0;
    for (let i = 0; i < map.blocked.length; i++) if (map.blocked[i]) { const t = map.tileXY(i); const w = map.toWorld(t.x, t.y); blk.setMatrixAt(bi++, m.compose(new THREE.Vector3(w.x, 0.09, w.z), q, s)); }
    blk.instanceMatrix.needsUpdate = true; root.add(blk);
    // door + interaction-anchor markers
    for (const o of this.sim.objs.values()) {
      const isDoor = o.type === 'door' || o.type === 'gate';
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshBasicMaterial({ color: isDoor ? 0x33aaff : 0x66ff88, depthWrite: false }));
      dot.rotation.x = -Math.PI / 2; dot.position.set(o.ix, 0.11, o.iz); root.add(dot);
    }
    this.app.scene.add(root);
    this.dbgPath = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe14a }));
    this.dbgPath.position.y = 0.14; this.app.scene.add(this.dbgPath);
  }
  private updateDebugPath() {
    const ag = this.sim.ecs.get<Agent>(this.playerEntity, 'Agent'); const map = this.sim.map;
    const pts: THREE.Vector3[] = [];
    const p = this.sim.ecs.get<Position>(this.playerEntity, 'Position'); if (p) pts.push(new THREE.Vector3(p.x, 0, p.z));
    if (ag?.path) for (let i = ag.step; i < ag.path.length; i++) { const t = map.tileXY(ag.path[i]); const w = map.toWorld(t.x, t.y); pts.push(new THREE.Vector3(w.x, 0, w.z)); }
    this.dbgPath!.geometry.setFromPoints(pts.length ? pts : [new THREE.Vector3(), new THREE.Vector3()]);
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
    const canHide = ['bed', 'toilet', 'sink', 'locker', 'shelf', 'trash', 'desk'].includes(o.type);
    if (canHide) { const si = stashInfo(o.type); meta.push(`Stash ${o.stash.length}/${si.cap} · ${stashLabel(si.risk)}`); }
    else if (o.stash.length) meta.push(`Hidden: ${o.stash.length}`);
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
    const gi = !isPlayer ? this.sim.gangInfoFor(e) : null;
    const meta = isPlayer
      ? [`Rep ${Math.round(s.reputation)}`, `Respect ${Math.round(s.respect)}`, `💪 ${this.sim.attrs(e)?.strength ?? 0}`, `Suspicion ${Math.round(s.suspicion)}`, `$${inv?.money ?? 0}`, ...(this.sim.gang.membership ? [`${GANG_MAP[this.sim.gang.membership].name}: ${['None', 'Associate', 'Member', 'Trusted', 'Enforcer', 'Shot Caller'][this.sim.gang.rank]}`] : [])]
      : [`Respect ${Math.round(s.respect)}`, `Toward you: ${this.relWord(s.rel)}`, ...(gi ? [`${gi.gang}: ${gi.label}${gi.relation !== 'neutral' ? ` (${gi.relation})` : ''}`] : [])];
    const items = (inv?.items ?? []).map((id) => ({ icon: ITEMS[id]?.icon ?? '▪', name: ITEMS[id]?.name ?? id, contraband: isContraband(id), key: id }));
    const actions: PanelAction[] = isPlayer ? this.playerActions(e) : this.npcActions(e, b.role);
    const info: PanelInfo = {
      name: b.name, role: isPlayer ? 'Player' : b.role, player: isPlayer,
      gang: gang?.name, gangColor: gang ? this.hex(gang.color) : undefined,
      state: b.action ?? b.state, room: this.sim.currentRoomName(e), traits: b.traits, meta,
      needs: [
        { label: 'Health', value: n.health, color: '#e74c3c' },
        { label: 'Spirit', value: n.morale ?? 0.6, color: '#f1c40f' },
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
    // mid-fight the panel becomes a combat panel (Strike / Heavy / Shove / Block / Back Off)
    const combat = this.sim.playerCombatActions();
    if (combat.length) { for (const c of combat) a.push({ key: c.key, label: c.label, kind: 'risky', danger: c.key === 'heavy' }); return a; }
    const chaos = this.sim.playerChaosActions();
    // during a lockdown the needs stations are out of reach — lead with the chaos actions only
    if (!this.sim.lockdown.active) {
      a.push({ key: 'rest', label: 'Rest', kind: 'object' }, { key: 'wash', label: 'Wash', kind: 'object' },
        { key: 'eat', label: 'Eat', kind: 'object' }, { key: 'train', label: 'Train', kind: 'object' }, { key: 'work', label: 'Work', kind: 'object' });
    }
    // chaos context actions (Comply / Return to Cell / Hide / Calm Down / Help Guard / Attempt Escape)
    for (const c of chaos) a.push({ key: c.key, label: c.label, kind: c.key.startsWith('esc') ? 'risky' : 'guard', disabled: c.disabled, reason: c.reason, danger: c.key === 'escape' || c.key === 'escbreak' });
    return a;
  }
  private npcActions(e: Entity, role: string): PanelAction[] {
    if (role === 'guard') return [{ key: 'talk', label: 'Talk', kind: 'social' }, { key: 'comply', label: 'Comply', kind: 'guard' }, { key: 'argue', label: 'Argue', kind: 'risky' }, { key: 'fight', label: 'Attack', kind: 'risky', danger: true }];
    const tinv = this.sim.ecs.get<Inventory>(e, 'Inventory');
    const canTrade = !!tinv && tinv.items.length > 0;
    const a: PanelAction[] = [
      { key: 'talk', label: 'Talk', kind: 'social' },
      { key: 'compliment', label: 'Compliment', kind: 'social' },
      { key: 'recruit', label: 'Recruit', kind: 'social' },
      { key: 'trade', label: 'Trade', kind: 'social', disabled: !canTrade, reason: canTrade ? '' : 'they have nothing to trade' },
      { key: 'favor', label: 'Favor', kind: 'social' }
    ];
    // gang actions when this inmate has a crew
    const gi = this.sim.gangInfoFor(e);
    if (gi) {
      if (gi.inviteActive) { a.push({ key: 'acceptinvite', label: 'Accept Invite', kind: 'guard' }, { key: 'declineinvite', label: 'Decline', kind: 'social' }); }
      else if (gi.canAsk) a.push({ key: 'askgang', label: 'Ask About Gang', kind: 'social' });
      if (gi.relation === 'ally') a.push({ key: 'helpmember', label: 'Help Member', kind: 'social' });
    }
    a.push({ key: 'insult', label: 'Insult', kind: 'risky' }, { key: 'threaten', label: 'Threaten', kind: 'risky' }, { key: 'fight', label: 'Fight', kind: 'risky', danger: true }, { key: 'backoff', label: 'Back Off' });
    return a;
  }
  private static SELF_KEYS = ['rest', 'wash', 'eat', 'train', 'work'];
  private static CHAOS_KEYS = ['comply', 'returncell', 'hide', 'calm', 'helpguard'];
  private static COMBAT_KEYS = ['strike', 'heavy', 'shove', 'block', 'throw', 'grab'];
  private static GANG_KEYS = ['askgang', 'acceptinvite', 'declineinvite', 'helpmember'];
  private doAction(key: string) {
    this.panelDirty = true;
    if (this.sim.playerStunned()) { this.hud.alert("You're not in control of yourself!", 'warning'); return; }
    if (this.selectedObj) {
      const status = this.sim.requestObjectAction(this.selectedObj, key);
      if (status) this.hud.alert(status, 'info');
      this.refreshObjectPanel();
      return;
    }
    const sel = this.selected ?? this.playerEntity;
    const isPlayerSel = sel === this.playerEntity || !!this.sim.ecs.get<Brain>(sel, 'Brain')?.isPlayer;
    const fighting = isPlayerSel && this.sim.ecs.get<Brain>(this.playerEntity, 'Brain')?.state === 'fight';
    let status: string;
    if (!isPlayerSel && key === 'trade') { this.menus.showTrade(sel); this.paused = true; return; }   // open the trade panel
    if (fighting && (Game.COMBAT_KEYS.includes(key) || key === 'backoff')) status = this.sim.requestCombatAction(key);
    else if (!isPlayerSel && Game.GANG_KEYS.includes(key)) status = this.sim.requestGangAction(sel, key);
    else if (isPlayerSel && key === 'escape') status = this.sim.requestEscape();
    else if (isPlayerSel && (key === 'escstart' || key === 'escwork' || key === 'escbreak')) status = this.sim.requestChaosAction(key);
    else if (isPlayerSel && Game.CHAOS_KEYS.includes(key)) status = this.sim.requestChaosAction(key);
    // player "convenience" needs actions route to the nearest reachable real object (not room shortcuts)
    else if (isPlayerSel && Game.SELF_KEYS.includes(key)) status = this.sim.requestNearestObjectAction(key);
    else { status = this.sim.requestAction(sel, key as InteractAction); if (key === 'fight') this.select(this.playerEntity); }   // show combat panel
    if (status) this.hud.alert(status, key === 'fight' || key === 'escape' || key === 'escbreak' ? 'fight' : 'info');
    this.refreshPanel();
  }

  private openMenu() { if (this.menus.isOpen()) return; this.menus.showPause(); this.paused = true; }
  private closeMenu() { this.menus.hide(); this.paused = false; this.hud.setSpeed(SPEEDS[this.speedIdx] + '×'); }

  // start a fresh run from a created character setup (no page reload)
  private beginRun(setup: any) {
    SaveManager.clear();
    this.sim.startNewRun(setup, this.interactableDefs as any);
    this.sync.reset(); this.feedback.reset(); this.combatFx.reset(); this.sync.setEcs(this.sim.ecs);
    for (const d of this.doorVisuals) d.lastOpen = undefined;   // re-prime door SFX (no stray clang on new run)
    this.endingShown = false;
    this.playerEntity = this.sim.player();
    const sp = this.sim.ecs.get<Position>(this.playerEntity, 'Position'); if (sp) this.cam.focus(sp.x, sp.z);
    this.speedIdx = 0; this.paused = false; this.hud.setSpeed('1×');
    this.hud.clearAlerts();
    this.panelDirty = true; this.menus.hide(); this.select(this.playerEntity);
    this.hud.alert(`Welcome to the block, ${this.sim.ecs.get<Brain>(this.playerEntity, 'Brain')?.name ?? 'inmate'}.`, 'player');
    this.maybeShowCoach();
  }

  // first-run onboarding: show the coach overlay once (persisted in localStorage)
  private maybeShowCoach() {
    try { if (localStorage.getItem('ll3d_seen_coach')) return; } catch { return; }
    this.menus.showCoach(0); this.paused = true;
  }

  // ?debug-only test helpers — never wired into normal play. window.__cheats.* + hotkeys (see ctor).
  private installCheats() {
    const sim: any = this.sim;
    const get = (name: string) => sim.ecs.get(sim.player(), name);
    const cheats: any = {
      money: (n = 50) => { get('Inventory').money += n; this.panelDirty = true; this.hud.alert(`+$${n}`, 'trade'); },
      give: (id = 'club') => { get('Inventory').items.push(id); this.panelDirty = true; this.hud.alert(`Gave ${id}`, 'info'); },
      spirit: (v = 1) => { get('Needs').morale = v; },
      breakdown: () => { get('Needs').morale = 0; this.hud.alert('Spirit → 0 (breakdown imminent)', 'fight'); },
      hurt: (h = 0.15) => { get('Needs').health = h; },
      heal: () => { const n = get('Needs'); n.health = 1; const b = get('Brain'); if (b) { b.injuredT = 0; b.bleedT = 0; } },
      starve: () => { get('Needs').hunger = 0.99; },
      fight: () => {
        const p = get('Position'); let best: any = null, bd = 1e9;
        for (const e of sim.ecs.query('Brain', 'Position')) {
          const b = sim.ecs.get(e, 'Brain'); if (b.role !== 'prisoner' || b.isPlayer || b.state === 'down') continue;
          const q = sim.ecs.get(e, 'Position'); const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = e; }
        }
        if (best != null) { const bp = sim.ecs.get(best, 'Position'); bp.x = p.x + 0.9; bp.z = p.z; sim.requestAction(best, 'fight'); this.select(this.playerEntity); }
      },
      charge: (sev = 2) => { sim.charges.push({ kind: 'debug charge', severity: sev, day: sim.day }); if (!sim.nextHearingDay) sim.nextHearingDay = sim.day; this.hud.alert(`Charge logged (sev ${sev})`, 'info'); },
      hearing: () => { if (!sim.charges.length) sim.charges.push({ kind: 'debug charge', severity: 2, day: sim.day }); sim.nextHearingDay = sim.day; this.hud.alert('Hearing armed for tonight', 'info'); },
      skipday: () => { sim.hour = 23.9; },
      win: () => sim.endRun('released'),
      die: (cause = 'Debug death') => sim.endRun('dead', cause),
    };
    (window as any).__cheats = cheats;
    console.info('%c[cheats ?debug] keys: K=fight B=breakdown M=+$ J=club G=parts H=hearing Y=skip-to-night  | or call window.__cheats.* (money/give/spirit/hurt/heal/starve/fight/charge/hearing/win/die)', 'color:#ffd24a');
  }

  private load() {
    const data = SaveManager.load();
    if (!data) { this.hud.alert('No save found', 'fight'); return; }
    this.sim.hydrate(data);
    this.sync.reset();
    this.feedback.reset();
    this.combatFx.reset();
    this.sync.setEcs(this.sim.ecs);
    for (const d of this.doorVisuals) d.lastOpen = undefined;   // re-prime door SFX (no stray clang on load)
    this.endingShown = false;
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
    this.combatFx.update(dt);
    this.updateMarker(dt);
    this.updateDoors(dt);
    if (this.dbgPath) this.updateDebugPath();
    this.feedback.update(dt, this.cam.activeCamera, (e) => this.sync.worldOf(e));
    this.hud.setAction(this.sim.actionLabel(), this.sim.actionProgress());

    // character-focused follow: always track the player prisoner with a small movement lead
    const ft = this.followTarget();
    const w = this.sync.worldOf(ft) ?? this.sim.ecs.get<Position>(ft, 'Position');
    if (w) {
      const pos = this.sim.ecs.get<Position>(ft, 'Position');
      const moving = !!this.sim.ecs.get<Agent>(ft, 'Agent')?.path;
      const lead = moving && pos ? 2 : 0;
      this.cam.setFollow(w.x + (pos ? Math.sin(pos.facing) * lead : 0), w.z + (pos ? Math.cos(pos.facing) * lead : 0), pos?.facing);
    }
    this.cam.tick(dt);

    // while the player is fighting, force the combat panel (so combat buttons are reachable)
    if (!this.selectedObj && this.sim.ecs.get<Brain>(this.playerEntity, 'Brain')?.state === 'fight' && this.selected !== this.playerEntity) { this.selected = this.playerEntity; this.panelDirty = true; }

    // panel: refresh on demand (selection/action/inventory) or a few times a second — never every frame
    this.panelTimer -= dt;
    if (this.panelDirty || this.panelTimer <= 0) {
      if (this.selectedObj) this.refreshObjectPanel(); else this.refreshPanel();
      this.panelDirty = false; this.panelTimer = 0.15;
    }
    // chaos-driven HUD: eased heat + riot pressure, lockdown chip + chaos banner
    const riot = this.sim.riotPressure;
    this.hud.setTop(this.sim.day, this.sim.hour, phaseAt(this.sim.hour).name, this.sim.heat, riot, Math.max(0, this.sim.sentence - this.sim.served));
    this.hud.setAlarm(this.sim.alarm.active || this.sim.riotLevel === 'event' ? 1 : riot);
    this.hud.setChaos({
      lockdown: this.sim.lockdown.active, lockdownTimer: this.sim.lockdown.timer, lockdownReason: this.sim.lockdown.reason,
      alarm: this.sim.alarm.active, level: this.sim.riotLevel, objective: this.sim.playerObjective
    });
    // ambient audio bed: rises with riot pressure, klaxon on alarm/lockdown, ducked when paused/menus
    this.audio.updateAmbient(!this.paused, riot, this.sim.alarm.active || this.sim.lockdown.active, this.sim.hour);
    // objective tracker (throttled with the panel) + once-a-day summary modal
    if (this.panelTimer >= 0.14) this.hud.setObjectives(this.sim.objectives, this.sim.tier());
    if (this.sim.pendingSummary && !this.menus.isOpen()) { this.menus.showSummary(this.sim.takeSummary()); this.paused = true; }
    // run end: sentence served (release), escape, or death → show the verdict card once
    if (this.sim.runEnd && !this.endingShown && !this.menus.isOpen()) { this.endingShown = true; this.menus.showEnding(this.sim.runEnd); this.paused = true; }

    this.post.setCamera(this.cam.activeCamera);
    this.post.render(t);
    requestAnimationFrame(this.loop);
  };
}
