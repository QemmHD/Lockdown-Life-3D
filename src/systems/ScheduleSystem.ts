import { GameState } from '../game/GameState';
import { SCHEDULE, phaseAt } from '../data/schedule';
import type { SchedulePhase, SchedulePhaseId } from '../game/types';

// Real seconds per in-game hour
const SECONDS_PER_HOUR = 20;

export class ScheduleSystem {
  onPhaseChange?: (phase: SchedulePhase, prev: SchedulePhaseId) => void;
  needsSleep = false;

  constructor(private state: GameState) {}

  current(): SchedulePhase { return phaseAt(this.state.timeOfDay); }
  requiredRoom(): string { return this.current().requiredRoom ?? ''; }

  update(dt: number) {
    if (this.needsSleep) return;
    const prevPhaseId = this.state.phase;
    this.state.timeOfDay += dt / SECONDS_PER_HOUR;

    if (this.state.timeOfDay >= 24) {
      this.state.timeOfDay = 23.99;
      this.needsSleep = true;
      return;
    }

    const cur = this.current();
    if (cur.id !== prevPhaseId) {
      this.state.phase = cur.id;
      this.state.lockdown = !!cur.restricted;
      this.onPhaseChange?.(cur, prevPhaseId);
    }
  }

  // Called by Game when the player sleeps. Returns to morning of next day.
  advanceDay() {
    this.state.day += 1;
    this.state.sentenceDays -= 1;
    this.state.timeOfDay = 6;
    this.state.phase = 'wakeup';
    this.state.lockdown = false;
    this.needsSleep = false;
  }

  timeString(): string {
    const t = this.state.timeOfDay;
    let h = Math.floor(t);
    const m = Math.floor((t - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    let hh = h % 12; if (hh === 0) hh = 12;
    return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  phaseName(): string { return this.current().name; }
}
