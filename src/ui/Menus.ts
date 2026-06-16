// Title screen, pause/menu overlay (tabbed: Stats/Relationships/Inventory/Objectives/Gangs/Help),
// and the daily summary modal (Stage 3.4). Lightweight DOM/CSS — reads a sim snapshot, never writes.

export interface MenuHooks {
  onNewGame: () => void;
  onContinue: () => void;
  onQuickStart: () => void;
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onMainMenu: () => void;
  hasSave: () => boolean;
  snapshot: () => any;
  version: string;
}

type Mode = 'hidden' | 'title' | 'pause' | 'summary';

export class Menus {
  private root: HTMLDivElement;
  private mode: Mode = 'hidden';
  private tab = 'objectives';
  private summary: any = null;
  constructor(private hooks: MenuHooks) {
    this.root = document.createElement('div');
    this.root.id = 'menu-root';
    this.root.className = 'hidden';
    document.getElementById('ui-root')!.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  isOpen() { return this.mode !== 'hidden'; }
  showTitle() { this.mode = 'title'; this.render(); }
  showPause() { this.mode = 'pause'; this.render(); }
  showSummary(data: any) { this.summary = data; this.mode = 'summary'; this.render(); }
  hide() { this.mode = 'hidden'; this.root.className = 'hidden'; }

  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest('[data-m]') as HTMLElement | null;
    if (!el) return;
    const a = el.dataset.m!;
    if (a === 'tab') { this.tab = el.dataset.tab!; this.render(); return; }
    if (a === 'help-title') { document.getElementById('m-help-title')?.classList.toggle('hidden'); return; }
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

  private render() {
    if (this.mode === 'hidden') { this.hide(); return; }
    this.root.className = '';
    if (this.mode === 'title') { this.root.innerHTML = this.title(); return; }
    if (this.mode === 'summary') { this.root.innerHTML = this.summaryCard(this.summary); return; }
    this.root.innerHTML = this.pause();
  }

  private title(): string {
    const has = this.hooks.hasSave();
    return `<div class="m-title">
      <div class="m-logo">LOCKDOWN<span>LIFE 3D</span></div>
      <div class="m-tag">Do your time. Build a name. Survive the block.</div>
      <div class="m-menu">
        <button class="m-btn primary" data-m="quickstart">▶ Play</button>
        <button class="m-btn" data-m="continue" ${has ? '' : 'disabled'}>Continue</button>
        <button class="m-btn" data-m="newgame">New Game</button>
        <button class="m-btn" data-m="tab" data-tab="help" disabled style="display:none"></button>
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
      ['inventory', 'Inventory'], ['gangs', 'Gangs'], ['help', 'Help'], ['settings', 'Settings']
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
    if (!s.inventory.length) return `${warn}<div class="m-note">Your pockets are empty.</div>`;
    const rows = s.inventory.map((it: any) => `<div class="m-item ${it.contraband ? 'contra' : ''}">
      <span class="m-item-n">${it.icon} ${it.name}${it.contraband ? ' ⚠' : ''}</span>
      <span class="m-item-s">$${it.value} · risk ${Math.round(it.risk * 100)}% · hide ${Math.round(it.concealment * 100)}%${it.combat ? ` · ⚔${it.combat}` : ''}</span>
    </div>`).join('');
    return `<div class="m-h">Inventory</div>${warn}${rows}<div class="m-sub">Tap an item in the in-game panel to drop it; hide contraband in a bed/locker/shelf.</div>`;
  }
  private gangTab(s: any): string {
    const rows = s.gangs.map((g: any) => `<div class="m-gang">
      <span class="m-gang-d" style="color:#${(g.color >>> 0).toString(16).padStart(6, '0')}">●</span>
      <span class="m-gang-n">${g.name} <i>· ${g.territory}</i></span>
      <span class="m-gang-s">you: ${g.standing} · ${g.members} members</span>
    </div>`).join('');
    return `<div class="m-h">Gangs</div><div class="m-sub">Fictional crews and how they regard you. (Joining a gang is planned.)</div>${rows}`;
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
      <div><b>Fights</b><span>Strike / Heavy / Shove / Block. Guards break up brawls.</span></div>
      <div><b>Save</b><span>Save/Load any time from this menu or the bottom bar.</span></div>
    </div>`;
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
}
