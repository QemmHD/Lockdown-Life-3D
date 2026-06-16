# Changelog

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
