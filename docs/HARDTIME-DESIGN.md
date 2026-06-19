<!-- Auto-generated from the Hard Time research workflow; the build roadmap derives from this. -->

# Lockdown Life 3D — Design Bible
### A modern remake of MDickie's *Hard Time*

---

## 0. The Soul (read this first)

Hard Time is not a "prison game with combat." It is an **emergent-chaos sandbox with no goals**, where a handful of dumb-but-readable AI rules collide to generate absurd, personal stories ("I swept floors for a week to fund a knife, joined the wrong gang, got my arm cut off, and dug out with a shovel at midnight"). Three pillars make it *Hard Time*:

1. **Everything is a trade-off.** Health buys attributes. Happiness costs health. Reputation buys obedience but raises your sentence. You can never max everything. *Every action spends something.*
2. **Anything is a weapon, anyone is an actor.** Furniture, food, fire, NPCs — the world is one interactive physics soup. There is no "player layer" and "NPC layer"; the same rules drive all 100+ inmates.
3. **No goals, total persistence.** You write your own objective. The world keeps running, never pauses, and remembers — even your dead character lives on as an NPC owning the same cell.

A 2026 remake must keep that soul intact while replacing the jank/opacity that frustrated (not charmed) players: unreadable menus, hidden numbers, zero onboarding, and combat that felt random. **Keep the chaos. Fix the legibility.**

Our codebase is already well-aligned: an authoritative `Simulation`, read-only `RenderSync`, ECS `Needs`/`Social`/`Brain` components, a phased `CombatSystem`, and pure `FactionSystem`/`EconomySystem`/`EscapeSystem`/chaos modules. The bible below maps each Hard Time system onto these existing seams.

---

## 1. Stats & Survival — the two-bar, six-attribute core

**Essence:** Two volatile meters (green Health/energy, thin yellow Mind/morale) gate six persistent attributes that are "only as good as your health" (up to 25% weaker when tired). Hunger is *not* a third bar — food just tops up green. Sleep is the main restore but you **cannot sleep while full of energy** (anti-fast-forward). Stamina governs both drain rate and sleep recovery.

**Our embodiment:**
- Extend the existing `Needs` component into a clean **two-bar model**: `energy` (green) + `morale` (yellow). Keep `hunger`/`hygiene`/`sleep`/`anger`/`fear` as *internal modifiers* that feed those two bars, not as separate HUD meters. Add a `bladder` timer.
- Add an `Attributes` component (persistent) alongside `Needs` (volatile): `{ strength, agility, skill, stamina, reputation, attitude }`, each `0..99`, floor 30, cap 99. Map our existing `Social.reputation`/`respect` into `reputation`.
- **The 25% rule** as a single derived getter every system reads: `effective(stat) = base * (0.75 + 0.25 * energy/max)`. Combat, jobs, movement all read `effective`, never `base`. This is the cheapest, most faithful coupling in the whole game.
- **Amber ceiling:** an `energyCeiling` that slowly drops the longer energy stays under ~0.25, recovers on good sleep. Config/difficulty-gated (HT3 made it optional).
- **Sleep gate:** allow sleep only when `energy < ~0.6` and not in adrenaline/breakdown state. Sleeping fast-forwards via the existing schedule clock.
- **Bladder:** advanced by eat/drink/smoke; expire away from a toilet → soil event → `morale` + `reputation` hit + an NPC-visible criticism signal. Toilet/shower become interactables (shower full clean, sink half-rate).

---

## 2. Attributes & Progression — XP-free, tradeoff-driven

**Essence:** No XP, no levels. Stats drift up/down as a *direct consequence* of actions, and **each gain costs another stat or your health.** Strength↔Agility are coupled by body type (5% swings). Intelligence/Skill↔Reputation are inversely coupled (studying lowers rep). This *is* the progression — soft caps + persistence + tradeoffs give builds identity (bruiser / acrobat / fixer / shot-caller).

**Our embodiment:**
- A `TrainingSystem` where each rep is a transaction: `energy -= cost; attribute += delta`. Reuse job/interactable stations tagged `{ stat, deltaPerTick, healthCost, minStatReq }`. Weights→STR, treadmill/laps→AGI+STAMINA, books/computer→SKILL, pool→STAMINA, basketball minigame→AGI.
- **Encode the couplings as rules in the same system:** STR gain applies partial AGI decay via a shared `bodyType` scalar (drives a cosmetic mesh/build swap on the `Appearance` component — slim/average/stocky already exists); SKILL gain applies small REP decay.
- **Do NOT add an XP bar or levels.** Persistence + soft caps + tradeoffs are the progression. This reads cleanly in ECS — systems just mutate component floats. Our `Progression.ts` should hold *tiers/objectives for feedback*, not levels.

---

## 3. Combat — wrestling-derived, phased, lethal-optional

**Essence:** A real-time brawler built on **4 verbs + direction + modifiers**, where the *same input* yields a totally different move depending on phase (standing/grapple/grounded/armed) and direction held. Super attack = ATTACK+RUN. Grapple → strike/run/pickup = suplex/DDT/throw/choke. **No block button** — you defend by *retreating* (passive block roll) or *holding grapple to parry/counter into a chokehold*. Three loss states: **KILLED / UNCONSCIOUS / SUBMIT.** Adrenaline rush (yellow full) = +10% all + finishers; breakdown (yellow empty) = lose control. Allies rush to aid if they can *see* you. Sharp weapons bleed/sever; blunt weapons knock out; riot shield blocks 95%.

**Our embodiment (we already have a phase machine — extend it, don't replace):**
- Our `CombatSystem` already runs `squareUp/windup/strike/recover + block/dodge/hitReact/stumble/down`. Add phases **GRAPPLE / GROUNDED / ELIMINATED** and a data-driven **MoveResolver**: `(phase, verb, direction, hasWeapon) → MoveId`. Designers add moves via a table, no code.
- Surface the 4 verbs as contextual on-screen buttons (touch/mouse parity): **Strike, Heavy (=ATK+RUN), Grab, Shove, Taunt, Pick-Up/Throw**. On desktop map to A/S/Z/X + Space/Focus/Taunt.
- **Defense without a block button:** a `Retreating` tag (set when moving away from foe) grants a passive block roll; holding Grab during an incoming strike rolls a parry → reverse attacker into a choke. Counter chance = `f(effective skill)`. This rewards spacing + timing — the core feel.
- **Weapon sub-schema** replacing `combat?: number`: `{ class: SHARP|BLUNT|FIREARM|THROWN|SHIELD, baseDamage, bleedOnHit, dismemberChance, knockoutBias, range, ammo?, fireMode }`. Sharp → apply a `Bleeding` DoT component + raise a `Dismember` roll. Blunt → raise a stagger/knockout meter. Shield → 0.95 block roll.
- **Three elimination outcomes**, not just our current knockdown: at 0 health enter DOWNED, run a stamina-scaled recovery roll each tick; fail → Hospital (heal, halve bank) or permadeath. Submit fires when a hold's struggle meter is lost. These become game events the schedule/court systems consume.
- **Adrenaline/Breakdown** as morale-threshold states (new `BrainState` values, reusing `down`/`solitary` pattern): rush at morale≥0.95 (+10% all + next-move-is-special); breakdown at morale≤0 (`LossOfControl` ~60s — AI takes over the player, wander/attack/steal).
- **Multi-on-one:** reuse `AIMemory.ally` + `GroupBehaviorSystem` — on a fight-start event, faction members **within line-of-sight** pathfind to assist (LOS matters tactically). Attacking a gang member raises a faction `Revenge` counter scaling future ambushes.
- **Persistent injury/limb state** (per-limb intact/scarred/severed): severed arm removes arm-moves from the MoveResolver (forces kicks), slows stand-up, raises climb-fall. Drive visuals via bone-hide on the low-poly body + a capped blood-splatter particle pool.

---

## 4. Items, Weapons, Contraband & Crafting

**Essence:** One pooled inventory of *physical carried objects* (~30 types), not a slot grid. Pick up / drop / hold-to-lift (STR-gated) / throw-with-direction. Items trigger a "special action" when held standing still (broom = sweep job, beer = drink, shovel = dig). Consumables are the vice loop: **happiness up = health down, with a sickness risk.** Crafting = combine two objects (RUN+PICKUP), also reloads guns; SKILL-gated. Contraband (cigarettes, beer, syringes, weapons) gets you searched/arrested; cigarettes double as currency.

**Our embodiment:**
- Replace the flat `use`/`useAmt` with a structured `useEffects: {stat, delta, chance?}[]`. Canonical numbers: cigarette `[morale+0.3, energy-0.2, strength-1@0.3]`; painkiller `[health+0.4, reputation-1]`; meat `[mind+0.3, strength+1@0.5]`. Over-eat → vomit (reverse gains + rep hit).
- Add the weapon sub-schema (§3). Add a `Bleeding` DoT component.
- **Crafting recipe table** keyed on ordered item pairs `{inputs:[a,b], output, skillReq}`. Seed: liquid+blade=syringe, gun+ammo=reload, gun+batteries=electric. Success prob = `f(effective skill)`. Trigger via a "combine" action. Keep magazines small (HT3 deliberately limited ammo) so scavenging stays a loop.
- **Dig/escape:** holding a shovel + Interact at a valid floor `DigZone` (block dead-ends) starts a timed dig → spawns a tunnel edge in the navmesh → adjacent zone or outside. Reuses `EscapeSystem`.
- **Contraband searches:** our `EconomySystem.searchRisk` + item `concealment`/`suspicion` already model this. Run periodic guard shakedowns; detection = `f(concealment, proximity, LOS, suspicion)` → court flow (+1..5 days) + confiscation. Add a **stash/hide** mechanic (already partly present) that raises effective concealment.
- **Cigarettes (`cash`) as soft secondary currency** — accept in barter at a fixed conversion, illegal to hold.
- **Zone-weighted spawns** (~30 types): cleaver in canteen, cue at pool table, shovel in workshop/yard — not uniform random.

---

## 5. Jobs & Economy

**Essence:** Money is "credit" you spend on food/bribes/fashion/medical/legal defense. Two paths in tension: **legit work** (low pay, drains energy/morale, *lowers reputation* because inmates despise skivvying) vs **crime/gangs** (better pay + rep, raises heat). Jobs form an attribute-gated ladder: sweep → kitchen (60% Int) → study (70% Int) → medical (80% health) → workshop crafting (70% STR, ~$25/item). Warden/lawyer tasks pay in *sentence days* instead of cash. Gang missions ~$100. Gambling = fight-to-the-death wagers; extortion = intimidation-gated demands.

**Our embodiment:**
- Replace the flat `JOBS` list with the **tiered ladder**: add `reqAttr` + `tier`. Make **sweeping/cleaning carry NEGATIVE rep** (-1) and high energy cost — the signature "menial work lowers status" trade. Per-tier `payBase` flows through existing `EconomySystem.jobPay()`. UI greys out locked jobs with a "Needs Int 60" tooltip.
- **Workshop = a craft job:** each in-game morning seed a parts table; STR≥70 craft action (variable duration) yields a random item + ~$25.
- Wire **warden/lawyer tasks** into `MissionSystem` so success calls `Progression` to *reduce sentence*; failure adds Heat/days.
- **Commissary/Store UI** on `items.ts` + `priceFor`: subsidised buy prices; HT3 "charged on the way out / only if you can afford it" rule as a checkout (deduct or flag theft/Heat).
- **Gambling** reuses combat: a fight-wager escrows a stake, winner takes pot, loser left at low energy. Cards/dice as simple bets.
- Surface a **money ledger** (food, bribes, medical, fashion, legal, fines, wagers, store charges) as discrete `EconomySystem` transactions so the HUD shows *why* money moved — a key legibility upgrade over the original's single number.

---

## 6. Gangs, Dialogue & Romance

**Essence:** Invitation-only gangs (one at a time). You're invited when you meet criteria — dominant gate is **Reputation ≥ 70%** (plus, in the original, race — which we *replace with neutral cosmetic faction tells*). Vouching, paying, or attacking rivals also opens invites. Gang missions are time-boxed (kill/injure/assault/train/infiltrate), pay ~$100 + happiness + rep. **Betrayal** (attacking a member, refusing too often, failing missions, defecting to a rival) → kicked out → whole gang hunts you, may try to kill you. **You can never be the leader.** Social model is universal: please people → friendship/allies (who physically fight for you); harm/refuse → grudges/revenge. Reputation is **spent like currency** in dialogue. Intimidation = grab+hold to force agreement (costs goodwill). Romance emerges from the please-loop; hugs/kisses restore health/morale; a jealous witness triggers conflict; HT3 can produce a child.

**Our embodiment (FactionSystem is already pure and wired):**
- **Invite pipeline:** per-gang `joinGate { minRep, maxRep?, requiredTag?, minStrPlusAgi? }`. Add `vouch`, `pay-to-join`, and an `attackRivals` counter that accrues invite pressure. Keep our `INVITE_STANDING`/`INVITE_RESPECT` as fallback.
- **Mission templates as data** (extend `GANG_GOALS` + `MissionSystem`): kinds `kill|injure|assault|train_stat|infiltrate`, a `deadlineDay/Hour` hooked to the schedule clock, `targetEntityId`, reward `{money:100, happiness, rep}`. Failure → rel drop + `failedMissions++`; expel at ≥3.
- **Betrayal state machine:** `gangStatus: member|probation|exiled`. On same-gang attack (detect via combat damage event + shared `Brain.gang`), excess refusals, or expulsion → broadcast a faction-wide grudge via `AIMemory.rememberFoe`; bias `PrisonerAISystem`/`GroupBehaviorSystem` to hunt the player; defecting to a rival escalates intent beat→kill.
- **Dialogue as currency loop** (extend `DialogueSystem` + `Social.rel`): each action spends Reputation/Attitude; outcome = `f(playerRep − targetRespect + relBonus)`. Comply-to-unreasonable → rel up, rep down; stand-ground → rep up. Over-pestering costs Attitude. Options: Befriend / Ask Favour / Recruit / Threaten / Invite.
- **Intimidation verb** reuses the grapple phase: grab+hold sharply raises acceptance of the current offer, fixed rel penalty on release.
- **Ally assist** reuses `AIMemory.ally` + `GroupBehaviorSystem`, gated on **line-of-sight** to reproduce tactical positioning.
- **Romance system:** rel crosses a high threshold → `romantic` flag; Hug/Kiss grant +health/+morale on cooldown; **jealousy** scans for a witnessing partner in view radius → grudge + confrontation event. Keep abstract.
- **Neutral visual gang identity** (headband color / cap / crown / bandana / vest on `CharacterFactory`) replacing the source's offensive racial gating, while keeping faction readability at a glance.

---

## 7. Sentence, Crime, Court & Win/Lose

**Essence:** Start with a fixed sentence (**50–99 days**), a live counter ticking down per day. Reduced by warden/lawyer tasks (a few days), lawyer phone-call (-1), and *low* reputation at trial (forgiving judge). Extended by convictions: insubordination +1, possession +1–5, GBH +5–8, murder doubles to ≥60, serial murder +100. **High reputation works against you in court.** Court is the parole engine: crimes must be *witnessed* to stick; `P(guilty) = base[crime] + reputation·k`; terrorism always guilty, bribery skips trial (−rep). **Win = serve every day → escorted to civilian life.** **Lose = death → fade to black → main menu → that character's save is deleted (permadeath)** — but the *world persists*: a new character finds the dead one alive as an NPC owning the same cell. Breakdown (mind=0) is a non-lethal ~1-minute loss-of-control, not death.

**Our embodiment:**
- Add a `Sentence` component `{ totalDays, daysRemaining, baseSentence }`; roll `[50,99]` at creation; decrement on the existing day-rollover; at 0 fire `ReleaseEvent` → civilian transition (win).
- Model modifiers as bus events `SentenceModified{delta, reason, viaCourt}` for a clean **rap-sheet UI** (legibility win). Silent penalties `viaCourt:false`.
- **CrimeWitness system** on combat/contraband: a crime is charged only if an Officer (or vindictive peer) had LOS at the act; queue to a `RapSheet`; police can "build a case" via a low-prob tick even on unseen crimes.
- **Court** as weighted RNG (not deterministic): crime table mirroring the original; overrides terrorism→1.0, bribery→skip+rep loss.
- **Reputation as a double-edged derived value:** feeds both inmate aggression AND court `P(guilty)` — the exact original tension. Keep `Attitude` separate as the lawful track (cooperation → privileges / early release).
- **Permadeath of the entity, not the world:** on health≤0 run recovery roll → death emits `PlayerDied` → fade → menu → delete only that save slot. Serialize the *world* independently so the dead character respawns as an NPC owning their cell — a cheap, strong emergent-narrative feature we should absolutely keep.
- **Config-drive every number** (sentence range, per-crime deltas, guilty coefficients, recovery prob) in a balancing JSON.

---

## 8. Escape

**Essence:** Two legit exits (serve time, or take a warden job on release) and several illegitimate ones: **tunnel** (shovel + hold-Taunt on the *floor* at a block dead-end → round hole → crawl out to another zone or outside; safest), **fence** (yard climb at ~midnight with no guards; slow; motorcycle-tackle trick), **window** (break visitor's-room glass), **dynamite** (rare; explodes when tackled, blasts you to the beach). Getting caught: hole covered, rep loss, sentence extension; solitary wipes contraband + escape progress. Escapes "practically always" end in re-arrest → ~50/50 court.

**Our embodiment (EscapeSystem exists, abstract):**
- `EscapeIntent`/`EscapeProgress` on the player + persistent `EscapeRoute` entities (Tunnel/Fence/Window/Blast) that guards can discover and seal. `TunnelSystem` accrues progress only while holding a shovel + Interact at a `DigZone`, with clear guard LOS; a guard catching an in-progress hole fires `SealRoute` + penalty.
- Fence climb = timed action, duration inverse to effective Agility, with a fall→energy-loss roll, gated on "no guard within radius / not on screen." Motorcycle as a physics body that intercepts tacklers.
- Tunnel exit = weighted random `{reEnter, outside}` scaled by Skill/Agility.
- An **Outside/On-the-run** zone (rideable bike left, ~10 armed guards right) + a `Wanted` flag making all guards hunt the player (siren broadcast), re-entry via the same hole/fence.
- **Persist half-dug routes in the save** so escape work survives reloads (matches real-time persistence); guards seal them over patrol time.
- Gate release on `debts==0 && warrants==0` (HT3).

---

## 9. Look, Feel & UX — keep crude-readable, fix the jank

**Essence:** Crude-but-readable 2.5D/3D with a **floating mood-face icon** over every head as the core readability device. Fixed 3/4 "star-focused" camera (+ iso overview in the OG). Seamless real-time, **no pause**. Universal "press-either-side" menu widgets across touch/mouse/pad. The jank, opacity, and absent onboarding are *weaknesses*, not charm.

**Our embodiment (codebase already nails the identity):**
- **Keep** the toon-outline low-poly bodies + the floating `CanvasTexture` status icon — promote that mood-face to a first-class feature driven by `Needs.anger/fear/health` + `Social`, so every NPC's state is legible at a glance.
- **Keep** the dual camera (`IsoCamera` ortho overview + perspective char-follow). Add HT's "touch the clock to pause/camera options," a periodic Random-camera nudge, optional CCTV grade.
- **Keep & extend** the tap-to-select entity panel (already cleaner than the original's menus). Map our `Social` + `Needs` onto the named HT attributes so players recognize the model.
- **Add** the two signature meters always-visible: green Health with amber refill-limit + thin yellow Adrenaline/Mind.
- **Lean into emergent chaos as the addiction engine** — `FactionSystem`/`GroupBehaviorSystem`/`RiotSystem`/`LockdownSystem`/`GuardAISystem` already exist. Tune cascade rules (one shove → bystanders join by rel/gang → heat → riot% → lockdown) and surface a short **ALERT FEED** of emergent events ("and then THIS happened") — the stories *are* the product.
- **Keep zero forced goals**, add *opt-in* soft objectives via `Progression`/`HUD.setObjectives` framed as rep tiers / gang goals — never a mandatory quest line.

---

## 10. The Persistent World & the Schedule

**Essence:** ~8am–8pm active day, lockdown ~22:00–07:00, wake-in-cell → make-your-own-way-back. Wardens can mutate the schedule/your cell/block. Guards patrol, witness crimes, escalate warning→beating→warrant→arrest (grab-and-hold), herd inmates to cells, can be bribed. The facility never stops and remembers everything.

**Our embodiment:** Our `ScheduleSystem` is already close (wake 6 → lockdown 21 → lights-out 22.5). Set hard lockdown 22:00–07:00, free-roam 08:00–20:00. Make phases **data-driven** so a warden event can shift times / reassign cells. Guard AI ties to the schedule (herd at lockdown, patrol+witness+escalate by day), reusing existing arrest/search hooks; bribery cancels warrants. A cold/heat modifier on outdoor energy drain + a fire-prop sleep bonus add cheap atmosphere.

---

## Build order (suggested)
1. Two-bar Needs + Attributes + the 25%-tired derived getter (touches everything).
2. Sentence component + day tick + rap-sheet/court (the win/lose frame).
3. MoveResolver + grapple/parry + 3 elimination states (combat is the verb you do most).
4. Job ladder + money ledger + commissary.
5. Gang invite/mission/betrayal + dialogue-as-currency + ally LOS assist.
6. Contraband search + crafting + dig/escape.
7. Romance, breakdown/adrenaline, persistent-dead-NPC, alert feed (the story-generators).

---

## Must-have features (to feel like Hard Time)
- Two-bar survival model: green Health/energy + thin yellow Mind/morale (hunger is a drain modifier, NOT a third bar)
- The '25% weaker when tired' rule as one derived getter (effectiveStat = base * (0.75 + 0.25*energy)) that ALL combat/job/movement systems read
- Six persistent attributes (Strength, Agility, Skill, Stamina, Reputation, Attitude), 30-99 range, XP-FREE — progression is persistence + soft caps + tradeoffs, never levels
- Stat tradeoff couplings: Strength<->Agility via body type, Skill<->Reputation inverse (studying lowers rep) — you can never max everything
- Training as a 'spend health, gain attribute' transaction at stations (weights/laps/books/pool/basketball)
- 4-verb combinatorial combat (Attack/Grapple/Run/Pickup + direction + modifiers) resolved through a data-driven MoveResolver per combat phase
- Super attack = Attack+Run; grapple transitions into suplex/DDT/throw/choke; no block button — defend by retreating + hold-grapple-to-parry-into-chokehold
- Three elimination states: KILLED / UNCONSCIOUS / SUBMIT (not just knockdown)
- Sharp weapons bleed + sever limbs; blunt weapons knock out; riot shield blocks ~95%; firearms with limited ammo reloaded by crafting
- Adrenaline rush at full morale (+10% all + finisher) and nervous breakdown at empty morale (~1 min loss-of-control)
- Persistent injuries/severed limbs that remove arm-moves (force kicks) and persist between sessions
- Pooled carried-object inventory: pick up / hold-to-lift (STR-gated) / throw-with-direction; anything is a weapon
- Vice loop: consumables trade happiness-up for health-down with a sickness/vomit risk; cigarettes double as currency
- Crafting = combine two objects (also reloads guns), SKILL-gated, via an ordered-pair recipe table
- Contraband + guard searches (concealment/suspicion) feeding the court/sentence flow (+1..5 days), with a stash/hide mechanic
- Attribute-gated job ladder where menial work (sweeping) LOWERS reputation; warden/lawyer tasks pay in sentence-days not cash
- Invitation-only gangs (Rep>=70 + neutral cosmetic tells), time-boxed missions (~$100), betrayal -> whole-gang revenge, you can never be leader
- Dialogue as a reputation/attitude currency loop; intimidation via grab+hold; allies physically fight for you and rush to aid only within line-of-sight
- Romance from the please-loop (hugs/kisses restore health/morale) with jealousy conflict when witnessed
- Sentence as a live day counter (50-99 start) reduced by tasks/low-rep-at-trial, extended by witnessed convictions; reputation works AGAINST you in court
- Multiple escape methods (tunnel via shovel-dig on the floor, midnight fence climb, window, dynamite) that practically always end in re-arrest + court
- Permadeath of the character but PERSISTENCE of the world — the dead character lives on as an NPC owning the same cell
- Seamless real-time no-pause schedule (lockdown ~22:00-07:00, free-roam 08:00-20:00) the warden can mutate
- Emergent chaos cascade: one shove -> bystanders join by rel/gang -> heat -> riot% -> lockdown, with simple readable AI rules on all 100+ actors
- Floating mood-face icon over every head as the primary readability device
- Zero forced goals — a pure sandbox where the player sets their own objective

## Do better than the 2009 original
- Total stat legibility: tooltips and a 'why' reason on every number (we already pass action.reason), a money ledger showing why cash moved, and a rap-sheet showing every sentence change — fix the original's opaque numbers
- An ALERT FEED of emergent events ('a brawl broke out in the yard', 'your gang wants Marcus dead by 14:00') so the player's self-authored stories are surfaced, not missed
- A 1-day tutorial/onboarding overlay — the original threw you in blind with no explanation of its deep systems
- Clean DOM HUD with chips/bars and a tap-to-select entity panel instead of the original's clunky 'press either side' menus (while keeping touch/mouse/pad parity)
- Save-anywhere via SaveManager instead of the original's awkward 'save only at quiet moments', plus persistent half-dug escape routes that survive reloads
- Config/JSON-driven balancing for every number (sentence range, per-crime day deltas, court guilty coefficients, training deltas, escape chances) so the MDickie-derived values are tunable without code changes
- Replace the original's offensive race-gated gangs with neutral, readable cosmetic faction tells (headbands/caps/crowns/bandanas/vests) — keep the gameplay readability, drop the bigotry
- Upgraded-but-faithful visuals: keep the crude toon-outline low-poly identity but add proper skinned-mesh limb-hiding for severed limbs, a capped blood-splatter particle pool, and per-block uniform colors
- Better camera: dual iso-overview + star-follow we already have, plus 'touch the clock to pause', a periodic Random-camera nudge, and an optional CCTV color grade
- Tactically smarter (but still emergent) AI: line-of-sight-gated ally assistance and crime witnessing make positioning meaningful, where the original's aid/arrest could feel arbitrary
- More legible combat feel: a per-fighter phase machine with clear windup/recover and a data-driven move table, so fights read as deliberate rather than the original's button-mash randomness — while keeping the wrestling-derived depth
- A proper character-creation screen with a fixed point budget and editable sentence length, plus visible body-type morphing driven by the STR/AGI balance for tangible build feedback
- Difficulty-gated optional systems (e.g. the amber health ceiling) so new players aren't punished by the original's harshest hidden mechanics while veterans can opt in
- Controller and touch parity from day one via the existing InputManager, with contextual on-screen verb buttons instead of memorized keyboard combos
