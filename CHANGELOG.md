# Changelog

> **Current State (read me first).** The active game is the **rebuilt ECS-lite simulation** —
> all `v2.x`+ entries below. Stack: **Vite + TypeScript + Three.js**, DOM/CSS HUD, `localStorage`
> saves (v12), procedural low-poly geometry. Implemented: player prisoner, tap-to-move (A*),
> follow camera, daily schedule, autonomous prisoners/guards, basic fights, gangs/factions,
> reputation/relationships, inventory/contraband + dynamic economy, search/discipline/solitary, jobs,
> a **believable floorplan with real individual cells + prop collision** (no walking through walls/
> bars/counters/beds), interactable props, doors/gates with schedule-driven locking + NPC schedule
> anchors, object reservations, character creation, save/load (v12), and a **chaos layer** (lockdowns,
> alarm, riot pressure, area tension, guard checkpoints, abstract escape attempts), plus **procedural
> audio** (synthesized SFX + ambient bed). **Not yet built:** music, Capacitor/IPA, deep riot warfare.
> The `v1.x` entries are **archived legacy history** for the original
> prototype that now lives under `src/legacy/` (excluded from the build) — those features are
> **not** active in the current game. Latest QA pass: **Stage QA 2.4** (truth/docs/hardening).

## v4.20.0-crafting — Stage 4.20 Crafting (combine two items into something better)
A named Hard Time pillar, and the make-side of the contraband loop. Build + smoke + probe green; render/UI only over existing data — no save change.
- A **🔧 Workshop** panel in the Inventory tab lists every recipe you currently hold the parts for. **Skill-gated**: lower-skill recipes
  show a Craft button, higher ones show the skill you still need.
- Recipes: **Ferment Hooch** (snack ×2), **Sharpen a Shiv** (part ×2), **Fashion a Pipe** (tool + part), **Hone a Blade** (shiv + part),
  **Rig a Phone** (batteries + part) — turning cheap junk into vices, weapons, and the rare phone.
- **Risk + growth**: success scales with Skill (≈60–95%); a botched attempt **wastes the parts**; crafting contraband nudges suspicion,
  and every craft teaches you a little **Skill**. Ties the trained Skill stat, the economy, and the new vices together.
- Version → `v4.20.0-crafting`.

## v4.19.0-throw — Stage 4.19 Throw weapons + balance & AI hardening (adversarial-review pass)
"Anything's a weapon" gets the throwing half, and a multi-agent review pass tightened the last five stages. Build + smoke + probe green; save bumped 16 → 17 (backward-compatible).
- **Throw your weapon**: a **Throw** button appears in a fight when you're armed (shiv/blade/pipe/tool). Hurl it for a big burst (and a
  real knockdown shot — blunt pipes especially), with a splatter and heat spike — **but you're unarmed for the rest of the brawl**. A
  genuine risk/reward: spend the shiv now, or keep it for the bleed.
- **Review-pass fixes** (from an adversarial multi-agent review of v4.14–4.18):
  - **Training is now actually zero-sum**: stations shave their paired stat harder and gains hit **diminishing returns near the cap**, so
    you specialize a build instead of farming STR/AGI/STA all to 99. Respect from training slowed.
  - **Vices can't pin Spirit anymore**: vice morale gain **diminishes the fuller you already are**, and every vice now **costs sleep**
    (coffee most) — no more zero-downside Spirit fountain holding the adrenaline band for free.
  - **Adrenaline finisher reined in**: lower health threshold (30%) and now a **chance**, not a guaranteed auto-KO.
  - **Guards never get stuck investigating**: they give up and stand down if the fight scatters / the suspect is unreachable or hauled to
    solitary, and a lockdown cleanly preempts an in-progress investigation.
  - **No breakdown mid-escort**; save **version 17**.
- Version → `v4.19.0-throw`.

## v4.18.0-guards — Stage 4.18 Smarter guards (notice → investigate → respond)
Guards no longer teleport-react to violence from across the block — positioning and cover finally matter. Build + smoke + probe green.
- A guard who **sees** a fight (range + line-of-sight) now **clocks it, pauses to notice** (a short, distance-scaled beat — closer
  guards react faster), then **walks over to investigate** before fully committing to break it up.
- If the brawl is **still going** when they arrive, they escalate to a full **response**; if it **scattered**, they walk to the spot,
  look around, and **stand down** — so a quick fight out of sight can go unpunished.
- **Already-alert guards stay instant**: during an **alarm or lockdown** they respond immediately, and **assaulting a guard** still trips
  the whole block at once. A lockdown/riot starting mid-investigation **preempts** it (they man their post). Riot/heat escalation timing
  is untouched.
- New transient `investigate` state/role; no save change.
- Version → `v4.18.0-guards`.

## v4.17.0-juice — Stage 4.17 Animation & combat-FX overhaul (render-only)
The sim has always been richer than what you could see — this pass makes the bodies act it out. Build + smoke green; pure presentation,
**no sim or save change** (RenderSync stays read-only).
- **Full body language**: every state now has a pose loop — sleep-curl on the bunk, hammer/scrub at work, hand-to-mouth eating,
  shower scrub, squat/curl training, gesture-and-nod talking/trading, arms-out frisk, alert respond — instead of one idle stance.
- **Combat reads**: a **weapon appears in your hand** when violence is on (shiv/blade/pipe/tool), brows **furrow with anger / lift with
  fear**, injured fighters **limp and hunch**, the KO'd **sprawl face-down**, and a winner throws a quick **victory arm-pump**. The
  nervous **breakdown** now visibly shakes.
- **Hit juice**: a new pooled **particle system** throws **sparks on every contact** and a **blood splatter on a solid blow** — fights
  finally feel like they land. Capped/recycled pool (no GC churn), reset cleanly on new run/load.
- Version → `v4.17.0-juice`.

## v4.16.0-builds — Stage 4.16 Character builds (zero-sum training + attributes that bite)
Training is no longer a free ride to a maxed character — the Hard Time "you can never be good at everything" identity. Build + smoke green.
- **Stations train different stats**: the **weights** build **Strength**, the **pull-up bar** builds **Agility** (each also tops up Stamina).
- **Zero-sum couplings**: bulking up on the weights shaves a little **Agility**; agility drills shave a little **Strength**; **reading**
  a book/magazine raises **Skill** but costs a sliver of **Reputation** (bookish reads as soft). You steer a build, you don't max it.
- **Agility now bites in a fight**: agile fighters **recover between swings faster** (up to ~18% quicker at 99 AGI vs the floor) — so the
  STR-vs-AGI choice is a real damage-vs-tempo trade, on top of Strength's existing damage scaling.
- All attributes are floored at 30, so couplings can't gut a stat. Rides existing data — **no save change**.
- Version → `v4.16.0-builds`.

## v4.15.0-mind — Stage 4.15 Mind states (breakdown & adrenaline finisher)
The Spirit bar now has real drama at both ends — the missing "your mind can break / your mind can carry you" beat. Build + smoke + behavioral probe green.
- **Nervous breakdown**: let Spirit bottom out (≈0) and you **snap** — a ~6–10s loss of control. You're locked out of acting,
  thrash in place (anger climbs, a little health bleeds), then **pull yourself back together** with Spirit nudged off the floor.
  A hard, legible punishment for neglecting your head — manage it with food/hygiene/rest and **vices**.
- **Adrenaline finisher**: ride Spirit **above 90%** into a fight and your hits land **+28%** (was +15% over 80%), and a solid
  blow on a staggered, unguarded foe **finishes them outright** ("ADRENALINE!") — the high-Spirit payoff to match the breakdown risk.
- Transient `breakdown` state on the existing Brain — **no save-format change**; a save made mid-breakdown loads back to normal.
- Version → `v4.15.0-mind`.

## v4.14.0-vices — Stage 4.14 Vices (smoking & drinking feed the Spirit bar)
Hard Time's vice loop — something now feeds the Spirit/Mind bar from the demand side of contraband. Build + smoke green.
- Three consumables: **☕ Instant Coffee** (legit), **🚬 Cigarette**, and **🍶 Prison Hooch** (both contraband). Use one for an
  immediate hit of **Spirit (morale)** plus anger/fear relief.
- It's a **gamble, not a freebie**: cigarettes cost a little health, hooch costs more — and the stronger the vice, the higher the
  chance it **makes you sick** (extra health loss + a Spirit clawback + hunger). Coffee is the safe, mild option.
- Plays straight into the **adrenaline buff** (push Spirit > 80% before a brawl for +15% damage) — a real "drink before the fight?"
  decision, traded against the health hit and sickness risk.
- New `vice` use-kind; vices auto-flow through the **economy/search** like any item (inmates carry & sell them, guards confiscate them).
- Rides the existing `Needs.morale` field — **no save-format change**; old saves load unchanged.
- Version → `v4.14.0-vices`.

## v4.13.0-spirit — Stage 4.13 Spirit (the second bar)
Adds Hard Time's missing HUD half — your mental state now matters. Build + smoke green.
- New **Spirit** meter on every inmate (gold bar in the player panel, under Health). It **sags** when
  you're neglected, hurt, or afraid, and **lifts** when you stay fed / clean / healthy.
- **Adrenaline rush**: Spirit > 80% makes your hits land **+15%** harder. **Breakdown**: Spirit < 20%
  cuts your damage to **~82%** — keep your head together.
- Persists in the save (it rides on Needs). Foundation for the full adrenaline / nervous-breakdown
  states + vices loop in the roadmap.
- Version → `v4.13.0-spirit`.

## v4.12.0-decor — Stage 4.12 Lived-in decor
More props so the block feels used (your "more decor" ask). Build + smoke green; render-only.
- Scattered **non-interactive clutter** — crates, buckets, trash bags, stacked boxes — through the
  common rooms (cells/solitary skipped — already furnished), only on free walkable tiles so nothing
  blocks movement.
- With the moodier 4.9 lighting + the 22-inmate population, the prison reads far more lived-in.
- Version → `v4.12.0-decor`.

## v4.11.0-social — Stage 4.11 Conversations & NPC grudges
First slice of the smarter-AI + Hard Time conversations plan. Build + smoke green.
- **Conversations that change relationships**: open any inmate and **Compliment** (build the bond —
  better with your Skill stat) or **Recruit** (once they trust you, rel ≥ 35) to make them a **sworn
  ally** who jumps into your fights (feeds the 4.6 allies-on-sight system).
- **NPCs settle scores**: a brawl now prioritizes a **remembered foe** in the room over a random
  target — grudges (from being beaten, insulted, or a prior fight) drive real NPC-vs-NPC drama.
- Factored a shared `startNpcFight` (random brawls, gang standoffs, and grudges all route through it,
  releasing object reservations cleanly).
- Version → `v4.11.0-social`.

## v4.10.0-warden — Stage 4.10 Warden release conditions
From the deep research — Hard Time's parole-style condition system. Build + smoke green; save v16.
- The **warden sets you a timed condition** — e.g. "get your strength to 48 by day 9", "earn 60
  respect", "save up $20", or "keep your reputation below X". Meet it by the deadline → **3 days off**
  your sentence + a rep bump; blow it → **+3 days** (no court — just the warden's word).
- A new condition is issued whenever you don't have one and aren't near release; shown as a 📋 alert
  and in your Stats. Persists in save (v16).
- Makes the sentence an **active goal you steer toward**, not a passive countdown — and gives your
  trained stats / money a concrete payoff.
- Version → `v4.10.0-warden`.

## v4.9.0-realism — Stage 4.9 Realism lighting pass
First step on the "less cartoony" graphics ask (research-driven). Build + smoke green; render-only.
- **Killed the flat ambient wash** (ambient 1.35→0.5, hemi 0.85→0.42) — the #1 thing making it read
  as flat/toy.
- **Proper 3-point light rig**: a stronger **warm key**, a cool **fill** (lifts shadows so they're not
  crushed black), and a low **back rim** that separates characters/walls from the background.
- **Moodier palette**: darker charcoal bg + tighter fog for atmospheric depth; grittier walls/floors;
  softer shadows (radius + normalBias, less peter-panning); exposure eased so the key doesn't blow out.
- Net: real shadow contrast + depth — grounded and gritty, orange jumpsuits still pop.
- Planned next realism steps (in docs): procedural normal/roughness maps, an EffectComposer post stack
  (GTAO/grade/vignette, adapted from legacy/PostFX), richer props/decor, and a more accurate layout.
- Version → `v4.9.0-realism`.

## v4.8.0-balance — Stage 4.8 Pacing & guard rebalance (playtest feedback)
- **Longer days**: a game-hour is now **12s** (was 5) — days ~2.4× longer, so there's time to actually
  live the prison day instead of speed-running.
- **Slower needs**: hunger/sleep/hygiene build **~3–4× slower** (hunger now takes ~a full day to bite,
  not ~80s); anger creeps gentler. You manage needs a couple times a day instead of chasing them.
- **Guards notice realistically**: a guard only responds to a fight if one is within **~14 units AND
  has line-of-sight** (no more reacting from across the prison, through walls) — unless an alarm/
  lockdown already has them alert.
- **You can fight the cops**: guards now have an **Attack** option — but hitting one trips the
  **alarm**, spikes heat/suspicion, and sends **every** guard after you. A Hard Time death wish.
- Version → `v4.8.0-balance`.

## v4.7.1-balance — Allies balance patch (adversarial-review fixes)
Fixes the 5 issues a multi-agent review found in 4.6 allies (the game had gotten unfairly deadly):
- **Lethal risk now only counts enemies actually targeting you** (your own allies / bystanders no
  longer inflate the death chance), and the pile-on term was eased (0.2 → 0.14).
- **Dialogue-escalated fights** (insult/threaten) now pull in **at most 1** enemy, not 2 — no more
  unwarned 2-enemy gank from a social action.
- **Back Off actually disengages** every inmate swinging at you (was leaving you chased while idle).
- Rallied inmates **release their object reservation** when pulled into a brawl (no stuck locks).

## v4.7.0-bleed — Stage 4.7 Bleeding blades
Sharp weapons now **cut** — a Hard Time staple. Build + smoke green; item data + transient state only.
- **Bleed DoT**: a hit with a **Sharp Object** or **Shiv** opens a wound — the victim bleeds
  (~1.3% / 0.9% health per second for ~6s, refreshing on each cut). A blade can **finish a wounded
  foe** even after you disengage, and bleeding *you* out to 0 is a **GAME OVER**.
- A 🩸 pops on the wound; a **medical item** stops the bleeding (and clears injuries).
- Blunt weapons knock down, sharp weapons bleed — weapon choice now has real identity.
- Version → `v4.7.0-bleed`.

## v4.6.0-allies — Stage 4.6 Allies rush in
Who you're connected to now decides a fight — straight out of Hard Time. Build + smoke green.
- **Allies jump in**: start a brawl and nearby inmates who can **see** it (line-of-sight) take sides —
  your **gang mates** and **friends** (high relationship) pile in **for you** (up to 2).
- **Enemies pile on**: the foe's crew, your **enemies**, and rival gangs jump in **against you** (up to
  2) — and with 4.1's lethality, getting swarmed can get you killed. Pick your fights.
- New **line-of-sight** check (structural walls block sight) gates who notices; `allyHelp` telemetry
  tracks your backup.
- Only fires on **player-initiated** fights, so a swarm is a consequence of a bad fight you chose.
- Version → `v4.6.0-allies`.

## v4.5.0-survival — Stage 4.5 Survival stakes
Needs finally have teeth — the survival loop matters. Build + smoke green; no save change.
- **Death by neglect**: let **hunger or sleep** max out and it eats your **health** — for you that's a
  **GAME OVER** (the death ending is now reachable without a fight, true to Hard Time). Eat / rest
  before you collapse.
- **Stamina pays off**: higher **Stamina** slows how fast hunger/sleep/hygiene build up — your trained
  stat keeps you going longer.
- **Self-care heals**: keep hunger + sleep low and your **health regenerates** over time (also slowly
  recovers injuries).
- Version → `v4.5.0-survival`.

## v4.4.0-stats — Stage 4.4 Stats & Training
Adds Hard Time's attribute core — your fighter is now **built, not fixed**. Build + smoke green; save v15.
- **Attributes** (new ECS `Attributes` component): **Strength / Agility / Skill / Stamina**, 0–99
  (floor 30). Every inmate + guard has them; guards start tougher.
- **The "25% rule"**: an attribute is only as good as your **energy** —
  `effective = base × (0.75 + 0.25 × energy)`. Tired = weaker.
- **Strength drives combat**: hit damage scales with your **effective strength** (~0.88× at STR 30 to
  ~1.3× at STR 99), on top of weapon/armor.
- **Training builds you**: working out (weights / pull-up bar) raises **Strength** + **Stamina** each
  session (energy cost) — real, visible progression, no XP/levels (pure Hard Time).
- Player panel shows your **💪 strength**; attributes persist in save (**v15**).
- Version → `v4.4.0-stats`.

## v4.3.0-escape — Stage 4.3 Escape is a project
Escape stops being a one-tap coin flip and becomes a multi-day plan — Hard Time's signature pillar.
Build + smoke green; save format **v14** (persists the escape site).
- **Start a Way Out**: at a perimeter opportunity (yard / intake / storage, or by a gate) **with an
  escape tool** (Improvised Tool / keycard), you start a hidden escape **site**.
- **Work the Way Out**: chip at it over several sessions — each adds ~20% progress (and suspicion).
  A guard within range can **catch you mid-dig** and wreck the whole site (+heat, +2 days, alarm).
- **Break Out** (only at 100%): runs the real escape resolution (your tool improves the odds) → the
  **ESCAPED** ending, or caught → solitary.
- The instant, desperate **Rush the Gate** option remains.
- HUD objective shows live site progress; the site **persists in your save** (v14) so a half-dug
  route survives a reload — a break-out consumes it.
- Version → `v4.3.0-escape`.

## v4.2.0-gear — Stage 4.2 Gear power ladder
Contraband stops being points-and-risk and becomes Hard Time's "buy gear that changes what you can
**do**" ladder. Build + smoke green; save format unchanged (item data only).
- **Weapon tiers**: new **Makeshift Shiv** (cheap, concealable sharp), **Steel Pipe** (blunt — knocks
  down), and the **Improvised Tool** is now a weak weapon too, alongside the existing **Sharp Object**
  (most lethal). Weapon damage scales (`combat × 0.025`); a real weapon (combat ≥ 3) can turn a
  knockdown lethal (4.1) and raises guard **heat** when the player swings it.
- **Armor**: a **Padded Vest** soaks ~28% of incoming damage in a fight.
- **Blunt knockdowns**: the pipe (`wKnock`) can drop a foe even at moderate health.
- **Escape gear matters**: the **Improvised Tool** (`escapeAid`) measurably improves escape-attempt
  odds — the priciest contraband finally pays off, feeding the real ESCAPED ending.
- Version → `v4.2.0-gear`.

## v4.1.0-death — Stage 4.1 Death & Injuries
Wires up the third Hard Time ending and gives every fight real stakes. Sim-authoritative, build +
smoke green, save format unchanged (v13 — injuries are transient).
- **Death is real (GAME OVER)**: a brutal knockdown can now KILL the player — risk scales with a
  **weapon**, **near-zero health**, a **pile-on** (multiple attackers nearby), and **chaos**
  (lockdown/riot/alarm); the `tough` trait halves it. Routes to the `endRun('dead')` verdict card.
- **No more free heal**: the old auto-revive floor (health snapping back to 0.45 on standing up) is
  gone — you get up at **0.2** and stay hurt, so losing a fight actually costs you.
- **Injuries**: a beating leaves you **injured** for ~20–40s — your hits land **30% softer** until you
  heal (a **medical item** clears it instantly, or it wears off with time). Exposed as `injured` on
  the player snapshot.
- Version → `v4.1.0-death`.

## v4.0.0-sentence — Stage 4.0 The Sentence (Hard Time spine)
Turns the open-ended day-loop into an actual **game with a goal and an ending** — the core of
Mdickie's _Hard Time_. Sim-authoritative, save format v13, typecheck + build + smoke green (verdict
card + sim-freeze verified in headless Chrome).
- **Sentence**: you now serve a **term** (length scales with difficulty + backstory). The HUD shows
  **"N days left"**. Each day served counts down; a clean + productive day (no solitary, objectives
  met) can earn **time off for good behavior**.
- **Misconduct adds time**: getting caught with **contraband** (+1 day) or thrown in **solitary**
  (+2 days) extends your sentence, with an on-screen "+N days" warning.
- **Endings / win-lose**: the run now actually ends with a **verdict card** — **RELEASED** (served
  your time = win), **ESCAPED** (broke out = alt win, now wired from a real successful escape instead
  of the old "prototype ending" stub), or **GAME OVER** (death — `endRun('dead')` is wired up, fully
  triggered in 4.1). The sim **freezes** on the verdict; the card offers New Game / Main Menu.
- **Save/load v13**: persists sentence + days served (older saves default to a fresh 30-day term).
- **Design**: added `docs/HARDTIME-DESIGN.md` — a research-derived design bible for the full Hard
  Time remake that the 4.x roadmap follows.
- Version → `v4.0.0-sentence`.

## v3.9.0-audio — Stage 3.9 Audio
The game's first **sound**. 100% **procedural** WebAudio (no asset files, in keeping with the
procedural art), and pure **presentation** — `AudioSystem` only listens to the `EventBus` and reads a
per-frame tension snapshot; it never touches the simulation. Typecheck + build pass, smoke test green
(0 console/page errors), save format unchanged (v12).
- **New `src/audio/AudioSystem.ts`**: a lazily-created `AudioContext` (resumed on the first user
  gesture for mobile autoplay policy), a master gain driven by mute/volume, and synthesized cues
  (enveloped oscillators + filtered noise bursts). One-shots stop + disconnect on `ended` so nothing
  leaks over a long session; every cue is throttled so bursts collapse instead of crackling.
- **Event cues** (wired in `core/Game.ts` off the existing bus): combat **thud** on `impact`, a typed
  cue per `alert` (`fight`→hit, `lockdown`→tone+clang, `critical`/`search`/`guard`/`warning` stings,
  `player`/`trade`→positive two-note), and a UI **confirm** on `actionResult`. `info`/`system`/`phase`
  stay silent.
- **Door audio**: `updateDoors` now detects open/close transitions per room door and plays a sliding
  rattle (open) or metal clang (close) — primed on the first frame so there's no startup burst, and
  silent while paused / at the title.
- **Ambient bed + alarm**: a quiet institutional **drone** (detuned low saws through a lowpass) whose
  gain + filter cutoff rise with **riot pressure**, ducked overnight and when paused/in menus; a
  pulsing **klaxon** kicks in during alarm/lockdown. Driven each frame from the game loop.
- **Mute toggle** (`ui/HUD.ts` topbar 🔊/🔇 button + `style.css`): mutes everything incl. ambient;
  mute + volume **persist to `localStorage`** and restore on boot. Kept in the topbar so the 5-button
  bottom action bar stays uncrowded on mobile.
- Version → `v3.9.0-audio`.

## v3.8.1-atmosphere — Stage 3.8B Atmosphere & Bloom
A small **presentation** follow-up to the 3.8 / 3.8A overhaul — adds depth and "juice" on top of the
brighter palette without touching the simulation. Render-only (`RenderSync` stays read-only), art
stays 100% procedural (no asset files), typecheck + build pass, 0 runtime errors, save format
unchanged (v12).
- **Cinematic atmosphere** (`index.html` + `style.css`, new `#atmosphere` layer): a zero-cost CSS
  overlay above the canvas / below the HUD — edge **vignette**, gentle cool-top/warm-bottom **colour
  grade** (`soft-light`), and a faint static **film grain** from an inline SVG `feTurbulence` data-URI
  (`overlay`). No WebGL post-processing pass. Kept deliberately gentle so it **complements** 3.8A's
  brighter, more-readable palette rather than darkening it. `#atmosphere` is intentionally outside its
  own stacking context so the blend layers grade against the canvas.
- **Fake bloom** (new `render/Glow.ts`): additive, camera-facing **glow sprites** on emissive props
  (ceiling lamps, security light, doorway/hallway signs, intake scanner) — bloom without a post
  pipeline, off a single shared cached soft-disc texture.
- **Selection / player ground glow** (`CharacterFactory.ts` / `RenderSync.ts`): a soft additive pool
  of light under the selected/player inmate (gold for *you*, green for a selected NPC), pulsing with
  the selection ring — improves at-a-glance "who am I" readability.

## v3.8.0-world — Stage World / Visual / Layout Overhaul 3.8
A pass over the **world/render/collision** layer (no new sim systems): a believable floorplan with
**real individual cells**, a **prop-collision model** so characters can no longer walk through walls,
bars, counters, beds, or desks, a cleaner cafeteria, stronger art direction, and a collision audit.
Sim authoritative, RenderSync read-only, build + typecheck pass, 0 runtime errors. All `?debug`
collision invariants PASS.
- **Prop-collision model** (`world/TileMap.ts`): new `blocked` grid distinct from `walkable`.
  `walkable=0` = structural concrete walls (rendered by `wallTiles`); `blocked=1` = prop solids
  (cell bars, bunks, counter, desks, shelves, lockers, gym gear) — not pathable, but **not** drawn as
  concrete. `pathable()`/`isPathable()` gate all movement; `Pathfinding.findPath` routes around both
  (start tile always allowed so nothing gets stuck). Small decals (trash, trays, puddles, signs,
  benches, dirt) never block.
- **Real individual cells** (`world/WorldGen.ts` `carveCellBlock` + `Cell`): each housing wing is a
  2-tile cell-block corridor lined with enclosed cells — concrete side/back walls, a barred front with
  a **1-tile door gap**, a bunk + toilet + sink, and a guaranteed reachable stand tile. 24 cells total.
- **Barred cell gates** (`core/Game.buildCellGates`): every cell gets a visual sliding barred gate at
  its gap that opens/closes/locks with its block's door state (read-only view of the sim).
- **Cafeteria fix**: dining tables on the entry side; the **serving counter is a real barrier**
  (blocked tiles) with the kitchen behind it reachable only through a staff gap — a prisoner pathing
  from the door to a table provably never crosses the counter.
- **Furniture footprints**: blocking props declare a tile `footprint` (`world/Interactable.ts`);
  `Simulation.setInteractables` re-applies cell bars + footprints to the collision grid on every
  generate/new-run, and nudges any entity caught on a freshly-blocked tile.
- **Art direction**: brighter cell lighting, shorter cell-block interior partitions so the iso camera
  sees into cells while the outer shell stays tall, richer bunk/sink/counter dressing, layered
  serving counter with warming wells. Procedural CanvasTextures + instancing only — no external assets.
- **Collision audit** (`?debug`): `selfTest()` adds `cellsOk`, `blockedTiles`, `noEntityInWall`,
  `roomsReachable`, `anchorsReachable`, `noBlockedOnPath`, `diningClearsCounter`. New overlays draw
  blocked tiles (red), door/interaction anchors, and the live player path.
- **Save/load v12**: bumped for the new layout/object ids; **safe v11→v4 migration** snaps any saved
  entity that now sits inside a wall/cell-bar to the nearest pathable tile on load (no entity ever
  loads inside a wall).
- **Merged: Stage 3.8A Visual Direction** (parallel branch) — brighter, more readable palette (vibrant
  orange jumpsuits, less muddy grey), upgraded low-poly character models (faces/hair/body variation),
  a toggleable character-follow **perspective** camera mode (HUD Camera button / `C` key) alongside the
  classic iso overview, in-world status bars, and improved animations. Combined with the world/cell/
  collision pass above, this completes the visual overhaul. All collision invariants still PASS.
- **Navigation fixes** (post-merge): tap-to-move is now **forgiving** — a tap that lands on a wall/prop
  beside a narrow corridor or cell snaps to the nearest walkable tile within 2 tiles instead of doing
  nothing (you can no longer "miss" a 3-wide hallway at close zoom). The **character camera** was rebuilt
  as a **fixed high 3/4 follow** — a perspective close-up that tracks the player's position but does not
  orbit behind them. This removes the spin/disorientation when turning, sits high enough to clear the
  2.0-tall corridor walls, and pulls back far enough not to feel cramped (horizontal drag rotates the
  view; pinch dollies in/out).
- **Mobile fit**: zoom-out is now **device-aware** — `IsoCamera.setWorldSize` makes "fully pinched out"
  frame the entire prison on any aspect ratio (a tall iPhone portrait needs a much wider zoom than the
  old fixed max of 40, so the whole map can finally fit on screen). Added `orientationchange` +
  `visualViewport` resize handling so the canvas re-fits when iOS rotates or shows/hides its toolbar.

## v3.7.0-economy — Stage Economy / Contraband Depth 3.7
Turns inventory/money/contraband/jobs/trading into a real loop. Sim authoritative, RenderSync
read-only, build passes, 0 runtime errors. New pure module `EconomySystem.ts`. Fictional/abstract
only — no real-world contraband/smuggling/concealment detail.
- **Richer items** (`data/items.ts`): categories (food/hygiene/comfort/utility/barter/risky/crew/rare/
  medical), demand/supply weights, rarity, and use effects + new items (soap, towel, cards, book,
  batteries, commissary token, medical wrap, repair part, crew marker).
- **Dynamic prices**: base × rarity × demand/supply × contraband-heat × relationship × gang × reputation
  × difficulty, each with a short reason ("in demand", "crew price", "rival markup", "they like you").
- **Trade panel**: open an inmate → **Trade** → buy/sell their items at live prices with risk/contraband
  warnings; rivals charge more or **refuse**; crew members give a discount.
- **Item use**: food/hygiene/comfort/medical items affect needs; barter/currency items are trade-only.
- **Stash depth**: per-object capacity + concealment + risk label ("looks safe/so-so/risky") on the
  object panel; stash from the inventory menu or in-world.
- **Search risk** now factors carried item **risk + concealment + count** (not just suspicion); crew
  goods confiscated cost gang standing.
- **Gang economy**: crew discounts scale with rank, crew **supply offers** in the Gangs menu, rivals
  overcharge/refuse.
- **Jobs**: payouts via an economy model (trait × reputation × gang rank × work-streak × difficulty),
  occasional item rewards, daily job earnings tracked.
- **Daily market**: demand/supply drift + market restock at each day rollover.
- **Economy objectives** (earn/buy/sell/use/stash) + **daily-summary** economy lines (bought/sold/job
  earnings/confiscated/crew) and ratings (Broke/Hustling/Stocked Up/Crew Earner/Costly Search…).
- **Inventory menu** is now active: Use / Stash / Drop + value/risk/concealment/demand/category.
- **Save/load v11**: persists economy (demand/supply/offers/trades), job streak; backward-compatible
  with v10–v4 (old saves get a default economy).
- **?debug self-test+** (economy state, price sanity, offers) + telemetry (trades/buys/sells/itemsUsed/
  stashed/confiscated/jobMoney/restocks/crew offers/economy objectives).

## v3.6.0-factions — Stage Gang Joining / Faction Progression 3.6
Turns gang **lean** into real, joinable factions. Sim authoritative, RenderSync read-only, build
passes, 0 runtime errors. New pure module `FactionSystem.ts`; the Simulation owns one `PlayerGangState`.
- **Standing** per gang (−100..100) with labels (Hated→Allied); rises from talking/favours/trades with
  members + completing crew goals; nudges rivals the other way. Joining/attacking a crew shifts it.
- **Invitations**: when standing + respect are high enough (and a member is around), a crew **invites**
  you — alert + "Come see me." bubble + a "Decide whether to join …" objective; invites expire on a timer.
- **Joining via an NPC**: inspect a crew member → **Ask About Gang / Accept Invite / Decline** (also from
  the Gangs menu). Joining sets the player's gang so all existing gang systems (ally clustering, rival
  avoidance/standoffs, turf) treat you as a member; rivals turn cold, allies warm.
- **Ranks**: Associate → Member → Trusted → Enforcer → Shot Caller, derived from standing + respect +
  completed crew goals; rank-ups are announced.
- **Crew goals**: 2 abstract gang objectives on join (talk to crew / train / earn respect / pull a
  shift / defuse a standoff) tracked alongside daily objectives.
- **Perks** (small, by rank): crew trades/favours more readily, allies cluster + watch you, easier
  calming, rivals wary (but guards watch high ranks). **Tradeoffs**, not free power.
- **Player now starts unaffiliated** (the promoted player no longer inherits a random spawn gang); the
  character-creation **gang lean** seeds initial standing (Gang Associate starts closer to an invite).
- **Gangs menu** shows membership, rank, perks, an invite card (Accept/Decline), per-gang standing +
  labels + ally/rival, crew goals, and a Leave Gang button. **NPC panels** show gang standing +
  ally/rival/invite and the gang actions.
- **Save/load v10**: persists membership/rank/standing/goals/cooldowns (invites reset on load);
  backward-compatible with v9–v4 (old saves → unaffiliated, standing seeded from lean).
- **?debug self-test+** (gang state, rank derivation, faction in snapshot) + telemetry (invites
  generated/accepted/declined/expired, rank-ups, gang joined, standing changes, ally help).
- **Docs preflight**: fixed stale README/ARCHITECTURE notes (save was "v4", "no character creation",
  "gang joining not implemented") to match the real current build.
- Limitations: no gang economy, no deep hierarchy/squad commands, fictional/abstract only.

## v3.5.0-newgame — Stage Character Creation / New Game Setup 3.5 (run identity)
Makes **New Game** a real character/run setup. Sim authoritative, RenderSync read-only, build passes,
0 runtime errors. New pure module `NewGameSetup.ts` + a setup flow in `ui/Menus.ts`.
- **Setup flow** (no page reload): Identity → Appearance → Traits & Backstory → Start Conditions →
  Review, with Back / Next / Randomize / Begin Run and a step indicator. Cancel returns to the title.
- **Identity**: name + optional nickname + optional seed (the nickname becomes your in-game name);
  a random-name button; text is sanitized + length-capped.
- **Appearance**: skin / hair / jumpsuit-accent swatches + body build (slim/average/stocky), applied to
  the player's low-poly model via a new `Appearance` on the Render component (RenderSync reads it).
- **Traits**: pick 2 strengths + 1 weakness from 10 each (Tough/Fast/Calm/Clever/Loyal/Hard Worker/
  Smooth Talker/Watchful/Scrappy/Quiet · Hothead/Cowardly/Unstable/Weak/Lazy/Paranoid/Clumsy/Hated/
  Slow/Trouble Magnet). Mapped to sim tokens so they affect movement, combat, jobs, search, favours,
  suspicion, calming, etc. — small, non-overpowered.
- **Backstory archetypes** (8, fictional): First Timer / Street Kid / Former Worker / Yard Fighter /
  Quiet Planner / Gang Associate / Lone Wolf / Short Fuse — each seeds starting reputation/respect/
  suspicion/money/item, a bonus trait, a gang bias, and the first objectives.
- **Gang lean** (standing, not membership yet): warm to a chosen crew, cool to its rivals.
- **Difficulty** (Easy Time / Standard / Hard Time / Nightmare Block) tunes heat gain, search
  threshold, riot pressure, objective rewards, needs decay, and starting money; plus chaos intensity
  (low/normal/high) and tutorial-tips toggle.
- **Review** screen summarizes everything; **Randomize** rolls a full valid identity.
- **Apply to sim**: `Simulation.startNewRun(setup)` regenerates the world (reseed) and `applySetup`
  writes identity/appearance/traits/standing/needs/money/items/gang lean/objectives/difficulty onto the
  player entity. Stats/Gangs/Daily-summary menus surface the setup.
- **Save/load v9**: persists the setup + appearance; backward-compatible with v8–v4 (old saves get a
  default setup + standard difficulty, no crash). Title **Continue** shows the saved name + day.
- **?debug self-test+**: setup builds/applies, name in snapshot, randomize valid, old-save migration.
- Limitations: gang **joining** still planned; appearance is simple low-poly; no RPG class system.

## v3.4.0-ui — Stage UI/Menu/Progression 3.4 (goals, menus, day summary, reputation tiers)
Turns the sim into a game with direction. Keeps the in-game HUD/panel; adds the missing structure
layer. Sim authoritative, RenderSync read-only, build passes, 0 runtime errors. New pure module
`Progression.ts` (tiers/objectives/daily rating) + DOM `ui/Menus.ts`.
- **Title screen**: Play / Continue (if a save exists) / New Game / How to Play + version. The game now
  boots paused at a title over the dimmed world instead of dropping straight in.
- **Pause/menu overlay** (bottom Pause button): tabbed — Objectives / Stats / People / Inventory /
  Gangs / Help / Settings, plus Save / Load / Resume / Main Menu. Game pauses while open; mobile-readable.
- **Stats screen**: needs bars, money/respect/reputation/suspicion/heat, gang, discipline/solitary, the
  reputation **tier** + progress bar, and lifetime totals (days survived, objectives, jobs, fights W/L,
  searches, solitary, lockdowns, contraband).
- **Reputation/respect tiers**: Nobody → Known Face → Respected → Feared → Influential → Prison Legend,
  from a combined standing score, with a progress bar and light effects (better favor odds, stronger
  threats, more willing trades at higher tiers).
- **Objectives v1**: 3–4 daily goals (eat / wash / job / talk / earn $ / +respect / train / return to
  cell during lockdown + a "survive the day without solitary" goal), event-driven progress, small
  rewards, an always-on **HUD objective tracker**, completion alerts.
- **Daily summary**: an end-of-day card at the day rollover (rep/respect/money change, fights, jobs,
  searches, solitary, lockdowns, objectives, a flavour rating: Quiet Day → Lockdown Magnet) — shown once.
- **Relationships / Inventory / Gangs screens**: read the live sim — who feels how about you (+ memory
  hints), carried items with risk/concealment/value/contraband warning, and gang standing/territory/allies.
- **Help overlay**: concise "How to Play" on the title and in the menu.
- **Progression data model**: lifetime totals tracked via a central `prog()` hook on existing events
  (eat/wash/job/talk/fight/search/contraband/solitary/lockdown/escape/day/money/respect/relationship).
- **Save/load v8**: persists progression, objectives, daily stats, last-summary day. Backward-compatible
  with v7/v6/v5/v4 (older saves get sensible defaults).
- **?debug self-test+**: progression/objectives/tier/snapshot checks; telemetry includes objectives
  completed + summaries shown.

## v3.3.0-combat — Stage Combat/Animation Feel 3.3 (phased fights, reactions, physical feel)
Combat-feel pass — fights now have rhythm, defence, knockback, and readable animation. No new
progression/economy. Sim authoritative, RenderSync read-only, build passes, 0 runtime errors. New
pure module `CombatSystem.ts` (attack tables + outcome resolution); a per-fighter phase machine runs
in the Simulation; RenderSync animates the phases read-only.
- **Combat phases**: squareUp → windup → strike → recover, with reaction phases block / dodge /
  hitReact / stumble / down → recover. Each fighter holds a phase + timer; RenderSync poses arms/torso/
  legs per phase (pull-back windup, snapping strike, raised-guard block, side-shift dodge, jerk-back
  hitReact, wobble stumble) — no skeletal rig, just the existing low-poly transforms.
- **Spacing**: fighters keep a combat distance (step in when far, back off when too close) instead of
  overlapping; knockback/shove movement is path-clamped (never through walls/locked doors); watchers
  keep their distance.
- **Attack types v1** (abstract): quick / heavy / shove, each with windup, stamina, hit chance, damage,
  knockback. Auto-selected from anger/fear/energy/weapon/trait (player can queue their choice).
- **Defence**: hit / glancing / blocked / dodged / miss outcomes with "Blocked"/"Dodge"/"Miss"/
  "Glancing" feedback + impact/block flashes; damage numbers only on real hits. NPCs occasionally raise
  a guard; fearful inmates dodge more.
- **Knockback / stumble / knockdown**: hits shove + stagger the target; heavy hits or low stamina can
  knock them **down** (non-lethal), then they recover. Winner gains respect/reputation, loser loses
  standing + gains fear; the loser remembers who beat them.
- **Player combat panel**: while fighting, the panel becomes **Strike / Heavy / Shove / Block / Back
  Off** (only shown mid-fight); inputs influence the next phase, Block opens a brief block window.
- **Guard interruption**: responding guards shout "Break it up!", shove fighters apart, add suspicion,
  and escalate to search/escort/solitary if it continues.
- **Crowd payoff**: nearby inmates watch (capped at 5, throttled bubbles), fearful ones flee, and a
  growing crowd nudges area tension up.
- **Standoff → fight**: AI 3.2 standoffs can now **escalate** to a squared-up fight (angry rivals, no
  guard near) or **defuse** (guard present / cowardly), tracked in telemetry.
- **Consequences**: fights raise suspicion + heat and can trigger a search or escort to solitary.
- **Telemetry+**: attacks attempted, hits, misses, blocks, dodges, knockdowns, guard interruptions,
  standoffs escalated/defused, fight disciplines, player combat choices, fights started/ended.
- **Save/load v7**: transient combat phases reset safely on load (no fighter stuck in windup/fight);
  persistent outcomes (health/respect/relationships/memory/suspicion/discipline) remain. Backward-
  compatible with v6/v5/v4.

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
