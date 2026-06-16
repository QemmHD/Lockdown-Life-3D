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

7. **Save/load owns persistence.** `Simulation.serialize()` snapshots state (versioned, currently v4);
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
| World | `world/TileMap.ts`, `Pathfinding.ts`, `WorldGen.ts`, `Interactable.ts` | grid, A*, floorplan, object model |
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

**Tuning + telemetry (Stage 3.1).** Heat is an eased 0–100 value with discrete event bumps and calm
decay; riot pressure uses hysteresis + cooldowns; lockdowns have a re-entry cooldown (severe events
override); alerts are deduped with categories. `Simulation.metrics` is a lightweight counter map
(fights, searches, lockdowns, alarms, riot warnings/events, escapes, blocked fallbacks, …) read via
`?debug` for playtest summaries — not gameplay state, safe to ignore in save/load.
