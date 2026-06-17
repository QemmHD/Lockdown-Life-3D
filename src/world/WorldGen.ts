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

// A real individual cell: enclosed by concrete side/back walls with a barred front and a
// single 1-tile door gap opening onto the cell-block corridor. The Simulation furnishes it
// (bunk/toilet/sink) and the renderer dresses the bars + a barred gate at the gap.
export interface Cell {
  id: string;
  room: string;             // owning cell-block room id
  x: number; y: number;     // interior tile bounds (top-left)
  w: number; h: number;     // interior tile size
  doorTile: number;         // the walkable gap tile in the barred front
  gateTiles: number[];      // the barred (blocked) tiles flanking the gap
  facing: number;           // facing from the gap toward the cell interior (radians, for gate rotation)
  stand: number;            // walkable interior tile the occupant stands on to use the bunk
  bunk: { x: number; y: number };
  toilet: { x: number; y: number };
  sink: { x: number; y: number };
}

export interface PrisonLayout {
  map: TileMap;
  rooms: Room[];
  doorIdx: number[];
  cells: Cell[];
}

const W = 60, H = 44;

// Hand-authored "prison complex" floorplan: two housing wings of individual cells up top, a
// central circulation spine + upper/lower cross-corridors, distinct destination zones hanging
// off the corridors behind controlled doors, and a gated outdoor yard. Room ids/types are
// stable so checkpoints / patrol routes / gang turf / schedule anchors keep working.
type Def = Omit<Room, 'x' | 'y' | 'w' | 'h' | 'door' | 'gate'> & { x: number; y: number; w: number; h: number; door?: [number, number]; gate?: boolean };
const ROOM_DEFS: Def[] = [
  // circulation (type hallway) — these overlap to form junctions
  { id: 'corr_upper', type: 'hallway', name: 'Corridor', x: 4, y: 16, w: 52, h: 3, color: 0x474b54, security: 1 },
  { id: 'corr_lower', type: 'hallway', name: 'Corridor', x: 8, y: 28, w: 48, h: 3, color: 0x474b54, security: 1 },
  { id: 'spine', type: 'hallway', name: 'Main Hall', x: 28, y: 6, w: 4, h: 24, color: 0x4a4e58, security: 1 },

  // housing wings (cells carved inside in carveCellBlock)
  { id: 'cellblock_a', type: 'cellblock', name: 'Cell Block A', x: 3, y: 2, w: 22, h: 12, color: 0x565a63, security: 2, door: [13, 15] },
  { id: 'cellblock_b', type: 'cellblock', name: 'Cell Block B', x: 35, y: 2, w: 22, h: 12, color: 0x565a63, security: 2, door: [46, 15] },

  // mid band off the upper corridor
  { id: 'cafeteria', type: 'cafeteria', name: 'Cafeteria', x: 3, y: 20, w: 22, h: 7, color: 0x7a6850, security: 1, door: [11, 19] },
  { id: 'guardroom', type: 'guardroom', name: 'Security', x: 35, y: 20, w: 13, h: 7, color: 0x44505f, security: 3, door: [41, 19] },
  { id: 'intake', type: 'intake', name: 'Intake', x: 49, y: 20, w: 9, h: 7, color: 0x4a4452, security: 2, door: [52, 19] },

  // lower band off the lower corridor
  { id: 'showers', type: 'shower', name: 'Showers', x: 3, y: 32, w: 13, h: 9, color: 0x52707c, security: 1, door: [9, 31] },
  { id: 'yard', type: 'yard', name: 'The Yard', x: 18, y: 32, w: 23, h: 10, color: 0x63724a, security: 1, door: [29, 31], gate: true },
  { id: 'storage', type: 'storage', name: 'Storage', x: 43, y: 32, w: 8, h: 6, color: 0x4f4a42, security: 2, door: [46, 31] },
  { id: 'solitary', type: 'solitary', name: 'Solitary', x: 52, y: 32, w: 6, h: 9, color: 0x2e3038, security: 3, door: [54, 31] }
];

// Carve a wing of individual cells: the block interior starts solid, then we carve a 2-tile
// cell-block corridor through the middle, rows of cells above and below it, a vertical link from
// the corridor down to the block door, and a barred front (blocked=1) with a 1-tile door gap per
// cell. Untouched interior tiles stay concrete walls (walkable=0) → real enclosed cells.
function carveCellBlock(map: TileMap, roomIdx: number, r: Room, doorCol: number, cells: Cell[]) {
  const x0 = r.x, x1 = r.x + r.w - 1;          // interior col range
  const y0 = r.y, y1 = r.y + r.h - 1;          // interior row range
  const corrTop = y0 + Math.floor(r.h / 2) - 1, corrBot = corrTop + 1;   // 2-tile corridor

  const setBar = (x: number, y: number) => { if (map.inBounds(x, y)) { const k = map.idx(x, y); map.walkable[k] = 1; map.blocked[k] = 1; map.room[k] = roomIdx; } };
  const setFloor = (x: number, y: number) => { if (map.inBounds(x, y)) { const k = map.idx(x, y); map.walkable[k] = 1; map.blocked[k] = 0; map.room[k] = roomIdx; } };

  // start the whole block interior solid; everything not carved below stays a concrete wall
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = map.idx(x, y); map.walkable[k] = 0; map.blocked[k] = 0; }

  const linkCol = doorCol;   // vertical link column from corridor down to the block door

  // one band of cells (faceDown: cells sit above the corridor and open south; else below, open north)
  const band = (interiorYs: number[], barY: number, faceDown: boolean) => {
    let cx = x0;
    while (cx + 2 <= x1) {
      const iL = cx + 1, iR = cx + 2;          // interior cols; cx and cx+3 are shared side walls
      if (linkCol >= cx && linkCol <= cx + 2) { cx += 1; continue; }   // keep the door link clear
      for (const y of interiorYs) { setFloor(iL, y); setFloor(iR, y); }
      const gapCol = iL;                        // 1-tile door gap at the left interior column
      const gateTiles: number[] = [];
      setBar(iR, barY); gateTiles.push(map.idx(iR, barY));
      setFloor(gapCol, barY);
      const doorTile = map.idx(gapCol, barY);
      const backY = faceDown ? interiorYs[0] : interiorYs[interiorYs.length - 1];
      const midY = interiorYs[Math.floor(interiorYs.length / 2)];
      const standY = faceDown ? interiorYs[interiorYs.length - 1] : interiorYs[0];
      cells.push({
        id: `cell_${r.id}_${cells.length}`, room: r.id, x: iL, y: Math.min(...interiorYs), w: 2, h: interiorYs.length,
        doorTile, gateTiles, facing: faceDown ? 0 : Math.PI, stand: map.idx(gapCol, standY),
        bunk: { x: iR, y: backY }, toilet: { x: iL, y: backY }, sink: { x: iL, y: midY }
      });
      cx += 3;
    }
  };

  const topYs: number[] = []; for (let y = y0; y < corrTop - 1; y++) topYs.push(y);
  const botYs: number[] = []; for (let y = corrBot + 2; y <= y1; y++) botYs.push(y);
  if (topYs.length) band(topYs, corrTop - 1, true);
  if (botYs.length) band(botYs, corrBot + 1, false);

  // corridor + vertical link to the door (always walkable)
  for (let x = x0; x <= x1; x++) { setFloor(x, corrTop); setFloor(x, corrBot); }
  for (let y = corrTop; y <= y1 + 2; y++) setFloor(linkCol, y);   // link down past the bottom edge → block door
}

export function generatePrison(): PrisonLayout {
  const map = new TileMap(W, H);
  const rooms: Room[] = [];
  const doorIdx: number[] = [];
  const cells: Cell[] = [];

  ROOM_DEFS.forEach((d, i) => {
    rooms.push({ id: d.id, name: d.name, type: d.type, x: d.x, y: d.y, w: d.w, h: d.h, color: d.color, security: d.security, gate: d.gate });
    for (let yy = d.y; yy < d.y + d.h; yy++) for (let xx = d.x; xx < d.x + d.w; xx++) {
      if (!map.inBounds(xx, yy)) continue;
      const k = map.idx(xx, yy); map.walkable[k] = 1; map.room[k] = i;
    }
    if (d.door) {
      const k = map.idx(d.door[0], d.door[1]);
      map.walkable[k] = 1; map.blocked[k] = 0; map.room[k] = i; doorIdx.push(k);
      rooms[i].door = k;
    }
  });

  // carve real cells into the housing wings (after the base room fill)
  for (let i = 0; i < ROOM_DEFS.length; i++) {
    const d = ROOM_DEFS[i];
    if (d.type === 'cellblock' && d.door) carveCellBlock(map, i, rooms[i], d.door[0], cells);
  }

  return { map, rooms, doorIdx, cells };
}

// Wall tiles = structural (walkable=0) tiles touching a walkable tile (rendering only).
// Prop solids (blocked=1) are NOT walls — the renderer draws their bars/furniture instead.
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
  for (let i = 0; i < 60; i++) {
    const x = r.x + 1 + Math.floor(rng() * Math.max(1, r.w - 2));
    const y = r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 2));
    if (map.isPathable(x, y)) return map.idx(x, y);
  }
  // fall back to any pathable tile in the room (cells can make the geometric center a wall)
  for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (map.isPathable(xx, yy)) return map.idx(xx, yy);
  return map.idx(r.x + (r.w >> 1), r.y + (r.h >> 1));
}
