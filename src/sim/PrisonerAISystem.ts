// Prisoner intent scoring (Stage 3.2) — pure, lightweight (no GOAP planner).
// The Simulation gathers a flat context and this picks the highest-scoring intent.
import { PrisonerIntent } from './AIIntent';

export interface PrisonerCtx {
  phase: string;          // schedule phase id
  lockdown: boolean;
  riot: 'calm' | 'warning' | 'event';
  anger: number;          // 0..1
  fear: number;           // 0..1
  enemyNear: boolean;     // a gang rival / remembered foe within sight
  fightNear: boolean;     // an active brawl within sight
  allyNear: boolean;      // a gang ally / friend within sight
  tough: boolean;         // tough/fighter/aggressive trait
  coward: boolean;        // cowardly/weak trait
  social: boolean;        // free-ish phase where socialising fits
  guardNear: boolean;     // a guard within close range
}

// Returns the prisoner's current high-level intent. Order roughly follows urgency, with light
// trait/mood scoring for the social/avoid choices so behaviour varies between inmates.
// `roll` is a 0..1 value from the sim's seeded RNG (keeps choices deterministic).
export function choosePrisonerIntent(c: PrisonerCtx, roll: number): PrisonerIntent {
  // chaos overrides
  if (c.lockdown) return 'returnCell';
  if (c.riot === 'event') return c.coward || c.fear > 0.6 ? 'hide' : (c.guardNear ? 'comply' : 'wander');
  if (c.fightNear) {
    if (c.coward || c.fear > 0.55) return 'fleeDanger';
    return c.tough || c.anger > 0.6 ? 'watchFight' : 'avoidEnemy';
  }
  if (c.enemyNear) {
    return (c.coward || c.fear > 0.5) ? 'avoidEnemy' : (c.tough && c.anger > 0.4 ? 'watchFight' : 'avoidEnemy');
  }
  // calm social life during loose phases
  if (c.social && c.allyNear && !c.guardNear) return 'group';
  if (c.social && c.anger < 0.5) return roll < 0.4 ? 'socialize' : 'schedule';
  return 'schedule';
}
