import * as THREE from 'three';
import { TileMap } from '../world/TileMap';
import { Room } from '../world/WorldGen';
import { InteractableDef, ObjType } from '../world/Interactable';

// Dresses rooms with simple-but-readable prison furniture. Visual only (sim ignores it).
// Shared geometries/materials keep draw cost low.
const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0x6b7079, roughness: 0.6, metalness: 0.4 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x3c4047, roughness: 0.6, metalness: 0.5 }),
  mattress: new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.95 }),
  pillow: new THREE.MeshStandardMaterial({ color: 0xcfd2d8, roughness: 1 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.4 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6e5a3c, roughness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x202227, roughness: 0.7 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x10243a, emissive: 0x123b66, emissiveIntensity: 0.7 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.9 }),
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

function bed() { const g = new THREE.Group(); g.add(box(1.1, 0.34, 2.0, M.darkMetal, 0, 0.2, 0)); g.add(box(1.0, 0.2, 1.9, M.mattress, 0, 0.45, 0)); g.add(box(0.9, 0.14, 0.5, M.pillow, 0, 0.56, -0.62)); g.add(box(1.1, 0.5, 0.12, M.darkMetal, 0, 0.45, -0.95)); g.add(box(1.1, 0.35, 0.12, M.darkMetal, 0, 0.35, 0.95)); return g; }
function sink() { const g = new THREE.Group(); g.add(box(0.5, 0.5, 0.35, M.metal, 0, 0.7, 0)); g.add(box(0.46, 0.1, 0.32, M.porcelain, 0, 0.96, 0)); return g; }
function toilet() { const g = new THREE.Group(); g.add(box(0.5, 0.45, 0.6, M.porcelain, 0, 0.22, 0)); g.add(cyl(0.26, 0.18, M.porcelain, 0, 0.5, 0)); g.add(box(0.45, 0.5, 0.12, M.porcelain, 0, 0.55, -0.3)); return g; }
function locker() { const g = new THREE.Group(); g.add(box(0.5, 1.5, 0.45, M.metal, 0, 0.75, 0)); g.add(box(0.5, 0.02, 0.46, M.darkMetal, 0, 0.9, 0)); return g; }
function table() { const g = new THREE.Group(); g.add(box(2.4, 0.12, 0.9, M.steel, 0, 0.7, 0)); g.add(box(0.1, 0.7, 0.8, M.darkMetal, 0, 0.35, 0)); g.add(box(2.4, 0.12, 0.4, M.wood, 0, 0.42, 0.75)); g.add(box(2.4, 0.12, 0.4, M.wood, 0, 0.42, -0.75)); return g; }
function counter() { const g = new THREE.Group(); g.add(box(4, 1, 0.9, M.metal, 0, 0.5, 0)); g.add(box(4, 0.1, 1.0, M.steel, 0, 1.0, 0)); g.add(box(3.6, 0.3, 0.3, M.steel, 0, 1.2, -0.2)); for (let i = 0; i < 4; i++) g.add(tray(-1.4 + i * 0.5, 1.08, 0.2)); return g; }
function tray(x = 0, y = 0, z = 0) { return box(0.4, 0.06, 0.3, new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.5 }), x, y, z); }
function puddle() { const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), new THREE.MeshStandardMaterial({ color: 0x9fcad8, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.5 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.045; return m; }
function chair() { const g = new THREE.Group(); g.add(box(0.45, 0.1, 0.45, M.black, 0, 0.45, 0)); g.add(box(0.45, 0.5, 0.1, M.black, 0, 0.7, -0.18)); return g; }
function vent() { return box(0.7, 0.4, 0.08, M.darkMetal, 0, 0, 0); }
function securityLight() { return box(0.18, 0.18, 0.18, new THREE.MeshStandardMaterial({ color: 0x300, emissive: 0xff3322, emissiveIntensity: 1.6 }), 0, 0, 0); }
function fencePost() { return cyl(0.07, 2.6, M.metal, 0, 1.3, 0); }
function barPartition() { const g = new THREE.Group(); for (let i = -2; i <= 2; i++) g.add(cyl(0.04, 1.8, M.darkMetal, i * 0.28, 0.9, 0)); g.add(box(1.4, 0.08, 0.08, M.darkMetal, 0, 1.8, 0)); return g; }
function cot() { const g = new THREE.Group(); g.add(box(0.9, 0.22, 1.8, M.darkMetal, 0, 0.16, 0)); g.add(box(0.82, 0.12, 1.7, M.mattress, 0, 0.32, 0)); return g; }
function shelf() { const g = new THREE.Group(); g.add(box(1.6, 1.6, 0.5, M.metal, 0, 0.8, 0)); for (let i = 0; i < 3; i++) g.add(box(1.5, 0.05, 0.46, M.darkMetal, 0, 0.4 + i * 0.5, 0)); for (let i = 0; i < 4; i++) g.add(box(0.4, 0.3, 0.4, M.wood, -0.5 + (i % 2), 0.55 + Math.floor(i / 2) * 0.5, 0)); return g; }
function scanner() { const g = new THREE.Group(); for (const x of [-0.6, 0.6]) g.add(box(0.18, 2.0, 0.4, M.steel, x, 1.0, 0)); g.add(box(1.4, 0.2, 0.4, M.steel, 0, 2.0, 0)); g.add(box(1.2, 0.05, 0.4, new THREE.MeshStandardMaterial({ color: 0x113, emissive: 0x2255aa, emissiveIntensity: 0.8 }), 0, 1.9, 0)); return g; }
function trash() { const g = new THREE.Group(); g.add(cyl(0.32, 0.8, M.darkMetal, 0, 0.4, 0)); return g; }
function bench() { return box(2.0, 0.18, 0.5, M.wood, 0, 0.42, 0); }
function weights() { const g = new THREE.Group(); g.add(box(1.6, 0.2, 0.6, M.rubber, 0, 0.4, 0)); g.add(cyl(0.05, 2.0, M.steel, 0, 1.1, -0.5)); for (const x of [-0.85, 0.85]) g.add(cyl(0.35, 0.16, M.black, x, 1.1, -0.5)); return g; }
function pullup() { const g = new THREE.Group(); for (const x of [-1, 1]) g.add(cyl(0.07, 2.4, M.steel, x, 1.2, 0)); g.add(cyl(0.06, 2.0, M.steel, 0, 2.3, 0).rotateZ(Math.PI / 2)); return g; }
function showerHead() { const g = new THREE.Group(); g.add(box(0.16, 0.6, 0.16, M.steel, 0, 1.7, 0)); g.add(cyl(0.12, 0.08, M.steel, 0, 1.45, 0.1)); return g; }
function drain() { const m = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), M.darkMetal); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; return m; }
function desk() { const g = new THREE.Group(); g.add(box(2.2, 0.9, 1.0, M.wood, 0, 0.45, 0)); g.add(box(0.7, 0.5, 0.1, M.screen, -0.5, 1.2, -0.3)); g.add(box(0.7, 0.5, 0.1, M.screen, 0.4, 1.2, -0.3)); return g; }
function cabinet() { return box(0.7, 1.6, 0.6, M.metal, 0, 0.8, 0); }
function ceilingLamp() { return box(1.4, 0.12, 0.4, M.lamp, 0, 3.4, 0); }
function pipe(len: number) { const m = cyl(0.12, len, M.metal); m.rotation.z = Math.PI / 2; m.position.y = 3.0; return m; }
function sign(color: number) { return box(0.06, 0.5, 0.7, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 }), 0, 2.2, 0); }
function dirtPatch() { const m = new THREE.Mesh(new THREE.CircleGeometry(1.0, 10), new THREE.MeshStandardMaterial({ color: 0x3a3322, roughness: 1, transparent: true, opacity: 0.6 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.045; return m; }

export function dressRooms(scene: THREE.Scene, map: TileMap, rooms: Room[]) {
  const root = new THREE.Group();
  const W = map.width, H = map.height;
  const place = (g: THREE.Object3D, x: number, z: number, rotY = 0) => { g.position.x = x; g.position.z = z; g.rotation.y = rotY; root.add(g); };

  // interactable registration: builds a def + an invisible, finger-friendly hitbox
  const interactables: InteractableDef[] = [];
  const hitMeshes: THREE.Object3D[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hitGeo = new THREE.BoxGeometry(1.2, 2, 1.2);
  let oid = 0;
  const reg = (type: ObjType, name: string, x: number, z: number, r: Room, jobRoom?: string) => {
    const cx = r.x + r.w / 2 - W / 2, cz = r.y + r.h / 2 - H / 2;
    let ix = x, iz = z; const t = map.worldToTile(x, z);
    if (!map.isWalkable(t.x, t.y)) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]]) {
        if (map.isWalkable(t.x + dx, t.y + dy)) { const w = map.toWorld(t.x + dx, t.y + dy); ix = w.x; iz = w.z; break; }
      }
    }
    let facing = Math.atan2(x - ix, z - iz); if (!isFinite(facing) || (x === ix && z === iz)) facing = Math.atan2(cx - ix, cz - iz);
    const id = 'obj' + (oid++);
    interactables.push({ id, type, name, room: r.id, x, z, ix, iz, facing, restricted: r.security >= 3, jobRoom });
    const hb = new THREE.Mesh(hitGeo, hitMat); hb.position.set(x, 1, z); hb.userData.objId = id; root.add(hb); hitMeshes.push(hb);
  };

  for (const r of rooms) {
    const minX = r.x - W / 2, maxX = r.x + r.w - W / 2;
    const minZ = r.y - H / 2, maxZ = r.y + r.h - H / 2;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;

    switch (r.type) {
      case 'cellblock': {
        // a wing of repeated cells along both walls, separated by bars (reads as a cell block)
        const cols = Math.max(3, Math.floor((r.w - 2) / 3.2));
        for (let i = 0; i < cols; i++) {
          const x = minX + 2 + i * 3.2;
          place(bed(), x, minZ + 1.5); reg('bed', 'Bunk', x, minZ + 1.5, r);
          place(toilet(), x + 1.1, minZ + 1.2, Math.PI); reg('toilet', 'Toilet', x + 1.1, minZ + 1.2, r);
          place(sink(), x + 1.1, minZ + 2.2, Math.PI); reg('sink', 'Sink', x + 1.1, minZ + 2.2, r);
          if (i > 0) place(barPartition(), x - 1.6, minZ + 1.6, Math.PI / 2);
          // bottom row cell
          place(bed(), x, maxZ - 1.5, Math.PI); reg('bed', 'Bunk', x, maxZ - 1.5, r);
          place(toilet(), x + 1.1, maxZ - 1.2); reg('toilet', 'Toilet', x + 1.1, maxZ - 1.2, r);
          place(locker(), x - 1.1, maxZ - 1.4); reg('locker', 'Locker', x - 1.1, maxZ - 1.4, r);
          if (i > 0) place(barPartition(), x - 1.6, maxZ - 1.6, Math.PI / 2);
        }
        break;
      }
      case 'intake': {
        place(scanner(), cx, minZ + 1.6);
        place(desk(), cx, maxZ - 1.4, Math.PI); reg('desk', 'Intake Desk', cx, maxZ - 1.4, r);
        break;
      }
      case 'storage': {
        place(shelf(), minX + 1.2, cz, Math.PI / 2); reg('shelf', 'Supply Shelf', minX + 1.2, cz, r, 'storage');
        place(shelf(), maxX - 1.2, cz, -Math.PI / 2); reg('shelf', 'Supply Shelf', maxX - 1.2, cz, r, 'storage');
        break;
      }
      case 'solitary': {
        const cells = Math.max(2, Math.floor(r.h / 3));
        for (let i = 0; i < cells; i++) { place(cot(), cx, minZ + 1.5 + i * 2.6); place(barPartition(), cx, minZ + 0.4 + i * 2.6, 0); }
        break;
      }
      case 'cafeteria': {
        place(counter(), cx, minZ + 1.2); reg('counter', 'Serving Counter', cx, minZ + 2.0, r, 'cafeteria');
        for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) { const tx = minX + 3 + i * 4.2, tz = cz + 0.3 + row * 2.6; place(table(), tx, tz); place(tray(0, 0.78, 0), tx - 0.5, tz); place(tray(0, 0.78, 0), tx + 0.5, tz - 0.2); reg('table', 'Dining Table', tx, tz, r); }
        place(trash(), maxX - 1, maxZ - 1); reg('trash', 'Trash Can', maxX - 1, maxZ - 1, r);
        place(trash(), minX + 1, maxZ - 1);
        break;
      }
      case 'yard': {
        place(bench(), minX + 3, minZ + 1.5); place(bench(), minX + 3, maxZ - 1.5); place(bench(), maxX - 4, cz);
        place(weights(), cx + 2, cz); reg('weights', 'Weight Bench', cx + 2, cz, r);
        place(weights(), cx + 2, cz + 2.2); reg('weights', 'Weight Bench', cx + 2, cz + 2.2, r);
        place(pullup(), maxX - 3, minZ + 2); reg('pullup', 'Pull-up Bar', maxX - 3, minZ + 2, r);
        place(dirtPatch(), cx - 2, cz + 1); reg('job', 'Yard Cleanup', cx - 2, cz + 1, r, 'yard');
        place(dirtPatch(), cx + 3, maxZ - 2); place(dirtPatch(), minX + 4, maxZ - 3);
        for (let x = minX + 1; x <= maxX - 1; x += 3) place(fencePost(), x, maxZ - 0.4);
        break;
      }
      case 'shower': {
        for (let i = 0; i < 4; i++) { place(showerHead(), minX + 1.2, minZ + 1.2 + i * 1.2, Math.PI / 2); reg('shower', 'Shower', minX + 2, minZ + 1.2 + i * 1.2, r); place(drain(), minX + 3, minZ + 1.2 + i * 1.2); }
        place(puddle(), minX + 3, minZ + 2); reg('job', 'Mop the floor', cx, cz, r, 'shower');
        place(puddle(), minX + 2.4, maxZ - 2); place(puddle(), cx, cz);
        break;
      }
      case 'guardroom': {
        place(desk(), cx, minZ + 1.4); reg('desk', 'Security Console', cx, minZ + 2.2, r);
        place(chair(), cx, minZ + 2.6);
        place(cabinet(), maxX - 1, maxZ - 1); place(cabinet(), maxX - 1.8, maxZ - 1);
        place(securityLight(), minX + 0.6, minZ + 0.6); (root.children[root.children.length - 1] as THREE.Object3D).position.y = 2.6;
        break;
      }
      case 'hallway': {
        for (let x = minX + 4; x < maxX - 2; x += 6) place(ceilingLamp(), x, cz);
        place(pipe(r.w - 6), cx, maxZ - 0.4); place(pipe(r.w - 6), cx, minZ + 0.4);
        for (let x = minX + 6; x < maxX - 4; x += 12) { place(vent(), x, minZ + 0.3); }
        place(sign(0xd8a72c), minX + 6, minZ + 0.4); place(sign(0x3a7fd8), maxX - 8, maxZ - 0.4);
        break;
      }
    }
  }
  scene.add(root);
  return { root, interactables, hitMeshes };
}
