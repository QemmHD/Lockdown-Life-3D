import type { Entity } from './world';

// Plain-data components. Component names are the string keys used with ECS.

export interface Position { x: number; z: number; facing: number; }

export interface Render { kind: 'prisoner' | 'guard'; color: number; meshId: number; }

export interface Agent {
  speed: number;
  path: number[] | null;   // tile indices to walk
  step: number;
  repathCd: number;        // cooldown before recomputing a route
}

export interface Needs {
  hunger: number; sleep: number; hygiene: number; energy: number;
  anger: number; fear: number; health: number;
}

export type BrainState = 'idle' | 'goto' | 'wander' | 'fight' | 'respond' | 'down' | 'solitary'
  | 'talking' | 'threatening' | 'trading' | 'working' | 'resting' | 'washing' | 'eating' | 'training'
  | 'searching' | 'beingSearched' | 'escorting' | 'escorted' | 'backoff';

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
}

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
