// DOM/overlay UI (lightweight; React + Zustand can replace this later without touching sim).
export interface PanelAction { key: string; label: string; danger?: boolean; }
export interface PanelItem { icon: string; name: string; contraband: boolean; key: string; }
export interface PanelInfo {
  name: string; role: string; player: boolean; gang?: string; gangColor?: string;
  state: string; room: string; traits: string[];
  meta: string[];                  // chips: Rep 5 · Respect 8 · …
  needs: { label: string; value: number; color: string }[];
  items: PanelItem[];
  actions: PanelAction[];
}

export interface HUDHooks {
  onPause: () => void; onSpeed: () => void; onSave: () => void; onLoad: () => void; onDeselect: () => void; hasSave: () => boolean;
  onAction: (key: string) => void;       // interaction / self-action / job button
  onItem: (key: string) => void;         // tap an inventory item (drop)
}

export class HUD {
  private root: HTMLDivElement;
  private els: Record<string, HTMLElement> = {};

  constructor(hooks: HUDHooks) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="alarm"></div>
      <div id="topbar">
        <div class="tb-block">
          <div class="tb-label">SCHEDULE</div>
          <div class="tb-big" id="tb-phase">Wake-Up</div>
          <div class="tb-sub"><span id="tb-day">Day 1</span> · <span id="tb-time">6:00</span></div>
        </div>
        <div class="tb-block right">
          <div class="tb-chip" id="chip-heat"><span>HEAT</span><b id="tb-heat">0</b></div>
          <div class="tb-chip" id="chip-riot"><span>RIOT</span><b id="tb-riot">0%</b></div>
        </div>
      </div>
      <div id="alert-feed"></div>
      <div id="panel" class="hidden"></div>
      <div id="bottombar">
        <button data-b="pause" class="hud-btn"><span class="b-ico">⏸</span><span class="b-lbl">Pause</span></button>
        <button data-b="speed" class="hud-btn"><span class="b-ico" id="speed-x">1×</span><span class="b-lbl">Speed</span></button>
        <button data-b="save" class="hud-btn"><span class="b-ico">▣</span><span class="b-lbl">Save</span></button>
        <button data-b="load" class="hud-btn"><span class="b-ico">▤</span><span class="b-lbl">Load</span></button>
      </div>`;
    document.getElementById('ui-root')!.appendChild(this.root);
    ['tb-phase', 'tb-day', 'tb-time', 'tb-heat', 'tb-riot', 'chip-riot', 'chip-heat', 'alert-feed', 'panel', 'speed-x', 'alarm'].forEach((id) => this.els[id] = this.root.querySelector('#' + id) as HTMLElement);
    this.root.querySelectorAll('#bottombar button').forEach((b) => {
      const k = (b as HTMLElement).dataset.b!;
      b.addEventListener('click', () => {
        if (k === 'pause') hooks.onPause(); else if (k === 'speed') hooks.onSpeed();
        else if (k === 'save') hooks.onSave(); else if (k === 'load') hooks.onLoad();
      });
    });
    this.hooks = hooks;
  }
  private hooks!: HUDHooks;

  setTop(day: number, hour: number, phase: string, heat = 0, riot = 0) {
    this.els['tb-phase'].textContent = phase;
    this.els['tb-day'].textContent = 'Day ' + day;
    const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM'; let hh = h % 12; if (hh === 0) hh = 12;
    this.els['tb-time'].textContent = `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
    this.els['tb-heat'].textContent = String(Math.round(heat));
    this.els['tb-riot'].textContent = Math.round(riot * 100) + '%';
    this.els['chip-riot'].className = 'tb-chip ' + (riot > 0.66 ? 'sev-high' : riot > 0.33 ? 'sev-mid' : '');
    this.els['chip-heat'].className = 'tb-chip ' + (heat > 66 ? 'sev-high' : heat > 33 ? 'sev-mid' : '');
  }
  setSpeed(label: string) { this.els['speed-x'].textContent = label; }
  setAlarm(level: number) { this.els['alarm'].style.opacity = level > 0.7 ? String((level - 0.7) * 2) : '0'; }

  alert(text: string, type = 'info') {
    const feed = this.els['alert-feed'];
    const el = document.createElement('div');
    el.className = 'alert alert-' + type;
    el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 5) feed.lastChild && feed.removeChild(feed.lastChild);
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, 5000);
  }

  showPanel(info: PanelInfo | null) {
    const p = this.els['panel'];
    if (!info) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.classList.toggle('is-player', info.player);
    const bars = info.needs.map((n) => `<div class="need"><span>${n.label}</span><div class="need-bg"><div class="need-fill" style="width:${Math.round(n.value * 100)}%;background:${n.color}"></div></div></div>`).join('');
    const chips = info.meta.map((m) => `<span class="chip">${m}</span>`).join('');
    const gangTag = info.gang ? `<span class="gangtag" style="color:${info.gangColor || '#bbb'}">●</span> ${info.gang}` : 'Unaffiliated';
    const items = info.items.length
      ? info.items.map((it) => `<button class="inv-item ${it.contraband ? 'contra' : ''}" data-item="${it.key}" title="tap to drop">${it.icon} ${it.name}${it.contraband ? ' ⚠' : ''}</button>`).join('')
      : '<span class="inv-empty">empty</span>';
    const acts = info.actions.map((a) => `<button class="act ${a.danger ? 'danger' : ''}" data-act="${a.key}">${a.label}</button>`).join('');
    p.innerHTML = `
      <div class="panel-head"><b>${info.player ? '★ ' : ''}${info.name}</b><button id="panel-x">✕</button></div>
      <div class="panel-sub">${info.role} · <span class="gangtag-wrap">${gangTag}</span> · <span class="state">${info.state}</span></div>
      <div class="panel-room">📍 ${info.room}</div>
      <div class="panel-chips">${chips}</div>
      <div class="panel-traits">${info.traits.map((t) => `<span class="trait">${t}</span>`).join('')}</div>
      <div class="needs">${bars}</div>
      <div class="panel-label">Inventory</div>
      <div class="inv-row">${items}</div>
      <div class="panel-actions">${acts}</div>`;
    (p.querySelector('#panel-x') as HTMLElement).onclick = () => this.hooks.onDeselect();
    p.querySelectorAll('[data-act]').forEach((b) => (b as HTMLElement).onclick = () => this.hooks.onAction((b as HTMLElement).dataset.act!));
    p.querySelectorAll('[data-item]').forEach((b) => (b as HTMLElement).onclick = () => this.hooks.onItem((b as HTMLElement).dataset.item!));
  }
}
