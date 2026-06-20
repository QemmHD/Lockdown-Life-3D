// Title screen, pause/menu overlay (tabbed: Stats/Relationships/Inventory/Objectives/Gangs/Help),
// and the daily summary modal (Stage 3.4). Lightweight DOM/CSS — reads a sim snapshot, never writes.

import { NewGameSetup, defaultSetup, randomSetup, POS_TRAITS, NEG_TRAITS, BACKSTORIES, GANG_LEANS, DIFFICULTIES, SKINS, HAIRS, ACCENTS, BUILDS, TRAIT_LABEL, backstoryDef, diffDef } from '../sim/NewGameSetup';

export interface MenuHooks {
  onNewGame: () => void;
  onContinue: () => void;
  onQuickStart: () => void;
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onMainMenu: () => void;
  onBeginRun: (setup: NewGameSetup) => void;
  onAcceptInvite: () => void;
  onDeclineInvite: () => void;
  onLeaveGang: () => void;
  onUseItem: (id: string) => void;
  onDropItem: (id: string) => void;
  onStashItem: (id: string) => void;
  onCraft: (id: string) => void;
  onCommissaryBuy: (id: string) => void;
  onBuy: (seller: number, id: string) => void;
  onSell: (buyer: number, id: string) => void;
  tradeData: (seller: number) => any;
  hasSave: () => boolean;
  saveInfo: () => { name: string; day: number } | null;
  snapshot: () => any;
  onCoachDone: () => void;
  version: string;
}

type Mode = 'hidden' | 'title' | 'pause' | 'summary' | 'setup' | 'trade' | 'ending' | 'coach';
const GANG_NAMES: Record<string, string> = { none: 'Unaffiliated', iron_block: 'Iron Block', yard_kings: 'Yard Kings', blue_chain: 'Blue Chain', redline_crew: 'Redline Crew', north_hall: 'North Hall', cell_rats: 'Cell Rats' };

export class Menus {
  private root: HTMLDivElement;
  private mode: Mode = 'hidden';
  private tab = 'objectives';
  private summary: any = null;
  private ending: any = null;
  private setup: NewGameSetup = defaultSetup();
  private step = 0;
  private tradeSeller = 0;
  constructor(private hooks: MenuHooks) {
    this.root = document.createElement('div');
    this.root.id = 'menu-root';
    this.root.className = 'hidden';
    document.getElementById('ui-root')!.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  isOpen() { return this.mode !== 'hidden'; }
  refresh() { if (this.mode !== 'hidden') this.render(); }
  showTrade(seller: number) { this.tradeSeller = seller; this.mode = 'trade'; this.render(); }
  showSetup() { this.setup = defaultSetup(); this.setup.traits = ['tough']; this.step = 0; this.mode = 'setup'; this.render(); }
  showTitle() { this.mode = 'title'; this.render(); }
  showPause() { this.mode = 'pause'; this.render(); }
  showSummary(data: any) { this.summary = data; this.mode = 'summary'; this.render(); }
  showEnding(data: any) { this.ending = data; this.mode = 'ending'; this.render(); }
  showCoach(step = 0) { this.step = step; this.mode = 'coach'; this.render(); }
  hide() { this.mode = 'hidden'; this.root.className = 'hidden'; }

  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest('[data-m]') as HTMLElement | null;
    if (!el) return;
    const a = el.dataset.m!;
    if (a === 'tab') { this.tab = el.dataset.tab!; this.render(); return; }
    if (a === 'help-title') { document.getElementById('m-help-title')?.classList.toggle('hidden'); return; }
    if (a === 'pick') { this.pick(el.dataset.field!, el.dataset.val!); return; }
    if (a === 'setup-nav') { this.nav(el.dataset.dir!); return; }
    if (a === 'buy') { this.hooks.onBuy(this.tradeSeller, el.dataset.id!); this.render(); return; }
    if (a === 'sell') { this.hooks.onSell(this.tradeSeller, el.dataset.id!); this.render(); return; }
    if (a === 'use') { this.hooks.onUseItem(el.dataset.id!); this.render(); return; }
    if (a === 'drop') { this.hooks.onDropItem(el.dataset.id!); this.render(); return; }
    if (a === 'stash') { this.hooks.onStashItem(el.dataset.id!); this.render(); return; }
    if (a === 'craft') { this.hooks.onCraft(el.dataset.id!); this.render(); return; }
    if (a === 'commbuy') { this.hooks.onCommissaryBuy(el.dataset.id!); this.render(); return; }
    if (a === 'coach-next') { if (this.step >= 3) this.hooks.onCoachDone(); else { this.step++; this.render(); } return; }
    if (a === 'coach-skip') { this.hooks.onCoachDone(); return; }
    if (a === 'closetrade') { this.hooks.onResume(); return; }
    if (a === 'accept-invite') { this.hooks.onAcceptInvite(); this.render(); return; }
    if (a === 'decline-invite') { this.hooks.onDeclineInvite(); this.render(); return; }
    if (a === 'leave-gang') { this.hooks.onLeaveGang(); this.render(); return; }
    switch (a) {
      case 'newgame': this.hooks.onNewGame(); break;
      case 'continue': this.hooks.onContinue(); break;
      case 'quickstart': this.hooks.onQuickStart(); break;
      case 'resume': this.hooks.onResume(); break;
      case 'save': this.hooks.onSave(); this.render(); break;
      case 'load': this.hooks.onLoad(); break;
      case 'mainmenu': this.hooks.onMainMenu(); break;
      case 'dismiss': this.hooks.onResume(); break;
    }
  }

  // ---- setup flow ----
  private syncInputs() {
    const g = (id: string) => (this.root.querySelector('#' + id) as HTMLInputElement | null)?.value;
    const nm = g('su-name'); if (nm != null) this.setup.name = nm.trim().slice(0, 16);
    const nk = g('su-nick'); if (nk != null) this.setup.nickname = nk.trim().slice(0, 14);
    const sd = g('su-seed'); if (sd != null) this.setup.seed = sd.trim() ? (parseInt(sd, 36) || 0) : 0;
  }
  private pick(field: string, val: string) {
    const s = this.setup;
    switch (field) {
      case 'trait': { const i = s.traits.indexOf(val); if (i >= 0) s.traits.splice(i, 1); else if (s.traits.length < 2) s.traits.push(val); break; }
      case 'weak': s.weakness = val; break;
      case 'backstory': s.backstory = val; break;
      case 'gang': s.gangLean = val; break;
      case 'diff': s.difficulty = val; break;
      case 'chaos': s.chaosIntensity = val; break;
      case 'build': s.appearance.build = val as any; break;
      case 'skin': s.appearance.skin = +val; break;
      case 'hair': s.appearance.hair = +val; break;
      case 'accent': s.appearance.accent = +val; break;
      case 'tips': s.tutorialTips = val === '1'; break;
    }
    this.render();
  }
  private nav(dir: string) {
    this.syncInputs();
    if (dir === 'cancel') { this.showTitle(); return; }
    if (dir === 'randname') { const N = ['Rook', 'Mason', 'Knox', 'Diesel', 'Tully', 'Vince', 'Cane', 'Marco', 'Boone', 'Reyes', 'Otis', 'Wyatt']; this.setup.name = N[Math.floor(Math.random() * N.length)]; this.render(); return; }
    if (dir === 'randomize') { const keepSeed = this.setup.seed; this.setup = randomSetup(Math.random); this.setup.seed = keepSeed || this.setup.seed; this.render(); return; }
    if (dir === 'begin') { if (!this.setup.name.trim()) this.setup.name = 'Knox'; this.hooks.onBeginRun(this.setup); return; }
    this.step = Math.max(0, Math.min(4, this.step + (dir === 'next' ? 1 : -1)));
    this.render();
  }

  private render() {
    if (this.mode === 'hidden') { this.hide(); return; }
    this.root.className = '';
    if (this.mode === 'title') { this.root.innerHTML = this.title(); return; }
    if (this.mode === 'summary') { this.root.innerHTML = this.summaryCard(this.summary); return; }
    if (this.mode === 'ending') { this.root.innerHTML = this.endingCard(this.ending); return; }
    if (this.mode === 'setup') { this.root.innerHTML = this.setupCard(); return; }
    if (this.mode === 'trade') { this.root.innerHTML = this.tradeCard(); return; }
    if (this.mode === 'coach') { this.root.innerHTML = this.coachCard(); return; }
    this.root.innerHTML = this.pause();
  }

  // first-run onboarding overlay (Stage 4.23) — addresses the original's #1 legibility gap
  private coachCard(): string {
    const cards = [
      { t: 'Welcome to the block', b: 'Tap anywhere to walk. Tap an inmate, guard, or object to size it up and act. The camera follows you.' },
      { t: 'People & fights', b: 'Open someone to talk, compliment, recruit, threaten — or fight. Recruited allies pile into your brawls. Guards who SEE a fight come to break it up; hit one and the whole block turns on you.' },
      { t: 'Stay alive', b: 'Mind your Health and the gold Spirit bar. Eat, sleep, and wash on the day’s schedule. Smokes & hooch lift Spirit — at a cost. Let Spirit bottom out and you lose control.' },
      { t: 'Do your time', b: 'Serve your sentence to walk free — or work an escape. Train a build, earn respect, craft in the Workshop, and keep your nose clean: witnessed crimes go to a hearing where your reputation works against you.' },
    ];
    const i = Math.max(0, Math.min(cards.length - 1, this.step));
    const c = cards[i]; const last = i === cards.length - 1;
    return `<div class="m-overlay"><div class="m-card" style="max-width:520px">
      <div class="m-head"><b>${c.t}</b><span class="m-pill">${i + 1}/${cards.length}</span></div>
      <div class="m-sub" style="font-size:15px;line-height:1.55;margin:12px 0">${c.b}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="m-tab act" data-m="coach-skip">Skip</button>
        <button class="m-btn primary" data-m="coach-next">${last ? 'Start ▶' : 'Next ›'}</button>
      </div></div></div>`;
  }

  private title(): string {
    const has = this.hooks.hasSave();
    const info = has ? this.hooks.saveInfo() : null;
    const cont = info ? `Continue: ${info.name}, Day ${info.day}` : 'Continue';
    return `<div class="m-title">
      <div class="m-logo">LOCKDOWN<span>LIFE 3D</span></div>
      <div class="m-tag">Do your time. Build a name. Survive the block.</div>
      <div class="m-menu">
        ${has ? `<button class="m-btn primary" data-m="continue">▶ ${cont}</button><button class="m-btn" data-m="newgame">New Game</button>`
        : `<button class="m-btn primary" data-m="newgame">▶ New Game</button><button class="m-btn" data-m="quickstart">Quick Start</button>`}
      </div>
      <div class="m-row">
        <button class="m-chip" data-m="help-title">How to Play</button>
      </div>
      <div id="m-help-title" class="m-help hidden">${this.helpBody()}</div>
      <div class="m-ver">${this.hooks.version} · fictional game · no real-world content</div>
    </div>`;
  }

  private pause(): string {
    const tabs = [
      ['objectives', 'Objectives'], ['stats', 'Stats'], ['relationships', 'People'],
      ['inventory', 'Inventory'], ['commissary', 'Commissary'], ['gangs', 'Gangs'], ['help', 'Help'], ['settings', 'Settings']
    ];
    const list = tabs.map(([k, n]) => `<button class="m-tab ${this.tab === k ? 'on' : ''}" data-m="tab" data-tab="${k}">${n}</button>`).join('');
    return `<div class="m-overlay">
      <div class="m-card">
        <div class="m-head"><b>Paused</b><button class="m-x" data-m="resume">✕</button></div>
        <div class="m-body">
          <div class="m-tabs">
            ${list}
            <div class="m-tabs-sp"></div>
            <button class="m-tab act" data-m="save">▣ Save</button>
            <button class="m-tab act" data-m="load" ${this.hooks.hasSave() ? '' : 'disabled'}>▤ Load</button>
            <button class="m-tab act" data-m="resume">▶ Resume</button>
            <button class="m-tab act danger" data-m="mainmenu">Main Menu</button>
          </div>
          <div class="m-content">${this.tabContent()}</div>
        </div>
      </div>
    </div>`;
  }

  private tabContent(): string {
    const s = this.hooks.snapshot();
    switch (this.tab) {
      case 'stats': return this.statsTab(s);
      case 'relationships': return this.relTab(s);
      case 'inventory': return this.invTab(s);
      case 'commissary': return this.commissaryTab(s);
      case 'gangs': return this.gangTab(s);
      case 'help': return this.helpBody();
      case 'settings': return `<div class="m-note">Settings coming soon. (Audio, quality, and controls are planned.)</div>`;
      default: return this.objTab(s);
    }
  }

  private bar(label: string, v: number, color: string): string {
    return `<div class="m-need"><span>${label}</span><div class="m-need-bg"><div class="m-need-fill" style="width:${Math.round(v * 100)}%;background:${color}"></div></div></div>`;
  }
  private statsTab(s: any): string {
    const st = s.stats; const t = s.tier; const p = s.progression;
    const h = Math.floor(st.hour), m = Math.floor((st.hour - h) * 60); const ap = h >= 12 ? 'PM' : 'AM'; let hh = h % 12; if (!hh) hh = 12;
    return `<div class="m-grid2">
      <div>
        <div class="m-h">${st.name} <span class="m-pill">${st.tier}</span></div>
        <div class="m-sub">Day ${st.day} · ${hh}:${m.toString().padStart(2, '0')} ${ap} · ${st.room} · ${st.action}</div>
        <div class="m-sub">${st.backstory ?? ''}${st.difficulty ? ` · ${st.difficulty}` : ''}${st.gangLean && st.gangLean !== 'Unaffiliated' ? ` · ${st.gangLean} lean` : ''}</div>
        ${st.traits && st.traits.length ? `<div class="m-chips2">${st.traits.map((t: string) => `<span class="su-chip on">${t}</span>`).join('')}</div>` : ''}
        <div class="m-tier"><div class="m-tier-bg"><div class="m-tier-fill" style="width:${Math.round(t.progress * 100)}%"></div></div><div class="m-sub">${t.next ? `Progress to ${t.next}` : 'Top tier'} — ${t.desc}</div></div>
        ${this.bar('Health', st.health, '#e74c3c')}${this.bar('Energy', st.energy, '#2ecc71')}
        ${this.bar('Hunger', 1 - st.hunger, '#e67e22')}${this.bar('Hygiene', 1 - st.hygiene, '#3498db')}
        ${this.bar('Calm', 1 - st.anger, '#c0392b')}${this.bar('Nerve', 1 - st.fear, '#9b59b6')}
      </div>
      <div>
        <div class="m-kv"><span>Money</span><b>$${st.money}</b></div>
        <div class="m-kv"><span>Reputation</span><b>${st.reputation}</b></div>
        <div class="m-kv"><span>Respect</span><b>${st.respect}</b></div>
        <div class="m-kv"><span>Suspicion</span><b>${st.suspicion}</b></div>
        <div class="m-kv"><span>Heat</span><b>${st.heat}</b></div>
        <div class="m-kv"><span>Gang</span><b>${st.gang}</b></div>
        <div class="m-kv"><span>Discipline</span><b>${st.discipline}${st.solitaryTimer ? ` (${st.solitaryTimer}s)` : ''}</b></div>
        ${st.charges ? `<div class="m-kv"><span>Rap sheet</span><b>${st.charges} pending · hearing day ${st.hearingDay}</b></div>` : ''}
        <div class="m-hr"></div>
        <div class="m-kv"><span>Days survived</span><b>${p.daysSurvived}</b></div>
        <div class="m-kv"><span>Objectives done</span><b>${p.objectivesCompleted}</b></div>
        <div class="m-kv"><span>Jobs</span><b>${p.jobs}</b></div>
        <div class="m-kv"><span>Fights (W/L)</span><b>${p.fights} (${p.wins}/${p.losses})</b></div>
        <div class="m-kv"><span>Searches</span><b>${p.searches}</b></div>
        <div class="m-kv"><span>Solitary visits</span><b>${p.solitary}</b></div>
        <div class="m-kv"><span>Lockdowns</span><b>${p.lockdowns}</b></div>
        <div class="m-kv"><span>Contraband caught</span><b>${p.contrabandIncidents}</b></div>
      </div>
    </div>`;
  }
  private objTab(s: any): string {
    if (!s.objectives.length) return `<div class="m-note">No active objectives.</div>`;
    const rows = s.objectives.map((o: any) => `<div class="m-obj ${o.done ? 'done' : ''}">
      <span class="m-obj-c">${o.done ? '✓' : '○'}</span>
      <span class="m-obj-t">${o.text}${o.goal > 1 ? ` <i>(${o.progress}/${o.goal})</i>` : ''}</span>
      <span class="m-obj-r">${o.reward.money ? `$${o.reward.money}` : ''} ${o.reward.rep ? `+${o.reward.rep}rep` : ''} ${o.reward.respect ? `+${o.reward.respect}resp` : ''}</span>
    </div>`).join('');
    return `<div class="m-h">Today's objectives</div><div class="m-sub">Small goals to give your day direction.</div>${rows}`;
  }
  private relTab(s: any): string {
    if (!s.relationships.length) return `<div class="m-note">You haven't met anyone yet.</div>`;
    const rows = s.relationships.slice(0, 24).map((r: any) => `<div class="m-rel">
      <span class="m-rel-n">${r.name}${r.gang ? ` · <i>${r.gang}</i>` : ''}</span>
      <span class="m-rel-w w-${r.word.replace(/\\s/g, '')}">${r.word}${r.hint ? ` · ${r.hint}` : ''}</span>
    </div>`).join('');
    return `<div class="m-h">People you know</div><div class="m-sub">How other inmates feel about you.</div>${rows}`;
  }
  private invTab(s: any): string {
    const warn = s.contrabandCarried ? `<div class="m-warn">⚠ Carrying contraband — guards may search you.</div>` : '';
    if (!s.inventory.length) return `${warn}<div class="m-note">Your pockets are empty. Buy items by trading with inmates.</div>`;
    const rows = s.inventory.map((it: any) => `<div class="m-inv ${it.contraband ? 'contra' : ''}">
      <div class="m-inv-top"><span class="m-item-n">${it.icon} ${it.name}${it.contraband ? ' ⚠' : ''}</span>
        <span class="m-inv-act">${it.usable ? `<button class="su-card on" data-m="use" data-id="${it.id}">Use</button>` : ''}${it.contraband ? `<button class="su-card" data-m="stash" data-id="${it.id}">Stash</button>` : ''}<button class="su-card" data-m="drop" data-id="${it.id}">Drop</button></span></div>
      <div class="m-item-s">value $${it.value} · risk ${Math.round(it.risk * 100)}% · hide ${Math.round(it.concealment * 100)}% · demand ${it.demand}%${it.combat ? ` · ⚔${it.combat}` : ''} · ${it.category}</div>
    </div>`).join('');
    const craft = (s.crafting && s.crafting.length)
      ? `<div class="m-h" style="margin-top:10px">🔧 Workshop</div>` + s.crafting.map((c: any) => `<div class="m-inv">
        <div class="m-inv-top"><span class="m-item-n">${c.outIcon} ${c.outName}</span>
          <span class="m-inv-act">${c.canMake ? `<button class="su-card on" data-m="craft" data-id="${c.id}">Craft</button>` : `<button class="su-card" disabled>Skill ${c.minSkill}</button>`}</span></div>
        <div class="m-item-s">${c.inputs}${c.canMake ? '' : ' · need more skill'}</div></div>`).join('')
      : '';
    return `<div class="m-h">Inventory</div>${warn}${rows}${craft}<div class="m-sub">Use items to manage needs; stash contraband near a bed/locker/shelf; sell via Trade. Combine parts in the Workshop.</div>`;
  }
  private commissaryTab(s: any): string {
    const money = s.stats.money;
    const rows = (s.commissary ?? []).map((c: any) => `<div class="m-inv">
      <div class="m-inv-top"><span class="m-item-n">${c.icon} ${c.name}</span>
        <span class="m-inv-act"><button class="su-card ${c.affordable ? 'on' : ''}" data-m="commbuy" data-id="${c.id}" ${c.affordable ? '' : 'disabled'}>$${c.price}</button></span></div></div>`).join('');
    return `<div class="m-h">Commissary <span class="m-pill">$${money}</span></div><div class="m-sub">Legit goods at honest prices — the safe money sink. Contraband you still have to find on the block.</div>${rows}`;
  }
  private gangTab(s: any): string {
    const f = s.faction;
    let head = '';
    if (f.membership) {
      head = `<div class="m-h">${f.membership} <span class="m-pill">${f.rank}</span></div>
        <div class="m-sub">Crew goals done: ${f.goalsDone} · perks below. <button class="su-mini" data-m="leave-gang">Leave Gang</button></div>
        <div class="m-chips2">${f.perks.map((p: string) => `<span class="su-chip on">${p}</span>`).join('') || '<span class="m-note">No perks yet.</span>'}</div>`;
    } else if (f.invite) {
      head = `<div class="m-warn">📨 The <b>${f.invite.gang}</b> want you in. <div class="su-cards" style="margin-top:8px"><button class="su-card on" data-m="accept-invite"><b>Accept Invite</b></button><button class="su-card" data-m="decline-invite"><b>Decline</b></button></div></div>`;
    } else {
      head = `<div class="m-h">Gangs</div><div class="m-sub">Build standing with a crew (talk, favours, time in turf) until they invite you in.</div>`;
    }
    const offers = f.crewOffers && f.crewOffers.length ? `<div class="m-label2">Crew supply</div>${f.crewOffers.map((o: any) => `<div class="m-item"><span class="m-item-n">${o.icon} ${o.item}</span><span class="m-item-s">${o.seller} · $${o.price}</span></div>`).join('')}` : '';
    const goals = f.goals && f.goals.length ? `<div class="m-label2">Crew goals</div>${f.goals.map((o: any) => `<div class="m-obj ${o.done ? 'done' : ''}"><span class="m-obj-c">${o.done ? '✓' : '○'}</span><span class="m-obj-t">${o.text}${o.goal > 1 ? ` <i>(${o.progress}/${o.goal})</i>` : ''}</span></div>`).join('')}` : '';
    const rows = f.standings.map((g: any) => `<div class="m-gang">
      <span class="m-gang-d" style="color:#${(g.color >>> 0).toString(16).padStart(6, '0')}">●</span>
      <span class="m-gang-n">${g.name}${g.ally ? ' <i>· your crew</i>' : g.rival ? ' <i>· rival</i>' : ''} <i>· ${g.territory}</i></span>
      <span class="m-gang-s">${g.label} (${g.value})</span>
    </div>`).join('');
    return `${head}<div class="m-label2">Standing</div>${rows}${offers}${goals}`;
  }
  private helpBody(): string {
    return `<div class="m-help-grid">
      <div><b>Move</b><span>Tap the floor to walk there.</span></div>
      <div><b>People</b><span>Tap an inmate/guard to talk, trade, threaten or fight.</span></div>
      <div><b>Objects</b><span>Tap a bed to rest, a table to eat, a sink/shower to wash, weights to train.</span></div>
      <div><b>Doors</b><span>Avoid restricted (red) doors — they raise suspicion.</span></div>
      <div><b>Needs</b><span>Keep hunger/sleep/hygiene down by following the daily schedule.</span></div>
      <div><b>Standing</b><span>Win fights, do jobs and favours to raise reputation & respect tiers.</span></div>
      <div><b>Suspicion</b><span>Contraband and restricted areas get you searched — and sent to solitary.</span></div>
      <div><b>Chaos</b><span>In a lockdown, return to your cell. In a riot, comply or take cover.</span></div>
      <div><b>Fights</b><span>Strike / Heavy / Shove / Grapple / Throw / Block. Guards break up brawls.</span></div>
      <div><b>Camera</b><span><b>Q</b>/<b>E</b> (or ← →) rotate the view · <b>C</b> toggles the close-up character camera · drag to pan, pinch/scroll to zoom.</span></div>
      <div><b>Save</b><span>Save/Load any time from this menu or the bottom bar.</span></div>
    </div>`;
  }
  // ---- character creation / run setup ----
  private swatches(field: string, colors: number[], sel: number): string {
    return colors.map((c) => `<button class="su-sw ${c === sel ? 'on' : ''}" style="background:#${(c >>> 0).toString(16).padStart(6, '0')}" data-m="pick" data-field="${field}" data-val="${c}"></button>`).join('');
  }
  private cards(field: string, opts: { id: string; label: string; desc?: string }[], sel: string): string {
    return opts.map((o) => `<button class="su-card ${o.id === sel ? 'on' : ''}" data-m="pick" data-field="${field}" data-val="${o.id}"><b>${o.label}</b>${o.desc ? `<span>${o.desc}</span>` : ''}</button>`).join('');
  }
  private setupStep(): string {
    const s = this.setup;
    switch (this.step) {
      case 0: return `<div class="m-h">Identity</div>
        <label class="su-l">Name</label><input id="su-name" class="su-in" maxlength="16" value="${this.esc(s.name)}" placeholder="Knox">
        <label class="su-l">Nickname (optional)</label><input id="su-nick" class="su-in" maxlength="14" value="${this.esc(s.nickname)}" placeholder="—">
        <label class="su-l">Seed (optional)</label><input id="su-seed" class="su-in" value="${s.seed ? s.seed.toString(36) : ''}" placeholder="random">
        <button class="su-mini" data-m="setup-nav" data-dir="randname">🎲 Random name</button>`;
      case 1: return `<div class="m-h">Appearance</div>
        <label class="su-l">Skin</label><div class="su-sw-row">${this.swatches('skin', SKINS, s.appearance.skin)}</div>
        <label class="su-l">Hair</label><div class="su-sw-row">${this.swatches('hair', HAIRS, s.appearance.hair)}</div>
        <label class="su-l">Jumpsuit accent</label><div class="su-sw-row">${this.swatches('accent', ACCENTS, s.appearance.accent)}</div>
        <label class="su-l">Build</label><div class="su-cards">${this.cards('build', BUILDS.map((b) => ({ id: b, label: b[0].toUpperCase() + b.slice(1) })), s.appearance.build)}</div>`;
      case 2: return `<div class="m-h">Traits & Backstory</div>
        <label class="su-l">Pick 2 strengths (${s.traits.length}/2)</label>
        <div class="su-chips">${POS_TRAITS.map((t) => `<button class="su-chip ${s.traits.includes(t.id) ? 'on' : ''}" data-m="pick" data-field="trait" data-val="${t.id}" title="${t.desc}">${t.label}</button>`).join('')}</div>
        <label class="su-l">Pick 1 weakness</label>
        <div class="su-chips">${NEG_TRAITS.map((t) => `<button class="su-chip neg ${s.weakness === t.id ? 'on' : ''}" data-m="pick" data-field="weak" data-val="${t.id}" title="${t.desc}">${t.label}</button>`).join('')}</div>
        <label class="su-l">Backstory</label>
        <div class="su-cards">${this.cards('backstory', BACKSTORIES.map((b) => ({ id: b.id, label: b.name, desc: b.desc })), s.backstory)}</div>`;
      case 3: return `<div class="m-h">Start Conditions</div>
        <label class="su-l">Gang lean</label>
        <div class="su-cards">${this.cards('gang', GANG_LEANS.map((g) => ({ id: g, label: GANG_NAMES[g] ?? g })), s.gangLean)}</div>
        <label class="su-l">Difficulty</label>
        <div class="su-cards">${this.cards('diff', DIFFICULTIES.map((d) => ({ id: d.id, label: d.name })), s.difficulty)}</div>
        <label class="su-l">Chaos intensity</label>
        <div class="su-cards">${this.cards('chaos', [{ id: 'low', label: 'Low' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'High' }], s.chaosIntensity)}</div>
        <label class="su-l">Tutorial tips</label>
        <div class="su-cards">${this.cards('tips', [{ id: '1', label: 'On' }, { id: '0', label: 'Off' }], s.tutorialTips ? '1' : '0')}</div>`;
      default: { // review
        const back = backstoryDef(s.backstory); const dd = diffDef(s.difficulty);
        const objs = back.objectives.map((o) => o === 'survive' ? 'Survive the day' : o).join(', ');
        return `<div class="m-h">Review</div>
          <div class="su-rev">
            <div class="m-kv"><span>Name</span><b>${this.esc(s.nickname || s.name)}</b></div>
            <div class="m-kv"><span>Build / look</span><b>${s.appearance.build} <span class="su-dot" style="background:#${(s.appearance.accent >>> 0).toString(16).padStart(6, '0')}"></span></b></div>
            <div class="m-kv"><span>Strengths</span><b>${s.traits.map((t) => TRAIT_LABEL[t] ?? t).join(', ') || '—'}</b></div>
            <div class="m-kv"><span>Weakness</span><b>${TRAIT_LABEL[s.weakness] ?? s.weakness}</b></div>
            <div class="m-kv"><span>Backstory</span><b>${back.name}</b></div>
            <div class="m-kv"><span>Gang lean</span><b>${GANG_NAMES[s.gangLean] ?? s.gangLean}</b></div>
            <div class="m-kv"><span>Difficulty</span><b>${dd.name}</b></div>
            <div class="m-kv"><span>Start</span><b>$${Math.round(back.money * dd.moneyMul)} · respect ${8 + back.respect}${back.item ? ` · ${back.item}` : ''}</b></div>
            <div class="m-kv"><span>First objectives</span><b>${objs}</b></div>
          </div>`;
      }
    }
  }
  private setupCard(): string {
    const titles = ['Identity', 'Appearance', 'Traits & Backstory', 'Start Conditions', 'Review'];
    const dots = titles.map((_, i) => `<span class="su-dotn ${i === this.step ? 'on' : ''}"></span>`).join('');
    const last = this.step === 4;
    return `<div class="m-overlay"><div class="m-card">
      <div class="m-head"><b>New Run — ${titles[this.step]}</b><button class="m-x" data-m="setup-nav" data-dir="cancel">✕</button></div>
      <div class="su-dots">${dots}</div>
      <div class="m-content">${this.setupStep()}</div>
      <div class="su-foot">
        <button class="m-tab act" data-m="setup-nav" data-dir="back" ${this.step === 0 ? 'disabled' : ''}>‹ Back</button>
        <button class="m-tab act" data-m="setup-nav" data-dir="randomize">🎲 Randomize</button>
        ${last ? `<button class="m-btn primary su-begin" data-m="setup-nav" data-dir="begin">Begin Run ▶</button>` : `<button class="m-btn primary su-begin" data-m="setup-nav" data-dir="next">Next ›</button>`}
      </div>
    </div></div>`;
  }
  private esc(t: string) { return (t || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c)); }

  private tradeCard(): string {
    const t = this.hooks.tradeData(this.tradeSeller);
    if (!t) return '';
    if (t.refuses) return `<div class="m-overlay"><div class="m-card narrow"><div class="m-head"><b>${t.name}</b><button class="m-x" data-m="closetrade">✕</button></div><div class="m-body col"><div class="m-warn">${t.name} (${t.gang || 'no crew'}) won't deal with you.</div></div></div></div>`;
    const tag = t.crew ? '<span class="m-pill">crew price</span>' : t.rival ? '<span class="m-pill" style="background:#c0392b">rival markup</span>' : '';
    const buy = t.items.length ? t.items.map((it: any) => `<div class="m-item ${it.contraband ? 'contra' : ''}">
      <span class="m-item-n">${it.icon} ${it.name}${it.contraband ? ' ⚠' : ''}<br><span class="m-item-s">${it.reason}${it.risk ? ` · risk ${it.risk}%` : ''}</span></span>
      <button class="su-card on" data-m="buy" data-id="${it.id}">Buy $${it.price}</button></div>`).join('') : '<div class="m-note">They have nothing to sell.</div>';
    const sell = t.sellable.length ? t.sellable.map((it: any) => `<div class="m-item">
      <span class="m-item-n">${it.icon} ${it.name}</span><button class="su-card" data-m="sell" data-id="${it.id}">Sell $${it.price}</button></div>`).join('') : '<div class="m-note">Nothing of yours to sell.</div>';
    return `<div class="m-overlay"><div class="m-card">
      <div class="m-head"><b>Trade — ${t.name} ${tag}</b><button class="m-x" data-m="closetrade">✕</button></div>
      <div class="m-body col">
        <div class="m-sub">${t.gang ? t.gang + ' · ' : ''}${t.relation} · your money: <b>$${t.money}</b></div>
        <div class="m-label2">Buy from ${t.name}</div>${buy}
        <div class="m-label2">Sell to ${t.name}</div>${sell}
      </div></div></div>`;
  }

  private summaryCard(d: any): string {
    if (!d) return '';
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    return `<div class="m-overlay"><div class="m-card narrow">
      <div class="m-head"><b>End of Day ${d.day}</b><span class="m-pill">${d.rating}</span></div>
      <div class="m-body col">
        <div class="m-kv"><span>Reputation</span><b>${sign(d.repChange)}</b></div>
        <div class="m-kv"><span>Respect</span><b>${sign(d.respChange)}</b></div>
        <div class="m-kv"><span>Money</span><b>${sign(d.moneyChange)}</b></div>
        <div class="m-kv"><span>Bought / sold</span><b>${d.bought ?? 0} / ${d.sold ?? 0}</b></div>
        <div class="m-kv"><span>Job earnings</span><b>$${d.jobEarnings ?? 0}</b></div>
        ${d.confiscated ? `<div class="m-kv"><span>Confiscated</span><b>${d.confiscated}</b></div>` : ''}
        ${d.gang ? `<div class="m-kv"><span>Crew</span><b>${d.gang} (${d.rank})</b></div>` : ''}
        <div class="m-kv"><span>Objectives done</span><b>${d.objectivesDone}</b></div>
        <div class="m-kv"><span>Fights (won)</span><b>${d.fights} (${d.wins})</b></div>
        <div class="m-kv"><span>Jobs</span><b>${d.jobs}</b></div>
        <div class="m-kv"><span>Searches</span><b>${d.searches}</b></div>
        <div class="m-kv"><span>Solitary</span><b>${d.solitary}</b></div>
        <div class="m-kv"><span>Lockdowns</span><b>${d.lockdowns}</b></div>
        <div class="m-hr"></div>
        <div class="m-kv"><span>Standing</span><b>${d.tier}</b></div>
        <div class="m-kv"><span>Days survived</span><b>${d.daysSurvived}</b></div>
        <button class="m-btn primary" data-m="dismiss">Start Day ${d.day + 1}</button>
      </div>
    </div></div>`;
  }

  // run-end verdict card: release (win), escape (alt win), or death (loss)
  private endingCard(d: any): string {
    if (!d) return '';
    const cls = d.kind === 'dead' ? 'end-dead' : d.kind === 'escaped' ? 'end-escape' : 'end-win';
    const lead = (d.lines && d.lines[0]) || '';
    const rows = (d.lines || []).slice(1).map((l: string) => `<div class="m-note" style="padding:3px 0">${l}</div>`).join('');
    return `<div class="m-overlay"><div class="m-card narrow ${cls}">
      <div class="m-head"><b>${d.title}</b></div>
      <div class="m-body col">
        <div class="m-sub" style="margin:4px 0 10px">${lead}</div>
        ${rows}
        <div class="m-hr"></div>
        <button class="m-btn primary" data-m="newgame">▶ New Game</button>
        <button class="m-btn" data-m="mainmenu">Main Menu</button>
      </div>
    </div></div>`;
  }
}
