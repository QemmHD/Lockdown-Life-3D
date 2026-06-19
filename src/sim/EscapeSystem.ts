// Abstract escape-attempt model — pure data + a fictional outcome roll.
// IMPORTANT: this is deliberately abstract game logic. No real-world escape methods, no lock/bypass
// detail, no route specifics — just stylised game actions and dice-roll outcomes.

export type EscapeOutcome = 'caught' | 'interrupted' | 'abandoned' | 'success';

// Abstract opportunity zones (perimeter/service transitions). The yard gate is the main one.
export const ESCAPE_OPPORTUNITY_ROOMS = ['yard', 'intake', 'storage'];
// quiet window (sim-seconds) after any escape attempt before another can occur (keeps it rare)
export const ESCAPE_COOLDOWN = 60;

export interface EscapeState {
  active: boolean;
  by: number;        // entity id attempting
  timer: number;     // sim-seconds left on the attempt
  spot: string;      // room id / opportunity label
  noticed: boolean;
}

export function newEscape(): EscapeState {
  return { active: false, by: 0, timer: 0, spot: '', noticed: false };
}

// Fictional outcome: attempts mostly fail. Success is rare and only when no guards are nearby.
export function rollEscapeOutcome(roll: number, guardsNear: number, aid = 0): EscapeOutcome {
  const r = Math.min(0.999, roll + aid);   // escape tools (file / lockpick / improvised tool) improve the odds
  if (guardsNear > 0) return r < 0.6 ? 'caught' : r < 0.92 ? 'interrupted' : 'success';
  if (r < 0.45) return 'caught';
  if (r < 0.8) return 'interrupted';
  if (r < 0.95) return 'abandoned';
  return 'success';
}

// Player-facing abstract action labels.
export const ESCAPE_LABELS: Record<string, string> = {
  escape: 'Attempt Escape',
  rushGate: 'Rush Gate',
  slipCheckpoint: 'Slip Checkpoint',
  hideService: 'Hide Near Service Door',
  abandonEscape: 'Abandon Attempt'
};

export function sanitizeEscape(d: any): EscapeState {
  const e = newEscape();
  if (!d || typeof d !== 'object') return e;
  // never restore an in-progress attempt — reset to a stable state on load
  e.active = false;
  return e;
}
