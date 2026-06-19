import * as THREE from 'three';
import { TileMap } from '../world/TileMap';
import { Room, Cell } from '../world/WorldGen';
import { InteractableDef, ObjType } from '../world/Interactable';
import { glowSprite } from './Glow';

// Dresses rooms with simple-but-readable prison furniture. Blocking props (bunks, counter,
// desks, shelves, lockers, gym gear) register a tile footprint so the sim's pathfinding treats
// them as solid; small decals (trash, trays, puddles, signs) never block. Shared geometries /
// materials keep draw cost low.
const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0x6b7079, roughness: 0.6, metalness: 0.4 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x3c4047, roughness: 0.6, metalness: 0.5 }),
  bars: new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.5, metalness: 0.6 }),
  mattress: new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.95 }),
  blanket: new THREE.MeshStandardMaterial({ color: 0x5b6168, roughness: 1 }),
  pillow: new THREE.MeshStandardMaterial({ color: 0xcfd2d8, roughness: 1 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.4 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6e5a3c, roughness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x202227, roughness: 0.7 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x10243a, emissive: 0x123b66, emissiveIntensity: 0.7 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.9 }),
  food: new THREE.MeshStandardMaterial({ color: 0xcdb074, roughness: 0.8 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0x2a2a22, emissive: 0xffe8b0, emissiveIntensity: 1.4 })
};

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
  m.position.set(x, y, z); m.castShadow = true; return m;
}

function bunk() { const g = new THREE.Group(); g.add(box(0.92, 0.34, 1.9, M.darkMetal, 0, 0.2, 0)); g.add(box(0.84, 0.18, 1.8, M.mattress, 0, 0.45, 0)); g.add(box(0.84, 0.1, 1.0, M.blanket, 0, 0.5, 0.35)); g.add(box(0.74, 0.13, 0.42, M.pillow, 0, 0.56, -0.62)); g.add(box(0.92, 0.46, 0.1, M.darkMetal, 0, 0.4, -0.92)); return g; }
function sink() { const g = new THREE.Group(); g.add(box(0.5, 0.5, 0.35, M.metal, 0, 0.7, 0)); g.add(box(0.46, 0.1, 0.32, M.porcelain, 0, 0.96, 0)); g.add(cyl(0.03, 0.16, M.steel, 0, 1.06, -0.05)); return g; }
function toilet() { const g = new THREE.Group(); g.add(box(0.5, 0.45, 0.6, M.porcelain, 0, 0.22, 0)); g.add(cyl(0.26, 0.18, M.porcelain, 0, 0.5, 0)); g.add(box(0.45, 0.5, 0.12, M.porcelain, 0, 0.55, -0.3)); return g; }
function locker() { const g = new THREE.Group(); g.add(box(0.5, 1.5, 0.45, M.metal, 0, 0.75, 0)); g.add(box(0.5, 0.02, 0.46, M.darkMetal, 0, 0.9, 0)); g.add(box(0.04, 0.1, 0.04, M.steel, 0.18, 0.78, 0.24)); return g; }
function table() { const g = new THREE.Group(); g.add(box(2.4, 0.12, 0.9, M.steel, 0, 0.7, 0)); g.add(box(0.1, 0.7, 0.8, M.darkMetal, 0, 0.35, 0)); g.add(box(2.4, 0.12, 0.4, M.wood, 0, 0.42, 0.75)); g.add(box(2.4, 0.12, 0.4, M.wood, 0, 0.42, -0.75)); return g; }
// long serving counter: a solid base + steel top + sneeze-guard + a warming well of trays/food
function counterRun(len: number) { const g = new THREE.Group(); g.add(box(len, 1.0, 0.9, M.metal, 0, 0.5, 0)); g.add(box(len, 0.1, 1.0, M.steel, 0, 1.02, 0)); g.add(box(len - 0.4, 0.32, 0.34, M.steel, 0, 1.22, -0.18)); for (let i = 0; i * 0.7 < len - 0.7; i++) g.add(box(0.5, 0.08, 0.34, M.food, -len / 2 + 0.6 + i * 0.7, 1.12, 0.05)); for (let i = 0; i * 1.1 < len; i++) g.add(tray(-len / 2 + 0.6 + i * 1.1, 1.1, 0.32)); return g; }
function tray(x = 0, y = 0, z = 0) { return box(0.4, 0.06, 0.3, M.steel, x, y, z); }
function puddle() { const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), new THREE.MeshStandardMaterial({ color: 0x9fcad8, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.5 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.045; return m; }
function chair() { const g = new THREE.Group(); g.add(box(0.45, 0.1, 0.45, M.black, 0, 0.45, 0)); g.add(box(0.45, 0.5, 0.1, M.black, 0, 0.7, -0.18)); return g; }
function vent() { return box(0.7, 0.4, 0.08, M.darkMetal, 0, 0, 0); }
function securityLight() { const g = new THREE.Group(); g.add(box(0.18, 0.18, 0.18, new THREE.MeshStandardMaterial({ color: 0x300, emissive: 0xff3322, emissiveIntensity: 1.6 }), 0, 0, 0)); g.add(glowSprite(0xff3322, 1.1, 0.85)); return g; }
function fencePost() { return cyl(0.07, 2.6, M.metal, 0, 1.3, 0); }
// a run of vertical bars spanning `len` world units along X (cell fronts / partitions)
function barRun(len: number, h = 1.95) { const g = new THREE.Group(); const n = Math.max(2, Math.round(len / 0.26)); for (let i = 0; i <= n; i++) g.add(cyl(0.04, h, M.bars, -len / 2 + (i / n) * len, h / 2, 0)); g.add(box(len, 0.08, 0.08, M.bars, 0, h, 0)); g.add(box(len, 0.08, 0.08, M.bars, 0, 0.2, 0)); return g; }
function cot() { const g = new THREE.Group(); g.add(box(0.9, 0.22, 1.8, M.darkMetal, 0, 0.16, 0)); g.add(box(0.82, 0.12, 1.7, M.mattress, 0, 0.32, 0)); return g; }
function shelf() { const g = new THREE.Group(); g.add(box(1.6, 1.6, 0.5, M.metal, 0, 0.8, 0)); for (let i = 0; i < 3; i++) g.add(box(1.5, 0.05, 0.46, M.darkMetal, 0, 0.4 + i * 0.5, 0)); for (let i = 0; i < 4; i++) g.add(box(0.4, 0.3, 0.4, M.wood, -0.5 + (i % 2), 0.55 + Math.floor(i / 2) * 0.5, 0)); return g; }
function scanner() { const g = new THREE.Group(); for (const x of [-0.6, 0.6]) g.add(box(0.18, 2.0, 0.4, M.steel, x, 1.0, 0)); g.add(box(1.4, 0.2, 0.4, M.steel, 0, 2.0, 0)); g.add(box(1.2, 0.05, 0.4, new THREE.MeshStandardMaterial({ color: 0x113, emissive: 0x2255aa, emissiveIntensity: 0.8 }), 0, 1.9, 0)); const h = glowSprite(0x2a6bd8, 1.0, 0.45); h.position.set(0, 1.9, 0); g.add(h); return g; }
function trash() { const g = new THREE.Group(); g.add(cyl(0.32, 0.8, M.darkMetal, 0, 0.4, 0)); return g; }
function bench() { return box(2.0, 0.18, 0.5, M.wood, 0, 0.42, 0); }
function weights() { const g = new THREE.Group(); g.add(box(1.6, 0.2, 0.6, M.rubber, 0, 0.4, 0)); g.add(cyl(0.05, 2.0, M.steel, 0, 1.1, -0.5)); for (const x of [-0.85, 0.85]) g.add(cyl(0.35, 0.16, M.black, x, 1.1, -0.5)); return g; }
function pullup() { const g = new THREE.Group(); for (const x of [-1, 1]) g.add(cyl(0.07, 2.4, M.steel, x, 1.2, 0)); g.add(cyl(0.06, 2.0, M.steel, 0, 2.3, 0).rotateZ(Math.PI / 2)); return g; }
function showerHead() { const g = new THREE.Group(); g.add(box(0.16, 0.6, 0.16, M.steel, 0, 1.7, 0)); g.add(cyl(0.12, 0.08, M.steel, 0, 1.45, 0.1)); return g; }
function drain() { const m = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), M.darkMetal); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; return m; }
function desk() { const g = new THREE.Group(); g.add(box(2.2, 0.9, 1.0, M.wood, 0, 0.45, 0)); g.add(box(0.7, 0.5, 0.1, M.screen, -0.5, 1.2, -0.3)); g.add(box(0.7, 0.5, 0.1, M.screen, 0.4, 1.2, -0.3)); return g; }
function cabinet() { return box(0.7, 1.6, 0.6, M.metal, 0, 0.8, 0); }
function ceilingLamp() { const g = new THREE.Group(); g.add(box(1.4, 0.12, 0.4, M.lamp, 0, 3.4, 0)); const h = glowSprite(0xffe8b0, 2.6, 0.5); h.position.set(0, 3.05, 0); g.add(h); return g; }
function pipe(len: number) { const m = cyl(0.12, len, M.metal); m.rotation.z = Math.PI / 2; m.position.y = 3.0; return m; }
function sign(color: number) { const g = new THREE.Group(); g.add(box(0.06, 0.5, 0.7, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 }), 0, 2.2, 0)); const h = glowSprite(color, 1.1, 0.45); h.position.set(0, 2.2, 0.15); g.add(h); return g; }
function dirtPatch() { const m = new THREE.Mesh(new THREE.CircleGeometry(1.0, 10), new THREE.MeshStandardMaterial({ color: 0x3a3322, roughness: 1, transparent: true, opacity: 0.6 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.045; return m; }

export function dressRooms(scene: THREE.Scene, map: TileMap, rooms: Room[], cells: Cell[]) {
  const root = new THREE.Group();
  const W = map.width, H = map.height;
  const place = (g: THREE.Object3D, x: number, z: number, rotY = 0) => { g.position.x = x; g.position.z = z; g.rotation.y = rotY; root.add(g); };
  const tw = (tx: number, ty: number) => map.toWorld(tx, ty);

  // interactable registration: builds a def + an invisible, finger-friendly hitbox. Blocking props
  // pass a tile footprint; the interaction tile is chosen on an adjacent pathable, non-footprint tile.
  const interactables: InteractableDef[] = [];
  const hitMeshes: THREE.Object3D[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hitGeo = new THREE.BoxGeometry(1.2, 2, 1.2);
  let oid = 0;
  type Opts = { jobRoom?: string; foot?: number[]; stand?: { x: number; z: number }; restricted?: boolean };
  const reg = (type: ObjType, name: string, x: number, z: number, r: Room, opts: Opts = {}) => {
    const foot = opts.foot ?? [(() => { const t = map.worldToTile(x, z); return map.inBounds(t.x, t.y) ? map.idx(t.x, t.y) : -1; })()].filter((k) => k >= 0);
    // choose where the user stands: explicit stand, else nearest adjacent pathable tile not in the footprint
    let ix = x, iz = z;
    if (opts.stand && map.isPathable(map.worldToTile(opts.stand.x, opts.stand.z).x, map.worldToTile(opts.stand.x, opts.stand.z).y)) { ix = opts.stand.x; iz = opts.stand.z; }
    else {
      const t = map.worldToTile(x, z); let found = false;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = t.x + dx, ny = t.y + dy; if (!map.inBounds(nx, ny)) continue;
        const k = map.idx(nx, ny); if (foot.includes(k)) continue;
        if (map.isPathable(nx, ny)) { const w = tw(nx, ny); ix = w.x; iz = w.z; found = true; break; }
      }
      if (!found) { const w = tw(t.x, t.y); ix = w.x; iz = w.z; }
    }
    const cx = r.x + r.w / 2 - W / 2, cz = r.y + r.h / 2 - H / 2;
    let facing = Math.atan2(x - ix, z - iz); if (!isFinite(facing) || (x === ix && z === iz)) facing = Math.atan2(cx - ix, cz - iz);
    const id = 'obj' + (oid++);
    interactables.push({ id, type, name, room: r.id, x, z, ix, iz, facing, restricted: opts.restricted ?? r.security >= 3, jobRoom: opts.jobRoom, footprint: opts.foot });
    if (opts.foot) for (const k of opts.foot) map.blocked[k] = 1;   // reserve in-pass so neighbours avoid it
    const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.set(x, 1, z); hb.userData.objId = id; root.add(hb); hitMeshes.push(hb);
  };
  const footAt = (tx: number, ty: number) => (map.inBounds(tx, ty) ? [map.idx(tx, ty)] : []);

  // ---- cells (individual): bunk + toilet + sink, with bars across each barred front ----
  for (const c of cells) {
    const bunkW = tw(c.bunk.x, c.bunk.y), toiletW = tw(c.toilet.x, c.toilet.y), sinkW = tw(c.sink.x, c.sink.y), standW = map.toWorld(c.stand % W, Math.floor(c.stand / W));
    const room = rooms.find((r) => r.id === c.room)!;
    place(bunk(), bunkW.x, bunkW.z, c.facing); reg('bed', 'Bunk', bunkW.x, bunkW.z, room, { foot: footAt(c.bunk.x, c.bunk.y), stand: standW });
    place(toilet(), toiletW.x, toiletW.z, c.facing); reg('toilet', 'Toilet', toiletW.x, toiletW.z, room, { foot: footAt(c.toilet.x, c.toilet.y), stand: standW });
    place(sink(), sinkW.x, sinkW.z, c.facing + Math.PI / 2); reg('sink', 'Sink', sinkW.x, sinkW.z, room, { foot: footAt(c.sink.x, c.sink.y), stand: standW });
    // static bars across the barred front (the openable gate leaf is owned by Game.buildDoorObjects)
    for (const k of c.gateTiles) { const t = map.tileXY(k); const w = tw(t.x, t.y); place(barRun(1.0), w.x, w.z, 0); }
  }

  for (const r of rooms) {
    const minX = r.x - W / 2, maxX = r.x + r.w - W / 2;
    const minZ = r.y - H / 2, maxZ = r.y + r.h - H / 2;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;

    switch (r.type) {
      case 'cellblock': break;   // furnished per-cell above
      case 'intake': {
        place(scanner(), cx, minZ + 1.6); for (const dx of [-1, 0, 1]) { const t = map.worldToTile(cx + dx, minZ + 1.6); if (map.isWalkable(t.x, t.y)) map.blocked[map.idx(t.x, t.y)] = 0; }
        place(desk(), cx, maxZ - 1.4, Math.PI); reg('desk', 'Intake Desk', cx, maxZ - 1.4, r, { foot: footAt(map.worldToTile(cx, maxZ - 1.4).x, map.worldToTile(cx, maxZ - 1.4).y) });
        break;
      }
      case 'storage': {
        place(shelf(), minX + 1.2, cz, Math.PI / 2); reg('shelf', 'Supply Shelf', minX + 1.2, cz, r, { jobRoom: 'storage', foot: footAt(map.worldToTile(minX + 1.2, cz).x, map.worldToTile(minX + 1.2, cz).y) });
        place(shelf(), maxX - 1.2, cz, -Math.PI / 2); reg('shelf', 'Supply Shelf', maxX - 1.2, cz, r, { jobRoom: 'storage', foot: footAt(map.worldToTile(maxX - 1.2, cz).x, map.worldToTile(maxX - 1.2, cz).y) });
        break;
      }
      case 'solitary': {
        const cellsN = Math.max(2, Math.floor(r.h / 3));
        for (let i = 0; i < cellsN; i++) { place(cot(), cx, minZ + 1.5 + i * 2.6); place(barRun(1.6), cx, minZ + 0.4 + i * 2.6, 0); }
        break;
      }
      case 'cafeteria': {
        // dining on the entry (north) side; a long serving counter is a real barrier; the kitchen
        // sits behind it, reachable only through a staff gap at the west end.
        const counterRow = r.y + r.h - 3;                       // tile row of the counter
        const gapCol = r.x + 1;                                 // staff gap (kitchen access)
        const cFoot: number[] = [];
        for (let x = r.x + 2; x < r.x + r.w - 1; x++) cFoot.push(map.idx(x, counterRow));
        const cwL = tw(r.x + 2, counterRow), cwR = tw(r.x + r.w - 2, counterRow);
        place(counterRun(cwR.x - cwL.x + 1), (cwL.x + cwR.x) / 2, cwL.z);
        // serve from the dining (north) side
        reg('counter', 'Serving Counter', (cwL.x + cwR.x) / 2, cwL.z, r, { foot: cFoot, stand: tw(r.x + Math.floor(r.w / 2), counterRow - 1) });
        // dining tables on the entry side
        for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) { const tx = minX + 3.5 + i * 4.5, tz = minZ + 1.4 + row * 2.2; place(table(), tx, tz); place(tray(0, 0.78, 0), tx - 0.5, tz); place(tray(0, 0.78, 0), tx + 0.5, tz - 0.2); reg('table', 'Dining Table', tx, tz, r); }
        // kitchen prep job behind the counter (only workers path through the staff gap)
        const kw = tw(gapCol + 2, counterRow + 1); place(shelf(), kw.x, kw.z, 0); reg('job', 'Kitchen Duty', kw.x, kw.z, r, { jobRoom: 'cafeteria', foot: footAt(gapCol + 2, counterRow + 1), stand: tw(gapCol, counterRow + 1) });
        place(trash(), maxX - 1, minZ + 1); reg('trash', 'Trash Can', maxX - 1, minZ + 1, r);
        break;
      }
      case 'yard': {
        place(bench(), minX + 3, minZ + 1.5); place(bench(), minX + 3, maxZ - 1.5); place(bench(), maxX - 4, cz);
        place(weights(), cx + 2, cz); reg('weights', 'Weight Bench', cx + 2, cz, r, { foot: footAt(map.worldToTile(cx + 2, cz).x, map.worldToTile(cx + 2, cz).y) });
        place(weights(), cx + 2, cz + 2.2); reg('weights', 'Weight Bench', cx + 2, cz + 2.2, r, { foot: footAt(map.worldToTile(cx + 2, cz + 2.2).x, map.worldToTile(cx + 2, cz + 2.2).y) });
        place(pullup(), maxX - 3, minZ + 2); reg('pullup', 'Pull-up Bar', maxX - 3, minZ + 2, r, { foot: footAt(map.worldToTile(maxX - 3, minZ + 2).x, map.worldToTile(maxX - 3, minZ + 2).y) });
        place(dirtPatch(), cx - 3, cz + 1); reg('job', 'Yard Cleanup', cx - 3, cz + 1, r, { jobRoom: 'yard' });
        place(dirtPatch(), cx + 3, maxZ - 2); place(dirtPatch(), minX + 4, maxZ - 3);
        for (let x = minX + 1; x <= maxX - 1; x += 3) place(fencePost(), x, maxZ - 0.4);
        break;
      }
      case 'shower': {
        for (let i = 0; i < 4; i++) { place(showerHead(), minX + 1.2, minZ + 1.2 + i * 1.2, Math.PI / 2); reg('shower', 'Shower', minX + 2, minZ + 1.2 + i * 1.2, r); place(drain(), minX + 3, minZ + 1.2 + i * 1.2); }
        place(puddle(), minX + 3, minZ + 2); reg('job', 'Mop the floor', cx, cz, r, { jobRoom: 'shower' });
        place(puddle(), minX + 2.4, maxZ - 2); place(puddle(), cx, cz);
        break;
      }
      case 'guardroom': {
        place(desk(), cx, minZ + 1.4); reg('desk', 'Security Console', cx, minZ + 1.4, r, { foot: footAt(map.worldToTile(cx, minZ + 1.4).x, map.worldToTile(cx, minZ + 1.4).y) });
        place(chair(), cx, minZ + 2.6);
        place(cabinet(), maxX - 1, maxZ - 1); place(cabinet(), maxX - 1.8, maxZ - 1);
        const sl = securityLight(); place(sl, minX + 0.6, minZ + 0.6); sl.position.y = 2.6;
        break;
      }
      case 'hallway': {
        for (let x = minX + 4; x < maxX - 2; x += 6) place(ceilingLamp(), x, cz);
        if (r.w > 8) { place(pipe(r.w - 6), cx, maxZ - 0.4); place(pipe(r.w - 6), cx, minZ + 0.4); }
        for (let x = minX + 6; x < maxX - 4; x += 12) place(vent(), x, minZ + 0.3);
        place(sign(0xd8a72c), minX + 6, minZ + 0.4); place(sign(0x3a7fd8), maxX - 8, maxZ - 0.4);
        break;
      }
    }
  }
  scene.add(root);
  return { root, interactables, hitMeshes };
}
