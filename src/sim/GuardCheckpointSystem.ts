// Guard checkpoint anchors — pure builder (no sim/render dependency).
// Checkpoints are derived from the existing map: each room's door (the corridor side) plus a
// central main-hall junction. Guards rotate through them and man posts during chaos.

export type GuardRole = 'patrol' | 'checkpoint' | 'response' | 'escort' | 'search' | 'desk';

export interface Checkpoint {
  id: string;
  x: number; z: number;
  roomType: string;
  priority: number;   // higher = more important to man during chaos (restricted/security first)
}

interface RoomLike { id: string; type: string; x: number; y: number; w: number; h: number; door?: number; security: number; }

// Build checkpoints from room doors + a hall junction. `toWorld`/`tileXY` come from the TileMap.
export function buildCheckpoints(
  rooms: RoomLike[],
  tileXY: (idx: number) => { x: number; y: number },
  toWorld: (x: number, y: number) => { x: number; z: number }
): Checkpoint[] {
  const out: Checkpoint[] = [];
  for (const r of rooms) {
    if (r.door == null) continue;
    const t = tileXY(r.door); const w = toWorld(t.x, t.y);
    out.push({ id: 'cp_' + r.id, x: w.x, z: w.z, roomType: r.type, priority: r.security >= 3 ? 3 : r.type === 'yard' ? 2 : 1 });
  }
  // central main-hall junction (map origin) — a natural choke point
  out.push({ id: 'cp_hall', x: 0, z: 0, roomType: 'hallway', priority: 2 });
  return out;
}
