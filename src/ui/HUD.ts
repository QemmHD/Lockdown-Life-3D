// DOM/overlay UI (lightweight; React + Zustand can replace this later without touching sim).
export interface PanelInfo {
  name: string; role: string; gang?: string; state: string; traits: string[];
  needs: { label: string; value: number; color: string }[];
}

export interface HUDHooks {
  onPause: () => void; onSpeed: () => void; onSave: () => void; onLoad: () => void; onDeselect: () => void; hasSave: () => boolean;
}

export class HUD {
  private root: HTMLDivElement;
  private els: Record<string, HTMLElement> = {};

  constructor(hooks: HUDHooks) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="topbar">
        <div class="tb-block"><div class="tb-big" id="tb-phase">Wake-Up</div><div class="tb-sub"><span id="tb-day">Day 1</span> · <span id="tb-time">6:00</span></div></div>
        <div class="tb-block right">
          <div class="tb-chip">Heat <b id="tb-heat">0</b></div>
          <div class="tb-chip">Riot <b id="tb-riot">0%</b></div>
        </div>
      </div>
      <div id="alert-feed"></div>
      <div id="panel" class="hidden"></div>
      <div id="bottombar">
        <button data-b="pause" class="hud-btn">⏸</button>
        <button data-b="speed" class="hud-btn"><span id="speed-x">1×</span></button>
        <button data-b="save" class="hud-btn">💾</button>
        <button data-b="load" class="hud-btn">📂</button>
      </div>`;
    document.getElementById('ui-root')!.appendChild(this.root);
    ['tb-phase', 'tb-day', 'tb-time', 'tb-heat', 'tb-riot', 'alert-feed', 'panel', 'speed-x'].forEach((id) => this.els[id] = this.root.querySelector('#' + id) as HTMLElement);
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
  }
  setSpeed(label: string) { this.els['speed-x'].textContent = label; }

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
    const bars = info.needs.map((n) => `<div class="need"><span>${n.label}</span><div class="need-bg"><div class="need-fill" style="width:${Math.round(n.value * 100)}%;background:${n.color}"></div></div></div>`).join('');
    p.innerHTML = `
      <div class="panel-head"><b>${info.name}</b><button id="panel-x">✕</button></div>
      <div class="panel-sub">${info.role}${info.gang ? ' · ' + info.gang : ''} · <span class="state">${info.state}</span></div>
      <div class="panel-traits">${info.traits.map((t) => `<span class="trait">${t}</span>`).join('')}</div>
      <div class="needs">${bars}</div>`;
    (p.querySelector('#panel-x') as HTMLElement).onclick = () => this.hooks.onDeselect();
  }
}
