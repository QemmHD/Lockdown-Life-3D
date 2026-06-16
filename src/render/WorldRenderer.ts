import * as THREE from 'three';
import { TileMap } from '../world/TileMap';
import { Room, wallTiles } from '../world/WorldGen';

// Builds static prison geometry (floors + instanced walls) once from the tilemap.
export function buildPrison(scene: THREE.Scene, map: TileMap, rooms: Room[]) {
  const root = new THREE.Group();

  // base floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width, map.height),
    new THREE.MeshStandardMaterial({ color: 0x2c2e34, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // colored room floors
  for (const r of rooms) {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(r.w - 0.1, r.h - 0.1),
      new THREE.MeshStandardMaterial({ color: r.color, roughness: 0.9, transparent: true, opacity: 0.8 })
    );
    g.rotation.x = -Math.PI / 2;
    const cx = r.x + r.w / 2 - map.width / 2;
    const cz = r.y + r.h / 2 - map.height / 2;
    g.position.set(cx, 0.02, cz);
    g.receiveShadow = true;
    root.add(g);
  }

  // walls (instanced)
  const walls = wallTiles(map);
  const wallH = 2.2;
  const geo = new THREE.BoxGeometry(1, wallH, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6a74, roughness: 0.85, flatShading: true });
  const inst = new THREE.InstancedMesh(geo, mat, walls.length);
  inst.castShadow = true; inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  walls.forEach((k, i) => {
    const t = map.tileXY(k);
    const w = map.toWorld(t.x, t.y);
    m.makeTranslation(w.x, wallH / 2, w.z);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  root.add(inst);

  scene.add(root);
  return root;
}
