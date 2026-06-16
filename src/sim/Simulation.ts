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
import { LockdownState, newLockdown, LOCKDOWN_SECONDS, LOCKDOWN_COOLDOWN, lockdownLocks, sanitizeLockdown } from './LockdownSystem';
import { RiotLevel, computeRiotTarget, riotLevelHyst, tensionLabel, RIOT_WARN_CD, RIOT_EVENT_CD } from './RiotSystem';
import { Checkpoint, buildCheckpoints } from './GuardCheckpointSystem';
import { EscapeState, newEscape, ESCAPE_OPPORTUNITY_ROOMS, ESCAPE_COOLDOWN, rollEscapeOutcome } from './EscapeSystem';
import { PrisonerIntent, GuardRole, INTENT_LABEL, ROLE_LABEL, GUARD_DWELL, INTENT_STICK, ROLE_STICK } from './AIIntent';
import { choosePrisonerIntent } from './PrisonerAISystem';
import { AIMemory, newMemory, decayMemory, rememberFoe, rememberThreat, rememberSearch, sanitizeMemory } from './AIMemorySystem';
import { clusterOffset } from './GroupBehaviorSystem';
import { routeFor } from './GuardAISystem';
import { AttackType, CombatOutcome, ATTACKS, COMBAT_SPACING, SQUARE_UP, HITREACT, STUMBLE, DOWN_TIME, RECOVER, chooseAttack, resolveDefense, OUTCOME_TEXT } from './CombatSystem';
import { Progression, Objective, newProgression, sanitizeProgression, repTier, rollObjectives, DailyStats, newDaily, dayRating } from './Progression';

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
export type InteractAction = 'talk' | 'insult' | 'threaten' | 'trade' | 'favor' | 'fight' | 'backoff' | 'comply' | 'argue' | 'rest' | 'wash' | 'eat' | 'train' | 'work' | 'pickup' | 'use' | 'inspect' | 'search' | 'hide' | 'take' | 'open' | 'close' | 'try' | 'escape';
const SELF_ACTIONS: InteractAction[] = ['rest', 'wash', 'eat', 'train', 'work'];
const ACTION_DUR: Record<string, number> = { talk: 0.8, insult: 0.9, threaten: 1.0, trade: 1.1, favor: 1.0, comply: 0.6, argue: 0.8, rest: 1.4, wash: 1.4, eat: 1.5, train: 1.4, work: 1.8, escape: 3.0 };
const ACTION_STATE: Record<string, string> = { talk: 'talking', comply: 'talking', argue: 'threatening', insult: 'threatening', threaten: 'threatening', trade: 'trading', favor: 'trading', rest: 'resting', wash: 'washing', eat: 'eating', train: 'training', work: 'working', escape: 'working' };
const SAY: Record<string, string> = { talk: "What's up?", insult: '😠', threaten: 'Back off!', trade: 'Trade?', favor: 'A favor?', comply: 'Yes, sir.', argue: '😤', rest: '😴', wash: '🚿', eat: '🍽️', train: '🏋️', work: '💪', escape: '🏃' };
const CHAOS_KEYS = ['comply', 'returncell', 'hide', 'calm', 'helpguard'];   // immediate player chaos actions
// object-action timings, character states, and bubble icons
const OBJ_DUR: Record<string, number> = { rest: 1.6, wash: 1.4, use: 0.6, eat: 1.5, train: 1.4, work: 1.8, inspect: 0.8, search: 1.2, hide: 1.0, take: 0.8, open: 0.6, close: 0.6, try: 0.7 };
const OBJ_STATE: Record<string, string> = { rest: 'resting', wash: 'washing', eat: 'eating', train: 'training', work: 'working', search: 'searching', hide: 'working', take: 'working', use: 'talking', inspect: 'talking', open: 'talking', close: 'talking', try: 'talking' };
const OBJ_ICON: Record<string, string> = { rest: '😴', wash: '🚿', eat: '🍽️', train: '🏋️', work: '💪', search: '🔍', hide: '🤫', take: '🖐️', use: '🚪', inspect: '👁️', open: '🚪', close: '🚪', try: '🔒' };
// shown when a player convenience action finds no reachable matching object
const SELF_REASON: Record<string, string> = { rest: 'Find a bed.', wash: 'No reachable shower or sink.', eat: 'No food station nearby.', train: 'No training equipment nearby.', work: 'No work object nearby.' };

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

  // ---------- chaos layer (Stage 3.0): lockdown / alarm / riot / tension / escape ----------
  lockdown: LockdownState = newLockdown();
  alarm = { active: false, timer: 0, reason: '' };
  heat = 0;                                     // 0..100 facility heat (eased, decays when calm)
  riotPressure = 0;
  riotLevel: RiotLevel = 'calm';
  riotEventTimer = 0;
  tension: Record<string, number> = {};        // by room id, 0..100
  escape: EscapeState = newEscape();
  playerObjective = '';                         // chaos objective shown in the HUD
  private checkpoints: Checkpoint[] = [];
  private fightsRecent = 0;
  private searchesRecent = 0;
  private blockedCount = 0;                      // prisoners blocked from schedule this tick
  private lockdownCd = 0;                        // quiet window after a lockdown lifts
  private riotWarnCd = 0;                        // cooldown before another riot warning
  private riotEventCd = 0;                       // cooldown before another riot event
  private escapeCd = 0;                          // cooldown between escape attempts
  private heatEventTimer = 0;                    // recent-heat-event timer (slows decay briefly)
  // ---------- progression / objectives (Stage 3.4) ----------
  progression: Progression = newProgression();
  objectives: Objective[] = [];
  daily: DailyStats = newDaily(0, 8, 0);
  lastSummaryDay = 0;
  pendingSummary: any = null;          // built at a day rollover; the UI shows + clears it

  // lightweight playtest telemetry (?debug)
  metrics: Record<string, number> = { fightsStarted: 0, fightsEnded: 0, fightsBrokenUp: 0, searches: 0, contrabandFound: 0, lockdownsStarted: 0, lockdownsEnded: 0, alarms: 0, riotWarnings: 0, riotEvents: 0, escapeAttempts: 0, blockedFallbacks: 0, guardCheckpointFails: 0, stuckPrisoners: 0, prisonerIntentChanges: 0, socialInteractions: 0, guardRoleSwitches: 0, standoffs: 0, standoffsEscalated: 0, standoffsDefused: 0, orderRefusals: 0, complianceEvents: 0, attacksAttempted: 0, hits: 0, misses: 0, blocks: 0, dodges: 0, knockdowns: 0, guardInterrupts: 0, fightDisciplines: 0, playerCombatChoices: 0 };

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
    this.checkpoints = buildCheckpoints(this.rooms as any, (i) => this.map.tileXY(i), (x, y) => this.map.toWorld(x, y));
    for (const r of this.rooms) this.tension[r.id] = 0;
    this.daily = newDaily(ps.reputation, ps.respect, this.inv(this.playerId)!.money);
    this.objectives = rollObjectives(() => this.rng.float(), this.day);
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
      timer: 0, targetRoom: 'cellblock', attackCd: 0, action: 'Idle',
      intent: 'schedule', intentCd: 0, mem: newMemory()
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
      timer: 0, targetRoom: PATROL_ROOMS[i % PATROL_ROOMS.length], attackCd: 0,
      guardRole: 'patrol', route: i, routeStep: 0, dwell: 0, roleCd: 0, action: 'Patrolling'
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
    if (this.hour >= 24) { this.hour -= 24; this.day++; this.onDayRollover(); }
    const ph = phaseAt(this.hour);
    if (ph.id !== this.phaseId) {
      this.phaseId = ph.id;
      this.applyDoorSchedule();                 // open/lock areas for the new phase
      // during an active lockdown the schedule is overridden — prisoners stay corralled
      if (!this.lockdown.active) {
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
      }
      this.bus.emit('alert', { type: 'phase', text: `${ph.name}` });
    }

    this.needsSystem(dt);
    this.sweepReservations(dt);
    this.chaosSystem(dt);
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

  // ===================== CHAOS LAYER (Stage 3.0) =====================
  // Lockdown / alarm / riot pressure / area tension / abstract escape. Thin orchestration here;
  // pure rules live in LockdownSystem/RiotSystem/EscapeSystem/GuardCheckpointSystem.
  // TODO(refactor): promote these into standalone *System classes once the surface settles.

  private chaosSystem(dt: number) {
    // decay "recent incident" tallies + cooldowns
    this.fightsRecent = Math.max(0, this.fightsRecent - dt * 0.06);
    this.searchesRecent = Math.max(0, this.searchesRecent - dt * 0.05);
    this.lockdownCd = Math.max(0, this.lockdownCd - dt);
    this.riotWarnCd = Math.max(0, this.riotWarnCd - dt);
    this.riotEventCd = Math.max(0, this.riotEventCd - dt);
    this.escapeCd = Math.max(0, this.escapeCd - dt);
    this.heatEventTimer = Math.max(0, this.heatEventTimer - dt);

    // heat eases downward when calm (faster once a few seconds pass since the last event)
    const heatDecay = (this.heatEventTimer > 0 ? 0.6 : 2.2) * dt;
    this.heat = Math.max(0, this.heat - heatDecay);

    // lockdown timer + fatigue
    if (this.lockdown.active) {
      this.lockdown.timer -= dt;
      this.lockdown.fatigue = clamp01(this.lockdown.fatigue + dt * 0.01);
      if (this.lockdown.timer <= 0) this.endLockdown();
    } else if (this.lockdown.fatigue > 0) {
      this.lockdown.fatigue = Math.max(0, this.lockdown.fatigue - dt * 0.02);
    }
    if (this.alarm.active) { this.alarm.timer -= dt; if (this.alarm.timer <= 0) { this.alarm.active = false; this.alarm.reason = ''; this.bus.emit('alert', { type: 'guard', text: 'Alarm cleared.' }); } }

    // riot pressure eases toward a target computed from prisoner mood + incidents (smooth, no jumps)
    const target = computeRiotTarget(this.riotInputs());
    this.riotPressure += (target - this.riotPressure) * Math.min(1, dt * 0.1);
    this.riotPressure = clamp01(this.riotPressure);
    const lvl = riotLevelHyst(this.riotPressure, this.riotLevel);  // hysteresis avoids flicker
    if (lvl !== this.riotLevel) this.onRiotLevel(lvl);
    if (this.riotEventTimer > 0) this.riotEventTimer -= dt;

    this.updateTension(dt);
    this.maybeNpcEscape(dt);
    this.updatePlayerObjective();
  }

  // raise facility heat by a discrete amount (eased decay handled in chaosSystem)
  private addHeat(amount: number) { this.heat = clamp(this.heat + amount, 0, 100); this.heatEventTimer = 6; }

  private riotInputs() {
    let anger = 0, hunger = 0, hygiene = 0, sleep = 0, n = 0;
    for (const e of this.ecs.query('Needs', 'Brain')) {
      const b = this.brain(e)!; if (b.role !== 'prisoner') continue;
      const nd = this.ecs.get<Needs>(e, 'Needs')!;
      anger += nd.anger; hunger += nd.hunger; hygiene += nd.hygiene; sleep += nd.sleep; n++;
    }
    const blocked = this.blockedCount; this.blockedCount = 0;
    this.metrics.stuckPrisoners = Math.max(this.metrics.stuckPrisoners, blocked);  // peak blocked-at-once
    return n ? {
      count: n, anger: anger / n, hunger: hunger / n, hygiene: hygiene / n, sleep: sleep / n,
      fightsRecent: this.fightsRecent, blocked, searchesRecent: this.searchesRecent,
      lockdownActive: this.lockdown.active, lockdownFatigue: this.lockdown.fatigue
    } : { count: 0, anger: 0, hunger: 0, hygiene: 0, sleep: 0, fightsRecent: 0, blocked: 0, searchesRecent: 0, lockdownActive: false, lockdownFatigue: 0 };
  }

  private onRiotLevel(lvl: RiotLevel) {
    const prev = this.riotLevel;
    // gate escalations behind cooldowns so warnings/events can't re-fire instantly
    if (lvl === 'event' && this.riotEventCd > 0) { this.riotLevel = 'warning'; return; }
    if (lvl === 'warning' && prev === 'calm' && this.riotWarnCd > 0) return;   // stay calm until cooldown elapses
    this.riotLevel = lvl;
    if (lvl === 'warning' && prev === 'calm') {
      this.riotWarnCd = RIOT_WARN_CD; this.metrics.riotWarnings++;
      this.bus.emit('alert', { type: 'warning', text: 'RIOT WARNING — tension rising' });
      this.assignGuardCheckpoints();
      const room = this.hottestRoom();          // a couple of anger bubbles in the tensest room
      if (room) this.prisonersInRoom(room).slice(0, 2).forEach((e) => this.bubble(e, '😠', 'insult', 1.4));
    } else if (lvl === 'event' && prev !== 'event') {
      this.startRiotEvent();
    } else if (lvl === 'calm' && prev !== 'calm') {
      this.bus.emit('alert', { type: 'info', text: 'Tension settling down.' });
    }
  }

  // small, controlled riot event: alarm + soft lockdown + a few prisoners flare up + guards respond
  private startRiotEvent() {
    this.riotLevel = 'event'; this.riotEventTimer = 24; this.riotEventCd = RIOT_EVENT_CD; this.metrics.riotEvents++;
    this.bus.emit('alert', { type: 'critical', text: 'RIOT — guards responding!' });
    this.addHeat(25);
    this.triggerAlarm('riot', 2);
    const room = this.hottestRoom();
    const crowd = room ? this.prisonersInRoom(room) : [];
    let flared = 0;
    for (const e of crowd) {
      const b = this.brain(e)!; if (b.isPlayer || b.state === 'down' || b.state === 'solitary') continue;
      const nd = this.ecs.get<Needs>(e, 'Needs')!; nd.anger = clamp01(nd.anger + 0.4);
      this.bubble(e, '😡', 'insult', 1.6);
      if (++flared >= 4) break;
    }
    if (!this.lockdown.active) this.startLockdown('riot', 2, room ?? undefined);
  }

  // ---------- lockdown ----------
  startLockdown(reason: string, severity = 2, sourceRoom?: string) {
    if (this.lockdown.active) {   // escalate / refresh an existing lockdown instead of duplicating
      if (severity > this.lockdown.severity) { this.lockdown.severity = severity; this.lockdown.reason = reason; }
      this.lockdown.timer = Math.max(this.lockdown.timer, LOCKDOWN_SECONDS[severity] ?? 40);
      this.bus.emit('alert', { type: 'warning', text: `Lockdown extended — ${this.lockdownReasonText(reason)}` });
      this.triggerAlarm(reason, severity);
      return;
    }
    // cooldown after a recent lockdown — only a severe (sev 3) event may break it
    if (this.lockdownCd > 0 && severity < 3) return;
    this.lockdown = { active: true, reason, severity, timer: LOCKDOWN_SECONDS[severity] ?? 40, startedAtHour: this.hour, scheduleOverride: true, sourceRoom: sourceRoom ?? '', fatigue: 0 };
    this.metrics.lockdownsStarted++; this.prog('lockdown'); this.addHeat(8 + severity * 3);
    this.triggerAlarm(reason, severity);
    this.applyDoorSchedule();
    this.orderPrisonersToCells();
    this.assignGuardCheckpoints();
    this.bus.emit('alert', { type: 'critical', text: `LOCKDOWN STARTED — ${this.lockdownReasonText(reason)}` });
  }
  private endLockdown() {
    if (!this.lockdown.active) return;
    this.lockdown.active = false; this.lockdown.scheduleOverride = false;
    this.lockdownCd = LOCKDOWN_COOLDOWN; this.metrics.lockdownsEnded++;
    this.heat = Math.max(0, this.heat - 8);
    this.applyDoorSchedule();                       // re-derive normal door states for the current phase
    // release any stale reservations / targets and re-route prisoners onto the current phase
    const ph = phaseAt(this.hour);
    for (const e of this.ecs.query('Brain', 'Agent')) {
      const b = this.brain(e)!; if (b.role !== 'prisoner' || b.isPlayer) continue;
      if (['fight', 'down', 'solitary', 'escorted', 'beingSearched'].includes(b.state)) continue;
      this.releaseFor(e); b.objTarget = undefined; if (USING_STATES.has(b.state)) b.state = 'idle';
      b.targetRoom = ph.room; b.state = 'goto'; this.ecs.get<Agent>(e, 'Agent')!.path = null;
    }
    // guards drop checkpoint posts back to patrol
    for (const e of this.ecs.query('Brain')) { const b = this.brain(e)!; if (b.role === 'guard') b.checkpoint = undefined; }
    this.bus.emit('alert', { type: 'info', text: 'LOCKDOWN LIFTED — schedule resumed' });
  }
  private lockdownReasonText(r: string) {
    return ({ fight: 'fighting on the block', contraband: 'contraband found', riot: 'unrest', escape: 'escape attempt', breach: 'restricted-area breach', suspicion: 'security alert', manual: 'security drill' } as Record<string, string>)[r] ?? r;
  }
  private orderPrisonersToCells() {
    for (const e of this.ecs.query('Brain', 'Agent', 'Position')) {
      const b = this.brain(e)!; if (b.role !== 'prisoner' || b.isPlayer) continue;
      if (['fight', 'down', 'solitary', 'escorted', 'beingSearched'].includes(b.state)) continue;
      this.releaseFor(e); b.objTarget = undefined; if (USING_STATES.has(b.state)) b.state = 'idle';
      b.targetRoom = 'cellblock'; b.state = 'goto'; this.ecs.get<Agent>(e, 'Agent')!.path = null;
      if (this.rng.chance(0.5)) this.bubble(e, this.rng.chance(0.5) ? 'Return to cell!' : '😟', 'search', 1.4);
    }
  }

  // a fight just started — bump the recent-fight tally + local tension; repeated brawls → lockdown
  private registerFight(at: Entity) {
    this.fightsRecent += 1; this.metrics.fightsStarted++;
    this.riotPressure = clamp01(this.riotPressure + 0.05);
    this.addHeat(this.brain(at)?.isPlayer ? 12 : 6);
    const room = this.roomIdAt(this.pos(at)!);
    if (room) this.tension[room] = Math.min(100, (this.tension[room] ?? 0) + 20);
    if (this.fightsRecent >= 3 && !this.lockdown.active) this.startLockdown('fight', 2, room || undefined);
  }

  // ---------- alarm ----------
  // Activating updates the reason + extends the timer; the alert only fires on the transition
  // into the alarm state (no per-event spam while it's already ringing).
  triggerAlarm(reason: string, severity = 1) {
    const wasActive = this.alarm.active;
    this.alarm.active = true; this.alarm.reason = reason; this.alarm.timer = Math.max(this.alarm.timer, 10 + severity * 5);
    this.addHeat(severity >= 2 ? 10 : 4);
    if (!wasActive) { this.metrics.alarms++; this.bus.emit('alert', { type: 'critical', text: 'ALARM ACTIVE' }); }
  }

  // ---------- area tension ----------
  private updateTension(dt: number) {
    // count prisoners + gang spread per room
    const count: Record<string, number> = {}; const gangs: Record<string, Set<string>> = {};
    for (const e of this.ecs.query('Brain', 'Position')) {
      const b = this.brain(e)!; if (b.role !== 'prisoner') continue;
      const rid = this.roomIdAt(this.pos(e)!); if (!rid) continue;
      count[rid] = (count[rid] ?? 0) + 1;
      if (b.gang) { (gangs[rid] ??= new Set()).add(b.gang); }
    }
    for (const r of this.rooms) {
      const c = count[r.id] ?? 0;
      const crowd = Math.min(40, c * (r.type === 'cafeteria' || r.type === 'yard' || r.type === 'shower' ? 7 : 4));
      const rival = this.rivalsPresent(gangs[r.id]) ? 35 : 0;
      const restricted = RESTRICTED.includes(r.type) && c > 0 ? 25 : 0;
      const tgt = Math.min(100, crowd + rival + restricted + this.riotPressure * 30);
      const cur = this.tension[r.id] ?? 0;
      this.tension[r.id] = cur + (tgt - cur) * Math.min(1, dt * 0.25);
      // rival standoff: when a tense rival room boils, a couple of inmates square up (throttled, no auto-brawl)
      if (rival && this.tension[r.id] > 55 && this.rng.chance(dt * 0.08)) this.standoff(r.id);
    }
  }
  // two rivals in a room exchange a warning (bubble) — tension, not violence
  private standoff(roomId: string) {
    const inmates = this.prisonersInRoom(roomId).filter((e) => { const b = this.brain(e)!; return b.gang && !b.bubbleCd && b.state !== 'fight' && !b.isPlayer; });
    for (const e of inmates) {
      const b = this.brain(e)!;
      const rival = inmates.find((o) => o !== e && areEnemies(b.gang, this.brain(o)!.gang));
      if (rival != null) {
        this.metrics.standoffs++;
        const rp = this.pos(rival)!, p = this.pos(e)!; p.facing = Math.atan2(rp.x - p.x, rp.z - p.z);
        this.bubble(e, this.rng.pick(['Watch it.', 'Back off.', '😠']), 'threaten', 1.4); b.bubbleCd = this.rng.range(6, 10);
        const rb = this.brain(rival)!; const guardClose = this.nearestGuard(e, 6) != null;
        // a guard nearby (or a coward) defuses it; otherwise an angry pair may square up
        const angry = (this.ecs.get<Needs>(e, 'Needs')!.anger + this.ecs.get<Needs>(rival, 'Needs')!.anger) / 2;
        if (!guardClose && angry > 0.55 && !b.traits.includes('cowardly') && !rb.traits.includes('cowardly') && this.rng.chance(0.4)) {
          this.metrics.standoffsEscalated++;
          b.state = 'fight'; b.foe = rival; b.cphase = 'squareUp'; b.cTimer = 0.4; b.attackCd = 0.4;
          rb.state = 'fight'; rb.foe = e; rb.cphase = 'squareUp'; rb.cTimer = 0.4; rb.attackCd = 0.6;
          if (b.mem) rememberFoe(b.mem, rival); if (rb.mem) rememberFoe(rb.mem, e);
          this.bus.emit('alert', { type: 'fight', text: `${b.name} and ${rb.name} square off!` });
          this.dispatchGuard(e); this.registerFight(e);
        } else { this.metrics.standoffsDefused++; }
        return;
      }
    }
  }
  private rivalsPresent(gset?: Set<string>): boolean {
    if (!gset || gset.size < 2) return false;
    const arr = [...gset];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (areEnemies(arr[i], arr[j])) return true;
    return false;
  }
  private hottestRoom(): string | null {
    let best: string | null = null, bt = 30;
    for (const r of this.rooms) { const t = this.tension[r.id] ?? 0; if (t > bt) { bt = t; best = r.id; } }
    return best;
  }
  private prisonersInRoom(roomId: string): Entity[] {
    const out: Entity[] = [];
    for (const e of this.ecs.query('Brain', 'Position')) { const b = this.brain(e)!; if (b.role === 'prisoner' && this.roomIdAt(this.pos(e)!) === roomId) out.push(e); }
    return out;
  }
  tensionAt(roomId: string): { value: number; label: string } { const v = Math.round(this.tension[roomId] ?? 0); return { value: v, label: tensionLabel(v) }; }

  // ---------- guard checkpoints ----------
  private assignGuardCheckpoints() {
    if (!this.checkpoints.length) return;
    let i = 0;
    for (const e of this.ecs.query('Brain')) {
      const b = this.brain(e)!; if (b.role !== 'guard') continue;
      if (['searching', 'escorting', 'respond'].includes(b.state)) continue;
      b.checkpoint = i % this.checkpoints.length; i++;
    }
  }

  // ---------- abstract NPC escape (rare) ----------
  private maybeNpcEscape(dt: number) {
    if (this.escape.active || this.escapeCd > 0) return;
    // rare, and only when it makes sense (yard time or chaos)
    if (!this.rng.chance(dt * 0.006)) return;
    const yardish = this.phaseId === 'yard' || this.phaseId === 'free' || this.riotLevel !== 'calm';
    if (!yardish) return;
    // a desperate prisoner near an opportunity zone
    const cand = this.ecs.query('Brain', 'Position', 'Needs').find((e) => {
      const b = this.brain(e)!; if (b.role !== 'prisoner' || b.isPlayer) return false;
      if (['fight', 'down', 'solitary', 'escorted', 'beingSearched'].includes(b.state)) return false;
      const nd = this.ecs.get<Needs>(e, 'Needs')!; if (nd.fear > 0.5 || nd.anger < 0.4) return false;
      return ESCAPE_OPPORTUNITY_ROOMS.includes(this.roomTypeAt(this.pos(e)!));
    });
    if (cand == null) return;
    const b = this.brain(cand)!;
    this.escapeCd = ESCAPE_COOLDOWN; this.metrics.escapeAttempts++;
    this.bus.emit('alert', { type: 'critical', text: `ESCAPE ATTEMPT — ${b.name} rushed the gate!` });
    this.bubble(cand, '🏃', 'insult', 2);
    this.startLockdown('escape', 2, this.roomIdAt(this.pos(cand)!));     // triggerAlarm runs inside startLockdown
    const g = this.nearestGuard(cand, 30);     // a guard runs them down → solitary
    if (g != null) this.beginEscort(g, cand, 'attempted escape'); else this.sendToSolitary(this.playerId, cand, 'attempted escape');
  }

  private updatePlayerObjective() {
    const pb = this.brain(this.playerId); const pp = this.pos(this.playerId);
    if (!pb) { this.playerObjective = ''; return; }
    const inRestricted = pp ? RESTRICTED.includes(this.roomTypeAt(pp)) : false;
    if (pb.state === 'solitary') this.playerObjective = 'In solitary — wait it out.';
    else if (this.escape.active && this.escape.by === this.playerId) this.playerObjective = 'Escape attempt in progress…';
    else if (pb.action === 'ESCAPED') this.playerObjective = 'You escaped. (Prototype ending)';
    else if (this.lockdown.active) this.playerObjective = inRestricted ? 'Leave the restricted area!' : 'Lockdown — return to your cell.';
    else if (this.riotLevel === 'event') this.playerObjective = 'Riot! Comply or take cover.';
    else if (this.alarm.active) this.playerObjective = 'Alarm active — guards are responding.';
    else if (this.riotLevel === 'warning') this.playerObjective = 'Tension rising — stay clear of crowds.';
    else if (inRestricted) this.playerObjective = 'Restricted area — you shouldn\'t be here.';
    else this.playerObjective = '';
  }

  // ---------- progression / objectives / daily summary (Stage 3.4) ----------
  // advance any active objective whose kind matches an event (and grant its reward on completion)
  private bumpObjective(kind: string, amt = 1) {
    for (const o of this.objectives) {
      if (o.done || o.kind !== kind) continue;
      o.progress = Math.min(o.goal, o.progress + amt);
      if (o.progress >= o.goal) this.completeObjective(o);
    }
  }
  private completeObjective(o: Objective) {
    o.done = true; this.progression.objectivesCompleted++; this.daily.objectivesDone++;
    const ps = this.social(this.playerId); const pinv = this.inv(this.playerId);
    if (ps && o.reward.rep) ps.reputation = clamp(ps.reputation + o.reward.rep, -100, 100);
    if (ps && o.reward.respect) ps.respect = clamp(ps.respect + o.reward.respect, 0, 100);
    if (pinv && o.reward.money) { pinv.money += o.reward.money; this.progression.moneyEarned += o.reward.money; }
    this.bus.emit('alert', { type: 'player', text: `✓ Objective: ${o.text}` });
  }
  // central progression hook (counters + objectives + daily stats). Called at event sites.
  private prog(kind: string, amt = 1) {
    const P = this.progression, D = this.daily;
    switch (kind) {
      case 'eat': case 'wash': case 'rest': case 'train': case 'talk': case 'returncell': this.bumpObjective(kind, amt); break;
      case 'job': P.jobs++; D.jobs++; this.bumpObjective('job', amt); break;
      case 'earn': P.moneyEarned += amt; this.bumpObjective('earn', amt); break;
      case 'spend': P.moneySpent += amt; break;
      case 'respect': if (amt > 0) this.bumpObjective('respect', amt); break;
      case 'fightWin': P.fights++; P.wins++; D.fights++; D.wins++; break;
      case 'fightLoss': P.fights++; P.losses++; D.fights++; break;
      case 'search': P.searches++; D.searches++; break;
      case 'contraband': P.contrabandIncidents++; D.contraband++; break;
      case 'solitary': P.solitary++; D.solitary++; break;
      case 'lockdown': P.lockdowns++; D.lockdowns++; break;
      case 'escape': P.escapes++; break;
      case 'relUp': P.relImproved++; D.relImproved++; break;
      case 'relDown': P.relWorsened++; break;
    }
  }
  private onDayRollover() {
    // resolve passive "survive the day" objectives, then summarise + roll a fresh set
    for (const o of this.objectives) if (!o.done && o.kind === 'surviveNoSolitary' && this.daily.solitary === 0) this.completeObjective(o);
    this.progression.daysSurvived++;
    const ps = this.social(this.playerId)!; const pinv = this.inv(this.playerId)!;
    this.progression.bestTier = Math.max(this.progression.bestTier, repTier(ps.reputation, ps.respect).index);
    this.pendingSummary = this.buildSummary(ps.reputation, ps.respect, pinv.money);
    this.progression.summariesShown++;
    this.lastSummaryDay = this.day;
    this.daily = newDaily(ps.reputation, ps.respect, pinv.money);
    this.objectives = rollObjectives(() => this.rng.float(), this.day);
  }
  private buildSummary(rep: number, resp: number, money: number) {
    const d = this.daily;
    return {
      day: this.day - 1, rating: dayRating(d),
      repChange: Math.round(rep - d.repStart), respChange: Math.round(resp - d.respStart), moneyChange: money - d.moneyStart,
      fights: d.fights, wins: d.wins, jobs: d.jobs, searches: d.searches, contraband: d.contraband,
      solitary: d.solitary, lockdowns: d.lockdowns, objectivesDone: d.objectivesDone, relImproved: d.relImproved,
      tier: repTier(rep, resp).name, daysSurvived: this.progression.daysSurvived
    };
  }
  takeSummary() { const s = this.pendingSummary; this.pendingSummary = null; return s; }
  tier() { const ps = this.social(this.playerId)!; return repTier(ps.reputation, ps.respect); }

  // one structured snapshot for the menus (stats / relationships / inventory / gangs / objectives)
  uiSnapshot() {
    const pl = this.playerId; const pb = this.brain(pl)!; const n = this.ecs.get<Needs>(pl, 'Needs')!; const ps = this.social(pl)!; const inv = this.inv(pl)!;
    const tier = this.tier();
    const stats = {
      name: pb.name, day: this.day, hour: this.hour, room: this.currentRoomName(pl), action: pb.action ?? pb.state,
      health: n.health, hunger: n.hunger, energy: n.energy, hygiene: n.hygiene, anger: n.anger, fear: n.fear,
      money: inv.money, suspicion: Math.round(ps.suspicion), respect: Math.round(ps.respect), reputation: Math.round(ps.reputation),
      discipline: pb.discipline ?? 'none', solitaryTimer: pb.state === 'solitary' ? Math.ceil(pb.discTimer ?? 0) : 0,
      gang: pb.gang ? GANG_MAP[pb.gang].name : 'Unaffiliated', tier: tier.name, heat: Math.round(this.heat)
    };
    const memHint = (b: Brain) => b.mem ? (b.mem.foe === pl ? 'fought you' : b.mem.threat === pl ? 'you threatened them' : b.mem.searchedT > 0 ? 'just searched' : '') : '';
    const relationships = this.ecs.query('Brain', 'Social').filter((e) => e !== pl && this.brain(e)!.role === 'prisoner').map((e) => {
      const b = this.brain(e)!; const s = this.social(e)!;
      return { id: e, name: b.name, role: b.role, gang: b.gang ? GANG_MAP[b.gang].name : '', rel: Math.round(s.rel), word: this.relWordSim(s.rel), hint: memHint(b) };
    }).sort((a, c) => c.rel - a.rel);
    const inventory = inv.items.map((id) => ({ id, name: ITEMS[id]?.name ?? id, icon: ITEMS[id]?.icon ?? '▪', contraband: isContraband(id), value: ITEMS[id]?.value ?? 0, risk: ITEMS[id]?.risk ?? 0, concealment: ITEMS[id]?.concealment ?? 0, combat: ITEMS[id]?.combat ?? 0 }));
    const gangs = GANGS.map((g) => {
      const members = this.ecs.query('Brain', 'Social').filter((e) => this.brain(e)!.gang === g.id);
      const avg = members.length ? members.reduce((s, e) => s + this.social(e)!.rel, 0) / members.length : 0;
      return { id: g.id, name: g.name, color: g.color, territory: g.territory, allies: g.allies.map((a) => GANG_MAP[a]?.name ?? a), enemies: g.enemies.map((a) => GANG_MAP[a]?.name ?? a), members: members.length, standing: this.standingWord(avg) };
    });
    return { stats, tier, progression: this.progression, objectives: this.objectives, relationships, inventory, gangs, contrabandCarried: inv.items.some(isContraband) };
  }
  private relWordSim(v: number) { return v <= -50 ? 'enemy' : v <= -15 ? 'dislikes you' : v < 15 ? 'neutral' : v < 50 ? 'friendly' : 'ally'; }
  private standingWord(v: number) { return v <= -30 ? 'threatened' : v <= -10 ? 'disliked' : v < 12 ? 'neutral' : v < 40 ? 'respected' : 'watched'; }

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

  // TODO(refactor): extract into PrisonerAISystem (schedule targeting, object use, wander) — ARCHITECTURE.md
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
      if (b.bubbleCd) b.bubbleCd = Math.max(0, b.bubbleCd - dt);
      if (b.mem) decayMemory(b.mem, dt);
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
        // re-evaluate a high-level intent occasionally (sticky — anti-twitch)
        b.intentCd = (b.intentCd ?? 0) - dt;
        if ((b.intentCd ?? 0) <= 0) {
          const ni = this.evalIntent(e, b, p);
          if (ni !== b.intent) { b.intent = ni; this.metrics.prisonerIntentChanges++; }
          b.intentCd = INTENT_STICK + this.rng.float() * 1.5;
          b.action = INTENT_LABEL[ni] ?? 'Idle';
        }
        this.actOnIntent(e, b, p, dt);
      }
    }
  }

  // build a context and pick the prisoner's intent (pure scorer in PrisonerAISystem)
  private evalIntent(e: Entity, b: Brain, p: Position): PrisonerIntent {
    const nd = this.ecs.get<Needs>(e, 'Needs')!;
    const social = ['free', 'yard', 'breakfast', 'lunch', 'dinner'].includes(this.phaseId);
    const fight = this.nearestFight(p, 6.5);
    const enemy = this.nearestEnemy(e, b, p, 5.5);
    const ally = this.nearestAlly(e, b, p, 5.5);
    const guard = this.nearestGuard(e, 4) != null;
    return choosePrisonerIntent({
      phase: this.phaseId, lockdown: this.lockdown.active, riot: this.riotLevel,
      anger: nd.anger, fear: nd.fear, enemyNear: !!enemy, fightNear: !!fight, allyNear: !!ally,
      tough: b.traits.includes('tough') || b.traits.includes('fighter') || b.traits.includes('aggressive'),
      coward: b.traits.includes('cowardly') || b.traits.includes('weak'),
      social, guardNear: guard
    }, this.rng.float());
  }
  // carry out the chosen intent (movement/state mutations)
  private actOnIntent(e: Entity, b: Brain, p: Position, dt: number) {
    const ag = this.ecs.get<Agent>(e, 'Agent')!;
    switch (b.intent as PrisonerIntent) {
      case 'returnCell':
        if (this.roomTypeAt(p) === 'cellblock') { b.state = 'idle'; break; }
        if (ag.repathCd <= 0) { this.gotoRoom(e, 'cellblock'); ag.repathCd = 1.2; b.state = 'goto'; if (!ag.path) this.blockedComplain(e, b, dt); }
        break;
      case 'fleeDanger': { const f = this.nearestFight(p, 8); if (f) this.moveAwayFrom(e, p, f.x, f.z); else b.intent = 'schedule'; const nd = this.ecs.get<Needs>(e, 'Needs'); if (nd) nd.fear = clamp01(nd.fear + dt * 0.04); break; }
      case 'avoidEnemy': { const en = this.nearestEnemy(e, b, p, 6); if (en) this.moveAwayFrom(e, p, en.x, en.z); else b.intent = 'schedule'; break; }
      case 'watchFight': { const f = this.nearestFight(p, 9); if (f) { p.facing = Math.atan2(f.x - p.x, f.z - p.z); ag.path = null; } else b.intent = 'schedule'; break; }
      case 'hide': ag.path = null; break;
      case 'comply': ag.path = null; break;
      case 'group': case 'socialize': if (!this.gotoGroup(e, b, p)) this.scheduleStep(e, b, p, dt); break;
      case 'schedule': default: this.scheduleStep(e, b, p, dt); break;
    }
  }
  // original schedule behaviour (object anchor → room → local wander)
  private scheduleStep(e: Entity, b: Brain, p: Position, dt: number) {
    const ag = this.ecs.get<Agent>(e, 'Agent')!; const here = this.roomTypeAt(p);
    if (!this.lockdown.active && ag.repathCd <= 0 && this.assignScheduleTarget(e, b, p)) { ag.repathCd = 1.2; return; }
    if (here !== b.targetRoom && ag.repathCd <= 0) {
      this.gotoRoom(e, b.targetRoom); ag.repathCd = 1.2; b.state = 'goto';
      if (!ag.path) this.blockedComplain(e, b, dt);
    } else if (here === b.targetRoom) {
      b.state = 'wander'; b.timer -= dt;
      if (b.timer <= 0) { if (this.rng.chance(0.5)) this.gotoRoom(e, b.targetRoom); b.timer = this.rng.range(2.5, 6); }
    }
  }
  private blockedComplain(e: Entity, b: Brain, dt: number) {
    this.blockedCount++; this.metrics.blockedFallbacks++;
    const nd = this.ecs.get<Needs>(e, 'Needs');
    if (!b.bubbleCd) {
      // angry inmates during a lockdown may refuse the order rather than just grumble
      const refuse = this.lockdown.active && nd && nd.anger > 0.65 && this.riotLevel !== 'calm';
      if (refuse) { this.metrics.orderRefusals++; this.bubble(e, this.rng.pick(['I\'m not going!', 'No!', '😡']), 'threaten', 1.4); }
      else this.bubble(e, this.rng.pick(['Locked!', 'Open up!', '😠', 'Let us through!']), 'insult', 1.2);
      b.bubbleCd = this.rng.range(5, 9);
    }
    if (nd) nd.anger = clamp01(nd.anger + dt * 0.03);
    b.state = 'wander';
  }
  // ---- nearby-entity scans (cheap; population ~18) + simple avoidance moves ----
  private nearestFight(p: Position, range: number): Position | null {
    let best: Position | null = null, bd = range;
    for (const e of this.ecs.query('Brain', 'Position')) { const b = this.brain(e)!; if (b.state !== 'fight') continue; const q = this.pos(e)!; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  private nearestEnemy(e: Entity, b: Brain, p: Position, range: number): Position | null {
    let best: Position | null = null, bd = range;
    for (const o of this.ecs.query('Brain', 'Position')) {
      if (o === e) continue; const ob = this.brain(o)!; if (ob.role !== 'prisoner') continue;
      const hostile = areEnemies(b.gang, ob.gang) || (b.mem && (b.mem.foe === o || b.mem.threat === o));
      if (!hostile) continue;
      const q = this.pos(o)!; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  private nearestAlly(e: Entity, b: Brain, p: Position, range: number): Entity | null {
    if (!b.gang) return null;
    let best: Entity | null = null, bd = range;
    for (const o of this.ecs.query('Brain', 'Position')) {
      if (o === e) continue; const ob = this.brain(o)!; if (ob.role !== 'prisoner' || ob.gang !== b.gang || ob.state === 'fight') continue;
      const q = this.pos(o)!; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  private moveAwayFrom(e: Entity, p: Position, fx: number, fz: number) {
    const ag = this.ecs.get<Agent>(e, 'Agent')!; if (ag.path || ag.repathCd > 0) return;
    const ang = Math.atan2(p.x - fx, p.z - fz);
    for (const dist of [4, 3, 2]) {
      const wx = p.x + Math.sin(ang) * dist, wz = p.z + Math.cos(ang) * dist;
      const idx = this.map.worldToIdx(wx, wz);
      if (idx >= 0 && this.map.walkable[idx]) { const path = this.path(this.map.worldToIdx(p.x, p.z), idx, e); if (path && path.length) { ag.path = path; ag.step = 0; ag.repathCd = 1; return; } }
    }
    p.facing = ang; ag.repathCd = 0.6;   // cornered — at least face away
  }
  // walk near a same-gang ally and form a loose cluster (separated by index)
  private gotoGroup(e: Entity, b: Brain, p: Position): boolean {
    const ag = this.ecs.get<Agent>(e, 'Agent')!; if (ag.path || ag.repathCd > 0) return true;
    const ally = this.nearestAlly(e, b, p, 10); if (ally == null) return false;
    const ap = this.pos(ally)!; if (Math.hypot(ap.x - p.x, ap.z - p.z) < 2.2) { p.facing = Math.atan2(ap.x - p.x, ap.z - p.z); ag.repathCd = 1.5; return true; }
    const off = clusterOffset((e % 5) + 1, 1.4);
    const wx = ap.x + off.dx, wz = ap.z + off.dz; const idx = this.map.worldToIdx(wx, wz);
    const goal = idx >= 0 && this.map.walkable[idx] ? idx : this.map.worldToIdx(ap.x, ap.z);
    const path = this.path(this.map.worldToIdx(p.x, p.z), goal, e);
    ag.repathCd = 1.5; if (path && path.length) { ag.path = path; ag.step = 0; this.metrics.socialInteractions++; return true; }
    return false;
  }
  // pick the nearest *reachable* free interactable for the current schedule phase; claim + route.
  // Tries candidates in distance order so one unreachable object doesn't make the NPC give up.
  private assignScheduleTarget(e: Entity, b: Brain, p: Position): boolean {
    const want = PHASE_OBJ[this.phaseId]; if (!want) return false;
    const ph = phaseAt(this.hour);
    const constrain = this.phaseId !== 'work';   // meals/sleep/yard stay in their scheduled area; jobs can be anywhere
    const start = this.map.worldToIdx(p.x, p.z); if (start < 0) return false;
    const cands = [...this.objs.values()]
      .filter((o) => want.includes(o.type)
        && !(isExclusive(o.type) && o.reservedBy && o.reservedBy !== e)
        && (!constrain || this.roomType(o.room) === ph.room))
      .sort((a, c) => (Math.hypot(a.ix - p.x, a.iz - p.z) - Math.hypot(c.ix - p.x, c.iz - p.z)))
      .slice(0, 8);                              // bound the path attempts to the nearest few
    for (const o of cands) {
      const path = this.path(start, this.map.worldToIdx(o.ix, o.iz), e);
      if (!path) continue;                       // try the next-nearest if this one is walled off
      if (isExclusive(o.type)) { o.reservedBy = e; o.reservedUntil = 30; }   // reserve only once reachable
      b.objTarget = o.id; b.action = `Heading to ${o.name}`; b.state = 'goto';
      const ag = this.ecs.get<Agent>(e, 'Agent')!; ag.path = path.length ? path : null; ag.step = 0;
      return true;
    }
    if (DEBUG && cands.length) console.debug('[sched] no reachable object', { e, phase: this.phaseId, candidates: cands.length });
    return false;
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

  // TODO(refactor): extract into GuardAISystem (patrol/respond/search/escort/posts) — ARCHITECTURE.md
  private guardAI(dt: number) {
    for (const e of this.ecs.query('Brain', 'Agent', 'Position')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'guard') continue;
      const ag = this.ecs.get<Agent>(e, 'Agent')!;
      const p = this.ecs.get<Position>(e, 'Position')!;
      ag.repathCd -= dt;

      if (b.bubbleCd) b.bubbleCd = Math.max(0, b.bubbleCd - dt);
      if (b.roleCd) b.roleCd = Math.max(0, b.roleCd - dt);

      if (b.state === 'respond' && b.foe != null) {
        this.setGuardRole(b, 'response');
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
        this.setGuardRole(b, 'search');
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
        this.setGuardRole(b, 'escort');
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
      // CHAOS: during lockdown/alarm/riot, man a checkpoint post (or push toward the tensest area in a riot)
      if (this.checkpoints.length && (this.lockdown.active || this.alarm.active || this.riotLevel !== 'calm')) {
        let dest: { x: number; z: number } | null = null;
        // in a riot, only ~half the guards converge on the hottest area; the rest hold posts (no pile-up)
        if (this.riotLevel === 'event' && (e % 2 === 0)) { const hot = this.hottestRoom(); if (hot) { const r = this.rooms.find((rr) => rr.id === hot)!; dest = this.map.toWorld(r.x + (r.w >> 1), r.y + (r.h >> 1)); this.setGuardRole(b, 'riot'); } }
        if (!dest) { if (b.checkpoint == null) b.checkpoint = e % this.checkpoints.length; dest = this.checkpoints[b.checkpoint]; this.setGuardRole(b, this.lockdown.active ? 'lockdown' : 'checkpoint'); }
        const at = Math.hypot(p.x - dest.x, p.z - dest.z) <= 1.8;
        if (at) { ag.path = null; }
        else if (!ag.path && ag.repathCd <= 0) {
          ag.repathCd = 0.8;
          const path = this.path(this.map.worldToIdx(p.x, p.z), this.map.worldToIdx(dest.x, dest.z), e);
          if (path && path.length) { ag.path = path; ag.step = 0; b.action = 'To checkpoint'; }
          else { this.metrics.guardCheckpointFails++; b.checkpoint = ((b.checkpoint ?? 0) + 1) % this.checkpoints.length; }   // post unreachable → try another
        }
        continue;
      }
      // CALM: cycle a patrol route post-by-post with a dwell at each; one guard mans the desk
      if (!ag.path) {
        b.checkpoint = undefined;
        b.dwell = (b.dwell ?? 0) - dt;
        if ((b.dwell ?? 0) > 0) {
          // dwelling at a post — face the nearest door/desk so guards look like they're watching
          this.setGuardRole(b, (e % 4 === 0) ? 'desk' : 'patrol');
          let bx = 0, bz = 0, bd = 4;
          for (const o of this.objs.values()) { if (o.type !== 'desk' && o.type !== 'door' && o.type !== 'gate') continue; const d = Math.hypot(o.ix - p.x, o.iz - p.z); if (d < bd) { bd = d; bx = o.x; bz = o.z; } }
          if (bd < 4) p.facing = Math.atan2(bx - p.x, bz - p.z);
        } else {
          this.setGuardRole(b, (e % 4 === 0) ? 'desk' : 'patrol');
          // one guard (index 0 of its route family) prefers the security desk
          if (e % 4 === 0 && this.rng.chance(0.5) && this.guardToPost(e, b, p)) { b.dwell = GUARD_DWELL + this.rng.range(0, 3); }
          else {
            const route = routeFor(b.route ?? 0);
            b.routeStep = ((b.routeStep ?? 0) + 1) % route.length;
            b.targetRoom = route[b.routeStep];
            this.gotoRoom(e, b.targetRoom);
            b.dwell = GUARD_DWELL + this.rng.range(0, 2.5);
          }
        }
      }
    }
  }
  // change a guard's role + readable action label; counts a switch for telemetry (sticky)
  private setGuardRole(b: Brain, role: GuardRole) {
    if (b.guardRole === role) return;
    b.guardRole = role; b.action = ROLE_LABEL[role]; this.metrics.guardRoleSwitches++; b.roleCd = ROLE_STICK;
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

  // ---------- combat (Stage 3.3 phase machine) ----------
  // TODO(refactor): the phase machine + resolution wrapper could move into a CombatController class.
  private combatSystem(dt: number) {
    this.fightCd -= dt;
    if (this.fightCd <= 0) { this.fightCd = this.rng.range(5, 10); this.tryStartFight(); }

    for (const e of this.ecs.query('Brain', 'Position', 'Needs')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.state === 'down') {   // knocked down — hold the pose, then get up
        b.cphase = 'down'; b.timer -= dt;
        if (b.timer <= 0) { b.state = 'idle'; b.cphase = undefined; this.ecs.get<Needs>(e, 'Needs')!.health = Math.max(0.45, this.ecs.get<Needs>(e, 'Needs')!.health); }
        continue;
      }
      if (b.blockT) b.blockT = Math.max(0, b.blockT - dt);
      if (b.state !== 'fight' || b.foe == null) { if (b.cphase) b.cphase = undefined; continue; }
      const p = this.ecs.get<Position>(e, 'Position')!;
      const fb = this.ecs.get<Brain>(b.foe, 'Brain');
      const fp = this.ecs.get<Position>(b.foe, 'Position');
      if (!fb || !fp || fb.state === 'down' || fb.state === 'solitary') { this.endFighter(e, b); continue; }
      // always face the foe + keep fighting spacing (no overlap)
      p.facing = Math.atan2(fp.x - p.x, fp.z - p.z);
      const d = Math.hypot(fp.x - p.x, fp.z - p.z);
      const reacting = b.cphase === 'hitReact' || b.cphase === 'stumble' || b.cphase === 'dodge';
      if (!reacting) {
        if (d > COMBAT_SPACING + 0.35) { const sp = Math.min(dt * 1.7, d - COMBAT_SPACING); p.x += Math.sin(p.facing) * sp; p.z += Math.cos(p.facing) * sp; }
        else if (d < COMBAT_SPACING - 0.35) { this.nudge(p, -Math.sin(p.facing) * dt * 1.2, -Math.cos(p.facing) * dt * 1.2); }
      }
      this.advanceCombat(e, b, p, b.foe, fb, fp, dt);
    }
  }
  // per-fighter phase progression: squareUp → windup → strike → recover → squareUp.
  // Reaction phases (hitReact/stumble/dodge/block) are set on the foe by doStrike and play out here.
  private advanceCombat(e: Entity, b: Brain, p: Position, foe: Entity, fb: Brain, fp: Position, dt: number) {
    b.cTimer = (b.cTimer ?? 0) - dt;
    b.attackCd -= dt;
    if (!b.cphase) b.cphase = 'squareUp';
    if ((b.cTimer ?? 0) > 0) return;   // mid-phase — let the pose play
    const inRange = Math.hypot(fp.x - p.x, fp.z - p.z) <= COMBAT_SPACING + 0.45;
    switch (b.cphase) {
      case 'windup': this.doStrike(e, b, foe, fb, fp); break;        // sets strike phase + timer
      case 'strike': b.cphase = 'recover'; b.cTimer = (b.cResult as AttackType) in ATTACKS ? ATTACKS[b.cResult as AttackType].recover : RECOVER; break;
      case 'recover': b.cphase = 'squareUp'; b.cTimer = SQUARE_UP; break;
      case 'hitReact': case 'stumble': case 'dodge': case 'block': b.cphase = 'squareUp'; b.cTimer = SQUARE_UP * 0.6; break;
      case 'squareUp': default:
        if (inRange && b.attackCd <= 0) {
          const atk = this.pickAttack(e, b);
          b.cphase = 'windup'; b.cTimer = ATTACKS[atk].windup; b.cResult = atk;
          b.attackCd = ATTACKS[atk].windup + ATTACKS[atk].recover + this.rng.range(0.2, 0.6);
          this.metrics.attacksAttempted++;
        } else {
          // defensive NPCs occasionally raise a guard between exchanges (gives blocks + a block pose)
          if (!b.isPlayer && !b.blockT && this.rng.chance(0.14)) { b.blockT = 0.7; b.cphase = 'block'; b.cTimer = 0.5; }
          else b.cTimer = SQUARE_UP * 0.5;
        }
        break;
    }
  }
  private pickAttack(e: Entity, b: Brain): AttackType {
    if (b.isPlayer && b.pendingAtk) { const a = b.pendingAtk as AttackType; b.pendingAtk = undefined; return a; }
    const n = this.ecs.get<Needs>(e, 'Needs')!;
    const weapon = (this.inv(e)?.items ?? []).map((id) => ITEMS[id]?.combat ?? 0).reduce((a, c) => Math.max(a, c), 0);
    return chooseAttack({ anger: n.anger, fear: n.fear, energy: n.energy, weapon, tough: b.traits.includes('tough'), aggressive: b.traits.includes('aggressive') }, this.rng.float());
  }
  // resolve a windup into an outcome on the foe + feedback
  private doStrike(e: Entity, b: Brain, foe: Entity, fb: Brain, fp: Position) {
    b.cphase = 'strike'; b.cTimer = 0.18;
    const atk = (b.cResult as AttackType) in ATTACKS ? (b.cResult as AttackType) : 'quick';
    const an = this.ecs.get<Needs>(e, 'Needs')!; an.energy = clamp01(an.energy - ATTACKS[atk].stamina);
    const fn = this.ecs.get<Needs>(foe, 'Needs')!;
    const def = { fear: fn.fear, energy: fn.energy, coward: fb.traits.includes('cowardly') || fb.traits.includes('weak'), blocking: !!fb.blockT };
    const outcome = resolveDefense(atk, def, this.rng.float(), this.rng.float(), this.rng.float());
    const ep = this.pos(e)!;
    if (outcome === 'miss' || outcome === 'dodged' || outcome === 'blocked') {
      this.metrics[outcome === 'blocked' ? 'blocks' : outcome === 'dodged' ? 'dodges' : 'misses']++;
      if (outcome !== 'miss') { fb.cphase = outcome === 'blocked' ? 'block' : 'dodge'; fb.cTimer = 0.3; }
      this.bus.emit('float', { x: fp.x, z: fp.z, text: OUTCOME_TEXT[outcome], color: outcome === 'blocked' ? '#9fd0ff' : '#dfe3e6' });
      if (outcome === 'blocked') this.bus.emit('impact', { x: (ep.x + fp.x) / 2, z: (ep.z + fp.z) / 2 });
      return;
    }
    // a landed hit
    this.metrics.hits++;
    const weapon = (this.inv(e)?.items ?? []).map((id) => ITEMS[id]?.combat ?? 0).reduce((a, c) => Math.max(a, c), 0);
    let dmg = this.rng.range(ATTACKS[atk].dmgMin, ATTACKS[atk].dmgMax) * (b.traits.includes('tough') ? 1.2 : 1) * (b.traits.includes('weak') ? 0.7 : 1);
    dmg += weapon * 0.02; if (outcome === 'glancing') dmg *= 0.45;
    fn.health = clamp01(fn.health - dmg);
    fb.lastAttacker = e;
    this.bus.emit('impact', { x: fp.x, z: fp.z });
    if (dmg > 0.02) this.bus.emit('float', { x: fp.x, z: fp.z, text: `-${Math.round(dmg * 100)}`, color: '#ff7a6a' });
    // knockback (path-safe) + hit reaction / stumble
    const ang = Math.atan2(fp.x - ep.x, fp.z - ep.z);
    this.nudge(fp, Math.sin(ang) * ATTACKS[atk].knockback * 0.6, Math.cos(ang) * ATTACKS[atk].knockback * 0.6);
    const heavy = ATTACKS[atk].knockback > 0.5 || dmg > 0.16;
    if (fn.health <= 0.2 || (heavy && fn.energy < 0.2)) { this.knockDown(foe, fb, e, b); }
    else { fb.cphase = heavy ? 'stumble' : 'hitReact'; fb.cTimer = heavy ? STUMBLE : HITREACT; fn.fear = clamp01(fn.fear + 0.06); }
    this.faceWatchers(fp.x, fp.z);
    this.crowdReact(fp.x, fp.z);
  }
  private knockDown(loser: Entity, lb: Brain, winner: Entity, wb: Brain) {
    lb.state = 'down'; lb.timer = DOWN_TIME; lb.foe = undefined; lb.cphase = 'down'; lb.cTimer = DOWN_TIME;
    this.ecs.get<Agent>(loser, 'Agent')!.path = null;
    wb.state = 'idle'; wb.foe = undefined; wb.cphase = undefined;
    const wn = this.ecs.get<Needs>(winner, 'Needs')!; wn.anger = clamp01(wn.anger - 0.3);
    this.metrics.knockdowns++; this.metrics.fightsEnded++;
    this.bus.emit('alert', { type: 'fight', text: `${wb.name} knocked down ${lb.name}` });
    this.onFightWin(winner, loser, wb, lb);
  }
  // disengage a fighter whose foe is gone/downed
  private endFighter(e: Entity, b: Brain) { b.state = 'idle'; b.foe = undefined; b.cphase = undefined; b.cTimer = 0; }
  // move a character by (dx,dz) but never through a wall/locked tile (clamp to current tile)
  private nudge(p: Position, dx: number, dz: number) {
    const nx = p.x + dx, nz = p.z + dz; const idx = this.map.worldToIdx(nx, nz);
    if (idx >= 0 && this.map.walkable[idx]) { p.x = nx; p.z = nz; }
  }
  // nearby inmates react to a brawl (capped + throttled): watch / cheer / flee
  private crowdReact(x: number, z: number) {
    let watchers = 0;
    for (const e of this.ecs.query('Brain', 'Position', 'Needs')) {
      if (watchers >= 5) break;
      const b = this.brain(e)!; if (b.role !== 'prisoner' || b.isPlayer || b.state === 'fight' || b.state === 'down') continue;
      const p = this.pos(e)!; const d = Math.hypot(p.x - x, p.z - z); if (d < 1.2 || d > 6) continue;
      watchers++;
      const n = this.ecs.get<Needs>(e, 'Needs')!;
      if ((b.traits.includes('cowardly') || n.fear > 0.6) && b.intent !== 'fleeDanger') { b.intent = 'fleeDanger'; b.intentCd = 2; }
      else if (!b.bubbleCd && this.rng.chance(0.04)) { this.bubble(e, this.rng.pick(['Get him!', 'Ohh!', 'Fight!', '👀']), 'insult', 1.2); b.bubbleCd = this.rng.range(4, 8); }
    }
    if (watchers >= 3) { const rid = this.roomIdAt({ x, z, facing: 0 }); if (rid) this.tension[rid] = Math.min(100, (this.tension[rid] ?? 0) + 6 * 0.05); }
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
        if (ab.mem) rememberFoe(ab.mem, bb); if (bbr.mem) rememberFoe(bbr.mem, a);   // they remember the brawl
        this.bus.emit('alert', { type: 'fight', text: `${ab.name} and ${bbr.name} are fighting!` });
        this.dispatchGuard(a);
        this.registerFight(a);
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
    const np = this.ecs.get<Position>(near, 'Position')!; const gp = this.pos(guard);
    if (gp && !this.brain(guard)!.bubbleCd) { this.bubble(guard, 'Break it up!', 'search', 1.4); this.brain(guard)!.bubbleCd = 3; }
    let broke = 0;
    for (const e of this.ecs.query('Brain', 'Position')) {
      const b = this.ecs.get<Brain>(e, 'Brain')!;
      if (b.role !== 'prisoner' || b.state !== 'fight') continue;
      const p = this.ecs.get<Position>(e, 'Position')!;
      if (Math.hypot(p.x - np.x, p.z - np.z) < 4) {
        b.state = 'idle'; b.foe = undefined; b.cphase = 'stumble'; b.cTimer = 0.5;   // shoved apart
        if (gp) { const a = Math.atan2(p.x - gp.x, p.z - gp.z); this.nudge(p, Math.sin(a) * 0.5, Math.cos(a) * 0.5); }
        const n = this.ecs.get<Needs>(e, 'Needs')!; n.anger = clamp01(n.anger - 0.4); n.fear = clamp01(n.fear + 0.2);
        const ps = this.social(e); if (ps) ps.suspicion = clamp(ps.suspicion + 8, 0, 100);
        broke++;
      }
    }
    this.metrics.fightsBrokenUp++; this.metrics.guardInterrupts++; if (broke) this.metrics.fightsEnded++;
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
  private act: { action: InteractAction; target: Entity; objId?: string; point?: { x: number; z: number }; phase: 'approach' | 'perform'; timer: number; dur: number; applied: boolean; approachT: number } | null = null;
  private static APPROACH_TIMEOUT = 9;   // seconds before a stuck approach self-cancels
  actionProgress() { return this.act && this.act.phase === 'perform' ? 1 - this.act.timer / this.act.dur : 0; }
  actionLabel() { return this.act ? this.act.action : ''; }

  // ---------- interactable objects ----------
  // TODO(refactor): extract InteractionSystem (object reservations + player action machine) — ARCHITECTURE.md
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
  // TODO(refactor): extract DoorSystem + ScheduleSystem (LockdownSystem/RiotSystem build on these) — ARCHITECTURE.md
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
      // lockdown overrides the schedule: rec areas lock, cell blocks stay reachable for "return to cell"
      if (this.lockdown.active) {
        if (lockdownLocks(rtype)) { o.open = false; o.locked = true; }
        else { o.open = rtype === 'cellblock'; o.locked = false; }
        continue;
      }
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
    this.act = { action: action as InteractAction, target: pl, objId, point: { x: o.ix, z: o.iz }, phase: 'approach', timer: dur, dur, applied: false, approachT: 0 };
    if (exclusive) { o.reservedBy = pl; o.reservedUntil = 8; }
    if (here) { this.act.phase = 'perform'; this.beginPerform(); return ''; }
    this.playerMoveToKeepAction(o.ix, o.iz);
    return `Heading to the ${o.name}…`;
  }

  // Player "convenience" needs button: route to the NEAREST REACHABLE object that supports the
  // action (rest→bed, wash→sink/shower, eat→table/counter, train→weights/pullup, work→job/shelf/…).
  requestNearestObjectAction(action: string): string {
    const pl = this.playerId; const pp = this.pos(pl); if (!pp) return '';
    const start = this.map.worldToIdx(pp.x, pp.z);
    const cands = [...this.objs.values()]
      .filter((o) => (OBJ_ACTIONS[o.type] ?? []).includes(action) && !(isExclusive(o.type) && o.reservedBy && o.reservedBy !== pl && this.alive(o.reservedBy)))
      .sort((a, b) => (Math.hypot(a.ix - pp.x, a.iz - pp.z) - Math.hypot(b.ix - pp.x, b.iz - pp.z)));
    for (const o of cands) {
      const here = Math.hypot(pp.x - o.ix, pp.z - o.iz) <= 1.5;
      if (here || this.path(start, this.map.worldToIdx(o.ix, o.iz), pl)) return this.requestObjectAction(o.id, action);
    }
    return SELF_REASON[action] ?? 'Nothing to use nearby.';
  }

  // ---------- player chaos actions (Stage 3.0) ----------
  // Returns the chaos action buttons available to the player given the current state.
  playerChaosActions(): { key: string; label: string; reason?: string; disabled?: boolean }[] {
    const out: { key: string; label: string; reason?: string; disabled?: boolean }[] = [];
    const pb = this.brain(this.playerId); if (!pb) return out;
    const chaos = this.lockdown.active || this.alarm.active || this.riotLevel !== 'calm';
    if (chaos) {
      out.push({ key: 'comply', label: 'Comply' });
      out.push({ key: 'returncell', label: 'Return to Cell' });
      out.push({ key: 'hide', label: 'Hide' });
      out.push({ key: 'calm', label: 'Calm Down' });
      if (this.nearestGuard(this.playerId, 6) != null) out.push({ key: 'helpguard', label: 'Help Guard' });
    }
    // Attempt Escape only near a valid abstract opportunity (fictional, no real methods)
    if (this.escapeOpportunity()) out.push({ key: 'escape', label: 'Attempt Escape' });
    return out;
  }
  // nearest abstract opportunity zone within reach (gate object, or being in a perimeter/service room)
  escapeOpportunity(): string | null {
    const pp = this.pos(this.playerId); if (!pp) return null;
    if (this.brain(this.playerId)?.state === 'solitary') return null;
    for (const o of this.objs.values()) if (o.type === 'gate' && Math.hypot(o.ix - pp.x, o.iz - pp.z) < 4) return o.room;
    const rt = this.roomTypeAt(pp); return ESCAPE_OPPORTUNITY_ROOMS.includes(rt) ? this.roomIdAt(pp) : null;
  }
  // immediate (in-place) chaos responses; returns a status string for the HUD
  requestChaosAction(key: string): string {
    const pl = this.playerId; const pb = this.brain(pl); const ps = this.social(pl); if (!pb || !ps) return '';
    if (pb.state === 'solitary' || pb.state === 'escorted' || pb.state === 'down') return 'You can\'t act right now.';
    switch (key) {
      case 'comply':
        this.metrics.complianceEvents++;
        ps.suspicion = clamp(ps.suspicion - 18, 0, 100); this.riotPressure = clamp01(this.riotPressure - 0.03);
        this.bubble(pl, 'Yes, sir.', 'talk', 1.0); this.floatBy(pl, 'Complied', '#9fe0a0'); return 'You comply with orders.';
      case 'returncell': {
        this.prog('returncell');
        ps.suspicion = clamp(ps.suspicion - 8, 0, 100); this.riotPressure = clamp01(this.riotPressure - 0.04);
        const r = this.requestNearestObjectAction('rest');   // route to a bed in a cell block
        return r && r.startsWith('Heading') ? 'Returning to your cell…' : (r || 'Heading to your cell…');
      }
      case 'hide': {
        const hidden = this.rng.chance(0.6);
        if (hidden) { this.bubble(pl, '🤫', 'search', 1.2); this.floatBy(pl, 'Hidden', '#9fe0a0'); return 'You keep out of sight.'; }
        ps.suspicion = clamp(ps.suspicion + 10, 0, 100); this.floatBy(pl, 'Spotted!', '#ff7a6a'); return 'A guard spots you skulking.';
      }
      case 'calm': {
        const rid = this.roomIdAt(this.pos(pl)!);
        const power = 6 + ps.respect * 0.2 + ps.reputation * 0.05;
        if (rid) this.tension[rid] = Math.max(0, (this.tension[rid] ?? 0) - power);
        this.riotPressure = clamp01(this.riotPressure - 0.03);
        this.bubble(pl, 'Easy, everyone.', 'talk', 1.2); return 'You try to calm the area down.';
      }
      case 'helpguard': {
        const g = this.nearestGuard(pl, 6);
        if (g == null) return 'No guard nearby to help.';
        ps.reputation = clamp(ps.reputation - 4, -100, 100); ps.suspicion = clamp(ps.suspicion - 6, 0, 100);
        this.riotPressure = clamp01(this.riotPressure - 0.02); this.bubble(pl, 'On it.', 'talk', 1.0);
        this.floatBy(pl, 'Snitch -Rep', '#ff7a6a'); return 'You side with the guards (other inmates notice).';
      }
    }
    return '';
  }
  // start a timed, abstract escape attempt (no real-world method — pure game action)
  requestEscape(): string {
    const pl = this.playerId; const pb = this.brain(pl)!;
    if (pb.state === 'solitary' || pb.state === 'escorted' || pb.state === 'down') return 'You can\'t act right now.';
    if (this.escapeCd > 0) return 'Too risky right now — lay low.';
    const spot = this.escapeOpportunity(); if (!spot) return 'No opportunity here.';
    if (this.act && this.act.phase === 'perform') return 'Finish what you\'re doing first.';
    this.escape = { active: true, by: pl, timer: ACTION_DUR.escape, spot, noticed: false };
    this.metrics.escapeAttempts++; this.escapeCd = ESCAPE_COOLDOWN; this.prog('escape');
    this.act = { action: 'escape', target: pl, phase: 'perform', timer: ACTION_DUR.escape, dur: ACTION_DUR.escape, applied: false, approachT: 0 };
    this.beginPerform();
    this.social(pl)!.suspicion = clamp(this.social(pl)!.suspicion + 20, 0, 100);
    this.bus.emit('alert', { type: 'warning', text: 'You make your move…' });
    return 'Attempting escape — stay unseen!';
  }
  private resolveEscape() {
    const pl = this.playerId; const pb = this.brain(pl)!; const ps = this.social(pl)!;
    const guardsNear = this.ecs.query('Brain', 'Position').filter((g) => this.brain(g)!.role === 'guard' && this.dist(g, pl) < 8).length;
    const outcome = rollEscapeOutcome(this.rng.float(), guardsNear);
    this.escape = newEscape();
    if (outcome === 'success') {
      pb.action = 'ESCAPED'; this.bus.emit('alert', { type: 'rep', text: '🚨 You slipped out — ESCAPED! (prototype ending)' });
      this.bus.emit('actionResult', { text: 'You escaped. (Prototype ending — reload to play again.)' });
      return;
    }
    this.triggerAlarm('escape', 2);
    if (outcome === 'caught') {
      this.bus.emit('actionResult', { text: 'Caught! Straight to solitary.' });
      const g = this.nearestGuard(pl, 40); if (g != null) this.beginEscort(g, pl, 'attempted escape'); else this.sendToSolitary(pl, pl, 'attempted escape');
      this.startLockdown('escape', 2, this.roomIdAt(this.pos(pl)!) || undefined);
    } else if (outcome === 'interrupted') {
      ps.suspicion = clamp(ps.suspicion + 15, 0, 100); this.bus.emit('actionResult', { text: 'Interrupted — a guard moves to search you.' });
      const g = this.nearestGuard(pl, 12); if (g != null) this.beginSearch(g, pl);
    } else {
      ps.suspicion = clamp(ps.suspicion + 6, 0, 100); this.bus.emit('actionResult', { text: 'You think better of it and back off.' });
    }
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
    this.act = { action, target: self ? pl : target, phase: self ? 'perform' : 'approach', timer: dur, dur, applied: false, approachT: 0 };
    if (self) { this.beginPerform(); return ''; }
    if (this.dist(pl, target) <= 2.6) { this.act.phase = 'perform'; this.beginPerform(); return ''; }
    // refuse to queue an interaction we can't actually walk to (behind a locked/restricted door)
    const tp = this.pos(target)!;
    if (!this.playerMoveToKeepAction(tp.x, tp.z)) {
      this.act = null; pb.action = 'Idle';
      const tr = this.roomTypeAt(tp);
      return RESTRICTED.includes(tr) ? 'They\'re in a restricted area.' : 'No route to them.';
    }
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
  // abort the queued/in-progress player action cleanly (release reservation, reset to idle, notify)
  private cancelAction(msg?: string) {
    this.releaseObj(); this.act = null;
    const pb = this.brain(this.playerId); if (pb && pb.state !== 'fight' && pb.state !== 'down') { pb.state = 'idle'; pb.action = 'Idle'; }
    this.ecs.get<Agent>(this.playerId, 'Agent')!.path = null;
    if (msg) this.bus.emit('actionResult', { text: msg });
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
      // fail-safe: never let an approach run forever (target moved behind a locked door, no route, …)
      a.approachT += dt;
      if (a.approachT > Simulation.APPROACH_TIMEOUT) { this.cancelAction('Couldn\'t reach it.'); return; }
      if (a.objId) {
        const o = this.objs.get(a.objId); if (!o) { this.cancelAction(); return; }
        const pp = this.pos(pl)!; this.faceObj(pl, o);
        if (Math.hypot(pp.x - a.point!.x, pp.z - a.point!.z) <= 1.5) { a.phase = 'perform'; a.timer = a.dur; this.beginPerform(); }
        else if (!this.ecs.get<Agent>(pl, 'Agent')!.path && !this.playerMoveToKeepAction(a.point!.x, a.point!.z)) { this.cancelAction('Path blocked.'); }
        return;
      }
      const tb = this.brain(a.target); if (!tb) { this.cancelAction(); return; }
      this.faceTo(pl, a.target);
      if (this.dist(pl, a.target) <= 2.6) { a.phase = 'perform'; a.timer = a.dur; this.beginPerform(); }
      else if (!this.ecs.get<Agent>(pl, 'Agent')!.path) { const tp = this.pos(a.target)!; if (!this.playerMoveToKeepAction(tp.x, tp.z)) this.cancelAction('Lost the route.'); }
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
      case 'rest': n.sleep = clamp01(n.sleep - 0.45); n.energy = clamp01(n.energy + 0.3); this.floatBy(pl, '+Energy', '#6dff9e'); this.prog('rest'); result = `You rest on the ${o.name}.`; break;
      case 'wash': n.hygiene = clamp01(n.hygiene - 0.55); this.floatBy(pl, '+Hygiene', '#9fcad8'); this.prog('wash'); result = `You wash up at the ${o.name}.`; break;
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
      case 'eat': n.hunger = clamp01(n.hunger - 0.55); this.floatBy(pl, 'Fed', '#e8b52e'); this.prog('eat'); result = `You eat at the ${o.name}.`; break;
      case 'train': n.energy = clamp01(n.energy - 0.15); ps.respect = clamp(ps.respect + 1, 0, 100); this.floatBy(pl, '+Respect', '#ffd24a'); this.prog('train'); this.prog('respect', 1); result = `You train on the ${o.name}.`; break;
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
    if (a.action === 'escape') { this.resolveEscape(); if (pb.state !== 'solitary' && pb.state !== 'escorted' && pb.state !== 'down') { pb.state = 'idle'; if (pb.action !== 'ESCAPED') pb.action = 'Idle'; } return; }
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
    this.searchesRecent += 1; this.metrics.searches++;   // searches add a little prison-wide tension
    if (tb.isPlayer) this.prog('search');
    const contraband = inv.items.filter(isContraband);
    let found: string | null = null;
    for (const id of contraband) { if (this.rng.float() < 0.78 - ITEMS[id].concealment * 0.6) { found = id; break; } }
    if (found) {
      inv.items.splice(inv.items.indexOf(found), 1); this.metrics.contrabandFound++; if (tb.isPlayer) this.prog('contraband');
      this.bus.emit('alert', { type: 'search', text: `Contraband found on ${tb.name}: ${ITEMS[found].name} — confiscated!` });
      this.bubble(guard, 'Found it.', 'search', 1.4); this.floatBy(target, 'Contraband!', '#ff7a6a');
      if (tb.isPlayer) ps.reputation = clamp(ps.reputation + 4, -100, 100);
      this.addHeat(ITEMS[found].risk >= 0.7 ? 18 : 8);
      if (ITEMS[found].risk >= 0.7) { this.beginEscort(guard, target, 'serious contraband'); this.startLockdown('contraband', 2, this.roomIdAt(this.pos(target)!) || undefined); return; }
      ps.suspicion = clamp(ps.suspicion - 30, 0, 100);
    } else {
      ps.suspicion = clamp(ps.suspicion - 22, 0, 100);
      this.bubble(guard, 'Clean.', 'search', 1.2); this.floatBy(target, 'Clean', '#9fe0a0');
      this.bus.emit('alert', { type: 'search', text: `${tb.name} searched — clean` });
    }
    if (tb.mem) rememberSearch(tb.mem);          // the prisoner remembers being searched
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
    if (tb.isPlayer) this.prog('solitary');
    this.bus.emit('alert', { type: 'discipline', text: `${tb.name} sent to solitary — ${reason}` });
  }

  // ---------- combat outcome ----------
  private onFightWin(winner: Entity, loser: Entity, wb: Brain, lb: Brain) {
    const ws = this.social(winner), ls = this.social(loser);
    if (ws) { ws.respect = clamp(ws.respect + 6, 0, 100); }
    if (wb.isPlayer && ws) { ws.reputation = clamp(ws.reputation + 7, -100, 100); this.bus.emit('alert', { type: 'rep', text: `You beat ${lb.name}! Respect rises.` }); }
    if (lb.isPlayer && ls) { ls.reputation = clamp(ls.reputation - 6, -100, 100); this.bus.emit('alert', { type: 'rep', text: `You were beaten by ${wb.name}.` }); this.escortLoserToInfirmaryOrSolitary(); }
    if (ls) ls.respect = clamp(ls.respect - 4, 0, 100);
    if (wb.isPlayer) this.prog('fightWin'); else if (lb.isPlayer) this.prog('fightLoss');
    // a fight always draws suspicion + a chance of being searched (winner especially)
    if (ws) ws.suspicion = clamp(ws.suspicion + 14, 0, 100);
    if (ls) ls.suspicion = clamp(ls.suspicion + 6, 0, 100);
    this.addHeat(5);
    // the loser remembers who beat them (and especially the player)
    if (lb.mem) rememberFoe(lb.mem, winner, 45);
    if (wb.isPlayer && ls) ls.rel = clamp(ls.rel - 30, -100, 100);
    // guards may discipline a fighter if seen (player, or a nearby NPC winner)
    const seen = this.nearestGuard(winner, 11);
    if (seen != null && this.rng.chance(wb.isPlayer || lb.isPlayer ? 0.55 : 0.3)) {
      this.metrics.fightDisciplines++;
      this.beginEscort(seen, wb.isPlayer ? this.playerId : winner, 'fighting');
    } else if (seen != null && this.rng.chance(0.4)) { this.beginSearch(seen, winner); }
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
        this.prog('talk'); if (ts) this.prog('relUp');
        return tb.role === 'guard' ? `${tb.name}: "Keep moving, inmate."` : `${tb.name}: "${this.smalltalk(tb)}"`;
      case 'comply':
        ps.suspicion = clamp(ps.suspicion - 15, 0, 100); return `${tb.name}: "Smart choice."`;
      case 'argue':
        ps.suspicion = clamp(ps.suspicion + 12, 0, 100); ps.reputation = clamp(ps.reputation + 2, -100, 100); return `You argue with ${tb.name}. Suspicion rises.`;
      case 'insult': {
        if (ts) ts.rel = clamp(ts.rel - 18, -100, 100);
        if (tb.mem) rememberThreat(tb.mem, pl);    // they'll avoid/retaliate against you later
        ps.reputation = clamp(ps.reputation + 2, -100, 100);
        const aggr = tb.traits.includes('aggressive') || (ts ? ts.respect : 0) > ps.respect + 10;
        if (aggr && this.rng.chance(0.6)) { this.startPlayerFight(target); return `${tb.name} takes a swing at you!`; }
        return `You insult ${tb.name}. They glare back.`;
      }
      case 'threaten': {
        if (tb.mem) rememberThreat(tb.mem, pl);
        const win = ps.respect + ps.reputation * 0.3 + this.tier().index * 6 > (ts ? ts.respect : 30);
        if (win || tb.traits.includes('cowardly')) { if (ts) { ts.rel = clamp(ts.rel - 8, -100, 100); } ps.reputation = clamp(ps.reputation + 4, -100, 100); this.ecs.get<Needs>(target, 'Needs')!.fear = clamp01(this.ecs.get<Needs>(target, 'Needs')!.fear + 0.3); return `${tb.name} backs down.`; }
        ps.reputation = clamp(ps.reputation - 2, -100, 100);
        if (this.rng.chance(0.5)) { this.startPlayerFight(target); return `${tb.name} calls your bluff — fight!`; }
        return `${tb.name}: "You don't scare me."`;
      }
      case 'favor': {
        // higher standing tiers make inmates more willing to help
        const ok = (ts ? ts.rel : 0) > 10 || this.rng.chance(0.4 + ps.reputation * 0.003 + this.tier().index * 0.05);
        if (ok) { const pinv = this.inv(pl)!; if (this.rng.chance(0.5)) pinv.items.push(this.rng.pick(ITEM_IDS)); else { const m = this.rng.int(2, 6); pinv.money += m; this.prog('earn', m); } if (ts) ts.rel = clamp(ts.rel + 4, -100, 100); this.prog('relUp'); return `${tb.name} does you a favor.`; }
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
        this.prog('spend', price); this.prog('relUp');
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
    pb.state = 'fight'; pb.foe = target; pb.attackCd = 0.3; pb.action = 'Fighting'; pb.cphase = 'squareUp'; pb.cTimer = 0.4;
    tb.state = 'fight'; tb.foe = pl; tb.attackCd = 0.5; tb.cphase = 'squareUp'; tb.cTimer = 0.4;
    if (tb.mem) rememberFoe(tb.mem, pl);
    this.bus.emit('alert', { type: 'fight', text: `Fight: You vs ${tb.name}!` });
    this.dispatchGuard(pl);
    this.registerFight(pl);
  }

  // ---------- player combat actions (Stage 3.3) ----------
  // contextual fight buttons: only while fighting, or when standing next to a hostile inmate
  playerCombatActions(): { key: string; label: string }[] {
    const pl = this.playerId; const pb = this.brain(pl); if (!pb) return [];
    if (pb.state === 'fight') return [
      { key: 'strike', label: 'Strike' }, { key: 'heavy', label: 'Heavy' }, { key: 'shove', label: 'Shove' },
      { key: 'block', label: 'Block' }, { key: 'backoff', label: 'Back Off' }
    ];
    return [];
  }
  // queue a combat input for the player's next phase / set a block window / disengage
  requestCombatAction(key: string): string {
    const pl = this.playerId; const pb = this.brain(pl)!; if (pb.state !== 'fight') return '';
    this.metrics.playerCombatChoices++;
    switch (key) {
      case 'strike': pb.pendingAtk = 'quick'; pb.attackCd = Math.min(pb.attackCd, 0); return 'Strike!';
      case 'heavy': pb.pendingAtk = 'heavy'; pb.attackCd = Math.min(pb.attackCd, 0); return 'Heavy swing!';
      case 'shove': pb.pendingAtk = 'shove'; pb.attackCd = Math.min(pb.attackCd, 0); return 'Shove!';
      case 'block': pb.blockT = 0.9; pb.cphase = 'block'; pb.cTimer = 0.5; this.bubble(pl, '🛡️', 'search', 0.8); return 'Blocking.';
      case 'backoff': { const foe = pb.foe; this.endFighter(pl, pb); pb.action = 'Idle'; if (foe != null) { const fb = this.brain(foe); if (fb && fb.state === 'fight') { fb.state = 'idle'; fb.foe = undefined; fb.cphase = undefined; } } this.social(pl)!.reputation = clamp(this.social(pl)!.reputation - 1, -100, 100); return 'You back off.'; }
    }
    return '';
  }

  private smalltalk(tb: Brain): string {
    const lines = ['Stay out of the showers after dinner.', 'Guards been on edge lately.', "Don't trust the Yard Kings.", 'You got smokes?', 'Keep your head down, fish.', 'Heard there\'s a search coming.'];
    return this.rng.pick(lines);
  }

  // self/object interactions (bed/sink/cafeteria/yard/job stations)
  selfAction(action: InteractAction): string {
    const pl = this.playerId; const n = this.ecs.get<Needs>(pl, 'Needs')!; const pb = this.brain(pl)!; const room = this.roomTypeAt(this.pos(pl)!);
    switch (action) {
      case 'rest': n.sleep = clamp01(n.sleep - 0.4); n.energy = clamp01(n.energy + 0.3); pb.action = 'Resting'; this.prog('rest'); return 'You rest. Energy restored.';
      case 'wash': n.hygiene = clamp01(n.hygiene - 0.5); pb.action = 'Washing'; this.prog('wash'); return 'You clean up.';
      case 'eat': n.hunger = clamp01(n.hunger - 0.5); pb.action = 'Eating'; this.prog('eat'); return 'You eat a meal.';
      case 'train': n.energy = clamp01(n.energy - 0.15); { const s = this.social(pl)!; s.respect = clamp(s.respect + 1, 0, 100); } pb.action = 'Training'; this.prog('train'); this.prog('respect', 1); return 'You train. Respect rises slightly.';
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
    this.prog('job'); this.prog('earn', job.money); if (job.respect > 0) this.prog('respect', job.respect);
    this.bus.emit('alert', { type: 'job', text: `${job.verb} — +$${job.money}` });
    return `${job.verb}. Earned $${job.money}.`;
  }

  // ---------- debug self-test (?debug) — read-only invariant check, never mutates live state ----------
  selfTest() {
    const arr = [...this.objs.values()];
    const has = (t: string) => arr.some((o) => o.type === t);
    let doorsMapped = true;
    for (const o of arr) if (o.type === 'door' || o.type === 'gate') { if (this.doorTiles.get(this.map.worldToIdx(o.x, o.z)) !== o.id) doorsMapped = false; }
    // can a prisoner NPC path to at least one schedule object of the current phase?
    let npcPathOk = false; const want = PHASE_OBJ[this.phaseId] ?? [];
    const npc = this.ecs.query('Brain', 'Position').find((e) => { const b = this.brain(e)!; return b.role === 'prisoner' && !b.isPlayer; });
    if (npc != null && want.length) {
      const p = this.pos(npc)!; const start = this.map.worldToIdx(p.x, p.z);
      for (const o of arr) { if (want.includes(o.type) && this.path(start, this.map.worldToIdx(o.ix, o.iz), npc)) { npcPathOk = true; break; } }
    } else npcPathOk = !want.length;            // nothing required this phase
    let saveOk = true; try { const s = JSON.parse(JSON.stringify(this.serialize())); saveOk = Array.isArray(s.ents) && s.ents.length > 0 && !!s.lockdown; } catch { saveOk = false; }
    // chaos invariants (read-only): a guard can reach a checkpoint; riot/lockdown state is well-formed
    let guardToCheckpoint = false;
    const guard = this.ecs.query('Brain', 'Position').find((e) => this.brain(e)!.role === 'guard');
    if (guard != null && this.checkpoints.length) {
      const gp = this.pos(guard)!; const start = this.map.worldToIdx(gp.x, gp.z);
      for (const cp of this.checkpoints) if (this.path(start, this.map.worldToIdx(cp.x, cp.z), guard)) { guardToCheckpoint = true; break; }
    }
    let lockdownSane = true; try { sanitizeLockdown(this.serialize().lockdown); } catch { lockdownSane = false; }
    // AI invariants (Stage 3.2): guards carry a role, prisoners carry an intent + memory
    let guardsWithRole = 0, guards = 0, prisonersWithIntent = 0, prisoners = 0;
    for (const e of this.ecs.query('Brain')) {
      const b = this.brain(e)!;
      if (b.role === 'guard') { guards++; if (b.guardRole) guardsWithRole++; }
      else { prisoners++; if (b.intent && b.mem) prisonersWithIntent++; }
    }
    return {
      playerOk: this.brain(this.playerId)?.isPlayer === true,
      mapOk: !!this.map && this.map.width > 0,
      interactables: this.objs.size,
      hasBed: has('bed'), hasSink: has('sink'), hasTable: has('table'), hasDoor: has('door'), hasGate: has('gate'),
      doorsMapped, npcPathOk, saveOk,
      checkpoints: this.checkpoints.length, guardToCheckpoint,
      riotPressureValid: typeof this.riotPressure === 'number' && isFinite(this.riotPressure),
      riotLevel: this.riotLevel, lockdownSane,
      guardsHaveRole: guards > 0 && guardsWithRole === guards,
      prisonersHaveIntent: prisoners > 0 && prisonersWithIntent === prisoners,
      progressionOk: !!this.progression && typeof this.progression.daysSurvived === 'number',
      objectivesOk: this.objectives.length > 0,
      tierOk: typeof this.tier().name === 'string',
      snapshotOk: (() => { try { const s = this.uiSnapshot(); return !!s.stats && Array.isArray(s.objectives) && Array.isArray(s.relationships); } catch { return false; } })(),
      metrics: this.metrics
    };
  }

  // ---------- save/load ----------
  // TODO(refactor): extract serialize/hydrate into a SaveSerializer with explicit version migrations
  // (see docs/ARCHITECTURE.md "Future refactor candidates").
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
    const chaos = {
      lockdown: this.lockdown,
      alarm: this.alarm,
      heat: this.heat,
      riotPressure: this.riotPressure,
      tension: this.tension
    };
    const prog = { progression: this.progression, objectives: this.objectives, daily: this.daily, lastSummaryDay: this.lastSummaryDay };
    return { version: 8, seed: this.rng.seed, day: this.day, hour: this.hour, phaseId: this.phaseId, ents, objs, ...chaos, ...prog };
  }
  hydrate(data: any) {
    // never crash on an old/foreign/corrupt save — bail out and keep the freshly generated world
    if (!data || !Array.isArray(data.ents) || !data.ents.length) return;
    this.ecs = new ECS();
    this.act = null; this.fightCd = 6; this.suspTimer = 0;
    this.day = (typeof data.day === 'number' && data.day > 0) ? data.day : 1;
    this.hour = (typeof data.hour === 'number' && isFinite(data.hour)) ? data.hour : 6;
    this.phaseId = typeof data.phaseId === 'string' ? data.phaseId : 'wake';
    this.playerId = 0;
    const num = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
    const safeState = (s: string) => (s === 'solitary' ? 'solitary' : 'idle');
    for (const r of data.ents) {
      if (!r || !r.pos || !r.brain || !r.render) continue;   // skip malformed records
      const e = this.ecs.create();
      this.ecs.set<Position>(e, 'Position', { x: num(r.pos.x, 0), z: num(r.pos.z, 0), facing: num(r.pos.facing, 0) });
      this.ecs.set<Render>(e, 'Render', { kind: r.render.kind === 'guard' ? 'guard' : 'prisoner', color: num(r.render.color, 0xc98a3a), meshId: e });
      this.ecs.set<Agent>(e, 'Agent', { speed: num(r.agent?.speed, 2), path: null, step: 0, repathCd: 0 });
      this.ecs.set<Needs>(e, 'Needs', r.needs ?? { hunger: 0, sleep: 0, hygiene: 0, energy: 1, anger: 0, fear: 0, health: 1 });
      this.ecs.set<Brain>(e, 'Brain', { ...r.brain, role: r.brain.role === 'guard' ? 'guard' : 'prisoner', traits: Array.isArray(r.brain.traits) ? r.brain.traits : [], targetRoom: r.brain.targetRoom ?? 'cellblock', attackCd: 0, timer: 0, foe: undefined, escortTarget: undefined, actTimer: undefined, objTarget: undefined, state: safeState(r.brain.state), action: 'Idle', intent: 'schedule', intentCd: 0, checkpoint: undefined, dwell: 0, roleCd: 0, bubbleCd: 0, guardRole: r.brain.role === 'guard' ? 'patrol' : undefined, mem: r.brain.role === 'guard' ? undefined : sanitizeMemory(r.brain.mem), cphase: undefined, cTimer: 0, cResult: undefined, blockT: 0, pendingAtk: undefined, lastAttacker: undefined });
      this.ecs.set<Social>(e, 'Social', r.social ?? { reputation: 0, respect: 20, suspicion: 0, rel: 0 });
      this.ecs.set<Inventory>(e, 'Inventory', { items: Array.isArray(r.inv?.items) ? r.inv.items.filter((id: any) => typeof id === 'string') : [], money: num(r.inv?.money, 0) });
      if (r.isPlayer || r.brain.isPlayer) this.playerId = e;
    }
    // if the saved player id was missing, promote the first prisoner and mark them as the player
    if (!this.playerId) {
      this.playerId = this.ecs.query('Brain').find((e) => this.ecs.get<Brain>(e, 'Brain')!.role === 'prisoner') ?? 0;
      const pb = this.brain(this.playerId);
      if (pb) { pb.isPlayer = true; pb.name = 'You'; pb.action = 'Idle'; const r = this.ecs.get<Render>(this.playerId, 'Render'); if (r) r.color = 0xef7a22; }
    }
    // restore chaos state defensively (escape is always reset to a stable state on load)
    this.lockdown = sanitizeLockdown(data.lockdown);
    this.alarm = { active: !!data.alarm?.active, timer: num(data.alarm?.timer, 0), reason: typeof data.alarm?.reason === 'string' ? data.alarm.reason : '' };
    this.heat = clamp(num(data.heat, 0), 0, 100);
    this.riotPressure = clamp01(num(data.riotPressure, 0));
    this.riotLevel = riotLevelHyst(this.riotPressure, 'calm');
    this.riotEventTimer = 0; this.escape = newEscape();
    this.fightsRecent = 0; this.searchesRecent = 0; this.blockedCount = 0;
    this.lockdownCd = 0; this.riotWarnCd = 0; this.riotEventCd = 0; this.escapeCd = 0; this.heatEventTimer = 0;
    this.tension = {}; for (const r of this.rooms) this.tension[r.id] = (data.tension && typeof data.tension[r.id] === 'number') ? clamp(data.tension[r.id], 0, 100) : 0;
    if (!this.checkpoints.length) this.checkpoints = buildCheckpoints(this.rooms as any, (i) => this.map.tileXY(i), (x, y) => this.map.toWorld(x, y));

    // progression / objectives (defaults for older saves that lack them)
    this.progression = sanitizeProgression(data.progression);
    const ps2 = this.social(this.playerId); const pinv2 = this.inv(this.playerId);
    this.objectives = Array.isArray(data.objectives) && data.objectives.length
      ? data.objectives.map((o: any) => ({ id: String(o?.id ?? ''), text: String(o?.text ?? ''), kind: String(o?.kind ?? ''), goal: +o?.goal || 1, progress: +o?.progress || 0, done: !!o?.done, reward: (o && typeof o.reward === 'object') ? o.reward : {} }))
      : rollObjectives(() => this.rng.float(), this.day);
    this.daily = (data.daily && typeof data.daily === 'object') ? data.daily : newDaily(ps2?.reputation ?? 0, ps2?.respect ?? 8, pinv2?.money ?? 0);
    this.lastSummaryDay = typeof data.lastSummaryDay === 'number' ? data.lastSummaryDay : 0;
    this.pendingSummary = null;

    // reset object reservations, derive door states for the loaded phase (respects restored lockdown), then restore saved overrides
    for (const o of this.objs.values()) { o.reservedBy = 0; o.reservedUntil = 0; o.stash = []; o.open = !o.restricted; o.locked = false; }
    this.applyDoorSchedule();
    if (data.objs && typeof data.objs === 'object') for (const id in data.objs) {
      const o = this.objs.get(id); const s = data.objs[id];          // invalid/removed object ids are ignored safely
      if (!o || !s || typeof s !== 'object') continue;
      o.stash = Array.isArray(s.stash) ? s.stash.filter((x: any) => typeof x === 'string') : [];
      if (typeof s.open === 'boolean') o.open = s.open;
      if (typeof s.locked === 'boolean') o.locked = s.locked;
    }
  }
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
