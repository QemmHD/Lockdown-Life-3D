import * as THREE from 'three';
import { CharacterRig } from './CharacterFactory';
import { CollisionWorld } from '../world/Collision';
import { computePath, wanderPoint, Vec2 } from '../world/Navigation';
import { FACTIONS } from '../data/factions';
import { ROOM_MAP, roomAt } from '../data/rooms';
import type { NPCDef } from '../game/types';

export type AIState = 'schedule' | 'flee' | 'fight' | 'fightNPC' | 'approach' | 'down';

// Deterministic per-id PRNG so each named NPC's randomization stays consistent across save/load.
function seedFrom(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// shade-shift a hex colour by +/- amount per channel
function tint(color: number, rng: () => number, amt = 28): number {
  let r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  const d = () => Math.round((rng() * 2 - 1) * amt);
  r = Math.max(0, Math.min(255, r + d())); g = Math.max(0, Math.min(255, g + d())); b = Math.max(0, Math.min(255, b + d()));
  return (r << 16) | (g << 8) | b;
}

const INMATE_SUITS = [0x3a6ea5, 0x4a7a55, 0x8a6a3a, 0x7a4a6a, 0x556070, 0x6a5a8a, 0x9a5a3a, 0x4a6a6a];
const SKIN_POOL = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x6b4423];
const HAIR_POOL = [0x2b1d0e, 0x000000, 0x5a3a1a, 0x888888, 0xd9b382, 0xb33a2a];
const HAIR_STYLES = ['short', 'bald', 'mohawk', 'cap', 'beanie', 'long'] as const;
const ACCENTS = ['none', 'beard', 'glasses', 'scar'] as const;

export interface NPCContext {
  px: number; pz: number;
  dt: number; time: number;
  lockdown: boolean;
  requiredRoom: string;       // where inmates should be this phase
  phase: string;              // current schedule phase id
  alarm: boolean;             // guards converge
  alarmX: number; alarmZ: number;
}

export class NPC {
  def: NPCDef;
  rig: CharacterRig;
  x = 0; z = 0;
  vx = 0; vz = 0;
  radius = 0.5;
  health: number;
  maxHealth: number;
  ai: AIState = 'schedule';
  koTimer = 0;
  attackCd = 0;
  path: Vec2[] = [];
  targetRoom: string;
  wanderTimer = 0;
  repathTimer = 0;
  combatTarget: 'player' | null = null;
  fleeTarget: Vec2 | null = null;
  speakTimer = 0;
  hostile = false; // currently aggro on player
  dead = false;
  deathTimer = 0;          // counts up after death; Game removes the body when it elapses
  npcFoe: NPC | null = null; // current NPC-vs-NPC brawl target
  base: { health: number; aggression: number; fear: number; respect: number; loyalty: number; strength: number };

  constructor(def: NPCDef, private collision: CollisionWorld) {
    this.def = def;
    const rng = seedFrom('lockdown_' + def.id);
    const jit01 = (v: number, a = 0.28) => clamp01(v + (rng() * 2 - 1) * a);

    // randomized per-NPC stats (seeded → stable across reloads)
    this.base = {
      health: Math.round(def.base.health * (0.85 + rng() * 0.4)),
      aggression: jit01(def.base.aggression),
      fear: jit01(def.base.fear),
      respect: jit01(def.base.respect, 0.2),
      loyalty: jit01(def.base.loyalty, 0.2),
      strength: Math.max(1, Math.round(def.base.strength + (rng() * 2 - 1) * 2.5))
    };
    this.health = this.base.health;
    this.maxHealth = this.base.health;
    this.targetRoom = def.spawnRoom;
    const f = FACTIONS[def.faction];

    // randomized clothing & looks
    const isGuard = def.faction === 'guards', isStaff = def.faction === 'staff';
    const uniform = isGuard ? tint(0x2c3e50, rng, 14)
      : isStaff ? tint(0x16a085, rng, 16)
      : tint(INMATE_SUITS[Math.floor(rng() * INMATE_SUITS.length)], rng, 22);
    // staff/guards keep curated looks; inmates get more variety
    const skin = (!isGuard && !isStaff && rng() < 0.5) ? SKIN_POOL[Math.floor(rng() * SKIN_POOL.length)] : def.skin;
    const hair = (!isGuard && !isStaff && rng() < 0.5) ? HAIR_POOL[Math.floor(rng() * HAIR_POOL.length)] : def.hair;
    const hairStyle = (!isGuard && rng() < 0.35) ? HAIR_STYLES[Math.floor(rng() * HAIR_STYLES.length)] : def.hairStyle;
    const accent = (!isGuard && !isStaff && rng() < 0.4) ? ACCENTS[Math.floor(rng() * ACCENTS.length)] : (def.accent ?? 'none');
    const height = def.height * (0.94 + rng() * 0.12);

    this.rig = new CharacterRig({
      height,
      skin,
      hair,
      hairStyle: hairStyle as any,
      uniform,
      accentColor: f.color,
      guard: isGuard,
      staff: isStaff,
      accent: accent as any,
      showRing: true,
      ringColor: f.color
    });
  }

  setPos(x: number, z: number) { this.x = x; this.z = z; this.rig.group.position.set(x, 0, z); }

  get ko() { return this.koTimer > 0; }
  get isGuard() { return this.def.faction === 'guards'; }
  get isStaff() { return this.def.faction === 'staff'; }

  knockout(sec: number) {
    this.koTimer = sec;
    this.ai = 'down';
    this.combatTarget = null;
    this.npcFoe = null;
    this.hostile = false;
    this.rig.setState('ko');
  }

  // One life: when an inmate dies they fall and are gone for good.
  die() {
    this.dead = true;
    this.deathTimer = 0;
    this.koTimer = 0;
    this.ai = 'down';
    this.combatTarget = null;
    this.npcFoe = null;
    this.hostile = false;
    this.health = 0;
    this.rig.setState('ko');
    this.rig.setRingColor(0x550000);
  }

  consumeNpcAttack(): boolean {
    if ((this as any)._npcAttack) { (this as any)._npcAttack = false; return true; }
    return false;
  }

  // Animation that fits what you'd be doing in this room/phase — makes the prison feel alive.
  private roomActivityAnim(ctx: NPCContext): 'idle' | 'eat' | 'train' | 'sleep' | 'interact' {
    const r = this.targetRoom;
    if ((ctx.phase === 'sleep' || ctx.phase === 'lockdown') && r === 'cellblock') return 'sleep';
    if (r === 'cafeteria' && ['breakfast', 'lunch', 'dinner'].includes(ctx.phase)) return 'eat';
    if ((r === 'gym' || r === 'yard') && Math.random() < 0.5) return 'train';
    if (r === 'workshop' || r === 'kitchen' || r === 'laundry') return 'interact';
    return 'idle';
  }

  takeHit() { if (!this.ko) this.rig.setState('hit'); }

  distTo(x: number, z: number) { return Math.hypot(this.x - x, this.z - z); }

  private moveToward(p: Vec2, dt: number, speed: number): boolean {
    const dx = p.x - this.x, dz = p.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) { this.vx = 0; this.vz = 0; return true; }
    const tvx = (dx / d) * speed, tvz = (dz / d) * speed;
    this.vx = THREE.MathUtils.lerp(this.vx, tvx, Math.min(1, dt * 8));
    this.vz = THREE.MathUtils.lerp(this.vz, tvz, Math.min(1, dt * 8));
    const r = this.collision.resolve(this.x + this.vx * dt, this.z + this.vz * dt, this.radius);
    // stuck detection
    const moved = Math.hypot(r.x - this.x, r.z - this.z);
    this.x = r.x; this.z = r.z;
    this.rig.facing = Math.atan2(this.vx, this.vz);
    if (moved < 0.01) return true; // treat as reached to repath
    return false;
  }

  setTargetRoom(room: string) {
    if (this.targetRoom !== room) {
      this.targetRoom = room;
      this.path = computePath(this.x, this.z, room);
    }
  }

  update(ctx: NPCContext) {
    const dt = ctx.dt;
    if (this.dead) { this.deathTimer += dt; this.rig.update(dt, 0); return; }
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.speakTimer > 0) this.speakTimer -= dt;

    // drop NPC brawl if the foe is gone/down
    if (this.npcFoe && (this.npcFoe.ko || this.npcFoe.dead)) { this.npcFoe = null; if (this.ai === 'fightNPC') this.ai = 'schedule'; }

    if (this.ko) {
      this.koTimer -= dt;
      this.rig.update(dt, 0);
      if (this.koTimer <= 0) {
        this.health = Math.max(this.maxHealth * 0.4, this.health);
        this.ai = 'schedule';
        this.rig.setState('idle');
      }
      return;
    }

    const speedBase = this.isGuard ? 4.2 : 3.4 + this.base.strength * 0.05;

    // FIGHT
    if (this.ai === 'fight' && this.combatTarget === 'player') {
      const d = this.distTo(ctx.px, ctx.pz);
      this.rig.facing = Math.atan2(ctx.px - this.x, ctx.pz - this.z);
      if (d > 1.6) {
        this.moveToward({ x: ctx.px, z: ctx.pz }, dt, speedBase * 1.2);
        this.rig.setState('walk');
      } else {
        this.vx = this.vz = 0;
        if (this.attackCd <= 0 && !this.rig.isBusy()) {
          this.rig.setState('punch');
          this.attackCd = 1.1 - this.base.aggression * 0.4;
          (this as any)._didAttack = true;
        }
      }
      this.rig.update(dt, 1);
      return;
    }

    // NPC vs NPC brawl (random encounters that play out in the world)
    if (this.ai === 'fightNPC' && this.npcFoe) {
      const foe = this.npcFoe;
      const d = this.distTo(foe.x, foe.z);
      this.rig.facing = Math.atan2(foe.x - this.x, foe.z - this.z);
      if (d > 1.5) {
        this.moveToward({ x: foe.x, z: foe.z }, dt, speedBase * 1.1);
        this.rig.setState('walk');
      } else {
        this.vx = this.vz = 0;
        if (this.attackCd <= 0 && !this.rig.isBusy()) {
          this.rig.setState('punch');
          this.attackCd = 1.2 - this.base.aggression * 0.4;
          (this as any)._npcAttack = true;
        }
      }
      this.rig.update(dt, 1);
      return;
    }

    // FLEE
    if (this.ai === 'flee') {
      if (!this.fleeTarget) {
        const away = Math.atan2(this.x - ctx.px, this.z - ctx.pz);
        this.fleeTarget = { x: this.x + Math.sin(away) * 14, z: this.z + Math.cos(away) * 14 };
      }
      const reached = this.moveToward(this.fleeTarget, dt, speedBase * 1.5);
      this.rig.setState('sprint');
      if (reached || this.distTo(ctx.px, ctx.pz) > 16) { this.ai = 'schedule'; this.fleeTarget = null; }
      this.rig.update(dt, 1);
      return;
    }

    // GUARD: respond to alarm
    if (this.isGuard && ctx.alarm) {
      this.setTargetRoom(roomAt(ctx.alarmX, ctx.alarmZ).id);
    } else {
      // SCHEDULE target selection
      this.repathTimer -= dt;
      const desired = this.desiredRoom(ctx);
      if (desired !== this.targetRoom && this.repathTimer <= 0) {
        this.setTargetRoom(desired);
        this.repathTimer = 1.5;
      }
    }

    // follow path
    if (this.path.length > 0) {
      const reached = this.moveToward(this.path[0], dt, speedBase);
      if (reached) this.path.shift();
      this.rig.setState(Math.hypot(this.vx, this.vz) > 0.4 ? 'walk' : 'idle');
    } else {
      // wander within current room
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.path = [wanderPoint(this.targetRoom)];
        this.wanderTimer = 3 + Math.random() * 4;
      }
      this.vx = THREE.MathUtils.lerp(this.vx, 0, dt * 6);
      this.vz = THREE.MathUtils.lerp(this.vz, 0, dt * 6);
      if (!this.rig.isBusy()) this.rig.setState(this.roomActivityAnim(ctx));
    }
    this.rig.update(dt, 1);
  }

  private desiredRoom(ctx: NPCContext): string {
    if (this.isStaff) return this.def.spawnRoom; // doctor/cook/warden stay put
    if (this.isGuard) {
      // patrol: rotate among a small route based on id hash + time
      const route = ['hallway', 'cellblock', 'yard', 'cafeteria', 'walkway', 'gym'];
      const idx = Math.floor((ctx.time * 0.5 + this.def.id.length) % route.length);
      if (ctx.lockdown) return 'walkway';
      return route[idx];
    }
    // inmates
    if (ctx.lockdown) return 'cellblock';
    // free phases gravitate to faction territory
    const free = ['yard', 'gym', 'shower'].includes(ctx.requiredRoom) || ctx.requiredRoom === '';
    const terr = FACTIONS[this.def.faction]?.territory ?? [];
    if (free && terr.length > 0) {
      return terr[Math.floor((this.def.id.length) % terr.length)];
    }
    return ctx.requiredRoom || this.def.spawnRoom;
  }

  consumeAttack(): boolean {
    if ((this as any)._didAttack) { (this as any)._didAttack = false; return true; }
    return false;
  }
}
