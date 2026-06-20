// Combat feel (Stage 3.3) — pure phase/attack tables + outcome resolution. No sim/render dependency.
// The Simulation runs a per-fighter phase machine and applies these results; RenderSync animates the
// phases read-only. Deliberately abstract game combat — no real-world fighting detail.

export type CombatPhase = 'squareUp' | 'windup' | 'strike' | 'block' | 'dodge' | 'hitReact' | 'stumble' | 'recover';
export type AttackType = 'quick' | 'heavy' | 'shove' | 'grab';
export type CombatOutcome = 'hit' | 'glancing' | 'blocked' | 'dodged' | 'miss' | 'knockdown';

export interface AttackDef {
  windup: number; recover: number; stamina: number; hitChance: number;
  dmgMin: number; dmgMax: number; knockback: number; repWin: number;
}
export const ATTACKS: Record<AttackType, AttackDef> = {
  quick: { windup: 0.34, recover: 0.42, stamina: 0.04, hitChance: 0.74, dmgMin: 0.07, dmgMax: 0.13, knockback: 0.22, repWin: 1 },
  heavy: { windup: 0.70, recover: 0.70, stamina: 0.10, hitChance: 0.54, dmgMin: 0.15, dmgMax: 0.26, knockback: 0.75, repWin: 2 },
  shove: { windup: 0.24, recover: 0.40, stamina: 0.03, hitChance: 0.86, dmgMin: 0.00, dmgMax: 0.05, knockback: 0.95, repWin: 0 },
  // Stage 4.25 grapple: STR-contested throw resolved specially in Simulation.resolveGrab (slam + knockdown on a win)
  grab: { windup: 0.52, recover: 0.85, stamina: 0.12, hitChance: 0.70, dmgMin: 0.14, dmgMax: 0.24, knockback: 0.45, repWin: 2 }
};

export const COMBAT_SPACING = 1.15;     // desired distance between two fighters
export const SQUARE_UP = 0.5;           // dwell in the square-up stance between exchanges
export const HITREACT = 0.45;
export const STUMBLE = 0.7;
export const DOWN_TIME = 5;
export const RECOVER = 0.6;

export interface AtkCtx { anger: number; fear: number; energy: number; weapon: number; tough: boolean; aggressive: boolean; }
// pick an attack from mood/stamina/weapon (deterministic via the supplied roll)
export function chooseAttack(c: AtkCtx, roll: number): AttackType {
  if (c.energy < 0.12) return 'shove';                       // too gassed to swing
  if ((c.anger > 0.6 || c.aggressive) && roll < 0.4) return 'heavy';
  if (c.weapon > 0 && roll < 0.45) return 'heavy';
  if (roll < 0.16) return 'shove';
  return 'quick';
}

export interface DefCtx { fear: number; energy: number; coward: boolean; blocking: boolean; }
// resolve an attack against a defender using independent rolls (sim passes seeded RNG)
export function resolveDefense(atk: AttackType, d: DefCtx, blockRoll: number, dodgeRoll: number, hitRoll: number): CombatOutcome {
  if (d.blocking && blockRoll < 0.85) return 'blocked';
  const dodge = clampN(d.fear * 0.28 + (d.coward ? 0.18 : 0) + d.energy * 0.08, 0, 0.48);
  if (dodgeRoll < dodge) return 'dodged';
  const a = ATTACKS[atk];
  if (hitRoll > a.hitChance + 0.16) return 'miss';
  if (hitRoll > a.hitChance) return 'glancing';
  return 'hit';
}

export const OUTCOME_TEXT: Record<CombatOutcome, string> = {
  hit: '', glancing: 'Glancing', blocked: 'Blocked', dodged: 'Dodge', miss: 'Miss', knockdown: 'Down!'
};

function clampN(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
