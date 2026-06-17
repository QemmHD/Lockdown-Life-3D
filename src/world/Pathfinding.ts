import { TileMap } from './TileMap';

// A* over the walkable grid (4-connected — clean for tile prisons, no corner-cutting).
// A tile is pathable only if it is floor AND free of prop solids (map.pathable). `canEnter`
// lets the caller veto tiles the grid would otherwise allow (e.g. a closed/locked door for a
// prisoner). The start tile is always allowed so an entity that begins on a now-blocked tile
// (door, or a prop footprint after a layout change) can still path away from it.
export function findPath(map: TileMap, startIdx: number, goalIdx: number, canEnter?: (idx: number) => boolean): number[] | null {
  if (startIdx === goalIdx) return [];
  if (startIdx < 0 || goalIdx < 0 || !map.pathable(goalIdx)) return null;
  if (canEnter && !canEnter(goalIdx)) return null;
  const W = map.width, H = map.height, N = W * H;
  const open: number[] = [startIdx];
  const came = new Int32Array(N).fill(-1);
  const g = new Float32Array(N).fill(Infinity);
  const f = new Float32Array(N).fill(Infinity);
  const inOpen = new Uint8Array(N);
  g[startIdx] = 0;
  const gx = goalIdx % W, gy = (goalIdx / W) | 0;
  f[startIdx] = Math.abs((startIdx % W) - gx) + Math.abs(((startIdx / W) | 0) - gy);
  inOpen[startIdx] = 1;

  while (open.length) {
    // pop lowest f (linear scan — grid is small)
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    inOpen[cur] = 0;
    if (cur === goalIdx) {
      const path: number[] = []; let c = cur;
      while (c !== startIdx) { path.push(c); c = came[c]; }
      return path.reverse();
    }
    const cx = cur % W, cy = (cur / W) | 0;
    const neigh = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (ni !== startIdx && !map.pathable(ni)) continue;
      if (canEnter && ni !== startIdx && !canEnter(ni)) continue;
      const ng = g[cur] + 1;
      if (ng < g[ni]) {
        came[ni] = cur; g[ni] = ng;
        f[ni] = ng + Math.abs(nx - gx) + Math.abs(ny - gy);
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
      }
    }
  }
  return null;
}
