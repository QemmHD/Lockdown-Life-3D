import type { RandomEventDef } from '../game/types';

// Random events keyed by phase. The EventSystem resolves `outcome` strings.
export const RANDOM_EVENTS: RandomEventDef[] = [
  { id: 'cafeteria_argument', name: 'Cafeteria Argument', phases: ['breakfast', 'lunch', 'dinner'], weight: 3,
    message: 'Two inmates are squaring up over a stolen tray.',
    choices: [
      { text: 'Break it up (risky)', outcome: 'mediate' },
      { text: 'Join the stronger side', outcome: 'side_strong' },
      { text: 'Stay out of it', outcome: 'ignore' }
    ] },
  { id: 'yard_fight', name: 'Yard Fight', phases: ['yard'], weight: 3,
    message: 'A brawl erupts near the pull-up bars!',
    choices: [
      { text: 'Wade in swinging', outcome: 'join_fight' },
      { text: 'Place a bet', outcome: 'bet' },
      { text: 'Keep your distance', outcome: 'ignore' }
    ] },
  { id: 'cell_search', name: 'Cell Search', phases: ['rollcall', 'evening'], weight: 2,
    message: 'Guards are tossing cells looking for contraband.',
    choices: [
      { text: 'Stash your contraband', outcome: 'stash' },
      { text: 'Stay calm and comply', outcome: 'comply' }
    ] },
  { id: 'contraband_rumor', name: 'Contraband Rumor', phases: ['work', 'gym', 'yard'], weight: 2,
    message: 'Word is someone is moving product through the laundry.',
    choices: [{ text: 'Investigate', outcome: 'rumor_invest' }, { text: 'Ignore', outcome: 'ignore' }] },
  { id: 'sick_inmate', name: 'Sick Inmate', phases: ['work', 'evening', 'breakfast'], weight: 2,
    message: 'An inmate has collapsed and needs help.',
    choices: [{ text: 'Help them to medical', outcome: 'help_sick' }, { text: 'Walk past', outcome: 'ignore' }] },
  { id: 'theft_accusation', name: 'Stolen Item Accusation', phases: ['gym', 'shower', 'work'], weight: 2,
    message: 'An inmate accuses YOU of stealing his watch.',
    choices: [
      { text: 'Deny it (intelligence)', outcome: 'deny_theft' },
      { text: 'Pay him off', outcome: 'pay_theft' },
      { text: 'Tell him to back off', outcome: 'threaten_theft' }
    ] },
  { id: 'workout_challenge', name: 'Workout Challenge', phases: ['gym', 'yard'], weight: 2,
    message: 'An Iron Dog challenges you to out-lift him.',
    choices: [{ text: 'Accept (strength)', outcome: 'lift_challenge' }, { text: 'Decline', outcome: 'decline_respect' }] },
  { id: 'recruitment', name: 'Gang Recruitment', phases: ['yard', 'gym', 'evening'], weight: 2,
    message: 'A recruiter sizes you up for his crew.',
    choices: [{ text: 'Hear them out', outcome: 'recruit_offer' }, { text: 'Not interested', outcome: 'decline_respect' }] },
  { id: 'protection_demand', name: 'Protection Money', phases: ['breakfast', 'lunch', 'evening'], weight: 2,
    message: 'A bully demands protection money or else.',
    choices: [
      { text: 'Pay up ($15)', outcome: 'pay_protection' },
      { text: 'Refuse', outcome: 'refuse_protection' }
    ] },
  { id: 'lockdown_emergency', name: 'Lockdown Emergency', phases: ['yard', 'gym', 'work'], weight: 1,
    message: 'Sirens blare — emergency lockdown! Get to your cell.',
    choices: [{ text: 'Acknowledge', outcome: 'force_lockdown' }] },
  { id: 'new_inmate', name: 'New Inmate Arrival', phases: ['work', 'yard'], weight: 1,
    message: 'A fresh fish just arrived, looking lost and scared.',
    choices: [{ text: 'Show them the ropes', outcome: 'help_new' }, { text: 'Shake them down', outcome: 'rob_new' }] },
  { id: 'corrupt_offer', name: 'Corrupt Guard Offer', phases: ['work', 'shower', 'evening'], weight: 1,
    message: 'A guard quietly offers to lower your heat... for cash.',
    choices: [{ text: 'Pay $20 to clear heat', outcome: 'bribe_guard' }, { text: 'Decline', outcome: 'ignore' }] },
  { id: 'snitch_report', name: 'Snitch Report', phases: ['yard', 'evening', 'work'], weight: 1,
    message: 'A snitch was overheard giving the guards YOUR name.',
    choices: [{ text: 'Confront the snitch', outcome: 'confront_snitch' }, { text: 'Lay low', outcome: 'lay_low' }] },
  { id: 'shower_ambush', name: 'Shower Ambush', phases: ['shower'], weight: 2,
    message: 'Two Vipers corner you in the showers!',
    choices: [{ text: 'Fight back', outcome: 'ambush_fight' }, { text: 'Hand over valuables', outcome: 'ambush_give' }] },
  { id: 'job_accident', name: 'Workshop Accident', phases: ['work'], weight: 1,
    message: 'A machine in the workshop jams and sparks fly.',
    choices: [{ text: 'Fix it (intelligence)', outcome: 'fix_machine' }, { text: 'Back away', outcome: 'ignore' }] },
  { id: 'hidden_stash', name: 'Hidden Stash Found', phases: ['work', 'yard', 'shower'], weight: 1,
    message: 'You spot a loose brick hiding a stash.',
    choices: [{ text: 'Take it', outcome: 'take_stash' }, { text: 'Leave it', outcome: 'ignore' }] },
  { id: 'warden_inspection', name: 'Warden Inspection', phases: ['rollcall', 'work'], weight: 1,
    message: 'The Warden is doing rounds. Best behavior.',
    choices: [{ text: 'Acknowledge', outcome: 'warden_watch' }] },
  { id: 'faction_brawl', name: 'Faction Brawl', phases: ['yard', 'gym', 'lunch'], weight: 1,
    message: 'Two gangs clash — the whole block could blow up!',
    choices: [{ text: 'Pick a side', outcome: 'faction_brawl_join' }, { text: 'Take cover', outcome: 'ignore' }] },
  { id: 'escape_rumor', name: 'Escape Rumor', phases: ['evening', 'work'], weight: 1, once: true,
    message: 'Someone whispers about a way out through the maintenance halls.',
    choices: [{ text: 'Learn more', outcome: 'escape_thread' }, { text: 'Forget you heard it', outcome: 'ignore' }] },
  { id: 'guard_inspection', name: 'Guard Inspection', phases: ['rollcall', 'lunch'], weight: 2,
    message: 'Surprise pat-down inspection in the line.',
    choices: [{ text: 'Comply', outcome: 'comply' }, { text: 'Slip away', outcome: 'slip_away' }] }
];
