import type { NPCDef } from '../game/types';

// Skin tone palette
const SK = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4423];
// Hair palette
const HR = [0x2b1d0e, 0x000000, 0x5a3a1a, 0x888888, 0xd9b382, 0xffffff];

function s(i: number) { return SK[i % SK.length]; }
function h(i: number) { return HR[i % HR.length]; }

export const NPCS: NPCDef[] = [
  // ===== IRON DOGS (red, gym/yard) =====
  { id: 'iron_brick', name: 'Brick', faction: 'iron_dogs', role: 'leader', archetype: 'bully', spawnRoom: 'gym', height: 1.15, skin: s(3), hair: h(1), hairStyle: 'bald', accent: 'beard',
    base: { health: 140, aggression: 0.9, fear: 0.05, respect: 0.95, loyalty: 1, strength: 9 } },
  { id: 'iron_tank', name: 'Tank', faction: 'iron_dogs', role: 'enforcer', archetype: 'hothead', spawnRoom: 'gym', height: 1.12, skin: s(2), hair: h(0), hairStyle: 'mohawk', accent: 'scar',
    base: { health: 120, aggression: 0.85, fear: 0.1, respect: 0.6, loyalty: 0.9, strength: 8 } },
  { id: 'iron_rex', name: 'Rex', faction: 'iron_dogs', role: 'member', archetype: 'workout', spawnRoom: 'yard', height: 1.05, skin: s(0), hair: h(2), hairStyle: 'short',
    base: { health: 100, aggression: 0.6, fear: 0.2, respect: 0.4, loyalty: 0.8, strength: 7 } },

  // ===== BLUE KINGS (blue, cafeteria/phones) =====
  { id: 'king_marcus', name: 'Marcus', faction: 'blue_kings', role: 'leader', archetype: 'strategist', spawnRoom: 'cafeteria', height: 1.02, skin: s(3), hair: h(0), hairStyle: 'short', accent: 'glasses',
    base: { health: 100, aggression: 0.4, fear: 0.2, respect: 0.9, loyalty: 1, strength: 5 } },
  { id: 'king_dee', name: 'Dee', faction: 'blue_kings', role: 'trader', archetype: 'hustler', spawnRoom: 'cafeteria', height: 0.98, skin: s(4), hair: h(2), hairStyle: 'cap',
    base: { health: 85, aggression: 0.3, fear: 0.35, respect: 0.5, loyalty: 0.8, strength: 4 } },
  { id: 'king_vince', name: 'Vince', faction: 'blue_kings', role: 'recruiter', archetype: 'veteran', spawnRoom: 'visitation', height: 1.0, skin: s(0), hair: h(3), hairStyle: 'short', accent: 'beard',
    base: { health: 95, aggression: 0.45, fear: 0.25, respect: 0.6, loyalty: 0.9, strength: 6 } },

  // ===== BLACK VIPERS (green/black, storage/maintenance/shower) =====
  { id: 'viper_silas', name: 'Silas', faction: 'black_vipers', role: 'leader', archetype: 'strategist', spawnRoom: 'maintenance', height: 1.0, skin: s(5), hair: h(1), hairStyle: 'beanie', accent: 'scar',
    base: { health: 105, aggression: 0.6, fear: 0.15, respect: 0.85, loyalty: 1, strength: 6 } },
  { id: 'viper_nyx', name: 'Nyx', faction: 'black_vipers', role: 'trader', archetype: 'hustler', spawnRoom: 'storage', height: 0.92, skin: s(1), hair: h(1), hairStyle: 'long',
    base: { health: 80, aggression: 0.5, fear: 0.3, respect: 0.5, loyalty: 0.85, strength: 4 } },
  { id: 'viper_creep', name: 'Creep', faction: 'black_vipers', role: 'enforcer', archetype: 'snitch', spawnRoom: 'shower', height: 0.95, skin: s(2), hair: h(0), hairStyle: 'bald', accent: 'scar',
    base: { health: 90, aggression: 0.7, fear: 0.25, respect: 0.4, loyalty: 0.7, strength: 6 } },

  // ===== YARD SAINTS (white/gold, cellblock/medical) =====
  { id: 'saint_pops', name: 'Pops', faction: 'yard_saints', role: 'leader', archetype: 'veteran', spawnRoom: 'cellblock', height: 1.0, skin: s(3), hair: h(5), hairStyle: 'short', accent: 'beard',
    base: { health: 110, aggression: 0.3, fear: 0.1, respect: 0.9, loyalty: 1, strength: 6 } },
  { id: 'saint_grace', name: 'Big Grace', faction: 'yard_saints', role: 'protector' as any, archetype: 'protector', spawnRoom: 'cellblock', height: 1.08, skin: s(0), hair: h(0), hairStyle: 'short',
    base: { health: 125, aggression: 0.4, fear: 0.1, respect: 0.7, loyalty: 0.95, strength: 8 } },
  { id: 'saint_mo', name: 'Mo', faction: 'yard_saints', role: 'member', archetype: 'friend', spawnRoom: 'medical', height: 0.97, skin: s(4), hair: h(2), hairStyle: 'short',
    base: { health: 90, aggression: 0.25, fear: 0.3, respect: 0.4, loyalty: 0.9, strength: 5 } },

  // ===== LONE WOLVES (grey, unaligned) =====
  { id: 'wolf_finn', name: 'Finn', faction: 'lone_wolves', role: 'member', archetype: 'friend', spawnRoom: 'cellblock', height: 0.96, skin: s(0), hair: h(2), hairStyle: 'short', accent: 'glasses',
    base: { health: 85, aggression: 0.2, fear: 0.4, respect: 0.3, loyalty: 0, strength: 4 } },
  { id: 'wolf_doc', name: 'Reader', faction: 'lone_wolves', role: 'member', archetype: 'booksmart', spawnRoom: 'cellblock', height: 0.94, skin: s(1), hair: h(3), hairStyle: 'short', accent: 'glasses',
    base: { health: 75, aggression: 0.15, fear: 0.45, respect: 0.35, loyalty: 0, strength: 3 } },
  { id: 'wolf_ghost', name: 'Ghost', faction: 'lone_wolves', role: 'member', archetype: 'coward', spawnRoom: 'yard', height: 0.9, skin: s(5), hair: h(1), hairStyle: 'beanie',
    base: { health: 70, aggression: 0.1, fear: 0.7, respect: 0.2, loyalty: 0, strength: 3 } },

  // ===== GUARDS =====
  { id: 'guard_hardy', name: 'CO Hardy', faction: 'guards', role: 'guard', archetype: 'guard', spawnRoom: 'walkway', height: 1.05, skin: s(0), hair: h(0), hairStyle: 'cap',
    base: { health: 130, aggression: 0.6, fear: 0.05, respect: 0.7, loyalty: 1, strength: 7 } },
  { id: 'guard_ruiz', name: 'CO Ruiz', faction: 'guards', role: 'guard', archetype: 'guard', spawnRoom: 'hallway', height: 1.0, skin: s(2), hair: h(1), hairStyle: 'cap',
    base: { health: 120, aggression: 0.45, fear: 0.1, respect: 0.6, loyalty: 1, strength: 6 } },
  { id: 'guard_pike', name: 'CO Pike', faction: 'guards', role: 'guard', archetype: 'guard', spawnRoom: 'cafeteria', height: 1.08, skin: s(3), hair: h(0), hairStyle: 'cap', accent: 'beard',
    base: { health: 125, aggression: 0.7, fear: 0.05, respect: 0.5, loyalty: 1, strength: 7 } },
  { id: 'guard_lane', name: 'CO Lane', faction: 'guards', role: 'guard', archetype: 'guard', spawnRoom: 'yard', height: 0.98, skin: s(4), hair: h(2), hairStyle: 'cap',
    base: { health: 110, aggression: 0.3, fear: 0.15, respect: 0.5, loyalty: 0.8, strength: 6 } },
  { id: 'guard_kort', name: 'Sgt. Kort', faction: 'guards', role: 'riot_guard', archetype: 'guard', spawnRoom: 'guard_office', height: 1.12, skin: s(1), hair: h(1), hairStyle: 'cap', accent: 'scar',
    base: { health: 160, aggression: 0.8, fear: 0.02, respect: 0.85, loyalty: 1, strength: 9 } },

  // ===== STAFF =====
  { id: 'warden_kane', name: 'Warden Kane', faction: 'staff', role: 'warden', archetype: 'staff', spawnRoom: 'warden_office', height: 1.04, skin: s(0), hair: h(3), hairStyle: 'short',
    base: { health: 100, aggression: 0.3, fear: 0.1, respect: 1, loyalty: 1, strength: 5 } },
  { id: 'doc_vasquez', name: 'Dr. Vasquez', faction: 'staff', role: 'doctor', archetype: 'staff', spawnRoom: 'medical', height: 0.98, skin: s(2), hair: h(0), hairStyle: 'short', accent: 'glasses',
    base: { health: 90, aggression: 0.1, fear: 0.3, respect: 0.7, loyalty: 1, strength: 4 } },
  { id: 'cook_sal', name: 'Cook Sal', faction: 'staff', role: 'cook', archetype: 'staff', spawnRoom: 'kitchen', height: 1.06, skin: s(3), hair: h(5), hairStyle: 'cap', accent: 'beard',
    base: { health: 95, aggression: 0.3, fear: 0.2, respect: 0.5, loyalty: 0.9, strength: 6 } }
];

export const NPC_MAP: Record<string, NPCDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
