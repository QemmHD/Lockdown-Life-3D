// Guard patrol routes (Stage 3.2) — pure data. A route is a sequence of room TYPES a guard cycles
// through with a dwell at each. Spreading guards across different routes keeps them covering the
// prison instead of clumping. Role selection/priority stays in the Simulation (needs live state),
// but the route tables + labels live here.

// each route dwells mostly at destination zones (one hallway leg keeps them moving) so guards
// spread across the prison instead of bunching in the central corridor
export const GUARD_ROUTES: string[][] = [
  ['cafeteria', 'yard', 'cafeteria', 'hallway'],        // mess + yard beat
  ['cellblock', 'shower', 'cellblock', 'hallway'],      // housing + wet block
  ['guardroom', 'intake', 'storage', 'hallway'],        // security/admin loop
  ['yard', 'cellblock', 'cafeteria', 'hallway']         // perimeter sweep
];

export function routeFor(i: number): string[] { return GUARD_ROUTES[i % GUARD_ROUTES.length]; }

// guard decision priority — higher wins. Used to decide which single guard commits to an incident.
export const GUARD_PRIORITY = {
  escape: 100, riot: 90, fight: 80, search: 60, lockdown: 50, restricted: 40, tension: 30, patrol: 10, desk: 5
} as const;
