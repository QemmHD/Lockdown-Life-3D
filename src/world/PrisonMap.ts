import * as THREE from 'three';
import { ROOMS, ROOM_MAP, PLAYER_CELL } from '../data/rooms';
import { FACTIONS } from '../data/factions';
import { CollisionWorld, Collider } from './Collision';

export type InteractType =
  | 'bed' | 'toilet' | 'stash' | 'serving' | 'table' | 'trash'
  | 'weights' | 'bag' | 'track' | 'pullup' | 'books' | 'shower'
  | 'medbed' | 'workbench' | 'cleanstation' | 'laundrystation'
  | 'kitchenstation' | 'phone' | 'desk' | 'door';

export interface Interactable {
  id: string;
  type: InteractType;
  label: string;
  x: number; z: number;
  room: string;
  payload?: any;
  mesh?: THREE.Object3D;
}

export interface PrisonDoor {
  collider: Collider;
  mesh: THREE.Mesh;
  baseX: number; baseZ: number;
  open: boolean;
  target: number; // 0 closed..1 open offset
  cur: number;
  room: string;
  axis: 'x' | 'z';
}

const WALL_H = 4;
const WALL_T = 0.6;

export class PrisonMap {
  scene: THREE.Scene;
  collision: CollisionWorld;
  interactables: Interactable[] = [];
  doors: PrisonDoor[] = [];
  flicker: THREE.PointLight[] = [];
  steamPuffs: THREE.Sprite[] = [];
  labels: { el: HTMLDivElement; x: number; z: number }[] = [];
  private root = new THREE.Group();

  constructor(scene: THREE.Scene, collision: CollisionWorld) {
    this.scene = scene;
    this.collision = collision;
  }

  build() {
    this.scene.add(this.root);
    this.buildFloor();
    this.buildRoomZones();
    this.buildOuterWalls();
    for (const r of ROOMS) {
      if (r.id === 'hallway') continue;
      this.buildRoomWalls(r);
    }
    this.buildProps();
    this.buildLights();
  }

  private grungeTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3c3c42';
    ctx.fillRect(0, 0, 512, 512);
    // tile grid
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    // stains
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 6 + Math.random() * 40;
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // cracks / scuffs
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(20,20,20,${0.1 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      let x = Math.random() * 512, y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // rust
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 4 + Math.random() * 14;
      ctx.fillStyle = `rgba(120,60,20,${0.06 + Math.random() * 0.1})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 8);
    return tex;
  }

  private buildFloor() {
    const geo = new THREE.PlaneGeometry(130, 56);
    const mat = new THREE.MeshLambertMaterial({ map: this.grungeTexture() });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);
  }

  private buildRoomZones() {
    for (const r of ROOMS) {
      const isYard = r.id === 'yard';
      const geo = new THREE.PlaneGeometry(r.w - 0.4, r.d - 0.4);
      const mat = new THREE.MeshLambertMaterial({ color: r.floor, transparent: true, opacity: isYard ? 0.55 : 0.45 });
      const zone = new THREE.Mesh(geo, mat);
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(r.x, 0.03, r.z);
      zone.receiveShadow = true;
      this.root.add(zone);

      // faction territory border tint
      if (r.faction && FACTIONS[r.faction]) {
        const border = new THREE.Mesh(
          new THREE.RingGeometry(0, 1, 4),
          new THREE.MeshBasicMaterial({ color: FACTIONS[r.faction].color, transparent: true, opacity: 0.0 })
        );
        border.visible = false; this.root.add(border);
      }

      // HTML room label
      const el = document.createElement('div');
      el.className = 'room-label';
      el.textContent = r.name;
      document.getElementById('ui-root')?.appendChild(el);
      this.labels.push({ el, x: r.x, z: r.z - r.d / 2 + 1.2 });
    }
  }

  private addWall(x: number, z: number, w: number, d: number, color = 0x6f6f78, h = WALL_H, register = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.root.add(mesh);
    if (register) this.collision.add(x, z, w, d);
    return mesh;
  }

  private buildOuterWalls() {
    const C = 0x5a5a64;
    this.addWall(0, -24, 122, WALL_T, C);
    this.addWall(0, 24, 122, WALL_T, C);
    this.addWall(-60.5, 0, WALL_T, 48, C);
    this.addWall(60.5, 0, WALL_T, 48, C);
  }

  private buildRoomWalls(r: { id: string; x: number; z: number; w: number; d: number; restricted?: boolean }) {
    const C = r.restricted ? 0x4a4a54 : 0x6f6f78;
    const north = r.z < 0;
    const frontZ = north ? r.z + r.d / 2 : r.z - r.d / 2;
    const backZ = north ? r.z - r.d / 2 : r.z + r.d / 2;
    // back wall (solid)
    this.addWall(r.x, backZ, r.w, WALL_T, C);
    // side walls
    this.addWall(r.x - r.w / 2, r.z, WALL_T, r.d, C);
    this.addWall(r.x + r.w / 2, r.z, WALL_T, r.d, C);
    // front wall with doorway gap (gap width 4)
    const gap = 4;
    const segW = (r.w - gap) / 2;
    if (segW > 0.2) {
      this.addWall(r.x - (gap / 2 + segW / 2), frontZ, segW, WALL_T, C);
      this.addWall(r.x + (gap / 2 + segW / 2), frontZ, segW, WALL_T, C);
    }

    // animated door for restricted / cell rooms
    if (['cellblock', 'solitary', 'guard_office', 'warden_office', 'checkpoint', 'storage', 'maintenance'].includes(r.id)) {
      this.addDoor(r.x, frontZ, gap, r.id);
    }
  }

  private addDoor(x: number, z: number, w: number, room: string) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, WALL_H - 0.4, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x9a9a44, flatShading: true })
    );
    mesh.position.set(x, (WALL_H - 0.4) / 2, z);
    mesh.castShadow = true;
    // bars look
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, WALL_H - 0.6, 0.32), new THREE.MeshLambertMaterial({ color: 0x33331a }));
      bar.position.set(i * (w / 3.2), 0, 0);
      mesh.add(bar);
    }
    this.root.add(mesh);
    const collider = this.collision.add(x, z, w, 0.3, 'door_' + room);
    const door: PrisonDoor = { collider, mesh, baseX: x, baseZ: z, open: true, target: 1, cur: 1, room, axis: 'x' };
    collider.solid = false;
    mesh.visible = false;
    this.doors.push(door);
  }

  setDoorsOpen(open: boolean) {
    for (const d of this.doors) {
      d.open = open;
      d.target = open ? 1 : 0;
    }
  }

  updateDoors(dt: number) {
    for (const d of this.doors) {
      d.cur = THREE.MathUtils.lerp(d.cur, d.target, Math.min(1, dt * 6));
      const slide = d.cur; // 1 = open (slid aside + hidden), 0 = closed
      d.mesh.visible = slide < 0.92;
      d.mesh.position.x = d.baseX + slide * 4.2; // slide to side
      d.collider.solid = slide < 0.4;
    }
  }

  private addInteractable(it: Interactable) { this.interactables.push(it); }

  // ---------- Props ----------
  private box(x: number, z: number, w: number, h: number, d: number, color: number, collide = true, y?: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
    m.position.set(x, y ?? h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    this.root.add(m);
    if (collide) this.collision.add(x, z, w, d);
    return m;
  }

  private cyl(x: number, z: number, r: number, h: number, color: number, collide = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), new THREE.MeshLambertMaterial({ color, flatShading: true }));
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    this.root.add(m);
    if (collide) this.collision.add(x, z, r * 2, r * 2);
    return m;
  }

  private bunk(x: number, z: number) {
    this.box(x, z, 2, 0.4, 1.1, 0x6b5a3a, true, 0.4);
    this.box(x, z, 2, 0.4, 1.1, 0x8a7448, true, 1.1);
    // pillows
    this.box(x - 0.7, z, 0.5, 0.15, 0.9, 0xdedede, false, 0.65);
    this.box(x - 0.7, z, 0.5, 0.15, 0.9, 0xdedede, false, 1.35);
  }

  private buildProps() {
    // ---- Cell block: rows of cells with bunks, toilets, tables ----
    const cb = ROOM_MAP['cellblock'];
    for (let i = 0; i < 3; i++) {
      const cx = cb.x - 2 + i * 2.2;
      const cz = cb.z - 4;
      this.bunk(cx, cz);
      this.box(cx + 0.8, cz + 2, 0.5, 0.8, 0.5, 0xcfcfcf, true); // toilet
      this.box(cx - 0.7, cz + 2.4, 1, 0.7, 0.6, 0x5a4a32, true); // small table
    }
    // player cell marker bunk + stash + toilet + books
    this.bunk(PLAYER_CELL.x, PLAYER_CELL.z);
    this.addInteractable({ id: 'player_bed', type: 'bed', label: 'Sleep (advance day)', x: PLAYER_CELL.x, z: PLAYER_CELL.z + 1.2, room: 'cellblock' });
    this.box(PLAYER_CELL.x + 1.6, PLAYER_CELL.z, 0.5, 0.8, 0.5, 0xcfcfcf, true);
    this.addInteractable({ id: 'cell_toilet', type: 'toilet', label: 'Use toilet', x: PLAYER_CELL.x + 1.6, z: PLAYER_CELL.z + 0.9, room: 'cellblock' });
    const stash = this.box(PLAYER_CELL.x - 1.4, PLAYER_CELL.z + 2, 0.8, 0.5, 0.6, 0x7a3a2a, false);
    this.addInteractable({ id: 'stash_cell', type: 'stash', label: 'Personal stash', x: PLAYER_CELL.x - 1.4, z: PLAYER_CELL.z + 2.6, room: 'cellblock', mesh: stash });
    this.box(PLAYER_CELL.x - 2.2, PLAYER_CELL.z - 2, 0.6, 1.1, 0.4, 0x5a4a32, false); // bookshelf
    this.addInteractable({ id: 'cell_books', type: 'books', label: 'Read (intelligence)', x: PLAYER_CELL.x - 2.2, z: PLAYER_CELL.z - 1.3, room: 'cellblock' });

    // ---- Cafeteria ----
    const ca = ROOM_MAP['cafeteria'];
    for (let i = 0; i < 2; i++) {
      const tz = ca.z - 3 + i * 4;
      this.box(ca.x, tz, 5, 0.3, 1, 0x8a8a90, true, 0.7);
      this.box(ca.x, tz - 1, 5, 0.4, 0.5, 0x6a6a72, false, 0.35);
      this.box(ca.x, tz + 1, 5, 0.4, 0.5, 0x6a6a72, false, 0.35);
    }
    this.box(ca.x, ca.z - 6.5, 6, 1, 0.8, 0xb0b0b8, true, 0.5); // serving counter
    this.addInteractable({ id: 'serving', type: 'serving', label: 'Get food tray / eat', x: ca.x, z: ca.z - 5.4, room: 'cafeteria' });
    this.box(ca.x + 4.5, ca.z + 4.5, 0.8, 1, 0.8, 0x3a3a3a, true); // trash
    this.addInteractable({ id: 'caf_trash', type: 'trash', label: 'Trash bin', x: ca.x + 4.5, z: ca.z + 3.8, room: 'cafeteria' });
    this.addInteractable({ id: 'caf_table', type: 'table', label: 'Sit and eat', x: ca.x, z: ca.z + 1, room: 'cafeteria' });

    // ---- Kitchen ----
    const ki = ROOM_MAP['kitchen'];
    this.box(ki.x, ki.z - 4, 6, 1, 1.2, 0x9a9aa0, true, 0.5); // counters
    this.box(ki.x - 3, ki.z, 1.5, 1.6, 1.5, 0xc0c0c8, true); // oven
    this.addInteractable({ id: 'kitchen_job', type: 'kitchenstation', label: 'Kitchen duty (job)', x: ki.x, z: ki.z - 3, room: 'kitchen', payload: 'kitchen' });
    const ks = this.box(ki.x + 3, ki.z + 3, 0.8, 0.5, 0.6, 0x7a3a2a, false);
    this.addInteractable({ id: 'stash_kitchen', type: 'stash', label: 'Hidden stash', x: ki.x + 3, z: ki.z + 3.6, room: 'kitchen', mesh: ks });

    // ---- Medical ----
    const me = ROOM_MAP['medical'];
    for (let i = 0; i < 2; i++) {
      this.box(me.x - 2 + i * 3.5, me.z - 3, 2, 0.5, 1, 0xe8e8ec, true, 0.5);
    }
    this.box(me.x + 4, me.z + 3, 1, 1.4, 0.6, 0xdddde2, true); // cabinet
    this.addInteractable({ id: 'medbed', type: 'medbed', label: 'Rest / get treated', x: me.x - 2, z: me.z - 2, room: 'medical' });

    // ---- Gym ----
    const gy = ROOM_MAP['gym'];
    this.box(gy.x - 3, gy.z - 2, 2, 0.5, 0.8, 0x33363c, true, 0.4); // bench
    this.cyl(gy.x - 3, gy.z - 3.2, 0.5, 0.4, 0x222222); // weights
    this.addInteractable({ id: 'weights', type: 'weights', label: 'Lift weights (Strength)', x: gy.x - 3, z: gy.z - 1, room: 'gym', payload: 'strength' });
    const bag = this.cyl(gy.x + 3, gy.z, 0.5, 2, 0x6b3a2a, true);
    bag.position.y = 1.6;
    this.addInteractable({ id: 'bag', type: 'bag', label: 'Hit the bag (Combat)', x: gy.x + 3, z: gy.z + 1, room: 'gym', payload: 'combat' });
    for (let i = 0; i < 3; i++) this.cyl(gy.x - 4 + i * 0.5, gy.z + 3, 0.18, 0.3, 0x444444); // dumbbells

    // ---- Yard ----
    const ya = ROOM_MAP['yard'];
    // fence look (taller walls already). pull-up bar
    this.box(ya.x - 3, ya.z - 3, 0.2, 2.2, 0.2, 0x888888, true, 1.1);
    this.box(ya.x + 3, ya.z - 3, 0.2, 2.2, 0.2, 0x888888, true, 1.1);
    this.box(ya.x, ya.z - 3, 6.2, 0.2, 0.2, 0x888888, false, 2.1);
    this.addInteractable({ id: 'pullup', type: 'pullup', label: 'Pull-ups (Strength/Stamina)', x: ya.x, z: ya.z - 2, room: 'yard', payload: 'strength' });
    this.box(ya.x - 4, ya.z + 3, 2, 0.4, 0.6, 0x5a4a32, true, 0.4); // bench
    this.addInteractable({ id: 'track', type: 'track', label: 'Run the track (Agility)', x: ya.x + 3, z: ya.z + 3, room: 'yard', payload: 'agility' });
    // basketball hoop
    this.cyl(ya.x + 4.5, ya.z - 4.5, 0.15, 3.4, 0x555555, true);
    this.box(ya.x + 4.5, ya.z - 4.5, 1, 0.8, 0.1, 0xdddddd, false, 3);

    // ---- Shower ----
    const sh = ROOM_MAP['shower'];
    for (let i = 0; i < 3; i++) {
      this.box(sh.x - 3 + i * 3, sh.z - 4, 0.3, 2.2, 0.3, 0xaaaab0, true, 1.1); // pipes
    }
    // privacy walls
    this.box(sh.x, sh.z, 0.3, 2, 3, 0x7f8f95, true, 1);
    this.addInteractable({ id: 'shower', type: 'shower', label: 'Shower (mood)', x: sh.x - 3, z: sh.z - 2.5, room: 'shower' });
    const ss = this.box(sh.x + 4, sh.z + 4, 0.7, 0.5, 0.6, 0x7a3a2a, false);
    this.addInteractable({ id: 'stash_shower', type: 'stash', label: 'Loose tile stash', x: sh.x + 4, z: sh.z + 4.6, room: 'shower', mesh: ss });
    this.spawnSteam(sh.x, sh.z - 3);

    // ---- Storage ----
    const st = ROOM_MAP['storage'];
    for (let i = 0; i < 4; i++) {
      this.box(st.x - 3 + (i % 2) * 4, st.z - 3 + Math.floor(i / 2) * 4, 1.4, 1.4, 1.4, 0x6a5a3a, true);
    }
    const sst = this.box(st.x + 3, st.z + 4, 0.8, 0.5, 0.6, 0x7a3a2a, false);
    this.addInteractable({ id: 'stash_storage', type: 'stash', label: 'Contraband stash', x: st.x + 3, z: st.z + 4.6, room: 'storage', mesh: sst });

    // ---- Maintenance ----
    const mt = ROOM_MAP['maintenance'];
    this.box(mt.x - 3, mt.z, 1, 2.2, 1, 0x556055, true); // pipes/boiler
    this.box(mt.x + 3, mt.z - 3, 1, 1.6, 1, 0x4a4a4a, true);
    const mst = this.box(mt.x, mt.z + 4, 0.8, 0.5, 0.6, 0x7a3a2a, false);
    this.addInteractable({ id: 'stash_maint', type: 'stash', label: 'Escape stash spot', x: mt.x, z: mt.z + 4.6, room: 'maintenance', mesh: mst });

    // ---- Visitation ----
    const vi = ROOM_MAP['visitation'];
    this.box(vi.x, vi.z, 5, 1.2, 0.4, 0x6a6a72, true, 0.6); // partition
    for (let i = 0; i < 3; i++) {
      this.box(vi.x - 3 + i * 3, vi.z - 2.5, 0.3, 1.2, 0.3, 0x222222, false, 0.9); // phones
    }
    this.addInteractable({ id: 'phone', type: 'phone', label: 'Use phone (mood)', x: vi.x, z: vi.z - 2, room: 'visitation' });

    // ---- Guard office ----
    const go = ROOM_MAP['guard_office'];
    this.box(go.x, go.z - 3, 3, 0.9, 1.2, 0x3a3a40, true, 0.45); // desk
    this.box(go.x - 1, go.z - 3.6, 0.8, 0.6, 0.1, 0x111122, false, 1.2); // monitor
    this.box(go.x + 3, go.z + 3, 1, 1.6, 0.6, 0x55555a, true); // filing cabinet
    this.box(go.x - 3, go.z + 3, 0.6, 1, 0.2, 0x8a8a3a, false, 1.2); // key rack
    this.addInteractable({ id: 'guard_desk', type: 'desk', label: 'Guard desk (restricted!)', x: go.x, z: go.z - 1.8, room: 'guard_office' });

    // ---- Warden office ----
    const wo = ROOM_MAP['warden_office'];
    this.box(wo.x, wo.z - 3, 3.4, 0.9, 1.4, 0x4a3a2a, true, 0.45);
    this.box(wo.x, wo.z + 3, 2, 1, 0.8, 0x5a4a3a, true);

    // ---- Workshop ----
    const ws = ROOM_MAP['workshop'];
    for (let i = 0; i < 2; i++) this.box(ws.x - 2 + i * 4, ws.z - 2, 2.4, 1, 1, 0x7a6a4a, true, 0.5);
    this.addInteractable({ id: 'workbench', type: 'workbench', label: 'Workshop assembly (job)', x: ws.x - 2, z: ws.z - 0.8, room: 'workshop', payload: 'workshop' });
    this.box(ws.x + 3, ws.z + 3, 1.2, 1.2, 1.2, 0x6a5a3a, true); // box of materials
    this.addInteractable({ id: 'cleanstation', type: 'cleanstation', label: 'Cleaning duty (job)', x: ws.x + 3, z: ws.z + 1.8, room: 'workshop', payload: 'cleaning' });

    // ---- Laundry ----
    const la = ROOM_MAP['laundry'];
    for (let i = 0; i < 3; i++) this.box(la.x - 3 + i * 3, la.z - 3, 1.4, 1.4, 1.2, 0xb0b0b8, true);
    this.addInteractable({ id: 'laundrystation', type: 'laundrystation', label: 'Laundry duty (job)', x: la.x, z: la.z - 1.5, room: 'laundry', payload: 'laundry' });

    // ---- Solitary ----
    const so = ROOM_MAP['solitary'];
    this.box(so.x, so.z, 1.6, 0.3, 0.8, 0x44444a, true, 0.3); // cot

    // ---- Checkpoint / intake ----
    const ck = ROOM_MAP['checkpoint'];
    this.box(ck.x, ck.z, 3, 1, 0.6, 0x55555a, true, 0.5); // scanner desk
    this.box(ck.x - 2, ck.z - 2, 0.6, 2.2, 0.6, 0x33333a, true);
    this.box(ck.x + 2, ck.z - 2, 0.6, 2.2, 0.6, 0x33333a, true);

    // ---- Walkway ----
    const wk = ROOM_MAP['walkway'];
    this.box(wk.x, wk.z - 4, 6, 1, 0.4, 0x44444c, true, 1.4); // raised rail

    // scattered trash / grunge props in hallway and yard
    this.scatterTrash();
  }

  private scatterTrash() {
    const spots: [number, number][] = [
      [-30, 0], [10, 2], [40, -1], [52, 16], [26, -16], [-13, 14]
    ];
    for (const [x, z] of spots) {
      this.box(x, z, 0.4, 0.3, 0.4, 0x3a3a30, false, 0.15);
    }
  }

  private buildLights() {
    const positions: [number, number][] = [
      [-40, 0], [0, 0], [40, 0], [-30, -14], [10, -14], [-30, 14], [10, 14], [52, -14]
    ];
    for (const [x, z] of positions) {
      const pl = new THREE.PointLight(0xfff2cc, 0.5, 30, 1.6);
      pl.position.set(x, 5.5, z);
      this.root.add(pl);
      this.flicker.push(pl);
    }
  }

  private spawnSteam(x: number, z: number) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.25, depthWrite: false }));
      s.position.set(x + (Math.random() - 0.5) * 4, 1 + Math.random() * 2, z + (Math.random() - 0.5) * 2);
      s.scale.setScalar(2 + Math.random() * 2);
      (s as any)._baseY = s.position.y;
      this.root.add(s);
      this.steamPuffs.push(s);
    }
  }

  update(dt: number, time: number, lockdown: boolean) {
    this.updateDoors(dt);
    // flickering lights
    for (let i = 0; i < this.flicker.length; i++) {
      const pl = this.flicker[i];
      const base = lockdown ? 0.2 : 0.5;
      pl.intensity = base + Math.sin(time * 9 + i * 2.3) * 0.06 + (Math.random() < 0.02 ? -0.25 : 0);
      if (lockdown) pl.color.setHex(0xff5544);
      else pl.color.setHex(0xfff2cc);
    }
    // steam drifting
    for (const s of this.steamPuffs) {
      s.position.y += dt * 0.3;
      const mat = s.material as THREE.SpriteMaterial;
      mat.opacity = 0.25 * (1 - (s.position.y - (s as any)._baseY) / 3);
      if (s.position.y > (s as any)._baseY + 3) { s.position.y = (s as any)._baseY; mat.opacity = 0.25; }
    }
  }

  spawnPoint() { return { x: PLAYER_CELL.x, z: PLAYER_CELL.z + 1 }; }
}
