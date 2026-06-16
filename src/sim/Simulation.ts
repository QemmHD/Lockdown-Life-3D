import { ECS, Entity } from '../ecs/world';
import { Position, Render, Agent, Needs, Brain, Social, Inventory } from '../ecs/components';
import { TileMap } from '../world/TileMap';
import { generatePrison, randomTileInRoom, Room } from '../world/WorldGen';
import { findPath } from '../world/Pathfinding';
import { Random } from '../core/Random';
import { EventBus } from '../core/EventBus';
import { GANGS, GANG_MAP, areEnemies, NAME_POOL, GUARD_NAMES, PRISONER_TRAITS, phaseAt } from '../data/content';
import { ITEMS, CONTRABAND_IDS, ITEM_IDS, isContraband } from '../data/items';
import { JOB_BY_ROOM } from '../data/jobs';

const SECONDS_PER_HOUR = 5;
const PATROL_ROOMS = ['hallway', 'cellblock', 'yard', 'cafeteria', 'shower'];
const RESTRICTED = ['guardroom', 'intake', 'storage', 'solitary'];
export type InteractAction = 'talk' | 'insult' | 'threaten' | 'trade' | 'favor' | 'fight' | 'backoff' | 'comply' | 'argue' | 'rest' | 'wash' | 'eat' | 'train' | 'work' | 'pickup' | 'use';

// The authoritative game world. Decides what happens; render only reflects it.
export class Simulation {
  ecs = new ECS();
  map!: TileMap;
  rooms: Room[] = [];
  rng: Random;
  day = 1;
  hour = 6;
  phaseId = 'wake';
  playerId: Entity = 0;
  private fightCd = 6;
  private suspTimer = 0;

  constructor(public bus: EventBus, seed = Math.floor(Math.random() * 1e9)) { this.rng = new Random(seed); }

  generate() {
    const layout = generatePrison();
    this.map = layout.map;
    this.rooms = layout.rooms;
    for (let i = 0; i < 14; i++) this.spawnPrisoner();
    for (let i = 0; i < 4; i++) this.spawnGuard(i);
    // promote the first prisoner to the directly-controlled player
    this.playerId = this.ecs.query('Brain').find((e) => this.ecs.get<Brain>(e, 'Brain')!.role === 'prisoner')!;
    const pb = this.ecs.get<Brain>(this.playerId, 'Brain')!;
    pb.isPlayer = true; pb.name = 'You'; pb.action = 'Idle';
    const ps = this.ecs.get<Social>(this.playerId, 'Social')!; ps.reputation = 0; ps.respect = 8; ps.suspicion = 0;
    this.ecs.get<Render>(this.playerId, 'Render')!.color = 0xef7a22;
  }

  player(): Entity { return this.playerId; }
  dropItem(id: string): string { const inv = this.inv(this.playerId); if (!inv) return ''; const i = inv.items.indexOf(id); if (i >= 0) { inv.items.splice(i, 1); return `Dropped ${ITEMS[id]?.name ?? id}.`; } return ''; }
  currentRoomName(e: Entity): string { const p = this.pos(e); if (!p) return ''; const k = this.map.worldToIdx(p.x, p.z); const ri = k >= 0 ? this.map.room[k] : -1; return ri >= 0 ? this.rooms[ri].name : 'Hallway'; }

  // ---------- spawning ----------
  private spawnAtType(type: string) {
    const r = this.pickRoomOfType(type);
    const k = randomTileInRoom(this.map, this.rooms, r.id, () => this.rng.float());
    const t = this.map.tileXY(k); return this.map.toWorld(t.x, t.y);
  }
  spawnPrisoner(): Entity {
    const e = this.ecs.create();
    const w = this.spawnAtType('cellblock');
    const gang = this.rng.chance(0.65) ? this.rng.pick(GANGS).id : undefined;
    const color = gang ? GANG_MAP[gang].color : 0xc98a3a;
    const traits = [this.rng.pick(PRISONER_TRAITS)];
    if (this.rng.chance(0.4)) traits.push(this.rng.pick(PRISONER_TRAITS));
    this.ecs.set<Position>(e, 'Position', { x: w.x, z: w.z, facing: 0 });
    this.ecs.set<Render>(e, 'Render', { kind: 'prisoner', color, meshId: e });
    this.ecs.set<Agent>(e, 'Agent', { speed: traits.includes('fast') ? 2.6 : 2.0, path: null, step: 0, repathCd: 0 });
    this.ecs.set<Needs>(e, 'Needs', {
      hunger: this.rng.range(0.1, 0.4), sleep: this.rng.range(0.1, 0.3), hygiene: this.rng.range(0.1, 0.4),
      energy: this.rng.range(0.6, 1), anger: this.rng.range(0.1, 0.4), fear: this.rng.range(0.1, 0.3), health: 1
    });
    const respect = 20 + (traits.includes('tough') ? 25 : 0) + (traits.includes('fighter') ? 20 : 0) - (traits.includes('weak') ? 15 : 0) + this.rng.int(0, 20);
    this.ecs.set<Social>(e, 'Social', { reputation: 0, respect: clamp(respect, 5, 95), suspicion: 0, rel: 0 });
    const items: string[] = [];
    if (this.rng.chance(0.5)) items.push(this.rng.pick(ITEM_IDS));
    if (this.rng.chance(0.2)) items.push(this.rng.pick(CONTRABAND_IDS));
    this.ecs.set<Inventory>(e, 'Inventory', { items, money: this.rng.int(0, 12) });
    this.ecs.set<Brain>(e, 'Brain', {
      role: 'prisoner', state: 'idle', name: this.rng.pick(NAME_POOL), gang, traits,
      timer: 0, targetRoom: 'cellblock', attackCd: 0, action: 'Idle'
    });
    return e;
  }
  spawnGuard(i: number): Entity {
    const e = this.ecs.create();
    const w = this.spawnAtType('guardroom');
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
  roomTypeAt(p: Position): string {
    const k = this.map.worldToIdx(p.x, p.z);
    if (k < 0) return '';
    const ri = this.map.room[k];
    return ri >= 0 ? this.rooms[ri].type : '';
  }
  private pickRoomOfType(type: string) {
    const list = this.rooms.filter((r) => r.type === type);
    return list.length ? this.rng.pick(list) : this.rooms[0];
  }
  // routes by room TYPE — supports multiple rooms of a type (e.g. two cell blocks)
  private gotoRoom(e: Entity, type: string) {
    const p = this.ecs.get<Position>(e, 'Position')!;
    const ag = this.ecs.get<Agent>(e, 'Agent')!;
    const r = this.pickRoomOfType(type);
    const start = this.map.worldToIdx(p.x, p.z);
    const goal = randomTileInRoom(this.map, this.rooms, r.id, () => this.rng.float());
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
      const free = ph.id === 'yard' || ph.id === 'free' || ph.id === 'work';
      for (const e of this.ecs.query('Brain')) {
        const b = this.ecs.get<Brain>(e, 'Brain')!;
        if (b.isPlayer) continue; // the player is not yanked by the schedule
        if (b.role === 'prisoner' && b.state !== 'fight' && b.state !== 'down' && b.state !== 'solitary') {
          // during free time, gang members drift to their turf
          b.targetRoom = (free && b.gang) ? GANG_MAP[b.gang].territory : ph.room;
          b.state = 'goto';
          this.ecs.get<Agent>(e, 'Agent')!.path = null;
        }
      }
      this.bus.emit('alert', { type: 'phase', text: `${ph.name}` });
    }

    this.needsSystem(dt);
    this.prisonerAI(dt);
    this.guardAI(dt);
    this.combatSystem(dt);
    this.playerSystem(dt);
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
      // being in the scheduled room type satisfies the matching need
      const room = this.roomTypeAt(this.ecs.get<Position>(e, 'Position')!);
      if (room === 'cafeteria') n.hunger = clamp01(n.hunger - dt * 0.08);
      if (room === 'shower') n.hygiene = clamp01(n.hygiene - dt * 0.08);
      if (room === 'cellblock' && (this.phaseId === 'sleep' || this.phaseId === 'lockdown')) n.sleep = clamp01(n.sleep - dt * 0.06);
    }
  }

  private prisonerAI(dt: number) {
    for (const e of this.ecs.query('Brain', 'Agent', 'Position')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'prisoner' || b.isPlayer) continue;   // player is manually controlled
      if (b.state === 'fight' || b.state === 'down' || b.state === 'solitary') continue;
      const ag = this.ecs.get<Agent>(e, 'Agent')!;
      ag.repathCd -= dt;
      if (!ag.path) {
        const p = this.ecs.get<Position>(e, 'Position')!;
        const here = this.roomTypeAt(p);
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
      const loser = b.foe;
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
            this.onFightWin(e, loser, b, fb);
          }
        }
      }
    }
  }
  private tryStartFight() {
    const prisoners = this.ecs.query('Brain', 'Needs', 'Position').filter((e) => {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      return b.role === 'prisoner' && !b.isPlayer && b.state !== 'fight' && b.state !== 'down' && b.state !== 'solitary';
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

  // ---------- player + social helpers ----------
  social(e: Entity) { return this.ecs.get<Social>(e, 'Social'); }
  inv(e: Entity) { return this.ecs.get<Inventory>(e, 'Inventory'); }
  brain(e: Entity) { return this.ecs.get<Brain>(e, 'Brain'); }
  pos(e: Entity) { return this.ecs.get<Position>(e, 'Position'); }
  private dist(a: Entity, b: Entity) { const pa = this.pos(a), pb = this.pos(b); return pa && pb ? Math.hypot(pa.x - pb.x, pa.z - pb.z) : 999; }
  hasContraband(e: Entity) { return (this.inv(e)?.items ?? []).some(isContraband); }

  // direct player movement (tap-to-move). Returns the world point walked to, or null.
  playerMoveTo(wx: number, wz: number): { x: number; z: number } | null {
    const pl = this.playerId; const pb = this.brain(pl)!;
    if (pb.state === 'solitary' || pb.state === 'down') return null;
    if (pb.state === 'fight') { pb.state = 'idle'; pb.foe = undefined; }
    const idx = this.map.worldToIdx(wx, wz);
    if (idx < 0 || !this.map.walkable[idx]) return null;
    const start = this.map.worldToIdx(this.pos(pl)!.x, this.pos(pl)!.z);
    const path = start >= 0 ? findPath(this.map, start, idx) : null;
    const ag = this.ecs.get<Agent>(pl, 'Agent')!; ag.path = path && path.length ? path : null; ag.step = 0;
    pb.action = 'Walking';
    const t = this.map.tileXY(idx); return this.map.toWorld(t.x, t.y);
  }

  // ---------- player living systems: suspicion, search, discipline, solitary ----------
  private playerSystem(dt: number) {
    const pl = this.playerId; const pb = this.brain(pl); const ps = this.social(pl); const pp = this.pos(pl);
    if (!pb || !ps || !pp) return;

    if (pb.state === 'solitary') {
      pb.discTimer = (pb.discTimer ?? 0) - dt;
      pb.action = 'In Solitary';
      if ((pb.discTimer ?? 0) <= 0) {
        pb.state = 'idle'; pb.discipline = 'none'; pb.action = 'Released';
        const c = this.pickRoomOfType('cellblock'); const k = randomTileInRoom(this.map, this.rooms, c.id, () => this.rng.float());
        const t = this.map.tileXY(k); const w = this.map.toWorld(t.x, t.y); pp.x = w.x; pp.z = w.z;
        this.bus.emit('alert', { type: 'guard', text: 'You were released from solitary.' });
      }
      return;
    }

    // suspicion accrues in restricted zones / when carrying contraband
    const room = this.roomTypeAt(pp);
    let rise = 0;
    if (RESTRICTED.includes(room)) rise += dt * 6;
    if (this.hasContraband(pl)) rise += dt * 1.2;
    if (pb.state === 'fight') rise += dt * 8;
    ps.suspicion = clamp(ps.suspicion + rise - dt * 0.6, 0, 100);

    // a nearby guard may stop & search a suspicious player
    this.suspTimer -= dt;
    if (this.suspTimer <= 0 && ps.suspicion > 45) {
      this.suspTimer = 4;
      const guard = this.nearestGuard(pl, 6);
      if (guard != null) this.searchPrisoner(guard, pl);
    }
  }

  private nearestGuard(target: Entity, range: number): Entity | null {
    let best: Entity | null = null, bd = range;
    for (const g of this.ecs.query('Brain', 'Position')) {
      const b = this.brain(g)!; if (b.role !== 'guard' || b.state === 'respond') continue;
      const d = this.dist(g, target); if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  searchPrisoner(guard: Entity, target: Entity) {
    const inv = this.inv(target); const ps = this.social(target); const tb = this.brain(target);
    if (!inv || !ps || !tb) return;
    this.bus.emit('alert', { type: 'search', text: `${this.name(guard)} searches ${tb.name}` });
    const contraband = inv.items.filter(isContraband);
    let found: string | null = null;
    for (const id of contraband) {
      const chance = 0.75 - ITEMS[id].concealment * 0.6;   // alert guard vs concealment
      if (this.rng.float() < chance) { found = id; break; }
    }
    if (found) {
      inv.items.splice(inv.items.indexOf(found), 1);
      this.bus.emit('alert', { type: 'search', text: `Contraband found: ${ITEMS[found].name} — confiscated!` });
      if (tb.isPlayer) ps.reputation = clamp(ps.reputation + 4, -100, 100); // notoriety
      if (ITEMS[found].risk >= 0.7) this.sendToSolitary(guard, target, 'caught with serious contraband');
      else { ps.suspicion = clamp(ps.suspicion - 25, 0, 100); }
    } else {
      ps.suspicion = clamp(ps.suspicion - 20, 0, 100);
      this.bus.emit('alert', { type: 'search', text: `${tb.name} searched — nothing found` });
    }
  }

  sendToSolitary(guard: Entity, target: Entity, reason: string) {
    const tb = this.brain(target)!; const tp = this.pos(target)!; const ps = this.social(target);
    tb.state = 'solitary'; tb.discipline = 'solitary'; tb.discTimer = 18; tb.foe = undefined;
    this.ecs.get<Agent>(target, 'Agent')!.path = null;
    const so = this.pickRoomOfType('solitary'); const k = randomTileInRoom(this.map, this.rooms, so.id, () => this.rng.float());
    const t = this.map.tileXY(k); const w = this.map.toWorld(t.x, t.y); tp.x = w.x; tp.z = w.z;
    if (ps) { ps.suspicion = clamp(ps.suspicion - 40, 0, 100); ps.reputation = clamp(ps.reputation + 3, -100, 100); }
    this.bus.emit('alert', { type: 'discipline', text: `${tb.name} sent to solitary — ${reason}` });
  }

  // ---------- combat outcome ----------
  private onFightWin(winner: Entity, loser: Entity, wb: Brain, lb: Brain) {
    const ws = this.social(winner), ls = this.social(loser);
    if (ws) { ws.respect = clamp(ws.respect + 6, 0, 100); }
    if (wb.isPlayer && ws) { ws.reputation = clamp(ws.reputation + 7, -100, 100); this.bus.emit('alert', { type: 'rep', text: `You beat ${lb.name}! Respect rises.` }); }
    if (lb.isPlayer && ls) { ls.reputation = clamp(ls.reputation - 6, -100, 100); this.bus.emit('alert', { type: 'rep', text: `You were beaten by ${wb.name}.` }); this.escortLoserToInfirmaryOrSolitary(); }
    if (ls) ls.respect = clamp(ls.respect - 4, 0, 100);
    // the loser remembers the player
    if (wb.isPlayer && ls) ls.rel = clamp(ls.rel - 30, -100, 100);
    // guards may discipline the player for fighting if seen
    if (wb.isPlayer || lb.isPlayer) {
      const g = this.nearestGuard(this.playerId, 8);
      if (g != null && this.rng.chance(0.5)) this.sendToSolitary(g, this.playerId, 'fighting');
    }
  }
  private escortLoserToInfirmaryOrSolitary() {
    const pb = this.brain(this.playerId)!; pb.action = 'Knocked out';
  }

  // ---------- player interactions (called by UI; sim owns the state changes) ----------
  availableActions(target: Entity): InteractAction[] {
    const tb = this.brain(target); if (!tb) return [];
    if (tb.role === 'guard') return ['talk', 'comply', 'argue'];
    if (tb.isPlayer) return [];
    return ['talk', 'insult', 'threaten', 'trade', 'favor', 'fight', 'backoff'];
  }

  interact(target: Entity, action: InteractAction): string {
    const pl = this.playerId;
    const pb = this.brain(pl)!; if (pb.state === 'solitary') return 'You are in solitary.';
    const tb = this.brain(target); const ps = this.social(pl);
    if (!tb || !ps) return '';
    if (this.dist(pl, target) > 3.2 && action !== 'backoff') {
      const tp = this.pos(target)!; this.playerMoveTo(tp.x, tp.z); return `Moving closer to ${tb.name}…`;
    }
    const ts = this.social(target);
    const facePlayer = () => { const tp = this.pos(target)!, pp = this.pos(pl)!; pp.facing = Math.atan2(tp.x - pp.x, tp.z - pp.z); };
    facePlayer();

    switch (action) {
      case 'talk':
        if (ts) ts.rel = clamp(ts.rel + 6, -100, 100);
        return tb.role === 'guard' ? `${tb.name}: "Keep moving, inmate."` : `${tb.name}: "${this.smalltalk(tb)}"`;
      case 'comply':
        ps.suspicion = clamp(ps.suspicion - 15, 0, 100); return `${tb.name}: "Smart choice."`;
      case 'argue':
        ps.suspicion = clamp(ps.suspicion + 12, 0, 100); ps.reputation = clamp(ps.reputation + 2, -100, 100); return `You argue with ${tb.name}. Suspicion rises.`;
      case 'insult': {
        if (ts) ts.rel = clamp(ts.rel - 18, -100, 100);
        ps.reputation = clamp(ps.reputation + 2, -100, 100);
        const aggr = tb.traits.includes('aggressive') || (ts ? ts.respect : 0) > ps.respect + 10;
        if (aggr && this.rng.chance(0.6)) { this.startPlayerFight(target); return `${tb.name} takes a swing at you!`; }
        return `You insult ${tb.name}. They glare back.`;
      }
      case 'threaten': {
        const win = ps.respect + ps.reputation * 0.3 > (ts ? ts.respect : 30);
        if (win || tb.traits.includes('cowardly')) { if (ts) { ts.rel = clamp(ts.rel - 8, -100, 100); } ps.reputation = clamp(ps.reputation + 4, -100, 100); this.ecs.get<Needs>(target, 'Needs')!.fear = clamp01(this.ecs.get<Needs>(target, 'Needs')!.fear + 0.3); return `${tb.name} backs down.`; }
        ps.reputation = clamp(ps.reputation - 2, -100, 100);
        if (this.rng.chance(0.5)) { this.startPlayerFight(target); return `${tb.name} calls your bluff — fight!`; }
        return `${tb.name}: "You don't scare me."`;
      }
      case 'favor': {
        const ok = (ts ? ts.rel : 0) > 10 || this.rng.chance(0.4 + ps.reputation * 0.003);
        if (ok) { const pinv = this.inv(pl)!; if (this.rng.chance(0.5)) pinv.items.push(this.rng.pick(ITEM_IDS)); else pinv.money += this.rng.int(2, 6); if (ts) ts.rel = clamp(ts.rel + 4, -100, 100); return `${tb.name} does you a favor.`; }
        return `${tb.name} refuses.`;
      }
      case 'trade': {
        const tinv = this.inv(target), pinv = this.inv(pl);
        if (!tinv || !pinv) return 'Nothing to trade.';
        if (!tinv.items.length) return `${tb.name} has nothing to trade.`;
        const item = tinv.items[0]; const price = ITEMS[item].value;
        if (pinv.money < price) return `You can't afford ${ITEMS[item].name} ($${price}).`;
        pinv.money -= price; tinv.money += price; tinv.items.shift(); pinv.items.push(item);
        if (ts) ts.rel = clamp(ts.rel + 5, -100, 100);
        this.bus.emit('alert', { type: 'trade', text: `Traded for ${ITEMS[item].name} ($${price})` });
        return `Bought ${ITEMS[item].name} from ${tb.name}.`;
      }
      case 'fight': this.startPlayerFight(target); return `You start a fight with ${tb.name}!`;
      case 'backoff': if (pb.state === 'fight') { pb.state = 'idle'; pb.foe = undefined; } ps.reputation = clamp(ps.reputation - 1, -100, 100); return 'You back off.';
      default: return '';
    }
  }

  private startPlayerFight(target: Entity) {
    const pl = this.playerId; const pb = this.brain(pl)!; const tb = this.brain(target)!;
    pb.state = 'fight'; pb.foe = target; pb.attackCd = 0.3; pb.action = 'Fighting';
    tb.state = 'fight'; tb.foe = pl; tb.attackCd = 0.5;
    this.bus.emit('alert', { type: 'fight', text: `Fight: You vs ${tb.name}!` });
    this.dispatchGuard(pl);
  }

  private smalltalk(tb: Brain): string {
    const lines = ['Stay out of the showers after dinner.', 'Guards been on edge lately.', "Don't trust the Yard Kings.", 'You got smokes?', 'Keep your head down, fish.', 'Heard there\'s a search coming.'];
    return this.rng.pick(lines);
  }

  // self/object interactions (bed/sink/cafeteria/yard/job stations)
  selfAction(action: InteractAction): string {
    const pl = this.playerId; const n = this.ecs.get<Needs>(pl, 'Needs')!; const pb = this.brain(pl)!; const room = this.roomTypeAt(this.pos(pl)!);
    switch (action) {
      case 'rest': n.sleep = clamp01(n.sleep - 0.4); n.energy = clamp01(n.energy + 0.3); pb.action = 'Resting'; return 'You rest. Energy restored.';
      case 'wash': n.hygiene = clamp01(n.hygiene - 0.5); pb.action = 'Washing'; return 'You clean up.';
      case 'eat': n.hunger = clamp01(n.hunger - 0.5); pb.action = 'Eating'; return 'You eat a meal.';
      case 'train': n.energy = clamp01(n.energy - 0.15); { const s = this.social(pl)!; s.respect = clamp(s.respect + 1, 0, 100); } pb.action = 'Training'; return 'You train. Respect rises slightly.';
      case 'work': return this.doJob(room);
      default: return '';
    }
  }
  private doJob(roomType: string): string {
    const job = JOB_BY_ROOM[roomType]; if (!job) return 'No work here.';
    const pl = this.playerId; const n = this.ecs.get<Needs>(pl, 'Needs')!; if (n.energy < job.energyCost) return 'Too tired to work.';
    n.energy = clamp01(n.energy - job.energyCost);
    const s = this.social(pl)!; s.reputation = clamp(s.reputation + job.rep, -100, 100); s.respect = clamp(s.respect + job.respect, 0, 100);
    this.inv(pl)!.money += job.money;
    this.brain(pl)!.action = job.name;
    this.bus.emit('alert', { type: 'job', text: `${job.verb} — +$${job.money}` });
    return `${job.verb}. Earned $${job.money}.`;
  }

  // ---------- save/load ----------
  serialize() {
    const ents = this.ecs.query('Position', 'Brain').map((e) => ({
      pos: this.ecs.get<Position>(e, 'Position'),
      needs: this.ecs.get<Needs>(e, 'Needs'),
      brain: this.ecs.get<Brain>(e, 'Brain'),
      render: this.ecs.get<Render>(e, 'Render'),
      agent: this.ecs.get<Agent>(e, 'Agent'),
      social: this.ecs.get<Social>(e, 'Social'),
      inv: this.ecs.get<Inventory>(e, 'Inventory'),
      isPlayer: e === this.playerId
    }));
    return { version: 2, seed: this.rng.seed, day: this.day, hour: this.hour, phaseId: this.phaseId, ents };
  }
  hydrate(data: any) {
    if (!data?.ents) return;
    this.ecs = new ECS();
    this.day = data.day ?? 1; this.hour = data.hour ?? 6; this.phaseId = data.phaseId ?? 'wake';
    this.playerId = 0;
    for (const r of data.ents) {
      if (!r.pos || !r.brain || !r.render) continue;
      const e = this.ecs.create();
      this.ecs.set(e, 'Position', r.pos);
      this.ecs.set(e, 'Render', r.render);
      this.ecs.set(e, 'Agent', r.agent ?? { speed: 2, path: null, step: 0, repathCd: 0 });
      this.ecs.set(e, 'Needs', r.needs ?? { hunger: 0, sleep: 0, hygiene: 0, energy: 1, anger: 0, fear: 0, health: 1 });
      this.ecs.set(e, 'Brain', { ...r.brain, foe: undefined, escortTarget: undefined, state: r.brain.state === 'fight' ? 'idle' : r.brain.state });
      this.ecs.set(e, 'Social', r.social ?? { reputation: 0, respect: 20, suspicion: 0, rel: 0 });
      this.ecs.set(e, 'Inventory', r.inv ?? { items: [], money: 0 });
      if (r.isPlayer || r.brain.isPlayer) this.playerId = e;
    }
    if (!this.playerId) this.playerId = this.ecs.query('Brain').find((e) => this.ecs.get<Brain>(e, 'Brain')!.role === 'prisoner') ?? 0;
  }
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
