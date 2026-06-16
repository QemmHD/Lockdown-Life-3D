import { RNG } from '../game/RNG';
import { GameState } from '../game/GameState';
import { ROOMS } from '../data/rooms';
import { ITEMS } from '../data/items';
import { FACTIONS } from '../data/factions';
import { NPC } from '../entities/NPC';
import type { Mission } from '../game/types';

const DELIVER_ROOMS = ['cafeteria', 'gym', 'yard', 'workshop', 'laundry', 'medical', 'visitation'];
const NORMAL_ITEMS = ['snack', 'cigarettes', 'soap', 'book', 'bandage', 'water_bottle'];
const CONTRA_ITEMS = ['shiv', 'cigarettes', 'energy_pills', 'lighter', 'medicine'];

const TYPES = [
  { id: 'deliver', weight: 3 },
  { id: 'smuggle', weight: 2 },
  { id: 'beat', weight: 2 },
  { id: 'intimidate', weight: 2 },
  { id: 'stash', weight: 2 }
];

export function generateMission(rng: RNG, giver: NPC, npcs: NPC[], state: GameState): Mission {
  const type = rng.weighted(TYPES).id;
  const fac = FACTIONS[giver.def.faction];
  const reward: Mission['reward'] = {};
  const risk = rng.int(1, 3);
  reward.money = rng.int(8, 20) + risk * 4;
  reward.rep = rng.int(1, 3);
  reward.faction = rng.int(4, 8);
  if (rng.chance(40)) reward.respect = rng.int(2, 5);
  if (rng.chance(25)) reward.item = rng.choice(['cigarettes', 'medicine', 'energy_pills']);

  const id = 'm_' + Date.now().toString(36) + rng.int(100, 999);
  const base = { id, giver: giver.def.id, giverName: giver.name, faction: giver.def.faction, reward, risk, done: false };

  if (type === 'deliver') {
    const item = rng.choice(NORMAL_ITEMS);
    const room = rng.choice(DELIVER_ROOMS);
    return { ...base, type, title: `Deliver ${ITEMS[item].name}`, desc: `${giver.name} needs ${ITEMS[item].name} dropped in the ${roomName(room)}. Get one and take it there.`, item, targetRoom: room };
  }
  if (type === 'smuggle') {
    const item = rng.choice(CONTRA_ITEMS);
    const room = rng.choice(['storage', 'maintenance', 'shower']);
    return { ...base, type, title: `Smuggle ${ITEMS[item].name}`, desc: `Move ${ITEMS[item].name} to the ${roomName(room)} without losing it. Watch for guards.`, item, targetRoom: room, reward: { ...reward, money: (reward.money ?? 0) + 8 } };
  }
  if (type === 'beat') {
    const target = pickRival(rng, giver, npcs);
    return { ...base, type, title: `Rough up ${target?.name ?? 'a rival'}`, desc: `${giver.name} wants ${target?.name ?? 'a rival'} put down. Win the fight.`, item: target?.def.id };
  }
  if (type === 'intimidate') {
    const target = pickRival(rng, giver, npcs);
    return { ...base, type, title: `Intimidate ${target?.name ?? 'a rival'}`, desc: `Lean on ${target?.name ?? 'a rival'} until they fear you (threaten or fight them down).`, item: target?.def.id };
  }
  // stash
  const stash = rng.choice(['stash_storage', 'stash_shower', 'stash_maint', 'stash_kitchen', 'stash_cell']);
  return { ...base, type, title: 'Recover a stash', desc: `Find and open the hidden stash. ${giver.name} swears it's still there.`, item: stash };
}

function pickRival(rng: RNG, giver: NPC, npcs: NPC[]): NPC | undefined {
  const rivals = npcs.filter((n) => !n.dead && !n.isGuard && !n.isStaff && n.def.faction !== giver.def.faction && n !== giver);
  return rivals.length ? rng.choice(rivals) : undefined;
}

function roomName(id: string): string { return ROOMS.find((r) => r.id === id)?.name ?? id; }
