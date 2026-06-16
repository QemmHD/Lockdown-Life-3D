import { GameState, clamp } from '../game/GameState';
import type { StatKey } from '../game/types';

export interface TrainResult { ok: boolean; msg: string; stat?: StatKey; gain?: number; }

export class TrainingSystem {
  constructor(private state: GameState) {}

  // payload: 'strength' | 'combat' | 'agility' | 'intelligence' | 'mood' | 'rest'
  duration(kind: string) {
    if (kind === 'rest') return 3;
    return 2.8;
  }

  complete(kind: string): TrainResult {
    const s = this.state.stats;

    if (kind === 'rest') {
      s.health = clamp(s.health + 25, 0, s.maxHealth);
      s.injury = clamp(s.injury - 30, 0, 100);
      s.stamina = clamp(s.stamina + 30, 0, s.maxStamina);
      return { ok: true, msg: 'You rest up. Health and stamina recover.' };
    }
    if (kind === 'mood') {
      s.mood = clamp(s.mood + 22, 0, 100);
      return { ok: true, msg: 'A call home lifts your spirits. Mood up.' };
    }

    if (s.stamina < 15) return { ok: false, msg: 'Too exhausted to train. Eat and rest first.' };
    s.stamina = clamp(s.stamina - 20, 0, s.maxStamina);
    s.hunger = clamp(s.hunger - 6, 0, 100);

    const map: Record<string, StatKey> = { strength: 'strength', combat: 'strength', agility: 'agility', intelligence: 'intelligence' };
    const stat = map[kind] ?? 'strength';
    const key = `train_${stat}_day${this.state.day}`;
    const doneToday = (this.state.flags[key] as number) ?? 0;
    this.state.flags[key] = doneToday + 1;

    // diminishing returns within a day
    const chance = Math.max(0.15, 0.85 - doneToday * 0.2) * (s.mood > 40 ? 1 : 0.7);
    if (Math.random() < chance) {
      (s as any)[stat] += 1;
      if (kind === 'combat') s.toughness += Math.random() < 0.4 ? 1 : 0;
      if (kind === 'agility') s.stamina = clamp(s.stamina + 5, 0, s.maxStamina);
      s.mood = clamp(s.mood + 3, 0, 100);
      this.state.clampStats();
      return { ok: true, msg: `Hard work pays off. +1 ${stat}!`, stat, gain: 1 };
    }
    return { ok: true, msg: 'You grind through the set. No gain this time — keep at it.' };
  }
}
