import type {
  PlayerStats, InventoryItem, NPCMemory, GameSettings, SchedulePhaseId, FactionId, RelationshipLevel, PlayerAppearance, RunState, Mission
} from './types';

export function defaultRun(): RunState {
  return {
    seed: 0, worldState: 'peace', worldStateName: 'Uneasy Peace', worldStateDesc: '',
    factions: {}, economy: {}, dailyModifier: { id: 'calm', name: 'Quiet Day', desc: '' },
    npcTraits: {}, npcNames: {}, rumors: [], tomorrowRumor: '', bestEventToday: '', difficulty: 0.3
  };
}
import { PLAYABLE_FACTIONS } from '../data/factions';
import { NPCS } from '../data/npcs';

export const SAVE_VERSION = 4;
export const SAVE_KEY = 'lockdown_life_3d_save';

export function defaultStats(): PlayerStats {
  return {
    health: 100, maxHealth: 100,
    stamina: 100, maxStamina: 100,
    hunger: 80, mood: 70,
    strength: 4, agility: 4, toughness: 4, intelligence: 4,
    reputation: 0, money: 20, heat: 0,
    respect: 5, fear: 0, influence: 0,
    injury: 0, fatigue: 0
  };
}

export function defaultSettings(): GameSettings {
  return { master: true, sfxVolume: 0.6, cameraShake: true, controlOpacity: 0.55, quality: 'high' };
}

export class GameState {
  day = 1;
  timeOfDay = 6; // hours
  phase: SchedulePhaseId = 'wakeup';
  sentenceDays = 14;
  stats: PlayerStats = defaultStats();
  inventory: InventoryItem[] = [];
  factionRep: Record<string, number> = {};
  npcMemory: Record<string, NPCMemory> = {};
  completedEvents: string[] = [];
  settings: GameSettings = defaultSettings();
  stashes: Record<string, InventoryItem[]> = {};
  flags: Record<string, boolean | number> = {};
  playerFaction: FactionId | null = null;
  currentRoom = 'cellblock';
  lockdown = false;
  playerName = 'Inmate';
  crime = 'Unknown Charges';
  appearance: PlayerAppearance = { height: 1.0, skin: 0xe0ac69, hair: 0x2b1d0e, hairStyle: 'short', uniform: 0xd86a2c };
  dayCrime = false;        // committed a witnessed crime today (drives sentence growth)
  dayClean = true;         // stayed out of trouble today (drives "good behavior" cuts)
  deadNPCs: string[] = []; // permanently dead inmates (one life, gone for good)
  bodyCount = 0;           // inmates the player has killed (notoriety/story)
  run: RunState = defaultRun();
  missions: Mission[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.day = 1;
    this.timeOfDay = 6;
    this.phase = 'wakeup';
    this.sentenceDays = 14;
    this.stats = defaultStats();
    this.inventory = [
      { itemId: 'food_tray', qty: 1 },
      { itemId: 'cigarettes', qty: 2 },
      { itemId: 'book', qty: 1 }
    ];
    this.factionRep = {};
    for (const f of PLAYABLE_FACTIONS) this.factionRep[f] = 0;
    this.factionRep['guards'] = 0;
    this.npcMemory = {};
    for (const n of NPCS) {
      this.npcMemory[n.id] = {
        relationship: 0, attacked: false, helped: false, robbed: false,
        traded: false, insulted: false, bribed: false, fights: 0
      };
    }
    this.completedEvents = [];
    this.stashes = {};
    this.flags = {};
    this.playerFaction = null;
    this.currentRoom = 'cellblock';
    this.lockdown = false;
    this.playerName = 'Inmate';
    this.crime = 'Unknown Charges';
    this.appearance = { height: 1.0, skin: 0xe0ac69, hair: 0x2b1d0e, hairStyle: 'short', uniform: 0xd86a2c };
    this.dayCrime = false;
    this.dayClean = true;
    this.deadNPCs = [];
    this.bodyCount = 0;
    this.run = defaultRun();
    this.missions = [];
  }

  mem(id: string): NPCMemory {
    if (!this.npcMemory[id]) {
      this.npcMemory[id] = { relationship: 0, attacked: false, helped: false, robbed: false, traded: false, insulted: false, bribed: false, fights: 0 };
    }
    return this.npcMemory[id];
  }

  changeFactionRep(f: FactionId, delta: number) {
    this.factionRep[f] = clamp((this.factionRep[f] ?? 0) + delta, -100, 100);
  }

  changeRelationship(id: string, delta: number) {
    const m = this.mem(id);
    m.relationship = clamp(m.relationship + delta, -100, 100);
  }

  // Clamp & derive stats
  clampStats() {
    const s = this.stats;
    s.health = clamp(s.health, 0, s.maxHealth);
    s.stamina = clamp(s.stamina, 0, s.maxStamina);
    s.hunger = clamp(s.hunger, 0, 100);
    s.mood = clamp(s.mood, 0, 100);
    s.heat = clamp(s.heat, 0, 100);
    s.injury = clamp(s.injury, 0, 100);
    s.fatigue = clamp(s.fatigue, 0, 100);
    s.reputation = clamp(s.reputation, -100, 100);
    s.respect = clamp(s.respect, 0, 100);
    s.fear = clamp(s.fear, 0, 100);
    s.influence = clamp(s.influence, 0, 100);
    s.money = Math.max(0, Math.round(s.money));
    s.maxStamina = 100 + s.agility * 4;
    s.maxHealth = 100 + s.toughness * 6;
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function relLevel(v: number): RelationshipLevel {
  if (v <= -70) return 'enemy';
  if (v <= -40) return 'hostile';
  if (v <= -10) return 'unfriendly';
  if (v < 15) return 'neutral';
  if (v < 45) return 'friendly';
  if (v < 80) return 'ally';
  return 'loyal';
}
