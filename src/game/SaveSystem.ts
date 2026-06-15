import { GameState, SAVE_VERSION, SAVE_KEY } from './GameState';
import type { SaveData, SerializedNPC } from './types';
import type { Player } from '../entities/Player';
import type { NPC } from '../entities/NPC';

export class SaveSystem {
  static hasSave(): boolean {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  static save(state: GameState, player: Player, npcs: NPC[]): boolean {
    try {
      const npcState: Record<string, SerializedNPC> = {};
      for (const n of npcs) {
        npcState[n.def.id] = { id: n.def.id, x: n.x, z: n.z, health: n.health, ko: n.ko, koTimer: n.koTimer };
      }
      const data: SaveData = {
        version: SAVE_VERSION,
        day: state.day,
        timeOfDay: state.timeOfDay,
        phase: state.phase,
        sentenceDays: state.sentenceDays,
        playerName: state.playerName,
        crime: state.crime,
        appearance: state.appearance,
        stats: state.stats,
        player: { x: player.x, z: player.z },
        inventory: state.inventory,
        factionRep: state.factionRep,
        npcMemory: state.npcMemory,
        npcState,
        completedEvents: state.completedEvents,
        settings: state.settings,
        stashes: state.stashes,
        flags: { ...state.flags, playerFaction: state.playerFaction as any }
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  }

  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (!data || typeof data.version !== 'number') return null;
      if (data.version > SAVE_VERSION) return null; // newer than supported
      return data;
    } catch (e) {
      console.warn('Load failed', e);
      return null;
    }
  }

  static apply(state: GameState, data: SaveData) {
    state.reset();
    state.day = data.day ?? 1;
    state.timeOfDay = data.timeOfDay ?? 6;
    state.phase = data.phase ?? 'wakeup';
    state.sentenceDays = data.sentenceDays ?? 14;
    state.playerName = data.playerName ?? 'Inmate';
    state.crime = data.crime ?? 'Unknown Charges';
    if (data.appearance) state.appearance = data.appearance;
    Object.assign(state.stats, data.stats);
    state.inventory = data.inventory ?? [];
    Object.assign(state.factionRep, data.factionRep);
    Object.assign(state.npcMemory, data.npcMemory);
    state.completedEvents = data.completedEvents ?? [];
    Object.assign(state.settings, data.settings);
    state.stashes = data.stashes ?? {};
    state.flags = data.flags ?? {};
    state.playerFaction = (data.flags?.playerFaction as any) ?? null;
  }

  static clear() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
}
