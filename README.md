# Lockdown Life 3D

A gritty, system-driven **3D isometric top-down prison-life sandbox simulator**. You control an
inmate surviving daily prison life: factions, guards, combat, contraband, jobs, training,
reputation, relationships, random events, and a path to freedom.

Built from scratch with **Vite + TypeScript + Three.js**, HTML/CSS overlay UI, WebAudio-generated
sound effects, `localStorage` saves, and full **desktop + mobile/touch** controls. All 3D art is
procedurally generated low-poly geometry (no external assets required).

![isometric prison](https://img.shields.io/badge/view-isometric%203D-orange) ![stack](https://img.shields.io/badge/Vite%20%2B%20TS%20%2B%20Three.js-blue)

---

## Quick start

```bash
npm install        # install dependencies
npm run dev        # start dev server  -> http://localhost:5173
```

Then open the printed URL in a browser. On a phone, open the **Network** URL Vite prints.

Other commands:

```bash
npm run build      # type-check (tsc --noEmit) + production build into dist/
npm run preview    # serve the production build -> http://localhost:4173
npm run typecheck  # type-check only
```

---

## How to play

After booking, you **create your inmate** (name, build, looks, jumpsuit and a backstory that biases
your starting stats), then begin your randomly-rolled sentence. Survive each day, build a reputation,
manage your needs, deal with the gangs, and earn your way out.

**Your sentence is not fixed** (Hard Time style): misbehaving in front of guards — fighting,
contraband, assaulting officers, solitary trips — **adds days**, while clean days with low heat
**cut your time**. You can also **grab loose objects** around the prison and **throw** them (`G`/🎯)
as improvised weapons.

**Life and death are permanent.** Inmates live out their daily routines (eating, training, working,
sleeping) and rival crews start brawls of their own. Anyone — including you — can be **killed**:
finish a downed inmate or land a heavy weapon blow and they're **gone for good**. Killing brings a
manhunt, a murder penalty on your sentence, and the victim's faction out for revenge — your **body
count** shapes how your story ends.

### Desktop controls
| Action | Key |
| --- | --- |
| Move | `WASD` / Arrow keys (camera-relative) |
| Sprint | `Shift` (drains stamina) |
| Interact / Use | `E` or `Space` |
| Attack | `F` or **Left-click** |
| Block | `R` or **Right-click** (hold) |
| Shove | `Q` |
| Throw weapon | `G` |
| Grab object | `E` (near a loose object) |
| Inventory | `I` or `Tab` |
| Map | `M` |
| Pause | `P` or `Esc` |
| Zoom | `+` / `-` |

### Mobile controls
- **Left virtual joystick** to move.
- Big action buttons (bottom-right): 👊 Attack · 🛡️ Block · ✋ Interact · 🏃 Sprint · 💬 Talk · 🎒 Inventory.
- HUD buttons (top-right) open Inventory, Stats, Factions, Relationships, Map, and Pause.
- Best in **landscape** (a rotate hint appears in portrait). Page scrolling is disabled while playing.

### The loop
- **Follow the daily schedule** (wake-up, roll call, meals, work, yard, gym, showers, lockdown, sleep).
  Missing roll call/lockdown or loitering in **restricted** rooms raises your **Heat**.
- **Interact** with stations: bunk (sleep to advance the day), weights/bag/track (train Strength/Combat/Agility),
  books (Intelligence), serving counter (eat), showers/phone (mood), work stations (jobs for cash),
  stash spots (hide contraband), medical bed (rest/heal).
- **Talk** to inmates to trade, ask for work, recruit, threaten, bribe guards, ask for protection,
  or **join one of five factions**.
- **Fight** with punches, shoves, blocking, knockback, stamina and stats. Winning earns respect but
  raises heat if guards see you. Getting knocked out sends you to **Medical** (or **Solitary** if your heat is high).
- **Random events** fire throughout the day (yard fights, shakedowns, cell searches, ambushes, recruitment, an escape rumor…).
- **Win paths:** serve your sentence and walk out, become the most respected inmate / **prison kingpin**,
  or discover the **escape plan** (find a *file* + *keycard* and reach the maintenance stash during Lights Out).

Saves are automatic at each day transition and manual from the Pause menu (`localStorage`).

---

## Factions
| Faction | Color | Territory | Values |
| --- | --- | --- | --- |
| **Iron Dogs** | Red | Gym / Yard | Strength & fighting |
| **Blue Kings** | Blue | Cafeteria / Phones | Reputation & deals |
| **Black Vipers** | Green/Black | Storage / Maintenance / Showers | Intelligence & secrecy |
| **Yard Saints** | White/Gold | Cell block / Medical | Loyalty & fairness |
| **Lone Wolves** | Grey | — | Unpredictable |

Helping one faction can anger another; attacking members tanks your standing; high standing unlocks
protection and the ability to join.

---

## Project structure

```
src/
  main.ts                  # entry point + WebGL guard
  style.css                # all overlay UI styling
  game/
    Game.ts                # orchestrator + main loop + game-state machine
    GameState.ts           # central mutable state, stat clamping, relationship levels
    CameraController.ts    # orthographic isometric camera (follow, zoom, shake)
    Input.ts               # keyboard/mouse (camera-relative movement)
    MobileControls.ts      # touch joystick + action buttons
    SaveSystem.ts          # versioned localStorage save/load
    types.ts               # shared type definitions
  world/
    PrisonMap.ts           # floors, walls, props, doors, lights, decals, interactables
    Collision.ts           # circle-vs-AABB collision world
    Navigation.ts          # waypoint routing through the hallway for NPCs
  entities/
    CharacterFactory.ts    # procedural low-poly humanoid rig + animations
    Player.ts              # player movement, stamina, animation
    NPC.ts                 # NPC AI (schedule/wander/fight/flee), pathing
  systems/
    ScheduleSystem.ts  HeatSystem.ts   InventorySystem.ts  CombatSystem.ts
    DialogueSystem.ts  EventSystem.ts  JobSystem.ts        TrainingSystem.ts
    AudioSystem.ts     EffectsSystem.ts
  ui/
    HUD.ts  Menus.ts  InventoryUI.ts
  data/
    factions.ts  npcs.ts  items.ts  events.ts  rooms.ts  schedule.ts
```

---

## Building an IPA for sideloading (iOSGods / AltStore / Sideloadly / TrollStore)

This is a web game, so to get an **`.ipa`** you wrap the production web build in a native iOS
shell using **Capacitor**. The resulting `.ipa` can then be installed via iOSGods' guides,
AltStore, Sideloadly, or TrollStore.

> ⚠️ Building an `.ipa` **requires macOS with Xcode** (Apple's toolchain only runs on macOS).
> The repo already includes a ready `capacitor.config.ts`.

### 1. Build the web bundle
```bash
npm install
npm run build          # outputs dist/
```

### 2. Add Capacitor + the iOS platform (on a Mac)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios        # creates the ios/ Xcode project
npx cap sync ios       # copies dist/ into the native app
```

### 3. Produce the `.ipa`

**Xcode route**
1. `npx cap open ios` to open the project in Xcode.
2. Select a Generic iOS Device, set your Bundle Identifier (`com.lockdownlife.game`) and a Team.
3. **Product → Archive**, then in the Organizer choose **Distribute App → Ad Hoc / Development**,
   or **Export** to get an `.ipa`.

**Command-line route**
```bash
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Release -archivePath build/App.xcarchive archive
xcodebuild -exportArchive -archivePath build/App.xcarchive \
  -exportPath build -exportOptionsPlist ExportOptions.plist
# build/App.ipa is your sideloadable IPA
```

For an **unsigned** `.ipa` (common for re-signing through sideload tools): archive, then wrap the
`.app` into a `Payload/` folder and zip it:
```bash
mkdir -p Payload && cp -r build/App.xcarchive/Products/Applications/App.app Payload/
zip -r LockdownLife3D.ipa Payload
```

### 4. Sideload it
- **iOSGods** — follow their per-tool guide and import the `.ipa`.
- **Sideloadly / AltStore** — drag the `.ipa` in and sign with your Apple ID (7-day free cert) or a paid cert.
- **TrollStore** (supported iOS versions) — import the `.ipa` to install permanently without re-signing.

After any code change, re-run `npm run build && npx cap sync ios` and re-archive.

---

## Known limitations
- NPC pathfinding is lightweight waypoint routing (via the central hallway), not full navmesh A*.
- Characters are stylized low-poly primitives with procedural animation — an intentional "tabletop diorama" look.
- Audio is fully synthesized via WebAudio (no audio files); it unlocks after the first tap/click.
- The escape thread is a single multi-step objective rather than a deep questline.

## Best next polish pass
- A* navmesh + door-aware pathing so guards/inmates flow through doorways more naturally.
- More dialogue branches per archetype and persistent faction storylines / leader missions.
- Post-processing (SSAO, bloom, true outline pass) behind the existing "High" quality toggle.
- Richer combat (heavy attacks, weapon-specific animations, grapples) and crowd AI during brawls.

---

Built with Three.js + TypeScript + Vite. All art procedurally generated.
