// Prison-wide lockdown state — pure data + policy helpers (no sim/render dependency).
// The Simulation owns a LockdownState and drives it; these helpers keep the rules in one place.

export interface LockdownState {
  active: boolean;
  reason: string;
  severity: number;        // 1 = soft, 2 = standard, 3 = hard
  timer: number;           // sim-seconds remaining
  startedAtHour: number;
  scheduleOverride: boolean; // schedule movement is replaced by "return to cells"
  sourceRoom: string;      // optional originating room id
  fatigue: number;         // 0..1, grows the longer it stays active (feeds riot pressure)
}

export function newLockdown(): LockdownState {
  return { active: false, reason: '', severity: 0, timer: 0, startedAtHour: 0, scheduleOverride: false, sourceRoom: '', fatigue: 0 };
}

// how long a lockdown of a given severity lasts (sim-seconds; 1 sim-hour = 5s)
export const LOCKDOWN_SECONDS: Record<number, number> = { 1: 35, 2: 60, 3: 90 };
// quiet window after a lockdown lifts before a non-severe one can start again (no rapid loops)
export const LOCKDOWN_COOLDOWN = 40;

// Recreational areas lock during any lockdown; cell blocks stay reachable so prisoners can
// actually return to them. Restricted (staff-only) areas are handled by their own flag.
export function lockdownLocks(roomType: string): boolean {
  return roomType === 'cafeteria' || roomType === 'yard' || roomType === 'shower';
}

// Defensive load: coerce arbitrary saved data into a valid LockdownState.
export function sanitizeLockdown(d: any): LockdownState {
  const l = newLockdown();
  if (!d || typeof d !== 'object') return l;
  l.active = !!d.active;
  l.reason = typeof d.reason === 'string' ? d.reason : '';
  l.severity = clampInt(d.severity, 0, 3);
  l.timer = num(d.timer, 0);
  l.startedAtHour = num(d.startedAtHour, 0);
  l.scheduleOverride = !!d.scheduleOverride;
  l.sourceRoom = typeof d.sourceRoom === 'string' ? d.sourceRoom : '';
  l.fatigue = clamp01(num(d.fatigue, 0));
  if (l.active && l.timer <= 0) l.timer = LOCKDOWN_SECONDS[l.severity] ?? 40;
  return l;
}

function num(v: any, d: number) { return typeof v === 'number' && isFinite(v) ? v : d; }
function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clampInt(v: any, lo: number, hi: number) { const n = Math.round(num(v, 0)); return n < lo ? lo : n > hi ? hi : n; }
