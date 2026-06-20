import type { Entity } from './world';

// Plain-data components. Component names are the string keys used with ECS.

export interface Position { x: number; z: number; facing: number; }

export interface Appearance { skin: number; hair: number; accent: number; build: 'slim' | 'average' | 'stocky'; }
export interface Render { kind: 'prisoner' | 'guard'; color: number; meshId: number; appearance?: Appearance; }

export interface Agent {
  speed: number;
  path: number[] | null;   // tile indices to walk
  step: number;
  repathCd: number;        // cooldown before recomputing a route
}

export interface Needs {
  hunger: number; sleep: number; hygiene: number; energy: number;
  anger: number; fear: number; health: number;
  morale?: number;   // ---- Stage 4.13 ---- Spirit/mind bar: high → adrenaline buff, low → breakdown debuff
}

export type BrainState = 'idle' | 'goto' | 'wander' | 'fight' | 'respond' | 'down' | 'solitary'
  | 'talking' | 'threatening' | 'trading' | 'working' | 'resting' | 'washing' | 'eating' | 'training'
  | 'searching' | 'beingSearched' | 'escorting' | 'escorted' | 'backoff' | 'breakdown' | 'investigate';

export interface Brain {
  role: 'prisoner' | 'guard';
  state: BrainState;
  name: string;
  gang?: string;
  traits: string[];
  timer: number;
  targetRoom: string;
  foe?: Entity;            // combat / response target
  homeTile?: number;       // guard patrol anchor / prisoner cell
  attackCd: number;
  isPlayer?: boolean;      // the directly-controlled prisoner
  action?: string;         // human-readable current action (UI)
  discipline?: 'none' | 'solitary';
  discTimer?: number;      // seconds left in solitary
  escortTarget?: Entity;   // guard escorting this prisoner
  actTimer?: number;       // generic in-progress action timer (guard search etc.)
  objTarget?: string;      // interactable id this NPC is walking to / using (schedule)
  checkpoint?: number;     // guard: assigned checkpoint index during lockdown/alarm
  bubbleCd?: number;       // cooldown before this NPC may emit another complaint/panic bubble
  // ---- Stage 3.2 AI ----
  guardRole?: string;      // guard: current role (patrol/checkpoint/response/escort/search/desk/lockdown/riot)
  route?: number;          // guard: assigned patrol-route index
  routeStep?: number;      // guard: position within the route
  dwell?: number;          // guard: time left holding the current route post
  roleCd?: number;         // guard: stickiness — min time before switching role again
  intent?: string;         // prisoner: current high-level intent (AIIntent.PrisonerIntent)
  intentCd?: number;       // prisoner: time left before re-evaluating intent
  mem?: import('../sim/AIMemorySystem').AIMemory;  // prisoner: lightweight memory
  // ---- Stage 3.3 combat feel ----
  cphase?: string;         // current combat phase (CombatSystem.CombatPhase)
  cTimer?: number;         // time left in the current combat phase
  cResult?: string;        // last combat result text (panel/feedback)
  blockT?: number;         // active block window (player Block)
  pendingAtk?: string;     // player-queued attack type (strike/heavy/shove)
  lastAttacker?: Entity;   // who last struck this character
  injuredT?: number;       // ---- Stage 4.1 ---- seconds of lingering injury (weaker hits) after a beating
  breakdownT?: number;     // ---- Stage 4.15 ---- seconds left in a nervous breakdown (transient loss of control)
  investigateGiveup?: number; // ---- Stage 4.18 ---- seconds a guard chases a scattered fight before standing down
  // ---- Stage 4.29 combat depth (all transient, per-fight; not serialized) ----
  parryT?: number;         // active parry window after a timed Block
  dodgeT?: number;         // active dodge i-frame window
  momentum?: number;       // 0..1 combo/aggression meter (buffs damage; resets on being hit)
  momentumT?: number;      // momentum hold timer before it bleeds
  guardDmg?: number;       // accumulated guard damage from blocking; crossing 1 breaks the guard
  guardBroken?: number;    // seconds of guard-broken vulnerability (takes extra damage)
  bleedT?: number;         // ---- Stage 4.7 ---- seconds left bleeding from a sharp-weapon wound
  bleedRate?: number;      // health drained per second while bleeding
}

// ---- Stage 4.4 ---- persistent attributes (0..99, floor 30). "25% rule": effective = base*(0.75+0.25*energy).
// reputation lives on Social; these are the trainable physical/mental stats.
export interface Attributes { strength: number; agility: number; skill: number; stamina: number; }

// Reputation / standing / suspicion. On the player: reputation+respect drive the loop;
// on NPCs: respect = innate standing, rel = relationship toward the player.
export interface Social {
  reputation: number;   // -100..100 (player-facing standing)
  respect: number;      // 0..100 toughness/standing
  suspicion: number;    // 0..100 guard suspicion
  rel: number;          // -100..100 relationship toward player (NPCs)
}

export interface Inventory { items: string[]; money: number; }

export const NEED_KEYS: (keyof Needs)[] = ['hunger', 'sleep', 'hygiene', 'energy', 'anger', 'fear', 'health'];
