import { GameState, relLevel, clamp } from '../game/GameState';
import { ScheduleSystem } from '../systems/ScheduleSystem';
import { FACTIONS, PLAYABLE_FACTIONS } from '../data/factions';
import { ROOMS, ROOM_MAP } from '../data/rooms';
import { NPCS } from '../data/npcs';
import type { GameSettings } from '../game/types';

export interface MenuHooks {
  onNewGame: () => void;
  onContinue: () => void;
  onResume: () => void;
  onSave: () => void;
  onQuitToMenu: () => void;
  onSettingsChange: (s: GameSettings) => void;
  hasSave: () => boolean;
  playerPos: () => { x: number; z: number };
  targetRoom: () => string;
  version: string;
}

export class Menus {
  private overlay: HTMLDivElement;
  visible = false;
  pausedScreen = false;

  constructor(private state: GameState, private schedule: ScheduleSystem, private hooks: MenuHooks) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'menu';
    this.overlay.style.display = 'none';
    document.getElementById('ui-root')!.appendChild(this.overlay);
  }

  hide() { this.overlay.style.display = 'none'; this.visible = false; this.pausedScreen = false; }
  private wrap(inner: string) { this.overlay.style.display = 'flex'; this.visible = true; this.overlay.innerHTML = inner; }

  // ---------- Main menu ----------
  mainMenu() {
    this.pausedScreen = false;
    const has = this.hooks.hasSave();
    this.wrap(`
      <div class="menu-bg"></div>
      <div class="menu-panel main-menu">
        <h1 class="game-title">LOCKDOWN<span>LIFE 3D</span></h1>
        <p class="tagline">Survive the yard. Run the block. Earn your freedom.</p>
        <div class="menu-btns">
          <button id="m-new" class="menu-big">▶ New Game</button>
          <button id="m-cont" class="menu-big" ${has ? '' : 'disabled'}>⏵ Continue</button>
          <button id="m-controls" class="menu-big">🎮 Controls</button>
          <button id="m-settings" class="menu-big">⚙ Settings</button>
          <button id="m-credits" class="menu-big">ℹ Credits</button>
        </div>
        <div class="version">v${this.hooks.version}</div>
      </div>`);
    this.bind('#m-new', () => this.hooks.onNewGame());
    this.bind('#m-cont', () => { if (has) this.hooks.onContinue(); });
    this.bind('#m-controls', () => this.controls(true));
    this.bind('#m-settings', () => this.settings(true));
    this.bind('#m-credits', () => this.credits());
  }

  // ---------- Pause ----------
  pause() {
    this.pausedScreen = true;
    this.wrap(`
      <div class="menu-panel">
        <h2>⏸ Paused</h2>
        <div class="menu-btns">
          <button id="p-resume" class="menu-big">▶ Resume</button>
          <button id="p-stats" class="menu-big">📊 Stats</button>
          <button id="p-factions" class="menu-big">⚔️ Factions</button>
          <button id="p-rel" class="menu-big">👥 Relationships</button>
          <button id="p-map" class="menu-big">🗺️ Map</button>
          <button id="p-save" class="menu-big">💾 Save Game</button>
          <button id="p-controls" class="menu-big">🎮 Controls</button>
          <button id="p-settings" class="menu-big">⚙ Settings</button>
          <button id="p-quit" class="menu-big danger">⏏ Quit to Menu</button>
        </div>
      </div>`);
    this.bind('#p-resume', () => this.hooks.onResume());
    this.bind('#p-stats', () => this.stats());
    this.bind('#p-factions', () => this.factions());
    this.bind('#p-rel', () => this.relationships());
    this.bind('#p-map', () => this.map());
    this.bind('#p-save', () => { this.hooks.onSave(); });
    this.bind('#p-controls', () => this.controls(false));
    this.bind('#p-settings', () => this.settings(false));
    this.bind('#p-quit', () => this.hooks.onQuitToMenu());
  }

  private backBtn() {
    return `<button id="back" class="menu-big">⬅ Back</button>`;
  }
  private goBack() { this.pausedScreen ? this.pause() : this.mainMenu(); }

  // ---------- Stats ----------
  stats() {
    const s = this.state.stats;
    const row = (l: string, v: number | string) => `<div class="stat-row"><span>${l}</span><b>${v}</b></div>`;
    this.wrap(`<div class="menu-panel scroll">
      <h2>📊 ${this.state.playerName}</h2>
      <div class="tagline">Convicted of ${this.state.crime} · ${this.state.sentenceDays} days remaining</div>
      <div class="stat-grid">
        ${row('Health', Math.round(s.health) + '/' + s.maxHealth)}
        ${row('Stamina', Math.round(s.stamina) + '/' + s.maxStamina)}
        ${row('Hunger', Math.round(s.hunger))}
        ${row('Mood', Math.round(s.mood))}
        ${row('Strength', s.strength)}
        ${row('Agility', s.agility)}
        ${row('Toughness', s.toughness)}
        ${row('Intelligence', s.intelligence)}
        ${row('Reputation', Math.round(s.reputation))}
        ${row('Respect', Math.round(s.respect))}
        ${row('Fear factor', Math.round(s.fear))}
        ${row('Gang influence', Math.round(s.influence))}
        ${row('Heat / Suspicion', Math.round(s.heat))}
        ${row('Injury', Math.round(s.injury))}
        ${row('Money', '$' + s.money)}
        ${row('Body count', this.state.bodyCount)}
        ${row('Sentence', this.state.sentenceDays + ' days')}
      </div>
      ${this.backBtn()}</div>`);
    this.bind('#back', () => this.goBack());
  }

  // ---------- Factions ----------
  factions() {
    let rows = '';
    for (const id of PLAYABLE_FACTIONS) {
      const f = FACTIONS[id];
      const rep = Math.round(this.state.factionRep[id] ?? 0);
      const standing = rep <= -40 ? 'Hostile' : rep < -10 ? 'Unfriendly' : rep < 20 ? 'Neutral' : rep < 60 ? 'Friendly' : 'Allied';
      const joined = this.state.playerFaction === id ? ' <span class="joined">★ MEMBER</span>' : '';
      rows += `<div class="faction-row" style="border-left:6px solid ${f.cssColor}">
        <div class="faction-top"><b style="color:${f.cssColor}">${f.name}</b>${joined} <span class="faction-standing">${standing} (${rep})</span></div>
        <div class="faction-desc">${f.description}</div>
        <div class="faction-meta">Values: ${f.values} · Territory: ${f.territory.map((t) => ROOM_MAP[t]?.name ?? t).join(', ') || 'None'} · Behavior: ${f.behavior}</div>
      </div>`;
    }
    this.wrap(`<div class="menu-panel scroll"><h2>⚔️ Factions</h2>${rows}${this.backBtn()}</div>`);
    this.bind('#back', () => this.goBack());
  }

  // ---------- Relationships ----------
  relationships() {
    const list = NPCS.filter((n) => n.faction !== 'staff')
      .map((n) => ({ n, m: this.state.mem(n.id) }))
      .sort((a, b) => b.m.relationship - a.m.relationship);
    let rows = '';
    for (const { n, m } of list) {
      const f = FACTIONS[n.faction];
      const lvl = relLevel(m.relationship);
      const notes: string[] = [];
      if (m.attacked) notes.push('you fought');
      if (m.helped) notes.push('you helped');
      if (m.traded) notes.push('traded');
      if (m.robbed) notes.push('robbed');
      if (m.insulted) notes.push('insulted');
      if (m.bribed) notes.push('bribed');
      const threat = n.base.aggression > 0.7 ? '🔴 High' : n.base.aggression > 0.4 ? '🟡 Med' : '🟢 Low';
      rows += `<div class="rel-row">
        <div><b>${n.name}</b> <span style="color:${f.cssColor}">${f.name}</span> · ${n.role}</div>
        <div class="rel-line"><span class="rel-${lvl}">${lvl}</span> (${Math.round(m.relationship)}) · Threat ${threat} ${notes.length ? '· ' + notes.join(', ') : ''}</div>
      </div>`;
    }
    this.wrap(`<div class="menu-panel scroll"><h2>👥 Relationships</h2>${rows}${this.backBtn()}</div>`);
    this.bind('#back', () => this.goBack());
  }

  // ---------- Map ----------
  map() {
    const W = 360, H = 170;
    const sx = W / 130, sz = H / 56;
    const tx = (x: number) => (x + 65) * sx;
    const tz = (z: number) => (z + 28) * sz;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="map-svg">`;
    for (const r of ROOMS) {
      if (r.id === 'hallway') continue;
      const fill = '#' + r.floor.toString(16).padStart(6, '0');
      const target = this.hooks.targetRoom() === r.id;
      svg += `<rect x="${tx(r.x - r.w / 2)}" y="${tz(r.z - r.d / 2)}" width="${r.w * sx}" height="${r.d * sz}"
        fill="${fill}" stroke="${target ? '#ffe066' : r.restricted ? '#e74c3c' : '#222'}" stroke-width="${target ? 2 : 1}" opacity="0.9"/>`;
      svg += `<text x="${tx(r.x)}" y="${tz(r.z)}" font-size="5" fill="#fff" text-anchor="middle">${r.name}</text>`;
      if (r.faction && FACTIONS[r.faction]) {
        svg += `<circle cx="${tx(r.x - r.w / 2) + 5}" cy="${tz(r.z - r.d / 2) + 5}" r="3" fill="${FACTIONS[r.faction].cssColor}"/>`;
      }
    }
    const p = this.hooks.playerPos();
    svg += `<circle cx="${tx(p.x)}" cy="${tz(p.z)}" r="4" fill="#55ff77" stroke="#000"/>`;
    svg += `</svg>`;
    this.wrap(`<div class="menu-panel"><h2>🗺️ Prison Map</h2>${svg}
      <div class="map-legend"><span style="color:#55ff77">● You</span> <span style="color:#ffe066">▢ Schedule target</span> <span style="color:#e74c3c">▢ Restricted</span></div>
      ${this.backBtn()}</div>`);
    this.bind('#back', () => this.goBack());
  }

  // ---------- Controls ----------
  controls(fromMain: boolean) {
    this.wrap(`<div class="menu-panel scroll"><h2>🎮 Controls</h2>
      <div class="controls-grid">
        <div><b>Desktop</b><ul>
          <li>WASD / Arrows — Move</li><li>Shift — Sprint</li>
          <li>E / Space — Interact / Grab object</li><li>F / Left-click — Attack</li>
          <li>R / Right-click — Block</li><li>Q — Shove · G — Throw</li>
          <li>Tab / I — Inventory</li><li>M — Map</li>
          <li>P / Esc — Pause</li><li>+/- — Zoom</li>
        </ul></div>
        <div><b>Mobile</b><ul>
          <li>Left joystick — Move</li><li>👊 Attack · 🛡️ Block · ✋ Interact</li>
          <li>🏃 Sprint · 💬 Talk · 🎒 Inventory</li>
          <li>Pinch / HUD buttons — menus & zoom</li>
          <li>Best played in landscape</li>
        </ul></div>
      </div>${this.backBtn()}</div>`);
    this.bind('#back', () => fromMain ? this.mainMenu() : this.goBack());
  }

  credits() {
    this.wrap(`<div class="menu-panel"><h2>ℹ Credits</h2>
      <p>Lockdown Life 3D</p>
      <p>A system-driven 3D isometric prison sandbox.</p>
      <p>Built with Three.js + TypeScript + Vite.</p>
      <p>All art is procedurally generated low-poly geometry.</p>
      <p class="version">v${this.hooks.version}</p>
      ${this.backBtn()}</div>`);
    this.bind('#back', () => this.mainMenu());
  }

  // ---------- Settings ----------
  settings(fromMain: boolean) {
    const s = this.state.settings;
    this.wrap(`<div class="menu-panel scroll"><h2>⚙ Settings</h2>
      <div class="settings-grid">
        <label class="set-row"><span>Master Audio</span><input type="checkbox" id="set-master" ${s.master ? 'checked' : ''}></label>
        <label class="set-row"><span>SFX Volume</span><input type="range" id="set-vol" min="0" max="1" step="0.05" value="${s.sfxVolume}"></label>
        <label class="set-row"><span>Camera Shake</span><input type="checkbox" id="set-shake" ${s.cameraShake ? 'checked' : ''}></label>
        <label class="set-row"><span>Mobile Control Opacity</span><input type="range" id="set-op" min="0.2" max="1" step="0.05" value="${s.controlOpacity}"></label>
        <label class="set-row"><span>Graphics Quality</span>
          <select id="set-q"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>High</option><option value="simple" ${s.quality === 'simple' ? 'selected' : ''}>Simple</option></select></label>
      </div>${this.backBtn()}</div>`);
    const apply = () => {
      s.master = (this.overlay.querySelector('#set-master') as HTMLInputElement).checked;
      s.sfxVolume = parseFloat((this.overlay.querySelector('#set-vol') as HTMLInputElement).value);
      s.cameraShake = (this.overlay.querySelector('#set-shake') as HTMLInputElement).checked;
      s.controlOpacity = parseFloat((this.overlay.querySelector('#set-op') as HTMLInputElement).value);
      s.quality = (this.overlay.querySelector('#set-q') as HTMLSelectElement).value as any;
      this.hooks.onSettingsChange(s);
    };
    this.overlay.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', apply));
    this.bind('#back', () => fromMain ? this.mainMenu() : this.goBack());
  }

  // ---------- Intake cutscene ----------
  intro(data: { name: string; crime: string; days: number; minutesPerDay: number; sentenceText: string; seed: number; world: string; worldDesc: string }, cb: () => void) {
    this.pausedScreen = false;
    this.wrap(`
      <div class="menu-bg"></div>
      <div class="menu-panel intake">
        <div class="intake-siren">🚨 INTAKE — PROCESSING 🚨</div>
        <div class="intake-stamp">STATE CORRECTIONAL FACILITY</div>
        <div class="intake-rows">
          <div class="intake-line"><span>INMATE</span><b id="t-name"></b></div>
          <div class="intake-line"><span>CONVICTED OF</span><b id="t-crime" class="crime"></b></div>
          <div class="intake-line"><span>SENTENCE</span><b id="t-sentence"></b></div>
          <div class="intake-line"><span>BLOCK STATE</span><b style="color:#e0a030">${data.world}</b></div>
        </div>
        <div class="intake-note"><i>${data.worldDesc}</i></div>
        <div class="intake-note">
          Survive each day, keep your nose clean, and you walk out a free inmate.
          Cause trouble and you'll do harder time. <br/>
          <i>Each day is ~<b>${data.minutesPerDay} min</b> of active play (clock pauses in menus/jobs).</i>
        </div>
        <div class="seed-row">SEED <code id="seed-val">${data.seed}</code> <button id="seed-copy" class="seed-btn">📋 Copy</button></div>
        <button id="intake-go" class="menu-big" disabled>Processing…</button>
      </div>`);
    const nameEl = this.overlay.querySelector('#t-name') as HTMLElement;
    const crimeEl = this.overlay.querySelector('#t-crime') as HTMLElement;
    const sentEl = this.overlay.querySelector('#t-sentence') as HTMLElement;
    const go = this.overlay.querySelector('#intake-go') as HTMLButtonElement;
    const copyBtn = this.overlay.querySelector('#seed-copy') as HTMLElement;
    if (copyBtn) copyBtn.onclick = () => { try { navigator.clipboard?.writeText(String(data.seed)); copyBtn.textContent = '✓ Copied'; } catch {} };
    // simple typewriter reveal sequence
    const steps: [HTMLElement, string][] = [
      [nameEl, data.name],
      [crimeEl, data.crime],
      [sentEl, data.sentenceText]
    ];
    let si = 0;
    const typeNext = () => {
      if (si >= steps.length) {
        go.disabled = false;
        go.textContent = `▶ Begin Your ${data.days}-Day Sentence`;
        return;
      }
      const [el, text] = steps[si++];
      let ci = 0;
      const iv = setInterval(() => {
        el.textContent = text.slice(0, ++ci);
        if (ci >= text.length) { clearInterval(iv); setTimeout(typeNext, 300); }
      }, 28);
    };
    setTimeout(typeNext, 400);
    go.onclick = () => { if (!go.disabled) { this.hide(); cb(); } };
  }

  // ---------- Character creation ----------
  creator(cb: (o: { name: string; height: number; skin: number; hair: number; hairStyle: any; uniform: number; backstory: string }) => void) {
    this.pausedScreen = false;
    const skins = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x6b4423];
    const hairs = [0x2b1d0e, 0x000000, 0x5a3a1a, 0x888888, 0xd9b382, 0xb33a2a];
    const suits = [0xd86a2c, 0xb8a85a, 0x7f8a93, 0x35506e, 0xe2e2e2, 0x3a6b3a];
    const styles = ['short', 'bald', 'mohawk', 'cap', 'beanie', 'long'];
    const builds = [{ n: 'Slim', h: 0.9 }, { n: 'Average', h: 1.0 }, { n: 'Heavy', h: 1.12 }];
    const backstories = [
      { id: 'bruiser', n: 'Bruiser', d: '+2 Strength, +1 Toughness. Born to brawl.' },
      { id: 'schemer', n: 'Schemer', d: '+3 Intelligence. Outsmart the system.' },
      { id: 'survivor', n: 'Survivor', d: '+2 Agility, +1 Toughness. Slippery and tough.' }
    ];
    const sel = { name: this.state.playerName === 'Inmate' ? '' : this.state.playerName, build: 1, skin: 2, hair: 0, style: 0, suit: 0, backstory: 'bruiser' };
    const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
    const NICKS = ['Spike', 'Diesel', 'Razor', 'Tank', 'Snake', 'Ace', 'Bishop', 'Cyrus', 'Mako', 'Vega', 'Knox', 'Rook', 'Slim', 'Tex', 'Grim', 'Blaze'];
    const ri = (n: number) => Math.floor(Math.random() * n);
    const randomize = () => {
      sel.name = NICKS[ri(NICKS.length)];
      sel.build = ri(builds.length);
      sel.skin = ri(skins.length);
      sel.hair = ri(hairs.length);
      sel.style = ri(styles.length);
      sel.suit = ri(suits.length);
      sel.backstory = backstories[ri(backstories.length)].id;
      render();
    };

    const render = () => {
      const sw = (arr: number[], key: 'skin' | 'hair' | 'suit') =>
        arr.map((c, i) => `<button class="swatch ${sel[key] === i ? 'on' : ''}" data-k="${key}" data-i="${i}" style="background:${hex(c)}"></button>`).join('');
      this.wrap(`<div class="menu-bg"></div><div class="menu-panel scroll creator">
        <h2>🧍 Create Your Inmate</h2>
        <button id="cc-rand" class="cc-rand">🎲 Randomize Everything</button>
        <label class="cc-row"><span>Name</span><input id="cc-name" type="text" maxlength="16" placeholder="e.g. Spike" value="${sel.name}"></label>
        <div class="cc-row"><span>Build</span><div class="cc-opts">${builds.map((b, i) => `<button class="cc-opt ${sel.build === i ? 'on' : ''}" data-k="build" data-i="${i}">${b.n}</button>`).join('')}</div></div>
        <div class="cc-row"><span>Skin</span><div class="cc-swatches">${sw(skins, 'skin')}</div></div>
        <div class="cc-row"><span>Hair style</span><div class="cc-opts">${styles.map((s, i) => `<button class="cc-opt ${sel.style === i ? 'on' : ''}" data-k="style" data-i="${i}">${s}</button>`).join('')}</div></div>
        <div class="cc-row"><span>Hair color</span><div class="cc-swatches">${sw(hairs, 'hair')}</div></div>
        <div class="cc-row"><span>Jumpsuit</span><div class="cc-swatches">${sw(suits, 'suit')}</div></div>
        <div class="cc-row col"><span>Backstory</span><div class="cc-stories">${backstories.map((b) => `<button class="cc-story ${sel.backstory === b.id ? 'on' : ''}" data-story="${b.id}"><b>${b.n}</b><i>${b.d}</i></button>`).join('')}</div></div>
        <button id="cc-go" class="menu-big">▶ Enter the Prison</button>
      </div>`);

      const nameEl = this.overlay.querySelector('#cc-name') as HTMLInputElement;
      nameEl.oninput = () => { sel.name = nameEl.value; };
      (this.overlay.querySelector('#cc-rand') as HTMLElement).onclick = () => randomize();
      this.overlay.querySelectorAll('[data-k]').forEach((b) => {
        (b as HTMLElement).onclick = () => {
          const k = (b as HTMLElement).dataset.k as any;
          const i = parseInt((b as HTMLElement).dataset.i!);
          (sel as any)[k] = i;
          sel.name = nameEl.value;
          render();
        };
      });
      this.overlay.querySelectorAll('[data-story]').forEach((b) => {
        (b as HTMLElement).onclick = () => { sel.backstory = (b as HTMLElement).dataset.story!; sel.name = nameEl.value; render(); };
      });
      (this.overlay.querySelector('#cc-go') as HTMLElement).onclick = () => {
        const nm = (sel.name || '').trim() || 'Spike';
        this.hide();
        cb({ name: nm, height: builds[sel.build].h, skin: skins[sel.skin], hair: hairs[sel.hair], hairStyle: styles[sel.style], uniform: suits[sel.suit], backstory: sel.backstory });
      };
    };
    render();
  }

  // ---------- Day summary ----------
  daySummary(earned: { money: number; rep: number; daysAdded: number; daysCut: number }, cb: () => void) {
    const s = this.state.stats;
    const timeLine = earned.daysAdded || earned.daysCut
      ? `<div class="stat-row"><span>Time adjustment</span><b>${earned.daysCut ? `<span style="color:#66ff88">-${earned.daysCut}</span>` : ''}${earned.daysAdded ? ` <span style="color:#ff6655">+${earned.daysAdded}</span>` : ''} days</b></div>`
      : `<div class="stat-row"><span>Behavior</span><b>No change</b></div>`;
    const run = this.state.run;
    const biggest = run.bestEventToday || 'A quiet day — nothing made the headlines.';
    this.wrap(`<div class="menu-panel scroll"><h2>🌅 Day ${this.state.day - 1} Complete</h2>
      <div class="summary">
        <p class="diary">📰 "${biggest}"</p>
        ${timeLine}
        <div class="stat-row"><span>Money earned</span><b>$${earned.money}</b></div>
        <div class="stat-row"><span>Reputation</span><b>${Math.round(s.reputation)}</b></div>
        <div class="stat-row"><span>Respect</span><b>${Math.round(s.respect)}</b></div>
        <div class="stat-row"><span>Heat</span><b>${Math.round(s.heat)}</b></div>
        <div class="stat-row"><span>Body count</span><b>${this.state.bodyCount}</b></div>
        <div class="stat-row"><span>Sentence remaining</span><b>${this.state.sentenceDays} days</b></div>
      </div>
      <div class="diary-block">
        <div class="diary-row"><span>🏴 Block state</span><b>${run.worldStateName}</b></div>
        <div class="diary-row"><span>📋 Tomorrow</span><b>${run.dailyModifier.name}</b> — ${run.dailyModifier.desc}</div>
        <div class="diary-row"><span>🗣️ Rumor</span><i>${run.tomorrowRumor}</i></div>
      </div>
      <div class="seed-row">SEED <code>${run.seed}</code></div>
      <button id="sum-next" class="menu-big">▶ Begin Day ${this.state.day}</button></div>`);
    this.bind('#sum-next', () => { this.hide(); cb(); });
  }

  // ---------- Game over / ending ----------
  ending(title: string, body: string, cb: () => void) {
    this.wrap(`<div class="menu-panel"><h2>${title}</h2>
      <p class="ending-body">${body}</p>
      <button id="end-btn" class="menu-big">▶ Main Menu</button></div>`);
    this.bind('#end-btn', () => { this.hide(); cb(); });
  }

  private bind(sel: string, fn: () => void) {
    const el = this.overlay.querySelector(sel) as HTMLElement | null;
    if (el) el.onclick = fn;
  }
}
