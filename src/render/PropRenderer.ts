import * as THREE from 'three';
import { TileMap } from '../world/TileMap';
import { Room } from '../world/WorldGen';

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

  for (const r of rooms) {
    const minX = r.x - W / 2, maxX = r.x + r.w - W / 2;
    const minZ = r.y - H / 2, maxZ = r.y + r.h - H / 2;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;

    switch (r.type) {
      case 'cellblock': {
        const cols = Math.min(5, Math.floor(r.w / 3));
        for (let i = 0; i < cols; i++) {
          const x = minX + 2 + i * 3;
          place(bed(), x, minZ + 1.6);
          place(toilet(), x + 1.0, minZ + 3.4, Math.PI);
          place(sink(), x - 0.2, minZ + 3.6, Math.PI);
          place(locker(), x - 1.1, minZ + 3.4);
        }
        break;
      }
      case 'cafeteria': {
        place(counter(), cx, minZ + 1.2);
        for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) { const tx = minX + 3 + i * 4.2, tz = cz + 0.3 + row * 2.6; place(table(), tx, tz); place(tray(0, 0.78, 0), tx - 0.5, tz); place(tray(0, 0.78, 0), tx + 0.5, tz - 0.2); }
        place(trash(), maxX - 1, maxZ - 1); place(trash(), minX + 1, maxZ - 1);
        break;
      }
      case 'yard': {
        place(bench(), minX + 3, minZ + 1.5); place(bench(), minX + 3, maxZ - 1.5); place(bench(), maxX - 4, cz);
        place(weights(), cx + 2, cz); place(weights(), cx + 2, cz + 2.2);
        place(pullup(), maxX - 3, minZ + 2);
        place(dirtPatch(), cx - 2, cz + 1); place(dirtPatch(), cx + 3, maxZ - 2); place(dirtPatch(), minX + 4, maxZ - 3);
        for (let x = minX + 1; x <= maxX - 1; x += 3) place(fencePost(), x, maxZ - 0.4);
        break;
      }
      case 'shower': {
        for (let i = 0; i < 4; i++) { place(showerHead(), minX + 1.2, minZ + 1.2 + i * 1.2, Math.PI / 2); place(drain(), minX + 3, minZ + 1.2 + i * 1.2); }
        place(puddle(), minX + 3, minZ + 2); place(puddle(), minX + 2.4, maxZ - 2); place(puddle(), cx, cz);
        break;
      }
      case 'guardroom': {
        place(desk(), cx, minZ + 1.4);
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
  return root;
}
