import * as THREE from 'three';
import { GameState, clamp } from '../game/GameState';
import { EffectsSystem } from './EffectsSystem';
import { AudioSystem } from './AudioSystem';
import { InventorySystem } from './InventorySystem';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { CameraController } from '../game/CameraController';
import { FACTIONS } from '../data/factions';

export class CombatSystem {
  player!: Player;
  npcs: NPC[] = [];
  camera!: CameraController;

  onKO?: (npc: NPC) => void;
  onDeath?: (npc: NPC, byPlayer: boolean) => void;
  onPlayerKO?: () => void;
  onFightSeen?: (x: number, z: number, byGuardOnly: boolean) => void;
  onHostile?: (npc: NPC) => void;

  constructor(private state: GameState, private fx: EffectsSystem, private audio: AudioSystem, private inv: InventorySystem) {}

  setRefs(player: Player, npcs: NPC[], camera: CameraController) {
    this.player = player; this.npcs = npcs; this.camera = camera;
  }

  // A downed (KO) inmate can be finished off; a weapon makes any blow potentially lethal.
  private finishOrDown(target: NPC, weaponDmg: number, byPlayer: boolean) {
    const lethal = target.ko || weaponDmg >= 8 || target.health <= -22;
    if (lethal) {
      target.die();
      this.fx.crowd(target.x, target.z);
      this.onDeath?.(target, byPlayer);
    } else {
      target.knockout(20 + Math.random() * 15);
      this.fx.crowd(target.x, target.z);
      if (byPlayer) this.onKO?.(target);
    }
  }

  private nearestTarget(range: number): NPC | null {
    let best: NPC | null = null, bestD = range;
    const fx = Math.sin(this.player.rig.facing), fz = Math.cos(this.player.rig.facing);
    for (const n of this.npcs) {
      if (n.dead) continue;
      const dx = n.x - this.player.x, dz = n.z - this.player.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      // facing arc check
      const dot = (dx / (d || 1)) * fx + (dz / (d || 1)) * fz;
      if (dot < 0.3 && d > 1.3) continue;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  playerAttack(shove = false) {
    const s = this.state.stats;
    if (this.player.ko || this.player.attackCooldown > 0) return;
    const cost = shove ? 8 : 12;
    if (s.stamina < 5) { return; }
    this.player.attackCooldown = shove ? 0.5 : 0.6;
    s.stamina = clamp(s.stamina - cost, 0, s.maxStamina);
    this.player.rig.setState(shove ? 'shove' : 'punch');
    this.audio.play('swing');

    const target = this.nearestTarget(shove ? 2.2 : 2.0);
    if (!target) return;

    const staminaFactor = s.stamina < 20 ? 0.6 : 1;
    const weapon = shove ? 0 : this.inv.bestWeaponDamage();
    const crit = Math.random() < 0.05 + s.agility * 0.015;
    let dmg = (3 + s.strength * 1.6 + weapon) * staminaFactor;
    if (shove) dmg *= 0.45;
    if (crit) dmg *= 1.8;
    dmg = Math.round(dmg);

    target.health -= dmg;
    target.takeHit();
    this.fx.damageNumber(target.x, target.z, dmg, crit);
    this.fx.impact(target.x, target.z);
    this.audio.play('hit');
    this.camera.shake(crit ? 0.5 : 0.3);

    // knockback
    const ang = Math.atan2(target.x - this.player.x, target.z - this.player.z);
    const kb = shove ? 2.4 : 1.2;
    target.x += Math.sin(ang) * kb;
    target.z += Math.cos(ang) * kb;
    target.setPos(target.x, target.z);

    if (!target.ko) this.makeReaction(target);
    this.onFightSeen?.(target.x, target.z, false);

    if (target.health <= 0) this.finishOrDown(target, weapon, true);
  }

  // Throw your best weapon at the faced target (Hard Time style)
  throwWeapon() {
    if (this.player.ko) return;
    const w = this.inv.bestWeapon();
    if (!w) { this.fx.floatText(this.player.x, 1.9, this.player.z, 'Nothing to throw', '#ccc'); return; }
    const target = this.nearestTarget(13);
    this.inv.remove(w.id, 1);
    this.player.rig.setState('shove');
    this.audio.play('swing');
    const tx = target ? target.x : this.player.x + Math.sin(this.player.rig.facing) * 9;
    const tz = target ? target.z : this.player.z + Math.cos(this.player.rig.facing) * 9;
    this.fx.projectile(this.player.x, this.player.z, tx, tz, () => {
      if (!target || target.ko) { this.fx.dust(tx, tz); return; }
      const dmg = Math.round(w.damage + this.state.stats.strength * 0.6);
      target.health -= dmg;
      target.takeHit();
      this.fx.damageNumber(target.x, target.z, dmg, true);
      this.fx.impact(target.x, target.z);
      this.audio.play('hit');
      this.camera.shake(0.35);
      const ang = Math.atan2(target.x - this.player.x, target.z - this.player.z);
      target.x += Math.sin(ang) * 1.6; target.z += Math.cos(ang) * 1.6; target.setPos(target.x, target.z);
      if (!target.ko) this.makeReaction(target);
      this.onFightSeen?.(target.x, target.z, false);
      if (target.health <= 0) this.finishOrDown(target, w.damage, true);
    });
  }

  // Decide how a hit NPC reacts
  private makeReaction(npc: NPC) {
    const mem = this.state.mem(npc.def.id);
    mem.attacked = true;
    mem.fights += 1;
    this.state.changeRelationship(npc.def.id, -25);

    const arch = npc.def.archetype;
    const fearful = arch === 'coward' || arch === 'sick' || arch === 'new' || arch === 'booksmart';
    if (npc.base.health < 60 || fearful || npc.health < npc.maxHealth * 0.3) {
      npc.ai = 'flee';
      npc.fleeTarget = null;
      if (arch === 'snitch' || arch === 'coward') this.onFightSeen?.(npc.x, npc.z, true); // calls guards
    } else {
      npc.ai = 'fight';
      npc.combatTarget = 'player';
      npc.hostile = true;
      this.onHostile?.(npc);
      // allies join
      for (const ally of this.npcs) {
        if (ally === npc || ally.ko) continue;
        if (ally.def.faction === npc.def.faction && ally.distTo(npc.x, npc.z) < 8 && (ally.def.role === 'enforcer' || ally.base.aggression > 0.6)) {
          ally.ai = 'fight'; ally.combatTarget = 'player'; ally.hostile = true;
          this.onHostile?.(ally);
        }
      }
    }
  }

  // Start a brawl between two inmates (dynamic world encounter)
  startNpcFight(a: NPC, b: NPC) {
    if (a.ko || b.ko || a.dead || b.dead) return;
    a.npcFoe = b; a.ai = 'fightNPC';
    b.npcFoe = a; b.ai = 'fightNPC';
    this.fx.crowd((a.x + b.x) / 2, (a.z + b.z) / 2);
  }

  update(dt: number) {
    // resolve NPC-vs-NPC brawls
    for (const n of this.npcs) {
      if (n.dead || n.ko) continue;
      if (n.npcFoe && n.consumeNpcAttack()) {
        const foe = n.npcFoe;
        if (!foe || foe.ko || foe.dead || n.distTo(foe.x, foe.z) > 1.9) continue;
        const dmg = Math.max(1, Math.round(4 + n.base.strength * 1.3));
        foe.health -= dmg;
        foe.takeHit();
        this.fx.damageNumber(foe.x, foe.z, dmg);
        this.fx.impact(foe.x, foe.z);
        const ang = Math.atan2(foe.x - n.x, foe.z - n.z);
        foe.x += Math.sin(ang) * 0.7; foe.z += Math.cos(ang) * 0.7; foe.setPos(foe.x, foe.z);
        if (foe.health <= 0) this.finishOrDown(foe, 0, false);
      }
    }

    if (this.player.ko) return;
    const s = this.state.stats;
    for (const n of this.npcs) {
      if (n.ko || n.dead) continue;
      if (n.combatTarget === 'player' && n.consumeAttack()) {
        const d = n.distTo(this.player.x, this.player.z);
        if (d > 2.0) continue;
        let dmg = 4 + n.base.strength * 1.5;
        // block
        if (this.player.blocking) {
          dmg *= 0.3;
          this.audio.play('block');
          this.fx.floatText(this.player.x, 1.8, this.player.z, 'BLOCK', '#88bbff');
        } else {
          this.player.rig.setState('hit');
          this.audio.play('hit');
        }
        // toughness reduction + dodge
        dmg *= 1 - Math.min(0.5, s.toughness * 0.04);
        if (!this.player.blocking && Math.random() < s.agility * 0.02) {
          this.fx.floatText(this.player.x, 1.8, this.player.z, 'DODGE', '#aaffaa');
          continue;
        }
        dmg = Math.max(1, Math.round(dmg));
        s.health = clamp(s.health - dmg, 0, s.maxHealth);
        s.injury = clamp(s.injury + dmg * 0.4, 0, 100);
        this.fx.damageNumber(this.player.x, this.player.z, dmg);
        this.camera.shake(0.4);
        // knockback player
        const ang = Math.atan2(this.player.x - n.x, this.player.z - n.z);
        this.player.x += Math.sin(ang) * 0.8;
        this.player.z += Math.cos(ang) * 0.8;

        if (s.health <= 0) {
          this.player.knockout(3);
          this.onPlayerKO?.();
          return;
        }
      }
    }
  }
}
