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
import { Interactable, InteractableDef, OBJ_ACTIONS, OBJ_ACTION_LABEL, isExclusive } from '../world/Interactable';

const SECONDS_PER_HOUR = 5;
const PATROL_ROOMS = ['hallway', 'cellblock', 'yard', 'cafeteria', 'shower'];
const RESTRICTED = ['guardroom', 'intake', 'storage', 'solitary'];
const DEBUG = typeof location !== 'undefined' && /[?&]debug/.test(location.search);
// schedule phases during which an area's door/gate stands open (others closed; rec areas locked at night)
const OPEN_FOR: Record<string, string[]> = {
  cellblock: ['wake', 'lockdown', 'sleep'],
  cafeteria: ['breakfast', 'lunch', 'dinner'],
  shower: ['shower'],
  yard: ['work', 'yard', 'free']
};
// which interactable types prisoners head for during each schedule phase
const PHASE_OBJ: Record<string, string[]> = {
  wake: ['sink', 'bed'], sleep: ['bed'], lockdown: ['bed'],
  breakfast: ['table'], lunch: ['table'], dinner: ['table'],
  shower: ['shower'], yard: ['weights', 'pullup'], free: ['weights', 'pullup'],
  work: ['job', 'shelf', 'trash']
};
// interactable type -> the pose/state an occupant holds while using it
const USE_STATE: Record<string, string> = {
  bed: 'resting', shower: 'washing', sink: 'washing', toilet: 'washing',
  table: 'eating', counter: 'eating', weights: 'training', pullup: 'training',
  job: 'working', shelf: 'working', trash: 'working'
};
const USING_STATES = new Set(['resting', 'washing', 'eating', 'training', 'working']);
export type InteractAction = 'talk' | 'insult' | 'threaten' | 'trade' | 'favor' | 'fight' | 'backoff' | 'comply' | 'argue' | 'rest' | 'wash' | 'eat' | 'train' | 'work' | 'pickup' | 'use' | 'inspect' | 'search' | 'hide' | 'take' | 'open' | 'close' | 'try';
const SELF_ACTIONS: InteractAction[] = ['rest', 'wash', 'eat', 'train', 'work'];
const ACTION_DUR: Record<string, number> = { talk: 0.8, insult: 0.9, threaten: 1.0, trade: 1.1, favor: 1.0, comply: 0.6, argue: 0.8, rest: 1.4, wash: 1.4, eat: 1.5, train: 1.4, work: 1.8 };
const ACTION_STATE: Record<string, string> = { talk: 'talking', comply: 'talking', argue: 'threatening', insult: 'threatening', threaten: 'threatening', trade: 'trading', favor: 'trading', rest: 'resting', wash: 'washing', eat: 'eating', train: 'training', work: 'working' };
const SAY: Record<string, string> = { talk: "What's up?", insult: '😠', threaten: 'Back off!', trade: 'Trade?', favor: 'A favor?', comply: 'Yes, sir.', argue: '😤', rest: '😴', wash: '🚿', eat: '🍽️', train: '🏋️', work: '💪' };
// object-action timings, character states, and bubble icons
const OBJ_DUR: Record<string, number> = { rest: 1.6, wash: 1.4, use: 0.6, eat: 1.5, train: 1.4, work: 1.8, inspect: 0.8, search: 1.2, hide: 1.0, take: 0.8, open: 0.6, close: 0.6, try: 0.7 };
const OBJ_STATE: Record<string, string> = { rest: 'resting', wash: 'washing', eat: 'eating', train: 'training', work: 'working', search: 'searching', hide: 'working', take: 'working', use: 'talking', inspect: 'talking', open: 'talking', close: 'talking', try: 'talking' };
const OBJ_ICON: Record<string, string> = { rest: '😴', wash: '🚿', eat: '🍽️', train: '🏋️', work: '💪', search: '🔍', hide: '🤫', take: '🖐️', use: '🚪', inspect: '👁️', open: '🚪', close: '🚪', try: '🔒' };

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
    const path = start >= 0 ? this.path(start, goal, e) : null;
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
      this.applyDoorSchedule();                 // open/lock areas for the new phase
      const free = ph.id === 'yard' || ph.id === 'free' || ph.id === 'work';
      for (const e of this.ecs.query('Brain')) {
        const b = this.ecs.get<Brain>(e, 'Brain')!;
        if (b.isPlayer) continue; // the player is not yanked by the schedule
        if (b.role === 'prisoner' && b.state !== 'fight' && b.state !== 'down' && b.state !== 'solitary' && b.state !== 'escorted' && b.state !== 'beingSearched') {
          // release any object held/claimed for the previous phase, then re-route
          this.releaseFor(e); b.objTarget = undefined;
          if (USING_STATES.has(b.state)) b.state = 'idle';
          // during free time, gang members drift to their turf
          b.targetRoom = (free && b.gang) ? GANG_MAP[b.gang].territory : ph.room;
          b.state = 'goto';
          this.ecs.get<Agent>(e, 'Agent')!.path = null;
        }
      }
      this.bus.emit('alert', { type: 'phase', text: `${ph.name}` });
    }

    this.needsSystem(dt);
    this.sweepReservations(dt);
    this.prisonerAI(dt);
    this.guardAI(dt);
    this.combatSystem(dt);
    this.playerSystem(dt);
    this.moveAgents(dt);
  }

  // free any object whose holder is gone, downed, or whose reservation timed out
  private sweepReservations(dt: number) {
    for (const o of this.objs.values()) {
      if (!o.reservedBy) continue;
      o.reservedUntil -= dt;
      const b = this.brain(o.reservedBy);
      if (!b || o.reservedUntil <= 0 || b.state === 'down' || b.state === 'solitary') {
        if (b && b.objTarget === o.id) b.objTarget = undefined;
        o.reservedBy = 0; o.reservedUntil = 0;
      }
    }
  }
  private releaseFor(e: Entity) { for (const o of this.objs.values()) if (o.reservedBy === e) { o.reservedBy = 0; o.reservedUntil = 0; } }

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
      if (b.state === 'fight' || b.state === 'down' || b.state === 'solitary' || b.state === 'beingSearched' || b.state === 'escorted') continue;
      const ag = this.ecs.get<Agent>(e, 'Agent')!;
      const p = this.ecs.get<Position>(e, 'Position')!;
      // holding a use-pose at an object: keep the reservation alive, then release
      if (USING_STATES.has(b.state)) {
        b.timer -= dt;
        const held = b.objTarget ? this.objs.get(b.objTarget) : null;
        if (held && held.reservedBy === e) held.reservedUntil = Math.max(held.reservedUntil, b.timer + 2);
        if (b.timer <= 0) { this.releaseFor(e); b.objTarget = undefined; b.state = 'idle'; b.action = 'Idle'; }
        continue;
      }
      ag.repathCd -= dt;
      // walking to a claimed schedule object
      if (b.objTarget) {
        const o = this.objs.get(b.objTarget);
        if (!o || (isExclusive(o.type) && o.reservedBy !== e)) { b.objTarget = undefined; ag.path = null; }
        else {
          o.reservedUntil = Math.max(o.reservedUntil, 8);
          if (Math.hypot(p.x - o.ix, p.z - o.iz) <= 1.3) this.beginNpcUse(e, b, p, o);
          else if (!ag.path && ag.repathCd <= 0) {
            const path = this.path(this.map.worldToIdx(p.x, p.z), this.map.worldToIdx(o.ix, o.iz), e);
            ag.repathCd = 1; if (path && path.length) { ag.path = path; ag.step = 0; b.state = 'goto'; } else { this.releaseFor(e); b.objTarget = undefined; } // unreachable → fall back
          }
          continue;
        }
      }
      if (!ag.path) {
        const here = this.roomTypeAt(p);
        // prefer a real scheduled object/anchor over a generic room center
        if (ag.repathCd <= 0 && this.assignScheduleTarget(e, b, p)) { ag.repathCd = 1.2; continue; }
        if (here !== b.targetRoom && ag.repathCd <= 0) { this.gotoRoom(e, b.targetRoom); ag.repathCd = 1.2; b.state = 'goto'; }
        else {
          b.state = 'wander'; b.timer -= dt;
          if (b.timer <= 0) { if (this.rng.chance(0.5)) this.gotoRoom(e, b.targetRoom); b.timer = this.rng.range(2.5, 6); }
        }
      }
    }
  }
  // pick a free, reachable interactable matching the current schedule phase; claim + route to it
  private assignScheduleTarget(e: Entity, b: Brain, p: Position): boolean {
    const want = PHASE_OBJ[this.phaseId]; if (!want) return false;
    const ph = phaseAt(this.hour);
    const constrain = this.phaseId !== 'work';   // meals/sleep/yard stay in their scheduled area; jobs can be anywhere
    const start = this.map.worldToIdx(p.x, p.z); if (start < 0) return false;
    let best: Interactable | null = null, bd = Infinity;
    for (const o of this.objs.values()) {
      if (!want.includes(o.type)) continue;
      if (isExclusive(o.type) && o.reservedBy && o.reservedBy !== e) continue;
      if (constrain && this.roomType(o.room) !== ph.room) continue;
      const d = Math.hypot(o.ix - p.x, o.iz - p.z); if (d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    const path = this.path(start, this.map.worldToIdx(best.ix, best.iz), e);
    if (!path) return false;                     // blocked (e.g. locked gate) → caller falls back
    if (isExclusive(best.type)) { best.reservedBy = e; best.reservedUntil = 30; }
    b.objTarget = best.id; b.action = `Heading to ${best.name}`; b.state = 'goto';
    const ag = this.ecs.get<Agent>(e, 'Agent')!; ag.path = path.length ? path : null; ag.step = 0;
    return true;
  }
  // arrive at a claimed object and hold its pose for a few seconds
  private beginNpcUse(e: Entity, b: Brain, p: Position, o: Interactable) {
    b.state = (USE_STATE[o.type] as any) ?? 'idle';
    b.action = o.name;
    b.timer = this.rng.range(3, 7);
    p.facing = Math.atan2(o.x - p.x, o.z - p.z);
    this.ecs.get<Agent>(e, 'Agent')!.path = null;
    if (isExclusive(o.type)) { o.reservedBy = e; o.reservedUntil = b.timer + 2; }
    const sat: Needs = this.ecs.get<Needs>(e, 'Needs')!;
    if (b.state === 'resting') sat.sleep = clamp01(sat.sleep - 0.3);
    else if (b.state === 'washing') sat.hygiene = clamp01(sat.hygiene - 0.3);
    else if (b.state === 'eating') sat.hunger = clamp01(sat.hunger - 0.3);
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
      // visible search: walk to suspect, then run a timed search
      if (b.state === 'searching' && b.foe != null) {
        const tgt = b.foe; const tp = this.pos(tgt); const tb = this.brain(tgt);
        if (!tp || !tb) { b.state = 'idle'; b.foe = undefined; ag.path = null; continue; }
        const d = Math.hypot(tp.x - p.x, tp.z - p.z);
        if (d > 2.2) { if (!ag.path && ag.repathCd <= 0) { this.gotoEntity(e, tgt); ag.repathCd = 0.6; } }
        else {
          ag.path = null; p.facing = Math.atan2(tp.x - p.x, tp.z - p.z); tp.facing = Math.atan2(p.x - tp.x, p.z - tp.z);
          if (b.actTimer == null) { b.actTimer = 1.6; this.bubble(e, 'Search!', 'search', 1.6); tb.state = 'beingSearched'; }
          b.actTimer -= dt;
          if (b.actTimer <= 0) { this.doSearchResult(e, tgt); if (b.state === 'searching') { b.state = 'idle'; b.foe = undefined; } b.actTimer = undefined; }
        }
        continue;
      }
      // visible escort to solitary
      if (b.state === 'escorting' && b.escortTarget != null) {
        const tgt = b.escortTarget; const tp = this.pos(tgt); const tb = this.brain(tgt);
        b.actTimer = (b.actTimer ?? 14) - dt;
        const so = this.pickRoomOfType('solitary'); const sc = this.map.toWorld(so.x + (so.w >> 1), so.y + (so.h >> 1));
        if (!tp || !tb) { b.state = 'idle'; b.escortTarget = undefined; ag.path = null; continue; }
        if (!ag.path && ag.repathCd <= 0) { const gi = this.map.worldToIdx(p.x, p.z), si = this.map.worldToIdx(sc.x, sc.z); const path = gi >= 0 && si >= 0 ? this.path(gi, si, e) : null; ag.path = path && path.length ? path : null; ag.step = 0; ag.repathCd = 1; }
        // the escorted prisoner follows just behind the guard
        const fx = p.x - Math.sin(p.facing) * 0.9, fz = p.z - Math.cos(p.facing) * 0.9;
        tp.x += (fx - tp.x) * Math.min(1, dt * 6); tp.z += (fz - tp.z) * Math.min(1, dt * 6); tp.facing = p.facing;
        if (Math.hypot(p.x - sc.x, p.z - sc.z) < 3 || (b.actTimer ?? 0) <= 0) {
          this.sendToSolitary(e, tgt, 'disciplined'); b.state = 'idle'; b.escortTarget = undefined; b.actTimer = undefined; ag.path = null;
        }
        continue;
      }
      // patrol — sometimes man a guard post (desk/console), otherwise sweep an area or checkpoint
      if (!ag.path) {
        b.timer -= dt;
        if (b.timer <= 0) {
          if (this.rng.chance(0.3) && this.guardToPost(e, b, p)) { b.timer = this.rng.range(3, 6); }
          else { b.targetRoom = PATROL_ROOMS[Math.floor(this.rng.float() * PATROL_ROOMS.length)]; this.gotoRoom(e, b.targetRoom); b.timer = this.rng.range(3, 6); }
        } else {
          // standing at a post: face the nearest guard desk/console
          let best: Interactable | null = null, bd = 3;
          for (const o of this.objs.values()) { if (o.type !== 'desk') continue; const d = Math.hypot(o.ix - p.x, o.iz - p.z); if (d < bd) { bd = d; best = o; } }
          if (best) p.facing = Math.atan2(best.x - p.x, best.z - p.z);
        }
      }
    }
  }
  // route a guard to a guard desk/console anchor (security or intake) and stand post there
  private guardToPost(e: Entity, b: Brain, p: Position): boolean {
    let best: Interactable | null = null, bd = Infinity;
    for (const o of this.objs.values()) {
      if (o.type !== 'desk') continue;
      const rt = this.roomType(o.room); if (rt !== 'guardroom' && rt !== 'intake') continue;
      const d = Math.hypot(o.ix - p.x, o.iz - p.z); if (d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    const path = this.path(this.map.worldToIdx(p.x, p.z), this.map.worldToIdx(best.ix, best.iz), e);
    if (!path) return false;
    const ag = this.ecs.get<Agent>(e, 'Agent')!; ag.path = path.length ? path : null; ag.step = 0;
    b.targetRoom = this.roomType(best.room);
    return true;
  }
  private gotoEntity(e: Entity, target: Entity) {
    const p = this.ecs.get<Position>(e, 'Position')!;
    const tp = this.ecs.get<Position>(target, 'Position')!;
    const ag = this.ecs.get<Agent>(e, 'Agent')!;
    const start = this.map.worldToIdx(p.x, p.z), goal = this.map.worldToIdx(tp.x, tp.z);
    const path = start >= 0 && goal >= 0 ? this.path(start, goal, e) : null;
    ag.path = path && path.length ? path : null; ag.step = 0;
  }
  private endRespond(e: Entity, b: Brain) { b.state = 'idle'; b.foe = undefined; this.ecs.get<Agent>(e, 'Agent')!.path = null; b.timer = 0; }
  // nearby idle inmates turn to watch a brawl
  private faceWatchers(x: number, z: number) {
    for (const e of this.ecs.query('Brain', 'Position')) {
      const b = this.brain(e)!; if (b.role !== 'prisoner' || (b.state !== 'idle' && b.state !== 'wander')) continue;
      const p = this.pos(e)!; const d = Math.hypot(p.x - x, p.z - z);
      if (d > 1 && d < 6) p.facing = Math.atan2(x - p.x, z - p.z);
    }
  }

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
          let power = 0.12 * (b.traits.includes('tough') ? 1.3 : 1) * (b.traits.includes('weak') ? 0.6 : 1);
          const weapon = (this.inv(e)?.items ?? []).map((id) => ITEMS[id]?.combat ?? 0).reduce((a, c) => Math.max(a, c), 0);
          power += weapon * 0.02;
          fn.health = clamp01(fn.health - power);
          this.bus.emit('impact', { x: fp.x, z: fp.z });
          this.bus.emit('float', { x: fp.x, z: fp.z, text: `-${Math.round(power * 100)}`, color: '#ff7a6a' });
          this.faceWatchers(fp.x, fp.z);
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
      const tileIdx = ag.path[ag.step];
      const t = this.map.tileXY(tileIdx);
      // a character walking through an unlocked door swings it open (visual + state)
      const did = this.doorTiles.get(tileIdx);
      if (did) { const dr = this.objs.get(did); if (dr && !dr.open && !dr.locked && !dr.restricted) dr.open = true; }
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
    if (pb.state === 'solitary' || pb.state === 'down' || pb.state === 'escorted') return null;
    if (this.act && this.act.phase === 'perform') return null;   // locked mid-action
    this.releaseObj(); this.act = null;                          // tapping cancels a queued action
    if (pb.state === 'fight') { pb.state = 'idle'; pb.foe = undefined; }
    const idx = this.map.worldToIdx(wx, wz);
    if (idx < 0 || !this.map.walkable[idx]) return null;
    const start = this.map.worldToIdx(this.pos(pl)!.x, this.pos(pl)!.z);
    const path = start >= 0 ? this.path(start, idx, pl) : null;
    if (!path) { this.bus.emit('actionResult', { text: 'No path — a door is locked.' }); return null; }
    const ag = this.ecs.get<Agent>(pl, 'Agent')!; ag.path = path.length ? path : null; ag.step = 0;
    pb.action = 'Walking';
    const t = this.map.tileXY(idx); return this.map.toWorld(t.x, t.y);
  }

  // ---------- deferred action flow (walk → face → perform → apply → feedback) ----------
  private act: { action: InteractAction; target: Entity; objId?: string; point?: { x: number; z: number }; phase: 'approach' | 'perform'; timer: number; dur: number; applied: boolean } | null = null;
  actionProgress() { return this.act && this.act.phase === 'perform' ? 1 - this.act.timer / this.act.dur : 0; }
  actionLabel() { return this.act ? this.act.action : ''; }

  // ---------- interactable objects ----------
  objs = new Map<string, Interactable>();
  private doorTiles = new Map<number, string>();   // grid tile idx -> door/gate object id
  setInteractables(defs: InteractableDef[]) {
    this.objs.clear(); this.doorTiles.clear();
    for (const d of defs) {
      this.objs.set(d.id, { ...d, reservedBy: 0, reservedUntil: 0, open: !d.restricted, locked: false, stash: [] });
      if (d.type === 'door' || d.type === 'gate') { const k = this.map.worldToIdx(d.x, d.z); if (k >= 0) this.doorTiles.set(k, d.id); }
    }
    this.applyDoorSchedule();
  }
  getObj(id: string) { return this.objs.get(id); }

  // ---------- doors / gates: movement blocking + schedule ----------
  // Can `role` step onto a door tile right now? Guards open anything; prisoners are stopped
  // by locked or restricted (staff-only) doors. Open/closed-unlocked doors let prisoners through.
  private doorPassable(o: Interactable, role: 'prisoner' | 'guard'): boolean {
    if (role === 'guard') return true;
    return !o.restricted && !o.locked;
  }
  // a tile-passability predicate for findPath, specialised to one entity's role
  private passFor(e: Entity): (idx: number) => boolean {
    const role = this.brain(e)?.role ?? 'prisoner';
    if (!this.doorTiles.size) return () => true;
    return (idx: number) => { const id = this.doorTiles.get(idx); if (!id) return true; const o = this.objs.get(id); return !o || this.doorPassable(o, role); };
  }
  // door-aware path: returns a tile route or null (blocked / unreachable)
  private path(startIdx: number, goalIdx: number, e: Entity): number[] | null {
    if (startIdx < 0 || goalIdx < 0) return null;
    const p = findPath(this.map, startIdx, goalIdx, this.passFor(e));
    if (!p && DEBUG) console.debug('[path] blocked', { e, startIdx, goalIdx, role: this.brain(e)?.role });
    return p;
  }
  // set every door/gate open/closed/locked based on the current schedule phase
  private applyDoorSchedule() {
    for (const o of this.objs.values()) {
      if (o.type !== 'door' && o.type !== 'gate') continue;
      const rtype = this.roomType(o.room);
      if (RESTRICTED.includes(rtype)) { o.open = false; o.locked = false; continue; } // staff-only handled by `restricted`
      const open = (OPEN_FOR[rtype] ?? []).includes(this.phaseId);
      if (open) { o.open = true; o.locked = false; }
      else if (this.phaseId === 'sleep') { o.open = false; o.locked = true; }  // Lights Out: rec areas locked (guards still pass)
      else { o.open = false; o.locked = false; }                               // closed but openable the rest of the day
    }
  }
  private alive(e: Entity) { const b = this.brain(e); return !!b && b.state !== 'down'; }
  objActions(id: string): { key: string; label: string; disabled?: boolean; reason?: string }[] {
    const o = this.objs.get(id); if (!o) return [];
    // doors/gates: contextual Inspect + Open/Close/Try depending on state
    if (o.type === 'door' || o.type === 'gate') {
      const out: { key: string; label: string; disabled?: boolean; reason?: string }[] = [{ key: 'inspect', label: 'Inspect' }];
      if (o.restricted) out.push({ key: 'try', label: 'Try Door', reason: 'staff only' });
      else if (o.locked) out.push({ key: 'try', label: 'Try Door', reason: 'locked down' });
      else out.push(o.open ? { key: 'close', label: 'Close' } : { key: 'open', label: 'Open' });
      out.push({ key: 'backoff', label: 'Back Off' });
      return out;
    }
    const base = OBJ_ACTIONS[o.type] ?? [];
    const acts = o.stash.length && !base.includes('take') ? [...base, 'take'] : base.slice();
    const pInv = this.inv(this.playerId)!;
    const inUse = isExclusive(o.type) && o.reservedBy && o.reservedBy !== this.playerId && this.alive(o.reservedBy);
    return acts.map((key) => {
      let disabled = false, reason = '';
      if (inUse) { disabled = true; reason = 'in use'; }
      else if (key === 'hide' && pInv.items.length === 0) { disabled = true; reason = 'nothing to hide'; }
      else if (key === 'take' && o.stash.length === 0) { disabled = true; reason = 'nothing hidden'; }
      return { key, label: OBJ_ACTION_LABEL[key] ?? key, disabled, reason };
    });
  }
  private faceObj(e: Entity, o: Interactable) { const p = this.pos(e); if (p) p.facing = Math.atan2(o.x - p.x, o.z - p.z); }
  private releaseObj() { if (this.act?.objId) { const o = this.objs.get(this.act.objId); if (o && o.reservedBy === this.playerId) o.reservedBy = 0; } }

  // UI entry point for object interactions
  requestObjectAction(objId: string, action: string): string {
    const o = this.objs.get(objId); if (!o) return '';
    const pl = this.playerId; const pb = this.brain(pl)!; const pinv = this.inv(pl)!;
    if (pb.state === 'solitary' || pb.state === 'escorted' || pb.state === 'down') return 'You can\'t act right now.';
    if (action === 'backoff') { this.releaseObj(); this.act = null; pb.action = 'Idle'; this.bubble(pl, '…', 'talk', 0.6); return 'You step away.'; }
    const isDoor = o.type === 'door' || o.type === 'gate';
    const exclusive = isExclusive(o.type);
    if (exclusive && o.reservedBy && o.reservedBy !== pl && this.alive(o.reservedBy)) return `${o.name} is in use.`;
    if (action === 'hide' && !pinv.items.length) return 'Nothing to hide.';
    if (action === 'take' && !o.stash.length) return 'Nothing hidden here.';
    // can the player actually walk to the object's interaction point? (door states matter)
    const pp0 = this.pos(pl)!; const here = Math.hypot(pp0.x - o.ix, pp0.z - o.iz) <= 1.5;
    if (!here) {
      const reach = this.path(this.map.worldToIdx(pp0.x, pp0.z), this.map.worldToIdx(o.ix, o.iz), pl);
      if (!reach) { this.bubble(pl, '🔒', 'search', 1.0); return `Can't reach the ${o.name} — a door is locked.`; }
    }
    const dur = OBJ_DUR[action] ?? 1.0;
    this.releaseObj();
    this.act = { action: action as InteractAction, target: pl, objId, point: { x: o.ix, z: o.iz }, phase: 'approach', timer: dur, dur, applied: false };
    if (exclusive) { o.reservedBy = pl; o.reservedUntil = 8; }
    if (here) { this.act.phase = 'perform'; this.beginPerform(); return ''; }
    this.playerMoveToKeepAction(o.ix, o.iz);
    return isDoor ? `Heading to the ${o.name}…` : `Heading to the ${o.name}…`;
  }

  private bubble(e: Entity, text: string, kind = 'talk', dur = 1.4) { this.bus.emit('bubble', { e, text, kind, dur }); }
  private floatBy(e: Entity, text: string, color: string) { const p = this.pos(e); if (p) this.bus.emit('float', { x: p.x, z: p.z, text, color }); }
  private faceTo(a: Entity, b: Entity) { const pa = this.pos(a), pb = this.pos(b); if (pa && pb) pa.facing = Math.atan2(pb.x - pa.x, pb.z - pa.z); }

  // UI entry point: returns a status string (e.g. "Walking closer…")
  requestAction(target: Entity, action: InteractAction): string {
    const pl = this.playerId; const pb = this.brain(pl)!; const ps = this.social(pl)!;
    if (pb.state === 'solitary' || pb.state === 'escorted') return 'You can\'t act right now.';
    if (action === 'backoff') { this.act = null; if (pb.state === 'fight') { pb.state = 'idle'; pb.foe = undefined; } pb.action = 'Idle'; ps.reputation = clamp(ps.reputation - 1, -100, 100); this.bubble(pl, '…', 'talk', 0.8); return 'You back off.'; }
    if (action === 'fight') { this.act = null; this.startPlayerFight(target); return 'Fight!'; }
    const self = SELF_ACTIONS.includes(action);
    const dur = ACTION_DUR[action] ?? 0.9;
    this.act = { action, target: self ? pl : target, phase: self ? 'perform' : 'approach', timer: dur, dur, applied: false };
    if (self) { this.beginPerform(); return ''; }
    if (this.dist(pl, target) <= 2.6) { this.act.phase = 'perform'; this.beginPerform(); return ''; }
    const tp = this.pos(target)!; this.playerMoveToKeepAction(tp.x, tp.z);
    return `Walking up to ${this.brain(target)?.name ?? 'them'}…`;
  }
  // path the player without cancelling the queued action
  private playerMoveToKeepAction(wx: number, wz: number): boolean {
    const pl = this.playerId; const idx = this.map.worldToIdx(wx, wz); if (idx < 0) return false;
    const start = this.map.worldToIdx(this.pos(pl)!.x, this.pos(pl)!.z);
    const path = start >= 0 ? this.path(start, idx, pl) : null;
    const ag = this.ecs.get<Agent>(pl, 'Agent')!; ag.path = path && path.length ? path : null; ag.step = 0;
    this.brain(pl)!.action = 'Approaching';
    return !!path;
  }
  private beginPerform() {
    const a = this.act!; const pl = this.playerId; const pb = this.brain(pl)!;
    this.ecs.get<Agent>(pl, 'Agent')!.path = null;
    if (a.objId) {
      const o = this.objs.get(a.objId)!;
      pb.state = (OBJ_STATE[a.action] as any) ?? 'working';
      pb.action = `${OBJ_ACTION_LABEL[a.action] ?? a.action} (${o.name})`;
      this.faceObj(pl, o);
      this.bubble(pl, SAY[a.action] ?? OBJ_ICON[a.action] ?? '…', a.action === 'search' ? 'search' : 'job', a.dur + 0.2);
      return;
    }
    pb.state = (ACTION_STATE[a.action] as any) ?? 'idle';
    pb.action = a.action.charAt(0).toUpperCase() + a.action.slice(1);
    if (SELF_ACTIONS.includes(a.action)) this.bubble(pl, SAY[a.action] ?? '', 'job', a.dur + 0.2);
    else { this.faceTo(pl, a.target); this.faceTo(a.target, pl); this.bubble(a.action === 'comply' || a.action === 'argue' ? pl : a.target, SAY[a.action] ?? '…', a.action, a.dur + 0.2); }
  }
  private updatePlayerAction(dt: number) {
    if (!this.act) return;
    const pl = this.playerId; const pb = this.brain(pl)!;
    if (pb.state === 'down' || pb.state === 'solitary' || pb.state === 'escorted') { this.releaseObj(); this.act = null; return; }
    const a = this.act;
    if (a.objId) { const o = this.objs.get(a.objId); if (o && o.reservedBy === pl) o.reservedUntil = Math.max(o.reservedUntil, 4); }
    if (a.phase === 'approach') {
      if (a.objId) {
        const o = this.objs.get(a.objId); if (!o) { this.act = null; pb.action = 'Idle'; return; }
        const pp = this.pos(pl)!; this.faceObj(pl, o);
        if (Math.hypot(pp.x - a.point!.x, pp.z - a.point!.z) <= 1.5) { a.phase = 'perform'; a.timer = a.dur; this.beginPerform(); }
        else if (!this.ecs.get<Agent>(pl, 'Agent')!.path) this.playerMoveToKeepAction(a.point!.x, a.point!.z);
        return;
      }
      const tb = this.brain(a.target); if (!tb) { this.act = null; pb.action = 'Idle'; return; }
      this.faceTo(pl, a.target);
      if (this.dist(pl, a.target) <= 2.6) { a.phase = 'perform'; a.timer = a.dur; this.beginPerform(); }
      else if (!this.ecs.get<Agent>(pl, 'Agent')!.path) { const tp = this.pos(a.target)!; this.playerMoveToKeepAction(tp.x, tp.z); }
    } else {
      if (a.objId) { const o = this.objs.get(a.objId); if (o) this.faceObj(pl, o); }
      else if (!SELF_ACTIONS.includes(a.action)) this.faceTo(pl, a.target);
      a.timer -= dt;
      if (a.timer <= 0 && !a.applied) {
        a.applied = true;
        if (a.objId) this.applyObjectAction(a.objId, a.action); else this.applyAction(a);
        this.act = null;
      }
    }
  }
  private applyObjectAction(objId: string, action: string) {
    const o = this.objs.get(objId); if (!o) return;
    const pl = this.playerId; const pb = this.brain(pl)!; const n = this.ecs.get<Needs>(pl, 'Needs')!; const ps = this.social(pl)!; const pinv = this.inv(pl)!;
    let result = '';
    switch (action) {
      case 'rest': n.sleep = clamp01(n.sleep - 0.45); n.energy = clamp01(n.energy + 0.3); this.floatBy(pl, '+Energy', '#6dff9e'); result = `You rest on the ${o.name}.`; break;
      case 'wash': n.hygiene = clamp01(n.hygiene - 0.55); this.floatBy(pl, '+Hygiene', '#9fcad8'); result = `You wash up at the ${o.name}.`; break;
      case 'use': if (o.type === 'door' || o.type === 'gate') { o.open = !o.open; this.bubble(pl, o.open ? 'Open.' : 'Shut.', 'search', 1.0); result = `${o.name}: ${o.open ? 'opened' : 'closed'}.`; } else { n.hygiene = clamp01(n.hygiene - 0.1); result = `You use the ${o.name}.`; } break;
      case 'open': o.open = true; this.bubble(pl, 'Open.', 'search', 1.0); this.floatBy(pl, 'Opened', '#9fe0a0'); result = `You open the ${o.name}.`; break;
      case 'close': o.open = false; this.bubble(pl, 'Shut.', 'search', 1.0); result = `You close the ${o.name}.`; break;
      case 'try': {
        // rattling a locked/restricted door fails, raises suspicion, and a nearby guard may clock it
        ps.suspicion = clamp(ps.suspicion + (o.restricted ? 9 : 6), 0, 100);
        this.bubble(pl, '🔒', 'search', 1.1); this.floatBy(pl, 'Suspicion +', '#ff7a6a');
        result = o.restricted ? `${o.name}: guard access only.` : `${o.name}: locked down.`;
        const g = this.nearestGuard(pl, 7); if (g != null && this.rng.chance(0.4)) { this.bus.emit('alert', { type: 'guard', text: `A guard noticed you at the ${o.name}.` }); }
        break;
      }
      case 'eat': n.hunger = clamp01(n.hunger - 0.55); this.floatBy(pl, 'Fed', '#e8b52e'); result = `You eat at the ${o.name}.`; break;
      case 'train': n.energy = clamp01(n.energy - 0.15); ps.respect = clamp(ps.respect + 1, 0, 100); this.floatBy(pl, '+Respect', '#ffd24a'); result = `You train on the ${o.name}.`; break;
      case 'work': { const before = pinv.money; result = this.doJob(o.jobRoom ?? this.roomType(o.room)); const dM = pinv.money - before; if (dM) this.floatBy(pl, `$+${dM}`, '#9fe0a0'); break; }
      case 'inspect': result = (o.type === 'door' || o.type === 'gate') ? `${o.name}: ${o.restricted ? 'restricted, staff only' : o.locked ? 'locked down' : o.open ? 'open' : 'closed (unlocked)'}.` : `You inspect the ${o.name}.`; break;
      case 'search': {
        if (o.stash.length) { const got = o.stash.splice(0); for (const it of got) pinv.items.push(it); this.floatBy(pl, 'Found stash!', '#6dff9e'); result = `You found hidden items in the ${o.name}.`; this.bus.emit('alert', { type: 'search', text: `Found ${got.length} hidden item(s)` }); }
        else { ps.suspicion = clamp(ps.suspicion + 6, 0, 100); this.floatBy(pl, 'Nothing', '#ccc'); result = `Nothing hidden in the ${o.name}.`; }
        break;
      }
      case 'hide': {
        const id = pinv.items.find(isContraband) ?? pinv.items[0];
        if (id) { pinv.items.splice(pinv.items.indexOf(id), 1); o.stash.push(id); ps.suspicion = clamp(ps.suspicion - 12, 0, 100); this.floatBy(pl, `Hid ${ITEMS[id]?.name ?? id}`, '#9fe0a0'); result = `You stash ${ITEMS[id]?.name ?? id} in the ${o.name}.`; this.bus.emit('alert', { type: 'trade', text: `Hid ${ITEMS[id]?.name ?? id}` }); }
        break;
      }
      case 'take': { const got = o.stash.splice(0); for (const it of got) pinv.items.push(it); if (got.length) { this.floatBy(pl, 'Took items', '#6dff9e'); result = `You retrieve your stash from the ${o.name}.`; } break; }
    }
    if (o.reservedBy === pl) o.reservedBy = 0;
    if (pb.state !== 'fight' && pb.state !== 'down') { pb.state = 'idle'; pb.action = 'Idle'; }
    if (result) this.bus.emit('actionResult', { text: result });
  }
  private roomType(roomId: string) { return this.rooms.find((r) => r.id === roomId)?.type ?? ''; }
  private applyAction(a: { action: InteractAction; target: Entity }) {
    const pl = this.playerId; const pb = this.brain(pl)!; const ps = this.social(pl)!; const pinv = this.inv(pl)!;
    const beforeRep = ps.reputation, beforeResp = ps.respect, beforeSusp = ps.suspicion, beforeMoney = pinv.money;
    let result = '';
    if (SELF_ACTIONS.includes(a.action)) result = this.selfAction(a.action);
    else result = this.resolveTarget(a.target, a.action);
    // floating feedback from the deltas
    const dR = Math.round(ps.reputation - beforeRep), dRe = Math.round(ps.respect - beforeResp), dS = Math.round(ps.suspicion - beforeSusp), dM = pinv.money - beforeMoney;
    if (dR) this.floatBy(pl, `${dR > 0 ? '+' : ''}${dR} Rep`, dR > 0 ? '#6dff9e' : '#ff7a6a');
    if (dRe) this.floatBy(pl, `${dRe > 0 ? '+' : ''}${dRe} Respect`, dRe > 0 ? '#ffd24a' : '#ff7a6a');
    if (dS > 0) this.floatBy(pl, `Suspicion +${dS}`, '#ff7a6a');
    if (dM) this.floatBy(pl, `$${dM > 0 ? '+' : ''}${dM}`, '#9fe0a0');
    // target reaction bubble
    if (!SELF_ACTIONS.includes(a.action)) {
      const back = /back|scare|deal|favor|nothing/i.test(result);
      if (a.action === 'insult') this.bubble(a.target, '😠', 'insult', 1.2);
      else if (a.action === 'threaten') this.bubble(a.target, back ? '😨' : '😤', 'threaten', 1.2);
      else if (a.action === 'trade') this.bubble(a.target, 'Deal.', 'trade', 1.2);
    }
    if (pb.state !== 'fight' && pb.state !== 'down') { pb.state = 'idle'; pb.action = 'Idle'; }
    if (result) this.bus.emit('actionResult', { text: result });
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

    this.updatePlayerAction(dt);

    // suspicion accrues in restricted zones / when carrying contraband
    const room = this.roomTypeAt(pp);
    let rise = 0;
    if (RESTRICTED.includes(room)) rise += dt * 6;
    if (this.hasContraband(pl)) rise += dt * 1.2;
    if (pb.state === 'fight') rise += dt * 8;
    ps.suspicion = clamp(ps.suspicion + rise - dt * 0.6, 0, 100);

    // a nearby guard moves in to search a suspicious player (visible)
    this.suspTimer -= dt;
    if (this.suspTimer <= 0 && ps.suspicion > 45 && pb.state !== 'beingSearched' && pb.state !== 'fight') {
      this.suspTimer = 6;
      const guard = this.nearestGuard(pl, 9);
      if (guard != null) this.beginSearch(guard, pl);
    }
  }

  private nearestGuard(target: Entity, range: number): Entity | null {
    let best: Entity | null = null, bd = range;
    for (const g of this.ecs.query('Brain', 'Position')) {
      const b = this.brain(g)!;
      if (b.role !== 'guard' || b.state === 'respond' || b.state === 'searching' || b.state === 'escorting') continue;
      const d = this.dist(g, target); if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  // a guard walks over and performs a visible, timed search
  private beginSearch(guard: Entity, target: Entity) {
    const gb = this.brain(guard)!; const tb = this.brain(target)!;
    gb.state = 'searching'; gb.foe = target; gb.actTimer = undefined;
    tb.state = 'beingSearched';
    this.ecs.get<Agent>(target, 'Agent')!.path = null;
    this.bus.emit('alert', { type: 'search', text: `${gb.name} moves to search ${tb.name}` });
  }
  private doSearchResult(guard: Entity, target: Entity) {
    const inv = this.inv(target); const ps = this.social(target); const tb = this.brain(target);
    if (!inv || !ps || !tb) return;
    const contraband = inv.items.filter(isContraband);
    let found: string | null = null;
    for (const id of contraband) { if (this.rng.float() < 0.78 - ITEMS[id].concealment * 0.6) { found = id; break; } }
    if (found) {
      inv.items.splice(inv.items.indexOf(found), 1);
      this.bus.emit('alert', { type: 'search', text: `Contraband found on ${tb.name}: ${ITEMS[found].name} — confiscated!` });
      this.bubble(guard, 'Found it.', 'search', 1.4); this.floatBy(target, 'Contraband!', '#ff7a6a');
      if (tb.isPlayer) ps.reputation = clamp(ps.reputation + 4, -100, 100);
      if (ITEMS[found].risk >= 0.7) { this.beginEscort(guard, target, 'serious contraband'); return; }
      ps.suspicion = clamp(ps.suspicion - 30, 0, 100);
    } else {
      ps.suspicion = clamp(ps.suspicion - 22, 0, 100);
      this.bubble(guard, 'Clean.', 'search', 1.2); this.floatBy(target, 'Clean', '#9fe0a0');
      this.bus.emit('alert', { type: 'search', text: `${tb.name} searched — clean` });
    }
    if (tb.state === 'beingSearched') tb.state = 'idle';
  }

  // guard escorts a prisoner to solitary (walks over, prisoner follows, then placed)
  private beginEscort(guard: Entity, target: Entity, reason: string) {
    const gb = this.brain(guard)!; const tb = this.brain(target)!;
    gb.state = 'escorting'; gb.escortTarget = target; gb.actTimer = 14; // safety timeout
    tb.state = 'escorted'; tb.foe = undefined; this.ecs.get<Agent>(target, 'Agent')!.path = null;
    this.ecs.get<Agent>(guard, 'Agent')!.path = null;
    this.bus.emit('alert', { type: 'discipline', text: `${gb.name} is escorting ${tb.name} to solitary — ${reason}` });
    this.bubble(guard, 'Move it.', 'search', 1.6);
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
      const g = this.nearestGuard(this.playerId, 10);
      if (g != null && this.rng.chance(0.5)) this.beginEscort(g, this.playerId, 'fighting');
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

  // applies an in-range interaction result (called by the action machine after walk+face+timer)
  private resolveTarget(target: Entity, action: InteractAction): string {
    const pl = this.playerId;
    const pb = this.brain(pl)!;
    const tb = this.brain(target); const ps = this.social(pl);
    if (!tb || !ps) return '';
    const ts = this.social(target);
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
    const objs: Record<string, { stash: string[]; open: boolean; locked: boolean }> = {};
    for (const [id, o] of this.objs) if (o.stash.length || o.open !== !o.restricted || o.locked) objs[id] = { stash: o.stash, open: o.open, locked: o.locked };
    return { version: 4, seed: this.rng.seed, day: this.day, hour: this.hour, phaseId: this.phaseId, ents, objs };
  }
  hydrate(data: any) {
    if (!data?.ents) return;
    this.ecs = new ECS();
    this.act = null;
    this.day = data.day ?? 1; this.hour = data.hour ?? 6; this.phaseId = data.phaseId ?? 'wake';
    this.playerId = 0;
    const safeState = (s: string) => (s === 'solitary' ? 'solitary' : 'idle');
    for (const r of data.ents) {
      if (!r.pos || !r.brain || !r.render) continue;
      const e = this.ecs.create();
      this.ecs.set(e, 'Position', r.pos);
      this.ecs.set(e, 'Render', r.render);
      this.ecs.set(e, 'Agent', r.agent ?? { speed: 2, path: null, step: 0, repathCd: 0 });
      this.ecs.set(e, 'Needs', r.needs ?? { hunger: 0, sleep: 0, hygiene: 0, energy: 1, anger: 0, fear: 0, health: 1 });
      this.ecs.set(e, 'Brain', { ...r.brain, foe: undefined, escortTarget: undefined, actTimer: undefined, objTarget: undefined, state: safeState(r.brain.state), action: 'Idle' });
      this.ecs.set(e, 'Social', r.social ?? { reputation: 0, respect: 20, suspicion: 0, rel: 0 });
      this.ecs.set(e, 'Inventory', r.inv ?? { items: [], money: 0 });
      if (r.isPlayer || r.brain.isPlayer) this.playerId = e;
    }
    if (!this.playerId) this.playerId = this.ecs.query('Brain').find((e) => this.ecs.get<Brain>(e, 'Brain')!.role === 'prisoner') ?? 0;
    // reset object reservations, derive door states for the loaded phase, then restore saved overrides
    for (const o of this.objs.values()) { o.reservedBy = 0; o.reservedUntil = 0; o.stash = []; o.open = !o.restricted; o.locked = false; }
    this.applyDoorSchedule();
    if (data.objs) for (const id in data.objs) { const o = this.objs.get(id); if (o) { o.stash = data.objs[id].stash ?? []; if ('open' in data.objs[id]) o.open = data.objs[id].open; if ('locked' in data.objs[id]) o.locked = data.objs[id].locked; } }
  }
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
