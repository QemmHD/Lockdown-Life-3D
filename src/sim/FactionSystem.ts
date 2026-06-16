// Gang membership / faction progression (Stage 3.6) — pure data + helpers. No sim/render dependency.
// Fictional, abstract game-life only. The Simulation owns the live PlayerGangState.

export interface PlayerGangState {
  membership: string;                 // gang id, or '' = unaffiliated
  lean: string;                       // starting lean from character creation ('' = none)
  rank: number;                       // index into RANKS
  standing: Record<string, number>;   // gang id -> -100..100
  joinedDay: number;
  goalsDone: number;                  // completed gang goals (drives rank)
  invite: { gang: string; by: number; expires: number } | null;
  cd: { invite: number; rival: number; task: number };  // cooldowns (sim-seconds)
}

export const RANKS = ['None', 'Associate', 'Member', 'Trusted', 'Enforcer', 'Shot Caller'];
export const RANK_DESC = [
  'Not in a crew.', 'On the edges — running with them.', 'One of the crew now.',
  'They trust you with more.', 'You enforce the crew\'s name.', 'You call shots on the block.'
];

export const INVITE_STANDING = 35;     // standing needed before a crew will consider you
export const INVITE_RESPECT = 25;
export const INVITE_LIFE = 45;         // sim-seconds an invitation stays open
export const INVITE_CD = 60;           // gap between invitation attempts

// per-gang standing → readable label
export function standingLabel(v: number): string {
  if (v <= -60) return 'Hated';
  if (v <= -30) return 'Hostile';
  if (v <= -12) return 'Watched';
  if (v < 12) return 'Neutral';
  if (v < 35) return 'Known';
  if (v < 60) return 'Trusted';
  return 'Allied';
}

// derive rank from membership + standing + respect + completed goals (small, slow)
export function rankFromState(membership: string, standing: number, respect: number, goalsDone: number): number {
  if (!membership) return 0;
  let r = 1; // Associate on join
  if (standing >= 45 && respect >= 30) r = 2;             // Member
  if (standing >= 60 && respect >= 45 && goalsDone >= 2) r = 3; // Trusted
  if (standing >= 76 && respect >= 60 && goalsDone >= 4) r = 4; // Enforcer
  if (standing >= 90 && respect >= 75 && goalsDone >= 6) r = 5; // Shot Caller
  return r;
}

// small, readable perks unlocked by rank (display + light gameplay handled in the sim)
export function perksForRank(rank: number): string[] {
  const out: string[] = [];
  if (rank >= 1) out.push('Crew members trade & do favours more readily');
  if (rank >= 2) out.push('Allies cluster near you and watch your back');
  if (rank >= 3) out.push('You can calm allies in a standoff more easily');
  if (rank >= 4) out.push('Rivals think twice — but guards watch you more');
  if (rank >= 5) out.push('Your name carries the block (extra respect from crew)');
  return out;
}

// gang goal templates — kinds match the sim's progression event hooks
export interface GangGoalTpl { id: string; text: string; kind: string; goal: number; reward: { money?: number; rep?: number; respect?: number }; }
const GANG_GOALS: GangGoalTpl[] = [
  { id: 'g_talk', text: 'Talk to two of your crew', kind: 'talk', goal: 2, reward: { respect: 2 } },
  { id: 'g_train', text: 'Train to stay sharp', kind: 'train', goal: 1, reward: { respect: 1 } },
  { id: 'g_respect', text: 'Earn +5 respect for the crew', kind: 'respect', goal: 5, reward: { rep: 2 } },
  { id: 'g_job', text: 'Pull a work shift', kind: 'job', goal: 1, reward: { money: 3 } },
  { id: 'g_defuse', text: 'Defuse a standoff', kind: 'defuse', goal: 1, reward: { respect: 2 } }
];
export function rollGangGoals(rollFn: () => number): { id: string; text: string; kind: string; goal: number; progress: number; done: boolean; reward: any; gang: boolean }[] {
  const pool = GANG_GOALS.slice(); const out: any[] = [];
  for (let i = 0; i < 2 && pool.length; i++) { const t = pool.splice(Math.floor(rollFn() * pool.length), 1)[0]; out.push({ id: t.id, text: t.text, kind: t.kind, goal: t.goal, progress: 0, done: false, reward: t.reward, gang: true }); }
  return out;
}

export function newGangState(): PlayerGangState {
  return { membership: '', lean: '', rank: 0, standing: {}, joinedDay: 0, goalsDone: 0, invite: null, cd: { invite: 0, rival: 0, task: 0 } };
}

export function sanitizeGangState(d: any): PlayerGangState {
  const g = newGangState(); if (!d || typeof d !== 'object') return g;
  if (typeof d.membership === 'string') g.membership = d.membership;
  if (typeof d.lean === 'string') g.lean = d.lean;
  if (typeof d.rank === 'number') g.rank = Math.max(0, Math.min(5, Math.round(d.rank)));
  if (d.standing && typeof d.standing === 'object') for (const k in d.standing) { const v = d.standing[k]; if (typeof v === 'number' && isFinite(v)) g.standing[k] = Math.max(-100, Math.min(100, v)); }
  if (typeof d.joinedDay === 'number') g.joinedDay = d.joinedDay;
  if (typeof d.goalsDone === 'number') g.goalsDone = Math.max(0, d.goalsDone);
  g.invite = null;   // invitations are transient — never restore a stale one
  return g;
}
