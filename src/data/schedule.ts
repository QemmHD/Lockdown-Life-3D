import type { SchedulePhase } from '../game/types';

// A full prison day mapped onto a 24h clock. The sim runs accelerated time.
export const SCHEDULE: SchedulePhase[] = [
  { id: 'wakeup', name: 'Wake-Up', startHour: 6, requiredRoom: 'cellblock', announce: 'WAKE UP! On your feet, inmates!' },
  { id: 'rollcall', name: 'Roll Call', startHour: 6.5, requiredRoom: 'cellblock', announce: 'ROLL CALL! Stand by your bunks for the count.' },
  { id: 'breakfast', name: 'Breakfast', startHour: 7.5, requiredRoom: 'cafeteria', announce: 'Chow time. Breakfast in the mess hall.' },
  { id: 'work', name: 'Work Block', startHour: 9, requiredRoom: 'workshop', announce: 'Work block. Report to your assignments.' },
  { id: 'yard', name: 'Yard Time', startHour: 11, requiredRoom: 'yard', announce: 'Yard time. Get some air.' },
  { id: 'lunch', name: 'Lunch / Count', startHour: 12.5, requiredRoom: 'cafeteria', announce: 'Lunch and mid-day count.' },
  { id: 'gym', name: 'Free / Gym', startHour: 14, requiredRoom: 'gym', announce: 'Free time. The gym is open.' },
  { id: 'shower', name: 'Showers', startHour: 16, requiredRoom: 'shower', announce: 'Shower rotation. Keep it moving.' },
  { id: 'dinner', name: 'Dinner', startHour: 18, requiredRoom: 'cafeteria', announce: 'Dinner is served.' },
  { id: 'evening', name: 'Evening Block', startHour: 19.5, requiredRoom: 'cellblock', announce: 'Evening block. Return to the cell block.' },
  { id: 'lockdown', name: 'Lockdown', startHour: 21, requiredRoom: 'cellblock', announce: 'LOCKDOWN. Return to your cells. Doors closing.', restricted: true },
  { id: 'sleep', name: 'Lights Out', startHour: 22.5, requiredRoom: 'cellblock', announce: 'Lights out. Sleep to advance the day.', restricted: true }
];

export function phaseAt(hour: number): SchedulePhase {
  let current = SCHEDULE[0];
  for (const p of SCHEDULE) {
    if (hour >= p.startHour) current = p;
  }
  return current;
}
