// Shared type definitions for Lockdown Life 3D

export type FactionId =
  | 'iron_dogs'
  | 'blue_kings'
  | 'black_vipers'
  | 'yard_saints'
  | 'lone_wolves'
  | 'guards'
  | 'staff';

export interface FactionDef {
  id: FactionId;
  name: string;
  color: number; // hex color for three.js
  cssColor: string;
  accent: number;
  description: string;
  territory: string[]; // room ids
  values: string;
  behavior: string;
}

export type RelationshipLevel =
  | 'enemy'
  | 'hostile'
  | 'unfriendly'
  | 'neutral'
  | 'friendly'
  | 'ally'
  | 'loyal';

export type NPCRole =
  | 'leader'
  | 'enforcer'
  | 'trader'
  | 'recruiter'
  | 'member'
  | 'rookie'
  | 'guard'
  | 'riot_guard'
  | 'warden'
  | 'doctor'
  | 'cook'
  | 'janitor';

export type Archetype =
  | 'bully'
  | 'hustler'
  | 'friend'
  | 'coward'
  | 'veteran'
  | 'hothead'
  | 'strategist'
  | 'snitch'
  | 'protector'
  | 'workout'
  | 'booksmart'
  | 'sick'
  | 'new'
  | 'guard'
  | 'staff';

export interface NPCDef {
  id: string;
  name: string;
  faction: FactionId;
  role: NPCRole;
  archetype: Archetype;
  spawnRoom: string;
  height: number; // 0.85 - 1.15 build scale
  skin: number;
  hair: number;
  hairStyle: 'short' | 'bald' | 'mohawk' | 'cap' | 'beanie' | 'long';
  accent?: 'glasses' | 'beard' | 'scar' | 'none';
  base: {
    health: number;
    aggression: number; // 0-1
    fear: number; // 0-1
    respect: number; // 0-1 how respected they are
    loyalty: number; // 0-1 to faction
    strength: number;
  };
}

export type ItemType = 'consumable' | 'weapon' | 'contraband' | 'valuable' | 'misc' | 'quest';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  contraband: boolean;
  value: number;
  risk: number; // 0-1 suspicion if found
  desc: string;
  // optional effects on use
  effect?: Partial<Record<StatKey, number>>;
  damage?: number; // weapon bonus
  faction?: FactionId;
  icon: string; // emoji-ish glyph
}

export interface InventoryItem {
  itemId: string;
  qty: number;
}

export type StatKey =
  | 'health'
  | 'stamina'
  | 'hunger'
  | 'mood'
  | 'strength'
  | 'agility'
  | 'toughness'
  | 'intelligence'
  | 'reputation'
  | 'money'
  | 'heat'
  | 'respect'
  | 'fear'
  | 'influence'
  | 'injury'
  | 'fatigue';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  mood: number;
  strength: number;
  agility: number;
  toughness: number;
  intelligence: number;
  reputation: number;
  money: number;
  heat: number;
  respect: number;
  fear: number;
  influence: number;
  injury: number;
  fatigue: number;
}

export type SchedulePhaseId =
  | 'wakeup'
  | 'rollcall'
  | 'breakfast'
  | 'work'
  | 'yard'
  | 'gym'
  | 'lunch'
  | 'shower'
  | 'dinner'
  | 'evening'
  | 'lockdown'
  | 'sleep';

export interface SchedulePhase {
  id: SchedulePhaseId;
  name: string;
  startHour: number; // 0-24
  requiredRoom?: string; // where inmates should be
  announce: string;
  restricted?: boolean; // lockdown style
}

export interface RoomDef {
  id: string;
  name: string;
  x: number; // center
  z: number;
  w: number; // width (x)
  d: number; // depth (z)
  floor: number; // hex
  restricted?: boolean;
  faction?: FactionId; // territory
  danger?: number; // 0-1
}

export interface NPCMemory {
  relationship: number; // -100..100
  attacked: boolean;
  helped: boolean;
  robbed: boolean;
  traded: boolean;
  insulted: boolean;
  bribed: boolean;
  fights: number;
}

export interface DialogueContext {
  npcId: string;
}

export interface SerializedNPC {
  id: string;
  x: number;
  z: number;
  health: number;
  ko: boolean;
  koTimer: number;
}

export interface PlayerAppearance {
  height: number;
  skin: number;
  hair: number;
  hairStyle: 'short' | 'bald' | 'mohawk' | 'cap' | 'beanie' | 'long';
  uniform: number;
}

export interface FactionRunState {
  leader: string;
  members: number;
  territory: string[];
  enemy: string;
  ally: string;
  specialty: string;   // contraband specialty item id
  hangout: string;     // room id
  goal: string;
  weakness: string;
  attitude: number;    // starting relationship delta toward player
}

export interface DailyModifier { id: string; name: string; desc: string; }
export interface EconItem { value: number; supply: number; demand: number; }

export interface Mission {
  id: string;
  giver: string;       // npc id
  giverName: string;
  faction: FactionId;
  type: string;
  title: string;
  desc: string;
  targetRoom?: string;
  item?: string;
  reward: { money?: number; rep?: number; respect?: number; faction?: number; heat?: number; item?: string };
  risk: number;
  done: boolean;
}

export interface RunState {
  seed: number;
  worldState: string;
  worldStateName: string;
  worldStateDesc: string;
  factions: Record<string, FactionRunState>;
  economy: Record<string, EconItem>;
  dailyModifier: DailyModifier;
  npcTraits: Record<string, string>;
  npcNames: Record<string, string>;
  rumors: string[];        // rumors the player has seen
  tomorrowRumor: string;
  bestEventToday: string;
  difficulty: number;      // 0..1 reactive difficulty
}

export interface SaveData {
  version: number;
  day: number;
  timeOfDay: number; // 0-24
  phase: SchedulePhaseId;
  sentenceDays: number;
  playerName: string;
  crime: string;
  appearance: PlayerAppearance;
  stats: PlayerStats;
  player: { x: number; z: number };
  inventory: InventoryItem[];
  factionRep: Record<string, number>;
  npcMemory: Record<string, NPCMemory>;
  npcState: Record<string, SerializedNPC>;
  completedEvents: string[];
  settings: GameSettings;
  stashes: Record<string, InventoryItem[]>;
  flags: Record<string, boolean | number>;
  deadNPCs: string[];
  bodyCount: number;
  run: RunState;
  missions: Mission[];
}

export interface GameSettings {
  master: boolean;
  sfxVolume: number;
  cameraShake: boolean;
  controlOpacity: number;
  quality: 'simple' | 'high';
}

export interface EventChoice {
  text: string;
  apply: string; // handler key
}

export interface RandomEventDef {
  id: string;
  name: string;
  phases: SchedulePhaseId[];
  weight: number;
  message: string;
  once?: boolean;
  choices?: { text: string; outcome: string }[];
}
