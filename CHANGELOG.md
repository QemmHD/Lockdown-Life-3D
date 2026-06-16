# Changelog

> **Current State (read me first).** The active game is the **rebuilt ECS-lite simulation** —
> all `v2.x` entries below. Stack: **Vite + TypeScript + Three.js**, DOM/CSS HUD, `localStorage`
> saves (v4), procedural low-poly geometry. Implemented: player prisoner, tap-to-move (A*),
> follow camera, daily schedule, autonomous prisoners/guards, basic fights, gangs v1,
> reputation/relationships, inventory/contraband v1, search/discipline/solitary v1, jobs v1,
> interactable props, doors/gates with schedule-driven locking + NPC schedule anchors, object
> reservations, save/load (v5), and a **chaos layer** (lockdowns, alarm, riot pressure, area tension,
> guard checkpoints, abstract escape attempts). **Not yet built:** audio, character creation,
> Capacitor/IPA, deep riot warfare. The `v1.x` entries are **archived legacy history** for the original
> prototype that now lives under `src/legacy/` (excluded from the build) — those features are
> **not** active in the current game. Latest QA pass: **Stage QA 2.4** (truth/docs/hardening).

## v3.2.0-ai — Stage AI 3.2 (deeper guard/prisoner AI, memory, group behaviour)
AI-depth pass — guards and prisoners now have roles, intents, memory, and light group behaviour.
Sim authoritative, RenderSync read-only, build passes, 0 runtime errors. New **pure AI modules**:
`AIIntent.ts`, `PrisonerAISystem.ts`, `AIMemorySystem.ts`, `GroupBehaviorSystem.ts`,
`GuardAISystem.ts` (types/labels/scoring/routes); the Simulation stays the orchestrator.
- **Guard roles v2**: patrol / checkpoint / response / escort / search / desk / lockdown / riot, each
  with a readable label shown on the panel; role changes are sticky (anti-twitch) and counted.
- **Guard patrol routes**: four routes spread guards across the prison (mess/yard, housing/showers,
  security/admin, perimeter) with dwell-at-post; one guard prefers the security desk. During chaos,
  routes are overridden by checkpoint/riot duty, then resume.
- **Guard coordination**: a single nearest guard commits to an incident (no pile-on); in a riot only
  ~half converge on the hottest zone while the rest hold posts; unreachable posts fall back.
- **Prisoner intent system**: lightweight scoring picks an intent — schedule / socialize / group /
  avoid-enemy / watch-fight / flee-danger / return-cell / hide / comply / wander — from phase, needs,
  gang, fear/anger, nearby guards/enemies/allies, and chaos state. Sticky so choices don't flicker.
- **Prisoner memory v1**: remembers last fight foe, last threat/insult source, recent search, and
  fear/anger spikes (all decaying). Drives avoidance/retaliation; player insults/threats/beatings are
  remembered so NPCs avoid or hold a grudge afterward.
- **Group behaviour + avoidance**: gang allies cluster (separated by index, not stacked); fearful
  inmates flee brawls; timid inmates avoid rivals; brave ones watch; rival crews throw "standoff"
  warnings when a room gets tense (tension first, violence sometimes).
- **Readable status**: NPC/guard panels show the current role/intent ("Patrolling", "Holding
  checkpoint", "Avoiding trouble", "Returning to cell", "Watching", …); bubbles stay throttled.
- **Telemetry+**: added guard role switches, prisoner intent changes, social interactions, standoffs,
  order refusals, compliance events to `sim.metrics` (via `?debug`).
- **Save/load v6**: persists guard roles + memory's stable timers; resets transient intent/memory refs
  on load (no stuck paths/reservations). Backward-compatible with v5/v4 saves.

## v3.1.0-chaos.tuning — Stage Chaos 3.1 (balance, readability, alert cleanup, feel)
Tuning + game-feel pass over the chaos layer — no new systems. Sim authoritative, RenderSync
read-only, build passes, 0 runtime errors. Accelerated 1-day playtest: peak Heat **5** / peak Riot
**28%** with 0 lockdowns under no player trouble (Heat spikes to ~50 when the player fights).
- **Alert cleanup**: deduped (same line suppressed for ~4.5s, never duplicated as the top line) with
  new categories (critical/warning/info/player/system). Clear transitions only — "LOCKDOWN STARTED",
  "LOCKDOWN LIFTED — schedule resumed", "ALARM ACTIVE", "RIOT WARNING", "ESCAPE ATTEMPT". No more
  stacked `LOCKDOWN — x` / `ALARM — x` spam.
- **Heat is now a real eased 0–100 value** (was a crude alarm+lockdown sum that pinned to 100): rises
  from discrete events (fight 6, player fight 12, contraband 8/18, lockdown 8–17, alarm 4–10, riot 25)
  and **decays when calm** (faster after a few quiet seconds). Stays low in normal play.
- **Riot pressure tuning**: slower easing + **hysteresis** (separate on/off thresholds, no flicker) +
  **cooldowns** before another warning (20s) or event (45s). Warnings are common-ish, full events rare.
- **Lockdown hysteresis**: a **cooldown** after a lockdown lifts blocks a new one unless a *severe*
  (sev-3) event occurs; concurrent events **extend** the active lockdown instead of duplicating it.
- **Alarm cleanup**: activating updates the reason + extends the timer but only alerts on the
  transition in; gentler vignette (max ~0.42 opacity, smooth) and calmer door-lamp flash.
- **Player panel** is contextual: during a lockdown the needs buttons (out of reach) are hidden and
  chaos actions lead; otherwise needs → chaos → escape, grouped.
- **Clearer objective** text (return to cell / comply / restricted-area / alarm / riot-warning / escaped).
- **Prisoner reactions** throttled: complaint/panic bubbles have a 5–9s per-NPC cooldown; prisoners
  recover to normal schedules after chaos ends.
- **Escape** stays rare: NPC attempt chance lowered + a 60s cooldown between any attempts; player
  Attempt Escape blocked during the cooldown.
- **Playtest telemetry** (`sim.metrics`, surfaced via `?debug`): fights started/broken-up, searches,
  contraband found, lockdowns started/ended, alarms, riot warnings/events, escape attempts, blocked
  fallbacks, peak stuck prisoners, guard checkpoint failures.
- Save/load v5 unchanged but now persists **heat**; cooldowns/telemetry reset safely on load; alert
  feed cleared on load (no stale lines).

## v3.0.0-chaos — Stage Chaos 3.0 (lockdowns, alarm, riot pressure, checkpoints, abstract escape)
First prison-wide chaos layer — a playable vertical slice. Sim authoritative, RenderSync read-only,
build passes, 0 runtime errors. New pure modules: `LockdownSystem.ts`, `RiotSystem.ts`,
`EscapeSystem.ts`, `GuardCheckpointSystem.ts` (types + constants + decision functions); the
Simulation owns the state and orchestrates them thinly.
- **Lockdown state**: triggered by repeated/serious fights, serious contraband, riot pressure, NPC
  escape attempts (or `startLockdown(...)` manually). Locks recreational doors/gates, keeps cell
  blocks reachable, overrides the schedule to send prisoners back to cells, posts guards at
  checkpoints, raises heat/alarm, and ends safely on a timer (doors re-derive, reservations clear,
  prisoners re-route, no stuck NPCs).
- **Alarm state** (separate from lockdown): escape/riot/serious-fight/contraband trigger a red alarm
  vignette + flashing door lamps + alert-feed message; decays on a timer.
- **Riot pressure v1**: the RIOT meter now means something — a slowly-eased 0–100 value driven by
  anger/hunger/hygiene/sleep, recent fights, blocked prisoners, searches, and lockdown fatigue; eased
  down by calm time and met needs. Crosses **warning** then (rarely) a small **riot event** (alarm +
  soft lockdown + a few prisoners flare up + guards converge).
- **Area tension**: per-room 0–100 (crowding + gang rivalry + riot pressure) with Calm/Tense/
  Dangerous/Critical labels, surfaced on the object/door panel ("Area: Dangerous").
- **Guard checkpoints**: checkpoints built from room doors + the main-hall junction; guards man posts
  during lockdown/alarm and converge on the tensest area during a riot (with unreachable-post fallback,
  no clumping).
- **Blocked-prisoner reactions**: prisoners blocked by a locked door wait, complain ("Locked!", 😠),
  stew (small anger/riot rise), and fall back instead of looping forever.
- **Abstract escape v1** (fictional only — no real-world methods): rare desperate NPC attempts trigger
  the alarm and usually end in solitary; the player gets **Attempt Escape** only near a gate/perimeter,
  as a timed action with caught/interrupted/abandoned/prototype-success outcomes.
- **Player chaos actions**: Comply / Return to Cell / Hide / Calm Down / Help Guard (context-sensitive)
  with suspicion / riot-pressure / tension consequences.
- **HUD/visuals**: LOCK timer chip, chaos banner (lockdown/alarm/riot/objective), red alarm vignette,
  flashing locked-door lamps, panic/anger/"Return to cell" bubbles.
- **Save/load v5**: persists lockdown, alarm, riot pressure, and area tension (escape always resets to
  a stable state on load); backward-compatible with v4 saves.
- **?debug self-test** extended: checkpoints exist, a guard can path to one, riot pressure is a valid
  number, lockdown state is well-formed, and the v5 save round-trips.

## v2.4.1-stability — Stage Stability 2.4 (real bug fixes, remove prototype shortcuts)
Hardening pass to make the codebase ready for Stage Chaos 3.0. Sim authoritative, RenderSync
read-only, build passes, 0 runtime errors.
- **Panel no longer rebuilt every frame**: the loop now refreshes the panel on demand (selection /
  action / inventory / load) and otherwise only ~6–7×/sec, never 60 FPS. Combined with the
  signature-based soft-update, action buttons keep their handlers (reliable taps, far less work).
- **Player needs actions are object-based**: Rest/Wash/Eat/Train/Work now route to the **nearest
  reachable** matching interactable (bed/sink/shower/table/counter/weights/pull-up/job) via
  `requestObjectAction` — not room-only stat shortcuts. If nothing's reachable you get a clear reason
  ("Find a bed.", "No reachable shower or sink.", …). `selfAction` remains only as a fallback.
- **No more stuck "Approaching"**: NPC/guard interactions check for a real route before queuing and
  refuse with a reason ("No route to them." / "They're in a restricted area."); the approach phase has
  a fail-safe timeout that cancels cleanly with a message.
- **Smarter NPC scheduling**: `assignScheduleTarget` now tries the nearest reachable candidates in
  order (not just one), reserves only after confirming a path, and falls back to room/wander otherwise.
- **Door/gate de-duplication**: `WorldRenderer` no longer draws door/gate frames+bars (it kept drawing
  a second static set under Game's moving leaf). It now owns only signs + warning stripes; **Game owns
  all door/gate geometry** (frame + lintel + swinging barred leaf + state lamp; gates render wider).
- **Save/load hardening (more)**: Save button reports failure honestly ("Save failed…") instead of
  always "Game saved"; the storage key is version-neutral (`lockdown_life_save`); a loaded save with a
  missing player id promotes the first prisoner **and marks them as the player** (gold ring/name).
- **Debug self-test** (`?debug`): logs an invariant check on boot — player/map exist, interactables
  registered, bed/sink/table/door/gate present, every door object maps to a door tile, an NPC can path
  to a schedule object, and serialize round-trips without throwing.
- **Code organization**: added `TODO(refactor)` markers at the future system seams (Door/Schedule/
  Interaction/GuardAI/PrisonerAI/SaveSerializer) per `docs/ARCHITECTURE.md`. No large refactor yet.

## v2.4.0-qa — Stage QA 2.4 (audit, truth pass, hardening)
Stabilization pass before the chaos systems — no new gameplay. Sim authoritative, RenderSync
read-only, build passes, 0 runtime errors.
- **README truth pass**: rewritten to describe the *actual* current ECS-lite game (Vite/TS/Three.js,
  DOM HUD, localStorage, procedural geometry, tap controls). Removed claims that only existed in the
  legacy prototype (character creation, WASD/joystick, WebAudio, grab/throw, permadeath, dev panel,
  procedural prison/economy, missions, faction joining, win/escape paths). Added a feature matrix
  (Implemented / Partial / Planned) and active-vs-legacy notes.
- **Changelog**: added a "Current State" summary and clearly separated the rebuilt `v2.x` history from
  the **archived legacy** `v1.x` history.
- **Docs**: added `QA.md` (manual playtest checklist) and `docs/ARCHITECTURE.md` (active structure +
  read-only rule + future refactor candidates: Door/Schedule/Interaction/GuardAI/PrisonerAI/SaveSerializer/Riot/Lockdown systems).
- **Bug fix — HUD churn / flaky taps**: the panel was rebuilding its `innerHTML` (and action buttons)
  every frame; now it only soft-updates volatile values when the structure is unchanged, so buttons
  keep their handlers across frames (fixes dropped taps and wasted work).
- **Save/load hardening**: `hydrate` now defends against old/foreign/corrupt saves — defaults for
  numeric fields, clamped role/kind, string-filtered inventory/stash, invalid object ids ignored,
  transient action/reservation state reset, and it bails out safely (keeping a fresh world) on bad data.
- **Repo hygiene**: page title fixed (`Lockdown Life 3D`), removed an orphaned screenshot script,
  broadened `.gitignore` for ad-hoc test artifacts, added a `check` script.
- **Mobile/UI polish**: the info panel now caps its height and scrolls (never covers the bottom bar),
  bigger close-button and action-button tap targets, long names wrap instead of clipping.

## v2.3.0-interaction — Stage Interaction 2.3 (real doors/gates, schedule anchors, NPC object use)
Doors, gates, schedules, and NPC routines now connect into one physical world. Sim stays
authoritative (RenderSync still read-only; door meshes are a read-only view of sim state),
build passes, 0 runtime errors.
- **Doors/gates block movement**: `findPath` takes a per-entity passability predicate. Closed/locked
  doors are real pathfinding blockers; open doors pass. Prisoners are stopped by **locked** and
  **restricted** (staff-only) doors; **guards pass everything**. Unlocked doors auto-swing open as a
  character walks through.
- **Schedule-driven doors** (`applyDoorSchedule`): cell-block opens at Wake/Lockdown/Lights-Out,
  cafeteria at meals, showers at the shower phase, the yard **gate** during work/yard/free. At Lights
  Out the recreational areas **lock** (guards still pass).
- **Player door flow**: Inspect / Open / Close, and **Try Door** on a locked/restricted door — which
  fails, raises suspicion, and a nearby guard may notice. Tapping anything behind a blocked door now
  reports "Can't reach … a door is locked."
- **NPC schedule anchors**: prisoners target **real interactable objects** for the current phase —
  beds/sinks at wake & sleep, cafeteria tables at meals, shower heads at shower time, weights/pull-up
  bars in the yard, job spots during work — instead of generic room centers. They route to the object's
  interaction point, reserve it (single-use objects), hold a pose, then release.
- **Guards** man guard desks/consoles (Security, Intake) between patrols and route through any door.
- **Reservations** work for both NPCs and the player, with a safety auto-release sweep (timeout / holder
  gone / downed) and release on action complete, cancel, schedule change, and load — no permanent locks.
  Tables/counters/job spots are shared (no reservation) so meals and work never deadlock.
- **Stuck prevention**: unreachable scheduled object → fall back to room anchor → wander in place; blocked
  routes never crash (optional `?debug` logging of path failures + selected-object state).
- **Door visuals**: framed, swinging barred leaf with a state lamp (green open / yellow closed /
  orange locked / red staff-only) plus the existing selection highlight.
- **Save/load** (version 4): persists door open/locked state and hidden stashes; clears all reservations
  and re-derives door states for the loaded phase. Older saves load safely.

## v2.2.0-interaction — Stage Interaction 2.2 (props are real interactable objects)
Props are no longer just decoration — they're tappable world objects with their own actions, reservations,
and state. Sim stays authoritative (interactions mutate the Simulation, RenderSync read-only), camera/
layout/visuals preserved, build passes, 0 runtime errors.
- **Interactable registry** (`src/world/Interactable.ts`): every important prop has an id, type, room,
  world position, **interaction point** (where you stand), facing, per-type actions, reservation, and
  hidden-stash/open state. Owned live by the Simulation.
- **Real hitboxes**: `PropRenderer.dressRooms` registers beds/toilets/sinks/showers/counters/tables/
  weights/pull-up bars/desks/shelves/trash + yard & shower jobs, each with an invisible tap hitbox.
- **Object panel**: tapping a prop opens an object-specific panel (name, room, state chips) with
  context actions — Rest/Use/Wash/Eat/Train/Work/Inspect/Hide/Search — disabled with a reason when
  unavailable (in use, nothing to hide, nothing hidden, staff-only).
- **Walk-to-interaction-point**: actions make the player **walk to the object's interaction tile →
  face the object → perform a timed action → apply → release** (not "inside" the prop).
- **Object-based needs**: Rest/Wash/Eat/Train/Work now run against a specific object instead of a room.
- **Reservation**: one prisoner per bed/shower/toilet/etc.; reservations clear on cancel, on completion,
  and on load.
- **Doors & gates as objects**: each door tile registers a door/gate object with **Inspect** and **Use**
  (open/closed state), restricted/staff-only flagging.
- **Contraband stashes**: beds/toilets/lockers/shelves/trash support **Hide** (stash a contraband item),
  **Search** (reveal a stash), and **Take** — abstract game data only.
- **World jobs**: shelves/yard/shower jobs are object-targeted work points.
- **Light NPC use**: idle NPCs grab a free nearby bed/shower/weights/table, reserve it, hold the pose,
  then release — sharing the same reservation system.
- **Feedback**: selected-object highlight ring, invalid-tap (red) marker vs move (blue) marker,
  status bubbles + reward floats on perform.
- **Save/load** (version 3): persists hidden stashes and door open state; clears all reservations and
  resets transient action state on load. Older saves load safely.

## v2.1.1-feel — Stage Gameplay Feel 2.1 (physical, animated, readable actions)
Game-feel pass: the Milestone-2 systems now visibly happen in the world (sim authoritative, RenderSync
read-only, build passes, 0 runtime errors).
- **Deferred action flow**: choosing an action makes the player **walk into range → face the target →
  lock into a timed action (progress bar) → apply the result → return to idle**. No more instant panel changes.
- **Action states** (talking/threatening/trading/working/resting/washing/eating/training/searching/
  beingSearched/escorting/escorted) shown in the panel + a bottom progress bar.
- **Facing**: characters turn to face interaction/fight/search targets and movement direction.
- **Floating feedback**: world-anchored +Rep / +Respect / Suspicion+ / $± / damage numbers near characters.
- **Speech/icon bubbles** above characters for talk/insult/threaten/trade/search/work + reactions (😠/😨).
- **Visible guard search**: guard walks over, both stop & face, "Search!" bubble + timed search, then
  Clean / Found-it result, confiscation, and floating cue.
- **Visible escort to solitary**: guard walks to the prisoner, the prisoner follows behind to solitary,
  then is placed (with a safety timeout).
- **Combat feel**: fighters face off, impact rings + damage floats, weapon items add hit power, and
  nearby inmates turn to watch.
- **Object/self actions** (Rest/Wash/Eat/Train/Work) play a short timed action with a bubble + reward float.
- **UI**: color-coded action buttons (social/risky/guard/object), disabled actions with reasons
  (e.g. "nothing to trade"), current-action progress bar, "Walking up to…" status.
- **Save/load**: transient action/search/escort states safely reset to idle on load (no crashes).

## v2.1.0-gameplay.2 — Stage Gameplay 2.0 (playable prison-life loop)
First real gameplay layer; sim stays authoritative (interactions mutate sim, RenderSync read-only),
camera/layout/visuals preserved, build passes, 0 runtime errors.
- **Player prisoner**: one inmate is the directly-controlled "You" (gold ring, ★ panel). Camera follows
  the player; NPCs keep their schedules/AI. Player status: gang, reputation, respect, suspicion, money,
  current action, room, needs, inventory.
- **Direct control**: tap floor to walk there (A* + destination marker); tap an inmate/guard to inspect.
- **Context interactions** (panel buttons): prisoners — Talk/Trade/Favor/Insult/Threaten/Fight/Back Off;
  guards — Talk/Comply/Argue; self/room — Rest/Wash/Eat/Train/Work. Out-of-range actions auto-walk closer.
- **Reputation + relationships**: reputation/respect shift from fights, threats, favors, jobs, getting caught;
  NPCs track a relationship-toward-you value (neutral/friendly/enemy…).
- **Gangs v1**: 6 fictional gangs with turf, enemies/allies, accent colors; gang members drift to turf in
  free time; rivals fight more; gang shown on prisoners + panel.
- **Contraband + inventory v1**: abstract items (note, food, medicine, dice, phone, tool, blade, keycard,
  cigarettes) with risk/concealment/suspicion; player + NPC inventories; trade/drop; carrying raises suspicion.
- **Search / discipline / solitary**: suspicion rises in restricted zones / with contraband / fighting; nearby
  guards search, confiscate (concealment vs alertness), and escort to **solitary** (timed) for serious items or fighting.
- **Jobs v1**: room-based tasks (kitchen/cleaner/laundry/yard/porter) give money/respect/reputation.
- **Alerts** for fights, guard response, searches, contraband found, solitary, trades, jobs, respect changes, schedule.
- **UI**: rich player/inspect panel (stats chips, inventory, interaction buttons); **save/load v2** persists
  player id, reputation, relationships, inventories, suspicion, discipline (with version + fallback).
- New data: src/data/items.ts, src/data/jobs.ts; expanded src/data/content.ts gangs; new ECS Social + Inventory components.

## v2.0.0-camera.1 — Stage Camera 1.0 (character-focused follow camera)
The default view is now a close, Hard Time-style character camera instead of a management overview.
- **Character Mode (default)**: smoothly follows the selected prisoner, or a chosen "player" prisoner
  (first prisoner) when nothing is selected. Default zoom pulled way in (~9 half-height): one
  wing/room + nearby hallway, characters ~3x larger and clearly readable.
- **Room / Overview**: pinch or wheel out for a medium room view, or all the way out to the full-
  prison overview (manual only — never the default). Smooth zoom across the whole range.
- Follow uses smooth lerp with a small **movement lead** and a **framing offset** so the subject sits
  left of centre (clear of the right-side stats panel); camera **clamped to prison bounds** to avoid
  black void.
- One-finger drag still pans and **suspends auto-follow for a few seconds**; selecting a prisoner
  **recenters/resumes** follow. Tapping empty space no longer drops your follow target.
- All in IsoCamera + VisualTheme + Game wiring; pathfinding, RenderSync (read-only), schedules,
  guards, selection, and save/load unchanged.

## v2.0.0-layout.1 — Stage Layout 1.0 (real prison complex)
Reworked the floorplan from one hallway-with-themed-rooms into a believable prison complex
(sim/visuals preserved, RenderSync read-only, build passes, 0 runtime errors).
- Bigger 60x44 tile grid with a proper circulation network: a central **spine** + **upper/lower
  cross-corridors** that form junctions, instead of a single strip-mall hallway.
- Distinct connected zones: **Cell Block A** + **Cell Block B** (two housing wings), **Cafeteria**,
  separated **Shower** block, a gated outdoor **Yard**, plus a restricted cluster of **Security**,
  **Intake**, **Storage**, and **Solitary**. Each hangs off a corridor via a 1-tile wall + controlled door.
- Controlled transitions: barred metal doors, a wide **security gate** to the yard, hazard stripes at
  restricted thresholds, and room **signs** (BLOCK A/B, CAFETERIA, SHOWERS, SECURITY, YARD, INTAKE,
  STORAGE, SOLITARY).
- Sim now routes by **room type** (so two cell blocks work): schedules, spawns, guard patrols, and
  needs all resolve a room of the right type; pathfinding verified across every zone.
- Population bumped to 12 prisoners + 4 guards to fill the larger complex.
- Room dressing updated for new zones: cell wings show repeated barred cells (beds/toilets/sinks),
  intake gets a scanner + desk, storage gets shelving, solitary gets cots behind bars; yard/cafeteria/
  showers scale to the new bounds.
- Camera default widened so the whole complex frames cleanly; pan/zoom unchanged.

## v2.0.0-sim.3 — Stage Visual 1.1 (readability & polish)
- Brighter, balanced lighting: stronger ambient/key/hemisphere + exposure; large rooms now get a
  grid of point lights so cafeteria/yard/hallway/guard room stay readable while keeping the mood.
- Camera pulled in (zoom 15 -> 12.5) so characters/props are larger; less empty background.
- Characters scaled up, two-tone prison uniforms (bright jumpsuit + dark trousers) vs darker capped
  guards; thicker brighter selection ring; stronger contact shadow.
- Stronger prop silhouettes (beds w/ headboard, sinks, trays, puddles, chair, fence posts, vents,
  security light) and denser deterministic room dressing.
- Wall polish: brighter top caps for contrast; barred metal door frames; room SIGNS (CELLS, YARD,
  CAFETERIA, SHOWERS, GUARD) over doorways; hazard stripes at restricted doors.
- Exterior concrete slab + dim perimeter lights so the prison no longer floats in a black void.
- HUD: severity-colored HEAT/RIOT chips, riot alarm vignette, fight impact rings, animated alert feed.

## v2.0.0-sim.2 — Stage Visual 1.0 (art-direction pass)
Pure visual upgrade — the Milestone-1 sim is untouched and RenderSync stays read-only.
- **VisualTheme.ts** — single source of truth for all colors, lighting, camera, and UI values.
- **Procedural textures** (CanvasTexture, no downloads): `createConcreteTexture`, `createTileTexture`
  (with wet-puddle sheen), `createGrimeTexture`, `createWarningStripeTexture` — noise, seams, cracks,
  stains, worn paths, hazard stripes.
- **Camera/lighting** — tighter iso framing + zoom limits; ambient + key + hemisphere lights; moody
  per-room point lights (warm cafeteria, cold cells/hallways, blue-gray showers, dark guard room).
- **Floors & walls** — every room has an identifiable textured floor + grime overlay; walls are now
  layered (textured body + lighter top cap); barred metal door frames; hazard stripes at restricted
  doors.
- **PropRenderer.ts + auto room dressing** — beds/toilets/lockers (cells), tables/benches/counter/
  trash (cafeteria), benches/weights/pull-up bar/dirt (yard), shower heads/drains (showers), desk+
  monitors/cabinet (guard room), ceiling lamps/pipes/signs (hallway). Shared geometries/materials.
- **Characters** — capsules replaced with low-poly people (head, torso, chest, arms with hands, legs,
  shoes, eyes, hair; guards get cap, badge, baton). Body-size/skin/hair variation, contact shadow.
- **Animation** — idle breathing, walk leg/arm swing + lean, fight jabs, knocked-down pose, pulsing
  selection ring, bouncing status icons (all derived from sim state, read-only).
- **FX** — riot-driven red alarm vignette, fight impact rings.
- **HUD** — prison-themed dark/metal buttons (icon + label, pressed state, safe-area), HEAT/RIOT
  severity chips, styled alert feed; large mobile tap targets.

## v2.0.0-sim.1 — Prison SIM engine (architecture pivot, Milestone 1)
Reworked toward a living isometric **prison management sim** (Prison Architect/RimWorld-style:
autonomous agents, tap-to-select, schedules) on a clean **ECS-lite engine**, keeping Vite + TS +
Three.js. The previous player-controller game is **preserved** under `src/legacy/` (excluded from the
build, recoverable any time).

New architecture:
- `core/` — Game loop (fixed timestep), EventBus, InputManager (drag-pan / pinch-zoom / tap),
  SaveManager, Random (seeded).
- `render/` — ThreeApp, IsoCamera (ortho iso, mobile pan/zoom), WorldRenderer (instanced walls +
  room floors), CharacterFactory, RenderSync (reads sim, never writes).
- `world/` — TileMap, A* Pathfinding, WorldGen (rooms → tilemap + doors).
- `ecs/` — minimal entity/component store; `sim/Simulation.ts` runs needs/schedule/AI/combat systems.
- `data/` — gangs, names, traits, schedule (JSON + Zod planned).
- `ui/HUD.ts` — DOM overlay HUD (safe-area aware).

Milestone-1 playable slice: isometric prison (cell block, cafeteria, yard, showers, guard room,
hallway), 8 prisoners + 3 guards, daily schedule moving inmates between rooms, decaying needs, A*
movement, emergent fights with nearest-guard response/break-up, **tap-to-select** with a live stats
panel + selection ring, save/load (localStorage), riot-risk meter, and a mobile action bar
(pause / speed / save / load). Simulation is decoupled from rendering.

---

# Archived legacy history (pre-rebuild)

> Everything below describes the **original player-controller prototype** (Hard Time–style:
> character creation, WASD/joystick, WebAudio SFX, factions, grab/throw, permadeath, dev panel,
> procedural missions/economy, escape paths…). That code is archived under `src/legacy/` and is
> **excluded from the current build** — none of these `v1.x` features are guaranteed active in the
> rebuilt ECS game above. Kept for historical context only.

## v1.7.0 — "Impact" (character models + game feel)
- **Character models overhauled again**: smooth-shaded bodies with **shoulders, a tapered chest, a
  rounded head with jaw & ears**, capsule limbs and sphere hands — properly humanoid silhouettes
  instead of stacked boxes.
- **Game feel / juice**:
  - **Hit-stop** — the action freezes for a few ms on every solid blow for weighty impacts.
  - **Camera punch** — a quick zoom-snap on hits (bigger on crits/kills).
  - **Squash & stretch** — characters pop/recoil when struck.
  - **Attack lunge** — the player steps into each strike; heavier knockback.
  - **Kill slow-mo** — a brief cinematic slowdown when an inmate goes down for good.
  - **Movement lean** — characters tilt into their motion for weightier locomotion.
  - More impact particles + a hit flash when you take damage.

## v1.6.0 — "Sharper Steel" (graphics overhaul II)
- **Rebuilt character models**: blocky box limbs replaced with rounded **capsule** arms/legs,
  **sphere hands**, and a **neck** for a softer, more anatomical low-poly silhouette (outlines and
  animation rig preserved).
- **Ground-truth ambient occlusion (GTAO)** added to the post stack for grounded contact shadows in
  corners and under props (best-effort; skipped automatically if unsupported).
- **Emissive light fixtures**: ceiling lamps now glow and feed the bloom pass (and flicker red on
  lockdown) for a moodier, more lit-up block.
- **Cool rim/back light** for stronger silhouette separation against the environment.

## v1.5.0 — "Every Sentence Is Different" (procedural systems pass)
A deep randomness layer so every save plays differently — without breaking the playable layout.
- **Seeded runs**: a `mulberry32` RNG (`randomFloat/int/choice/weighted/chance/shuffle/vary`). Every
  new game rolls a seed (shown & copyable on the intake screen and day summary, saved to localStorage).
- **Procedural faction state**: each run rolls leaders, members, territory, ally/enemy, contraband
  specialty, goals & weaknesses, and a **prison-wide world state** (gang war, crackdown, contraband
  boom, debt crisis, racket, peace…) that biases the whole run.
- **Procedural population**: every inmate/guard gets a randomized **trait** that changes behavior
  (snitches report you, corrupt/bribable guards take payments, strict guards never do, cowards flee,
  workout addicts haunt the gym, runners lurk in maintenance, greedy traders overcharge) plus
  procedural **names/nicknames** and per-NPC animation/speed variation.
- **Reactive Event Director**: 35+ events weighted by heat, reputation, contraband, hunger/health,
  world state and the daily modifier — so events feel responsive, not random spam.
- **Procedural missions/favors**: ask a gang leader/recruiter for work and get a generated objective
  (deliver, smuggle, beat, intimidate, recover stash) with rewards, tracked on the HUD.
- **Dynamic contraband economy**: per-run supply/demand and prices that drift daily and react to the
  world state & daily modifier; trades show price + risk and move the market.
- **Rumors / prison news**: procedural rumors via NPC dialogue and the day summary (manipulative
  NPCs may lie).
- **Daily modifiers**: each new day rolls a modifier (extra patrols, sweep, hot day, black market…)
  shown on the HUD and the day summary.
- **Reactive difficulty director** scales dangerous events with your power/notoriety.
- **Procedural day summary**: a living "prison diary" with the day's biggest event, block state,
  tomorrow's modifier & rumor, and the seed.
- **Dev panel** (` / backtick): show seed, reroll prison, start-with-seed, copy seed, trigger event,
  advance phase/day, spawn mission.
- All procedural state (seed, faction state, economy, daily modifier, traits/names, rumors, missions,
  difficulty) saves & loads (save format v4).

## v1.4.0 — "Do or Die" (living prison, encounters & permadeath)
- **One life, permadeath**: inmates can be **killed** — finishing a downed inmate, or a heavy
  weapon blow — and once dead they're **gone for good** (removed from the world and from your save).
- **Story consequences**: killing earns huge heat, a big sentence penalty (murder; even harsher for
  an officer → facility manhunt/lockdown), notoriety (fear/respect), and the **victim's crew comes
  for revenge**. A rising **body count** drives new endings ("Blood on Your Hands", "The Reaper Walks").
- **Rooms simulate prison life**: inmates now *do* things in the right room/phase — eat at the
  cafeteria during meals, train in the gym/yard, work at job stations, and sleep in their bunks at
  lights-out.
- **Dynamic encounters**: rival-faction inmates randomly **start brawls with each other** out in the
  world (which can end in KO — or, occasionally, death), so the roster shifts over a playthrough.
- Body count shown on the stats screen; combat resolution unified for player, thrown weapons, and
  NPC-vs-NPC fights.

## v1.3.1 — Randomization
- **🎲 Randomize Everything** button in character creation — instantly rolls a random name, build,
  skin, hair, jumpsuit and backstory.
- **Procedurally varied inmates**: every NPC now gets seeded randomization of clothing colour, build,
  skin/hair, accents (beard/glasses/scar) and **combat stats** (health, strength, aggression, fear,
  respect, loyalty). Seeded by ID, so each named inmate stays consistent across save/load while the
  whole roster looks and fights differently every playthrough.

## v1.3.0 — "Hard Time" (deeper sim systems)
Leans the sim toward the Hard Time prison-sandbox feel:
- **Character creation**: after intake, build your inmate — name, body build, skin tone, hair
  style & colour, jumpsuit colour, and a **backstory** that biases your starting stats
  (Bruiser / Schemer / Survivor). Your custom model is rebuilt live and saved.
- **Behaviour-driven sentence**: misbehaving **adds days** to your time (assaulting guards,
  getting thrown in solitary, contraband seized, caught robbing), while **good behaviour cuts it**
  (a clean day with low heat at lights-out shaves a day). Floating "+1 DAY / -1 DAY" feedback and a
  day-summary breakdown make the consequence loop tangible.
- **Grab & throw objects**: loose items (broom, bottle, soap, sharp spoon, smokes…) are scattered
  around the prison — grab them (Interact), then **throw your weapon** (G / 🎯) at a target for big
  ranged damage and knockback.
- Player name & charge shown on the stats screen; new throw control on desktop and mobile.

## v1.2.0 — "Hard Light" (Graphics Overhaul)
A full visual overhaul of the rendering pipeline:
- **PBR materials**: the whole world and all characters moved from flat Lambert shading to
  physically-based MeshStandard materials with tuned roughness/metalness.
- **Image-based lighting (IBL)**: a generated room environment gives soft, baked-looking ambient
  light and subtle reflections on every surface.
- **Post-processing pipeline** (on "High" quality): bloom on highlights, a gritty brightness/contrast
  **color grade**, a screen-space **vignette**, ACES tone mapping (OutputPass) and **SMAA** anti-aliasing.
- **Film-grain + vignette overlay** layered over the 3D view for a cinematic, gritty feel.
- Rebalanced lighting (lower ambient, warmer key, softer fill) tuned for the new materials so the
  scene reads with real contrast and depth.
- The **Settings → Graphics Quality** toggle now switches the post-processing/shadow stack on/off
  for lower-end devices (Simple) while keeping IBL.

## v1.1.1 — Scene backdrops & tighter framing
- Camera pulled in further (orthographic view size 8.5 → **7**, min 5) for an even more
  character-focused frame.
- **Shorter walls** (height 4 → 2.7) so the prison no longer towers over the inmate at the
  closer zoom and you can read rooms over the partitions.
- **Per-area backdrops**: indoors is a dark concrete gloom; stepping into **the yard** swaps to a
  bright sky with **a distant city skyline, lit windows and trees — the free world beyond the
  walls**. Lockdown tints the outdoor sky an angry red. Fog re-tunes to match each setting.

## v1.1.0 — "Up Close & Personal" (Character Focus & Graphics)

Focus pass: pull the camera in tight on the inmate and make the world look grittier and more
readable, so play feels centered on your character.

### Camera
- Default zoom pulled in (orthographic view size 12 → **8.5**, min 6) for a character-focused frame.
- Snappier follow with **velocity look-ahead** — the camera leads your movement so you stay the focal
  point with space ahead of you.
- **Dynamic focus zoom**: the camera pushes in during fights / when hostiles are near, and during
  jobs & training, then eases back out when things calm down.
- Camera now looks at chest height for a more grounded, character-level framing.

### Graphics
- **Toon outline silhouettes** on the player and all NPCs (black back-face shells) for thick,
  readable low-poly characters that pop from the environment.
- **Follow spotlight**: a warm pool of light tracks the player, keeping your inmate lit and central.
- **ACES filmic tone mapping** + sRGB output + exposure tuning for richer, grittier color.
- Rebalanced lighting (lower flat ambient, stronger warm key light) for more contrast and depth.

### Pacing (from prior patch, retained)
- 1 real minute ≈ 2 in-game hours (~9 minutes of active play per in-game day; the clock pauses
  during jobs, training and menus).

## v1.0.0 — Initial release
- Full 3D isometric prison sandbox: 18-room world, animated player + 23 NPCs, 5 factions,
  schedule/heat systems, melee combat, dialogue/trading, inventory/contraband, jobs, training,
  20 random events, save/load, desktop + mobile controls, WebAudio SFX.
- Random-crime intake cutscene with rolled sentence length.
