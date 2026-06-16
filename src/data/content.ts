// Lightweight data-driven content for the milestone (JSON files + Zod validation come later).

export interface GangDef {
  id: string; name: string; color: number;
  preferredZones: string[]; enemies: string[]; aggression: number;
}

export const GANGS: GangDef[] = [
  { id: 'iron_block', name: 'Iron Block', color: 0x9aa0a6, preferredZones: ['yard', 'cellblock'], enemies: ['redline_crew'], aggression: 0.65 },
  { id: 'redline_crew', name: 'Redline Crew', color: 0xb5413a, preferredZones: ['cafeteria', 'yard'], enemies: ['iron_block'], aggression: 0.7 },
  { id: 'blue_chain', name: 'Blue Chain', color: 0x3f6fa5, preferredZones: ['shower', 'cellblock'], enemies: [], aggression: 0.4 }
];

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
