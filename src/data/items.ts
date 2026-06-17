// Abstract game-item data only (no real-world procedures). Contraband is a gameplay flag.
// Stage 3.7 adds category / rarity / demand-supply weights / use effects for the economy.
export type ItemCategory = 'food' | 'hygiene' | 'comfort' | 'utility' | 'barter' | 'risky' | 'crew' | 'rare' | 'medical';
export type UseKind = 'food' | 'hygiene' | 'comfort' | 'medical' | 'barter' | 'none';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  type: 'food' | 'note' | 'media' | 'medicine' | 'gambling' | 'device' | 'tool' | 'weapon' | 'access' | 'misc';
  category: ItemCategory;
  contraband: boolean;
  value: number;          // base trade value
  risk: number;           // 0..1 how bad it is to be caught with
  concealment: number;    // 0..1 how hard to find in a search
  suspicion: number;      // 0..1 how much carrying it raises suspicion
  demandWeight: number;   // 0..1 baseline demand
  supplyWeight: number;   // 0..1 baseline availability
  rarity: number;         // 0..1 (higher = rarer → pricier, scarcer)
  use: UseKind;           // what using it does (sim applies the effect)
  useAmt: number;         // magnitude of the use effect (0 = no use)
  combat?: number;        // abstract fight bonus
}

function I(d: Partial<ItemDef> & Pick<ItemDef, 'id' | 'name' | 'icon' | 'type' | 'category' | 'value'>): ItemDef {
  return { contraband: false, risk: 0.05, concealment: 0.4, suspicion: 0.02, demandWeight: 0.4, supplyWeight: 0.5, rarity: 0.3, use: 'none', useAmt: 0, ...d };
}

export const ITEMS: Record<string, ItemDef> = {
  // --- everyday / legitimate ---
  snack:    I({ id: 'snack', name: 'Extra Food', icon: '🍞', type: 'food', category: 'food', value: 3, demandWeight: 0.8, supplyWeight: 0.7, rarity: 0.15, use: 'food', useAmt: 0.4 }),
  soap:     I({ id: 'soap', name: 'Bar of Soap', icon: '🧼', type: 'misc', category: 'hygiene', value: 2, demandWeight: 0.6, supplyWeight: 0.7, rarity: 0.15, use: 'hygiene', useAmt: 0.4 }),
  towel:    I({ id: 'towel', name: 'Clean Towel', icon: '🧺', type: 'misc', category: 'hygiene', value: 3, demandWeight: 0.45, supplyWeight: 0.5, rarity: 0.25, use: 'hygiene', useAmt: 0.25 }),
  cards:    I({ id: 'cards', name: 'Playing Cards', icon: '🃏', type: 'gambling', category: 'comfort', value: 4, demandWeight: 0.5, supplyWeight: 0.45, rarity: 0.3, use: 'comfort', useAmt: 0.2 }),
  book:     I({ id: 'book', name: 'Worn Paperback', icon: '📖', type: 'media', category: 'comfort', value: 4, demandWeight: 0.4, supplyWeight: 0.4, rarity: 0.35, use: 'comfort', useAmt: 0.2 }),
  batteries: I({ id: 'batteries', name: 'Batteries', icon: '🔋', type: 'device', category: 'utility', value: 5, demandWeight: 0.5, supplyWeight: 0.4, rarity: 0.4, use: 'none' }),
  token:    I({ id: 'token', name: 'Commissary Token', icon: '🪙', type: 'misc', category: 'barter', value: 5, demandWeight: 0.7, supplyWeight: 0.4, rarity: 0.35, use: 'barter', useAmt: 0 }),
  wrap:     I({ id: 'wrap', name: 'Medical Wrap', icon: '🩹', type: 'medicine', category: 'medical', value: 7, demandWeight: 0.55, supplyWeight: 0.35, rarity: 0.5, use: 'medical', useAmt: 0.22 }),
  // --- contraband (fictional, abstract) ---
  note:     I({ id: 'note', name: 'Hidden Note', icon: '📝', type: 'note', category: 'risky', contraband: true, value: 4, risk: 0.2, concealment: 0.85, suspicion: 0.1, demandWeight: 0.35, supplyWeight: 0.5, rarity: 0.4 }),
  magazine: I({ id: 'magazine', name: 'Old Magazine', icon: '📰', type: 'media', category: 'comfort', contraband: true, value: 5, risk: 0.15, concealment: 0.3, suspicion: 0.1, demandWeight: 0.45, supplyWeight: 0.45, rarity: 0.4, use: 'comfort', useAmt: 0.15 }),
  medicine: I({ id: 'medicine', name: 'Medicine Bottle', icon: '💊', type: 'medicine', category: 'medical', contraband: true, value: 10, risk: 0.35, concealment: 0.5, suspicion: 0.2, demandWeight: 0.6, supplyWeight: 0.3, rarity: 0.6, use: 'medical', useAmt: 0.18 }),
  dice:     I({ id: 'dice', name: 'Handmade Dice', icon: '🎲', type: 'gambling', category: 'risky', contraband: true, value: 6, risk: 0.25, concealment: 0.7, suspicion: 0.15, demandWeight: 0.5, supplyWeight: 0.45, rarity: 0.45 }),
  phone:    I({ id: 'phone', name: 'Phone Device', icon: '📱', type: 'device', category: 'rare', contraband: true, value: 20, risk: 0.7, concealment: 0.45, suspicion: 0.4, demandWeight: 0.75, supplyWeight: 0.15, rarity: 0.85 }),
  tool:     I({ id: 'tool', name: 'Improvised Tool', icon: '🔧', type: 'tool', category: 'risky', contraband: true, value: 12, risk: 0.55, concealment: 0.4, suspicion: 0.35, demandWeight: 0.5, supplyWeight: 0.25, rarity: 0.65 }),
  part:     I({ id: 'part', name: 'Repair Part', icon: '⚙️', type: 'tool', category: 'utility', contraband: true, value: 9, risk: 0.4, concealment: 0.45, suspicion: 0.25, demandWeight: 0.45, supplyWeight: 0.3, rarity: 0.6 }),
  blade:    I({ id: 'blade', name: 'Sharp Object', icon: '🔪', type: 'weapon', category: 'risky', contraband: true, value: 15, risk: 0.9, concealment: 0.35, suspicion: 0.5, demandWeight: 0.55, supplyWeight: 0.2, rarity: 0.7, combat: 6 }),
  keycard:  I({ id: 'keycard', name: 'Stolen Keycard', icon: '🗝️', type: 'access', category: 'rare', contraband: true, value: 25, risk: 0.95, concealment: 0.4, suspicion: 0.5, demandWeight: 0.6, supplyWeight: 0.1, rarity: 0.9 }),
  crewmark: I({ id: 'crewmark', name: 'Crew Marker', icon: '🏴', type: 'misc', category: 'crew', contraband: true, value: 8, risk: 0.3, concealment: 0.5, suspicion: 0.2, demandWeight: 0.5, supplyWeight: 0.3, rarity: 0.55 }),
  cash:     I({ id: 'cash', name: 'Cigarettes (currency)', icon: '🚬', type: 'misc', category: 'barter', contraband: true, value: 8, risk: 0.2, concealment: 0.6, suspicion: 0.12, demandWeight: 0.7, supplyWeight: 0.4, rarity: 0.4, use: 'barter', useAmt: 0 })
};
export const ITEM_IDS = Object.keys(ITEMS);
export const CONTRABAND_IDS = ITEM_IDS.filter((i) => ITEMS[i].contraband);
export const LEGIT_IDS = ITEM_IDS.filter((i) => !ITEMS[i].contraband);
export const isContraband = (id: string) => !!ITEMS[id]?.contraband;
