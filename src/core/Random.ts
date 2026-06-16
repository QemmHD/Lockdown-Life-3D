// Seeded RNG (mulberry32) — deterministic simulation for debugging/replays.
export class Random {
  seed: number;
  private s: number;
  constructor(seed = Math.floor(Math.random() * 1e9)) { this.seed = seed >>> 0; this.s = this.seed; }
  reseed(seed: number) { this.seed = seed >>> 0; this.s = this.seed; }
  float() {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number) { return Math.floor(this.float() * (max - min + 1)) + min; }
  range(min: number, max: number) { return this.float() * (max - min) + min; }
  chance(p: number) { return this.float() < p; }
  pick<T>(a: T[]): T { return a[Math.floor(this.float() * a.length)]; }
}
