import * as THREE from 'three';
import { TileMap } from '../world/TileMap';
import { Room, wallTiles } from '../world/WorldGen';
import { THEME, hex } from './VisualTheme';
import { createConcreteTexture } from './textures/createConcreteTexture';
import { createTileTexture } from './textures/createTileTexture';
import { createGrimeTexture } from './textures/createGrimeTexture';
import { createWarningStripeTexture } from './textures/createWarningStripeTexture';

const WALL_H = 2.0;

// Builds static prison geometry (floors, layered walls, doors) + moody room lights.
export function buildPrison(scene: THREE.Scene, map: TileMap, rooms: Room[]) {
  const root = new THREE.Group();
  const grime = createGrimeTexture();
  const concrete = createConcreteTexture('#8a8d95', 5);

  // base concrete floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width, map.height),
    new THREE.MeshStandardMaterial({ map: concrete, color: THEME.floor.base, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);

  // per-room floors with type-specific texture + grime overlay
  for (const r of rooms) {
    const rt = THEME.rooms[r.type] ?? THEME.rooms.hallway;
    const wet = r.type === 'shower';
    const tiled = r.type === 'shower' || r.type === 'cellblock' || r.type === 'guardroom';
    const tex = tiled ? createTileTexture(hex(rt.floor), '#22262b', r.type === 'shower' ? 10 : 6, wet) : createConcreteTexture(hex(rt.floor), 4);
    const cx = r.x + r.w / 2 - map.width / 2, cz = r.y + r.h / 2 - map.height / 2;

    const g = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.1, r.h - 0.1),
      new THREE.MeshStandardMaterial({ map: tex, roughness: wet ? 0.5 : 0.95, metalness: wet ? 0.2 : 0 }));
    g.rotation.x = -Math.PI / 2; g.position.set(cx, 0.02, cz); g.receiveShadow = true; root.add(g);

    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.1, r.h - 0.1),
      new THREE.MeshStandardMaterial({ map: grime, transparent: true, opacity: r.type === 'yard' ? 0.7 : 0.45, depthWrite: false }));
    dirt.rotation.x = -Math.PI / 2; dirt.position.set(cx, 0.03, cz); root.add(dirt);

    // moody room light
    if (rt.lightI > 0) {
      const pl = new THREE.PointLight(rt.light, rt.lightI * 1.6, Math.max(r.w, r.h) * 1.4, 1.4);
      pl.position.set(cx, 3.2, cz); root.add(pl);
    }
  }

  // ---- layered walls (body + lighter top cap), instanced ----
  const walls = wallTiles(map);
  const bodyGeo = new THREE.BoxGeometry(1, WALL_H, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ map: createConcreteTexture('#5a5d66', 1), color: THEME.walls.side, roughness: 0.95, flatShading: true });
  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, walls.length);
  body.castShadow = true; body.receiveShadow = true;
  const capGeo = new THREE.BoxGeometry(1.04, 0.18, 1.04);
  const capMat = new THREE.MeshStandardMaterial({ color: THEME.walls.top, roughness: 0.8 });
  const cap = new THREE.InstancedMesh(capGeo, capMat, walls.length);
  cap.castShadow = true;
  const m = new THREE.Matrix4();
  walls.forEach((k, i) => {
    const t = map.tileXY(k), w = map.toWorld(t.x, t.y);
    body.setMatrixAt(i, m.makeTranslation(w.x, WALL_H / 2, w.z));
    cap.setMatrixAt(i, m.makeTranslation(w.x, WALL_H + 0.05, w.z));
  });
  body.instanceMatrix.needsUpdate = true; cap.instanceMatrix.needsUpdate = true;
  root.add(body, cap);

  // ---- doors: metal frame + bars, warning stripes for restricted rooms ----
  const stripeTex = createWarningStripeTexture();
  for (const r of rooms) {
    if (r.door == null) continue;
    const t = map.tileXY(r.door); const w = map.toWorld(t.x, t.y);
    buildDoor(root, w.x, w.z, r.security >= 3);
    if (r.security >= 3) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2),
        new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.9 }));
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(w.x, 0.05, w.z); root.add(stripe);
    }
  }

  scene.add(root);
  return root;
}

function buildDoor(root: THREE.Group, x: number, z: number, restricted: boolean) {
  const frameMat = new THREE.MeshStandardMaterial({ color: THEME.walls.frame, roughness: 0.7, metalness: 0.3 });
  const barMat = new THREE.MeshStandardMaterial({ color: THEME.walls.bars, roughness: 0.5, metalness: 0.6 });
  const g = new THREE.Group(); g.position.set(x, 0, z);
  // posts + lintel (oriented along X — layout doors all face the hallway on z)
  for (const px of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, WALL_H, 0.3), frameMat);
    post.position.set(px, WALL_H / 2, 0); post.castShadow = true; g.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.3), frameMat);
  lintel.position.set(0, WALL_H - 0.1, 0); g.add(lintel);
  // vertical bars
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, WALL_H - 0.2, 6), barMat);
    bar.position.set(i * 0.2, (WALL_H - 0.2) / 2, 0); g.add(bar);
  }
  if (restricted) (g.children[0] as THREE.Mesh).material = barMat;
  root.add(g);
}
