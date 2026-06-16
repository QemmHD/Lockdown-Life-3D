import { GameState, clamp } from '../game/GameState';
import { ROOM_MAP } from '../data/rooms';

export type HeatLevel = 'clear' | 'low' | 'medium' | 'high' | 'critical';

export class HeatSystem {
  onPunish?: (reason: string) => void;
  private restrictedTimer = 0;
  private watchTimer = 0;

  constructor(private state: GameState) {}

  level(): HeatLevel {
    const h = this.state.stats.heat;
    if (h < 15) return 'clear';
    if (h < 35) return 'low';
    if (h < 60) return 'medium';
    if (h < 85) return 'high';
    return 'critical';
  }

  add(amount: number, reason?: string) {
    this.state.stats.heat = clamp(this.state.stats.heat + amount, 0, 100);
  }

  update(dt: number, currentRoom: string, guardNearby: boolean) {
    const s = this.state.stats;
    const room = ROOM_MAP[currentRoom];

    // restricted-area heat buildup
    if (room?.restricted) {
      this.restrictedTimer += dt;
      if (this.restrictedTimer > 1.2) {
        this.add(2.2 + s.heat * 0.01);
        this.restrictedTimer = 0;
      }
    } else {
      this.restrictedTimer = 0;
      // passive decay when behaving
      s.heat = clamp(s.heat - dt * (this.level() === 'critical' ? 0.4 : 0.8), 0, 100);
    }

    // high heat + guard nearby -> escalating consequences
    if (guardNearby && s.heat >= 60) {
      this.watchTimer += dt;
      if (this.watchTimer > 5 && s.heat >= 85) {
        this.watchTimer = 0;
        this.onPunish?.('Your heat boiled over — guards moved in.');
      }
    } else {
      this.watchTimer = Math.max(0, this.watchTimer - dt);
    }
  }

  bribeClear(): boolean {
    if (this.state.stats.money >= 20) {
      this.state.stats.money -= 20;
      this.add(-50);
      return true;
    }
    return false;
  }
}
