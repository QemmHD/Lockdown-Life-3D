// Basic jobs/tasks (v1). Each is a quick interaction at a station that rewards small stats.
export interface JobDef {
  id: string; name: string; verb: string;
  roomType: string;          // where it's done
  rep: number; respect: number; money: number;
  energyCost: number;
}

export const JOBS: JobDef[] = [
  { id: 'kitchen', name: 'Kitchen Duty', verb: 'Stack trays', roomType: 'cafeteria', rep: 1, respect: 0, money: 3, energyCost: 0.08 },
  { id: 'cleaner', name: 'Cleaning', verb: 'Mop the floor', roomType: 'shower', rep: 1, respect: 0, money: 2, energyCost: 0.1 },
  { id: 'laundry', name: 'Laundry', verb: 'Fold laundry', roomType: 'storage', rep: 1, respect: 0, money: 3, energyCost: 0.08 },
  { id: 'yardcrew', name: 'Yard Cleanup', verb: 'Clear the yard', roomType: 'yard', rep: 1, respect: 1, money: 2, energyCost: 0.12 },
  { id: 'porter', name: 'Storage Porter', verb: 'Move supply box', roomType: 'storage', rep: 1, respect: 0, money: 4, energyCost: 0.12 }
];
export const JOB_BY_ROOM: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.roomType, j]));
