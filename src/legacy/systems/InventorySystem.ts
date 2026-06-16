import { GameState, clamp } from '../game/GameState';
import { ITEMS } from '../data/items';
import type { InventoryItem, StatKey } from '../game/types';

export const MAX_SLOTS = 12;

export class InventorySystem {
  constructor(private state: GameState) {}

  count(itemId: string, list = this.state.inventory): number {
    return list.find((i) => i.itemId === itemId)?.qty ?? 0;
  }

  slotsUsed() { return this.state.inventory.length; }

  add(itemId: string, qty = 1, list = this.state.inventory): boolean {
    if (!ITEMS[itemId]) return false;
    const ex = list.find((i) => i.itemId === itemId);
    if (ex) { ex.qty += qty; return true; }
    if (list.length >= MAX_SLOTS) return false;
    list.push({ itemId, qty });
    return true;
  }

  remove(itemId: string, qty = 1, list = this.state.inventory): boolean {
    const ex = list.find((i) => i.itemId === itemId);
    if (!ex || ex.qty < qty) return false;
    ex.qty -= qty;
    if (ex.qty <= 0) {
      const idx = list.indexOf(ex);
      list.splice(idx, 1);
    }
    return true;
  }

  // returns description of effects applied, or null if not usable
  use(itemId: string): string | null {
    const def = ITEMS[itemId];
    if (!def || !def.effect) return null;
    if (!this.remove(itemId, 1)) return null;
    const s = this.state.stats as any;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(def.effect)) {
      const key = k as StatKey;
      s[key] = (s[key] ?? 0) + (v as number);
      if (v) parts.push(`${(v as number) > 0 ? '+' : ''}${v} ${k}`);
    }
    this.state.clampStats();
    return parts.join(', ');
  }

  drop(itemId: string): boolean { return this.remove(itemId, 1); }

  contrabandItems(): InventoryItem[] {
    return this.state.inventory.filter((i) => ITEMS[i.itemId]?.contraband);
  }

  // confiscate all contraband, returns total risk-weighted count
  confiscateContraband(): number {
    const c = this.contrabandItems();
    let n = 0;
    for (const it of c) { n += it.qty; this.remove(it.itemId, it.qty); }
    return n;
  }

  bestWeapon(): { id: string; damage: number } | null {
    let best: { id: string; damage: number } | null = null;
    for (const it of this.state.inventory) {
      const d = ITEMS[it.itemId];
      if (d?.damage && (!best || d.damage > best.damage)) best = { id: it.itemId, damage: d.damage };
    }
    return best;
  }

  bestWeaponDamage(): number {
    let best = 0;
    for (const it of this.state.inventory) {
      const d = ITEMS[it.itemId];
      if (d?.damage && d.damage > best) best = d.damage;
    }
    return best;
  }

  // stash management
  stashList(stashId: string): InventoryItem[] {
    if (!this.state.stashes[stashId]) this.state.stashes[stashId] = [];
    return this.state.stashes[stashId];
  }
  toStash(stashId: string, itemId: string): boolean {
    if (this.remove(itemId, 1)) { this.add(itemId, 1, this.stashList(stashId)); return true; }
    return false;
  }
  fromStash(stashId: string, itemId: string): boolean {
    const list = this.stashList(stashId);
    if (this.remove(itemId, 1, list)) {
      if (!this.add(itemId, 1)) { this.add(itemId, 1, list); return false; }
      return true;
    }
    return false;
  }
}
