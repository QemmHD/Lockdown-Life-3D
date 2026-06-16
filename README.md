# Lockdown Life 3D

A mobile-first, system-driven **3D isometric prison-life simulation**. You control a single
inmate ("You") living out a prison day alongside autonomous prisoners and guards — schedules,
gangs, reputation, contraband, searches, discipline, jobs, and a prison full of real
interactable objects (beds, showers, tables, weights, doors and gates).

Built from scratch with **Vite + TypeScript + Three.js**, a lightweight **DOM/CSS HUD**,
`localStorage` saves, and a small **ECS-lite simulation**. All 3D art is **procedurally generated
low-poly geometry** — no external art/audio assets.

![view](https://img.shields.io/badge/view-isometric%203D-orange) ![stack](https://img.shields.io/badge/Vite%20%2B%20TS%20%2B%20Three.js-blue)

> **Status:** active development. This README describes **what is actually implemented right now**.
> Anything not yet built is listed under [Planned / Future](#planned--future). The previous
> player-controller prototype is archived under `src/legacy/` and is **not** part of the current
> build (see [Legacy](#legacy-archived)).

---

## Tech stack (current)

- **Vite** dev server + production build
- **TypeScript** (strict)
- **Three.js** for rendering (orthographic isometric camera)
- **DOM / CSS** overlay HUD (no UI framework)
- **`localStorage`** saves (versioned, currently v4)
- **Procedural low-poly geometry** built at runtime (no model/texture/audio files)
- A small **ECS-lite** simulation (`src/ecs` + `src/sim`)

There is **no** audio, no WebGL post-processing pipeline, no character-creation flow, and no
keyboard/gamepad controls in the current build.

---

## Quick start

```bash
npm install        # install dependencies
npm run dev        # dev server -> http://localhost:5173
```

Open the printed URL. On a phone, open the **Network** URL Vite prints (same Wi-Fi).

```bash
npm run typecheck  # tsc --noEmit (type-check only)
npm run build      # type-check + production build into dist/
npm run check      # alias: type-check + build
npm run preview    # serve the production build -> http://localhost:4173
```

See [`QA.md`](./QA.md) for a manual playtest checklist and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
for how the code is organised.

---

## How to play

You are the inmate with the **gold selection ring** (named **"You"**). The camera follows you.

- **Move:** tap/click an empty floor tile — you path there (A*), with a destination marker.
- **Inspect / interact with a person:** tap a prisoner or guard to open their panel, then choose a
  social action (Talk / Trade / Favor / Insult / Threaten / Fight / Back Off; guards: Talk / Comply / Argue).
- **Interact with an object:** tap a bed, sink, shower, toilet, table, counter, weights, pull-up bar,
  shelf, trash can, desk, locker, **door** or **gate**. The panel shows that object's actions. You
  walk to its interaction point, face it, and perform a short timed action.
- **Camera:** one-finger drag (or mouse drag) to pan — auto-follow resumes after a moment. Pinch or
  mouse-wheel to zoom.
- **Bottom bar:** Pause · Speed (1×/2×/4×) · Save · Load.

### The loop
- A repeating **daily schedule** (Wake-Up → Breakfast → Work → Yard → Lunch → Free → Showers →
  Dinner → Lockdown → Lights Out) moves the population between areas. **Doors and gates open and lock
  by phase** (e.g. the yard gate locks at Lights Out; the cafeteria opens at meals).
- **Needs** (hunger, sleep, hygiene, energy, anger, fear, health) drift over time. Use the matching
  objects to satisfy them (bed = rest, sink/shower = wash, table/counter = eat, weights/pull-up = train).
- **Suspicion** rises when you carry contraband, loiter in restricted areas, fight, or rattle locked
  doors. When it's high a nearby guard walks over and **searches** you; serious contraband or fighting
  gets you **escorted to solitary**.
- **Gangs (v1):** six fictional gangs with turf, allies/enemies and accent colours. Members drift to
  their turf in free time; rivals are more likely to brawl.
- **Reputation / respect / relationships** shift from fights, threats, favours, jobs and getting
  caught. NPCs track how they feel about you.
- **Contraband / inventory (v1):** abstract items with trade value, risk, concealment and suspicion.
  Trade with inmates, **hide** contraband in stash spots (beds/toilets/lockers/shelves/trash),
  **search** spots, and **take** your stash back.
- **Jobs (v1):** work at job objects (kitchen counter, mop spot, storage shelf, yard cleanup) for a
  little money / respect / reputation.
- **Save/Load:** manual from the bottom bar (`localStorage`).

Autonomous NPCs run the same systems: they follow the schedule to **real objects** (sleep in beds,
eat at tables, wash in showers, train on equipment, work at job spots), reserve single-use objects,
and route through doors. Guards patrol, man guard desks, respond to fights, search, and escort.

---

## Gangs (v1, fictional)

| Gang | Accent | Turf | Notes |
| --- | --- | --- | --- |
| **Iron Block** | Grey | Cell block / Yard | enemies: Redline Crew · allies: North Hall |
| **Yard Kings** | Gold | Yard | enemies: Blue Chain |
| **Blue Chain** | Blue | Showers / Cell block | enemies: Yard Kings · allies: Cell Rats |
| **Redline Crew** | Red | Cafeteria / Yard | enemies: Iron Block |
| **North Hall** | Green | Cell block | allies: Iron Block |
| **Cell Rats** | Tan | Cafeteria / Cell block | allies: Blue Chain |

Gangs are purely fictional game data. Joining gangs is **not** implemented yet (see Planned).

---

## Feature matrix

**Implemented**
- ECS-lite simulation (authoritative) + read-only render sync
- Hand-authored isometric prison map (cell blocks, cafeteria, yard, showers, security, intake, storage, solitary, corridors)
- Player prisoner with gold ring; camera follow
- Tap/click-to-move (A* pathfinding) + destination marker
- Daily schedule / phases
- Autonomous prisoners + guards
- Basic fights + nearest-guard response / break-up
- Gangs v1 (turf / allies / enemies / colours)
- Reputation, respect, suspicion, NPC relationships
- Inventory + contraband v1 (trade / drop / hide / search / take)
- Search → confiscation → discipline → solitary v1 (visible escort)
- Jobs v1
- Interactable props (beds, sinks, showers, toilets, tables, counters, weights, pull-ups, desks, shelves, trash, lockers)
- Doors / gates as real pathfinding blockers + schedule-driven open/lock + schedule anchors for NPCs
- Object reservations (NPC + player) with safety auto-release
- World feedback: floating text + speech/icon bubbles, selection/highlight rings, action progress bar
- Save / load v4 (`localStorage`)
- Touch + mouse: tap, drag-pan, pinch/wheel-zoom

**Partial**
- Guard AI (patrol / respond / search / escort / man desks — but no formal checkpoint rotation)
- NPC object use (light; schedule-anchor driven, no deep daily planning)
- Door permissions (open/closed/locked/restricted/guard-pass; `broken/jammed` & finer roles are placeholders)
- Jobs (small fixed rewards)
- Contraband hiding/searching economy (no dynamic prices)
- Mobile UI polish
- Balance / tuning

**Planned / Future**
- Lockdowns, riots, escape attempts (Stage Chaos 3.0)
- Deeper guard patrols / event director
- Gang joining & faction storylines
- Character creation
- Real audio / SFX
- More animation
- Capacitor / iOS `.ipa` packaging
- Performance profiling

---

## Project structure (active build)

```
src/
  main.ts                 # entry point + WebGL guard + boot
  style.css               # all HUD/overlay styling
  core/
    Game.ts               # orchestrator: loop, input wiring, selection, door visuals, HUD glue
    EventBus.ts           # tiny string-keyed event bus (feedback/alerts)
    InputManager.ts       # pointer/touch: tap, drag-pan, pinch/wheel-zoom
    SaveManager.ts        # localStorage read/write
    Random.ts             # seeded RNG
  ecs/
    world.ts              # ECS-lite entity/component store
    components.ts         # plain-data components (Position, Render, Agent, Needs, Brain, Social, Inventory)
  sim/
    Simulation.ts         # AUTHORITATIVE world: schedule, needs, AI, combat, interactions, save/load
  world/
    TileMap.ts            # logical grid
    Pathfinding.ts        # A* with per-entity (door-aware) passability
    WorldGen.ts           # hand-authored prison floorplan -> tilemap + doors
    Interactable.ts       # interactable-object model (types, actions, reservation/door state)
  render/
    ThreeApp.ts           # renderer/scene/lights
    IsoCamera.ts          # orthographic iso follow camera + pan/zoom
    WorldRenderer.ts      # walls + room floors
    PropRenderer.ts       # room dressing + interactable hitboxes
    CharacterFactory.ts   # procedural low-poly humanoids
    RenderSync.ts         # reads sim, animates characters — NEVER writes to sim
    Feedback.ts           # world-anchored floating text + speech bubbles (DOM)
    VisualTheme.ts        # colours / lighting / camera constants
    textures/             # procedural CanvasTextures
  ui/
    HUD.ts                # DOM overlay HUD (topbar, alerts, panel, action bar, bottom bar)
  data/
    content.ts            # gangs, names, traits, schedule phases
    items.ts              # abstract item/contraband data
    jobs.ts               # job definitions
  legacy/                 # ARCHIVED original prototype — excluded from the build (see below)
```

### Active vs legacy code path
- **Active:** everything under `src/` **except** `src/legacy/`. Entry is `src/main.ts → core/Game.ts`.
- **Legacy:** `src/legacy/` is the original player-controller prototype, kept for reference only. It is
  **excluded from `tsconfig.json`** and never imported by the active build. Don't treat anything in
  `src/legacy/` as a current feature.

---

## Architecture in one paragraph

`Simulation` is the single source of truth and runs the systems. `RenderSync` and `Feedback` **only
read** sim state to draw the world (read-only rule). UI (`HUD`) dispatches player intents into the
`Simulation`, which mutates state and emits feedback via the `EventBus`. Interactable objects (incl.
doors/gates) are owned by the sim; door state feeds the pathfinding passability test. Save/load is a
versioned snapshot of sim state. Full details + future refactor plan: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Known limitations
- Single hand-authored prison (no procedural prison generation).
- Guard/NPC AI is intentionally light; deeper planning is a future stage.
- No audio, no character creation, no riots/escape/lockdown systems yet.
- Balance is rough and subject to change.
- The follow camera reframes the subject slightly left of centre so the right-side panel doesn't cover it.

## Planned next (Stage Chaos 3.0)
Lockdowns, riots, and escape attempts — built on the existing doors/gates, schedule, and AI systems.

---

## Legacy (archived)
`src/legacy/` contains the earlier "Hard Time–style" player-controller build (character creation,
WASD/joystick controls, WebAudio SFX, factions, grab/throw, permadeath, dev panel, missions, escape,
etc.). **None of those features are in the current ECS-lite build.** The history of that prototype is
preserved at the bottom of [`CHANGELOG.md`](./CHANGELOG.md) under *Archived legacy history* for context.

Built with Three.js + TypeScript + Vite. All art procedurally generated.
