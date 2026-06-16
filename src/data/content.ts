// Lightweight data-driven content for the milestone (JSON files + Zod validation come later).

export interface GangDef {
  id: string; name: string; color: number;
  territory: string;          // primary room-type turf
  preferredZones: string[];
  enemies: string[]; allies: string[];
  aggression: number; respectThreshold: number;
}

// Fictional gangs only.
export const GANGS: GangDef[] = [
  { id: 'iron_block', name: 'Iron Block', color: 0x9aa0a6, territory: 'cellblock', preferredZones: ['cellblock', 'yard'], enemies: ['redline_crew'], allies: ['north_hall'], aggression: 0.62, respectThreshold: 30 },
  { id: 'yard_kings', name: 'Yard Kings', color: 0xd8a72c, territory: 'yard', preferredZones: ['yard'], enemies: ['blue_chain'], allies: [], aggression: 0.68, respectThreshold: 35 },
  { id: 'blue_chain', name: 'Blue Chain', color: 0x3f6fa5, territory: 'shower', preferredZones: ['shower', 'cellblock'], enemies: ['yard_kings'], allies: ['cell_rats'], aggression: 0.45, respectThreshold: 25 },
  { id: 'redline_crew', name: 'Redline Crew', color: 0xb5413a, territory: 'cafeteria', preferredZones: ['cafeteria', 'yard'], enemies: ['iron_block'], allies: [], aggression: 0.72, respectThreshold: 38 },
  { id: 'north_hall', name: 'North Hall', color: 0x6f9a72, territory: 'cellblock', preferredZones: ['cellblock'], enemies: [], allies: ['iron_block'], aggression: 0.5, respectThreshold: 28 },
  { id: 'cell_rats', name: 'Cell Rats', color: 0x8a7a5a, territory: 'cafeteria', preferredZones: ['cafeteria', 'cellblock'], enemies: [], allies: ['blue_chain'], aggression: 0.4, respectThreshold: 20 }
];
export const GANG_MAP: Record<string, GangDef> = Object.fromEntries(GANGS.map((g) => [g.id, g]));
export function areEnemies(a?: string, b?: string): boolean {
  if (!a || !b || a === b) return false;
  return !!GANG_MAP[a]?.enemies.includes(b) || !!GANG_MAP[b]?.enemies.includes(a);
}

export const NAME_POOL = ['Rook', 'Mason', 'Knox', 'Diesel', 'Tully', 'Vince', 'Cane', 'Marco', 'Hodge', 'Slim', 'Boone', 'Reyes', 'Gable', 'Otis', 'Wyatt', 'Dane'];
export const GUARD_NAMES = ['CO Hardy', 'CO Ruiz', 'CO Pike', 'CO Lane', 'Sgt. Kort'];

export const PRISONER_TRAITS = ['aggressive', 'cowardly', 'loyal', 'tough', 'weak', 'fast', 'clever', 'unstable', 'calm', 'fighter'];

export interface SchedulePhase { id: string; name: string; hour: number; room: string; }

// A repeating prison day mapped onto a 24h clock.
export const SCHEDULE: SchedulePhase[] = [
  { id: 'wake', name: 'Wake-Up', hour: 6, room: 'cellblock' },
  { id: 'breakfast', name: 'Breakfast', hour: 7.5, room: 'cafeteria' },
  { id: 'work', name: 'Work', hour: 9, room: 'yard' },
  { id: 'yard', name: 'Yard Time', hour: 11, room: 'yard' },
  { id: 'lunch', name: 'Lunch', hour: 12.5, room: 'cafeteria' },
  { id: 'free', name: 'Free Time', hour: 14, room: 'yard' },
  { id: 'shower', name: 'Showers', hour: 16, room: 'shower' },
  { id: 'dinner', name: 'Dinner', hour: 18, room: 'cafeteria' },
  { id: 'lockdown', name: 'Lockdown', hour: 20.5, room: 'cellblock' },
  { id: 'sleep', name: 'Lights Out', hour: 22, room: 'cellblock' }
];

export function phaseAt(hour: number): SchedulePhase {
  let cur = SCHEDULE[0];
  for (const p of SCHEDULE) if (hour >= p.hour) cur = p;
  return cur;
}
