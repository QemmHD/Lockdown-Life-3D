# QA Checklist — Lockdown Life 3D

Manual playtest pass for the current ECS-lite build. Run before tagging a stage.
There is no committed automated test suite; a throwaway Puppeteer screenshot harness can be used
locally (`shot*.mjs`, gitignored) if Puppeteer is available, but it is **not** a dependency.

## How to run a pass
```bash
npm install
npm run typecheck     # must report 0 errors
npm run build         # tsc --noEmit + vite build — must succeed
npm run preview       # open the printed URL and play
```
Add `?debug` to the URL (e.g. `http://localhost:4173/?debug`) to expose `window.__game` and log
selected-object / blocked-path info to the console.

## Build / typecheck
- [ ] `npm run typecheck` → 0 TypeScript errors
- [ ] `npm run build` → succeeds, no errors
- [ ] No console errors on load (a favicon 404 is benign)

## Core / selection
- [ ] Game loads; the player inmate has a gold ring and the panel shows **"You"**
- [ ] Camera follows the player
- [ ] Tap empty floor → player paths there; blue destination marker appears
- [ ] Tap unreachable/blocked target → red invalid marker / "no path" feedback
- [ ] Tap an NPC (prisoner) → their panel opens (respect, relationship, actions)
- [ ] Tap a guard → guard panel (Talk / Comply / Argue)
- [ ] Close (✕) returns the panel to the player

## Social interactions
- [ ] Talk → small talk / line, relationship nudges
- [ ] Insult / Threaten → reaction bubble; sometimes starts a fight
- [ ] Trade (when the NPC has an item) → item/money exchange; disabled with a reason otherwise
- [ ] Fight → combat starts, impact rings + damage floats, nearby guard responds

## Object interactions
- [ ] Tap a **bed** → Rest (walk → face → timed action → energy up)
- [ ] Tap a **sink/shower** → Wash (hygiene up)
- [ ] Tap a **table/counter** → Eat (hunger down)
- [ ] Tap **weights/pull-up** → Train (respect up)
- [ ] Tap a **job object** (counter / mop spot / shelf / yard) → Work (money/respect)
- [ ] Tap a stash spot (bed/toilet/locker/shelf/trash) → Hide / Search / Take behave correctly
- [ ] An object in use by an NPC shows **"in use"** / is disabled

## Doors / gates
- [ ] Tap a door → Inspect / Open / Close / Back Off
- [ ] Open a closed door → it swings open (lamp green); Close → shuts
- [ ] Tap a **restricted** door (security/intake/storage/solitary) → "Try Door" → "guard access only", suspicion rises
- [ ] At Lights Out, tap a **locked** rec-area gate → "Try Door" → "locked down"; tapping equipment behind it → "can't reach … locked"
- [ ] Lamps reflect state: green = open, yellow = closed, orange = locked, red = restricted

## Schedule / NPC behaviour
- [ ] Phase banner changes through the day (Wake-Up → … → Lights Out)
- [ ] Doors open/lock per phase (cafeteria at meals, yard during yard/work, rec areas lock at Lights Out)
- [ ] During meals NPCs gather at **real tables**; at sleep they go to **beds**; shower phase → showers; yard → equipment
- [ ] NPCs do not stack on the same single-use object (reservations work)
- [ ] No NPC permanently stuck at a door (blocked → falls back / wanders, never crashes)

## Guards / discipline
- [ ] Guards patrol and sometimes stand at guard desks
- [ ] Carrying contraband / loitering in restricted zones / fighting raises suspicion
- [ ] High suspicion → a guard walks over and searches (visible)
- [ ] Serious contraband or fighting → visible escort to solitary, then release later

## Save / load
- [ ] Save, move around, Load → positions/inventory/social/door state/hidden stashes restore
- [ ] Reservations are cleared after load (no object stuck "in use")
- [ ] Loading mid-action does not leave the player stuck
- [ ] Loading with no save shows "No save found" (no crash)

## Camera / input
- [ ] Drag pans; auto-follow resumes after a moment
- [ ] Selecting the player recenters follow
- [ ] Pinch (mobile) / wheel (desktop) zoom within limits
- [ ] Pause / Speed (1×/2×/4×) / Save / Load buttons all work

## Mobile / layout
- [ ] Portrait + landscape both usable; panel never permanently covers the bottom bar (scrolls if tall)
- [ ] Action buttons + close button are comfortably tappable
- [ ] Long names wrap instead of clipping
- [ ] Alert feed doesn't overflow the screen
- [ ] No page scroll/zoom while playing

## Chaos layer (Stage 3.0)
- [ ] Trigger a lockdown (repeated fights / serious contraband, or `window.__game.sim.startLockdown('manual',2)` with `?debug`)
- [ ] Lockdown locks cafeteria/yard/shower doors; cell-block doors stay open; LOCK chip + banner show
- [ ] Prisoners head back toward cells; ones blocked by a locked door wait/complain (don't loop forever)
- [ ] Guards move to checkpoint posts (security desk / door junctions), not all clumped
- [ ] Alarm shows red vignette + flashing locked-door lamps + alert-feed message
- [ ] Lockdown ends on its timer: doors re-derive, reservations clear, prisoners re-route, no stuck NPCs
- [ ] Riot pressure (RIOT %) rises with anger/hunger/fights/blocked, falls with calm/met needs
- [ ] Riot warning appears at high pressure; a small riot event is controlled (not permanent)
- [ ] Area tension shows on the door/object panel ("Area: Tense/Dangerous") in crowded/rival rooms
- [ ] Player chaos actions appear during chaos (Comply / Return to Cell / Hide / Calm Down / Help Guard)
- [ ] Attempt Escape appears only near the yard gate / perimeter; resolves caught/interrupted/abandoned/success
- [ ] Save during a lockdown, then load → lockdown/alarm/riot/tension/heat restored, no crash, no stuck NPCs

## Chaos balance / feel (Stage 3.1)
- [ ] Calm first day with no player trouble: Heat stays well under 50, no lockdown loop
- [ ] Alert feed doesn't spam duplicate LOCKDOWN/ALARM lines (deduped; clear STARTED/LIFTED/ACTIVE transitions)
- [ ] Heat rises on fights/contraband/escape and decays during calm time (not pinned at 100)
- [ ] Riot pressure moves smoothly; warning more common than a full event; both have cooldowns
- [ ] After a lockdown lifts, a new one doesn't immediately start unless a severe event happens
- [ ] Alarm vignette is noticeable but not overwhelming; door lamps flash without cluttering the map
- [ ] Player panel isn't a wall of buttons during lockdown (needs hidden, chaos actions lead)
- [ ] Complaint/panic bubbles are throttled; prisoners resume normal schedules after chaos ends
- [ ] `?debug` console shows a telemetry summary (`window.__game.sim.metrics`)

## AI depth (Stage 3.2)
- [ ] Guards patrol different zones over a normal day (not all clumped in one corridor)
- [ ] Inspecting a guard shows a role (Patrolling / Holding checkpoint / Responding / Escorting / …)
- [ ] Only one nearby guard commits to a minor incident; others keep posts
- [ ] Inspecting a prisoner shows an intent (On routine / Socializing / Avoiding trouble / Watching / Returning to cell / Hiding …)
- [ ] Insulting/threatening an NPC makes them avoid/grudge you afterward (memory)
- [ ] Fearful prisoners flee a nearby brawl; brave ones watch; rivals throw "Watch it." standoffs
- [ ] During lockdown prisoners switch to returning to cells; they recover to routines after it lifts
- [ ] Gang allies form loose clusters (separated, not stacked on one tile)
- [ ] Save/load (v6) keeps guard roles + prisoner intents/memory safe; no stuck NPCs
- [ ] `?debug` metrics include guardRoleSwitches / prisonerIntentChanges / socialInteractions / standoffs

## Combat feel (Stage 3.3)
- [ ] A fight shows phases (square-up → windup → strike → hit-react/stumble → recover), not instant ticks
- [ ] Fighters keep spacing (don't overlap); knockback shoves the loser back (never through a wall)
- [ ] Not every attack lands — Dodge / Blocked / Miss / Glancing feedback appears; damage numbers only on hits
- [ ] Heavy hit / low stamina can knock a character down; they recover (non-lethal)
- [ ] Tap Fight on an NPC → panel becomes Strike / Heavy / Shove / Block / Back Off; inputs affect the fight
- [ ] A responding guard shouts "Break it up!", shoves fighters apart, and disciplines if it continues
- [ ] Nearby inmates watch/cheer (capped) or flee; a crowd nudges tension up
- [ ] A rival standoff can escalate into a fight, or defuse when a guard is near
- [ ] Winning raises respect/reputation; losing lowers it; fights raise suspicion/heat → possible search/solitary
- [ ] Save/load during a fight → no one stuck in windup/fight; outcomes (health/respect/memory) persist
- [ ] `?debug` metrics include attacks/hits/misses/blocks/dodges/knockdowns/guardInterrupts/playerCombatChoices

## UI / menus / progression (Stage 3.4)
- [ ] Game boots to a title screen (Play / Continue / New Game / How to Play); doesn't drop straight in
- [ ] Play starts the game; Continue loads a save; New Game clears + restarts
- [ ] Bottom Pause opens the tabbed menu (game pauses); Resume closes it
- [ ] Stats tab shows needs/money/respect/reputation/suspicion/heat + reputation tier + lifetime totals
- [ ] Objectives tab lists daily goals; HUD objective tracker shows active goals; goals complete on events
- [ ] People/Inventory/Gangs tabs populate from the live sim
- [ ] A day rollover shows the end-of-day summary once (rating + changes)
- [ ] Reputation tier rises with reputation/respect (Nobody → … → Prison Legend)
- [ ] Save/Load (v8) keeps progression/objectives/daily stats; old saves load with defaults
- [ ] Menus are readable in mobile landscape; existing HUD/panel still work

## Character creation / new game (Stage 3.5)
- [ ] Title "New Game" opens the setup flow (Identity → Appearance → Traits → Start → Review)
- [ ] Name/nickname/seed entry works; random-name button works; long names don't break layout
- [ ] Appearance swatches + build change the player's in-game model
- [ ] Pick 2 strengths + 1 weakness; backstory selectable; choices persist across Back/Next
- [ ] Gang lean / difficulty / chaos / tutorial-tips selectable
- [ ] Randomize fills a valid identity; Review summarizes it
- [ ] Begin Run drops in as that inmate: name in HUD/stats, traits applied, difficulty active, money/objectives seeded
- [ ] No page reload; Cancel returns to title
- [ ] Title Continue shows saved name + day; loads correctly
- [ ] Save/load (v9) keeps the setup; an older save loads with default setup (no crash)

## Gangs / factions (Stage 3.6)
- [ ] Player starts unaffiliated; gang lean seeds some standing
- [ ] Building standing (talk/favour/trade with members) raises standing; rivals drop
- [ ] At high standing + respect a crew invites you (alert + "Decide whether to join" objective)
- [ ] Inspect a member → Ask About Gang / Accept Invite / Decline; accepting sets membership
- [ ] After joining: rank shows, allies warm/cluster, rivals cold; Gangs tab shows membership/rank/perks/standing
- [ ] Crew goals appear and complete; completing one raises standing + can rank you up
- [ ] Attacking a member lowers that crew's standing
- [ ] Leave Gang works (standing penalty); rivals/standoffs still function
- [ ] Daily summary / stats reflect gang standing & rank
- [ ] Save/load (v10) restores membership/rank/standing; an older save migrates to unaffiliated

## Stability
- [ ] Run a full in-game day at 4× → no runtime errors, no soft-locks
- [ ] No leaking DOM feedback elements after many floats/bubbles
