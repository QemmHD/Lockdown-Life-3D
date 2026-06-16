// Touch joystick + action buttons. Camera-relative movement like the keyboard.

export class MobileControls {
  enabled = false;
  private joy = { x: 0, z: 0 };
  sprintHeld = false;
  blockHeld = false;
  private queue = new Set<string>();
  private root!: HTMLDivElement;
  private stickBase!: HTMLDivElement;
  private stickKnob!: HTMLDivElement;
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  opacity = 0.55;

  constructor() {
    this.enabled = this.isTouch();
    this.build();
    if (!this.enabled) this.root.style.display = 'none';
  }

  isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.root.style.display = v ? 'block' : 'none';
  }

  setOpacity(o: number) { this.opacity = o; this.root.style.setProperty('--ctrl-op', String(o)); }

  private build() {
    const root = document.createElement('div');
    root.id = 'mobile-controls';
    root.style.setProperty('--ctrl-op', String(this.opacity));
    root.innerHTML = `
      <div id="joystick"><div id="joy-knob"></div></div>
      <div id="action-buttons">
        <button class="act-btn big" data-act="attack">👊</button>
        <button class="act-btn big" data-act="block">🛡️</button>
        <button class="act-btn big" data-act="interact">✋</button>
        <button class="act-btn" data-act="throw">🎯</button>
        <button class="act-btn" data-act="sprint">🏃</button>
        <button class="act-btn" data-act="talk">💬</button>
        <button class="act-btn" data-act="inventory">🎒</button>
      </div>`;
    document.getElementById('ui-root')!.appendChild(root);
    this.root = root;
    this.stickBase = root.querySelector('#joystick') as HTMLDivElement;
    this.stickKnob = root.querySelector('#joy-knob') as HTMLDivElement;

    // joystick handlers
    this.stickBase.addEventListener('touchstart', (e) => this.joyStart(e), { passive: false });
    this.stickBase.addEventListener('touchmove', (e) => this.joyMove(e), { passive: false });
    this.stickBase.addEventListener('touchend', () => this.joyEnd(), { passive: false });
    this.stickBase.addEventListener('touchcancel', () => this.joyEnd(), { passive: false });

    // action buttons
    root.querySelectorAll('.act-btn').forEach((b) => {
      const act = (b as HTMLElement).dataset.act!;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (act === 'sprint') this.sprintHeld = true;
        else if (act === 'block') this.blockHeld = true;
        else this.queue.add(act);
        (b as HTMLElement).classList.add('pressed');
      }, { passive: false });
      b.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (act === 'sprint') this.sprintHeld = false;
        if (act === 'block') this.blockHeld = false;
        (b as HTMLElement).classList.remove('pressed');
      }, { passive: false });
      // mouse fallback for desktop testing
      b.addEventListener('mousedown', () => { if (act === 'sprint') this.sprintHeld = true; else if (act === 'block') this.blockHeld = true; else this.queue.add(act); });
      b.addEventListener('mouseup', () => { if (act === 'sprint') this.sprintHeld = false; if (act === 'block') this.blockHeld = false; });
    });
  }

  private joyStart(e: TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.joyId = t.identifier;
    const rect = this.stickBase.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.joyMove(e);
  }

  private joyMove(e: TouchEvent) {
    e.preventDefault();
    if (this.joyId === null) return;
    let t: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === this.joyId) t = e.touches[i];
    if (!t) return;
    let dx = t.clientX - this.joyCenter.x;
    let dy = t.clientY - this.joyCenter.y;
    const max = 50;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    // camera-relative (rotate -45deg)
    const nx = dx / max, ny = dy / max;
    const a = -Math.PI / 4, cos = Math.cos(a), sin = Math.sin(a);
    this.joy = { x: nx * cos - ny * sin, z: nx * sin + ny * cos };
  }

  private joyEnd() {
    this.joyId = null;
    this.joy = { x: 0, z: 0 };
    this.stickKnob.style.transform = 'translate(0,0)';
  }

  getMove() { return this.joy; }
  consume(act: string) { if (this.queue.has(act)) { this.queue.delete(act); return true; } return false; }
}
