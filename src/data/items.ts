import type { ItemDef } from '../game/types';

export const ITEMS: Record<string, ItemDef> = {
  // --- Consumables / normal ---
  food_tray: { id: 'food_tray', name: 'Food Tray', type: 'consumable', contraband: false, value: 2, risk: 0, desc: 'A bland prison meal. Restores hunger.', effect: { hunger: 45, mood: 5 }, icon: '🍱' },
  snack: { id: 'snack', name: 'Snack Cake', type: 'consumable', contraband: false, value: 4, risk: 0, desc: 'Sugary commissary treat.', effect: { hunger: 18, mood: 8 }, icon: '🧁' },
  water_bottle: { id: 'water_bottle', name: 'Water Bottle', type: 'consumable', contraband: false, value: 1, risk: 0, desc: 'Clean water. Restores a little stamina.', effect: { stamina: 25 }, icon: '💧' },
  bandage: { id: 'bandage', name: 'Bandage', type: 'consumable', contraband: false, value: 6, risk: 0.1, desc: 'Patch yourself up. Heals and reduces injury.', effect: { health: 30, injury: -25 }, icon: '🩹' },
  medicine: { id: 'medicine', name: 'Medicine', type: 'consumable', contraband: true, value: 18, risk: 0.4, desc: 'Smuggled meds. Strong heal.', effect: { health: 55, injury: -40 }, icon: '💊' },
  energy_pills: { id: 'energy_pills', name: 'Energy Pills', type: 'consumable', contraband: true, value: 14, risk: 0.5, desc: 'Restores stamina fast. Illegal.', effect: { stamina: 80, mood: 10 }, icon: '⚡' },
  alcohol_brew: { id: 'alcohol_brew', name: 'Pruno Brew', type: 'consumable', contraband: true, value: 12, risk: 0.6, desc: 'Cell-made hooch. Big mood, sloppy.', effect: { mood: 35, stamina: -10, intelligence: 0 }, icon: '🍺' },
  soap: { id: 'soap', name: 'Soap', type: 'misc', contraband: false, value: 1, risk: 0, desc: 'Just soap. Or is it?', icon: '🧼' },
  book: { id: 'book', name: 'Worn Book', type: 'misc', contraband: false, value: 3, risk: 0, desc: 'Reading boosts the mind over time.', effect: { intelligence: 1, mood: 6 }, icon: '📘' },
  letter: { id: 'letter', name: 'Letter from Home', type: 'misc', contraband: false, value: 0, risk: 0, desc: 'A note from the outside. Lifts the spirit.', effect: { mood: 25 }, icon: '✉️' },
  clean_uniform: { id: 'clean_uniform', name: 'Clean Uniform', type: 'misc', contraband: false, value: 2, risk: 0, desc: 'Fresh prison blues.', effect: { mood: 6 }, icon: '👕' },
  workout_gloves: { id: 'workout_gloves', name: 'Workout Gloves', type: 'misc', contraband: false, value: 5, risk: 0, desc: 'Better grip at the weights.', icon: '🧤' },
  broom: { id: 'broom', name: 'Broom', type: 'weapon', contraband: false, value: 2, risk: 0.1, desc: 'Cleaning tool. Swings okay in a pinch.', damage: 4, icon: '🧹' },
  laundry_bag: { id: 'laundry_bag', name: 'Laundry Bag', type: 'misc', contraband: false, value: 1, risk: 0, desc: 'For hauling laundry.', icon: '🧺' },
  cash: { id: 'cash', name: 'Cash Stash', type: 'valuable', contraband: true, value: 25, risk: 0.5, desc: 'Folded bills. Very illegal inside.', icon: '💵' },

  // --- Contraband / weapons / valuables ---
  cigarettes: { id: 'cigarettes', name: 'Cigarettes', type: 'contraband', contraband: true, value: 8, risk: 0.3, desc: 'Prison currency. Trade them everywhere.', effect: { mood: 12, stamina: -5 }, icon: '🚬' },
  lighter: { id: 'lighter', name: 'Lighter', type: 'contraband', contraband: true, value: 6, risk: 0.3, desc: 'Fire in your pocket.', icon: '🔥' },
  shiv: { id: 'shiv', name: 'Makeshift Shiv', type: 'weapon', contraband: true, value: 20, risk: 0.8, desc: 'A sharpened toothbrush. Deadly and very illegal.', damage: 14, icon: '🔪' },
  sharp_spoon: { id: 'sharp_spoon', name: 'Sharpened Spoon', type: 'weapon', contraband: true, value: 9, risk: 0.6, desc: 'Filed to a point in the kitchen.', damage: 8, icon: '🥄' },
  file: { id: 'file', name: 'Metal File', type: 'contraband', contraband: true, value: 16, risk: 0.7, desc: 'Could cut through many things... like bars.', icon: '🪚' },
  keycard: { id: 'keycard', name: 'Stolen Keycard', type: 'quest', contraband: true, value: 40, risk: 0.9, desc: 'A guard keycard. Opens restricted doors.', icon: '🔑' },
  guard_note: { id: 'guard_note', name: 'Guard Roster Note', type: 'quest', contraband: true, value: 22, risk: 0.7, desc: 'Patrol times scrawled on paper.', icon: '📝' },
  stolen_watch: { id: 'stolen_watch', name: 'Stolen Watch', type: 'valuable', contraband: true, value: 30, risk: 0.6, desc: 'Shiny. Someone wants it back.', icon: '⌚' },
  phone: { id: 'phone', name: 'Burner Phone', type: 'contraband', contraband: true, value: 50, risk: 0.95, desc: 'A line to the outside world.', icon: '📱' },
  lockpick: { id: 'lockpick', name: 'Lockpick', type: 'contraband', contraband: true, value: 24, risk: 0.7, desc: 'Bent metal for stubborn locks.', icon: '🗝️' },
  betting_slip: { id: 'betting_slip', name: 'Betting Slip', type: 'contraband', contraband: true, value: 7, risk: 0.4, desc: 'A wager on the next yard fight.', icon: '🎟️' },
  gang_token: { id: 'gang_token', name: 'Gang Token', type: 'contraband', contraband: true, value: 10, risk: 0.5, desc: 'A marker of faction allegiance.', icon: '🎖️' }
};

export const ITEM_IDS = Object.keys(ITEMS);
