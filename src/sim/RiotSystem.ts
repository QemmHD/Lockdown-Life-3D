// Riot pressure + area tension — pure helpers (no sim/render dependency).
// Pressure is a slowly-moving 0..1 value; the Simulation lerps toward computeRiotTarget each tick
// so it never jumps. Tension is a per-room 0..100 readability layer.

export type RiotLevel = 'calm' | 'warning' | 'event';

export const RIOT_WARN = 0.5;    // pressure at which a riot warning begins
export const RIOT_CRIT = 0.82;   // pressure at which a riot event can break out
// hysteresis: a level only drops once pressure falls well below its trigger, so it doesn't flicker
export const RIOT_WARN_OFF = 0.38;
export const RIOT_CRIT_OFF = 0.62;
// cooldowns (sim-seconds) before the same escalation can re-fire
export const RIOT_WARN_CD = 20;
export const RIOT_EVENT_CD = 45;

// level with hysteresis — needs the current level to know which threshold applies
export function riotLevelHyst(pressure: number, current: RiotLevel): RiotLevel {
  if (current === 'event') return pressure < RIOT_CRIT_OFF ? (pressure < RIOT_WARN_OFF ? 'calm' : 'warning') : 'event';
  if (current === 'warning') {
    if (pressure >= RIOT_CRIT) return 'event';
    return pressure < RIOT_WARN_OFF ? 'calm' : 'warning';
  }
  if (pressure >= RIOT_CRIT) return 'event';
  return pressure >= RIOT_WARN ? 'warning' : 'calm';
}

export interface RiotInputs {
  count: number;          // prisoner count
  anger: number;          // avg 0..1
  hunger: number;         // avg 0..1
  hygiene: number;        // avg 0..1 (high = dirty)
  sleep: number;          // avg 0..1 (high = tired)
  fightsRecent: number;   // decaying recent-fight tally
  blocked: number;        // prisoners blocked from their schedule destination
  searchesRecent: number; // decaying recent-search tally
  lockdownActive: boolean;
  lockdownFatigue: number; // 0..1 grows the longer a lockdown lasts
}

// Target pressure the current value eases toward. Causes are additive + clamped so it stays readable.
export function computeRiotTarget(i: RiotInputs): number {
  if (i.count <= 0) return 0;
  let t = 0;
  t += i.anger * 0.42;
  t += Math.max(0, i.hunger - 0.5) * 0.5;
  t += Math.max(0, i.hygiene - 0.6) * 0.18;
  t += Math.max(0, i.sleep - 0.6) * 0.18;
  t += Math.min(0.3, i.fightsRecent * 0.08);
  t += Math.min(0.25, (i.blocked / i.count) * 0.6);
  t += Math.min(0.15, i.searchesRecent * 0.05);
  if (i.lockdownActive) t += i.lockdownFatigue * 0.22;
  return clamp01(t);
}

export function riotLevel(pressure: number): RiotLevel {
  if (pressure >= RIOT_CRIT) return 'event';
  if (pressure >= RIOT_WARN) return 'warning';
  return 'calm';
}

export function tensionLabel(t: number): 'Calm' | 'Tense' | 'Dangerous' | 'Critical' {
  if (t >= 75) return 'Critical';
  if (t >= 50) return 'Dangerous';
  if (t >= 25) return 'Tense';
  return 'Calm';
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
