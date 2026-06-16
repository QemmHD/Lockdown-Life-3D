import type { FactionDef, FactionId } from '../game/types';

export const FACTIONS: Record<FactionId, FactionDef> = {
  iron_dogs: {
    id: 'iron_dogs',
    name: 'Iron Dogs',
    color: 0x8b1a1a,
    cssColor: '#c0392b',
    accent: 0x3a0d0d,
    description: 'Aggressive muscle that rules the yard and gym. Respect is earned with fists.',
    territory: ['gym', 'yard'],
    values: 'Strength & Fighting',
    behavior: 'Challenges, intimidation, protection rackets'
  },
  blue_kings: {
    id: 'blue_kings',
    name: 'Blue Kings',
    color: 0x1c4e80,
    cssColor: '#2980b9',
    accent: 0x0d2540,
    description: 'Organized hustlers who run trade, favors and information.',
    territory: ['cafeteria', 'visitation'],
    values: 'Reputation & Deals',
    behavior: 'Trading, favors, bribes, information'
  },
  black_vipers: {
    id: 'black_vipers',
    name: 'Black Vipers',
    color: 0x14361f,
    cssColor: '#1e8449',
    accent: 0x0a0a0a,
    description: 'Shadows in the maintenance halls. Smuggling, theft and ambushes.',
    territory: ['storage', 'maintenance', 'shower'],
    values: 'Intelligence & Secrecy',
    behavior: 'Smuggling, theft, traps, ambushes'
  },
  yard_saints: {
    id: 'yard_saints',
    name: 'Yard Saints',
    color: 0xc9b037,
    cssColor: '#d4ac0d',
    accent: 0xf2f2f2,
    description: 'Loyal protectors who keep the weak safe and mediate conflict.',
    territory: ['cellblock', 'medical'],
    values: 'Loyalty & Fairness',
    behavior: 'Protection, favors, conflict mediation'
  },
  lone_wolves: {
    id: 'lone_wolves',
    name: 'Lone Wolves',
    color: 0x707070,
    cssColor: '#95a5a6',
    accent: 0x303030,
    description: 'Unaligned inmates. Some friendly, some dangerous, all unpredictable.',
    territory: [],
    values: 'Independence',
    behavior: 'Unpredictable'
  },
  guards: {
    id: 'guards',
    name: 'Corrections',
    color: 0x2c3e50,
    cssColor: '#34495e',
    accent: 0x000000,
    description: 'The screws. They keep order, break up fights, and run the count.',
    territory: ['guard_office', 'walkway', 'checkpoint'],
    values: 'Order',
    behavior: 'Patrol, punish, enforce'
  },
  staff: {
    id: 'staff',
    name: 'Facility Staff',
    color: 0x16a085,
    cssColor: '#16a085',
    accent: 0xffffff,
    description: 'Doctors, cooks and the warden who keep the place running.',
    territory: ['medical', 'kitchen', 'warden_office'],
    values: 'Routine',
    behavior: 'Work, heal, oversee'
  }
};

export const PLAYABLE_FACTIONS: FactionId[] = [
  'iron_dogs',
  'blue_kings',
  'black_vipers',
  'yard_saints',
  'lone_wolves'
];

// Inter-faction baseline relationships (-100 hostile .. 100 allied)
export const FACTION_RELATIONS: Record<string, Record<string, number>> = {
  iron_dogs: { blue_kings: -20, black_vipers: -40, yard_saints: -60, lone_wolves: 0 },
  blue_kings: { iron_dogs: -20, black_vipers: 20, yard_saints: 10, lone_wolves: 0 },
  black_vipers: { iron_dogs: -40, blue_kings: 20, yard_saints: -30, lone_wolves: 0 },
  yard_saints: { iron_dogs: -60, blue_kings: 10, black_vipers: -30, lone_wolves: 10 },
  lone_wolves: { iron_dogs: 0, blue_kings: 0, black_vipers: 0, yard_saints: 10 }
};
