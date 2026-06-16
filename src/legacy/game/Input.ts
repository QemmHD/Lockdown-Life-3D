// Keyboard + mouse input. Movement is camera-relative (isometric).

export class Input {
  private keys = new Set<string>();
  // edge-triggered actions
  pressed = new Set<string>();
  attackQueued = false;
  blockHeld = false;
  mouseAttack = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'tab'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseAttack = true;
      if (e.button === 2) this.blockHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.blockHeld = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(k: string) { return this.keys.has(k); }
  consumePressed(k: string) { if (this.pressed.has(k)) { this.pressed.delete(k); return true; } return false; }

  // Returns camera-relative move vector for isometric view.
  moveVector(): { x: number; z: number } {
    let fx = 0, fz = 0;
    if (this.down('w') || this.down('arrowup')) fz -= 1;
    if (this.down('s') || this.down('arrowdown')) fz += 1;
    if (this.down('a') || this.down('arrowleft')) fx -= 1;
    if (this.down('d') || this.down('arrowright')) fx += 1;
    // rotate by -45deg to align screen up with iso forward
    const a = -Math.PI / 4;
    const cos = Math.cos(a), sin = Math.sin(a);
    return { x: fx * cos - fz * sin, z: fx * sin + fz * cos };
  }

  sprint() { return this.down('shift'); }

  endFrame() {
    this.pressed.clear();
    this.mouseAttack = false;
  }
}
