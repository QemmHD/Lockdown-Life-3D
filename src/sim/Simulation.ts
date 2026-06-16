import { ECS, Entity } from '../ecs/world';
import { Position, Render, Agent, Needs, Brain } from '../ecs/components';
import { TileMap } from '../world/TileMap';
import { generatePrison, randomTileInRoom, Room } from '../world/WorldGen';
import { findPath } from '../world/Pathfinding';
import { Random } from '../core/Random';
import { EventBus } from '../core/EventBus';
import { GANGS, NAME_POOL, GUARD_NAMES, PRISONER_TRAITS, SCHEDULE, phaseAt } from '../data/content';

const SECONDS_PER_HOUR = 5;
const PATROL_ROOMS = ['hallway', 'cellblock', 'yard', 'cafeteria', 'shower'];

// The authoritative game world. Decides what happens; render only reflects it.
export class Simulation {
  ecs = new ECS();
  map!: TileMap;
  rooms: Room[] = [];
  rng: Random;
  day = 1;
  hour = 6;
  phaseId = 'wake';
  private fightCd = 6;

  constructor(public bus: EventBus, seed = Math.floor(Math.random() * 1e9)) { this.rng = new Random(seed); }

  generate() {
    const layout = generatePrison();
    this.map = layout.map;
    this.rooms = layout.rooms;
    for (let i = 0; i < 8; i++) this.spawnPrisoner();
    for (let i = 0; i < 3; i++) this.spawnGuard(i);
  }

  // ---------- spawning ----------
  private spawnAt(roomId: string) {
    const k = randomTileInRoom(this.map, this.rooms, roomId, () => this.rng.float());
    const t = this.map.tileXY(k); return this.map.toWorld(t.x, t.y);
  }
  spawnPrisoner(): Entity {
    const e = this.ecs.create();
    const w = this.spawnAt('cellblock');
    const gang = this.rng.chance(0.7) ? this.rng.pick(GANGS).id : undefined;
    const color = gang ? GANGS.find((g) => g.id === gang)!.color : 0xc98a3a;
    const traits = [this.rng.pick(PRISONER_TRAITS)];
    if (this.rng.chance(0.4)) traits.push(this.rng.pick(PRISONER_TRAITS));
    this.ecs.set<Position>(e, 'Position', { x: w.x, z: w.z, facing: 0 });
    this.ecs.set<Render>(e, 'Render', { kind: 'prisoner', color, meshId: e });
    this.ecs.set<Agent>(e, 'Agent', { speed: traits.includes('fast') ? 2.6 : 2.0, path: null, step: 0, repathCd: 0 });
    this.ecs.set<Needs>(e, 'Needs', {
      hunger: this.rng.range(0.1, 0.4), sleep: this.rng.range(0.1, 0.3), hygiene: this.rng.range(0.1, 0.4),
      energy: this.rng.range(0.6, 1), anger: this.rng.range(0.1, 0.4), fear: this.rng.range(0.1, 0.3), health: 1
    });
    this.ecs.set<Brain>(e, 'Brain', {
      role: 'prisoner', state: 'idle', name: this.rng.pick(NAME_POOL), gang, traits,
      timer: 0, targetRoom: 'cellblock', attackCd: 0
    });
    return e;
  }
  spawnGuard(i: number): Entity {
    const e = this.ecs.create();
    const w = this.spawnAt('guardroom');
    this.ecs.set<Position>(e, 'Position', { x: w.x, z: w.z, facing: 0 });
    this.ecs.set<Render>(e, 'Render', { kind: 'guard', color: 0x2c3e50, meshId: e });
    this.ecs.set<Agent>(e, 'Agent', { speed: 2.4, path: null, step: 0, repathCd: 0 });
    this.ecs.set<Needs>(e, 'Needs', { hunger: 0, sleep: 0, hygiene: 1, energy: 1, anger: 0, fear: 0, health: 1 });
    this.ecs.set<Brain>(e, 'Brain', {
      role: 'guard', state: 'idle', name: GUARD_NAMES[i % GUARD_NAMES.length], traits: [],
      timer: 0, targetRoom: PATROL_ROOMS[i % PATROL_ROOMS.length], attackCd: 0
    });
    return e;
  }

  // ---------- helpers ----------
  roomIdAt(p: Position): string {
    const k = this.map.worldToIdx(p.x, p.z);
    if (k < 0) return '';
    const ri = this.map.room[k];
    return ri >= 0 ? this.rooms[ri].id : '';
  }
  private gotoRoom(e: Entity, roomId: string) {
    const p = this.ecs.get<Position>(e, 'Position')!;
    const ag = this.ecs.get<Agent>(e, 'Agent')!;
    const start = this.map.worldToIdx(p.x, p.z);
    const goal = randomTileInRoom(this.map, this.rooms, roomId, () => this.rng.float());
    const path = start >= 0 ? findPath(this.map, start, goal) : null;
    ag.path = path && path.length ? path : null; ag.step = 0;
  }
  name(e: Entity) { return this.ecs.get<Brain>(e, 'Brain')?.name ?? '?'; }

  // ---------- main step ----------
  step(dt: number) {
    // clock + schedule
    this.hour += dt / SECONDS_PER_HOUR;
    if (this.hour >= 24) { this.hour -= 24; this.day++; }
    const ph = phaseAt(this.hour);
    if (ph.id !== this.phaseId) {
      this.phaseId = ph.id;
      for (const e of this.ecs.query('Brain')) {
        const b = this.ecs.get<Brain>(e, 'Brain')!;
        if (b.role === 'prisoner' && b.state !== 'fight' && b.state !== 'down') {
          b.targetRoom = ph.room; b.state = 'goto';
          this.ecs.get<Agent>(e, 'Agent')!.path = null;
        }
      }
      this.bus.emit('alert', { type: 'phase', text: `${ph.name} — prisoners moving out` });
    }

    this.needsSystem(dt);
    this.prisonerAI(dt);
    this.guardAI(dt);
    this.combatSystem(dt);
    this.moveAgents(dt);
  }

  private needsSystem(dt: number) {
    for (const e of this.ecs.query('Needs', 'Brain')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'prisoner') continue;
      const n = this.ecs.get<Needs>(e, 'Needs')!;
      n.hunger = clamp01(n.hunger + dt * 0.012);
      n.sleep = clamp01(n.sleep + dt * 0.008);
      n.hygiene = clamp01(n.hygiene + dt * 0.006);
      n.anger = clamp01(n.anger + (n.hunger > 0.7 ? dt * 0.01 : -dt * 0.004));
      // being in the scheduled room satisfies the matching need
      const room = this.roomIdAt(this.ecs.get<Position>(e, 'Position')!);
      if (room === 'cafeteria') n.hunger = clamp01(n.hunger - dt * 0.08);
      if (room === 'shower') n.hygiene = clamp01(n.hygiene - dt * 0.08);
      if (room === 'cellblock' && (this.phaseId === 'sleep' || this.phaseId === 'lockdown')) n.sleep = clamp01(n.sleep - dt * 0.06);
    }
  }

  private prisonerAI(dt: number) {
    for (const e of this.ecs.query('Brain', 'Agent', 'Position')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'prisoner') continue;
      if (b.state === 'fight' || b.state === 'down') continue;
      const ag = this.ecs.get<Agent>(e, 'Agent')!;
      ag.repathCd -= dt;
      if (!ag.path) {
        const p = this.ecs.get<Position>(e, 'Position')!;
        const here = this.roomIdAt(p);
        if (here !== b.targetRoom && ag.repathCd <= 0) { this.gotoRoom(e, b.targetRoom); ag.repathCd = 1.2; b.state = 'goto'; }
        else {
          b.state = 'wander'; b.timer -= dt;
          if (b.timer <= 0) { if (this.rng.chance(0.6)) this.gotoRoom(e, b.targetRoom); b.timer = this.rng.range(2.5, 6); }
        }
      }
    }
  }

  private guardAI(dt: number) {
    for (const e of this.ecs.query('Brain', 'Agent', 'Position')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'guard') continue;
      const ag = this.ecs.get<Agent>(e, 'Agent')!;
      const p = this.ecs.get<Position>(e, 'Position')!;
      ag.repathCd -= dt;

      if (b.state === 'respond' && b.foe != null) {
        const fp = this.ecs.get<Position>(b.foe, 'Position');
        const fb = this.ecs.get<Brain>(b.foe, 'Brain');
        if (!fp || !fb || (fb.state !== 'fight')) { this.endRespond(e, b); continue; }
        const d = Math.hypot(fp.x - p.x, fp.z - p.z);
        if (d < 1.7) { this.breakUpFight(e, b.foe); this.endRespond(e, b); }
        else if (!ag.path && ag.repathCd <= 0) { this.gotoEntity(e, b.foe); ag.repathCd = 0.6; }
        continue;
      }
      // patrol
      if (!ag.path) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.targetRoom = PATROL_ROOMS[Math.floor(this.rng.float() * PATROL_ROOMS.length)];
          this.gotoRoom(e, b.targetRoom);
          b.timer = this.rng.range(3, 6);
        }
      }
    }
  }
  private gotoEntity(e: Entity, target: Entity) {
    const p = this.ecs.get<Position>(e, 'Position')!;
    const tp = this.ecs.get<Position>(target, 'Position')!;
    const ag = this.ecs.get<Agent>(e, 'Agent')!;
    const start = this.map.worldToIdx(p.x, p.z), goal = this.map.worldToIdx(tp.x, tp.z);
    const path = start >= 0 && goal >= 0 ? findPath(this.map, start, goal) : null;
    ag.path = path && path.length ? path : null; ag.step = 0;
  }
  private endRespond(e: Entity, b: Brain) { b.state = 'idle'; b.foe = undefined; this.ecs.get<Agent>(e, 'Agent')!.path = null; b.timer = 0; }

  // ---------- combat ----------
  private combatSystem(dt: number) {
    this.fightCd -= dt;
    if (this.fightCd <= 0) { this.fightCd = this.rng.range(5, 10); this.tryStartFight(); }

    for (const e of this.ecs.query('Brain', 'Position', 'Needs')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.state === 'down') { b.timer -= dt; if (b.timer <= 0) { b.state = 'idle'; this.ecs.get<Needs>(e, 'Needs')!.health = 0.45; } continue; }
      if (b.state !== 'fight' || b.foe == null) continue;
      const p = this.ecs.get<Position>(e, 'Position')!;
      const fb = this.ecs.get<Brain>(b.foe, 'Brain');
      const fp = this.ecs.get<Position>(b.foe, 'Position');
      if (!fb || !fp || fb.state === 'down') { b.state = 'idle'; b.foe = undefined; continue; }
      p.facing = Math.atan2(fp.x - p.x, fp.z - p.z);
      const d = Math.hypot(fp.x - p.x, fp.z - p.z);
      if (d > 1.3) { p.x += Math.sin(p.facing) * dt * 1.6; p.z += Math.cos(p.facing) * dt * 1.6; }
      else {
        b.attackCd -= dt;
        if (b.attackCd <= 0) {
          b.attackCd = 0.8;
          const fn = this.ecs.get<Needs>(b.foe, 'Needs')!;
          const power = 0.12 * (b.traits.includes('tough') ? 1.3 : 1) * (b.traits.includes('weak') ? 0.6 : 1);
          fn.health = clamp01(fn.health - power);
          this.bus.emit('impact', { x: fp.x, z: fp.z });
          if (fn.health <= 0.2) {
            fb.state = 'down'; fb.timer = 6; fb.foe = undefined;
            b.state = 'idle'; b.foe = undefined;
            this.ecs.get<Needs>(e, 'Needs')!.anger = clamp01(this.ecs.get<Needs>(e, 'Needs')!.anger - 0.3);
            this.bus.emit('alert', { type: 'fight', text: `${b.name} knocked out ${fb.name}` });
          }
        }
      }
    }
  }
  private tryStartFight() {
    const prisoners = this.ecs.query('Brain', 'Needs', 'Position').filter((e) => {
      const b = this.ecs.get<Brain>(e, 'Brain')!; return b.role === 'prisoner' && b.state !== 'fight' && b.state !== 'down';
    });
    // group by room
    const byRoom = new Map<string, Entity[]>();
    for (const e of prisoners) { const r = this.roomIdAt(this.ecs.get<Position>(e, 'Position')!); if (!r) continue; (byRoom.get(r) ?? byRoom.set(r, []).get(r)!).push(e); }
    for (const [, list] of byRoom) {
      if (list.length < 2) continue;
      const a = list[Math.floor(this.rng.float() * list.length)];
      const others = list.filter((x) => x !== a);
      const bb = others[Math.floor(this.rng.float() * others.length)];
      const ab = this.ecs.get<Brain>(a, 'Brain')!, bbr = this.ecs.get<Brain>(bb, 'Brain')!;
      const an = this.ecs.get<Needs>(a, 'Needs')!;
      const rivals = ab.gang && bbr.gang && GANGS.find((g) => g.id === ab.gang)?.enemies.includes(bbr.gang);
      const chance = 0.25 + an.anger * 0.5 + (rivals ? 0.4 : 0) + (ab.traits.includes('aggressive') ? 0.2 : 0);
      if (this.rng.float() < chance) {
        ab.state = 'fight'; ab.foe = bb; bbr.state = 'fight'; bbr.foe = a; ab.attackCd = 0.3; bbr.attackCd = 0.5;
        this.bus.emit('alert', { type: 'fight', text: `${ab.name} and ${bbr.name} are fighting!` });
        this.dispatchGuard(a);
      }
      return; // at most one new fight per check
    }
  }
  private dispatchGuard(fighter: Entity) {
    const guards = this.ecs.query('Brain', 'Position').filter((e) => { const b = this.ecs.get<Brain>(e, 'Brain')!; return b.role === 'guard' && b.state !== 'respond'; });
    if (!guards.length) return;
    const fp = this.ecs.get<Position>(fighter, 'Position')!;
    let best = guards[0], bd = Infinity;
    for (const g of guards) { const gp = this.ecs.get<Position>(g, 'Position')!; const d = Math.hypot(gp.x - fp.x, gp.z - fp.z); if (d < bd) { bd = d; best = g; } }
    const b = this.ecs.get<Brain>(best, 'Brain')!; b.state = 'respond'; b.foe = fighter; this.ecs.get<Agent>(best, 'Agent')!.path = null;
  }
  private breakUpFight(guard: Entity, near: Entity) {
    const np = this.ecs.get<Position>(near, 'Position')!;
    for (const e of this.ecs.query('Brain', 'Position')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'prisoner' || b.state !== 'fight') continue;
      const p = this.ecs.get<Position>(e, 'Position')!;
      if (Math.hypot(p.x - np.x, p.z - np.z) < 4) {
        b.state = 'idle'; b.foe = undefined;
        const n = this.ecs.get<Needs>(e, 'Needs')!; n.anger = clamp01(n.anger - 0.4); n.fear = clamp01(n.fear + 0.2);
      }
    }
    this.bus.emit('alert', { type: 'guard', text: `${this.name(guard)} broke up the fight` });
  }

  private moveAgents(dt: number) {
    for (const e of this.ecs.query('Agent', 'Position')) {
      const ag = this.ecs.get<Agent>(e, 'Agent')!;
      if (!ag.path || ag.step >= ag.path.length) { ag.path = null; continue; }
      const p = this.ecs.get<Position>(e, 'Position')!;
      const t = this.map.tileXY(ag.path[ag.step]);
      const w = this.map.toWorld(t.x, t.y);
      const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.15) { ag.step++; if (ag.step >= ag.path.length) ag.path = null; continue; }
      const sp = ag.speed * dt;
      p.x += (dx / d) * Math.min(sp, d); p.z += (dz / d) * Math.min(sp, d);
      p.facing = Math.atan2(dx, dz);
    }
  }

  // ---------- save/load ----------
  serialize() {
    const ents = this.ecs.query('Position', 'Brain').map((e) => ({
      pos: this.ecs.get<Position>(e, 'Position'),
      needs: this.ecs.get<Needs>(e, 'Needs'),
      brain: this.ecs.get<Brain>(e, 'Brain'),
      render: this.ecs.get<Render>(e, 'Render'),
      agent: this.ecs.get<Agent>(e, 'Agent')
    }));
    return { seed: this.rng.seed, day: this.day, hour: this.hour, phaseId: this.phaseId, ents };
  }
  hydrate(data: any) {
    if (!data?.ents) return;
    // reset ecs
    this.ecs = new ECS();
    this.day = data.day ?? 1; this.hour = data.hour ?? 6; this.phaseId = data.phaseId ?? 'wake';
    for (const r of data.ents) {
      if (!r.pos || !r.brain || !r.render) continue;
      const e = this.ecs.create();
      this.ecs.set(e, 'Position', r.pos);
      this.ecs.set(e, 'Render', r.render);
      this.ecs.set(e, 'Agent', r.agent ?? { speed: 2, path: null, step: 0, repathCd: 0 });
      this.ecs.set(e, 'Needs', r.needs ?? { hunger: 0, sleep: 0, hygiene: 0, energy: 1, anger: 0, fear: 0, health: 1 });
      this.ecs.set(e, 'Brain', { ...r.brain, foe: undefined });
    }
  }
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
