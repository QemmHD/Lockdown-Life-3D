// Player progression, reputation tiers, objectives, and day-summary rating (Stage 3.4).
// Pure data + helpers — no sim/render dependency. The Simulation owns the live state.

export interface Progression {
  daysSurvived: number;
  objectivesCompleted: number;
  jobs: number;
  fights: number; wins: number; losses: number;
  searches: number; solitary: number; lockdowns: number;
  moneyEarned: number; moneySpent: number;
  bestTier: number;
  relImproved: number; relWorsened: number;
  contrabandIncidents: number; escapes: number;
  summariesShown: number;
}
export function newProgression(): Progression {
  return { daysSurvived: 0, objectivesCompleted: 0, jobs: 0, fights: 0, wins: 0, losses: 0, searches: 0, solitary: 0, lockdowns: 0, moneyEarned: 0, moneySpent: 0, bestTier: 0, relImproved: 0, relWorsened: 0, contrabandIncidents: 0, escapes: 0, summariesShown: 0 };
}
// coerce arbitrary saved data into a valid Progression (forward/backward compatible)
export function sanitizeProgression(d: any): Progression {
  const p = newProgression(); if (!d || typeof d !== 'object') return p;
  for (const k of Object.keys(p) as (keyof Progression)[]) if (typeof d[k] === 'number' && isFinite(d[k])) p[k] = d[k];
  return p;
}

// ---------- reputation / respect tiers ----------
export const REP_TIERS = ['Nobody', 'Known Face', 'Respected', 'Feared', 'Influential', 'Prison Legend'];
const TIER_AT = [0, 20, 38, 56, 74, 90];   // score thresholds
export const TIER_DESC = [
  'Just another fish. Keep your head down.',
  'People know your name on the block.',
  'Inmates give you room. You carry weight.',
  'They think twice before crossing you.',
  'You move the block. Gangs take notice.',
  'A name spoken across the whole prison.'
];
// 0..100 standing score from reputation (-100..100) + respect (0..100)
export function standingScore(reputation: number, respect: number): number {
  const r = (reputation + 100) / 2;   // 0..100
  return clamp(r * 0.5 + respect * 0.5, 0, 100);
}
export function repTier(reputation: number, respect: number) {
  const score = standingScore(reputation, respect);
  let i = 0; for (let t = 0; t < TIER_AT.length; t++) if (score >= TIER_AT[t]) i = t;
  const nextAt = i < TIER_AT.length - 1 ? TIER_AT[i + 1] : 100;
  const base = TIER_AT[i];
  const progress = nextAt > base ? clamp((score - base) / (nextAt - base), 0, 1) : 1;
  return { index: i, name: REP_TIERS[i], desc: TIER_DESC[i], score: Math.round(score), progress, next: i < REP_TIERS.length - 1 ? REP_TIERS[i + 1] : null };
}

// ---------- objectives ----------
export interface Objective { id: string; text: string; kind: string; goal: number; progress: number; done: boolean; reward: { money?: number; rep?: number; respect?: number }; gang?: boolean; }
interface ObjTemplate { id: string; text: string; kind: string; goal: number; reward: { money?: number; rep?: number; respect?: number }; }
// `kind` matches the event the Simulation bumps; "survive*" kinds resolve at day end.
const POOL: ObjTemplate[] = [
  { id: 'eat', text: 'Eat a meal', kind: 'eat', goal: 1, reward: { respect: 1 } },
  { id: 'wash', text: 'Wash up', kind: 'wash', goal: 1, reward: { respect: 1 } },
  { id: 'rest', text: 'Get some rest', kind: 'rest', goal: 1, reward: {} },
  { id: 'job', text: 'Complete a job', kind: 'job', goal: 1, reward: { money: 2, rep: 1 } },
  { id: 'talk', text: 'Talk to another inmate', kind: 'talk', goal: 1, reward: { respect: 1 } },
  { id: 'earn', text: 'Earn $5', kind: 'earn', goal: 5, reward: { respect: 1 } },
  { id: 'respect', text: 'Gain +5 respect', kind: 'respect', goal: 5, reward: { rep: 2 } },
  { id: 'train', text: 'Train once', kind: 'train', goal: 1, reward: { respect: 1 } },
  { id: 'returncell', text: 'Return to your cell during a lockdown', kind: 'returncell', goal: 1, reward: { respect: 1 } }
];
const SURVIVE: ObjTemplate = { id: 'survive', text: 'Make it through the day without solitary', kind: 'surviveNoSolitary', goal: 1, reward: { rep: 2, respect: 2 } };

// roll the day's objectives: a survival goal + a few rotating ones (deterministic via rollFn)
export function rollObjectives(rollFn: () => number, day: number): Objective[] {
  const picks: ObjTemplate[] = [SURVIVE];
  const pool = POOL.slice();
  const n = 2 + (day <= 1 ? 1 : Math.floor(rollFn() * 2)); // 2-3 rotating
  for (let i = 0; i < n && pool.length; i++) { const idx = Math.floor(rollFn() * pool.length); picks.push(pool.splice(idx, 1)[0]); }
  return picks.map((t) => ({ id: t.id, text: t.text, kind: t.kind, goal: t.goal, progress: 0, done: false, reward: t.reward }));
}

// build a specific objective set by id (backstory-seeded first objectives; falls back to a roll)
export function objectivesByIds(ids: string[]): Objective[] {
  const all = [...POOL, SURVIVE];
  const out: Objective[] = [];
  for (const id of ids) { const t = all.find((x) => x.id === id); if (t && !out.find((o) => o.id === t.id)) out.push({ id: t.id, text: t.text, kind: t.kind, goal: t.goal, progress: 0, done: false, reward: t.reward }); }
  return out.length ? out : rollObjectives(() => Math.random(), 1);
}

// ---------- daily summary ----------
export interface DailyStats { repStart: number; respStart: number; moneyStart: number; fights: number; wins: number; jobs: number; searches: number; contraband: number; solitary: number; lockdowns: number; objectivesDone: number; relImproved: number; }
export function newDaily(rep: number, resp: number, money: number): DailyStats {
  return { repStart: rep, respStart: resp, moneyStart: money, fights: 0, wins: 0, jobs: 0, searches: 0, contraband: 0, solitary: 0, lockdowns: 0, objectivesDone: 0, relImproved: 0 };
}
export function dayRating(d: DailyStats): string {
  if (d.solitary > 0) return 'Lockdown Magnet';
  if (d.lockdowns >= 2) return 'Troublemaker';
  if (d.wins >= 2) return 'Rising Name';
  if (d.fights >= 2) return 'Rough Day';
  if (d.jobs >= 1 || d.objectivesDone >= 2) return 'Survivor';
  return 'Quiet Day';
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
