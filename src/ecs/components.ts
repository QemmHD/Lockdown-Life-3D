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

export type BrainState = 'idle' | 'goto' | 'wander' | 'fight' | 'respond' | 'down';

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
}

export const NEED_KEYS: (keyof Needs)[] = ['hunger', 'sleep', 'hygiene', 'energy', 'anger', 'fear', 'health'];
