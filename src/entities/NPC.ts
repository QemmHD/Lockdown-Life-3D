import * as THREE from 'three';
import { CharacterRig } from './CharacterFactory';
import { CollisionWorld } from '../world/Collision';
import { computePath, wanderPoint, Vec2 } from '../world/Navigation';
import { FACTIONS } from '../data/factions';
import { ROOM_MAP, roomAt } from '../data/rooms';
import type { NPCDef } from '../game/types';

export type AIState = 'schedule' | 'flee' | 'fight' | 'approach' | 'down';

export interface NPCContext {
  px: number; pz: number;
  dt: number; time: number;
  lockdown: boolean;
  requiredRoom: string;       // where inmates should be this phase
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

  constructor(def: NPCDef, private collision: CollisionWorld) {
    this.def = def;
    this.health = def.base.health;
    this.maxHealth = def.base.health;
    this.targetRoom = def.spawnRoom;
    const f = FACTIONS[def.faction];
    this.rig = new CharacterRig({
      height: def.height,
      skin: def.skin,
      hair: def.hair,
      hairStyle: def.hairStyle,
      uniform: def.faction === 'guards' ? 0x2c3e50 : def.faction === 'staff' ? 0x16a085 : 0x3a6ea5,
      accentColor: f.color,
      guard: def.faction === 'guards',
      staff: def.faction === 'staff',
      accent: def.accent,
      showRing: true,
      ringColor: f.color
    });
    // leaders slightly distinct: gold ring tint stays faction; scale handled by height
  }

  setPos(x: number, z: number) { this.x = x; this.z = z; this.rig.group.position.set(x, 0, z); }

  get ko() { return this.koTimer > 0; }
  get isGuard() { return this.def.faction === 'guards'; }
  get isStaff() { return this.def.faction === 'staff'; }

  knockout(sec: number) {
    this.koTimer = sec;
    this.ai = 'down';
    this.combatTarget = null;
    this.hostile = false;
    this.rig.setState('ko');
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
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.speakTimer > 0) this.speakTimer -= dt;

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

    const speedBase = this.isGuard ? 4.2 : 3.4 + this.def.base.strength * 0.05;

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
          this.attackCd = 1.1 - this.def.base.aggression * 0.4;
          (this as any)._didAttack = true;
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
      this.rig.setState('idle');
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
