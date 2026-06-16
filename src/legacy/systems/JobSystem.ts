import { GameState, clamp } from '../game/GameState';

export interface JobResult { money: number; rep: number; heat: number; msg: string; stole?: string; }

const JOBS: Record<string, { name: string; base: number; duration: number }> = {
  laundry: { name: 'Laundry', base: 8, duration: 3.5 },
  kitchen: { name: 'Kitchen Duty', base: 10, duration: 4 },
  cleaning: { name: 'Cleaning', base: 6, duration: 3 },
  workshop: { name: 'Workshop Assembly', base: 12, duration: 4.5 }
};

export class JobSystem {
  constructor(private state: GameState) {}

  duration(jobId: string) { return JOBS[jobId]?.duration ?? 3; }
  name(jobId: string) { return JOBS[jobId]?.name ?? 'Work'; }

  complete(jobId: string): JobResult {
    const job = JOBS[jobId];
    const s = this.state.stats;
    if (!job) return { money: 0, rep: 0, heat: 0, msg: 'Nothing to do here.' };

    const success = Math.random() < 0.55 + s.intelligence * 0.04 + s.mood * 0.002;
    const key = `job_${jobId}_day${this.state.day}`;
    const doneToday = (this.state.flags[key] as number) ?? 0;
    const fatigue = Math.max(0.3, 1 - doneToday * 0.25);
    this.state.flags[key] = doneToday + 1;

    if (!success) {
      s.mood = clamp(s.mood - 6, 0, 100);
      s.heat = clamp(s.heat + 5, 0, 100);
      return { money: 0, rep: -1, heat: 5, msg: `You botched the ${job.name}. Mood down, a little heat.` };
    }

    const money = Math.round((job.base + s.intelligence * 1.5) * fatigue);
    s.money += money;
    s.stamina = clamp(s.stamina - 18, 0, s.maxStamina);
    this.state.changeFactionRep('guards', 2);

    // chance to steal materials
    let stole: string | undefined;
    if (Math.random() < 0.25 + s.intelligence * 0.02) {
      const loot = jobId === 'kitchen' ? 'sharp_spoon' : jobId === 'workshop' ? 'file' : jobId === 'laundry' ? 'cigarettes' : 'soap';
      stole = loot;
    }
    return { money, rep: 1, heat: 0, msg: `Good work on ${job.name}. Earned $${money}.`, stole };
  }
}
