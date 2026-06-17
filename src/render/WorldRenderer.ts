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

  // exterior concrete slab so the prison doesn't float in a black void
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width * 2.6, map.height * 2.6),
    new THREE.MeshStandardMaterial({ map: createConcreteTexture('#22252d', 16), color: THEME.exterior, roughness: 1 })
  );
  slab.rotation.x = -Math.PI / 2; slab.position.y = -0.08; slab.receiveShadow = true; root.add(slab);
  // dim perimeter lights to hint at a yard beyond
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pl = new THREE.PointLight(0x6f86b0, 0.5, 60, 1.5);
    pl.position.set(sx * map.width * 0.55, 6, sz * map.height * 0.55); root.add(pl);
  }

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

    // moody room lighting — multiple lights for large rooms so details stay readable
    if (rt.lightI > 0) {
      const nx = Math.max(1, Math.round(r.w / 9)), nz = Math.max(1, Math.round(r.h / 9));
      const reach = Math.max(r.w, r.h) / Math.max(nx, nz) + 5;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        const lx = (r.x - map.width / 2) + ((ix + 0.5) / nx) * r.w;
        const lz = (r.y - map.height / 2) + ((iz + 0.5) / nz) * r.h;
        const pl = new THREE.PointLight(rt.light, rt.lightI * 1.5, reach * 1.8, 1.3);
        pl.position.set(lx, 3.3, lz); root.add(pl);
      }
    }
  }

  // ---- layered walls (body + lighter top cap), instanced ----
  // Cell-block interior partitions render shorter so the iso camera sees into the cells; the
  // outer shell + inter-room walls stay full height for the prison-block silhouette.
  const isCellWall = (k: number) => { const ri = map.room[k]; return ri >= 0 && rooms[ri]?.type === 'cellblock'; };
  const all = wallTiles(map);
  const tall = all.filter((k) => !isCellWall(k));
  const low = all.filter((k) => isCellWall(k));
  const concreteTex = createConcreteTexture('#5a5d66', 1);
  const buildWalls = (list: number[], height: number, capColor: number) => {
    if (!list.length) return;
    const bodyGeo = new THREE.BoxGeometry(1, height, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ map: concreteTex, color: THEME.walls.side, roughness: 0.95, flatShading: true });
    const body = new THREE.InstancedMesh(bodyGeo, bodyMat, list.length);
    body.castShadow = true; body.receiveShadow = true;
    const capGeo = new THREE.BoxGeometry(1.04, 0.16, 1.04);
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.8 });
    const cap = new THREE.InstancedMesh(capGeo, capMat, list.length);
    cap.castShadow = true;
    const m = new THREE.Matrix4();
    list.forEach((k, i) => {
      const t = map.tileXY(k), w = map.toWorld(t.x, t.y);
      body.setMatrixAt(i, m.makeTranslation(w.x, height / 2, w.z));
      cap.setMatrixAt(i, m.makeTranslation(w.x, height + 0.04, w.z));
    });
    body.instanceMatrix.needsUpdate = true; cap.instanceMatrix.needsUpdate = true;
    root.add(body, cap);
  };
  buildWalls(tall, WALL_H, THEME.walls.top);
  buildWalls(low, 1.4, THEME.walls.base);

  // ---- doorway signs + warning stripes only ----
  // The moving door/gate leaf, frame, and state lamp are owned by Game.buildDoorObjects
  // (single owner of door/gate geometry, since their visual state lives in the Simulation).
  const stripeTex = createWarningStripeTexture();
  const signFor = (r: Room): string => ({
    cellblock_a: 'BLOCK A', cellblock_b: 'BLOCK B', cafeteria: 'CAFETERIA', shower: 'SHOWERS',
    showers: 'SHOWERS', guardroom: 'SECURITY', yard: 'YARD', intake: 'INTAKE', storage: 'STORAGE', solitary: 'SOLITARY'
  } as Record<string, string>)[r.id] ?? ({ cellblock: 'CELLS', cafeteria: 'CAFETERIA', shower: 'SHOWERS', guardroom: 'SECURITY', yard: 'YARD' } as Record<string, string>)[r.type] ?? '';
  for (const r of rooms) {
    if (r.door == null) continue;
    const t = map.tileXY(r.door); const w = map.toWorld(t.x, t.y);
    const restricted = r.security >= 3;
    if (restricted || r.gate) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.3), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.9 }));
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(w.x, 0.06, w.z); root.add(stripe);
    }
    const label = signFor(r);
    if (label) { const s = makeSign(label, restricted); s.position.set(w.x, WALL_H + 0.5, w.z + (r.y < map.height / 2 ? 0.4 : -0.4)); s.rotation.y = Math.PI / 4; root.add(s); }
  }

  scene.add(root);
  return root;
}

function makeSign(text: string, restricted: boolean): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = restricted ? '#3a1310' : '#141821'; ctx.fillRect(0, 0, 256, 72);
  ctx.strokeStyle = restricted ? '#d2281e' : '#d8a72c'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 248, 64);
  ctx.fillStyle = restricted ? '#ff7a6a' : '#ffd97a'; ctx.font = 'bold 38px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
  return m;
}

