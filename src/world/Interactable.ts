// Interactable world-object model. Defs are produced by PropRenderer/Game; the live
// Interactable (with reservation/stash/state) is owned by the Simulation.
export type ObjType =
  | 'bed' | 'toilet' | 'sink' | 'shower' | 'counter' | 'table' | 'weights' | 'pullup'
  | 'desk' | 'shelf' | 'trash' | 'locker' | 'door' | 'gate' | 'job';

export interface InteractableDef {
  id: string;
  type: ObjType;
  name: string;
  room: string;
  x: number; z: number;     // object world position
  ix: number; iz: number;   // interaction point (where the user stands)
  facing: number;           // facing toward the object from the interaction point
  restricted?: boolean;
  jobRoom?: string;         // room-type whose job this object performs
}

export interface Interactable extends InteractableDef {
  reservedBy: number;       // entity id, 0 = free
  reservedUntil: number;
  open: boolean;            // doors/gates
  stash: string[];          // hidden item ids
}

// available actions per object type
export const OBJ_ACTIONS: Record<ObjType, string[]> = {
  bed: ['rest', 'hide', 'search'],
  toilet: ['use', 'hide', 'search'],
  sink: ['wash'],
  shower: ['wash'],
  counter: ['eat', 'work'],
  table: ['eat'],
  weights: ['train'],
  pullup: ['train'],
  desk: ['inspect'],
  shelf: ['work', 'search', 'hide'],
  trash: ['work', 'hide', 'search'],
  locker: ['hide', 'search'],
  door: ['inspect', 'use'],
  gate: ['inspect', 'use'],
  job: ['work']
};

export const OBJ_ACTION_LABEL: Record<string, string> = {
  rest: 'Rest', use: 'Use', hide: 'Hide Item', search: 'Search', wash: 'Wash',
  eat: 'Eat', work: 'Work', train: 'Train', inspect: 'Inspect', take: 'Take Item'
};
