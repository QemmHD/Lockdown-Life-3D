// Group/crowd behaviour helpers (Stage 3.2) — pure geometry, no sim/render dependency.
// Used to spread inmates around an anchor (table/yard cluster) and to nudge standing characters
// out of exact overlap so crowds read as loose clusters rather than a single pile.

// a deterministic offset around an anchor, spiralling out by index so members don't share a tile
export function clusterOffset(i: number, radius = 1.5): { dx: number; dz: number } {
  if (i <= 0) return { dx: 0, dz: 0 };
  const ring = Math.ceil((Math.sqrt(i + 1) - 1));
  const ang = (i * 2.39996); // golden-angle spread
  const r = radius * (0.5 + ring * 0.5);
  return { dx: Math.cos(ang) * r, dz: Math.sin(ang) * r };
}

// small separation push away from the nearest crowding neighbour (or null if none too close)
export function separationNudge(px: number, pz: number, neighbors: { x: number; z: number }[], minDist = 0.7): { dx: number; dz: number } | null {
  let nx = 0, nz = 0, hits = 0;
  for (const o of neighbors) {
    const dx = px - o.x, dz = pz - o.z; const d = Math.hypot(dx, dz);
    if (d > 0.0001 && d < minDist) { nx += dx / d; nz += dz / d; hits++; }
  }
  if (!hits) return null;
  const m = Math.hypot(nx, nz) || 1;
  return { dx: (nx / m) * (minDist * 0.5), dz: (nz / m) * (minDist * 0.5) };
}
