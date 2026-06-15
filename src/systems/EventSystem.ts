import { GameState, clamp } from '../game/GameState';
import { InventorySystem } from './InventorySystem';
import { AudioSystem } from './AudioSystem';
import { RANDOM_EVENTS } from '../data/events';
import type { RandomEventDef, SchedulePhaseId } from '../game/types';

export interface EventHooks {
  toast: (msg: string, type?: string) => void;
  forceLockdown: () => void;
  spawnHostile: () => void;
  startEscapeThread: () => void;
  notify: (title: string, body: string) => void;
  addTime: (n: number, reason: string) => void;
}

export class EventSystem {
  active: RandomEventDef | null = null;
  private panel: HTMLDivElement;
  private cooldown = 0;

  constructor(private state: GameState, private inv: InventorySystem, private audio: AudioSystem, private hooks: EventHooks) {
    this.panel = document.createElement('div');
    this.panel.id = 'event-modal';
    this.panel.style.display = 'none';
    document.getElementById('ui-root')!.appendChild(this.panel);
  }

  tick(dt: number) { if (this.cooldown > 0) this.cooldown -= dt; }

  onPhaseChange(phase: SchedulePhaseId) {
    if (this.cooldown > 0 || this.active) return;
    if (Math.random() > 0.6) return; // not every phase
    const pool = RANDOM_EVENTS.filter((e) =>
      e.phases.includes(phase) && !(e.once && this.state.completedEvents.includes(e.id))
    );
    if (pool.length === 0) return;
    const total = pool.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total;
    let chosen = pool[0];
    for (const e of pool) { r -= e.weight; if (r <= 0) { chosen = e; break; } }
    this.trigger(chosen);
  }

  trigger(ev: RandomEventDef) {
    this.active = ev;
    this.cooldown = 25;
    if (ev.once) this.state.completedEvents.push(ev.id);
    this.audio.play('murmur');
    this.render(ev);
  }

  private render(ev: RandomEventDef) {
    this.panel.style.display = 'flex';
    let html = `<div class="event-card"><div class="event-title">⚠ ${ev.name}</div><div class="event-body">${ev.message}</div><div class="event-choices"></div></div>`;
    this.panel.innerHTML = html;
    const cc = this.panel.querySelector('.event-choices') as HTMLDivElement;
    for (const c of ev.choices ?? [{ text: 'OK', outcome: 'ignore' }]) {
      const b = document.createElement('button');
      b.className = 'event-btn';
      b.textContent = c.text;
      b.onclick = () => { this.audio.play('click'); this.resolve(c.outcome); };
      cc.appendChild(b);
    }
  }

  private done() { this.active = null; this.panel.style.display = 'none'; }

  private resolve(outcome: string) {
    const s = this.state.stats;
    const t = this.hooks.toast;
    switch (outcome) {
      case 'ignore': break;
      case 'mediate':
        if (s.respect > 15 || s.strength > 6) { s.respect += 4; s.reputation += 3; t('You cooled it down. Respect earned.', 'good'); }
        else { s.health -= 12; s.heat += 8; t('You caught a stray hit breaking it up.', 'bad'); }
        break;
      case 'side_strong': s.respect += 2; this.state.changeFactionRep('iron_dogs', 4); s.heat += 6; t('You backed the winner.', 'good'); break;
      case 'join_fight': this.hooks.spawnHostile(); s.heat += 12; t('You jumped into the brawl!', 'bad'); break;
      case 'bet':
        if (s.money >= 5) { s.money -= 5; if (Math.random() < 0.5) { s.money += 12; t('Your bet paid off! +$7 net', 'good'); } else t('You lost the bet. -$5', 'bad'); }
        else t('Not enough cash to bet.'); break;
      case 'stash': {
        const c = this.inv.contrabandItems();
        if (c.length) { this.inv.toStash('stash_cell', c[0].itemId); t('You stashed contraband just in time.', 'good'); }
        else t('Nothing to hide. You stay cool.'); break;
      }
      case 'comply': s.heat = clamp(s.heat - 5, 0, 100); t('You comply. Heat eases a little.'); break;
      case 'slip_away': if (Math.random() < 0.4 + s.agility * 0.04) { t('You slipped the search.', 'good'); } else { s.heat += 15; const seized = this.inv.confiscateContraband(); if (seized) this.hooks.addTime(1, 'Contraband seized'); t('Caught dodging — contraband seized!', 'bad'); } break;
      case 'rumor_invest': s.intelligence += Math.random() < 0.3 ? 1 : 0; this.inv.add('betting_slip'); t('You dig up a lead and a betting slip.', 'good'); break;
      case 'help_sick': s.reputation += 4; this.state.changeFactionRep('yard_saints', 6); s.mood += 5; t('You help them to medical. Saints respect that.', 'good'); break;
      case 'deny_theft': if (s.intelligence > 5 || Math.random() < 0.5) { t('They believe you. Crisis averted.', 'good'); } else { this.hooks.spawnHostile(); t('They don\'t buy it — here come fists!', 'bad'); } break;
      case 'pay_theft': if (s.money >= 12) { s.money -= 12; t('You pay them off. -$12'); } else t('No cash — they get angrier.'); break;
      case 'threaten_theft': if (s.strength + s.fear * 0.1 > 7) { s.fear += 4; t('They back down.', 'good'); } else { this.hooks.spawnHostile(); t('Wrong move — they swing!', 'bad'); } break;
      case 'lift_challenge': if (s.strength > 6 && s.stamina > 30) { s.strength += 1; s.respect += 5; this.state.changeFactionRep('iron_dogs', 6); t('You out-lift him! +1 STR, respect up.', 'good'); } else { s.respect = Math.max(0, s.respect - 3); t('You gas out. Respect dips.', 'bad'); } break;
      case 'decline_respect': s.respect = Math.max(0, s.respect - 2); t('You walk away. Some see weakness.'); break;
      case 'recruit_offer': s.influence += 3; t('You keep your options open. Influence up.', 'good'); break;
      case 'pay_protection': if (s.money >= 15) { s.money -= 15; this.state.flags['protected'] = this.state.day; t('You pay the bully off. Safe for now.'); } else { this.hooks.spawnHostile(); t('No money? Then you pay in blood!', 'bad'); } break;
      case 'refuse_protection': if (s.strength + s.respect * 0.1 > 8) { s.respect += 4; t('You stand your ground. Respect up.', 'good'); } else { this.hooks.spawnHostile(); t('The bully makes good on his threat!', 'bad'); } break;
      case 'force_lockdown': this.hooks.forceLockdown(); t('EMERGENCY LOCKDOWN!', 'bad'); break;
      case 'help_new': s.reputation += 3; this.state.changeFactionRep('yard_saints', 4); t('You show the new fish the ropes. Rep up.', 'good'); break;
      case 'rob_new': if (Math.random() < 0.6) { s.money += 8; s.reputation -= 4; this.state.changeFactionRep('yard_saints', -6); t('You shake them down. +$8, but rep drops.', 'bad'); } else { s.heat += 12; this.hooks.addTime(1, 'Caught robbing an inmate'); t('A guard saw it — heat up!', 'bad'); } break;
      case 'bribe_guard': if (s.money >= 20) { s.money -= 20; s.heat = clamp(s.heat - 50, 0, 100); t('Heat cleared via bribe.', 'good'); } else t('Not enough cash.'); break;
      case 'confront_snitch': this.hooks.spawnHostile(); s.respect += 2; t('You confront the snitch — it gets physical.', 'bad'); break;
      case 'lay_low': s.heat = clamp(s.heat - 8, 0, 100); s.mood -= 4; t('You keep your head down. Heat eases.'); break;
      case 'ambush_fight': this.hooks.spawnHostile(); this.hooks.spawnHostile(); s.heat += 5; t('You fight off the ambush!', 'bad'); break;
      case 'ambush_give': { const v = this.inv.contrabandItems()[0]; if (v) { this.inv.remove(v.itemId, 1); t('You hand over your goods to avoid a beating.'); } else { s.money = Math.max(0, s.money - 10); t('They take $10 off you.'); } break; }
      case 'fix_machine': if (s.intelligence > 5 || Math.random() < 0.5) { s.money += 10; this.state.changeFactionRep('guards', 3); t('You fix it. +$10, guards approve.', 'good'); } else { s.health -= 10; t('Sparks burn you. -10 HP', 'bad'); } break;
      case 'take_stash': { const loot = ['cigarettes', 'shiv', 'cash', 'energy_pills'][Math.floor(Math.random() * 4)]; if (this.inv.add(loot)) t(`You pocket a hidden stash: ${loot}!`, 'good'); break; }
      case 'warden_watch': this.state.flags['warden_watch'] = this.state.day; t('The Warden is watching. Behave.'); break;
      case 'faction_brawl_join': this.hooks.spawnHostile(); s.respect += 3; s.heat += 10; t('You pick a side in the brawl!', 'bad'); break;
      case 'escape_thread': this.hooks.startEscapeThread(); break;
    }
    this.state.clampStats();
    this.done();
  }
}
