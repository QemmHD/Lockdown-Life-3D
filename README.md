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
- **`localStorage`** saves (versioned, currently v12)
- **Procedural low-poly geometry** built at runtime (no model/texture files)
- **Procedural audio** — synthesized at runtime via WebAudio (no sound files, Stage 3.9)
- A small **ECS-lite** simulation (`src/ecs` + `src/sim`)

There is no *WebGL* post-processing pipeline in the current build. The cinematic look (edge vignette,
cool/warm colour grade, faint film grain — Stage 3.8B) is a **zero-cost CSS overlay** layered over the
canvas, not a render pass, so it stays mobile-cheap. Audio is fully **synthesized** (no asset files)
and mutes/persists from a topbar toggle. Controls are touch/mouse only (no keyboard/gamepad).

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

You are the inmate with the **gold selection ring** — the one you create in **New Game** (name, look,
traits, backstory, difficulty). The camera follows you.

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

Gangs are purely fictional game data. You can build standing with a crew, get invited, and **join** one — gaining a rank, perks, crew goals, and rival consequences (Stage 3.6).

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
- **Believable floorplan with real individual cells** (concrete walls + barred fronts + bunk/toilet/sink) and a **two-layer collision model** — characters cannot walk through walls, bars, counters, beds, or desks
- Interactable props (beds, sinks, showers, toilets, tables, serving counter, weights, pull-ups, desks, shelves, trash, lockers) with solid footprints + reachable interaction tiles
- Doors / gates / cell gates as real pathfinding blockers + schedule-driven open/lock + schedule anchors for NPCs
- Object reservations (NPC + player) with safety auto-release
- **Chaos layer**: lockdowns, alarm state, riot pressure, area tension, guard checkpoints, blocked-prisoner reactions, abstract escape attempts, and player chaos actions
- World feedback: floating text + speech/icon bubbles, selection/highlight rings, action progress bar, chaos banner + alarm vignette
- Save / load (`localStorage`, versioned) incl. chaos / progression / setup state
- Touch + mouse: tap, drag-pan, pinch/wheel-zoom

- **Guard AI v2**: roles (patrol/checkpoint/response/escort/search/desk/lockdown/riot) + patrol routes + coordinated response (no pile-on)
- **Prisoner AI**: intent scoring (schedule/socialize/group/avoid/flee/watch/return-cell/hide/comply) + decaying memory + group clustering + standoffs
- **Combat feel**: phased fights (squareUp/windup/strike/block/dodge/hitReact/stumble/down/recover), attack types, knockback, knockdown, player combat panel, guard interruption, crowd reactions
- **Structure layer**: title screen, tabbed pause menu (Stats/People/Inventory/Objectives/Gangs/Help), reputation tiers, daily objectives + HUD tracker, end-of-day summary, progression totals
- **Character creation**: new-game setup (name/appearance/traits/backstory/gang-lean/difficulty), randomize, run identity applied to the player
- **Faction progression**: build standing → NPC gang invite → join, ranks (Associate→Shot Caller), crew goals, small perks, rival consequences, Gangs menu
- **Economy / contraband depth**: item categories + dynamic prices (demand/supply/heat/relationship/gang), trade panel (buy/sell), item use, stash capacity/risk, job payouts + streak, daily market restock, gang/crew supply, economy objectives & daily summary
- **Cinematic atmosphere (3.8B)**: zero-cost CSS overlay (edge vignette + cool/warm colour grade + film grain) over the canvas, **fake-bloom glow halos** on emissive props (ceiling lamps, security light, signs, scanner) via additive sprites — no post-processing pass — and a soft additive **ground-glow pool** under the selected/player inmate (gold for *you*, green for a selected NPC)
- **Procedural audio (3.9)**: synthesized WebAudio (no sound files) — combat thud, door slide/clang, typed event cues (fight / lockdown / search / alarm / trade…), UI confirm, an **ambient bed** that rises with riot pressure + an **alarm klaxon**, all ducked when paused. Topbar mute toggle, persisted to `localStorage`; AudioContext unlocks on first tap (mobile autoplay-safe)

**Partial**
- Guard AI (roles + routes + checkpoints, but no formal squad tactics / dynamic routes)
- Prisoner AI (lightweight intent scoring + memory, not a full GOAP planner)
- Combat (phased + defensive + non-lethal knockdown; no grapples/combos/weapon-specific animations)
- Riot event (small controlled flare-up, not a full riot-warfare sim)
- NPC object use (schedule-anchor driven, no deep daily planning)
- Door permissions (open/closed/locked/restricted/guard-pass; `broken/jammed` & finer roles are placeholders)
- Jobs / contraband economy (small fixed rewards, no dynamic prices)
- Balance / tuning · Mobile UI polish

**Planned / Future**
- Deeper riot warfare, event director, deeper gang hierarchy/squad commands
- Settings menu (volume slider, difficulty), deeper appearance / cosmetics
- World expansion / more areas
- Audio depth: music / stingers, positional per-area mix
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
    Glow.ts               # additive fake-bloom sprites + ground-glow (no post pipeline)
    VisualTheme.ts        # colours / lighting / camera constants
    textures/             # procedural CanvasTextures
  audio/
    AudioSystem.ts        # procedural WebAudio: event cues + ambient bed (presentation; bus-only)
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
- The chaos layer is a first vertical slice — riot *events* are small and controlled, not full riot warfare.
- Audio is procedural (synthesized SFX + ambient bed) — no music yet. Character creation, menus, objectives, reputation tiers, and gang lean exist; gang joining is added in Stage 3.6.
- Balance is rough and subject to change.
- The follow camera reframes the subject slightly left of centre so the right-side panel doesn't cover it.

## Chaos layer (Stage 3.0)
- **Lockdowns** lock recreational areas, send prisoners back to cells, post guards at checkpoints, and lift on a timer.
- **Alarm** state (red vignette + flashing door lamps) fires on escape attempts, riots, serious fights/contraband.
- **Riot pressure** (the RIOT meter) builds from prisoner mood + incidents and eases with met needs; it can reach a warning and, rarely, a small riot event.
- **Area tension** per room (Calm → Critical) from crowding + gang rivalry.
- **Abstract escape** (fictional only): rare NPC attempts, plus a player **Attempt Escape** near a gate/perimeter with caught/interrupted/abandoned/prototype-success outcomes.
- **Player chaos actions**: Comply, Return to Cell, Hide, Calm Down, Help Guard.
- **Tuning (3.1)**: eased Heat that decays when calm, smoothed riot pressure with hysteresis + cooldowns, lockdown re-entry cooldown, deduped alerts, contextual player panel, and `?debug` playtest telemetry (`sim.metrics`).

## Planned next — the Hard Time 4.x remake
The game is being built toward a **modern remake of Mdickie's _Hard Time_**. The full design is in
[`docs/HARDTIME-DESIGN.md`](./docs/HARDTIME-DESIGN.md); the staged roadmap:
- **4.0 — The Sentence** ✅ (shipped): serve a term, time-off / added-time, **release / escape / death** endings.
- **4.1 — Death & stakes**: remove the revive floor, wire fatal beatings to `GAME OVER`, persistent injuries.
- **4.2 — Gear power ladder**: weapon tiers (shiv / blunt) + armor + tool-driven doors/escape.
- **4.3 — Escape as a project**: acquire a tool → dig/cut over days → hide from searches → break for the wall.
- **4.4 — Stats & training**: two-bar survival (energy/morale) + attributes (STR/AGI/SKILL…) with the "25% rule".
- **4.5 — Allies & vendettas**: recruit a crew that fights for you; NPC-vs-NPC feuds; notoriety that NPCs react to.
- Plus a graphics/animation pass, a settings menu, and iOS (Capacitor) packaging.

---

## Legacy (archived)
`src/legacy/` contains the earlier "Hard Time–style" player-controller build (character creation,
WASD/joystick controls, WebAudio SFX, factions, grab/throw, permadeath, dev panel, missions, escape,
etc.). **None of those features are in the current ECS-lite build.** The history of that prototype is
preserved at the bottom of [`CHANGELOG.md`](./CHANGELOG.md) under *Archived legacy history* for context.

Built with Three.js + TypeScript + Vite. All art procedurally generated.
