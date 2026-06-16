// Abstract game-item data only (no real-world procedures). Contraband is a gameplay flag.
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  type: 'food' | 'note' | 'media' | 'medicine' | 'gambling' | 'device' | 'tool' | 'weapon' | 'access' | 'misc';
  contraband: boolean;
  value: number;        // trade value
  risk: number;         // 0..1 how bad it is to be caught with
  concealment: number;  // 0..1 how hard to find in a search
  suspicion: number;    // 0..1 how much carrying it raises suspicion
  combat?: number;      // abstract fight bonus
}

export const ITEMS: Record<string, ItemDef> = {
  snack:     { id: 'snack', name: 'Extra Food', icon: '🍞', type: 'food', contraband: false, value: 3, risk: 0.05, concealment: 0.4, suspicion: 0.02 },
  note:      { id: 'note', name: 'Hidden Note', icon: '📝', type: 'note', contraband: true, value: 4, risk: 0.2, concealment: 0.85, suspicion: 0.1 },
  magazine:  { id: 'magazine', name: 'Old Magazine', icon: '📰', type: 'media', contraband: true, value: 5, risk: 0.15, concealment: 0.3, suspicion: 0.1 },
  medicine:  { id: 'medicine', name: 'Medicine Bottle', icon: '💊', type: 'medicine', contraband: true, value: 10, risk: 0.35, concealment: 0.5, suspicion: 0.2 },
  dice:      { id: 'dice', name: 'Handmade Dice', icon: '🎲', type: 'gambling', contraband: true, value: 6, risk: 0.25, concealment: 0.7, suspicion: 0.15 },
  phone:     { id: 'phone', name: 'Phone Device', icon: '📱', type: 'device', contraband: true, value: 20, risk: 0.7, concealment: 0.45, suspicion: 0.4 },
  tool:      { id: 'tool', name: 'Improvised Tool', icon: '🔧', type: 'tool', contraband: true, value: 12, risk: 0.55, concealment: 0.4, suspicion: 0.35 },
  blade:     { id: 'blade', name: 'Sharp Object', icon: '🔪', type: 'weapon', contraband: true, value: 15, risk: 0.9, concealment: 0.35, suspicion: 0.5, combat: 6 },
  keycard:   { id: 'keycard', name: 'Stolen Keycard', icon: '🗝️', type: 'access', contraband: true, value: 25, risk: 0.95, concealment: 0.4, suspicion: 0.5 },
  cash:      { id: 'cash', name: 'Cigarettes (currency)', icon: '🚬', type: 'misc', contraband: true, value: 8, risk: 0.2, concealment: 0.6, suspicion: 0.12 }
};
export const ITEM_IDS = Object.keys(ITEMS);
export const CONTRABAND_IDS = ITEM_IDS.filter((i) => ITEMS[i].contraband);
export const isContraband = (id: string) => !!ITEMS[id]?.contraband;
