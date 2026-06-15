import * as THREE from 'three';
import { CharacterRig } from './CharacterFactory';
import { CollisionWorld } from '../world/Collision';
import { GameState } from '../game/GameState';
import type { PlayerAppearance } from '../game/types';

export class Player {
  rig: CharacterRig;
  x = 0; z = 0;
  vx = 0; vz = 0;
  radius = 0.5;
  blocking = false;
  attackCooldown = 0;
  koTimer = 0;
  get ko() { return this.koTimer > 0; }

  constructor(private state: GameState, private collision: CollisionWorld) {
    this.rig = new CharacterRig({
      height: 1.0,
      skin: 0xe0ac69,
      hair: 0x2b1d0e,
      hairStyle: 'short',
      uniform: 0xd86a2c, // distinct orange jumpsuit
      accentColor: 0xffffff,
      showRing: true,
      ringColor: 0x55ff77
    });
  }

  setPos(x: number, z: number) {
    this.x = x; this.z = z;
    this.rig.group.position.set(x, 0, z);
  }

  // Rebuild the player model from chosen appearance (character creation / load).
  customize(a: PlayerAppearance, scene: THREE.Scene) {
    scene.remove(this.rig.group);
    this.rig.dispose();
    this.rig = new CharacterRig({
      height: a.height,
      skin: a.skin,
      hair: a.hair,
      hairStyle: a.hairStyle,
      uniform: a.uniform,
      accentColor: 0xffffff,
      showRing: true,
      ringColor: 0x55ff77
    });
    this.rig.group.position.set(this.x, 0, this.z);
    scene.add(this.rig.group);
  }

  knockout(seconds: number) {
    this.koTimer = seconds;
    this.rig.setState('ko');
  }

  update(dt: number, moveX: number, moveZ: number, sprint: boolean) {
    const s = this.state.stats;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    if (this.ko) {
      this.koTimer -= dt;
      this.vx = this.vz = 0;
      this.rig.update(dt, 0);
      return;
    }

    const len = Math.hypot(moveX, moveZ);
    let speed = 5.2;
    // stat & condition modifiers
    speed *= 1 + s.agility * 0.03;
    if (s.stamina < 20) speed *= 0.6;
    if (s.injury > 50) speed *= 0.75;
    if (s.hunger < 15) speed *= 0.85;

    const wantSprint = sprint && len > 0.1 && s.stamina > 5 && !this.rig.isBusy();
    if (wantSprint) {
      speed *= 1.7;
      s.stamina -= dt * 14;
    }

    let targetVx = 0, targetVz = 0;
    if (len > 0.1 && !this.rig.isBusy()) {
      targetVx = (moveX / len) * speed;
      targetVz = (moveZ / len) * speed;
      this.rig.facing = Math.atan2(targetVx, targetVz);
    }
    // smooth accel/decel
    const accel = len > 0.1 ? 12 : 16;
    this.vx = THREE.MathUtils.lerp(this.vx, targetVx, Math.min(1, dt * accel));
    this.vz = THREE.MathUtils.lerp(this.vz, targetVz, Math.min(1, dt * accel));

    let nx = this.x + this.vx * dt;
    let nz = this.z + this.vz * dt;
    const r = this.collision.resolve(nx, nz, this.radius);
    this.x = r.x; this.z = r.z;
    this.rig.group.position.set(this.x, 0, this.z);

    // animation state
    if (!this.rig.isBusy()) {
      if (this.blocking) this.rig.setState('block');
      else {
        const moving = Math.hypot(this.vx, this.vz) > 0.4;
        this.rig.setState(moving ? (wantSprint ? 'sprint' : 'walk') : 'idle');
      }
    }
    this.rig.update(dt, Math.min(1, Math.hypot(this.vx, this.vz) / speed));
  }
}
