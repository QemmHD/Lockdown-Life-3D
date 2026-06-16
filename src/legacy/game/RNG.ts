// Seeded pseudo-random generator (mulberry32) for reproducible procedural runs.
export class RNG {
  seed: number;
  private s: number;

  constructor(seed?: number) {
    this.seed = (seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
    this.s = this.seed;
  }

  reseed(seed: number) { this.seed = seed >>> 0; this.s = this.seed; }

  float(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number { return Math.floor(this.float() * (max - min + 1)) + min; }
  range(min: number, max: number): number { return this.float() * (max - min) + min; }
  chance(percent: number): boolean { return this.float() * 100 < percent; }
  choice<T>(arr: T[]): T { return arr[Math.floor(this.float() * arr.length)]; }
  weighted<T extends { weight: number }>(opts: T[]): T {
    const total = opts.reduce((a, o) => a + o.weight, 0);
    let r = this.float() * total;
    for (const o of opts) { r -= o.weight; if (r <= 0) return o; }
    return opts[opts.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.float() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // gentle value variation around 1.0 (e.g. for tints/sizes)
  vary(amount: number): number { return 1 + (this.float() * 2 - 1) * amount; }
}

// Global run RNG — reseeded at the start of every game.
export const run = new RNG();

export function randomSeed(): number { return Math.floor(Math.random() * 1_000_000_000); }
