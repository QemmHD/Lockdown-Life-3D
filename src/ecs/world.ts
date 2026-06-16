// Minimal archetype-free ECS: entities are ids, components live in per-type Maps.
// Systems (in /sim) operate on query() results. Render reads, never writes sim state.
export type Entity = number;

export class ECS {
  private nextId = 1;
  comps: Record<string, Map<Entity, any>> = {};

  create(): Entity { return this.nextId++; }

  set<T>(e: Entity, name: string, data: T): T {
    (this.comps[name] ??= new Map()).set(e, data);
    return data;
  }
  get<T>(e: Entity, name: string): T | undefined { return this.comps[name]?.get(e); }
  has(e: Entity, name: string): boolean { return this.comps[name]?.has(e) ?? false; }
  removeComp(e: Entity, name: string) { this.comps[name]?.delete(e); }
  destroy(e: Entity) { for (const m of Object.values(this.comps)) m.delete(e); }

  query(...names: string[]): Entity[] {
    const base = this.comps[names[0]];
    if (!base) return [];
    const out: Entity[] = [];
    outer: for (const e of base.keys()) {
      for (let i = 1; i < names.length; i++) if (!this.comps[names[i]]?.has(e)) continue outer;
      out.push(e);
    }
    return out;
  }
  all(name: string): Entity[] { return this.comps[name] ? [...this.comps[name].keys()] : []; }
}
