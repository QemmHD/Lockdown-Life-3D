import { TileMap } from './TileMap';

export interface Room {
  id: string;
  name: string;
  type: string;
  x: number; y: number; w: number; h: number;  // tile bounds
  color: number;
  security: number;
  door?: number;   // door tile index
  gate?: boolean;  // wide controlled transition (yard)
}

export interface PrisonLayout {
  map: TileMap;
  rooms: Room[];
  doorIdx: number[];
}

const W = 60, H = 44;

// Hand-authored "prison complex" floorplan: two housing wings up top, a central
// circulation spine + upper/lower cross-corridors, distinct destination zones hanging
// off the corridors with 1-tile walls + controlled doors, and a gated outdoor yard.
type Def = Omit<Room, 'x' | 'y' | 'w' | 'h' | 'door' | 'gate'> & { x: number; y: number; w: number; h: number; door?: [number, number]; gate?: boolean };
const ROOM_DEFS: Def[] = [
  // circulation (type hallway) — these overlap to form junctions
  { id: 'corr_upper', type: 'hallway', name: 'Corridor', x: 4, y: 16, w: 52, h: 3, color: 0x474b54, security: 1 },
  { id: 'corr_lower', type: 'hallway', name: 'Corridor', x: 8, y: 28, w: 48, h: 3, color: 0x474b54, security: 1 },
  { id: 'spine', type: 'hallway', name: 'Main Hall', x: 27, y: 6, w: 4, h: 24, color: 0x4a4e58, security: 1 },

  // housing wings
  { id: 'cellblock_a', type: 'cellblock', name: 'Cell Block A', x: 3, y: 3, w: 22, h: 12, color: 0x565a63, security: 2, door: [13, 15] },
  { id: 'cellblock_b', type: 'cellblock', name: 'Cell Block B', x: 35, y: 3, w: 22, h: 12, color: 0x565a63, security: 2, door: [46, 15] },

  // mid band off the upper corridor
  { id: 'cafeteria', type: 'cafeteria', name: 'Cafeteria', x: 3, y: 20, w: 22, h: 7, color: 0x7a6850, security: 1, door: [13, 19] },
  { id: 'guardroom', type: 'guardroom', name: 'Security', x: 35, y: 20, w: 13, h: 7, color: 0x44505f, security: 3, door: [41, 19] },
  { id: 'intake', type: 'intake', name: 'Intake', x: 49, y: 20, w: 9, h: 7, color: 0x4a4452, security: 2, door: [52, 19] },

  // lower band off the lower corridor
  { id: 'showers', type: 'shower', name: 'Showers', x: 3, y: 32, w: 13, h: 9, color: 0x52707c, security: 1, door: [9, 31] },
  { id: 'yard', type: 'yard', name: 'The Yard', x: 18, y: 32, w: 23, h: 10, color: 0x63724a, security: 1, door: [29, 31], gate: true },
  { id: 'storage', type: 'storage', name: 'Storage', x: 43, y: 32, w: 8, h: 6, color: 0x4f4a42, security: 2, door: [46, 31] },
  { id: 'solitary', type: 'solitary', name: 'Solitary', x: 52, y: 32, w: 6, h: 9, color: 0x2e3038, security: 3, door: [54, 31] }
];

export function generatePrison(): PrisonLayout {
  const map = new TileMap(W, H);
  const rooms: Room[] = [];
  const doorIdx: number[] = [];

  ROOM_DEFS.forEach((d, i) => {
    rooms.push({ id: d.id, name: d.name, type: d.type, x: d.x, y: d.y, w: d.w, h: d.h, color: d.color, security: d.security, gate: d.gate });
    for (let yy = d.y; yy < d.y + d.h; yy++) for (let xx = d.x; xx < d.x + d.w; xx++) {
      if (!map.inBounds(xx, yy)) continue;
      const k = map.idx(xx, yy); map.walkable[k] = 1; map.room[k] = i;
    }
    if (d.door) {
      const k = map.idx(d.door[0], d.door[1]);
      map.walkable[k] = 1; map.room[k] = i; doorIdx.push(k);
      rooms[i].door = k;
    }
  });

  return { map, rooms, doorIdx };
}

// Wall tiles = blocked tiles touching a walkable tile (rendering only).
export function wallTiles(map: TileMap): number[] {
  const out: number[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const k = map.idx(x, y);
    if (map.walkable[k]) continue;
    if (map.isWalkable(x + 1, y) || map.isWalkable(x - 1, y) || map.isWalkable(x, y + 1) || map.isWalkable(x, y - 1)
      || map.isWalkable(x + 1, y + 1) || map.isWalkable(x - 1, y - 1) || map.isWalkable(x + 1, y - 1) || map.isWalkable(x - 1, y + 1)) out.push(k);
  }
  return out;
}

export function randomTileInRoom(map: TileMap, rooms: Room[], roomId: string, rng: () => number): number {
  const r = rooms.find((x) => x.id === roomId) ?? rooms[0];
  for (let i = 0; i < 40; i++) {
    const x = r.x + 1 + Math.floor(rng() * Math.max(1, r.w - 2));
    const y = r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 2));
    if (map.isWalkable(x, y)) return map.idx(x, y);
  }
  return map.idx(r.x + (r.w >> 1), r.y + (r.h >> 1));
}
