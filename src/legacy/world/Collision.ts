export interface Collider {
  minX: number; maxX: number; minZ: number; maxZ: number;
  solid: boolean; // doors can toggle
  id?: string;
}

export class CollisionWorld {
  colliders: Collider[] = [];

  add(cx: number, cz: number, w: number, d: number, id?: string): Collider {
    const c: Collider = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, solid: true, id };
    this.colliders.push(c);
    return c;
  }

  clear() { this.colliders = []; }

  // Resolve a circle (x,z,r) against all colliders, returns adjusted position.
  resolve(x: number, z: number, r: number): { x: number; z: number } {
    for (const c of this.colliders) {
      if (!c.solid) continue;
      // closest point on box to circle center
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const dist2 = dx * dx + dz * dz;
      if (dist2 < r * r) {
        const dist = Math.sqrt(dist2) || 0.0001;
        if (dist > 0.0001) {
          const push = (r - dist);
          x += (dx / dist) * push;
          z += (dz / dist) * push;
        } else {
          // center inside box: push out along smallest penetration axis
          const leftPen = x - c.minX, rightPen = c.maxX - x;
          const topPen = z - c.minZ, botPen = c.maxZ - z;
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) x = c.minX - r;
          else if (minPen === rightPen) x = c.maxX + r;
          else if (minPen === topPen) z = c.minZ - r;
          else z = c.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  blocked(x: number, z: number, r: number): boolean {
    for (const c of this.colliders) {
      if (!c.solid) continue;
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
}
