import { GameState } from '../game/GameState';
import { ScheduleSystem } from '../systems/ScheduleSystem';
import { HeatSystem } from '../systems/HeatSystem';
import { ROOM_MAP } from '../data/rooms';
import { FACTIONS } from '../data/factions';

export class HUD {
  private root: HTMLDivElement;
  private els: Record<string, HTMLElement> = {};
  onButton?: (id: string) => void;

  constructor(private state: GameState, private schedule: ScheduleSystem, private heat: HeatSystem) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="hud-top">
        <div id="clock">
          <div id="phase-name">Wake-Up</div>
          <div id="time-row"><span id="day">Day 1</span> · <span id="time">6:00 AM</span></div>
          <div id="room-name">Cell Block</div>
        </div>
        <div id="hud-buttons">
          <button data-btn="inventory" title="Inventory (I)">🎒</button>
          <button data-btn="stats" title="Stats">📊</button>
          <button data-btn="factions" title="Factions">⚔️</button>
          <button data-btn="relationships" title="Relationships">👥</button>
          <button data-btn="map" title="Map (M)">🗺️</button>
          <button data-btn="pause" title="Pause (Esc)">⏸</button>
        </div>
      </div>
      <div id="hud-bars">
        ${this.bar('health', 'HEALTH', '#e74c3c')}
        ${this.bar('stamina', 'STAMINA', '#2ecc71')}
        ${this.bar('hunger', 'HUNGER', '#e67e22')}
        ${this.bar('mood', 'MOOD', '#9b59b6')}
        ${this.bar('heat', 'HEAT', '#f1c40f')}
      </div>
      <div id="hud-right">
        <div class="hud-stat">💵 <span id="money">$0</span></div>
        <div class="hud-stat">⭐ Rep <span id="rep">0</span></div>
        <div class="hud-stat">👊 Respect <span id="respect">0</span></div>
        <div class="hud-stat" id="faction-standing">Independent</div>
        <div class="hud-stat" id="sentence">14 days left</div>
      </div>
      <div id="prompt"></div>
      <div id="toast-layer"></div>
      <div id="vignette"></div>
      <div id="lockdown-overlay"></div>`;
    document.getElementById('ui-root')!.appendChild(this.root);

    ['phase-name', 'day', 'time', 'room-name', 'money', 'rep', 'respect', 'faction-standing', 'sentence', 'prompt', 'vignette', 'lockdown-overlay'].forEach((id) => {
      this.els[id] = this.root.querySelector('#' + id) as HTMLElement;
    });
    for (const k of ['health', 'stamina', 'hunger', 'mood', 'heat']) {
      this.els['bar-' + k] = this.root.querySelector('#bar-' + k) as HTMLElement;
    }
    this.root.querySelectorAll('#hud-buttons button').forEach((b) => {
      b.addEventListener('click', () => this.onButton?.((b as HTMLElement).dataset.btn!));
    });
  }

  private bar(id: string, label: string, color: string) {
    return `<div class="bar-wrap"><span class="bar-label">${label}</span>
      <div class="bar-bg"><div class="bar-fill" id="bar-${id}" style="background:${color}"></div></div></div>`;
  }

  show() { this.root.style.display = 'block'; }
  hide() { this.root.style.display = 'none'; }

  setPrompt(text: string | null) {
    this.els['prompt'].style.display = text ? 'block' : 'none';
    if (text) this.els['prompt'].innerHTML = text;
  }

  toast(msg: string, type = 'info') {
    const layer = this.root.querySelector('#toast-layer')!;
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    layer.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  notify(title: string, body: string) {
    this.toast(`${title} — ${body}`, 'event');
  }

  update() {
    const s = this.state.stats;
    this.els['phase-name'].textContent = this.schedule.phaseName();
    this.els['day'].textContent = 'Day ' + this.state.day;
    this.els['time'].textContent = this.schedule.timeString();
    const room = ROOM_MAP[this.state.currentRoom];
    this.els['room-name'].textContent = room ? room.name : '';
    if (room?.restricted) this.els['room-name'].classList.add('restricted'); else this.els['room-name'].classList.remove('restricted');

    this.setBar('health', s.health / s.maxHealth);
    this.setBar('stamina', s.stamina / s.maxStamina);
    this.setBar('hunger', s.hunger / 100);
    this.setBar('mood', s.mood / 100);
    this.setBar('heat', s.heat / 100);

    this.els['money'].textContent = '$' + s.money;
    this.els['rep'].textContent = String(Math.round(s.reputation));
    this.els['respect'].textContent = String(Math.round(s.respect));
    this.els['sentence'].textContent = this.state.sentenceDays + ' days left';

    const fs = this.els['faction-standing'];
    if (this.state.playerFaction) {
      const f = FACTIONS[this.state.playerFaction];
      fs.textContent = f.name;
      fs.style.color = f.cssColor;
    } else { fs.textContent = 'Independent'; fs.style.color = '#aaa'; }

    // vignette at low health
    const lowH = s.health / s.maxHealth;
    this.els['vignette'].style.opacity = lowH < 0.35 ? String((0.35 - lowH) * 2.5) : '0';

    // lockdown overlay
    this.els['lockdown-overlay'].style.opacity = this.state.lockdown ? '1' : '0';
  }

  private setBar(id: string, frac: number) {
    const el = this.els['bar-' + id];
    if (el) el.style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
  }
}
