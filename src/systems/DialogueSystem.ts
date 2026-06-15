import { GameState, relLevel } from '../game/GameState';
import { InventorySystem } from './InventorySystem';
import { AudioSystem } from './AudioSystem';
import { FACTIONS } from '../data/factions';
import { ITEMS } from '../data/items';
import { NPC } from '../entities/NPC';

interface Choice { label: string; act: () => void; }

export class DialogueSystem {
  active = false;
  npc: NPC | null = null;
  private panel: HTMLDivElement;
  onChallenge?: (npc: NPC) => void;
  onClose?: () => void;
  toast?: (msg: string, type?: string) => void;

  constructor(private state: GameState, private inv: InventorySystem, private audio: AudioSystem) {
    this.panel = document.createElement('div');
    this.panel.id = 'dialogue';
    this.panel.style.display = 'none';
    document.getElementById('ui-root')!.appendChild(this.panel);
  }

  private rel() { return this.state.mem(this.npc!.def.id).relationship; }

  open(npc: NPC) {
    if (npc.ko) return;
    this.npc = npc;
    this.active = true;
    this.panel.style.display = 'flex';
    this.audio.play('click');
    this.render(this.greeting());
  }

  close() {
    this.active = false;
    this.npc = null;
    this.panel.style.display = 'none';
    this.onClose?.();
  }

  private greeting(): string {
    const a = this.npc!.def.archetype;
    const r = this.rel();
    if (this.npc!.isGuard) return r < -20 ? "Keep moving, inmate. I've got my eye on you." : 'State your business and move along.';
    if (this.npc!.def.role === 'doctor') return 'You hurt? I can patch you up if you behave.';
    if (this.npc!.def.role === 'warden') return 'Every day in here is a chance to earn your release... or lose it.';
    if (this.npc!.def.role === 'cook') return 'Hungry? Line forms at the counter. Don\'t start trouble in my kitchen.';
    if (r <= -40) return 'You\'ve got nerve showing your face to me.';
    if (r >= 45) return 'My friend! Good to see a face I trust.';
    const lines: Record<string, string> = {
      bully: 'You lost, fish? Or you lookin\' to pay rent?',
      hustler: 'I got product, I got info. What you need?',
      friend: 'Hey, hangin\' in there? This place\'ll test you.',
      coward: 'I-I don\'t want no trouble, okay?',
      veteran: 'Been here longer than the paint. What do you want?',
      hothead: 'WHAT? You got something to say to me?',
      strategist: 'Everything in here is a transaction. Let\'s talk.',
      snitch: 'I see everything that happens on this block.',
      protector: 'Stay close to me and the wolves won\'t bite.',
      workout: 'You even lift? Step to the iron sometime.',
      booksmart: 'Knowledge is the only real currency in here.'
    };
    return lines[a] ?? 'What do you want?';
  }

  private render(text: string) {
    const npc = this.npc!;
    const f = FACTIONS[npc.def.faction];
    const r = this.rel();
    const lvl = relLevel(r);
    this.panel.innerHTML = `
      <div class="dlg-card">
        <div class="dlg-head" style="border-color:${f.cssColor}">
          <div class="dlg-name">${npc.def.name}</div>
          <div class="dlg-meta"><span style="color:${f.cssColor}">${f.name}</span> · ${npc.def.role} · <span class="rel-${lvl}">${lvl}</span></div>
        </div>
        <div class="dlg-text">${text}</div>
        <div class="dlg-choices"></div>
      </div>`;
    const cc = this.panel.querySelector('.dlg-choices') as HTMLDivElement;
    for (const c of this.buildChoices()) {
      const b = document.createElement('button');
      b.className = 'dlg-btn';
      b.textContent = c.label;
      b.onclick = () => { this.audio.play('click'); c.act(); };
      cc.appendChild(b);
    }
  }

  private say(line: string) { this.render(line); }

  private buildChoices(): Choice[] {
    const npc = this.npc!;
    const out: Choice[] = [];
    const mem = this.state.mem(npc.def.id);

    out.push({ label: '💬 Make small talk', act: () => this.talk() });

    if (!npc.isGuard && npc.def.role !== 'warden') {
      out.push({ label: '🗣️ Ask about rumors', act: () => this.rumor() });
    }

    if (npc.def.role === 'trader' || npc.def.archetype === 'hustler') {
      out.push({ label: '💱 Trade', act: () => this.trade() });
    }
    if (npc.def.role === 'doctor') {
      out.push({ label: '🩺 Get treated ($10)', act: () => this.heal() });
    }
    if (npc.def.role === 'cook') {
      out.push({ label: '🍱 Grab a tray', act: () => this.grabFood() });
    }
    if (['leader', 'recruiter'].includes(npc.def.role) && !npc.isGuard && npc.def.faction !== 'staff') {
      out.push({ label: '🤝 Ask to join ' + FACTIONS[npc.def.faction].name, act: () => this.join() });
      out.push({ label: '📋 Ask for a job/favor', act: () => this.favor() });
    }
    if (!npc.isGuard && npc.def.faction !== 'staff') {
      out.push({ label: '🛡️ Ask for protection', act: () => this.protection() });
      out.push({ label: '😤 Threaten', act: () => this.threaten() });
      out.push({ label: '🤬 Insult', act: () => this.insult() });
      out.push({ label: '👊 Challenge to a fight', act: () => { this.close(); this.onChallenge?.(npc); } });
      out.push({ label: '🎁 Offer help (+rep)', act: () => this.offerHelp() });
    }
    if (mem.relationship < 0) {
      out.push({ label: '🙏 Apologize', act: () => this.apologize() });
    }
    if (npc.isGuard) {
      out.push({ label: '💵 Offer bribe ($20)', act: () => this.bribe() });
    }
    out.push({ label: '✖ End conversation', act: () => this.close() });
    return out;
  }

  private talk() {
    this.state.changeRelationship(this.npc!.def.id, 2);
    this.state.changeFactionRep(this.npc!.def.faction, 1);
    this.say('You shoot the breeze for a minute. Small bonds matter in here.');
    setTimeout(() => this.render(this.greeting()), 700);
  }

  private rumor() {
    const rumors = [
      'Word is the Vipers are moving product through the laundry.',
      'They say the Warden\'s cutting sentences for good behavior this month.',
      'Heard a screw on night shift takes bribes — easy heat to shed.',
      'The Iron Dogs are planning to take the gym for good.',
      'Somebody\'s digging in the maintenance halls... could be a way out.',
      'Fresh fish coming in tomorrow. Bullies are already circling.'
    ];
    this.state.stats.intelligence += 0; // info value
    this.say('"' + rumors[Math.floor(Math.random() * rumors.length)] + '"');
    this.state.changeRelationship(this.npc!.def.id, 1);
  }

  private trade() {
    const npc = this.npc!;
    // NPC offers contraband for sale; player can also sell
    const forSale = npc.def.faction === 'black_vipers'
      ? ['shiv', 'energy_pills', 'lockpick', 'cigarettes']
      : npc.def.faction === 'blue_kings'
      ? ['cigarettes', 'phone', 'snack', 'betting_slip']
      : ['cigarettes', 'snack', 'alcohol_brew'];
    let html = '<div class="trade-grid"><div class="trade-col"><h4>Buy</h4>';
    for (const id of forSale) {
      const it = ITEMS[id];
      html += `<button class="trade-item" data-buy="${id}">${it.icon} ${it.name} <span>$${it.value}</span></button>`;
    }
    html += '</div><div class="trade-col"><h4>Sell</h4>';
    for (const inv of this.state.inventory) {
      const it = ITEMS[inv.itemId];
      html += `<button class="trade-item" data-sell="${inv.itemId}">${it.icon} ${it.name} x${inv.qty} <span>$${Math.ceil(it.value * 0.6)}</span></button>`;
    }
    html += '</div></div><div class="trade-money">Your cash: $<b id="trade-cash">' + this.state.stats.money + '</b></div>';
    this.render(html);
    this.panel.querySelectorAll('[data-buy]').forEach((b) => {
      (b as HTMLElement).onclick = () => {
        const id = (b as HTMLElement).dataset.buy!;
        const it = ITEMS[id];
        if (this.state.stats.money >= it.value && this.inv.add(id, 1)) {
          this.state.stats.money -= it.value;
          this.audio.play('money');
          this.state.mem(this.npc!.def.id).traded = true;
          this.state.changeRelationship(this.npc!.def.id, 3);
          this.trade();
        } else { this.toast?.('Can\'t buy that', 'bad'); }
      };
    });
    this.panel.querySelectorAll('[data-sell]').forEach((b) => {
      (b as HTMLElement).onclick = () => {
        const id = (b as HTMLElement).dataset.sell!;
        const it = ITEMS[id];
        if (this.inv.remove(id, 1)) {
          this.state.stats.money += Math.ceil(it.value * 0.6);
          this.audio.play('money');
          this.state.changeRelationship(this.npc!.def.id, 2);
          this.trade();
        }
      };
    });
  }

  private heal() {
    const s = this.state.stats;
    if (s.money < 10) { this.say('"No cash, no care. Come back when you can pay."'); return; }
    s.money -= 10;
    s.health = s.maxHealth;
    s.injury = 0;
    this.audio.play('rep');
    this.say('The doc patches you up. Good as new.');
    this.toast?.('Healed: full health, injury cleared', 'good');
  }

  private grabFood() {
    if (this.inv.add('food_tray', 1)) { this.audio.play('pickup'); this.say('You grab a tray of mystery meat.'); }
    else this.say('Your hands are full.');
  }

  private join() {
    const npc = this.npc!;
    const f = npc.def.faction;
    const rep = this.state.factionRep[f] ?? 0;
    if (this.state.playerFaction === f) { this.say('"You\'re already one of us. Stay sharp."'); return; }
    const needed = 25;
    if (this.state.stats.respect >= 20 && rep >= needed) {
      this.state.playerFaction = f;
      this.state.changeFactionRep(f, 20);
      this.state.stats.influence += 15;
      this.audio.play('rep');
      this.say(`"Welcome to the ${FACTIONS[f].name}. Wear it with pride — and watch your back."`);
      this.toast?.(`You joined the ${FACTIONS[f].name}!`, 'good');
    } else {
      this.say(`"You ain\'t earned it yet. Build some respect and faction standing first." (Need respect 20 & ${FACTIONS[f].name} rep ${needed})`);
    }
  }

  private favor() {
    const s = this.state.stats;
    const success = Math.random() < 0.4 + s.intelligence * 0.04 + this.rel() * 0.003;
    if (success) {
      const reward = 10 + Math.floor(Math.random() * 15);
      s.money += reward;
      this.state.changeFactionRep(this.npc!.def.faction, 6);
      this.state.stats.respect += 3;
      this.audio.play('money');
      this.say(`"Handled it clean. Here\'s your cut — $${reward}." Faction respect rises.`);
    } else {
      s.heat += 8;
      this.say('"You botched it. That\'s heat on both of us." Heat rises.');
    }
  }

  private protection() {
    const cost = 15;
    if (this.state.stats.money < cost) { this.say('"Protection ain\'t free. Come back with $15."'); return; }
    this.state.stats.money -= cost;
    this.state.changeRelationship(this.npc!.def.id, 8);
    this.state.flags['protected'] = (this.state.day);
    this.audio.play('money');
    this.say('"Aight. Nobody touches you today. Word."');
    this.toast?.('You bought protection for the day', 'good');
  }

  private threaten() {
    const npc = this.npc!;
    const s = this.state.stats;
    const intimidation = s.strength + s.respect * 0.1 + s.fear * 0.1;
    if (intimidation > npc.base.strength + 4 || npc.def.archetype === 'coward') {
      this.state.changeRelationship(npc.def.id, -6);
      s.fear += 4; s.respect += 1;
      this.say('"Okay, okay! Easy! Whatever you say, man."');
    } else {
      this.state.changeRelationship(npc.def.id, -12);
      this.say('"Ha! You? Threatening ME? Step careful, fish."');
      if (npc.base.aggression > 0.7) { this.close(); this.onChallenge?.(npc); }
    }
  }

  private insult() {
    const npc = this.npc!;
    this.state.mem(npc.def.id).insulted = true;
    this.state.changeRelationship(npc.def.id, -15);
    this.state.changeFactionRep(npc.def.faction, -8);
    this.say('"You\'ll regret that mouth."');
    if (npc.base.aggression > 0.55 || npc.def.archetype === 'hothead') { this.close(); this.onChallenge?.(npc); }
  }

  private offerHelp() {
    // costs a cigarette or snack
    const give = this.inv.count('cigarettes') > 0 ? 'cigarettes' : this.inv.count('snack') > 0 ? 'snack' : null;
    if (!give) { this.say('You\'ve got nothing useful to offer right now.'); return; }
    this.inv.remove(give, 1);
    this.state.mem(this.npc!.def.id).helped = true;
    this.state.changeRelationship(this.npc!.def.id, 12);
    this.state.changeFactionRep(this.npc!.def.faction, 5);
    this.state.stats.reputation += 2;
    this.audio.play('rep');
    this.say('"You didn\'t have to do that. I won\'t forget it." Relationship improves.');
  }

  private apologize() {
    this.state.changeRelationship(this.npc!.def.id, 8);
    const mem = this.state.mem(this.npc!.def.id);
    mem.insulted = false;
    if (this.npc!.ai === 'fight') { this.npc!.ai = 'schedule'; this.npc!.combatTarget = null; this.npc!.hostile = false; }
    this.say('"...Fine. We\'re square. For now."');
  }

  private bribe() {
    if (this.state.stats.money < 20) { this.say('"You think $0 buys silence? Get lost."'); return; }
    // corrupt guards accept; strict ones get angry
    const corrupt = Math.random() < 0.5;
    this.state.stats.money -= 20;
    if (corrupt) {
      this.state.stats.heat = Math.max(0, this.state.stats.heat - 45);
      this.state.mem(this.npc!.def.id).bribed = true;
      this.audio.play('money');
      this.say('"...I didn\'t see nothing. We\'re good." Heat drops sharply.');
      this.toast?.('Heat reduced by bribe', 'good');
    } else {
      this.state.stats.heat = Math.min(100, this.state.stats.heat + 20);
      this.say('"Bribing an officer? That\'s MORE time, inmate." Heat rises!');
      this.toast?.('Bribe rejected — heat up!', 'bad');
    }
  }
}
