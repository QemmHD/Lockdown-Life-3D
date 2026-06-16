import { TileMap } from './TileMap';

export interface Room {
  id: string;
  name: string;
  type: string;
  x: number; y: number; w: number; h: number;  // tile bounds
  color: number;
  security: number;
}

export interface PrisonLayout {
  map: TileMap;
  rooms: Room[];
  doorIdx: number[];
}

const W = 44, H = 30;

// Hand-authored, readable layout for the milestone (procedural variants come later).
const ROOM_DEFS: (Omit<Room, 'x' | 'y' | 'w' | 'h'> & { x: number; y: number; w: number; h: number; door: [number, number] })[] = [
  { id: 'hallway', name: 'Hallway', type: 'hallway', x: 2, y: 13, w: 40, h: 4, color: 0x4a4a52, security: 1, door: [0, 0] },
  { id: 'cellblock', name: 'Cell Block', type: 'cellblock', x: 2, y: 2, w: 18, h: 10, color: 0x55585f, security: 2, door: [11, 12] },
  { id: 'cafeteria', name: 'Cafeteria', type: 'cafeteria', x: 22, y: 2, w: 20, h: 10, color: 0x6b6256, security: 1, door: [32, 12] },
  { id: 'shower', name: 'Showers', type: 'shower', x: 2, y: 18, w: 9, h: 6, color: 0x566a72, security: 2, door: [6, 17] },
  { id: 'guardroom', name: 'Guard Room', type: 'guardroom', x: 13, y: 18, w: 9, h: 6, color: 0x3a4452, security: 3, door: [17, 17] },
  { id: 'yard', name: 'The Yard', type: 'yard', x: 24, y: 18, w: 18, h: 10, color: 0x5a6b4a, security: 1, door: [33, 17] }
];

export function generatePrison(): PrisonLayout {
  const map = new TileMap(W, H);
  const rooms: Room[] = [];
  const doorIdx: number[] = [];

  ROOM_DEFS.forEach((d, i) => {
    rooms.push({ id: d.id, name: d.name, type: d.type, x: d.x, y: d.y, w: d.w, h: d.h, color: d.color, security: d.security });
    for (let yy = d.y; yy < d.y + d.h; yy++) {
      for (let xx = d.x; xx < d.x + d.w; xx++) {
        const k = map.idx(xx, yy);
        map.walkable[k] = 1; map.room[k] = i;
      }
    }
    if (d.id !== 'hallway') {
      const k = map.idx(d.door[0], d.door[1]);
      map.walkable[k] = 1; map.room[k] = 0; doorIdx.push(k); // door tile joins the hallway
    }
  });

  return { map, rooms, doorIdx };
}

// Wall tiles = blocked tiles touching a walkable tile (for rendering only).
export function wallTiles(map: TileMap): number[] {
  const out: number[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const k = map.idx(x, y);
    if (map.walkable[k]) continue;
    if (map.isWalkable(x + 1, y) || map.isWalkable(x - 1, y) || map.isWalkable(x, y + 1) || map.isWalkable(x, y - 1)
      || map.isWalkable(x + 1, y + 1) || map.isWalkable(x - 1, y - 1) || map.isWalkable(x + 1, y - 1) || map.isWalkable(x - 1, y + 1)) {
      out.push(k);
    }
  }
  return out;
}

export function randomTileInRoom(map: TileMap, rooms: Room[], roomId: string, rng: () => number): number {
  const r = rooms.find((x) => x.id === roomId) ?? rooms[0];
  for (let i = 0; i < 30; i++) {
    const x = r.x + 1 + Math.floor(rng() * Math.max(1, r.w - 2));
    const y = r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 2));
    if (map.isWalkable(x, y)) return map.idx(x, y);
  }
  return map.idx(r.x + (r.w >> 1), r.y + (r.h >> 1));
}
