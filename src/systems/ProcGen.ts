import { RNG } from '../game/RNG';
import { GameState } from '../game/GameState';
import { FACTIONS, PLAYABLE_FACTIONS } from '../data/factions';
import { ROOMS } from '../data/rooms';
import { ITEMS } from '../data/items';
import { NPCS } from '../data/npcs';
import type { RunState, FactionRunState, DailyModifier } from '../game/types';

export const WORLD_STATES = [
  { id: 'cold_war', name: 'Cold War', desc: 'Two gangs circle each other. One spark and the block blows.' },
  { id: 'gang_war', name: 'Open Gang War', desc: 'Blood in the halls. Fights everywhere, guards on edge.' },
  { id: 'crackdown', name: 'Guard Crackdown', desc: 'Extra patrols and searches. Contraband is risky and pricey.' },
  { id: 'contraband_boom', name: 'Contraband Boom', desc: 'Product is everywhere and cheap. Traders are flush.' },
  { id: 'debt_crisis', name: 'Debt Crisis', desc: 'Everyone owes someone. Collectors are out in force.' },
  { id: 'new_leader', name: 'A New Leader Rises', desc: 'A power vacuum. Recruiters are hungry and reckless.' },
  { id: 'racket', name: 'Protection Racket', desc: 'Pay up or get hurt. The weak are being squeezed.' },
  { id: 'peace', name: 'Uneasy Peace', desc: 'A fragile truce holds. For now, the yard is calm.' },
  { id: 'tension', name: 'Prison-Wide Tension', desc: 'Something is about to break. Everyone feels it.' }
];

export const DAILY_MODIFIERS: DailyModifier[] = [
  { id: 'extra_patrols', name: 'Extra Patrols', desc: 'More guards on the floor. Heat builds faster.' },
  { id: 'low_food', name: 'Low Food Quality', desc: 'Slop today. Meals restore less hunger.' },
  { id: 'gym_closed', name: 'Gym Closed', desc: 'The gym is shut for repairs. Train elsewhere.' },
  { id: 'yard_extended', name: 'Extended Yard', desc: 'Long yard time. More room to roam and scheme.' },
  { id: 'inspection', name: 'Surprise Inspection', desc: 'A search is coming. Hide your contraband.' },
  { id: 'sweep', name: 'Contraband Sweep', desc: 'Guards are confiscating product all day.' },
  { id: 'hot_day', name: 'Hot Day', desc: 'Sweltering. Stamina drains faster.' },
  { id: 'tension_high', name: 'High Tension', desc: 'Tempers are short. Fights break out more.' },
  { id: 'warden_present', name: 'Warden Present', desc: 'The Warden walks the block. Best behavior.' },
  { id: 'short_staff', name: 'Guard Shortage', desc: 'Fewer guards. Crime is easier to get away with.' },
  { id: 'black_market', name: 'Black Market Day', desc: 'Traders cut deals. Contraband is cheaper.' },
  { id: 'workshop_ot', name: 'Workshop Overtime', desc: 'Extra pay for work shifts today.' },
  { id: 'lockdown_drill', name: 'Lockdown Drill', desc: 'Random drills may send everyone to cells.' },
  { id: 'new_batch', name: 'New Inmates', desc: 'Fresh fish arrive. Bullies are circling.' },
  { id: 'calm', name: 'Quiet Day', desc: 'Nothing unusual on the schedule. Use it well.' }
];

const INMATE_TRAITS = ['hotheaded', 'cowardly', 'greedy', 'loyal', 'snitch', 'quiet', 'manipulative', 'friendly', 'unstable', 'protective', 'workout_addict', 'debt_collector', 'gambler', 'trader', 'runner', 'sickly', 'popular', 'hated', 'ex_gang', 'informant', 'escape_obsessed'];
const GUARD_TRAITS = ['strict', 'lazy', 'corrupt', 'fair', 'aggressive', 'nervous', 'bribable', 'watchful', 'forgetful', 'rule_obsessed', 'biased', 'short_temper'];

const LEADER_NAMES = ['Caz', 'Big Tony', 'Mama Reyes', 'Switch', 'Cobra', 'Deacon', 'Mad Dog', 'The Professor', 'Ice', 'Slick', 'Bones', 'Tiny', 'Hawk', 'Reaper', 'King Mensah'];
const FIRST = ['Spike', 'Diesel', 'Razor', 'Snake', 'Ace', 'Bishop', 'Cyrus', 'Mako', 'Vega', 'Knox', 'Rook', 'Tex', 'Grim', 'Blaze', 'Moose', 'Lonnie', 'Trey', 'Dom', 'Hector', 'Wes', 'Otis', 'Marco'];
const NICKS = ['the Knife', 'Two-Time', 'Lights-Out', 'Whisper', 'Hammer', 'Sleepy', 'Lucky', 'Doc', 'Ghost', 'Slim', 'Tank', 'Quick', 'Smiley', 'Cash'];
const GOALS = ['take the yard', 'corner the contraband trade', 'run the phones', 'recruit new blood', 'settle an old score', 'broker a truce', 'break someone out'];
const WEAKNESSES = ['short on numbers', 'deep in debt', 'a snitch in the ranks', 'a sick leader', 'losing territory', 'splintering over leadership'];

const CONTRA = Object.keys(ITEMS).filter((id) => ITEMS[id].contraband);
const ROOM_NAMES: Record<string, string> = Object.fromEntries(ROOMS.map((r) => [r.id, r.name]));

function genFaction(rng: RNG, fid: string): FactionRunState {
  const others = PLAYABLE_FACTIONS.filter((f) => f !== fid);
  const base = FACTIONS[fid as keyof typeof FACTIONS];
  const terr = base.territory.length ? base.territory : ['yard'];
  return {
    leader: rng.choice(LEADER_NAMES),
    members: rng.int(2, 6),
    territory: terr,
    enemy: rng.choice(others),
    ally: rng.choice(others),
    specialty: rng.choice(CONTRA),
    hangout: rng.choice(terr),
    goal: rng.choice(GOALS),
    weakness: rng.choice(WEAKNESSES),
    attitude: rng.int(-20, 20)
  };
}

export function genRumor(rng: RNG, state: GameState): string {
  const f = rng.choice(PLAYABLE_FACTIONS);
  const fr = state.run.factions[f];
  const fname = FACTIONS[f].name;
  const templates = [
    `Word is the ${fname} are planning to ${fr?.goal ?? 'make a move'}.`,
    `They say ${fr?.leader ?? 'someone'} is ${fr?.weakness ?? 'in trouble'}.`,
    `Heard there's a stash hidden in the ${ROOM_NAMES[rng.choice(['storage', 'shower', 'maintenance', 'kitchen'])]}.`,
    `Rumor: a search is coming. Better hide your product.`,
    `The ${fname} and the ${FACTIONS[fr?.enemy as keyof typeof FACTIONS]?.name ?? 'others'} are about to clash.`,
    `Somebody's price on ${ITEMS[rng.choice(CONTRA)].name} is about to spike.`,
    `A screw on night shift is taking bribes — easy heat to shed.`,
    `New fish coming in. The bullies are already circling.`,
    `Careful in the ${ROOM_NAMES[rng.choice(['shower', 'maintenance', 'yard'])]} — ambush territory.`,
    `Don't trust the quiet ones. One of them is talking to the guards.`
  ];
  return rng.choice(templates);
}

export function generateRun(state: GameState, seed: number) {
  const rng = new RNG(seed);
  const factions: Record<string, FactionRunState> = {};
  for (const f of PLAYABLE_FACTIONS) factions[f] = genFaction(rng, f);

  const economy: RunState['economy'] = {};
  for (const id of CONTRA) economy[id] = { value: ITEMS[id].value, supply: rng.int(25, 80), demand: rng.int(25, 80) };

  const npcTraits: Record<string, string> = {};
  const npcNames: Record<string, string> = {};
  for (const def of NPCS) {
    if (def.faction === 'staff') continue;
    const pool = def.faction === 'guards' ? GUARD_TRAITS : INMATE_TRAITS;
    npcTraits[def.id] = rng.choice(pool);
    // inmates sometimes get a procedural rename / nickname
    if (def.faction !== 'guards' && rng.chance(55)) {
      npcNames[def.id] = rng.chance(50)
        ? `${rng.choice(FIRST)} '${rng.choice(NICKS)}'`
        : rng.choice(FIRST);
    }
  }

  const ws = rng.choice(WORLD_STATES);
  state.run = {
    seed,
    worldState: ws.id,
    worldStateName: ws.name,
    worldStateDesc: ws.desc,
    factions,
    economy,
    dailyModifier: rng.choice(DAILY_MODIFIERS),
    npcTraits,
    npcNames,
    rumors: [],
    tomorrowRumor: '',
    bestEventToday: '',
    difficulty: 0.3
  };
  state.run.tomorrowRumor = genRumor(rng, state);
  // apply faction starting attitudes toward player
  for (const f of PLAYABLE_FACTIONS) state.factionRep[f] = (state.factionRep[f] ?? 0) + factions[f].attitude;
  state.missions = [];
}

// daily economy drift + new modifier + rotate rumor. Uses the run RNG passed in.
export function advanceDayProc(state: GameState, rng: RNG) {
  for (const id of CONTRA) {
    const e = state.run.economy[id];
    if (!e) continue;
    e.supply = clamp(e.supply + rng.int(-12, 16), 5, 100);
    e.demand = clamp(e.demand + rng.int(-12, 16), 5, 100);
  }
  // occasionally shift the world state
  if (rng.chance(22)) {
    const ws = rng.choice(WORLD_STATES);
    state.run.worldState = ws.id; state.run.worldStateName = ws.name; state.run.worldStateDesc = ws.desc;
  }
  let mod = rng.choice(DAILY_MODIFIERS);
  if (mod.id === state.run.dailyModifier.id) mod = rng.choice(DAILY_MODIFIERS);
  state.run.dailyModifier = mod;
  if (state.run.tomorrowRumor && !state.run.rumors.includes(state.run.tomorrowRumor)) state.run.rumors.push(state.run.tomorrowRumor);
  state.run.tomorrowRumor = genRumor(rng, state);
  state.run.bestEventToday = '';
}

// current contraband price given economy + world state + daily modifier
export function contrabandPrice(state: GameState, itemId: string): number {
  const base = ITEMS[itemId]?.value ?? 1;
  const e = state.run.economy[itemId];
  if (!e) return base;
  let factor = 1 + (e.demand - e.supply) / 120;
  if (state.run.worldState === 'contraband_boom') factor *= 0.8;
  if (state.run.worldState === 'crackdown') factor *= 1.4;
  if (state.run.worldState === 'debt_crisis') factor *= 1.15;
  if (state.run.dailyModifier.id === 'black_market') factor *= 0.85;
  if (state.run.dailyModifier.id === 'sweep') factor *= 1.3;
  factor = clamp(factor, 0.5, 2.6);
  return Math.max(1, Math.round(base * factor));
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
