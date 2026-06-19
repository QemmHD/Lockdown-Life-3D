// Procedural audio — 100% synthesized via WebAudio (no asset files, in keeping with the
// rest of the game). Pure PRESENTATION: it only listens to EventBus feedback + reads a per-frame
// ambient snapshot from the game loop. It never touches the simulation.
//
// The AudioContext is created lazily and resumed on the first user gesture (mobile autoplay
// policy). One-shot cues are throttled so bursts (e.g. all cell gates opening at once, or a flurry
// of alerts) collapse instead of crackling. Mute/volume persist to localStorage.

const LS_KEY = 'll3d_audio';

type Cue = 'confirm' | 'blip' | 'tap';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;          // volume * !muted
  private busGain!: GainNode;         // one-shots
  private ambGain!: GainNode;         // ambient bed
  private alarmGain!: GainNode;       // smooth siren bus
  private started = false;            // persistent nodes built
  private muted = false;
  private volume = 0.7;
  private last = new Map<string, number>();   // cue -> last play time (throttle)
  private static UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'click'];
  private unlockOnce = () => this.unlock();

  constructor() {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); if (typeof s.muted === 'boolean') this.muted = s.muted; if (typeof s.volume === 'number' && isFinite(s.volume)) this.volume = Math.max(0, Math.min(1, s.volume)); } catch { /* defaults */ }
    for (const ev of AudioSystem.UNLOCK_EVENTS) document.addEventListener(ev, this.unlockOnce, { passive: true });
  }

  // ---- lifecycle ----
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume; this.master.connect(ctx.destination);
    this.busGain = ctx.createGain(); this.busGain.gain.value = 0.9; this.busGain.connect(this.master);
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0; this.ambGain.connect(this.master);
    this.alarmGain = ctx.createGain(); this.alarmGain.gain.value = 0; this.alarmGain.connect(this.master);
    return ctx;
  }
  unlock() {
    const ctx = this.ensure(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.startPersistent();
    for (const ev of AudioSystem.UNLOCK_EVENTS) document.removeEventListener(ev, this.unlockOnce);   // fire once
  }

  // ---- settings ----
  isMuted() { return this.muted; }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  setMuted(m: boolean) { this.muted = m; this.applyMaster(); this.persist(); }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); this.applyMaster(); this.persist(); }
  private applyMaster() { if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02); }
  private persist() { try { localStorage.setItem(LS_KEY, JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { /* ignore */ } }

  // ---- synthesis helpers ----
  private throttled(key: string, minGap: number): boolean {
    const ctx = this.ctx!; const t = ctx.currentTime; const prev = this.last.get(key) ?? -999;
    if (t - prev < minGap) return true; this.last.set(key, t); return false;
  }
  // a short enveloped oscillator tone
  private tone(freq: number, dur: number, type: OscillatorType, gain: number, glideTo?: number, dest?: AudioNode) {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.busGain);
    o.start(t); o.stop(t + dur + 0.02);
    o.onended = () => { g.disconnect(); };
  }
  // a filtered noise burst (impacts / clangs / air)
  private noise(dur: number, gain: number, filter: 'lowpass' | 'bandpass' | 'highpass', freq: number, q = 1, dest?: AudioNode) {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);   // decaying noise
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = filter; bp.frequency.value = freq; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(dest ?? this.busGain);
    src.start(t); src.stop(t + dur + 0.02);
    src.onended = () => { g.disconnect(); };
  }

  // ---- one-shot cues ----
  hit() { if (!this.ensure() || this.throttled('hit', 0.05)) return; this.noise(0.07, 0.4, 'lowpass', 280, 1); this.tone(130, 0.14, 'sine', 0.26, 60); }   // short smack + low thud (not a hiss)
  ui(kind: Cue) {
    if (!this.ensure() || this.throttled('ui' + kind, 0.04)) return;
    if (kind === 'confirm') this.tone(520, 0.1, 'sine', 0.16, 660);
    else if (kind === 'blip') this.tone(660, 0.06, 'triangle', 0.08, 720);
    else this.tone(420, 0.04, 'sine', 0.1);
  }
  // classify an action result by its text → positive confirm vs a soft 'no' (failures shouldn't chime)
  result(text: string) {
    if (!this.ensure()) return;
    if (/no path|locked|caught|interrupt|can'?t|cannot|no reachable|nothing|find a|back off|refuse|fail|too far|busy|occupied/i.test(text || '')) {
      if (!this.throttled('deny', 0.06)) this.tone(280, 0.14, 'sine', 0.1, 180);   // gentle descending 'no'
    } else this.ui('confirm');
  }
  // metallic, TONAL door cues (no noise — white noise read as "static"). Slide = a soft descending
  // mechanical tone; clank = a short tick over two ringing low partials, like a steel gate.
  door(open: boolean) {
    if (!this.ensure() || this.throttled('door', 0.08)) return;
    if (open) { this.tone(240, 0.22, 'triangle', 0.09, 150); this.tone(120, 0.12, 'sine', 0.1, 90); }
    else { this.tone(520, 0.05, 'square', 0.07); this.tone(165, 0.22, 'triangle', 0.14, 110); this.tone(330, 0.16, 'triangle', 0.06); }
  }
  // map an alert type to a cue (only the meaningful ones make noise; throttled per-type)
  alert(type: string) {
    if (!this.ensure()) return;
    switch (type) {
      case 'fight': if (!this.throttled('a-fight', 0.12)) this.hit(); break;
      case 'lockdown': if (!this.throttled('a-lock', 0.4)) { this.tone(330, 0.28, 'sawtooth', 0.18, 220); this.door(false); } break;
      case 'critical': if (!this.throttled('a-crit', 0.3)) this.tone(440, 0.22, 'sawtooth', 0.2, 300); break;
      case 'search': if (!this.throttled('a-search', 0.3)) this.tone(300, 0.16, 'triangle', 0.14, 360); break;
      case 'guard': if (!this.throttled('a-guard', 0.3)) this.tone(380, 0.08, 'square', 0.1, 420); break;   // radio blip
      case 'warning': if (!this.throttled('a-warn', 0.3)) this.tone(420, 0.14, 'triangle', 0.12, 480); break;
      case 'player': case 'trade': if (!this.throttled('a-good', 0.2)) { this.tone(523, 0.1, 'sine', 0.12); this.tone(784, 0.12, 'sine', 0.1); } break;
      default: break;   // info / system / phase: silent
    }
  }

  // ---- persistent ambient bed + alarm klaxon ----
  private startPersistent() {
    if (this.started || !this.ensure()) return; this.started = true;
    const ctx = this.ctx!;
    // drone: smooth low SINES (not saws — saws read as buzzy "static") = a soft institutional hum
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.4; lp.connect(this.ambGain);
    for (const [f, gain] of [[60, 0.5], [90, 0.3], [150, 0.14]] as [number, number][]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = gain; o.connect(g).connect(lp); o.start(); }
    this.ambLp = lp;
    // smooth two-tone SIREN (triangle, slow hi-lo sweep + gentle tremolo) — a sustained but soft
    // alarm voice that runs while alarm/lockdown is active (replaces the harsh square klaxon).
    const sir = ctx.createGain(); sir.gain.value = 0.55; sir.connect(this.alarmGain);
    const so = ctx.createOscillator(); so.type = 'triangle'; so.frequency.value = 480; so.connect(sir); so.start();
    const sweep = ctx.createOscillator(); sweep.type = 'sine'; sweep.frequency.value = 0.7; const sweepG = ctx.createGain(); sweepG.gain.value = 90; sweep.connect(sweepG).connect(so.frequency); sweep.start();
    const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 0.7; const tremG = ctx.createGain(); tremG.gain.value = 0.18; trem.connect(tremG).connect(sir.gain); trem.start();
  }
  private ambLp: BiquadFilterNode | null = null;

  // called every frame from the game loop with a snapshot of game tension
  updateAmbient(playing: boolean, riot: number, alarm: boolean, hour: number) {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    const night = (hour >= 22 || hour < 6) ? 0.5 : 1;                  // quieter overnight
    const bed = playing ? (0.012 + Math.min(1, riot) * 0.09) * night : 0.0;   // near-silent when calm
    this.ambGain.gain.setTargetAtTime(bed, t, 0.8);
    if (this.ambLp) this.ambLp.frequency.setTargetAtTime(300 + Math.min(1, riot) * 260, t, 0.8);
    // sustained but SMOOTH siren while an alarm/lockdown is active; gentle fade in / out
    this.alarmGain.gain.setTargetAtTime(alarm && playing ? 0.2 : 0.0, t, 0.4);
  }
}
