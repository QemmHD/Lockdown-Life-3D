import { EventBus } from './EventBus';

// Unified pointer/touch input. Emits: 'tap'{x,y}, 'pan'{dx,dy}, 'zoom'{factor}.
// One-finger swipe = rotate when zoomed in / pan at the overview (decided in IsoCamera.pan);
// two-finger pinch = zoom. Mouse + touch.
export class InputManager {
  private dragging = false;
  private moved = 0;
  private last = { x: 0, y: 0 };
  private pinchDist = 0;
  private downTime = 0;
  private longTimer = 0;

  constructor(private el: HTMLElement, private bus: EventBus) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('touchstart', this.onTouch, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private active = new Map<number, { x: number; y: number }>();

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    this.dragging = true; this.moved = 0; this.last = { x: e.clientX, y: e.clientY };
    this.downTime = performance.now();
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !this.dragging) return;
    const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
    this.moved += Math.abs(dx) + Math.abs(dy);
    this.last = { x: e.clientX, y: e.clientY };
    if (this.moved > 6) this.bus.emit('pan', { dx, dy });
  };
  private onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (this.dragging && this.moved < 6) this.bus.emit('tap', { x: e.clientX, y: e.clientY });
    this.dragging = false;
  };
  private onWheel = (e: WheelEvent) => { e.preventDefault(); this.bus.emit('zoom', { factor: e.deltaY > 0 ? 1.1 : 0.9 }); };

  private onTouch = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0]; this.last = { x: t.clientX, y: t.clientY }; this.moved = 0; this.downTime = performance.now();
    } else if (e.touches.length === 2) {
      this.pinchDist = this.dist(e.touches[0], e.touches[1]);
    }
  };
  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - this.last.x, dy = t.clientY - this.last.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.last = { x: t.clientX, y: t.clientY };
      this.bus.emit('pan', { dx, dy });
    } else if (e.touches.length === 2) {
      const d = this.dist(e.touches[0], e.touches[1]);
      if (this.pinchDist) this.bus.emit('zoom', { factor: this.pinchDist / d });   // two-finger pinch = zoom
      this.pinchDist = d;
    }
  };

  // touchend → tap if it was a tap
  attachTapEnd(el: HTMLElement) {
    el.addEventListener('touchend', (e) => {
      if (this.moved < 8 && performance.now() - this.downTime < 350) {
        const t = e.changedTouches[0];
        if (t) this.bus.emit('tap', { x: t.clientX, y: t.clientY });
      }
    }, { passive: false });
  }

  private dist(a: Touch, b: Touch) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
}
