// New-game / character-creation data model (Stage 3.5). Pure data + helpers — no sim/render dependency.
// All fictional, abstract game-life flavour (no real-world crime/escape detail).

export type Build = 'slim' | 'average' | 'stocky';
export interface Appearance { skin: number; hair: number; accent: number; build: Build; }

export interface NewGameSetup {
  name: string; nickname: string;
  appearance: Appearance;
  traits: string[];      // 2 positive/neutral trait ids
  weakness: string;      // 1 weakness id
  backstory: string;     // backstory id
  gangLean: string;      // 'none' or a gang id
  difficulty: string;    // difficulty id
  seed: number;
  tutorialTips: boolean;
  chaosIntensity: string; // 'low' | 'normal' | 'high'
  createdAt: number;
}

export const SKINS = [0xf0c9a0, 0xe6b58c, 0xc8895c, 0x9c6b3f, 0x6f4a2b, 0x4a3322];
export const HAIRS = [0x14110d, 0x4a3526, 0x6e5a3c, 0x9a9a9a, 0xb5413a, 0xd8a72c];
export const ACCENTS = [0xc98a3a, 0x3f6fa5, 0xb5413a, 0x6f9a72, 0x8a7a5a, 0x9aa0a6, 0xef7a22];
export const BUILDS: Build[] = ['slim', 'average', 'stocky'];

// trait id -> { label, desc, sim tokens it maps to so existing systems react }
export interface TraitDef { id: string; label: string; desc: string; sim: string[]; }
export const POS_TRAITS: TraitDef[] = [
  { id: 'tough', label: 'Tough', desc: 'Takes hits better; harder to knock down.', sim: ['tough'] },
  { id: 'fast', label: 'Fast', desc: 'Moves quicker; dodges more.', sim: ['fast'] },
  { id: 'calm', label: 'Calm', desc: 'Anger rises slowly; calms others well.', sim: ['calm'] },
  { id: 'clever', label: 'Clever', desc: 'Better trades/favours; harder to catch.', sim: ['clever'] },
  { id: 'loyal', label: 'Loyal', desc: 'Allies stick with you.', sim: ['loyal'] },
  { id: 'worker', label: 'Hard Worker', desc: 'Jobs pay more.', sim: ['worker'] },
  { id: 'talker', label: 'Smooth Talker', desc: 'Better talk/favour/calm odds.', sim: ['talker'] },
  { id: 'watchful', label: 'Watchful', desc: 'Less likely to be searched.', sim: ['watchful'] },
  { id: 'scrappy', label: 'Scrappy', desc: 'Holds their own in a brawl.', sim: ['fighter'] },
  { id: 'quiet', label: 'Quiet', desc: 'Draws less suspicion.', sim: ['quiet'] }
];
export const NEG_TRAITS: TraitDef[] = [
  { id: 'hothead', label: 'Hothead', desc: 'Anger spikes; more fights.', sim: ['aggressive'] },
  { id: 'cowardly', label: 'Cowardly', desc: 'Fears trouble; flees and backs off.', sim: ['cowardly'] },
  { id: 'unstable', label: 'Unstable', desc: 'Unpredictable moods.', sim: ['unstable'] },
  { id: 'weak', label: 'Weak', desc: 'Hits land softer; knocked down sooner.', sim: ['weak'] },
  { id: 'lazy', label: 'Lazy', desc: 'Jobs pay less.', sim: ['lazy'] },
  { id: 'paranoid', label: 'Paranoid', desc: 'Fear runs high.', sim: ['paranoid'] },
  { id: 'clumsy', label: 'Clumsy', desc: 'Dodges less.', sim: ['clumsy'] },
  { id: 'hated', label: 'Hated', desc: 'Inmates start colder toward you.', sim: ['hated'] },
  { id: 'slow', label: 'Slow', desc: 'Moves slower.', sim: ['slow'] },
  { id: 'magnet', label: 'Trouble Magnet', desc: 'Guards watch you more.', sim: ['magnet'] }
];
export const TRAIT_LABEL: Record<string, string> = Object.fromEntries([...POS_TRAITS, ...NEG_TRAITS].map((t) => [t.id, t.label]));
export function traitSimTokens(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) { const d = [...POS_TRAITS, ...NEG_TRAITS].find((t) => t.id === id); if (d) { out.push(id, ...d.sim); } }
  return [...new Set(out)];
}

export interface BackstoryDef {
  id: string; name: string; desc: string;
  rep: number; respect: number; suspicion: number; money: number;
  item?: string; gangBias?: string; objectives: string[]; trait?: string;
}
export const BACKSTORIES: BackstoryDef[] = [
  { id: 'firsttimer', name: 'First Timer', desc: 'Fresh fish. Low profile, lots to learn.', rep: 0, respect: 5, suspicion: 0, money: 4, objectives: ['eat', 'talk', 'returncell', 'survive'] },
  { id: 'streetkid', name: 'Street Kid', desc: 'Quick and wary; used to scraping by.', rep: 2, respect: 12, suspicion: 5, money: 6, trait: 'fast', objectives: ['talk', 'earn', 'survive'] },
  { id: 'worker', name: 'Former Worker', desc: 'Knows how to put in a shift.', rep: 1, respect: 10, suspicion: 0, money: 10, trait: 'worker', objectives: ['job', 'earn', 'survive'] },
  { id: 'yardfighter', name: 'Yard Fighter', desc: 'Carries a reputation for throwing hands.', rep: 4, respect: 28, suspicion: 8, money: 4, trait: 'scrappy', objectives: ['train', 'respect', 'survive'] },
  { id: 'planner', name: 'Quiet Planner', desc: 'Watches, waits, stays clean.', rep: 1, respect: 12, suspicion: -5, money: 8, trait: 'watchful', objectives: ['wash', 'job', 'survive'] },
  { id: 'associate', name: 'Gang Associate', desc: 'Has friends — and enemies — inside.', rep: 6, respect: 18, suspicion: 10, money: 6, gangBias: 'auto', objectives: ['talk', 'respect', 'survive'] },
  { id: 'lonewolf', name: 'Lone Wolf', desc: 'Trusts no one; steady nerves.', rep: 2, respect: 16, suspicion: 0, money: 6, trait: 'calm', objectives: ['rest', 'survive'] },
  { id: 'shortfuse', name: 'Short Fuse', desc: 'Tough but quick to anger.', rep: 3, respect: 20, suspicion: 6, money: 4, trait: 'tough', objectives: ['train', 'survive'] }
];

export const GANG_LEANS = ['none', 'iron_block', 'yard_kings', 'blue_chain', 'redline_crew', 'north_hall', 'cell_rats'];

export interface DiffDef { id: string; name: string; heatMul: number; searchAt: number; riotMul: number; rewardMul: number; decayMul: number; moneyMul: number; }
export const DIFFICULTIES: DiffDef[] = [
  { id: 'easy', name: 'Easy Time', heatMul: 0.7, searchAt: 60, riotMul: 0.8, rewardMul: 1.3, decayMul: 0.85, moneyMul: 1.5 },
  { id: 'standard', name: 'Standard', heatMul: 1.0, searchAt: 45, riotMul: 1.0, rewardMul: 1.0, decayMul: 1.0, moneyMul: 1.0 },
  { id: 'hard', name: 'Hard Time', heatMul: 1.3, searchAt: 36, riotMul: 1.2, rewardMul: 0.85, decayMul: 1.2, moneyMul: 0.75 },
  { id: 'nightmare', name: 'Nightmare Block', heatMul: 1.6, searchAt: 28, riotMul: 1.4, rewardMul: 0.7, decayMul: 1.4, moneyMul: 0.5 }
];
export function diffDef(id: string): DiffDef { return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]; }
export function backstoryDef(id: string): BackstoryDef { return BACKSTORIES.find((b) => b.id === id) ?? BACKSTORIES[0]; }

const NAMES = ['Rook', 'Mason', 'Knox', 'Diesel', 'Tully', 'Vince', 'Cane', 'Marco', 'Hodge', 'Slim', 'Boone', 'Reyes', 'Gable', 'Otis', 'Wyatt', 'Dane'];
const NICKS = ['Ghost', 'Tank', 'Spider', 'Lucky', 'Ace', 'Shadow', 'Bull', 'Whisper', 'Razor', 'Snake'];

export function defaultSetup(): NewGameSetup {
  return {
    name: 'Knox', nickname: '', appearance: { skin: SKINS[1], hair: HAIRS[1], accent: ACCENTS[0], build: 'average' },
    traits: ['tough', 'calm'], weakness: 'hothead', backstory: 'firsttimer', gangLean: 'none',
    difficulty: 'standard', seed: 0, tutorialTips: true, chaosIntensity: 'normal', createdAt: Date.now()
  };
}

export function randomSetup(roll: () => number): NewGameSetup {
  const pick = <T>(a: T[]) => a[Math.floor(roll() * a.length)];
  const pos = POS_TRAITS.map((t) => t.id); const t1 = pick(pos); let t2 = pick(pos); if (t2 === t1) t2 = pos[(pos.indexOf(t1) + 1) % pos.length];
  return {
    name: pick(NAMES), nickname: roll() < 0.4 ? pick(NICKS) : '',
    appearance: { skin: pick(SKINS), hair: pick(HAIRS), accent: pick(ACCENTS), build: pick(BUILDS) },
    traits: [t1, t2], weakness: pick(NEG_TRAITS).id, backstory: pick(BACKSTORIES).id,
    gangLean: roll() < 0.5 ? 'none' : pick(GANG_LEANS.slice(1)), difficulty: 'standard',
    seed: Math.floor(roll() * 1e9), tutorialTips: true, chaosIntensity: 'normal', createdAt: Date.now()
  };
}

export function sanitizeSetup(d: any): NewGameSetup {
  const base = defaultSetup(); if (!d || typeof d !== 'object') return base;
  const s = base;
  if (typeof d.name === 'string' && d.name.trim()) s.name = d.name.trim().slice(0, 16);
  if (typeof d.nickname === 'string') s.nickname = d.nickname.trim().slice(0, 14);
  if (d.appearance && typeof d.appearance === 'object') s.appearance = { skin: +d.appearance.skin || base.appearance.skin, hair: +d.appearance.hair || base.appearance.hair, accent: +d.appearance.accent || base.appearance.accent, build: BUILDS.includes(d.appearance.build) ? d.appearance.build : 'average' };
  if (Array.isArray(d.traits)) s.traits = d.traits.filter((t: any) => typeof t === 'string').slice(0, 2);
  if (typeof d.weakness === 'string') s.weakness = d.weakness;
  if (typeof d.backstory === 'string') s.backstory = d.backstory;
  if (typeof d.gangLean === 'string') s.gangLean = d.gangLean;
  if (typeof d.difficulty === 'string') s.difficulty = d.difficulty;
  if (typeof d.seed === 'number') s.seed = d.seed;
  if (typeof d.tutorialTips === 'boolean') s.tutorialTips = d.tutorialTips;
  if (typeof d.chaosIntensity === 'string') s.chaosIntensity = d.chaosIntensity;
  return s;
}
