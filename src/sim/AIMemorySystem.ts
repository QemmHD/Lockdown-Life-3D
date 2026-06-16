// Lightweight prisoner memory (Stage 3.2) — pure data + decay. Timers count down in sim-seconds;
// when a timer hits zero the matching reference is forgotten. No sim/render dependency.

export interface AIMemory {
  foe: number; foeT: number;        // last fight opponent
  threat: number; threatT: number;  // last person who insulted/threatened them
  ally: number; allyT: number;      // last helpful/friendly contact
  searchedT: number;                // recently searched by a guard
  fearT: number;                    // recent fear spike
  angerT: number;                   // recent anger spike
}

export function newMemory(): AIMemory {
  return { foe: 0, foeT: 0, threat: 0, threatT: 0, ally: 0, allyT: 0, searchedT: 0, fearT: 0, angerT: 0 };
}

export function decayMemory(m: AIMemory, dt: number) {
  if (m.foeT > 0 && (m.foeT -= dt) <= 0) { m.foe = 0; m.foeT = 0; }
  if (m.threatT > 0 && (m.threatT -= dt) <= 0) { m.threat = 0; m.threatT = 0; }
  if (m.allyT > 0 && (m.allyT -= dt) <= 0) { m.ally = 0; m.allyT = 0; }
  if (m.searchedT > 0) m.searchedT = Math.max(0, m.searchedT - dt);
  if (m.fearT > 0) m.fearT = Math.max(0, m.fearT - dt);
  if (m.angerT > 0) m.angerT = Math.max(0, m.angerT - dt);
}

export function rememberFoe(m: AIMemory, who: number, secs = 30) { m.foe = who; m.foeT = secs; m.angerT = Math.max(m.angerT, 12); }
export function rememberThreat(m: AIMemory, who: number, secs = 25) { m.threat = who; m.threatT = secs; m.fearT = Math.max(m.fearT, 8); }
export function rememberAlly(m: AIMemory, who: number, secs = 40) { m.ally = who; m.allyT = secs; }
export function rememberSearch(m: AIMemory, secs = 20) { m.searchedT = secs; }

// Defensive load: only keep stable, finite numbers (entity refs are reset — transient).
export function sanitizeMemory(d: any): AIMemory {
  const m = newMemory(); if (!d || typeof d !== 'object') return m;
  m.searchedT = n(d.searchedT); m.fearT = n(d.fearT); m.angerT = n(d.angerT);
  return m;
}
function n(v: any) { return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, 60) : 0; }
