// Economy / contraband market (Stage 3.7) — pure helpers + types. No sim/render dependency.
// All fictional, abstract game economics — no real-world contraband/smuggling/concealment detail.
import { ITEMS, ItemDef } from '../data/items';

export interface MarketOffer {
  id: string;
  sellerId: number;          // entity id, 0 = none
  gangId: string;            // '' = none (crew supply uses this)
  itemId: string;
  price: number;
  expiresAt: number;         // day it expires
  risk: number;
  sourceType: 'inmate' | 'crew' | 'random';
}
export interface EconomyState {
  day: number;
  demand: Record<string, number>;   // itemId -> 0..1 multiplier around 1
  supply: Record<string, number>;   // itemId -> 0..1 multiplier around 1
  offers: MarketOffer[];
  trades: number;
  lastRestockDay: number;
}
export function newEconomy(): EconomyState {
  const demand: Record<string, number> = {}, supply: Record<string, number> = {};
  for (const id in ITEMS) { demand[id] = 1; supply[id] = 1; }
  return { day: 1, demand, supply, offers: [], trades: 0, lastRestockDay: 0 };
}

// ---- pricing ----
export interface PriceCtx {
  relationship: number;     // -100..100 buyer↔seller
  sameGang: boolean;        // seller is in the player's crew
  rival: boolean;           // seller is in a rival crew
  rank: number;             // player's gang rank (0..5)
  reputation: number;       // -100..100
  heat: number;             // 0..100
  difficultyMul: number;    // economy difficulty multiplier (≈ moneyMul inverse)
  buying: boolean;          // true = player buys (markup), false = player sells (markdown)
}
// dynamic price for one unit of an item, with a short reason. Always >= 1.
export function priceFor(item: ItemDef, demand: number, supply: number, c: PriceCtx): { price: number; reason: string } {
  let p = item.value * (0.7 + item.rarity * 0.8);          // base + rarity
  const reasons: string[] = [];
  const ds = clamp(demand / Math.max(0.3, supply), 0.5, 2.2);
  p *= ds; if (ds > 1.25) reasons.push('in demand'); else if (ds < 0.8) reasons.push('plentiful');
  if (item.contraband) { const heatM = 1 + (c.heat / 100) * 0.6; p *= heatM; if (c.heat > 50) reasons.push('hot — risky'); }
  if (c.sameGang) { p *= (0.82 - c.rank * 0.02); reasons.push('crew price'); }
  else if (c.rival) { p *= 1.5; reasons.push('rival markup'); }
  else { p *= clamp(1 - c.relationship * 0.0025, 0.85, 1.2); if (c.relationship > 30) reasons.push('they like you'); else if (c.relationship < -20) reasons.push('they distrust you'); }
  p *= clamp(1 - c.reputation * 0.0008, 0.92, 1.08);
  p *= c.buying ? 1 : 0.55;                                 // sell-back is worth less
  p *= c.difficultyMul;
  return { price: Math.max(1, Math.round(p)), reason: reasons.slice(0, 2).join(', ') || (item.contraband ? 'contraband' : 'standard') };
}
// will a rival refuse to deal at all? (very low relationship + rival)
export function refusesToTrade(c: PriceCtx): boolean { return c.rival && c.relationship < -25; }

// ---- search risk (0..1) for being caught with carried items ----
export function searchRisk(suspicion: number, items: ItemDef[], heat: number, guardStrict: number): number {
  if (!items.length) return 0;
  let worst = 0, load = 0;
  for (const it of items) { const r = it.risk * (1 - it.concealment * 0.7); worst = Math.max(worst, r); load += r; }
  const base = 0.25 + suspicion / 200 + heat / 300;
  return clamp(base * (0.5 + worst) + load * 0.06 + guardStrict * 0.1, 0, 0.97);
}

// ---- jobs ----
export function jobPay(base: number, ctx: { trait: number; reputation: number; rank: number; streak: number; difficultyMul: number }): number {
  let p = base * ctx.trait;                                 // worker 1.5 / lazy 0.6 / 1
  p *= 1 + clamp(ctx.reputation, 0, 100) * 0.004;
  p *= 1 + ctx.rank * 0.05;
  p *= 1 + Math.min(0.5, ctx.streak * 0.08);                // streak bonus, capped
  p *= ctx.difficultyMul;
  return Math.max(1, Math.round(p));
}

// ---- stash capacity / concealment by object type ----
export function stashInfo(objType: string): { cap: number; conceal: number; risk: number } {
  switch (objType) {
    case 'bed': return { cap: 3, conceal: 0.55, risk: 0.4 };
    case 'locker': case 'shelf': return { cap: 4, conceal: 0.6, risk: 0.35 };
    case 'toilet': case 'sink': return { cap: 1, conceal: 0.45, risk: 0.6 };
    case 'trash': return { cap: 2, conceal: 0.35, risk: 0.55 };
    case 'desk': return { cap: 2, conceal: 0.7, risk: 0.85 };  // restricted, risky to reach
    default: return { cap: 2, conceal: 0.5, risk: 0.5 };
  }
}
export function stashLabel(risk: number): string { return risk >= 0.6 ? 'looks risky' : risk >= 0.4 ? 'so-so' : 'looks safe'; }

// ---- daily demand/supply drift (deterministic via rollFn) ----
export function driftEconomy(e: EconomyState, rollFn: () => number) {
  for (const id in ITEMS) {
    e.demand[id] = clamp((e.demand[id] ?? 1) + (rollFn() - 0.5) * 0.3, 0.5, 1.8);
    e.supply[id] = clamp((e.supply[id] ?? 1) + (rollFn() - 0.5) * 0.3, 0.4, 1.7);
  }
}

export function sanitizeEconomy(d: any): EconomyState {
  const e = newEconomy(); if (!d || typeof d !== 'object') return e;
  if (typeof d.day === 'number') e.day = d.day;
  if (typeof d.trades === 'number') e.trades = d.trades;
  if (typeof d.lastRestockDay === 'number') e.lastRestockDay = d.lastRestockDay;
  const num = (v: any, def: number) => (typeof v === 'number' && isFinite(v) ? v : def);
  if (d.demand) for (const id in ITEMS) e.demand[id] = clamp(num(d.demand[id], 1), 0.5, 1.8);
  if (d.supply) for (const id in ITEMS) e.supply[id] = clamp(num(d.supply[id], 1), 0.4, 1.7);
  if (Array.isArray(d.offers)) e.offers = d.offers.filter((o: any) => o && typeof o.itemId === 'string' && ITEMS[o.itemId]).slice(0, 12).map((o: any) => ({ id: String(o.id ?? ''), sellerId: num(o.sellerId, 0), gangId: typeof o.gangId === 'string' ? o.gangId : '', itemId: o.itemId, price: Math.max(1, num(o.price, ITEMS[o.itemId].value)), expiresAt: num(o.expiresAt, e.day + 1), risk: clamp(num(o.risk, 0), 0, 1), sourceType: ['inmate', 'crew', 'random'].includes(o.sourceType) ? o.sourceType : 'random' }));
  return e;
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
