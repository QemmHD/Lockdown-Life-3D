import type { RoomDef } from '../game/types';

// Two rows of rooms flanking a central main hallway (z = -6..6).
// North row faces south (doorway on south edge), South row faces north.
const NORTH_Z = -14, SOUTH_Z = 14, ROOM_D = 16, ROOM_W = 12;

function north(id: string, name: string, col: number, floor: number, extra: Partial<RoomDef> = {}): RoomDef {
  return { id, name, x: -52 + col * 13, z: NORTH_Z, w: ROOM_W, d: ROOM_D, floor, ...extra };
}
function south(id: string, name: string, col: number, floor: number, extra: Partial<RoomDef> = {}): RoomDef {
  return { id, name, x: -52 + col * 13, z: SOUTH_Z, w: ROOM_W, d: ROOM_D, floor, ...extra };
}

export const ROOMS: RoomDef[] = [
  // Main hallway
  { id: 'hallway', name: 'Main Hallway', x: 0, z: 0, w: 120, d: 12, floor: 0x4a4a52 },

  // North row
  north('cellblock', 'Cell Block', 0, 0x55585f, { faction: 'yard_saints' }),
  north('cafeteria', 'Cafeteria', 1, 0x6b6256, { faction: 'blue_kings' }),
  north('kitchen', 'Kitchen', 2, 0x7a7066),
  north('medical', 'Medical', 3, 0x5f7a74, { faction: 'staff' }),
  north('gym', 'Gym', 4, 0x6a5d52, { faction: 'iron_dogs' }),
  north('shower', 'Showers', 5, 0x566a72, { faction: 'black_vipers', danger: 0.6 }),
  north('storage', 'Storage', 6, 0x4f4a42, { faction: 'black_vipers', restricted: true }),
  north('maintenance', 'Maintenance', 7, 0x44423e, { faction: 'black_vipers', restricted: true }),
  north('yard', 'The Yard', 8, 0x5a6b4a, { faction: 'iron_dogs', danger: 0.4 }),

  // South row
  south('visitation', 'Visitation', 0, 0x5a5666, { faction: 'blue_kings' }),
  south('guard_office', 'Guard Office', 1, 0x3a4452, { faction: 'guards', restricted: true }),
  south('warden_office', 'Warden Office', 2, 0x47506a, { faction: 'staff', restricted: true }),
  south('workshop', 'Workshop', 3, 0x6a5a3e),
  south('laundry', 'Laundry', 4, 0x556070),
  south('solitary', 'Solitary', 5, 0x2e3038, { restricted: true, danger: 0.3 }),
  south('checkpoint', 'Checkpoint', 6, 0x4a4452, { faction: 'guards', restricted: true }),
  south('walkway', 'Guard Walkway', 7, 0x3f4650, { faction: 'guards', restricted: true })
];

export const ROOM_MAP: Record<string, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

// Where the player cell sits inside the cellblock
export const PLAYER_CELL = { x: -54, z: -19 };

export function roomAt(x: number, z: number): RoomDef {
  // Prefer the most specific (smallest) room containing the point
  let best: RoomDef | null = null;
  for (const r of ROOMS) {
    if (r.id === 'hallway') continue;
    if (x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && z >= r.z - r.d / 2 && z <= r.z + r.d / 2) {
      if (!best || r.w * r.d < best.w * best.d) best = r;
    }
  }
  if (best) return best;
  return ROOM_MAP['hallway'];
}
