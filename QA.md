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
- [ ] Save during a lockdown, then load → lockdown/alarm/riot/tension restored, no crash, no stuck NPCs

## Stability
- [ ] Run a full in-game day at 4× → no runtime errors, no soft-locks
- [ ] No leaking DOM feedback elements after many floats/bubbles
