import type { GameSettings } from '../game/types';

type SfxName =
  | 'footstep' | 'swing' | 'hit' | 'block' | 'door' | 'cell_slam' | 'alarm'
  | 'click' | 'money' | 'eat' | 'rep' | 'whistle' | 'murmur' | 'daybreak'
  | 'siren' | 'fail' | 'levelup' | 'pickup';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private settings: GameSettings;
  private lastFootstep = 0;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  // Must be triggered from a user gesture
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.master ? this.settings.sfxVolume : 0;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  resume() { this.ctx?.resume?.(); }

  applySettings() {
    if (this.master) this.master.gain.value = this.settings.master ? this.settings.sfxVolume : 0;
  }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.3, slideTo?: number) {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.3, filterFreq = 1000, hp = false) {
    if (!this.ctx) return;
    const t = this.now();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = hp ? 'highpass' : 'lowpass';
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  play(name: SfxName) {
    if (!this.ctx || !this.settings.master) return;
    switch (name) {
      case 'footstep': {
        const t = performance.now();
        if (t - this.lastFootstep < 220) return;
        this.lastFootstep = t;
        this.noise(0.05, 0.12, 400); break;
      }
      case 'swing': this.tone(320, 0.12, 'sawtooth', 0.18, 120); break;
      case 'hit': this.noise(0.12, 0.4, 800); this.tone(90, 0.14, 'square', 0.25, 50); break;
      case 'block': this.tone(180, 0.1, 'square', 0.25, 220); this.noise(0.06, 0.2, 2000, true); break;
      case 'door': this.tone(120, 0.3, 'sawtooth', 0.18, 80); break;
      case 'cell_slam': this.noise(0.18, 0.5, 300); this.tone(70, 0.25, 'square', 0.3, 40); break;
      case 'alarm': case 'siren': {
        this.tone(660, 0.5, 'square', 0.22, 440);
        setTimeout(() => this.tone(880, 0.5, 'square', 0.22, 600), 250);
        break;
      }
      case 'whistle': this.tone(1800, 0.25, 'sine', 0.22, 2200); break;
      case 'click': this.tone(520, 0.05, 'square', 0.15); break;
      case 'pickup': this.tone(660, 0.06, 'triangle', 0.2, 880); break;
      case 'money': this.tone(880, 0.05, 'triangle', 0.2); setTimeout(() => this.tone(1320, 0.06, 'triangle', 0.2), 60); break;
      case 'eat': this.noise(0.12, 0.2, 600); break;
      case 'rep': case 'levelup':
        this.tone(523, 0.1, 'triangle', 0.22);
        setTimeout(() => this.tone(659, 0.1, 'triangle', 0.22), 90);
        setTimeout(() => this.tone(784, 0.14, 'triangle', 0.22), 180); break;
      case 'fail': this.tone(200, 0.25, 'sawtooth', 0.22, 90); break;
      case 'murmur': this.noise(0.4, 0.06, 500); break;
      case 'daybreak': this.tone(330, 0.4, 'sine', 0.18, 440); setTimeout(() => this.tone(440, 0.4, 'sine', 0.16, 550), 200); break;
    }
  }
}
