# Architecture — Lockdown Life 3D

How the active build is organised, the invariants that keep it stable, and where it should be
refactored as it grows. This describes the **current ECS-lite game** (`src/` excluding `src/legacy/`).

## Core principles

1. **`Simulation` is authoritative.** `src/sim/Simulation.ts` owns all game state and runs every
   system (clock/schedule, needs, prisoner AI, guard AI, combat, the player action machine,
   interactions, save/load). Nothing else mutates game state.

2. **`RenderSync` is read-only.** `src/render/RenderSync.ts` reads sim state each frame and animates
   the Three.js characters. It **never writes** to the simulation. `Feedback` (floating text / speech
   bubbles) is likewise pure presentation. This read-only rule is the most important invariant in the
   project — keep it intact.

3. **UI dispatches intents into the sim.** `src/ui/HUD.ts` renders DOM and calls into
   `core/Game.ts`, which translates taps/buttons into `Simulation` method calls
   (`playerMoveTo`, `requestAction`, `requestObjectAction`, …). The sim decides what actually happens.

4. **`EventBus` carries feedback, not logic.** The sim emits string events (`alert`, `impact`,
   `float`, `bubble`, `actionResult`); `Game`/`Feedback`/`HUD` listen and present them. Gameplay never
   depends on a listener existing.

5. **Interactables are sim-owned.** `world/Interactable.ts` defines the object model; `Simulation`
   holds the live `Map<id, Interactable>` (reservation, stash, door open/locked state). `PropRenderer`
   and `Game` build the defs + invisible hitboxes; `Game` also builds the visible door/gate meshes and
   updates them **from** sim state (read-only view).

6. **Doors/gates feed pathfinding.** `world/Pathfinding.findPath` takes a per-entity passability
   predicate. `Simulation.passFor(entity)` consults door state so closed/locked/restricted doors block
   the right entities (guards pass everything; prisoners are stopped by locked/restricted). All
   NPC/guard/player routing goes through `Simulation.path(...)`.

6b. **Two-layer collision (Stage 3.8).** `TileMap` carries `walkable` (1 = floor, 0 = structural
   concrete wall, rendered by `wallTiles`) **and** `blocked` (1 = a prop solid — cell bars, bunks,
   counter, desks, shelves, lockers, gym gear). A tile is enterable only if `map.pathable(idx)`
   (`walkable && !blocked`); the start tile is always allowed so nothing gets stuck. `WorldGen`
   carves cell walls + bars into the map (survives `generate()`); furniture footprints live on the
   `InteractableDef` and are re-applied to `blocked` by `Simulation.setInteractables` on every
   generate/new-run (so collision survives `startNewRun`). Small decals never block, and every
   blocking prop keeps a reachable interaction tile. `?debug`'s `selfTest()` asserts
   `noBlockedOnPath`, `roomsReachable`, `anchorsReachable`, `noEntityInWall`, `cellsOk`,
   `diningClearsCounter`.

7. **Save/load owns persistence.** `Simulation.serialize()` snapshots state (versioned, currently v12);
   `Simulation.hydrate()` restores it defensively (defaults for missing/garbage fields, transient
   action/reservation state reset, invalid object ids ignored, bad data → keep a fresh world).
   `core/SaveManager.ts` is just the `localStorage` read/write.

8. **`src/legacy/` is archived.** Excluded from `tsconfig.json`, never imported by the active build.
   Do not wire it into current features.

## Data flow (one frame)

```
input (tap/drag/pinch)
        │
        ▼
  core/Game.ts ──► Simulation.requestAction / requestObjectAction / playerMoveTo   (intent → sim)
        │                         │
        │                         ▼
        │                 Simulation.step(dt)   (authoritative systems mutate state, emit EventBus)
        │                         │
        ▼                         ▼
  RenderSync.update  ◄──── reads sim state ────►  Feedback.update / HUD.showPanel / door meshes
  (animate chars)                                  (present only — never write)
        │
        ▼
   Three.js render
```

## Module map

| Area | Files | Role |
| --- | --- | --- |
| Core | `core/Game.ts`, `EventBus.ts`, `InputManager.ts`, `SaveManager.ts`, `Random.ts` | loop, input, glue, persistence I/O, RNG |
| ECS | `ecs/world.ts`, `ecs/components.ts` | entity/component store + plain-data components |
| Sim | `sim/Simulation.ts` | authoritative systems (large — see refactor plan) |
| Chaos | `sim/LockdownSystem.ts`, `RiotSystem.ts`, `EscapeSystem.ts`, `GuardCheckpointSystem.ts` | pure types + constants + decision functions for the chaos layer; the Simulation owns the state and orchestrates them thinly |
| AI | `sim/AIIntent.ts`, `PrisonerAISystem.ts`, `AIMemorySystem.ts`, `GroupBehaviorSystem.ts`, `GuardAISystem.ts` | pure AI vocabulary/labels, prisoner-intent scoring, decaying memory, cluster/separation geometry, and guard routes; the Simulation gathers context and applies the chosen intents/roles |
| Combat | `sim/CombatSystem.ts` | pure attack tables (windup/recovery/hit-chance/damage/knockback), attack selection, and hit/block/dodge/miss resolution; the Simulation runs the per-fighter phase machine, RenderSync animates the phases read-only |
| Progression | `sim/Progression.ts` | pure reputation tiers, objective templates/roll, daily-summary rating; the Simulation owns live progression/objectives/daily state and a `prog()` event hook |
| Setup | `sim/NewGameSetup.ts` | pure character-creation model: appearance/traits/backstory/gang-lean/difficulty defs + randomize/sanitize; `Simulation.applySetup()` writes it onto the player |
| Factions | `sim/FactionSystem.ts` | pure gang state/ranks/standing-labels/invite thresholds/crew-goal templates/perks; the Simulation owns one `PlayerGangState` and drives invites/joining/ranks |
| Economy | `sim/EconomySystem.ts` | pure dynamic pricing / search-risk / job-payout / stash-capacity / demand-drift; the Simulation owns one `EconomyState` and runs trade/use/stash/restock |
| Menus | `ui/Menus.ts` | title screen, **new-game setup flow**, tabbed pause overlay (Stats/People/Inventory/Objectives/Gangs/Help), and daily-summary modal — reads `Simulation.uiSnapshot()`, never writes |
| World | `world/TileMap.ts`, `Pathfinding.ts`, `WorldGen.ts`, `Interactable.ts` | grid (walkable + blocked), A*, floorplan + cell carving, object model + footprints |
| Render | `render/ThreeApp.ts`, `IsoCamera.ts`, `WorldRenderer.ts`, `PropRenderer.ts`, `CharacterFactory.ts`, `RenderSync.ts`, `Feedback.ts`, `VisualTheme.ts`, `textures/` | rendering (read-only) |
| UI | `ui/HUD.ts` | DOM overlay |
| Data | `data/content.ts`, `items.ts`, `jobs.ts` | gangs/names/traits/schedule, items, jobs |

## Future refactor candidates

`Simulation.ts` is the only file that has grown large. **Do not do a big refactor mid-feature** — but
when it next needs surgery, split it along these seams (each is already a fairly self-contained block):

- **DoorSystem** — `applyDoorSchedule`, `doorPassable`, `passFor`, door tile registry.
- **ScheduleSystem** — phase clock, per-phase routing, schedule anchors.
- **InteractionSystem** — `requestObjectAction` / `applyObjectAction`, object reservations, the player action machine.
- **GuardAISystem** — patrol / respond / search / escort / guard posts.
- **PrisonerAISystem** — schedule targeting, object use, wander.
- **SaveSerializer** — `serialize` / `hydrate` + versioned migrations.

Chaos layer (Stage 3.0) — shipped as **pure helper modules** with thin Simulation integration:

- **LockdownSystem** — `LockdownState` + duration/door policy + defensive load.
- **RiotSystem** — riot-pressure target + level thresholds + tension labels.
- **EscapeSystem** — abstract opportunity zones + fictional outcome roll (no real-world methods).
- **GuardCheckpointSystem** — builds checkpoint anchors from rooms/doors.

The orchestration (timers, triggers, mutations) currently lives in `Simulation.chaosSystem` and
friends, marked with `TODO(refactor)`. When the surface settles, promote these into stateful
`*System` classes (one step further than the current pure modules). Keep the read-only render rule and
the sim-owns-state rule intact through any refactor.

**AI depth (Stage 3.2).** Guards carry a sticky **role** + a patrol **route** (`GuardAISystem`);
prisoners pick a sticky **intent** via lightweight scoring (`PrisonerAISystem`) from a context the
Simulation gathers (phase/needs/gang/nearby guards-enemies-allies/chaos), and carry a small **decaying
memory** (`AIMemorySystem`) that drives avoidance/retaliation. `GroupBehaviorSystem` provides
cluster/separation geometry so crowds read as loose groups. All of it is pure helpers + thin sim
integration; transient AI (intent, memory refs) resets on load. Still **partial**: no full GOAP
planner, no formal squad tactics, group clustering is geometric (not negotiated), and guard routes are
fixed tables rather than learned/dynamic.

**World / visual / collision (Stage 3.8).** No new sim systems — a render/world/collision pass.
`WorldGen.carveCellBlock` builds real enclosed cells; `TileMap` gains a `blocked` grid and
`pathable()` so props are solid; `Interactable` defs carry a tile `footprint` applied by
`setInteractables`; `Game` draws per-cell barred gates + `?debug` overlays; the cafeteria counter is a
real barrier. Save **v12** with a safe-spawn migration. Still **partial**: the floorplan is hand-
authored (not procedurally generated), cells share one stand tile, and cell gates are visual (the
block door owns lockdown corralling).

**Economy (Stage 3.7).** `EconomySystem.ts` is pure (dynamic `priceFor`, `searchRisk`, `jobPay`,
`stashInfo`, demand drift). The Simulation owns one `EconomyState` (demand/supply/offers) and runs
trade/use/stash/restock; trading reads `tradePanel()` and applies `buyItem`/`sellItem`. Prices factor
demand/supply, contraband heat, relationship, gang membership/rank, reputation, and difficulty. Save
v11 persists it. **Fictional/abstract only** — no real-world contraband/smuggling/concealment detail.
Still **partial**: no deep market simulation or NPC-to-NPC trading economy.

**Factions (Stage 3.6).** `FactionSystem.ts` is pure (ranks/standing labels/invite thresholds/crew-goal
templates/perks). The Simulation owns one `PlayerGangState` and runs `factionSystem(dt)` (invite
lifecycle + rank update). Joining sets the player's `Brain.gang`, so all existing gang behaviour
(ally clustering, rival avoidance, standoffs, turf) applies for free. Standing accrues at social/fight
hooks; the player starts **unaffiliated** (the promoted player's random spawn-gang is cleared in
`generate()`). Save v10 persists membership/rank/standing; invites are transient. Still **partial**:
no gang economy, no hierarchy/squad commands.

**Character creation (Stage 3.5).** `NewGameSetup.ts` is pure data (appearance/traits/backstory/
gang-lean/difficulty + randomize/sanitize). `ui/Menus.ts` runs the setup flow and calls
`Game.beginRun(setup)` → `Simulation.startNewRun(setup)` which **reseeds + re-runs `generate()`**
(now idempotent — resets ECS/chaos/progression) then `applySetup` writes identity/appearance/traits/
standing/needs/money/gang-lean/objectives + difficulty multipliers onto the player. Appearance lives on
the `Render` component so RenderSync (read-only) can show it. Save v9 persists the setup; difficulty is
re-derived on load. Still **partial**: gang joining (lean only), simple low-poly appearance, fixed
backstory/trait tables.

**UI / progression (Stage 3.4).** `Progression.ts` is pure (tiers/objectives/daily rating); the
Simulation owns `progression`, `objectives`, `daily`, and a `prog(kind)` hook called at existing event
sites — no new event bus. `Menus.ts` is a read-only DOM view of `Simulation.uiSnapshot()` (title /
pause tabs / day-summary). The game boots paused at the title; the loop surfaces `pendingSummary` once
per day. Save v8 persists progression/objectives/daily. Still **partial**: no gang **joining**, no
character creation, settings is a placeholder, objectives are a fixed rotating pool (not generated).

**Combat feel (Stage 3.3).** Fights are a per-fighter **phase machine** (squareUp/windup/strike/
recover + reaction phases block/dodge/hitReact/stumble/down) driven in `Simulation.combatSystem`;
`CombatSystem.ts` holds the pure attack tables + hit/defence resolution. RenderSync reads `Brain.cphase`
and poses the low-poly body parts (read-only — no skeletal rig). Knockback is path-clamped. Still
**partial**: no grapples/weapon-specific animations, no combos, NPCs block opportunistically (not
tactically), and fights are intentionally non-lethal (knockdown only).

**Tuning + telemetry (Stage 3.1).** Heat is an eased 0–100 value with discrete event bumps and calm
decay; riot pressure uses hysteresis + cooldowns; lockdowns have a re-entry cooldown (severe events
override); alerts are deduped with categories. `Simulation.metrics` is a lightweight counter map
(fights, searches, lockdowns, alarms, riot warnings/events, escapes, blocked fallbacks, …) read via
`?debug` for playtest summaries — not gameplay state, safe to ignore in save/load.
