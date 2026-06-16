// Shared AI vocabulary (Stage 3.2): prisoner intents + guard roles + readable labels.
// Pure constants/types — no sim/render dependency.

export type PrisonerIntent =
  | 'schedule' | 'socialize' | 'group' | 'avoidEnemy' | 'watchFight' | 'fleeDanger'
  | 'returnCell' | 'hide' | 'comply' | 'wander';

export type GuardRole =
  | 'patrol' | 'checkpoint' | 'response' | 'escort' | 'search' | 'desk' | 'lockdown' | 'riot';

// short status text shown on the inspect panel / as the NPC's current action
export const INTENT_LABEL: Record<PrisonerIntent, string> = {
  schedule: 'On routine', socialize: 'Socializing', group: 'With the group', avoidEnemy: 'Avoiding trouble',
  watchFight: 'Watching', fleeDanger: 'Fleeing', returnCell: 'Returning to cell', hide: 'Hiding',
  comply: 'Complying', wander: 'Milling about'
};
export const ROLE_LABEL: Record<GuardRole, string> = {
  patrol: 'Patrolling', checkpoint: 'Holding checkpoint', response: 'Responding', escort: 'Escorting',
  search: 'Searching', desk: 'At security desk', lockdown: 'Lockdown post', riot: 'Riot response'
};

// how long a guard dwells at a route post before moving to the next (sim-seconds)
export const GUARD_DWELL = 4.5;
// minimum time a chosen intent/role sticks before it can change (anti-twitch)
export const INTENT_STICK = 2.5;
export const ROLE_STICK = 3.5;
