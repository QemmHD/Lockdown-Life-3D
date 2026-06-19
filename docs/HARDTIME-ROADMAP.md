<!-- Auto-generated build-ready implementation plans for the remaining Hard Time stages (workflow ultrathink). -->

# Hard Time remake — remaining stage plans


## STAGE 4.3 — Escape as a multi-step persistent PROJECT  _(effort: M)_

Turn the existing 3-second escape coin-flip into a persistent multi-day project layered ON TOP of the current attempt code (which we keep as the final "Break Out" resolution). Add a new persistent struct `EscapeSite` (room, progress 0..1, discovered, days) living in EscapeSystem.ts and a `escapeSite` field on Simulation, separate from the existing live `escape: EscapeState` (which stays the one-shot "in the act of breaking out" struct). Player needs an `escapeAid` tool (tool/keycard already carry `escapeAid`) to (a) START a site at a perimeter opportunity room, (b) WORK it over several sessions to accrue progress, hidden between sessions; a search/solitary can DISCOVER an in-progress site and reset it (heat + sentence penalty), and (c) BREAK OUT only when progress >= 1 at the site — which calls the EXISTING resolveEscape()/endRun('escaped'|'dead') path from 4.0/4.1. Three new chaos-style action keys (`escwork`, `escbreak`, plus reuse `escape` is renamed conceptually to break-out) wired through playerChaosActions/requestChaosAction → Game.doAction's existing `escape` branch is extended. Save bumps v13→v14: persist `escapeSite`; the live `escape` attempt still resets to stable on load (sanitizeEscape unchanged), but `escapeSite` is restored. Keep it ABSTRACT — "work the site / break for the perimeter", no real-world method.

**New state / save:**
- New persistent struct `EscapeSite { roomId, roomType, progress (0..1), discovered, daysWorked, lastWorkDay }` in EscapeSystem.ts with newEscapeSite()/sanitizeEscapeSite().
- New Simulation field `escapeSite: EscapeSite = newEscapeSite();` — DISTINCT from the existing live `escape: EscapeState` (the one-shot break-out). The site is the persistent project; the attempt is the final action.
- generate()/startNewRun reset escapeSite to newEscapeSite() alongside escape.
- serialize(): add `escapeSite` into the chaos block; bump `version` 13 → 14.
- hydrate(): `this.escapeSite = sanitizeEscapeSite(data.escapeSite)` so half-finished sites survive reload (per design §8 'persist half-dug routes'); `this.escape = newEscape()` still wipes any in-flight break-out (unchanged). On load `discovered` is forced false so no stale discovery fires.
- Migration: older v13 saves lack `escapeSite` → sanitizeEscapeSite(undefined) returns an empty (inactive) site; no crash, no site. selfTest round-trips it.

**Files & changes:**

- `src/sim/EscapeSystem.ts`
  - Add `EscapeSite` interface: { roomId: string; roomType: string; progress: number; discovered: boolean; daysWorked: number; lastWorkDay: number }.
  - Add `newEscapeSite(): EscapeSite` returning an empty/inactive site (roomId '' = no site).
  - Add `sanitizeEscapeSite(d:any): EscapeSite` — restore roomId/progress/daysWorked from save, clamp progress 0..1, clear `discovered` transient flags as appropriate (keep discovered=false on load so a reload doesn't re-trigger a discovery cutscene; the site itself persists).
  - Add tuning consts: `ESCAPE_WORK_GAIN` (e.g. 0.18 progress per work session), `ESCAPE_DISCOVER_BASE` (e.g. 0.22 chance a search near/with progress finds it), `ESCAPE_WORK_SUSPICION` (e.g. +8), and helper `escapeSiteActive(s)` = `!!s.roomId`.
  - Add player-facing labels to ESCAPE_LABELS: `escwork:'Work the Site'`, `escbreak:'Break Out'`, `escstart:'Start an Escape Site'`.
  - Leave `EscapeState`/newEscape/sanitizeEscape and rollEscapeOutcome UNCHANGED — break-out still rolls through them.

- `src/sim/Simulation.ts`
  - Import `EscapeSite, newEscapeSite, sanitizeEscapeSite, escapeSiteActive, ESCAPE_WORK_GAIN, ESCAPE_DISCOVER_BASE` from './EscapeSystem' (extend the existing import on line 15).
  - Add field near line 88: `escapeSite: EscapeSite = newEscapeSite();`.
  - generate() (line 133) + startNewRun reset: set `this.escapeSite = newEscapeSite();` alongside `this.escape = newEscape();`.
  - Add ACTION_DUR/ACTION_STATE/SAY entries for `escwork` (dur ~2.5, state 'working', say '🔨') so the work session reads as a real timed action like `work`.
  - playerChaosActions() (line 1695): when `this.escapeOpportunity()` (or an active site is reachable), push the project actions instead of the single `escape`: `escstart` (no site yet + has tool), `escwork` (site here, progress<1), `escbreak` (site here, progress>=1). Gate all on `playerHasEscapeTool()`.
  - escapeOpportunity() (line 1711): keep as-is for 'where can I site/break'; add `escapeSiteHere(): string|null` that returns the site room if the player is standing in/near `escapeSite.roomId`.
  - Add `playerHasEscapeTool(): boolean` = any inventory item with `ITEMS[id]?.escapeAid > 0` (mirrors the reduce at line 1773).
  - Add `requestEscapeWork(key)` handling in requestChaosAction (or a dedicated method routed from Game): `escstart` → set escapeSite to the opportunity room, alert 'You start working a way out…'; `escwork` → start a timed `escwork` act (this.act perform) that on completion adds ESCAPE_WORK_GAIN to progress, +suspicion, increments daysWorked, emits float 'Progress N%'; `escbreak` → only if progress>=1, call the EXISTING break-out: set up `this.escape` + `this.act={action:'escape',...}` exactly like requestEscape() does today (resolveEscape stays the final roll → endRun).
  - Add applyObjAction/applyAction completion for `escwork`: in applyAction (line 1923) add a branch `if (a.action==='escwork'){ this.completeEscapeWork(); ...idle... return; }`, mirroring the `escape` branch. completeEscapeWork() bumps progress, clamps, sets suspicion, and if progress>=1 emits 'The way out is ready — wait for your moment.'
  - Discovery hook in doSearchResult() (line 2007): after the contraband check, if `escapeSiteActive(this.escapeSite)` and the search target is the player and the site is reachable from where the player lives, roll `ESCAPE_DISCOVER_BASE + progress*0.3` to DISCOVER: reset escapeSite=newEscapeSite(), addHeat(18), addTime(2,'an escape site was discovered'), startLockdown('escape',2), alert 'Guards found your escape site!'. Also add a discovery roll inside sendToSolitary() (line 2043) — going to solitary wipes escape progress per the design doc.
  - Add a low passive discovery chance per day in onDayRollover() (line 670) scaled by progress + heat, so an idle in-progress site can still be found over time.
  - updatePlayerObjective() (line 616): add branches — if site here & progress>=1 → 'A way out is ready — break for it.'; else if site active → `Escape site: ${Math.round(progress*100)}% — keep working it.`
  - serialize() (line 2317/2329): add `escapeSite: this.escapeSite` to the chaos block; bump `version: 13`→`14`.
  - hydrate() (line 2372): after `this.escape = newEscape();` add `this.escapeSite = sanitizeEscapeSite(data.escapeSite);` so a mid-attempt site survives reload (per design 'persist half-dug routes'); the live attempt still resets.
  - selfTest() (line ~2238): add a defensive check that `sanitizeEscapeSite(this.serialize().escapeSite)` round-trips without throwing.

- `src/core/Game.ts`
  - doAction() (line 419): the `escape` key currently calls `this.sim.requestEscape()`. Generalize to route the three new keys: `if (isPlayerSel && (key==='escstart'||key==='escwork'||key==='escbreak'||key==='escape')) status = this.sim.requestEscapeAction(key);` (add a single dispatcher `requestEscapeAction(key)` in Simulation that switches; keeps Game thin).
  - playerActions() (line 366-380): the chaos loop already maps `escape` to a risky/danger button — extend the danger/kind test to also treat `escbreak` as danger and `escstart`/`escwork` as 'risky' (non-danger). No structural change, just include the new keys in the `c.key==='escape'` style checks (e.g. `['escbreak','escape'].includes(c.key)` for danger).
  - Game.SELF/CHAOS key arrays: no change needed since escape keys are dispatched explicitly before CHAOS_KEYS.
  - Optional polish: in the HUD action label test at line 424 include the new break key so the alert uses the 'fight' color: `key==='fight'||key==='escape'||key==='escbreak'`.

- `src/data/items.ts`
  - No schema change required — `escapeAid` already exists on `tool` (0.25) and could be added to `keycard` (e.g. escapeAid: 0.3) so the keycard reads as a stronger escape enabler. Optional: add a dedicated low-aid item if you want a non-weapon dig tool, but reuse is sufficient for 4.3.

**UI wiring:**
- Game.doAction (line 419): replace the lone `key==='escape'` branch with a dispatch over `escstart|escwork|escbreak|escape` → `sim.requestEscapeAction(key)`. No other Game plumbing needed — chaos buttons already flow through playerActions()→doAction().
- Game.playerActions (line 378): the chaos-button loop already styles `escape` as kind:'risky'/danger. Extend the danger test to `['escape','escbreak'].includes(c.key)` so Break Out reads red; escstart/escwork render as risky (amber).
- HUD alert color (line 424): include `escbreak` with `fight` in the alert-color test so a break-out reads as high-stakes.
- playerObjective already surfaces in the HUD (Game line 553 setChaos objective). Adding the site-progress strings in updatePlayerObjective() makes the HUD show 'Escape site: 54% — keep working it' / 'A way out is ready — break for it.' with zero extra UI wiring.
- Optional (nice-to-have, not required for 4.3): a thin progress chip in the HUD reading escapeSite.progress; the objective line already conveys it, so skip unless polishing.

**Key snippets:**

```ts
// src/sim/EscapeSystem.ts — new persistent project state (append, keep EscapeState as-is)
export interface EscapeSite {
  roomId: string;     // '' = no active site
  roomType: string;   // perimeter/service room type the site sits in
  progress: number;   // 0..1 dig/cut progress
  discovered: boolean; // transient: a search just found it this tick
  daysWorked: number;
  lastWorkDay: number;
}
export function newEscapeSite(): EscapeSite {
  return { roomId: '', roomType: '', progress: 0, discovered: false, daysWorked: 0, lastWorkDay: 0 };
}
export const escapeSiteActive = (s: EscapeSite) => !!s.roomId;
export const ESCAPE_WORK_GAIN = 0.18;     // progress per work session (~6 sessions)
export const ESCAPE_DISCOVER_BASE = 0.22; // base chance a search of the player finds the site
export function sanitizeEscapeSite(d: any): EscapeSite {
  const s = newEscapeSite();
  if (!d || typeof d !== 'object') return s;
  s.roomId = typeof d.roomId === 'string' ? d.roomId : '';
  s.roomType = typeof d.roomType === 'string' ? d.roomType : '';
  s.progress = Math.min(1, Math.max(0, Number(d.progress) || 0));
  s.daysWorked = Math.max(0, Math.floor(Number(d.daysWorked) || 0));
  s.lastWorkDay = Math.max(0, Math.floor(Number(d.lastWorkDay) || 0));
  s.discovered = false; // never restore a mid-discovery flash
  if (!s.roomId) return newEscapeSite();
  return s;
}
```

```ts
// src/sim/Simulation.ts — tool gate + dispatcher (single entry point from Game)
private playerHasEscapeTool(): boolean {
  return (this.inv(this.playerId)?.items ?? []).some((id) => (ITEMS[id]?.escapeAid ?? 0) > 0);
}
requestEscapeAction(key: string): string {
  switch (key) {
    case 'escstart': return this.startEscapeSite();
    case 'escwork':  return this.workEscapeSite();
    case 'escbreak': return this.requestEscape(); // existing final break-out → resolveEscape → endRun
    case 'escape':   return this.requestEscape(); // back-compat for any legacy caller
  }
  return '';
}
```

```ts
// src/sim/Simulation.ts — start + work a site (work is a timed act that resolves in applyAction)
startEscapeSite(): string {
  const pb = this.brain(this.playerId)!;
  if (pb.state === 'solitary' || pb.state === 'down') return 'You can’t act right now.';
  if (!this.playerHasEscapeTool()) return 'You need a tool to start.';
  if (escapeSiteActive(this.escapeSite)) return 'You already have a site going.';
  const spot = this.escapeOpportunity(); if (!spot) return 'No good spot here.';
  this.escapeSite = { ...newEscapeSite(), roomId: spot, roomType: this.roomType(spot) };
  this.bus.emit('alert', { type: 'warning', text: 'You begin working a way out.' });
  return 'Escape site started — come back and work it.';
}
workEscapeSite(): string {
  const pb = this.brain(this.playerId)!;
  if (pb.state === 'solitary' || pb.state === 'down') return 'You can’t act right now.';
  if (!escapeSiteActive(this.escapeSite)) return 'No site here — start one first.';
  if (this.escapeSite.progress >= 1) return 'It’s ready — break out when the coast is clear.';
  if (this.roomIdAt(this.pos(this.playerId)!) !== this.escapeSite.roomId) return 'Get to your site first.';
  if (this.act && this.act.phase === 'perform') return 'Finish what you’re doing first.';
  if (!this.playerHasEscapeTool()) return 'You need your tool.';
  this.act = { action: 'escwork' as any, target: this.playerId, phase: 'perform', timer: ACTION_DUR.escwork, dur: ACTION_DUR.escwork, applied: false, approachT: 0 };
  this.beginPerform();
  return 'Working the site… keep an eye out.';
}
private completeEscapeWork() {
  const s = this.escapeSite, ps = this.social(this.playerId)!;
  s.progress = Math.min(1, s.progress + ESCAPE_WORK_GAIN);
  s.daysWorked = s.daysWorked; s.lastWorkDay = this.day;
  ps.suspicion = clamp(ps.suspicion + 8, 0, 100);
  this.floatBy(this.playerId, `Site ${Math.round(s.progress * 100)}%`, '#ffd24a');
  if (s.progress >= 1) this.bus.emit('alert', { type: 'player', text: 'The way out is ready — wait for your moment.' });
}
```

```ts
// src/sim/Simulation.ts — applyAction() branch, mirror the existing 'escape' branch (line 1925)
if (a.action === ('escwork' as any)) {
  this.completeEscapeWork();
  if (pb.state !== 'solitary' && pb.state !== 'down') { pb.state = 'idle'; pb.action = 'Idle'; }
  return;
}
```

```ts
// src/sim/Simulation.ts — discovery on a player search (inside doSearchResult, after the contraband block)
if (tb.isPlayer && escapeSiteActive(this.escapeSite)) {
  const chance = ESCAPE_DISCOVER_BASE + this.escapeSite.progress * 0.3;
  if (this.rng.float() < chance) {
    this.escapeSite = newEscapeSite();
    this.addHeat(18); this.addTime(2, 'an escape site was discovered');
    this.startLockdown('escape', 2, this.roomIdAt(this.pos(target)!) || undefined);
    this.bus.emit('alert', { type: 'critical', text: 'Guards found your escape site — sealed and reset.' });
  }
}
```

```ts
// src/sim/Simulation.ts — playerChaosActions(): project buttons replace the lone 'escape'
const spot = this.escapeOpportunity();
if (this.playerHasEscapeTool() && (spot || escapeSiteActive(this.escapeSite))) {
  const here = escapeSiteActive(this.escapeSite) && this.roomIdAt(this.pos(this.playerId)!) === this.escapeSite.roomId;
  if (!escapeSiteActive(this.escapeSite) && spot) out.push({ key: 'escstart', label: 'Start an Escape Site' });
  else if (here && this.escapeSite.progress < 1) out.push({ key: 'escwork', label: 'Work the Site' });
  else if (here && this.escapeSite.progress >= 1) out.push({ key: 'escbreak', label: 'Break Out' });
}
```

```ts
// src/sim/Simulation.ts — serialize() chaos block + version bump
const chaos = { lockdown: this.lockdown, alarm: this.alarm, heat: this.heat, riotPressure: this.riotPressure, tension: this.tension, escapeSite: this.escapeSite };
// ...
return { version: 14, seed: this.rng.seed, /* ...rest unchanged... */ };
// hydrate(), right after `this.escape = newEscape();`
this.escapeSite = sanitizeEscapeSite(data.escapeSite);
```

```ts
// src/core/Game.ts doAction() — replace the single escape branch (line 419)
else if (isPlayerSel && (key === 'escstart' || key === 'escwork' || key === 'escbreak' || key === 'escape'))
  status = this.sim.requestEscapeAction(key);
```

**Risks:**
- Double-counting the existing `escape` chaos action: today playerChaosActions pushes `{key:'escape'}` whenever escapeOpportunity() is truthy (line 1707). You MUST remove/replace that line with the new project gate, or the old instant coin-flip button coexists with the new ones. Replace it, don't add alongside.
- `this.act.action` is typed `InteractAction`; `escwork` isn't in that union. Either add `'escwork'` to the InteractAction type (line 52) — cleanest — or cast `as any` at the two assignment sites (snippets use `as any`). Adding to the union also requires it not break the big switch in applyAction/resolveTarget (handled by the early `if (a.action==='escwork') return;`). Prefer adding to the union + ACTION_DUR/ACTION_STATE so beginPerform/labels work.
- beginPerform()/the act state machine expects approach vs perform; escwork is started directly in 'perform' (like requestEscape at line 1764). Verify beginPerform doesn't require act.point for a self-target perform — requestEscape already does this pattern with no point, so it's safe.
- Discovery placement: doSearchResult only fires when the PLAYER is searched, which may be infrequent. Back it with the onDayRollover passive roll (scaled by progress+heat) so a site can't sit at 99% indefinitely undetected. Tune ESCAPE_DISCOVER_BASE + the daily roll together to keep success rare but reachable.
- Solitary wipe: design §8 says solitary wipes escape progress. sendToSolitary is called from many sites (contraband, combat discipline, escape catch). Resetting escapeSite there is correct but make sure it doesn't double-fire with the break-out's own caught path (resolveEscape→sendToSolitary already runs after the site is consumed for break-out, so guard against resetting a site that's already cleared — it's idempotent since newEscapeSite() on an empty site is a no-op).
- Save version: anything that reads `version` for migration must accept 14. Confirm SaveManager/Menus.saveInfo (Game line 115) doesn't hard-check version===13. The hydrate path is version-agnostic (defensive field reads), so old v13 saves load with an empty site — verify by loading a pre-4.3 save in ?debug and running selfTest.
- Update Menus version string (Game line 117 'v4.2.0-gear') to e.g. 'v4.3.0-escape' so the title screen reflects the stage — cosmetic but expected per prior stages.


## 4.4 — Stats & training (Attributes component, 25% rule, training transactions, combat/move wiring, save v14, UI)  _(effort: M)_

Add a persistent ECS `Attributes` component {strength, agility, skill, stamina} (0..99, floor 30) on every prisoner+player, leaving reputation in Social. Introduce a single derived getter `effective(stat)=base*(0.75+0.25*energy)` (the 25% rule) that combat/training/move all read. Replace the two `train` handlers (object-use at Simulation.ts:1901 and selfAction at :2194) with a `trainStation(stationType)` transaction: energy-=cost; attr+=delta; with couplings (STR gain -> small AGI decay; SKILL gain -> small Social.respect/reputation decay). Wire effective STR into doStrike() damage and effective AGI into attack-speed (attackCd) and base move speed. NO XP/levels. Bump save to v14: serialize `attr` per-entity, hydrate with a sanitizer that defaults old saves to floor-30 attributes. Surface attributes in the Stats panel (Menus.statsTab) and the right-click/inspect HUD panel (Game.ts), via new `attr` block in uiSnapshot().stats. Effort M: ~10 edit sites across 5 files, mechanical but touches the save version and two hot combat paths.

Authoritative findings (cite): components.ts has Needs+Social; no Attributes exists. Simulation accessors at :1532-1535 (social/inv/brain/pos) — add an `attr(e)` peer. Entity creation: player promoted in generate() :146-149 (needs an attr set), spawnPrisoner :222-247, spawnGuard :249-262 (guards can skip attributes), applySetup :159-198. needsSystem :959. doStrike :1364 (dmg formula :1383-1387). pickAttack/attackCd :1357 & advanceCombat windup at :1346-1347. moveAgents :1512 uses ag.speed*dt. ag.speed set from traits at :171/:231. serialize() :2317 returns version 13; per-entity record built :2318-2327; hydrate :2340 reconstructs each component, Social default at :2359. uiSnapshot stats object :924-933. Stats UI Menus.ts:193 statsTab (m-kv rows :208-214). HUD inspect panel Game.ts:346 needs[] :350-357. Two train sites: useObject :1901 (has o.type=weights/pullup in scope) and selfAction :2194. Training stations already exist as interactables (weights/pullup -> action 'train'); treadmill/books are NOT yet interactable types — plan adds them to the station->stat map but they degrade gracefully (default STR) until WorldGen/Interactable add the props.

**New state / save:**
- New ECS component 'Attributes' {strength,agility,skill,stamina}: number 30..99, set on every prisoner+player at spawn; guards may omit (they never read it). No new top-level Simulation fields — attributes live per-entity in the ECS, consistent with Needs/Social.
- SAVE_VERSION bump 13 -> 14 (Simulation.serialize() return literal at :2338).
- serialize(): each entity record (built at :2318) gains `attr: this.ecs.get<Attributes>(e,'Attributes')`.
- hydrate(): add `this.ecs.set<Attributes>(e,'Attributes', sanitizeAttributes(r.attr))` right after the Social set (~:2359). sanitizeAttributes coerces each key to a finite number clamped to [30,99], defaulting missing/old-save fields to 30 — so v13 saves load cleanly with baseline stats (backward compatible; no migration branch needed).
- No change to chaos/prog/economy save blocks. uiSnapshot().stats gains an `attr` sub-object (and optional `effAttr`) — purely additive, safe for the read-only render layer.
- After hydrate, recompute the player's Agent.speed from effective AGI so a loaded character moves correctly.

**Files & changes:**

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ecs/components.ts`
  - Add `export interface Attributes { strength: number; agility: number; skill: number; stamina: number; }` after Social.
  - Add `export const ATTR_KEYS: (keyof Attributes)[] = ['strength','agility','skill','stamina'];` and `export const ATTR_FLOOR = 30; export const ATTR_CAP = 99;` next to NEED_KEYS.
  - (Optional) add a tiny `export function newAttributes(): Attributes` factory returning all-floor-30 for reuse by sim + sanitizer.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Attributes.ts (NEW)`
  - New pure helper module (mirrors Progression.ts style, no sim/render deps): `effective(base, energy)`, `applyAttrDelta(a, key, delta)` with clamp to [floor,cap], `STATIONS` table mapping station type -> {stat, delta, energyCost, coupling}, `sanitizeAttributes(d): Attributes` for save load, and `newAttributes()`. Keeps Simulation.ts lean and matches the existing 'pure data module' pattern used by CombatSystem/Progression.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Simulation.ts`
  - Import Attributes type from components and the helpers from ./Attributes.
  - Add accessor `attr(e: Entity) { return this.ecs.get<Attributes>(e, 'Attributes'); }` beside social/inv/brain/pos (~:1535).
  - Add private `effStr(e)/effAgi(e)/effSkill(e)` convenience or a generic `eff(e, key)` that reads attr+energy via effective().
  - Set Attributes on each prisoner in spawnPrisoner (:241-ish) with newAttributes() plus small trait-seeded bumps (tough->+STR, fast->+AGI, fighter->+STR/STAMINA, weak->-STR). Optionally set on guards or skip (guards don't read it).
  - In generate() after promoting player (:149) ensure the player entity has Attributes (spawnPrisoner already set it; just confirm — no extra code needed if player is a promoted prisoner).
  - In applySetup (:171) derive ag.speed from effective AGI instead of the fast/slow ternary OR keep ternary and additionally bias starting AGI from traits; recompute ag.speed via a new `recalcSpeed(pl)` helper.
  - Replace useObject 'train' case (:1901) to call `this.trainStation(pl, o.type)` and build the result string from the returned {stat,gain}. Replace selfAction 'train' (:2194) to call trainStation(pl,'weights') as a fallback. Add private `trainStation(e, stationType)` implementing the transaction + couplings + float feedback + this.prog('train').
  - Wire STR into doStrike (:1383): multiply dmg by a strength scalar `(0.7 + 0.6 * effStr/99)` (or similar) so floor-30 ~baseline, 99 ~strong; keep existing tough/weak/injured/weapon/armor multipliers.
  - Wire AGI into attack cadence: in advanceCombat windup (:1347) scale attackCd by `(1.15 - 0.3*effAgi/99)`; and into move: replace ag.speed assignments / moveAgents so base speed scales with effective AGI (cleanest: keep ag.speed as a per-entity base and multiply by agi scalar in moveAgents :1525, OR recompute ag.speed whenever AGI changes).
  - serialize() (:2318-2327): add `attr: this.ecs.get<Attributes>(e, 'Attributes')` to the per-entity record; change `version: 13` -> `version: 14` at :2338.
  - hydrate() (:2358-area): after setting Social, add `this.ecs.set<Attributes>(e, 'Attributes', sanitizeAttributes(r.attr));` so old (v13) saves with no r.attr default to floor-30. Recompute ag.speed for the player from AGI after load.
  - uiSnapshot stats (:924-933): add `attr: { strength, agility, skill, stamina }` (raw base) and optionally `effAttr` (energy-scaled, rounded) for the HUD.
  - selfTest() (:2284 return): add an invariant like `attrOk: this.attr(this.playerId) != null && this.attr(this.playerId)!.strength >= 30`.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ui/Menus.ts`
  - In statsTab (:193): add a four-row attribute block (STR/AGI/SKILL/STAMINA) under the needs bars or in the right column, reading s.stats.attr. Use existing `this.bar(label, value/99, color)` for visual bars and/or m-kv rows. Show the effective value in parentheses when energy<1 to teach the 25% rule (e.g. `Strength 60 (45)`).

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/core/Game.ts`
  - In the inspect/right-click panel (:346-357): for the player (and optionally NPCs) append attribute rows to `meta` (e.g. `STR ${Math.round(this.sim.attr(e)!.strength)}`) or add to the needs[] bars array a separate attribute section. Read via the new sim.attr(e) accessor (already public like social/inv).

**UI wiring:**
- Menus.ts statsTab (:193): add a 4-row attribute block reading s.stats.attr / s.stats.effAttr. Reuse `this.bar(label, value/99, color)` (bar already takes a 0..1 value — see usage at :203). Suggested colors: STR #d35400, AGI #16a085, SKILL #2980b9, STAMINA #27ae60. Show `Strength 60 (45)` when effAttr<attr to teach the 25% rule.
- Game.ts inspect panel (:346): expose attributes for the player by appending to `meta` (e.g. `STR ${this.sim.attr(e)!.strength}` etc.) or by adding a second bar group; sim.attr(e) is public like social/inv. NPC panels can optionally show STR/AGI to telegraph fight difficulty.
- No new event-bus events needed; trainStation reuses existing floatBy + this.prog('train') + actionResult emission already wired in useObject/selfAction paths.
- Stats panel and HUD are read-only consumers of uiSnapshot()/sim accessors — invariant preserved (sim stays authoritative).

**Key snippets:**

```ts
// src/ecs/components.ts — after Social (line ~72)
export interface Attributes { strength: number; agility: number; skill: number; stamina: number; }
export const ATTR_KEYS: (keyof Attributes)[] = ['strength', 'agility', 'skill', 'stamina'];
export const ATTR_FLOOR = 30; export const ATTR_CAP = 99;
```

```ts
// src/sim/Attributes.ts (NEW) — pure helpers, no sim/render deps (mirrors Progression.ts)
import { Attributes, ATTR_KEYS, ATTR_FLOOR, ATTR_CAP } from '../ecs/components';
export function newAttributes(): Attributes { return { strength: 30, agility: 30, skill: 30, stamina: 30 }; }
function clampAttr(v: number) { return v < ATTR_FLOOR ? ATTR_FLOOR : v > ATTR_CAP ? ATTR_CAP : v; }
// the 25% rule: a stat is only as good as your energy (0.75..1.0 of base)
export function effective(base: number, energy: number) { return base * (0.75 + 0.25 * (energy < 0 ? 0 : energy > 1 ? 1 : energy)); }
export interface StationDef { stat: keyof Attributes; delta: number; energyCost: number; coupleAgi?: number; coupleRep?: number; label: string; }
// weights->STR, treadmill/pullup->AGI(+stamina), books->SKILL. treadmill/books degrade to weights until those props exist in WorldGen.
export const STATIONS: Record<string, StationDef> = {
  weights: { stat: 'strength', delta: 1.4, energyCost: 0.16, coupleAgi: -0.5, label: 'Strength' },
  pullup:  { stat: 'agility',  delta: 1.2, energyCost: 0.14, label: 'Agility' },
  treadmill: { stat: 'agility', delta: 1.3, energyCost: 0.15, label: 'Agility' }, // also bumps stamina in trainStation
  books:   { stat: 'skill',    delta: 1.5, energyCost: 0.08, coupleRep: -1, label: 'Skill' }
};
export function sanitizeAttributes(d: any): Attributes {
  const a = newAttributes(); if (!d || typeof d !== 'object') return a;
  for (const k of ATTR_KEYS) if (typeof d[k] === 'number' && isFinite(d[k])) a[k] = clampAttr(d[k]);
  return a;
}
export { clampAttr };
```

```ts
// Simulation.ts — accessor + eff helpers (beside social/inv/brain/pos, ~:1535)
attr(e: Entity) { return this.ecs.get<Attributes>(e, 'Attributes'); }
private eff(e: Entity, key: keyof Attributes): number {
  const a = this.attr(e); const n = this.ecs.get<Needs>(e, 'Needs');
  if (!a) return ATTR_FLOOR; return effective(a[key], n ? n.energy : 1);
}
```

```ts
// Simulation.ts — trainStation transaction (replaces the two old 'train' bodies)
private trainStation(e: Entity, stationType: string): string {
  const a = this.attr(e); const n = this.ecs.get<Needs>(e, 'Needs')!;
  const st = STATIONS[stationType] ?? STATIONS.weights;
  if (!a) return 'You train.';
  if (n.energy < st.energyCost + 0.02) return 'Too gassed to train.';
  n.energy = clamp01(n.energy - st.energyCost);
  const before = a[st.stat];
  a[st.stat] = clampAttr(a[st.stat] + st.delta);
  const gained = a[st.stat] - before;
  if (st.coupleAgi) a.agility = clampAttr(a.agility + st.coupleAgi);      // STR work stiffens you up a little
  if (stationType === 'treadmill') a.stamina = clampAttr(a.stamina + 0.6);
  if (st.coupleRep) { const s = this.social(e)!; s.reputation = clamp(s.reputation + st.coupleRep, -100, 100); } // studying lowers rep
  if (st.stat === 'agility' || stationType === 'treadmill') this.recalcSpeed(e);
  if (e === this.playerId) { this.floatBy(e, `+${st.label}`, '#ffd24a'); this.prog('train'); }
  return `You train ${st.label.toLowerCase()} (+${gained.toFixed(1)}).`;
}
private recalcSpeed(e: Entity) {
  const ag = this.ecs.get<Agent>(e, 'Agent'); const b = this.brain(e); if (!ag || !b) return;
  const base = b.traits.includes('fast') ? 2.6 : b.traits.includes('slow') ? 1.7 : 2.2;
  ag.speed = base * (0.9 + 0.2 * (this.eff(e, 'agility') / 99));
}
```

```ts
// Simulation.ts useObject :1901 — replace the 'train' case body with:
case 'train': { result = this.trainStation(pl, o.type); break; }
// Simulation.ts selfAction :2194 — replace with:
case 'train': pb.action = 'Training'; return this.trainStation(pl, 'weights');
```

```ts
// Simulation.ts doStrike :1383 — fold effective STR into the damage line
const strMul = 0.7 + 0.6 * (this.eff(e, 'strength') / 99); // ~0.88 at floor 30, ~1.3 at 99
let dmg = this.rng.range(ATTACKS[atk].dmgMin, ATTACKS[atk].dmgMax) * strMul
  * (b.traits.includes('tough') ? 1.2 : 1) * (b.traits.includes('weak') ? 0.7 : 1);
// ... existing weapon/glancing/injured/armor lines unchanged ...
```

```ts
// Simulation.ts advanceCombat windup :1347 — fold effective AGI into attack cadence
const agiMul = 1.15 - 0.3 * (this.eff(e, 'agility') / 99); // faster recovery when agile
b.attackCd = (ATTACKS[atk].windup + ATTACKS[atk].recover) * agiMul + this.rng.range(0.2, 0.6);
```

```ts
// Simulation.ts spawnPrisoner (~:241) — give every inmate baseline + trait-seeded attributes
const a = newAttributes();
if (traits.includes('tough')) a.strength = clampAttr(a.strength + 14);
if (traits.includes('fighter')) { a.strength = clampAttr(a.strength + 8); a.stamina = clampAttr(a.stamina + 8); }
if (traits.includes('fast')) a.agility = clampAttr(a.agility + 14);
if (traits.includes('weak')) a.strength = clampAttr(a.strength - 6);
a.strength = clampAttr(a.strength + this.rng.int(0, 12)); a.agility = clampAttr(a.agility + this.rng.int(0, 10));
this.ecs.set<Attributes>(e, 'Attributes', a);
```

```ts
// Simulation.ts serialize() per-entity record (:2318) add a field:
//   social: this.ecs.get<Social>(e, 'Social'),
attr: this.ecs.get<Attributes>(e, 'Attributes'),
// ... and change the return literal: version: 14,
```

```ts
// Simulation.ts hydrate() right after the Social set (~:2359):
this.ecs.set<Attributes>(e, 'Attributes', sanitizeAttributes(r.attr));
// after the entity loop / once playerId is known, recompute speed:
this.recalcSpeed(this.playerId);
```

```ts
// Simulation.ts uiSnapshot() stats object (:924) — add (raw base + energy-scaled effective):
attr: { strength: Math.round(this.attr(pl)?.strength ?? 30), agility: Math.round(this.attr(pl)?.agility ?? 30), skill: Math.round(this.attr(pl)?.skill ?? 30), stamina: Math.round(this.attr(pl)?.stamina ?? 30) },
effAttr: { strength: Math.round(this.eff(pl, 'strength')), agility: Math.round(this.eff(pl, 'agility')), skill: Math.round(this.eff(pl, 'skill')), stamina: Math.round(this.eff(pl, 'stamina')) },
```

**Risks:**
- Hot-path edits: doStrike (:1383) and advanceCombat windup (:1347) run every combat frame for every fighter. eff() calls ecs.get twice — fine, but keep it allocation-free (no object spread). NPCs without an Attributes component must not crash: eff() returns ATTR_FLOOR when attr is null (guards). Ensure spawnPrisoner sets it for all inmates so player-vs-NPC reads real values.
- Balance: STR multiplier 0.7+0.6*str/99 means floor-30 inmates hit ~0.88x baseline — verify this doesn't make early fights feel weak vs existing dmgMin/Max tuned for 1.0. Tune strMul/agiMul ranges; consider centering so floor-30 ≈ 1.0 if you want backward-feel parity (e.g. 0.85 + 0.5*str/99).
- Save compat: version stays loadable because hydrate already bails on malformed data and sanitizeAttributes defaults missing r.attr to floor-30; but if any code elsewhere asserts `data.version === 13`, update it. Grep for the literal 13 / version checks before shipping.
- AGI->speed coupling: ag.speed is currently set once at spawn/applySetup and from traits; if you instead multiply in moveAgents you avoid stale speed, but recalcSpeed-on-train + recalcSpeed-on-load is simpler and matches existing 'set ag.speed' style. Pick ONE approach to avoid double-applying the AGI scalar.
- treadmill/books stations: STATIONS references them but WorldGen/Interactable.ts only define weights/pullup today. trainStation falls back to STATIONS.weights for unknown types, so no crash — but the SKILL/treadmill paths are unreachable until a later stage adds those props. Don't claim they're wired in UI.
- Coupling sign: SKILL->reputation decay uses Social.reputation (player-facing -100..100); confirm that's the intended 'studying lowers rep' axis vs Social.respect. Bible §2 says reputation. Keep small (-1/rep) so it doesn't nuke standing.
- selfTest()/snapshotOk: adding attr to uiSnapshot is additive; just make sure the new sub-objects never throw when attr is null (use ?? 30 fallbacks as shown).


## 4.5 — Allies, recruiting & vendettas  _(effort: M)_

Stage 4.5 adds: (1) a per-NPC "ally of the player" relationship (recruited via a new Recruit social action gated on rel/standing) reusing AIMemorySystem.ally + GroupBehavior clustering; (2) line-of-sight ally assist — on any fight-start, allies (player's or same-gang) within LOS path in and join the brawl; (3) a per-faction Revenge counter that rises when you attack a gang member and scales future ambush odds; (4) a new 'engageEnemy' prisoner intent so NPCs start their OWN fights from grudges (mem.foe / revenge) instead of only random room-pair rolls. Persisted: ally flag on each NPC's mem (new mem.player flag + recruit pact), and the faction revenge map on PlayerGangState. Save bumps v13→v14.

Key reuse points found in code: AIMemory.ally/allyT already exist and DECAY (AIMemorySystem.ts:4-28) but are never SET — repurpose them. rememberAlly() exists & is unused. registerFight(at) (Simulation.ts:497) is the single funnel ALL fight-starts pass through (tryStartFight, standoff, startPlayerFight all call it) — the perfect hook for the LOS assist + revenge bump. nearestAlly() (1098) and gotoGroup() (1118) already cluster same-gang inmates. choosePrisonerIntent (PrisonerAISystem.ts:23) takes a flat PrisonerCtx; evalIntent (1025) builds it. The UI action funnel is Game.npcActions (Game.ts:381) → doAction (404) → requestGangAction / requestAction.

A senior dev can implement directly from the snippets below. Effort ~M (focused, ~150 LOC across 5 files, no new systems, reuses existing scan/path/cluster/memory plumbing).

**New state / save:**
- AIMemory gains `player: boolean` (durable recruit flag) and `pactT: number` (optional pact timer). newMemory/sanitizeMemory updated; decayMemory leaves `player` untouched.
- PlayerGangState gains `revenge: Record<string,number>` (gang id -> 0..100). newGangState/sanitizeGangState updated (clamp + finite filter, mirrors `standing`).
- Save version bumps from 13 to 14 in serialize() (Simulation.ts:2338). No migration code required: revenge defaults to {} via sanitizeGangState; mem.player defaults to false via sanitizeMemory; old v13 saves load cleanly (the hydrate guard already tolerates missing fields).
- mem.player is the ONLY new entity-independent durable field carried per-NPC; it survives because it's a boolean keyed implicitly by entity slot order (same as today's brain record). Recruited allies persist across save/load.
- Revenge decay (optional): tick gang.revenge down slowly in an existing per-day or per-minute hook (e.g. dayRollover or needsSystem) using REVENGE_DECAY so grudges fade if you lay low.

**Files & changes:**

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/AIMemorySystem.ts`
  - Add `player: boolean` to AIMemory (is this NPC a recruited ally of the player) and `pactT: number` (recruit-pact timer; 0 = permanent once recruited).
  - Update newMemory() to init `player:false, pactT:0`.
  - decayMemory(): do NOT decay `player` (a recruit pact is durable); leave ally/allyT decay as-is (that's the transient 'who helped me recently' ref).
  - Implement rememberAlly already-exported helper usage is fine; add `recruit(m, secs=0){ m.player=true; if(secs>0) m.pactT=secs; }` so a recruited NPC is flagged.
  - sanitizeMemory(): persist `player` (boolean) — it's the one durable, non-entity-ref field worth keeping across saves. Keep entity refs (foe/threat/ally) reset as today.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/FactionSystem.ts`
  - Add `revenge: Record<string, number>` to PlayerGangState (gang id -> 0..100 grudge the faction holds against the player).
  - newGangState(): init `revenge: {}`.
  - sanitizeGangState(): restore revenge map (clamp 0..100, finite only), same pattern as `standing`.
  - Add helper `export function revengeAmbushChance(rev: number): number { return Math.min(0.45, rev * 0.004); }` for the ambush scaler.
  - Optionally add `export const REVENGE_DECAY = 0.4;` (points/min) so grudges cool slowly.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/AIIntent.ts`
  - Add `'engageEnemy'` to the PrisonerIntent union.
  - Add `engageEnemy: 'Squaring up'` to INTENT_LABEL.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/PrisonerAISystem.ts`
  - Extend PrisonerCtx with `grudge: boolean` (a remembered foe/revenge target is near AND this NPC is willing to start it).
  - In choosePrisonerIntent: after the `fightNear` block and before the existing `enemyNear` block, add: `if (c.enemyNear && c.grudge && !c.guardNear && (c.tough || c.anger > 0.5) && !c.coward) return 'engageEnemy';` — gated so cowards/guard-watched NPCs still just avoid.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Simulation.ts`
  - Import: add `rememberAlly, recruit` to the AIMemorySystem import (line 18); add `revengeAmbushChance` to the FactionSystem import (line 24).
  - registerFight(at) (497): after the existing body, call `this.rallyAllies(at)` and `this.bumpRevenge(at)` so EVERY fight-start triggers LOS assist + revenge bookkeeping.
  - Add rallyAllies(at): scan prisoners; an NPC is an ally of a fighter if (mem.player && a fighter isPlayer) OR (same gang as a non-player fighter). If within LOS range and free, set it to fight the fighter's foe (or rush toward the brawl) — snippet below.
  - Add bumpRevenge(at): if the fight's loser/target is a gang member and the OTHER side is the player, raise gang.revenge[gang] (snippet below). Simpler: bump revenge inside onFightWin where we already know player-vs-gang (see snippet).
  - onFightWin (2055): where `if (wb.isPlayer && lb.gang) this.gangStanding(lb.gang, -8)` — also `this.gang.revenge[lb.gang] = clamp((this.gang.revenge[lb.gang] ?? 0) + 14, 0, 100);`.
  - evalIntent (1025): compute a `grudge` flag and pass it into the ctx (snippet). nearestEnemy already returns remembered foes; add a same-result entity variant or reuse.
  - actOnIntent (1041): add `case 'engageEnemy'` that walks to the nearest remembered foe and starts an NPC-vs-NPC fight when in range (snippet).
  - Add maybeAmbush(dt) called from prisonerAI loop or a low-freq timer: a gang with high revenge[gang] occasionally has a member start a fight with the player — uses revengeAmbushChance (snippet).
  - resolveTarget (2092): add a `case 'recruit'` social action (snippet) that flips mem.player when rel/standing is high enough.
  - availableActions (2084): append 'recruit' to the prisoner action list (and 'backup' if you want an explicit Ask-for-Backup; backup can also just be the existing helpmember flow extended).
  - Add 'recruit' (and optional 'backup') to InteractAction union (line 52).
  - serialize() (2317): version 13 -> 14 (gang already serialized carries revenge; mem.player rides along in the brain record).
  - hydrate() (2340): on the brain rebuild (2358) sanitizeMemory now carries `player`; add `if(!data.gang) ... ` already handles default; revenge restored by sanitizeGangState. Accept both v13 and v14 (no migration needed — new fields default safely).
  - gangInfoFor (913) / uiSnapshot relationships (934): expose `ally: !!b.mem?.player` and a `canRecruit` flag so the UI can show the Recruit button + an 'ally' tag; add revenge to the faction snapshot for the Gangs menu.

**UI wiring:**
- Game.ts npcActions (381): add a `Recruit` PanelAction for non-player prisoners that aren't already allies (`!b.mem?.player`); optionally hide it until rel is friendly to avoid spam. It routes through the existing final else-branch (`requestAction(sel, key as InteractAction)`) because 'recruit' is a new InteractAction and is NOT in COMBAT_KEYS/GANG_KEYS/CHAOS_KEYS/SELF_KEYS.
- Game.ts refreshPanel meta (343): for an ally NPC add an `Ally` tag (read `b.mem?.player`) alongside the existing gang relation line so the player can see who's recruited.
- uiSnapshot relationships (934-938): add `ally: !!b.mem?.player` to each relationship row so the Relationships menu can mark allies; add `hint:'your ally'` when player.
- Faction/Gangs menu (uiSnapshot.faction.standings, 950): add `revenge: Math.round(g.revenge[gg.id] ?? 0)` per gang so the menu can show 'They want payback' when revenge is high — gives the player feedback that ambushes are coming.
- Optional explicit 'Ask for Backup' button: extend the existing requestGangAction('helpmember') path or add a 'backup' action that calls rallyAllies(playerId) on demand when the player is mid-fight (only meaningful while pb.state==='fight'); cheapest to skip — rallyAllies already auto-fires on fight start.
- No render/audio changes required: allies joining a brawl reuse the existing fight state, crowdReact, impact/float events, and guard dispatch — presentation is already READ-ONLY and will animate them correctly.

**Key snippets:**

```ts
// AIMemorySystem.ts — durable ally flag
export interface AIMemory {
  foe: number; foeT: number; threat: number; threatT: number;
  ally: number; allyT: number;   // transient: who recently helped me
  searchedT: number; fearT: number; angerT: number;
  player: boolean;               // 4.5: recruited ally of the player (durable)
}
export function newMemory(): AIMemory { return { foe:0,foeT:0,threat:0,threatT:0,ally:0,allyT:0,searchedT:0,fearT:0,angerT:0, player:false }; }
export function recruit(m: AIMemory) { m.player = true; }
// decayMemory: leave m.player as-is (durable). sanitizeMemory: add
//   m.player = !!d.player;
```

```ts
// FactionSystem.ts — faction grudge
export interface PlayerGangState { /* ...existing... */ revenge: Record<string, number>; }
// newGangState: add `revenge: {}`
// sanitizeGangState: mirror the standing block:
//   if (d.revenge && typeof d.revenge === 'object') for (const k in d.revenge) { const v = d.revenge[k]; if (typeof v==='number'&&isFinite(v)) g.revenge[k]=Math.max(0,Math.min(100,v)); }
export function revengeAmbushChance(rev: number): number { return Math.min(0.45, rev * 0.004); }
```

```ts
// PrisonerAISystem.ts — NPCs start their own grudge fights
export interface PrisonerCtx { /* ...existing... */ grudge: boolean; }
// inside choosePrisonerIntent, insert BEFORE the existing `if (c.enemyNear)` block:
  if (c.enemyNear && c.grudge && !c.guardNear && !c.coward && (c.tough || c.anger > 0.5)) return 'engageEnemy';
```

```ts
// Simulation.ts evalIntent — feed the grudge flag (nearestEnemy already counts mem.foe/threat + gang rivals)
const enemyE = this.nearestEnemyEntity(e, b, p, 5.5);   // entity-returning twin of nearestEnemy (add it)
const grudge = !!enemyE && !!b.mem && (b.mem.foe === enemyE || (b.gang && areEnemies(b.gang, this.brain(enemyE)!.gang)));
return choosePrisonerIntent({ /* ...existing fields... */ enemyNear: !!enemyE, grudge }, this.rng.float());
// add a tiny entity-returning variant next to nearestEnemy (1088):
private nearestEnemyEntity(e: Entity, b: Brain, p: Position, range: number): Entity | null {
  let best: Entity | null = null, bd = range;
  for (const o of this.ecs.query('Brain','Position')) { if (o===e) continue; const ob=this.brain(o)!; if (ob.role!=='prisoner'||ob.state==='down'||ob.state==='solitary') continue;
    const hostile = areEnemies(b.gang, ob.gang) || (b.mem && (b.mem.foe===o || b.mem.threat===o)); if (!hostile) continue;
    const q=this.pos(o)!; const d=Math.hypot(q.x-p.x,q.z-p.z); if (d<bd){bd=d;best=o;} }
  return best;
}
```

```ts
// Simulation.ts actOnIntent — carry out engageEnemy (NPC-vs-NPC self-started fight)
case 'engageEnemy': {
  const foe = this.nearestEnemyEntity(e, b, p, 5.5);
  if (foe == null) { b.intent = 'schedule'; break; }
  const fp = this.pos(foe)!; const d = Math.hypot(fp.x - p.x, fp.z - p.z);
  if (d <= 1.6) { this.startNpcFight(e, foe); }
  else if (!ag.path && ag.repathCd <= 0) { const path = this.path(this.map.worldToIdx(p.x,p.z), this.map.worldToIdx(fp.x,fp.z), e); ag.repathCd = 1; if (path&&path.length){ag.path=path;ag.step=0;b.state='goto';} else b.intent='avoidEnemy'; }
  break;
}
// shared NPC fight starter (factor out of tryStartFight so engageEnemy + ambush reuse it):
private startNpcFight(a: Entity, bb: Entity) {
  const ab=this.brain(a)!, bbr=this.brain(bb)!; if (ab.state==='fight'||bbr.state==='fight'||bbr.state==='down') return;
  ab.state='fight'; ab.foe=bb; ab.attackCd=0.3; ab.cphase='squareUp'; ab.cTimer=0.4;
  bbr.state='fight'; bbr.foe=a; bbr.attackCd=0.5; bbr.cphase='squareUp'; bbr.cTimer=0.4;
  if (ab.mem) rememberFoe(ab.mem, bb); if (bbr.mem) rememberFoe(bbr.mem, a);
  this.bus.emit('alert', { type:'fight', text:`${ab.name} goes after ${bbr.name}!` });
  this.dispatchGuard(a); this.registerFight(a);
}
```

```ts
// Simulation.ts — LOS ally assist; called from registerFight(at) for EVERY fight start
private rallyAllies(fighter: Entity) {
  const fb = this.brain(fighter); if (!fb || fb.foe == null) return;
  const fp = this.pos(fighter)!; const foe = fb.foe; const RANGE = 8;
  let joined = 0;
  for (const o of this.ecs.query('Brain','Position')) {
    if (joined >= 2) break; if (o === fighter || o === foe) continue;
    const ob = this.brain(o)!; if (ob.role!=='prisoner' || ob.isPlayer || ob.state==='fight' || ob.state==='down' || ob.state==='solitary' || ob.traits.includes('cowardly')) continue;
    const isAlly = (fb.isPlayer && ob.mem?.player) || (!!fb.gang && ob.gang === fb.gang && fb.gang === this.brain(foe)?.gang === false);
    if (!isAlly) continue;
    const op = this.pos(o)!; const d = Math.hypot(op.x-fp.x, op.z-fp.z); if (d > RANGE) continue;       // LOS = same room + range (cheap proxy)
    if (this.roomIdAt(op) !== this.roomIdAt(fp)) continue;                                              // same-room gate == 'can see it'
    if (ob.mem) rememberAlly(ob.mem, fighter);                                                          // remember who they backed
    this.startNpcFight(o, foe); joined++;
    this.bus.emit('alert', { type:'fight', text:`${ob.name} jumps in to help ${fb.name}!` });
  }
}
```

```ts
// Simulation.ts onFightWin — raise the faction grudge when YOU beat their member (after existing gangStanding line)
if (wb.isPlayer && lb.gang) { this.gangStanding(lb.gang, -8); this.gang.revenge[lb.gang] = clamp((this.gang.revenge[lb.gang] ?? 0) + 14, 0, 100); }
// (keep the lb.isPlayer && wb.gang standing line as-is)
```

```ts
// Simulation.ts — revenge-fuelled ambush; call from prisonerAI loop on a throttled timer (e.g. reuse fightCd cadence or a new revengeCd)
private maybeAmbush(dt: number) {
  this.revengeCd = (this.revengeCd ?? 0) - dt; if (this.revengeCd > 0) return; this.revengeCd = this.rng.range(8, 14);
  for (const gid in this.gang.revenge) {
    const rev = this.gang.revenge[gid]; if (rev < 25) continue;
    if (!this.rng.chance(revengeAmbushChance(rev))) continue;
    const pp = this.pos(this.playerId)!; const pRoom = this.roomIdAt(pp);
    const hunter = this.ecs.query('Brain','Position').find((o) => { const ob=this.brain(o)!; return ob.gang===gid && ob.role==='prisoner' && !ob.isPlayer && ob.state!=='fight' && ob.state!=='down' && ob.state!=='solitary' && this.roomIdAt(this.pos(o)!)===pRoom; });
    if (hunter == null) continue;
    this.startNpcFight(hunter, this.playerId);
    this.gang.revenge[gid] = clamp(rev - 20, 0, 100);   // spend the grudge
    this.bus.emit('alert', { type:'fight', text:`${this.brain(hunter)!.name} ambushes you for the ${GANG_MAP[gid].name}!` });
    return;   // at most one ambush per check
  }
}
```

```ts
// Simulation.ts resolveTarget — Recruit social action (befriend → fights FOR you)
case 'recruit': {
  if (!ts) return '';
  if (tb.mem?.player) return `${tb.name} already runs with you.`;
  const standingOk = !tb.gang || !areEnemies(tb.gang, this.gang.membership);   // a rival's member won't flip easily
  const ok = ts.rel >= 45 && standingOk && this.rng.chance(0.4 + ps.reputation*0.004 + ps.respect*0.003 + (this.playerHas('talker')?0.15:0));
  if (ok) { if (tb.mem) recruit(tb.mem); ts.rel = clamp(ts.rel + 6, -100, 100); ps.respect = clamp(ps.respect + 2, 0, 100); this.metrics.allyHelp++; this.bubble(target, this.rng.pick(['I got your back.','We\'re solid.','👊']), 'talk', 1.4); return `${tb.name} has your back now.`; }
  return ts.rel < 45 ? `${tb.name}: \"Earn my trust first.\"` : `${tb.name} isn\'t ready to side with you.`;
}
// availableActions: for non-player prisoners append 'recruit' (UI gates visibility on canRecruit)
```

```ts
// Game.ts npcActions — surface Recruit (and ally tag); near the gang-action block (~395)
const ally = !!this.sim.ecs.get<Brain>(e,'Brain')?.mem?.player;
if (!ally) a.push({ key: 'recruit', label: 'Recruit', kind: 'social' });
// doAction routes 'recruit' through the existing requestAction(sel, key) branch (it's an InteractAction) — no new key list needed,
// since recruit is NOT in COMBAT/GANG/CHAOS/SELF key sets it falls to the final `requestAction` else-branch.
```

**Risks:**
- LOS proxy: rallyAllies uses same-room + range as a cheap 'can see the fight' test (matching how nearestFight/tension already work). True raycast LOS is more code; the same-room gate is consistent with the rest of the sim and avoids allies teleporting through walls to help. Document it as the intended proxy.
- Cascade fights: rallyAllies + engageEnemy both call startNpcFight, which calls registerFight, which calls rallyAllies again — recursion risk. Mitigate by the `joined<2` cap, the `state==='fight'` early-out in startNpcFight (already a fighter won't re-trigger), and only rallying NON-fighting allies. Confirm registerFight isn't called for an entity already fighting before rally (it is called once at fight start, fine).
- Mass pile-on lethality: more allies near a downed player feeds lethalKnockdown's `hostiles>=2` term (Simulation.ts:1425), raising death odds sharply. This is thematically correct (Hard Time) but tune the rally cap (2) and consider excluding the player's OWN allies from the player's hostiles count if it feels unfair.
- Ambush frequency: revengeAmbushChance caps at 0.45 on an 8-14s timer — with multiple grudged gangs this could spawn frequent ambushes. The `rev<25` floor + `rev-20` spend + optional REVENGE_DECAY keep it bounded; playtest the constants.
- Recruiting a rival-gang member: the standingOk gate prevents flipping a hostile gang's member trivially; without it, mem.player on a rival creates contradictory loyalties (they'd both rally for you AND be a gang rival). Keep the gate.
- engageEnemy vs guard discipline: NPCs self-starting fights raises fight volume → more lockdowns via registerFight's fightsRecent>=3 path (503). Acceptable (more chaos) but watch lockdown spam in playtest; the guardNear gate in choosePrisonerIntent already suppresses fights under guard watch.
- Save compat: mem.player and revenge default safely, but DOUBLE-CHECK sanitizeMemory keeps `player` (today it drops everything but timers). Forgetting this silently un-recruits all allies on reload.
- Entity-ref persistence: ally/foe entity refs are reset on load (by design). mem.player is the only durable allegiance — recruited allies persist, but a remembered foe does NOT, so NPC grudges reset across saves. This is consistent with current behavior; note it if persistent NPC vendettas across saves are desired (would need to store foe by a stable id, out of scope).


## 4.3 — Graphics / Animation / Props Overhaul (procedural, render-only)  _(effort: L)_

A coherent, visual-direction-first overhaul that stays 100% procedural (no asset files) and 100% render-only (RenderSync/CharacterFactory never write sim). The sim is already rich enough to drive everything: Brain.state covers idle/working/resting/washing/eating/talking/threatening/trading/training/fight/down/respond/searching/beingSearched/escorting; Brain.cphase covers windup/strike/block/dodge/hitReact/stumble/down; Brain.injuredT (number) drives a limp; Inventory.items + ITEMS[id].combat/wKnock drive weapon-in-hand; the EventBus already emits impact/float on every blow. The current renderer USES ALMOST NONE of this — animate() only branches on down/fight/moving/idle, characters have no held weapon and no injured/KO-specific posing, and props are single-instance with no wear/clutter variety.

VISUAL DIRECTION: "grimy institutional realism with toon-readable silhouettes." Keep the existing back-side outline shells (silhouette is the identity). Push three pillars: (1) READABLE CHARACTERS — bigger hands/feet, a weapon mesh that appears in the right hand when armed, a hunched injured limp, a face-down KO sprawl, gang/role color tells; (2) FULL ANIMATION SET — map every Brain.state to a pose loop (sleep curl, work hammer, eat hand-to-mouth, talk gesture, victory pump, defeat slump) plus polished fight phases; (3) ATMOSPHERE — prop variety + wear via a seeded clutter pass, warmer key/cooler fill lighting mood per room, and a capped blood/spark particle pool on impact.

Effort is concentrated in CharacterFactory.ts (add hands/feet/weapon slot + pose targets), RenderSync.ts (state→pose table + armed/injured reads), PropRenderer.ts (clutter/variant pass), WorldRenderer.ts (lighting mood + decals), one new file CombatFX.ts (particle pool), and one new texture file. NO required sim changes and NO save-version bump — the overhaul reads existing state. Two OPTIONAL tiny sim additions (a cached `armed` flag and a `victoryT` timer) are listed for cleaner reads but are not needed for v1.

**New state / save:**
- NO required sim-state or save-version change. The overhaul is render-only and reads existing fields: Brain.state, Brain.cphase, Brain.injuredT, Needs.anger/fear/health, Social.suspicion, Render.appearance, and Inventory.items (+ ITEMS[].combat/wKnock). Save stays v13. RenderSync already receives the live ECS; Inventory is a registered component (see components.ts:74 and serialize()).
- OPTIONAL (only if you want cleaner reads — would bump save to v14): add Brain.armed?: string (weapon kind cached by CombatSystem when a fight starts) so RenderSync doesn't scan Inventory every frame; and Brain.victoryT?: number (set on fight-win in knockDown/onFightWin) to drive the victory pump without RenderSync keeping its own lastState map. If added: include both in serialize() ents brain (already spreads ...brain), reset them in hydrate() (set armed:undefined, victoryT:0 like the other transient combat fields at line 2358), and bump version 13→14. Recommended to SKIP for v1 — RenderSync can derive both render-side with zero save risk.
- Render-side memory (no save impact): RenderSync keeps a private Map<Entity,{lastState,idleSeed,victoryT}> reset in reset(); CombatFX keeps its own pools reset on reset(). Neither is serialized.

**Files & changes:**

- `src/render/CharacterFactory.ts`
  - Add hands as small rounded boxes (knuckle read) instead of spheres; add a 'weaponSlot' THREE.Group parented under armR at the hand (y=-armH-0.04) returned in CharView so RenderSync can show/hide a held weapon.
  - Add a buildWeapon(kind) helper (shiv/club/blade/tool) using shared materials: thin tapered box (shiv/blade) or cyl (club/pipe) ~0.04r; default hidden (visible=false).
  - Add feet: replace the flat shoe box with a 2-part shoe (sole box + toe cap box) for a clearer footprint; keep castShadow.
  - Add CharView fields: weaponSlot, weaponMesh, footL/footR are inside legs already; add headTilt baseline. Extend AppearanceOpt unchanged.
  - Add a small 'browAngry' tweakable: store brow meshes refs (browL/browR) on CharView so RenderSync can angle them for anger/fight (face emotion).
  - Add gang/crew color tell: if look has a crew accent, add a thin headband mesh (torus or box ring) on the head in the accent color (replaces source's offensive gating per design line 104).
  - Expose torso reference already present; add a 'spine' alias = torso for clarity in pose code (no new object).

- `src/render/RenderSync.ts`
  - Import { Inventory } from '../ecs/components' and { ITEMS } from '../data/items'.
  - Compute armed/weaponKind per entity from Inventory (max combat item) and call setWeapon(v, kind) — only when state is fight/threatening or selected/player to keep weapons hidden during peaceful schedule (Hard Time feel: weapons come out for violence).
  - Replace animate() if/else ladder with a POSE TABLE: a switch over Brain.state that lerps each rig joint toward target angles, with per-state phase via v.walkPhase as a shared clock. Add cases: resting (sleep curl on bunk — torso reclined, legs tucked), working (rhythmic arm hammer/scrub), eating (hand-to-mouth cycle), washing (scrub torso), talking/trading/threatening (gesture sway + head nod, threatening leans in + angry brows), training (squat/curl loop), searching/beingSearched (arms-out frisk), escorting/escorted (stiff walk).
  - Injured limp: if Brain.injuredT>0 and moving, bias one leg stiff + add a per-step torso dip + slower walkPhase; if idle, hunch (rig.rotation.x lean + one arm clutching torso).
  - KO/down polish: extend the existing down branch into a face-down sprawl — rig.rotation.z to ~PI/2.1 (already), add rig.rotation.x sag, drop arms splayed, head loll; keep lerp.
  - Victory/defeat: when state transitions fight→idle as winner (cphase undefined + recent), play a 1.2s arm-pump; loser (down) already sprawls. Detect via a small local lastState map in RenderSync (render-only memory, no sim).
  - Face emotion: angle brows down on high anger/fight, raise on fear; drive from Needs.anger/fear already read.
  - Add idle VARIETY: pick a per-entity idle sub-loop (weight-shift, look-around, scratch) seeded by entity id so a crowd doesn't move in lockstep.

- `src/render/PropRenderer.ts`
  - Add a seeded clutter pass: a mulberry32(seed) RNG so clutter is stable across reloads; scatter non-blocking decals (trays, food scraps, cigarette butts, graffiti decals, wall stains, puddles, trash piles, laundry) into rooms by type.
  - Add prop VARIANTS: bunk()/locker()/table() take a wear seed → randomize blanket color from a small palette, add/remove pillow, tilt a locker door ajar, add rust decal quads. Wrap shared geometries (don't allocate per-call where avoidable).
  - Add new furniture builders: poster/graffiti quad (canvas texture), wall clock, laundry basket, mop+bucket, food cart, dumbbell rack, payphone, notice board, ceiling fan (static), crate stacks, pipe junctions. All use shared M.* materials.
  - Cell personalization: per-cell deterministic extras (a poster, a stack of books, a hidden-looking floor seam) so cells differ.
  - Add a 'graffiti' canvas-texture decal applied to a few wall faces (DoubleSide plane offset 0.51 from wall center) — cheap, no new lights.

- `src/render/WorldRenderer.ts`
  - Lighting MOOD: keep point lights but add per-room warm/cool bias (cafeteria warm 0xffe4b0, shower cool, solitary dim+harsh) — values already in THEME.rooms.light; increase contrast by lowering ambient slightly and adding a faint cool fill. Add flickering fluorescent option on a couple of hallway lamps (sin-based intensity, updated from Game loop OR a tiny self-updating closure registered with a render-tick callback — prefer a returned updater).
  - Floor decals: blood-stain texture pool near combat-prone rooms (yard/cellblock) using a new createStainTexture; wear paths already via grime — increase variety by rotating grime UV per room.
  - Walls: add a baseboard trim instanced strip (dark band at floor) and occasional rust-streak vertical decals on tall walls for grime read; add a few wall-mounted cage lights (emissive box + glowSprite) for vertical interest.
  - Signage: expand signFor and makeSign with arrows/zone numbers + a 'no-cross' floor stencil at restricted thresholds (reuse warning stripe).

- `src/render/textures/createStainTexture.ts`
  - NEW FILE. createStainTexture(color='#5a0e0e') → canvas radial blotches + drip streaks, transparent, for blood/oil floor decals. Mirrors createGrimeTexture style (CanvasTexture, SRGB, RepeatWrapping).

- `src/render/CombatFX.ts`
  - NEW FILE. CombatFX class: a CAPPED particle pool (single THREE.Points with a fixed BufferGeometry, e.g. 120 verts) reused for blood/spark bursts. spark(x,z,color) and blood(x,z) spawn N particles with velocity+gravity+life in flat arrays; update(dt) advances and fades via per-vertex alpha (vertexColors). Also manages persistent floor blood-decal quads (small pool, ~24, recycled). Render-only; driven by bus 'impact' (spark) and a new optional 'blood' read.
  - Provide a tiny attachAt(x,y,z) ring/flash mesh recycler to replace Game.addImpact's per-hit allocation with a pooled flash (kills GC churn during pile-ons).

- `src/core/Game.ts`
  - Instantiate CombatFX (new CombatFX(scene)); add to scene once. In the 'impact' bus handler call fx.spark(x,z) and fx.flash(x,z) instead of allocating a ring each hit (keep audio.hit()). Optionally subscribe to a new 'blood' event for the bloodier hits.
  - Call fx.update(dt) in loop() alongside this.updateFx(dt) (can replace fxRings entirely).
  - On reset()/loadRun(): call fx.reset() next to feedback.reset().
  - Pass the dressRooms world seed (this.sim.rng.seed or a stable per-world seed) into dressRooms so clutter is deterministic & save-stable.
  - If using flickering lamps updater returned from buildPrison, call it in loop().

**UI wiring:**
- Game.ts:69 — after this.feedback = new Feedback(); add this.fx = new CombatFX(this.app.scene); (declare private fx!: CombatFX near line 32).
- Game.ts:125 — change bus.on('impact') handler to: this.fx.spark(x,z); this.fx.flash(x,z); (keep audio.hit at line 130). Optionally bus.on('blood', ...) → this.fx.blood(x,z) and emit 'blood' from Simulation.doStrike only when dmg>0.10 (that WOULD be a 1-line sim add; otherwise just call fx.blood from the existing impact handler when a damage float was big — but render can't see dmg, so for bloodier feel either add the optional 'blood' event or always spark).
- Game.ts:520 — add this.fx.update(dt) in loop(); can delete the fxRings ring code (485-501) once fx.flash replaces it, or keep both.
- Game.ts:435 & 451 — add this.fx.reset() next to this.feedback.reset() in reset()/loadRun().
- Game.ts:59 — pass a stable seed into dressRooms: dressRooms(scene, map, rooms, cells, (this.sim as any).rng?.seed ?? 1) (rng.seed already used in serialize()).
- No HUD/Menu changes required — this overhaul is purely in-world. Status bars / icons in CharacterFactory.updateBars + RenderSync.icon are untouched.
- If you add the optional flickering-lamp updater, have buildPrison return an update(time) closure and call it from Game.loop().

**Key snippets:**

```ts
// CharacterFactory.ts — weapon slot + held-weapon builder (add near arms; export setWeapon)
const WMAT = { blade: new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.35, metalness: 0.7 }), club: new THREE.MeshStandardMaterial({ color: 0x4a4d55, roughness: 0.6, metalness: 0.4 }), shiv: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.4, metalness: 0.6 }) };
function buildWeapon(kind: 'shiv'|'club'|'blade'|'tool'): THREE.Object3D {
  if (kind === 'club' || kind === 'tool') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 6), WMAT.club); m.position.set(0, -0.18, 0); m.rotation.x = Math.PI/2.2; shell(m, 1.1); return m; }
  const g = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.30, 0.012), kind==='blade'?WMAT.blade:WMAT.shiv); blade.position.set(0,-0.18,0.04); blade.rotation.x = Math.PI/2.4; shell(blade,1.08); g.add(blade); return g;
}
// inside makeCharacter, after building armR/hands:
const weaponSlot = new THREE.Group(); weaponSlot.position.y = -armH - 0.04; weaponSlot.visible = false; armR.add(weaponSlot);
// add to CharView return: weaponSlot, weaponKind: '' as string
```

```ts
// CharacterFactory.ts — runtime weapon swap (export). Pools by kind so we don't rebuild every frame.
export function setWeapon(v: CharView, kind: '' | 'shiv' | 'club' | 'blade' | 'tool') {
  if (v.weaponKind === kind) return; v.weaponKind = kind;
  v.weaponSlot.clear();
  if (!kind) { v.weaponSlot.visible = false; return; }
  v.weaponSlot.add(buildWeapon(kind)); v.weaponSlot.visible = true;
}
```

```ts
// RenderSync.ts — derive armed weapon kind from inventory (read-only)
private weaponKind(e: Entity): '' | 'shiv' | 'club' | 'blade' | 'tool' {
  const inv = this.ecs.get<Inventory>(e, 'Inventory'); if (!inv) return '';
  let best = '' as ''|'shiv'|'club'|'blade'|'tool', bc = 0;
  for (const id of inv.items) { const c = ITEMS[id]?.combat ?? 0; if (c > bc) { bc = c; const t = ITEMS[id]?.type; best = id==='club'?'club':id==='blade'?'blade':id==='tool'?'tool':'shiv'; } }
  return bc > 0 ? best : '';
}
```

```ts
// RenderSync.ts — in update(), gate weapon visibility to violent/inspected moments
const show = b?.state === 'fight' || b?.state === 'threatening' || e === selected || !!b?.isPlayer;
setWeapon(v, show ? this.weaponKind(e) : '');
```

```ts
// RenderSync.ts — pose table skeleton replacing the idle else-branch (lerp helpers omitted)
private poseFor(v: CharView, st: string, dt: number, time: number, e: Entity, injured: boolean) {
  const L = (g: THREE.Group, ax: number, k = 0.18) => { g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, ax, k); };
  const ph = (v.walkPhase += dt * 4);
  switch (st) {
    case 'resting': L(v.torso, -0.9, 0.06); L(v.legL, 1.3); L(v.legR, 1.1); v.rig.position.y = THREE.MathUtils.lerp(v.rig.position.y, 0.45, 0.06); v.head.rotation.z = -0.4; break; // curled on bunk
    case 'working': { const s = Math.sin(ph*2.2); L(v.armR, -1.4 + s*0.7, 0.3); L(v.armL, -0.3); v.torso.rotation.x = 0.18 + s*0.05; break; } // hammer/scrub
    case 'eating': { const s = (Math.sin(ph*2)+1)/2; L(v.armR, -0.4 - s*1.0, 0.3); v.head.rotation.x = s*0.2; break; }
    case 'washing': { const s = Math.sin(ph*3); L(v.armR, -1.2+s*0.3); L(v.armL, -1.2-s*0.3); break; }
    case 'training': { const s = Math.abs(Math.sin(ph*2)); v.rig.position.y = -s*0.12; L(v.legL, s*0.4); L(v.legR, s*0.4); L(v.armR, -1.4-s*0.4); L(v.armL, -1.4-s*0.4); break; }
    case 'talking': case 'trading': case 'threatening': { const s = Math.sin(ph*1.6); L(v.armR, -0.3 + s*0.5, 0.2); v.head.rotation.y = s*0.18; if (st==='threatening') { v.rig.rotation.x = 0.12; this.brows(v, 1); } break; }
    case 'searching': case 'beingSearched': L(v.armL, -1.3); L(v.armR, -1.3); break;
    default: { const breathe = Math.sin(time*2 + e)*0.02; L(v.armL, 0.04+breathe, 0.15); L(v.armR, 0.04+breathe, 0.15); v.rig.position.y = breathe; }
  }
  if (injured && st !== 'down') { v.rig.rotation.x = THREE.MathUtils.lerp(v.rig.rotation.x, 0.22, 0.1); L(v.armL, -0.8, 0.1); } // clutch + hunch
}
```

```ts
// RenderSync.ts — injured limp overlay inside the moving branch
if (injured) { v.legR.rotation.x *= 0.4; v.rig.position.y += Math.max(0, Math.sin(v.walkPhase)) * 0.04; v.walkPhase += dt * -2.5; }
```

```ts
// RenderSync.ts — victory pump via render-only memory
const mem = this.mem(e); // {lastState, victoryT}
if (mem.lastState === 'fight' && state === 'idle') mem.victoryT = 1.2; // became winner
if (mem.victoryT > 0) { mem.victoryT -= dt; const p = Math.sin((1.2-mem.victoryT)*12); v.armR.rotation.x = -2.2 - Math.abs(p)*0.4; v.armL.rotation.x = -2.0; }
mem.lastState = state;
```

```ts
// CharacterFactory.ts — brow emotion helper exported
export function setBrows(v: CharView, anger: number) { const a = THREE.MathUtils.clamp(anger, -1, 1); if (v.browL) v.browL.rotation.z = -a*0.5; if (v.browR) v.browR.rotation.z = a*0.5; }
```

```ts
// CombatFX.ts — capped particle pool (core)
export class CombatFX {
  private pts: THREE.Points; private pos: Float32Array; private col: Float32Array; private vel: Float32Array; private life: Float32Array; private n = 0; private CAP = 120;
  constructor(private scene: THREE.Scene) {
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(this.CAP*3); this.col = new Float32Array(this.CAP*3); this.vel = new Float32Array(this.CAP*3); this.life = new Float32Array(this.CAP);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  burst(x: number, z: number, count: number, r: number, g: number, b: number, spread: number) {
    for (let i = 0; i < count; i++) { const j = (this.n++ % this.CAP); const k = j*3; this.pos[k]=x; this.pos[k+1]=1.2; this.pos[k+2]=z; const a = Math.random()*Math.PI*2, sp = 1+Math.random()*spread; this.vel[k]=Math.cos(a)*sp; this.vel[k+1]=2+Math.random()*2; this.vel[k+2]=Math.sin(a)*sp; this.col[k]=r; this.col[k+1]=g; this.col[k+2]=b; this.life[j]=0.5+Math.random()*0.3; }
  }
  spark(x: number, z: number) { this.burst(x, z, 6, 1, 0.94, 0.6, 3); }
  blood(x: number, z: number) { this.burst(x, z, 10, 0.6, 0.05, 0.05, 2.2); }
  update(dt: number) { let any = false; for (let j = 0; j < this.CAP; j++) { if (this.life[j] <= 0) continue; any = true; const k = j*3; this.life[j] -= dt; this.vel[k+1] -= 9*dt; this.pos[k]+=this.vel[k]*dt; this.pos[k+1]+=this.vel[k+1]*dt; this.pos[k+2]+=this.vel[k+2]*dt; if (this.pos[k+1] < 0.05 || this.life[j] <= 0) { this.life[j]=0; const f = j*3; this.col[f]=this.col[f+1]=this.col[f+2]=0; } } if (any) { (this.pts.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (this.pts.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true; } }
  reset() { this.life.fill(0); this.col.fill(0); (this.pts.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true; }
}
```

```ts
// PropRenderer.ts — seeded RNG so clutter is deterministic/save-stable
function mulberry32(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// in dressRooms(scene, map, rooms, cells, seed = 1): const rnd = mulberry32(seed);
// then scatter non-blocking decals: if (rnd() < 0.5) place(graffiti(), wx, wz);  etc.
```

**Risks:**
- Per-frame Inventory scan in RenderSync.weaponKind runs for every entity every frame — cheap (items arrays are tiny) but gate it behind the 'show' check (only fight/threatening/selected/player) so peaceful crowds skip it. Memoize weaponKind result on the render-side mem map and only recompute when state changes if profiling shows cost.
- INVARIANT: RenderSync/CharacterFactory/CombatFX must never call sim setters. Reading ECS components (Inventory, Needs, Brain) is fine and already done; do not mutate them. Reviewer should grep the new code for any assignment to .health/.items/etc.
- Pose table must keep lerping toward targets (never hard-set) or characters snap when state changes mid-blend — follow the existing THREE.MathUtils.lerp pattern. The 'down' branch already early-returns; ensure injured/limp code doesn't run for 'down'.
- Weapon mesh is parented to armR which is rotated heavily during fight phases — verify the blade points forward on 'strike' (test with a club and a blade). May need a small base rotation offset in buildWeapon per kind.
- Particle pool: CAP=120 with ring-buffer reuse means a long pile-on overwrites oldest particles — acceptable. Keep PointsMaterial.size modest; on mobile, points can render as large quads — test on a low-DPI device and consider sizeAttenuation:false if they balloon.
- Determinism: clutter MUST use the seeded RNG (not Math.random) so it survives save/reload and looks identical — CharacterFactory's existing Math.random() for hair/build is fine because appearance is stored in Render.appearance, but new PROP clutter is not serialized, so it must be seed-derived to avoid reshuffling on every load.
- Adding many new prop meshes risks draw-call/material bloat — reuse the shared M.* materials and shared BoxGeometry where possible; prefer InstancedMesh for repeated decals (e.g. baseboard trim, cigarette butts) like WorldRenderer already does for walls.
- If you take the OPTIONAL sim route (Brain.armed/victoryT), you MUST bump save to v14 and reset both fields in hydrate() (line ~2358) — forgetting leaves stale combat state on load. Recommended to skip for v1.
- Canvas textures (graffiti/stain/poster) allocate a 256² canvas each — build them ONCE as module-level singletons like createGrimeTexture, not per prop, or memory grows with room count.


## 4.3 — Addictive Loop + Settings (goals tied to the sentence, streaks, notoriety ladder, juice, settings, onboarding)  _(effort: M)_

The spine (sentence/served, daily summary, objectives, tiers, juice primitives) already exists — this stage tightens the compulsion loop on top of it rather than rebuilding it. Six workstreams: (1) Sim: add long-term "Milestones" tied to the sentence (survive to day N, reach Feared, bank $X for a shiv) + a clean-day streak with escalating reward and stakes, stored in Progression and surfaced in summary/HUD; (2) Notoriety ladder NPCs visibly react to (bubbles + give-way behavior gated on player tier, read-only consumption of existing repTier); (3) Juice: a screen-shake/hitstop channel via new EventBus 'shake'/'hitstop' events the camera+loop consume, reward-pop floats on objective/milestone completion, and audio stingers for milestone/streak/levelup; (4) Settings menu (real tab replacing the stub): master volume slider, SFX toggle, difficulty-on-the-fly note, reduce-motion — persisted to localStorage, read by AudioSystem (already supports it) and a new global FX-pref; (5) Onboarding: first-run coach-mark overlay driven by setup.tutorialTips (currently stored but never read) + a first-3-days nudge feed; (6) "One more day" hook: the daily summary card ends with a teaser of tomorrow's headline objective + current streak/next-milestone progress and a single primary CTA. Save bumps to v14; all new fields are additive with hydrate defaults so v13 saves load clean. The Simulation stays authoritative; render/audio remain read-only. No new files strictly required, but one small src/render/Juice.ts helper and one src/ui settings partial keep Game.ts/Menus.ts from bloating.

**New state / save:**
- Progression (Progression.ts): + bestStreak:number, + milestonesDone:number. sanitizeProgression already iterates Object.keys(newProgression()) copying finite numbers — adding the keys to newProgression() auto-covers load defaults, NO extra migration line.
- Simulation new fields: milestones:Milestone[]=[]; cleanStreak=0. Reset in generate()/startNewRun; rebuilt on sentence change via syncMilestones().
- serialize(): add milestones + cleanStreak to the prog bag (line ~2337) and bump version 13 -> 14 (line 2338).
- hydrate(): cleanStreak via num(data.cleanStreak,0); milestones via Array.isArray(data.milestones)&&length ? map(sanitize) : buildMilestones(this.sentence) (line ~2384 area). v13 saves: cleanStreak->0, milestones rebuilt from current sentence — clean and safe.
- SaveManager: confirm it does not hard-reject on version mismatch (hydrate already bails only on missing/empty ents). If SaveManager compares version, allow <=14.
- FxPrefs persisted under localStorage 'll3d_fx' (reduceMotion, optional sfx mirror); AudioSystem keeps its own 'll3d_audio' for volume/mute (already implemented).
- saveInfo()/title 'Continue' unaffected (reads ents/day only). selfTest gains milestonesOk.

**Files & changes:**

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Progression.ts`
  - Add to Progression interface: bestStreak:number, milestonesDone:number (additive numeric fields — sanitizeProgression already copies all numeric keys, so no extra migration code).
  - Add a Milestone model + pool: export interface Milestone { id; text; kind:'survive'|'tier'|'bank'|'wins'|'crewgoals'; goal; reward:{money?;rep?;respect?;item?}; }. export const MILESTONES tied to the sentence (e.g. {id:'half',kind:'survive',goal:Math.ceil(sentence/2)} computed via a builder fn buildMilestones(sentence:number):Milestone[]).
  - Add export function milestoneProgress(m, ctx:{served;tierIndex;money;wins;crewGoals}):number returning 0..goal, and export function streakReward(streak:number):{money:number;respect:number} (escalating: e.g. money = Math.min(8, 1+Math.floor(streak/2))).
  - Add 'feared'/'bank' style entries to the POOL or a second SENTENCE-aware roller is NOT needed — keep daily POOL as-is; milestones are the long arc.
  - Extend dayRating with a 'Clean Streak' rating when streak>=3 and solitary===0 (cosmetic).

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Simulation.ts`
  - New state fields near line 99-108: milestones:Milestone[]=[]; cleanStreak=0; bestStreakShown=0 (streak peak surfacing). Import Milestone, buildMilestones, milestoneProgress, streakReward from Progression.
  - generate() (~154) and applySetup()/startNewRun: this.milestones = buildMilestones(this.sentence); this.cleanStreak = 0. Also rebuild milestones whenever sentence changes in addTime() (recompute survive goals against new sentence) — call a private syncMilestones().
  - onDayRollover() (~670): after computing clean-day bonus, set this.cleanStreak = (this.daily.solitary===0 && this.daily.contraband===0) ? this.cleanStreak+1 : 0; this.progression.bestStreak=Math.max(this.progression.bestStreak,this.cleanStreak). If streak>=3 grant streakReward() to player money/respect and emit alert type:'player' + bus.emit('reward',{...}) for a pop. Then call this.checkMilestones() which marks any newly-met milestone done, grants reward (money/respect/rep/item via pinv.items.push), increments progression.milestonesDone, emits alert type:'player' + bus.emit('milestone',{text}).
  - buildSummary() (~688): add streak:this.cleanStreak, nextMilestone:{text,progress,goal} (first undone milestone via milestoneProgress), tomorrowHeadline: the highest-reward undone daily objective text from the freshly rolled set, milestonesDone:this.progression.milestonesDone. These feed the 'one more day' card.
  - Notoriety reactions: add private npcReactTier() called sparingly (gate behind an intentCd-style timer, ~every few sim-seconds) — for nearby prisoners, if player tier index>=3 (Feered+) and rel<40, occasionally emit a give-way nudge (set their targetRoom/path away) OR just bus.emit('bubble',{e,text:'…',kind:'fear'}) with tier-scaled lines. READ tier via this.tier(). Keep it a presentation-ish bubble + a light AIIntent bias; do NOT add a heavy new system.
  - completeObjective() (~640): also bus.emit('reward',{x,z,text:'+'+rewardSummary,kind:'obj'}) so the juice layer can pop (keeps existing alert).
  - uiSnapshot() stats (~924): add streak:this.cleanStreak, bestStreak:this.progression.bestStreak, nextMilestone:{...}, milestones:this.milestones.map(...) so the pause 'Objectives' tab can show the long arc.
  - serialize() (~2337): add milestones:this.milestones, cleanStreak:this.cleanStreak to the prog bag; bump version 13 -> 14.
  - hydrate() (~2384): this.cleanStreak = num(data.cleanStreak,0); this.milestones = Array.isArray(data.milestones)&&data.milestones.length ? data.milestones.map(sanitize) : buildMilestones(this.sentence). progression already sanitized (new numeric keys default to 0).
  - selfTest() (~2299): add milestonesOk:this.milestones.length>0 to the invariant set.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/core/Game.ts`
  - Listen for new buses in ctor (after line 132): this.bus.on('reward',({x,z,text,kind})=>{ this.feedback.float(x,z,text, kind==='milestone'?'#ffe14a':'#9fe0a0'); this.juice.pop(kind); }); this.bus.on('shake',({mag})=>this.cam.shake(mag)); this.bus.on('hitstop',({ms})=>this.hitstop(ms)); this.bus.on('milestone',({text})=>{ this.audio.stinger('milestone'); this.cam.shake(0.5); }).
  - Wire combat juice without touching sim: on existing 'impact' bus, also this.cam.shake(0.25) and this.hitstop(60) — but gate both behind FxPrefs.reduceMotion (see Settings). Knockdowns: the sim already emits a float '-NN' and impact; add bus.emit('shake'/'hitstop') at the lethalKnockdown/knockdown sites OR simpler: scale shake by damage in the impact handler.
  - Add private hitstop: implement by holding a this.hitstopUntil timestamp; in loop() compute speed = (performance.now()<this.hitstopUntil)?0:SPEEDS[...] so the sim freezes ~60ms (respect reduceMotion).
  - Daily summary already drains at line 559 — pass through; no change except the richer card renders automatically.
  - Read FxPrefs (new tiny module) for reduceMotion; default the camera shake/hitstop off when set. Volume changes already routed through audio.setVolume.
  - Onboarding: after beginRun() (~443), if sim.setup.tutorialTips show menus.showCoach(step0). Add coach hooks to Menus (onboarding overlay).

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/IsoCamera.ts`
  - Add shake support: private shakeMag=0; private shakeT=0; shake(mag:number){ this.shakeMag=Math.max(this.shakeMag,mag); this.shakeT=0.35; }. In tick() decay shakeT/Mag and, in apply()/applyPersp(), add a small random/decaying offset to camera.position (NOT to this.target so follow stays stable): e.g. const j=this.shakeMag*(this.shakeT>0?this.shakeT/0.35:0); camera.position.x+=(Math.random()*2-1)*j; .y/.z similarly. Decrement shakeT in tick by dt.
  - Guard with a module-level FX pref or accept a setShakeEnabled(b) setter Game toggles from Settings.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/audio/AudioSystem.ts`
  - Add stinger(kind:'milestone'|'streak'|'levelup'|'reward'){...}: short ascending arpeggio via existing tone() (e.g. milestone: 523,659,784 staggered; levelup: add a sparkle highpass noise). Reuse throttled() so repeats don't crackle. Pure addition, no state change.
  - No volume/mute changes needed — setVolume/setMuted/persist already exist (lines 54-57); Settings slider just calls audio.setVolume().

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ui/HUD.ts`
  - setObjectives(...) header (~121): append streak + next-milestone chip when present, e.g. add params (streak, nextMilestone) and render '🔥{streak}d · ▶ {milestone.text} {p}/{g}' in the ot-head. Keep the objSig dedupe (include streak/milestone in the signature string).
  - Optional: a brief reward-pop element is handled by Feedback.float already (world-anchored); for a center-screen milestone banner add a tiny #toast div + toast(text) method styled like alert but larger/centered, called from Game on 'milestone'.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ui/Menus.ts`
  - Replace the settings stub (line 185) with a real settingsTab(): master volume range, SFX on/off, reduce-motion toggle, and a read-only difficulty line (with note 'set per run'). Wire via new MenuHooks: getSettings():FxPrefs-ish, onSetVolume(v), onSetMuted(b), onSetReduceMotion(b). onClick(): handle data-m='setvol' (range input — bind 'input' listener in render for the slider), 'mute', 'reducemotion'.
  - Enrich summaryCard() (~379): after the stats rows add a 'one more day' block: streak (🔥 N-day clean streak), Next milestone bar (progress/goal), and 'Tomorrow: {tomorrowHeadline}'. Change the CTA copy to 'Do Day {day+1} ▶' to lean into the hook. Keep single primary button.
  - Add onboarding overlay: showCoach(step), private coachCard(step) — a small dismissible overlay (mode 'coach') with 3-4 tip cards (Move / People & fights / Needs & schedule / Goals & sentence). Add to Mode union and render switch. Add 'coach-next'/'coach-skip' click handlers. Driven by hooks.onCoachDone().
  - objTab() (~227): show the Milestones list (long-arc goals) beneath today's objectives, reading s.milestones from the snapshot.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/Juice.ts`
  - NEW tiny module (optional but recommended): export const FxPrefs = { reduceMotion:false, sfxMuted:false } loaded/persisted to localStorage key 'll3d_fx'; export function loadFx()/saveFx(). export class Juice with pop(kind) that flashes a CSS class on a center toast (or no-op if reduceMotion). Keeps shake/hitstop gating in one place so Game/Menus/IsoCamera all read the same pref.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/core/EventBus.ts`
  - Add event typings (if the bus is typed) for 'reward'{x,z,text,kind}, 'shake'{mag}, 'hitstop'{ms}, 'milestone'{text}. If EventBus is untyped (string-keyed), no change needed.

- `D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/styles (main.ts/index.css)`
  - Add CSS for: #toast (center milestone banner), .ot-streak chip, settings rows (.set-row, input[type=range]), coach overlay cards, summary 'one more day' block. Match existing m-/su-/ot- class aesthetics. Find the existing stylesheet via main.ts import.

**UI wiring:**
- HUD: extend setObjectives(objectives, tier, streak?, nextMilestone?) — render 🔥streak + ▶milestone in ot-head; fold streak/milestone into objSig so it re-renders. Add optional toast(text) + a #toast element in the constructor template for center-screen milestone banners.
- Game loop (~558): pass streak/milestone into hud.setObjectives — read from this.sim.cleanStreak and the first undone this.sim.milestones entry (compute progress via the snapshot's nextMilestone or a sim getter sim.nextMilestone()).
- Menus MenuHooks: add getSettings():{volume;muted;reduceMotion;difficulty}, onSetVolume(v), onSetMuted(b), onSetReduceMotion(b), onCoachDone(). Game implements: onSetVolume->audio.setVolume + audio.unlock; onSetMuted->audio.setMuted + hud.setMuted; onSetReduceMotion->FxPrefs.reduceMotion=b; saveFx(); cam.setShakeEnabled(!b).
- Game ctor: register bus.on for 'reward','shake','hitstop','milestone' (see snippet). Add hitstop gate in loop()'s speed calc.
- Onboarding: in beginRun() if sim.setup.tutorialTips -> menus.showCoach(0); paused=true. Menus coach overlay advances steps then calls hooks.onCoachDone() -> closeMenu(). Mark a localStorage 'll3d_seen_coach' so it only auto-shows once even across runs (still available via Help).
- IsoCamera: Game calls cam.setShakeEnabled(!FxPrefs.reduceMotion) on init and on settings change.
- Title screen (Menus.title): optionally add a 'Settings' chip next to 'How to Play' that opens the pause overlay on the settings tab even from the title (set this.tab='settings'; this.mode='pause').

**Key snippets:**

```ts
// Progression.ts — long-arc milestones tied to the sentence
export interface Milestone { id:string; text:string; kind:'survive'|'tier'|'bank'|'wins'|'crewgoals'; goal:number; done:boolean; reward:{money?:number;rep?:number;respect?:number;item?:string}; }
export function buildMilestones(sentence:number):Milestone[] {
  const half = Math.max(2, Math.ceil(sentence/2));
  return [
    { id:'survive_half', text:`Survive to day ${half}`, kind:'survive', goal:half, done:false, reward:{respect:4} },
    { id:'feared', text:'Reach Feared', kind:'tier', goal:3, done:false, reward:{rep:5} }, // tier index 3 = Feared
    { id:'bank_shiv', text:'Bank $12 (enough for a shiv)', kind:'bank', goal:12, done:false, reward:{item:'shiv'} },
    { id:'win5', text:'Win 5 fights', kind:'wins', goal:5, done:false, reward:{respect:6} },
    { id:'legend', text:'Become a Prison Legend', kind:'tier', goal:5, done:false, reward:{rep:8} },
  ];
}
export function milestoneValue(m:Milestone, c:{served:number;tierIndex:number;money:number;wins:number;crewGoals:number}):number {
  switch(m.kind){ case 'survive': return c.served; case 'tier': return c.tierIndex; case 'bank': return c.money; case 'wins': return c.wins; case 'crewgoals': return c.crewGoals; }
}
export function streakReward(streak:number):{money:number;respect:number}{ return { money: streak>=3 ? Math.min(8,Math.floor(streak/2)) : 0, respect: streak>=3 ? 2 : 0 }; }
```

```ts
// Simulation.ts — check milestones at day rollover (call inside onDayRollover after served++/streak update)
private checkMilestones(){
  const ps=this.social(this.playerId)!; const pinv=this.inv(this.playerId)!;
  const ctx={ served:this.served, tierIndex:this.tier().index, money:pinv.money, wins:this.progression.wins, crewGoals:this.gang.goalsDone };
  for(const m of this.milestones){ if(m.done) continue; if(milestoneValue(m,ctx)>=m.goal){
    m.done=true; this.progression.milestonesDone++;
    if(m.reward.rep) ps.reputation=clamp(ps.reputation+m.reward.rep,-100,100);
    if(m.reward.respect) ps.respect=clamp(ps.respect+m.reward.respect,0,100);
    if(m.reward.money) pinv.money+=m.reward.money;
    if(m.reward.item && ITEMS[m.reward.item]) pinv.items.push(m.reward.item);
    this.bus.emit('alert',{type:'player',text:`★ Milestone: ${m.text}`});
    this.bus.emit('milestone',{text:m.text});
  }}
}
private syncMilestones(){ // re-target survive goals when sentence changes; preserve done flags
  const fresh=buildMilestones(this.sentence);
  for(const f of fresh){ const old=this.milestones.find(o=>o.id===f.id); if(old){ f.done=old.done; if(f.kind==='survive') {} } }
  this.milestones=fresh.map(f=>{ const old=this.milestones.find(o=>o.id===f.id); return old?{...f,done:old.done}:f; });
}
```

```ts
// Simulation.onDayRollover() — streak + milestone block (insert after the served++/good-behavior lines)
this.cleanStreak = (this.daily.solitary===0 && this.daily.contraband===0) ? this.cleanStreak+1 : 0;
this.progression.bestStreak = Math.max(this.progression.bestStreak, this.cleanStreak);
if(this.cleanStreak>=3){ const r=streakReward(this.cleanStreak); const pinv2=this.inv(this.playerId)!; const ps3=this.social(this.playerId)!;
  if(r.money){ pinv2.money+=r.money; this.progression.moneyEarned+=r.money; }
  if(r.respect) ps3.respect=clamp(ps3.respect+r.respect,0,100);
  this.bus.emit('alert',{type:'player',text:`🔥 ${this.cleanStreak}-day clean streak (+$${r.money})`});
  this.bus.emit('reward',{x:this.pos(this.playerId)!.x,z:this.pos(this.playerId)!.z,text:`🔥 ${this.cleanStreak}d`,kind:'streak'});
}
this.checkMilestones();
```

```ts
// IsoCamera.ts — additive screen shake (offset applied to camera, target untouched so follow stays smooth)
private shakeMag=0; private shakeT=0; private shakeOn=true;
setShakeEnabled(b:boolean){ this.shakeOn=b; }
shake(mag:number){ if(!this.shakeOn) return; this.shakeMag=Math.max(this.shakeMag,mag); this.shakeT=0.35; }
// in tick(): if(this.shakeT>0) this.shakeT=Math.max(0,this.shakeT-dt);
// in apply()/applyPersp() AFTER position set:
//   if(this.shakeT>0){ const j=this.shakeMag*(this.shakeT/0.35); const c=this._charMode?this.perspCam:this.camera; c.position.x+=(Math.random()*2-1)*j; c.position.y+=(Math.random()*2-1)*j*0.6; c.position.z+=(Math.random()*2-1)*j; }
```

```ts
// Game.ts — hitstop (sim-freeze) without touching sim authority
private hitstopUntil=0;
private hitstop(ms:number){ if(FxPrefs.reduceMotion) return; this.hitstopUntil=performance.now()+ms; }
// in loop(): const speed = (this.paused||performance.now()<this.hitstopUntil)?0:SPEEDS[this.speedIdx];
// bus wiring:
this.bus.on('impact',({x,z})=>{ if(!FxPrefs.reduceMotion){ this.cam.shake(0.22); this.hitstop(55); } });
this.bus.on('shake',({mag})=>this.cam.shake(mag));
this.bus.on('reward',({x,z,text,kind})=>{ this.feedback.float(x,z,text, kind==='milestone'?'#ffe14a':'#9fe0a0'); });
this.bus.on('milestone',({text})=>{ this.audio.stinger('milestone'); this.cam.shake(0.5); this.hud.toast?.('★ '+text); });
```

```ts
// AudioSystem.ts — celebratory stingers (reuse tone()/throttled())
stinger(kind:'milestone'|'streak'|'levelup'|'reward'){ if(!this.ensure()||this.throttled('st-'+kind,0.25)) return;
  const seq = kind==='milestone'?[523,659,784,1047]: kind==='levelup'?[392,587,784]: kind==='streak'?[659,880]:[523,784];
  seq.forEach((f,i)=>{ const o=this.ctx!; const t=o.currentTime+i*0.07; const g=o.createGain(); const osc=o.createOscillator(); osc.type='triangle'; osc.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.14,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.18); osc.connect(g).connect(this.busGain); osc.start(t); osc.stop(t+0.2); osc.onended=()=>g.disconnect(); });
}
```

```ts
// Menus.ts — real settings tab (replaces the line 185 stub)
private settingsTab():string{ const s=this.hooks.getSettings();
  return `<div class="m-h">Settings</div>
   <div class="set-row"><span>Master Volume</span><input id="set-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"></div>
   <div class="set-row"><span>Sound</span><button class="su-card ${s.muted?'':'on'}" data-m="mute">${s.muted?'Muted':'On'}</button></div>
   <div class="set-row"><span>Reduce Motion</span><button class="su-card ${s.reduceMotion?'on':''}" data-m="reducemotion">${s.reduceMotion?'On':'Off'}</button></div>
   <div class="set-row"><span>Difficulty</span><b>${s.difficulty}</b><span class="m-sub">(set per run)</span></div>`;
}
// in render(), after building pause innerHTML, bind the slider's live input:
// const v=this.root.querySelector('#set-vol'); if(v) v.addEventListener('input',e=>this.hooks.onSetVolume(+(e.target as HTMLInputElement).value));
// onClick handlers: case 'mute': this.hooks.onSetMuted(...); case 'reducemotion': this.hooks.onSetReduceMotion(...); each then this.render();
```

```ts
// Menus.ts — summaryCard 'one more day' tail (insert before the dismiss button)
`${d.streak>0?`<div class="m-kv"><span>Clean streak</span><b>🔥 ${d.streak} day${d.streak>1?'s':''}</b></div>`:''}
 ${d.nextMilestone?`<div class="m-h" style="margin-top:8px">Next milestone</div><div class="m-tier-bg"><div class="m-tier-fill" style="width:${Math.round(100*d.nextMilestone.progress/d.nextMilestone.goal)}%"></div></div><div class="m-sub">${d.nextMilestone.text} — ${d.nextMilestone.progress}/${d.nextMilestone.goal}</div>`:''}
 ${d.tomorrowHeadline?`<div class="m-sub" style="margin-top:8px">Tomorrow: <b>${d.tomorrowHeadline}</b></div>`:''}`
// change CTA: <button class="m-btn primary" data-m="dismiss">Do Day ${d.day+1} ▶</button>
```

**Risks:**
- Save version bump 13->14: verify SaveManager doesn't reject on exact-version mismatch. hydrate() already tolerates missing fields, so the main risk is a strict version check elsewhere — grep SaveManager.ts for 'version' before shipping and allow <=14.
- Hitstop via sim-freeze: because the loop accumulator (acc) keeps filling, a 55ms freeze then catches up in up to 8 steps — fine, but ensure hitstop is short (<80ms) and gated by reduceMotion so it never feels like lag on slow devices. Do NOT freeze during lockdown/riot resolution edge frames (acceptable; steps clamp at 8).
- Camera shake must offset the camera position only, NOT this.target — offsetting target fights the follow lerp and causes drift/jitter. Apply jitter post-apply() each frame and let the next apply() reset it.
- Notoriety NPC reactions can spam bubbles or perturb pathing — throttle hard (per-NPC cooldown, low chance, only when player is nearby and tier>=Feared) and prefer bubbles over forcibly repathing crowds, which could break schedule/chaos AI. Keep it cosmetic-first.
- Milestone item reward ('shiv') must exist in ITEMS — verify the id in src/data/items.ts; if not present, drop the item reward or pick a valid contraband id. Guard with ITEMS[id] check (already in snippet).
- syncMilestones on addTime: recomputing survive goals when the sentence grows could move a goal past an already-served day; preserve done flags (snippet does) and never un-complete a finished milestone.
- Settings slider 'input' listener is bound in render(); since pause re-renders on every tab click, ensure the listener is re-attached after each render (bind inside render, not constructor) to avoid a dead slider.
- reduceMotion should also damp the existing alarm-screen flash and impact rings for a truly accessible mode — optional but expected; at minimum gate shake+hitstop.
- EventBus: if it's strongly typed, new event names need to be added to its type map or emit/on calls won't compile — check src/core/EventBus.ts first.


---

# MISSED MECHANICS BACKLOG (ranked)

The Attributes scaffolding for 4.4 is already in code (effStat 25%-rule getter, per-prisoner spawn, save/hydrate, STR wired into combat damage) — so the real gap isn't stats existing, it's that the signature Hard Time LOOPS are absent: the two-bar morale/mind model (no morale field at all), the grapple/submit/throw combat verbs, the court/trial adjudication, allies who rush in on line-of-sight, world-as-weapon pickup/throw, crafting/combine, a commissary, and the persistent-death world. Highest ROI is morale + the cheap couplings that make existing systems FEEL like Hard Time; the big-L narrative pillars (grapple, persistent-death world, court) are what actually sell it as Hard Time and should anchor their own stages.


### #1 — The 25% rule applied to ALL stats + per-station training routing (agility/skill/stamina read by combat/jobs/escape, weights/treadmill/books/pool stations)  _(impact high, effort S)_
effStat() and the Attributes component already exist but only strength feeds combat and 'train' is one generic STR bump. Wiring agility into attack cadence/dodge, skill into counters/court, stamina into decay+sleep restore, and routing each station to its stat turns dead scaffolding into a real build system for near-zero new code.

### #2 — Sleep gating (can't sleep while energy high) + death-by-neglect  _(impact high, effort S)_
Two tiny changes (reject rest when energy>~0.6; drain health toward 0 when hunger/sleep maxed) that close the anti-fast-forward loop and add the distinct starvation fail-state. Makes the survival loop matter instead of being skippable.

### #3 — Reputation works AGAINST you at trial + skill/intelligence helps you win (double-edged obedience)  _(impact high, effort S)_
Pure coupling on existing Social.reputation and the new attributes — feed rep into P(guilty), apply respect penalty for an innocent verdict. The single most 'Hard Time' tradeoff (rep buys obedience but raises sentence) for a few lines once court exists.

### #4 — Two-bar Health/Morale model (add a yellow Mind/morale field; fold hunger/hygiene/anger/fear into energy+morale drains)  _(impact high, effort L)_
There is NO morale field today — it's the missing half of Hard Time's signature HUD and the prerequisite for breakdown, adrenaline, vices, and leisure. Refactoring Needs to {energy, morale, +internal mods} unlocks an entire domain. High effort but foundational.

### #5 — Allies rush to your aid on line-of-sight (auto fight-join, gang piles on)  _(impact high, effort M)_
Reuses existing rel/gang/LOS plumbing and crowdReact; on fight-start scan same-gang/high-rel actors with clear LOS and set them to fight your attacker. Turns 'who is connected' into pre-fight strategy — core to surviving Hard Time.

### #6 — Adrenaline rush (morale full → +10% all + finisher) & nervous breakdown (morale empty → AI seizes player ~60s)  _(impact high, effort M)_
Once morale exists, two BrainStates that reuse the PrisonerAI takeover and the effStat multiplier. Gives the morale bar teeth at both extremes and a non-lethal soft-loss distinct from death.

### #7 — Pick up / throw / hold world objects ('anything is a weapon') gated on Strength  _(impact high, effort L)_
'pickup' is already in the InteractAction union with zero implementation. Tag props throwable+strReq, add a held field + throw projectile reusing doStrike's damage path. Pillar #2 of the design bible; also smashes windows for escape and trains STR.

### #8 — Commissary / store with subsidised prices, charged-on-release, theft-if-broke  _(impact high, effort M)_
Reuses priceFor/tradePanel/release flow; just a fixed-stock vendor interactable + a checkout-on-release deduction that converts to a charge if you can't pay. High legibility, fixes the awkward 'buy only from the NPC holding the item' economy.

### #8 — Crafting by combining two objects + gun/taser reload (skill-gated recipe table)  _(impact high, effort M)_
Raw-material items (part, batteries, blade, tool) already exist with no combine use. A pure recipe table + combine() gated on effective skill (now available) yields shivs/syringes/charged items — the manufacturing loop and a sink for scavenged junk.

### #10 — Court / trial as a real adjudication scene (witness-gated charges, verdict, intellect defense, bribe-to-skip)  _(impact high, effort L)_
Today addSentenceDays silently bumps the clock. A CourtSystem that only charges WITNESSED crimes (reuse LOS), rolls guilt weighted by rep vs skill, and supports guard-bribe-or-court is a signature Hard Time pillar and the home for rank-3's rep coupling.

### #11 — Grapple phase (GRAB→throw/suplex/choke/release) + SUBMIT/UNCONSCIOUS/KILLED outcomes + taunt verb  _(impact high, effort L)_
Grapple is THE central Hard Time combat verb and we have only stand-up phases + a shove. Extending the phase machine with a MoveResolver and a struggle meter is the biggest combat-feel uplift, but genuinely large.

### #12 — NPC death persistence & player reincarnation as a cell-owning NPC (world roster persists across characters)  _(impact high, effort L)_
The design bible's single strongest emergent-narrative feature — your dead character lives on as an NPC owning the same cell. Requires serializing the world roster independently from the player run. Highest narrative payoff, highest effort.

### #13 — Smoking/drinking/drugs as vices with addiction, tolerance & withdrawal (the vice loop)  _(impact high, effort M)_
cash IS cigarettes already but can't be smoked for morale; medicine only adds health. Once morale exists, vices give a spike then a withdrawal drag — the compulsion loop that fills downtime. Depends on the two-bar refactor.

### #14 — Deeper dialogue verbs: persuade/plead/bribe, once-per-day intimidate that makes a durable enemy, guard shakedown (pay-or-court), warden warrant bribe  _(impact high, effort M)_
Extends the existing interact() switch and Social.rel/reputation into a reputation-currency tree. Makes social play a real economy and feeds the court/heat systems.

### #15 — Recruit individual allies into a persistent entourage + romance from the please-loop (hug/kiss, jealousy)  _(impact medium, effort M)_
rel exists but ally memory decays in ~40s so no durable bond. A persistent allied flag + recruit/hug/kiss actions create the relationship layer that makes the LOS fight-join (rank 5) meaningful.

### #16 — Bladder/toilet need + structured multi-stat use-effects + over-eat vomit  _(impact medium, effort M)_
Replaces the flat use/useAmt with useEffects[] (already specced in the design doc) and adds the toilet loop driven by eat/drink/smoke. Medium-value flavor that deepens needs once the two-bar model lands.

### #17 — Body-type STR↔AGI tradeoff (5% swings) driving the cosmetic build mesh  _(impact high, effort M)_
Appearance.build (slim/average/stocky) is cosmetic-only today. A bodyType scalar that swings STR/AGI oppositely from training/eating and swaps the mesh gives free visual feedback and forces build identity.

### #18 — Bleeding DoT from SHARP weapons + weapon class (SHARP/BLUNT/FIREARM/THROWN/SHIELD) + riot shield 95% block  _(impact medium, effort S)_
Weapons are a flat combat number. A class tag enabling bleed-over-time, knockout-bias, and a 95% shield block adds tactical weapon identity cheaply once the class field exists.

### #19 — Gambling (cards/dice bets, fight-to-the-death wagers)  _(impact medium, effort M)_
cards/dice items exist as inert props. A gamble() action with escrow + skill-biased roll, and fight-wagers routed through existing onFightWin, is a high-risk income loop that reuses combat and the money ledger.

### #20 — Durable NPC vendettas/grudges persisted across days + alert-feed callouts  _(impact medium, effort M)_
Memory decays in ~25-30s today so feuds never escalate. A persistent grudge map biasing AI toward ambush, inherited by gang-mates, generates the self-authored drama Hard Time is famous for.

### #21 — Job variety with reputation tradeoffs (menial work LOWERS rep; painting/fixing/library/workshop; attribute gates; warden tasks pay sentence-days)  _(impact high, effort M)_
5 flat jobs all wrongly grant +rep. Flipping menial to -rep, gating tiers on effective attributes, and routing warden tasks to sentence-days makes the work loop a real tradeoff economy.

### #22 — Contraband depth: questioning events, take-the-blame transfers, cell-owner stash criticism, backpack containers, debt/warrant-gated release  _(impact medium, effort M)_
Solid search/stash model already exists; these extensions (esp. blocking release while you owe debts/warrants) deepen the smuggling and tie loose ends into the release win-condition.

### #23 — Start & expand your OWN gang (name/colors/greeting) + inter-gang alliances  _(impact medium, effort L)_
Design currently hard-codes 'never the leader'. An opt-in late-game founder path using the existing faction map is a satisfying endgame for high-rep players but contradicts a stated design default, so lower priority.

### #24 — Firearms / gunplay (aim-hold-release, ammo, reload via crafting)  _(impact medium, effort L)_
Largely an HT3-tier feature in a melee-centric setting. Worth gating behind a difficulty/world flag; significant new aim+projectile+ammo systems for a setting that doesn't need it yet.

### #25 — Fire & environmental hazards (ignite/spread, warmth-when-sleeping, extinguisher, cold/flood modifiers)  _(impact medium, effort L)_
Strong chaos generator but needs a new particle/render concern and a hazard tick system. High flavor, lower priority than the structural loops; do after world-objects exist (fire rides on flammable carryables).

### #26 — Character editor / persistent universe roster management (edit any inmate, restore default roster)  _(impact low, effort M)_
The player creator is already strong. A full NPC editor + universe-restore is a power-user convenience that only pays off once the persistent-death world (rank 12) exists; sandbox/debug panel first.

### #27 — Amber energy ceiling + stamina-scaled decay/recovery tuning + medical item differentiation (painkiller/syringe/medkit, craftable)  _(impact low, effort M)_
Polish-tier knobs (config-gated amber ceiling, distinct medical profiles) that refine the survival loop once the two-bar model and crafting exist. Low standalone impact, cheap to fold into those refactors.


## Proposed grouping into stages
- 4.6 — Cheap couplings that instantly feel like Hard Time (ALL-the-S-tier, do first): wire agility/skill/stamina into combat/escape/jobs via the existing effStat() getter; per-station training routing (weights/treadmill/books/pool→distinct stats) replacing the generic STR bump; sleep-gating (can't sleep while energy>~0.6) + death-by-neglect; body-type STR↔AGI swing driving the slim/average/stocky mesh; skill-vs-reputation inverse coupling. All reuse the already-built Attributes scaffolding and existing meters — biggest ROI in the backlog.
- 4.7 — The Two-Bar Mind: refactor Needs into the green-energy + yellow-morale model with hunger/hygiene/anger/fear as internal drains; bladder/toilet loop; multi-stat useEffects + over-eat vomit; adrenaline rush & nervous-breakdown morale-threshold states; vices (smoke/drink/drugs) with addiction/tolerance/withdrawal; retarget leisure items (TV/payphone/books/visits/hugs) to feed morale. This is the prerequisite domain that unlocks half the remaining backlog.
- 4.8 — World-as-weapon & the maker economy: implement the dormant 'pickup' action into hold/throw of world props (STR-gated, smashes windows for escape); crafting/combine recipe table (skill-gated, plus taser/gun reload); a real commissary with subsidised prices and charge-on-release; gambling (cards/dice + fight-wagers); job variety with rep tradeoffs. Pillar-2 chaos plus the money loops that fund everything.
- 4.9 — Court, crime & the social web: a CourtSystem with witness-gated charges, verdict rolls weighted by reputation (against you) vs effective skill (for you), guard-shakedown bribe-or-court and warden warrant bribes; deeper dialogue (persuade/plead/intimidate-once-per-day); recruit-an-entourage + romance/jealousy; durable persistent vendettas surfaced in the alert feed; debt/warrant-gated release and contraband depth (questioning, take-the-blame, backpacks).
- 4.10 — Grapple combat overhaul: extend the phase machine with GRAPPLE/GROUNDED phases and a data-driven MoveResolver (verb+direction+modifier→move), grab→throw/suplex/choke/release, taunt verb, SUBMIT/UNCONSCIOUS/KILLED outcomes, weapon classes with bleed DoT and a 95% riot-shield block. The largest combat-feel uplift; deserves its own stage.
- 4.11 — Persistent living world (the signature pillar): serialize the world roster independently from the player run; NPC permadeath frees/reassigns cells and optionally reincarnates with same clothing; the dead PLAYER lives on as a cell-owning NPC discoverable by the next character; character editor + universe-roster restore on top. The strongest emergent-narrative payoff, built last because it touches save/persistence broadly.
- Backlog / flagged (HT3-tier, gate behind difficulty or defer): firearms/gunplay; fire & environmental hazards (ride on flammable carryables from 4.8); start-your-own-gang (contradicts the 'never leader' default — opt-in only); amber energy ceiling and medical-item differentiation as polish folded into 4.7.


---

# AI smartness + conversations — build plan


## Prisoner & Guard AI (src/sim AIIntent/PrisonerAISystem/GuardAISystem + Simulation wiring)  _(effort L)_

Hard Time's emergent feel comes from a few simple rules layered on persistent relationships: NPCs follow loose routines, but harming/disrespecting someone makes a lasting enemy who retaliates on sight; gangs are fiercely loyal and gang up; high-reputation inmates get challenged by status-seekers while low-rep ones get bullied; characters self-preserve (low Mind/Health makes them erratic, flee, or surrender); and guards REACT to what they SEE (break up fights, confiscate contraband, haul offenders off) rather than being omniscient. Our code already has most of the scaffolding (intent scorer, AIMemory.foe/threat, gangs, tension, rallyAllies, dispatchGuard) but three gaps make it feel dumber than Hard Time: (1) the intent scorer is a flat if/else ladder that never acts on grudges offensively and never reacts to being hurt; (2) NPC-vs-NPC fights only spawn from tryStartFight's random room roll and rivalry standoffs, never from a remembered foe walking into view or from low health/fear self-defense; (3) dispatchGuard instantly picks the nearest free guard and teleport-paths them with perfect knowledge, with no LOS/notice/investigate step. The plan converts the intent ladder into an additive weighted scorer, adds offensive 'confront' + defensive 'defend'/'surrender' intents driven by memory.foe and Needs.health/fear, lets prisoners START fights from grudges and self-defend, and makes guards notice-then-investigate (LOS + reaction delay, walk to the disturbance, search/escort only on what they actually witnessed) so violence in a far hallway isn't instantly answered.

**Changes:**
- AIIntent.ts: extend PrisonerIntent union with 'confront' (close on a grudge/rival to start a fight) and 'surrender' (drop, hands up when overpowered); add labels. Add a GuardAlert posture type 'notice'|'investigate' and a NOTICE_DELAY + SIGHT_RANGE const. Keep INTENT_STICK but add a shorter STICK for reactive intents so self-defense isn't held 2.5s.
- PrisonerAISystem.ts: replace the if/else ladder in choosePrisonerIntent with an additive weighted scorer (score each candidate intent, pick max, tie-break by roll). Extend PrisonerCtx with hurt(0..1 from low health), foeNear(remembered foe in sight, not just gang rival), foeId, overpowered(hostiles>=2 or health near 0), repGap(my respect vs nearby — status challenge), guardWatching(guard has LOS). Weights: fleeDanger gets +hurt+fear, surrender on overpowered, confront from grudge scaled by anger+tough-trait and GATED by !guardWatching (Hard Time inmates wait until guards aren't looking), avoidEnemy for cowards, watchFight for bystanders. This is pure/deterministic and testable.
- Simulation.evalIntent: populate the new ctx fields — compute hurt from Needs.health, find nearest *remembered foe* (mem.foe/mem.threat) in LOS via existing hasLOS, count hostiles already targeting this entity (reuse the lethalKnockdown hostile-count pattern), compute repGap from Social.respect vs nearest inmate, set guardWatching via nearestGuard within sight + hasLOS.
- Simulation.actOnIntent: add cases. 'confront' → path toward the foe (gotoEntity); when within ~1.4 and still !guardWatching, call a new startNpcFight(e, foe) (factored from tryStartFight's fight-setup block + rememberFoe + dispatchGuard + registerFight). 'surrender' → set state idle, hands-up bubble, drop foe, and make current attackers disengage / a nearby guard escort (de-escalation). 'defend' folds into existing fight state but ensure a prisoner whose mem.foe attacks them sets foe back rather than only fleeing.
- Simulation: add NPC self-defense + grudge trigger. New lightweight per-tick check (or fold into prisonerAI loop): if an inmate has a live mem.foe in LOS within ~5 tiles, is not a coward, anger high, and no guard is watching, bias intent='confront'. If an inmate is being attacked (foe set on them by someone) and is tough/not-coward, they fight back instead of fleeing; if hurt>0.7 or overpowered they 'surrender'/'fleeDanger'. Wire rememberThreat retaliation so an insult/threat (already stored in mem.threat) can escalate to a confront later, matching Hard Time grudges.
- GuardAISystem.ts: add GUARD_PRIORITY entries already exist; add a 'notice'/'investigate' role + label and a SIGHT/NOTICE constant. Add a pure helper guardShouldNotice(distance, hasLOS, chaos) so detection logic is unit-testable and lives with the route tables.
- Simulation.dispatchGuard: replace instant nearest-guard assignment with a noticed-incident model. Only guards with LOS to the fight (hasLOS) OR within a hearing radius become 'aware'; the nearest aware guard waits a short NOTICE_DELAY (b.actTimer) then transitions to 'respond'. If NO guard can see/hear it, the fight goes unanswered until a patrol wanders into LOS (the prisonerAI/guardAI loop checks for visible fights each patrol step) — this is the key 'no teleport-omniscience' change. Far-off brawls now self-resolve or escalate tension, exactly like Hard Time.
- Simulation.guardAI: in the CALM patrol branch, before picking the next route post, scan for a visible disturbance (nearestFight within SIGHT + hasLOS, or a prisoner with contraband within SIGHT) and divert to investigate (role='investigate'); on arrival run breakUpFight / begin a search. This makes guards proactively patrol-and-discover instead of only reacting to dispatch.
- Simulation: contraband notice — when a guard's patrol brings a prisoner with hasContraband() into close LOS, start a search (existing 'searching' state + doSearchResult) instead of the current random/tension-based searches, so searches feel motivated.
- Tuning/anti-twitch: give reactive intents (fleeDanger/surrender/defend/confront) a shorter intentCd so they respond within ~0.8s, while keeping schedule/socialize sticky. Add metrics counters (npcGrudgeFights, guardInvestigations, surrenders) alongside existing this.metrics for telemetry and tests.

**Files:** D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/AIIntent.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/PrisonerAISystem.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/GuardAISystem.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Simulation.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/AIMemorySystem.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ecs/components.ts

**Snippets:**
```ts
// AIIntent.ts — extend vocabulary
export type PrisonerIntent =
  | 'schedule' | 'socialize' | 'group' | 'avoidEnemy' | 'watchFight' | 'fleeDanger'
  | 'returnCell' | 'hide' | 'comply' | 'wander'
  | 'confront' | 'defend' | 'surrender';
export const INTENT_LABEL: Record<PrisonerIntent, string> = {
  /* ...existing... */
  confront: 'Squaring up', defend: 'Standing ground', surrender: 'Backing down'
};
export const REACTIVE_STICK = 0.8; // reactive intents re-evaluate fast (vs INTENT_STICK)
export const GUARD_SIGHT = 8;      // tiles a guard can notice violence/contraband
export const GUARD_NOTICE = 0.8;   // sim-seconds before a noticing guard commits to respond
```
```ts
// PrisonerAISystem.ts — additive weighted scorer (replaces the if/else ladder)
export interface PrisonerCtx {
  phase: string; lockdown: boolean; riot: 'calm'|'warning'|'event';
  anger: number; fear: number; hurt: number;        // hurt 0..1 from low health
  enemyNear: boolean; foeNear: boolean;             // remembered grudge in sight
  fightNear: boolean; allyNear: boolean;
  overpowered: boolean;                             // >=2 hostiles or near-dead
  repGap: number;                                   // my respect - nearby inmate's
  tough: boolean; coward: boolean; social: boolean;
  guardNear: boolean; guardWatching: boolean;       // guard has LOS to me
}
export function choosePrisonerIntent(c: PrisonerCtx, roll: number): PrisonerIntent {
  if (c.lockdown) return 'returnCell';
  if (c.overpowered && (c.coward || c.hurt > 0.7)) return 'surrender';
  if (c.riot === 'event') return c.coward || c.fear > 0.6 ? 'hide' : (c.guardNear ? 'comply' : 'wander');
  const w: Partial<Record<PrisonerIntent, number>> = {};
  const add = (k: PrisonerIntent, v: number) => { w[k] = (w[k] ?? 0) + v; };
  add('schedule', 0.5 + (c.social ? 0 : 0.4));
  if (c.fightNear) { add('fleeDanger', 0.4 + c.fear + c.hurt); add('watchFight', (c.tough ? 0.6 : 0.1) + c.anger * 0.5); add('avoidEnemy', 0.5 + (c.coward ? 0.6 : 0)); }
  if (c.enemyNear) { add('avoidEnemy', 0.4 + (c.coward ? 0.7 : 0) + c.fear); }
  // grudge: close in and start it — but ONLY when no guard is watching (Hard Time)
  if (c.foeNear && !c.guardWatching) add('confront', 0.3 + c.anger * 0.9 + (c.tough ? 0.5 : 0) - (c.coward ? 0.8 : 0) - c.hurt);
  // status challenge: high-rep inmate provokes lower-rep when feeling strong
  if (c.repGap > 25 && c.tough && !c.guardWatching) add('confront', 0.25 + c.anger * 0.4);
  if (c.social && c.allyNear && !c.guardNear) add('group', 0.6);
  if (c.social && c.anger < 0.5) add('socialize', 0.45 + (roll < 0.4 ? 0.2 : 0));
  add('fleeDanger', c.hurt * 0.8);
  let best: PrisonerIntent = 'schedule', bv = -Infinity;
  for (const k in w) if ((w as any)[k] > bv) { bv = (w as any)[k]; best = k as PrisonerIntent; }
  return bv > (w.schedule ?? 0) || best === 'schedule' ? best : 'schedule';
}
```
```ts
// Simulation.evalIntent — populate the richer context
const nd = this.ecs.get<Needs>(e, 'Needs')!;
const hurt = clamp01(1 - nd.health);
const foe = this.nearestGrudge(e, b, p, 5.5);             // mem.foe/mem.threat in LOS
const guardE = this.nearestGuard(e, GUARD_SIGHT);
const guardWatching = guardE != null && this.hasLOS(guardE, e);
let hostiles = 0; for (const g of this.ecs.query('Brain','Position')) { const gb=this.brain(g)!; if (gb.role==='prisoner'&&gb.state==='fight'&&gb.foe===e) hostiles++; }
return choosePrisonerIntent({ /* ...existing... */ hurt, foeNear: !!foe, overpowered: hostiles>=2 || nd.health<0.06, repGap: this.repGapNear(e,b,p), guardWatching }, this.rng.float());
```
```ts
// Simulation — grudge fight (factored from tryStartFight) + actOnIntent case
private startNpcFight(a: Entity, target: Entity) {
  const ab=this.brain(a)!, tb=this.brain(target)!;
  ab.state='fight'; ab.foe=target; ab.cphase='squareUp'; ab.cTimer=0.4; ab.attackCd=0.3;
  tb.state='fight'; tb.foe=a;      tb.cphase='squareUp'; tb.cTimer=0.4; tb.attackCd=0.5;
  if (ab.mem) rememberFoe(ab.mem, target); if (tb.mem) rememberFoe(tb.mem, a);
  this.metrics.npcGrudgeFights = (this.metrics.npcGrudgeFights??0)+1;
  this.bus.emit('alert', { type:'fight', text:`${ab.name} jumps ${tb.name}!` });
  this.dispatchGuard(a); this.registerFight(a);
}
// in actOnIntent switch:
case 'confront': { const foe=this.nearestGrudge(e,b,p,6); if(!foe){ b.intent='schedule'; break; }
  const fp=this.pos(foe)!; if(Math.hypot(fp.x-p.x,fp.z-p.z)<1.5 && this.nearestGuard(e,4)==null) this.startNpcFight(e,foe);
  else this.gotoEntity(e,foe); break; }
case 'surrender': { ag.path=null; b.foe=undefined; this.disengageAttackers(e);
  if(!b.bubbleCd){ this.bubble(e, this.rng.pick(['Okay, okay!','I\'m done!','🙌']),'talk',1.4); b.bubbleCd=4; } break; }
```
```ts
// Simulation.dispatchGuard — notice + investigate instead of instant teleport-respond
private dispatchGuard(fighter: Entity) {
  const fp = this.pos(fighter)!;
  let best: Entity | null = null, bd = Infinity;
  for (const g of this.ecs.query('Brain','Position')) {
    const b=this.brain(g)!; if (b.role!=='guard'||['respond','searching','escorting'].includes(b.state)) continue;
    const gp=this.pos(g)!; const d=Math.hypot(gp.x-fp.x,gp.z-fp.z);
    const aware = d<=GUARD_SIGHT && this.hasLOS(g,fighter);   // must SEE it (or be very close = 'hear')
    if ((aware || d<3) && d<bd){ bd=d; best=g; }
  }
  if (!best) return;                  // nobody noticed — fight goes unanswered (patrols may find it later)
  const b=this.brain(best)!; this.setGuardRole(b,'investigate');
  b.actTimer = GUARD_NOTICE; b.foe = fighter;                // brief delay, THEN commit in guardAI
}
// in guardAI, before the respond block:
if (b.guardRole==='investigate' && b.foe!=null){ b.actTimer=(b.actTimer??0)-dt; if((b.actTimer??0)<=0){ b.state='respond'; b.actTimer=undefined; } }
```
```ts
// Simulation.guardAI CALM branch — proactively discover trouble on patrol
const seen = this.nearestFight(p, GUARD_SIGHT);
if (seen && this.hasLOSPoint(p, seen)) { this.setGuardRole(b,'investigate'); b.actTimer=GUARD_NOTICE;
  const f=this.fighterAt(seen); if(f!=null){ b.foe=f; this.gotoEntity(e,f); } this.metrics.guardInvestigations=(this.metrics.guardInvestigations??0)+1; continue; }
const suspect = this.nearestContraband(p, GUARD_SIGHT);   // hasContraband() + LOS
if (suspect!=null){ b.state='searching'; b.foe=suspect; continue; }
```


## Conversation / dialogue system (sim-authoritative) with HUD dialogue panel, feeding ally-recruit + vendetta  _(effort M)_

Hard Time's "dialogue" is really a reputation-as-currency negotiation: you initiate by gesturing, pick a positive or aggressive line, and stat/mood checks decide if the target agrees. Pleasing builds friendship (and a chance of romance); intimidation gets your way "at the expense of the relationship" and turns the victim into an enemy (once per day); defeated foes can be spared by joining your gang. Our codebase already has the right bones (Social.rel/respect/reputation, AIMemory threat/foe/ally, FactionSystem standing/invites, resolveTarget verbs, rallyAllies taking sides), but conversations are a flat smalltalk line that nudges rel +6. The plan adds a real CONVERSATION layer: a new openConversation()/resolveConversation() pair in Simulation that runs a deterministic skill-vs-mood check per option, new verbs (compliment/persuade/intimidate/recruit/snitch/flirt), durable rel + AIMemory + gangStanding outcomes, a vendetta hook (mem.threat already drives nearestEnemy → avoidEnemy/watchFight and rallyAllies enemy side), and a dialogue MODAL in Menus.ts (mirroring the existing trade panel) wired through Game.ts npcActions/doAction. Effort M: ~1 new file (ConversationSystem.ts, pure), edits to Simulation.ts, Menus.ts, Game.ts, AIMemorySystem.ts; no new components needed — Social + AIMemory + PlayerGangState already carry all durable state.

**Changes:**
- RESEARCH FINDINGS (Hard Time): conversations are initiated by gesturing at someone; you pick a positive or negative response. Reputation/attitude is a CURRENCY 'you spend to get your own way' — bothering people or being rejected damages it. Being agreeable/cooperative grows friendships; 'every time you please someone, the relationship has a chance to become romantic' (hugs/kisses give health+happiness). Intimidation = grab + hold command: 'intimidating characters are more likely to get their own way at the expense of the relationship,' it 'turns the victim into an enemy wherever possible,' and 'cannot be used on the same person more than once a day.' Harming/disobeying makes enemies. Defeated opponents can be 'offered a chance to survive by joining a gang.' Recruiting = gang membership via standing. (Sources: mdickie.fandom.com/wiki/Hard_Time, /Hard_Time_III; HT3 manual mdickie.com/guides/hardtime3.pdf; mdickiegameguide.blogspot.com; tvtropes HardTime.)
- DESIGN PRINCIPLE: model dialogue as a single check per option — outcome p = base(option) + skillTerm + repTerm + moodTerm + relTerm + traitTerm + crewTerm, rolled against this.rng (deterministic). Success durably moves Social.rel and feeds memory/standing; failure spends reputation (the 'currency'). This reuses our existing favor() logic but generalises it across new verbs and surfaces it in a panel instead of a one-shot button.
- NEW VERBS (extend InteractAction union in Simulation.ts line ~52): add 'compliment' | 'persuade' | 'intimidate' | 'recruit' | 'snitch' | 'flirt'. Add ACTION_DUR/ACTION_STATE/SAY entries: compliment 0.9 talking '👍', persuade 1.0 talking 'Hear me out…', intimidate 1.0 threatening '😤', recruit 1.2 trading 'Run with us.', snitch 1.0 talking '🤫', flirt 0.9 talking '😏'.
- NEW PURE MODULE src/sim/ConversationSystem.ts (mirrors AIIntent.ts/FactionSystem.ts style — pure data + scoring, no sim/render import). Defines ConvOption ids, labels, a ConvCtx (skill, respect, reputation, rel, anger, fear, traits flags, gangRelation, sameGang, rank, threatenedToday), and pure functions convOptions(ctx) -> available option list + convChance(opt, ctx) -> 0..1 and convDelta(opt, success) -> {rel, rep, respect, fear, standing}. Keeps all tuning numbers in one readable table so balance lives outside Simulation.
- SIM ENTRY POINTS in Simulation.ts: add openConversation(target): ConvSnapshot — gathers ctx from Social/Needs/Brain/AIMemory/gang and returns the option list+chances+the NPC's current 'mood word' for the panel (parallels tradePanel() at ~835 and gangInfoFor()). add resolveConversation(target, optId): string — runs the deterministic check, applies durable outcomes, returns a flavor line. Route it through requestAction/resolveTarget so the existing approach/perform pipeline (walk-up, bubble, floatBy) is reused; the panel just calls a thin requestConversation(target, optId) wrapper.
- OPTION MECHANICS (in resolveConversation, all clamp()'d like existing verbs): COMPLIMENT — high base, low risk; success rel +8..12, small rep +1, prog('relUp'); marks AIMemory ally (rememberAlly). PERSUADE/FAVOR-ASK — chance scales with skill+rep+rel+talker/clever traits+crew (reuse favor() formula at line 2201); success grants item/money + rel +4 + gangStanding; FAILURE spends reputation: ps.reputation -= 4 (the 'rejected damages rep' rule) and bubble refuse. INTIMIDATE — win = ps.respect + ps.reputation*0.3 + tier*6 + strength term vs ts.respect (reuse threaten() at 2192); on win you 'get your way' (item/info/standing) but rel -12 and rememberThreat(tb.mem, pl) → makes an enemy; GATED to once/day per NPC via new Brain.intimidatedDay (Hard Time's once-a-day rule); on loss → startPlayerFight. FLIRT — only unlocks when rel>35 and not gang-rival; small chance → rel +10 and a 'romance' flag (Brain.romance=true) that grants a tiny recurring health/anger relief when near them (the hugs/kisses health bump); low rel → rel -6. SNITCH — talk to a GUARD about an inmate: reputation -8, suspicion -10, and rememberThreat on the snitched inmate toward player if witnessed (feeds vendetta); crew standing -6 if same-gang. RECRUIT — see next.
- RECRUIT / ALLY hook: 'recruit' verb routes into the existing FactionSystem. If player is in a gang and target is unaffiliated or low-standing, a successful persuade-style check (needs rank>=2 perk 'allies cluster near you') flips the NPC: set tb.gang = this.gang.membership, sc.rel += 20, gangStanding +6, emit alert. If target is in a crew you have standing with and you're NOT in one, recruit acts as 'ask to join' → openInvite() (reuse requestGangAction 'askgang' at 777). Also add the Hard Time 'spare a defeated foe → join' beat: in knockoutResolve (~2138, where wb.isPlayer), if loser is unaffiliated offer a recruit prompt so beating someone can convert them — strong tie between combat and the ally system.
- VENDETTA hook (already wired — minimal new code): mem.threat/mem.foe drive nearestEnemy() (line 1113) → choosePrisonerIntent 'avoidEnemy'/'watchFight', and rallyAllies (line 2247) puts s.rel<-45 or remembered foes on the ENEMY side of fights. So intimidate/snitch failures that call rememberThreat() and drive rel below -45 automatically create durable grudges that surface as avoidance, crowd-siding, and gang pile-ons. Add one upgrade: persist a long grudge by adding AIMemory.grudge/grudgeT (longer-decay than threatT, ~120s) set on intimidate-win and snitch, and include it in nearestEnemy()'s hostile test and rallyAllies enemy test so vendettas outlast the 25s threat memory.
- AIMemorySystem.ts edits: add grudge/grudgeT fields to AIMemory + newMemory + decayMemory + a rememberGrudge(m, who, secs=120) helper; keep sanitizeMemory dropping the entity ref (already transient-safe). Optionally add likeT to extend the 'pleased' window so repeated compliments compound toward romance.
- UI — DIALOGUE PANEL (Menus.ts, mirror the trade modal): add Mode 'dialogue'; showDialogue(target) sets target+mode and render() draws option buttons from sim.openConversation(target) showing each option's label, a chance hint (e.g. 'likely/risky/long shot' from convChance buckets) and the NPC's mood word + current rel word. onClick handles data-m='conv' → hooks.onConverse(target, optId) → sim.requestConversation → re-render with the result line; an 'X'/Back closes like trade. Add MenuHooks.onConverse and tradeData-style dialogueData(target).
- UI — Game.ts wiring: in npcActions() (line 381) replace the lone 'talk' button with a 'Talk' that opens the dialogue panel (like 'trade' at 416: this.menus.showDialogue(sel); this.paused=true), and keep quick verbs (Insult/Threaten/Fight) as direct buttons. Add 'conv' dispatch in doAction and the onConverse hook in the MenuHooks object (~line 105 near onAcceptInvite). Guards get a 'Snitch' option in the dialogue panel when an inmate was recently selected/witnessed.
- PANEL META: openConversation returns the NPC mood (derive from Needs.anger/fear + rel: 'wary/calm/friendly/hostile/scared') so the player can read the room before spending reputation — matches Hard Time surfacing attitude. refreshPanel already shows 'Toward you: <relWord>' (line 343); the dialogue modal expands that into actionable options.
- BALANCE/SAFETY: keep every delta clamped (clamp/clamp01) and small per the existing economy of rel (talk was +6); gate intimidate once/day, flirt behind rel>35, recruit behind rank/standing, snitch behind a guard target. All randomness via this.rng for deterministic saves; no new persisted component fields beyond AIMemory.grudge (already sanitized as transient) and Brain.intimidatedDay/romance (numbers/bools, add to Brain's sanitize path). Fictional prison-life framing only.

**Files:** D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/ConversationSystem.ts (NEW — pure options + chance/delta tables), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/Simulation.ts (new verbs; openConversation/resolveConversation/requestConversation/convCtx/grantFavor/resolveSnitch; recruit + spare-foe hook in knockoutResolve; grudge in nearestEnemy/rallyAllies), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/sim/AIMemorySystem.ts (grudge/grudgeT fields + rememberGrudge + decay), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ecs/components.ts (Brain: intimidatedDay?: number; romance?: boolean — add to sanitize path), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/ui/Menus.ts (Mode 'dialogue'; showDialogue; dialogue render; onConverse/dialogueData hooks), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/core/Game.ts (npcActions opens dialogue panel; doAction 'conv'/'talk' dispatch; onConverse + dialogueData in MenuHooks)

**Snippets:**
```ts
// src/sim/ConversationSystem.ts (NEW, pure — style matches AIIntent.ts / FactionSystem.ts)
export type ConvOption = 'compliment' | 'persuade' | 'intimidate' | 'recruit' | 'snitch' | 'flirt';
export const CONV_LABEL: Record<ConvOption, string> = { compliment: 'Compliment', persuade: 'Persuade', intimidate: 'Intimidate', recruit: 'Recruit', snitch: 'Snitch', flirt: 'Flirt' };
export interface ConvCtx { skill: number; respect: number; reputation: number; rel: number; anger: number; fear: number; tRespect: number; talker: boolean; clever: boolean; sameGang: boolean; rank: number; rivalGang: boolean; intimidatedToday: boolean; }
// 0..1 success chance per option — one readable table so balance lives here, not in Simulation
export function convChance(o: ConvOption, c: ConvCtx): number {
  const crew = c.sameGang ? 0.12 + c.rank * 0.03 : 0;
  switch (o) {
    case 'compliment': return clamp01(0.8 + c.rel * 0.002 - c.anger * 0.3);
    case 'persuade':   return clamp01(0.4 + c.reputation * 0.003 + c.rel * 0.004 + c.skill * 0.004 + (c.talker ? 0.12 : 0) + (c.clever ? 0.06 : 0) + crew - c.anger * 0.2);
    case 'intimidate': return clamp01(0.35 + (c.respect + c.reputation * 0.3 - c.tRespect) * 0.012);
    case 'recruit':    return clamp01(0.25 + c.rel * 0.004 + c.reputation * 0.003 + c.rank * 0.05 + (c.talker ? 0.1 : 0));
    case 'flirt':      return clamp01(0.15 + (c.rel - 35) * 0.01 + (c.talker ? 0.1 : 0));
    case 'snitch':     return 1; // always 'works' with the guard; cost is reputation
  }
}
function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function chanceWord(p: number): string { return p > 0.7 ? 'likely' : p > 0.45 ? 'even odds' : p > 0.2 ? 'risky' : 'long shot'; }
```
```ts
// Simulation.ts — option availability gates (mirrors npcActions gang gating)
export function convOptions(c: ConvCtx): ConvOption[] {
  const out: ConvOption[] = ['compliment', 'persuade'];
  if (!c.intimidatedToday) out.push('intimidate');
  if (c.sameGang && c.rank >= 2) out.push('recruit');        // perk: allies cluster near you
  if (c.rel > 35 && !c.rivalGang) out.push('flirt');
  return out;
}
```
```ts
// Simulation.ts — resolveConversation (durable outcomes; same clamp/prog/bubble idioms as resolveTarget)
private resolveConversation(target: Entity, opt: ConvOption): string {
  const pl = this.playerId; const tb = this.brain(target); const ps = this.social(pl)!; const ts = this.social(target); if (!tb || !ts) return '';
  const ctx = this.convCtx(target); const ok = this.rng.chance(convChance(opt, ctx));
  switch (opt) {
    case 'compliment':
      ts.rel = clamp(ts.rel + (ok ? 10 : 2), -100, 100); if (ok && tb.mem) rememberAlly(tb.mem, pl);
      this.prog('relUp'); if (tb.gang) this.gangStanding(tb.gang, 1.5);
      return ok ? `${tb.name} warms up to you.` : `${tb.name} shrugs you off.`;
    case 'persuade':
      if (ok) { ts.rel = clamp(ts.rel + 4, -100, 100); this.grantFavor(target); if (tb.gang) this.gangStanding(tb.gang, 3); return `${tb.name} comes around.`; }
      ps.reputation = clamp(ps.reputation - 4, -100, 100); return `${tb.name} brushes you off.`; // rejection spends reputation
    case 'intimidate': {
      tb.intimidatedDay = this.day;                         // once-per-day rule
      if (ok) { ts.rel = clamp(ts.rel - 12, -100, 100); ps.reputation = clamp(ps.reputation + 4, -100, 100);
        if (tb.mem) rememberGrudge(tb.mem, pl); this.ecs.get<Needs>(target, 'Needs')!.fear = clamp01(this.ecs.get<Needs>(target,'Needs')!.fear + 0.35);
        this.grantFavor(target); return `${tb.name} caves — but won't forget it.`; }       // gets their way at the cost of the relationship
      ps.reputation = clamp(ps.reputation - 3, -100, 100); this.startPlayerFight(target, false); return `${tb.name} squares up!`; }
    case 'recruit': {
      if (ok && this.gang.membership && !tb.gang) { tb.gang = this.gang.membership; ts.rel = clamp(ts.rel + 20, -100, 100); this.gangStanding(this.gang.membership, 6);
        this.bus.emit('alert', { type: 'player', text: `${tb.name} runs with your crew now.` }); return `${tb.name} joins you.`; }
      return ok ? `${tb.name} hears you out.` : `${tb.name} isn't interested.`; }
    case 'flirt':
      if (ok) { ts.rel = clamp(ts.rel + 10, -100, 100); tb.romance = true; this.floatBy(pl, '❤', '#ff9ad0'); return `Something clicks with ${tb.name}.`; }
      ts.rel = clamp(ts.rel - 6, -100, 100); return `${tb.name} isn't feeling it.`;
    case 'snitch': return this.resolveSnitch(target);
  }
}
```
```ts
// AIMemorySystem.ts — durable grudge that outlives the 25s threat window (vendetta fuel)
export function rememberGrudge(m: AIMemory, who: number, secs = 120) { m.grudge = who; m.grudgeT = secs; m.angerT = Math.max(m.angerT, 15); }
// in decayMemory: if (m.grudgeT > 0 && (m.grudgeT -= dt) <= 0) { m.grudge = 0; m.grudgeT = 0; }
// in nearestEnemy() hostile test (Simulation.ts ~1113): add b.mem.grudge === o
// in rallyAllies enemy test (~2247): add (!!s && tb.mem && tb.mem.grudge === player) so old grudges pile on in fights
```
```ts
// Game.ts npcActions — open the dialogue panel instead of a one-line talk (mirrors trade at line 416)
{ key: 'talk', label: 'Talk', kind: 'social' }   // doAction: if (!isPlayerSel && key === 'talk') { this.menus.showDialogue(sel); this.paused = true; return; }
```
```ts
// Menus.ts — dialogue modal hook (parallels showTrade / tradeData)
showDialogue(target: number) { this.convTarget = target; this.mode = 'dialogue'; this.render(); }
// onClick: if (a === 'conv') { const line = this.hooks.onConverse(this.convTarget, el.dataset.id!); this.lastConvLine = line; this.render(); return; }
// render(dialogue): const d = this.hooks.dialogueData(this.convTarget); // { name, moodWord, relWord, options:[{id,label,word}] }
```


---

# Graphics realism — build plan


## Render realism overhaul (materials + lighting + post + procedural maps)  _(effort M, mobile: "Texture gen: normal+roughness maps are 256x256 canvases generated once at load via Sobel loops (~65k px each, a few ms each, ~6-8 textures total). One-time CPU cost at startup, negligible runtime. VRAM: doubling/tripling maps per material adds ~0.2-0.5MB per 256px texture — small; reuse shared concrete normal map across all walls (one InstancedMesh material) so it is paid once. Runtime GPU: normalMap+roughnessMap+envMap (PMREM) add per-fragment work but on the iso view fill rate is modest. The real cost is PostFX: GTAO is the heaviest pass (full-screen depth-AO multi-pass) — gate it OFF on mobile/low-end entirely. Bloom+SMAA+grade+vignette are cheap-ish but still extra full-screen passes; on lowEnd skip the whole composer and renderer.render direct (zero post cost), drop shadow map 2048->1024, pixelRatio cap 2->1.5, normalScale halved, no PMREM env (flat scene.environment color). Net: High tier targets desktop/strong tablets; Low tier mobile keeps just the material/lighting/palette upgrades (which are the bulk of the realism win and nearly free) without any post overhead. Detect via userAgent + deviceMemory + effective resolution.")_

The "cartoony" look comes from four things in the current render code: (1) materials use only a color map with roughness=0.95-1.0 and metalness=0 and no normal/roughness maps, so every surface is uniformly matte and flat; (2) lighting is extremely flat — AmbientLight intensity 1.35 + HemisphereLight 0.85 wash out all shadow contrast, leaving no contact darkening; (3) the palette (THEME) is a high-key cool grey with bright tints, reading like flat-shaded toy plastic; (4) there is NO post-processing on the active core render path (src/core/Game.ts:564 calls renderer.render directly) even though a fully-working EffectComposer stack already exists in legacy/game/PostFX.ts (GTAO+Bloom+grade+vignette+SMAA, three r160). The build-ready fix: generate procedural normal+roughness maps on canvas from the existing height-ish noise, retune every MeshStandardMaterial to real roughness/metalness ranges with those maps, cut ambient/hemi intensity and add a proper key/fill/rim 3-light rig with softer larger-radius shadows + warmer moodier palette + tighter fog, and wire a device-gated EffectComposer (adapt legacy PostFX) into the core loop with AO/SMAA/bloom/vignette/grade. All stays procedural (CanvasTextures only) and mobile-OK via a quality tier that disables AO + post and drops shadow map size on low-end/mobile.

**Changes:**
- TEXTURES — add createNormalMap helper: generate a procedural normal map on canvas from a luminance heightfield. New file src/render/textures/createNormalMap.ts. Build a grayscale height canvas (reuse the same speckle/stain/crack/tile-seam draw logic), then Sobel-sample neighbors to compute per-pixel normals: dx=h(x-1)-h(x+1), dy=h(y-1)-h(y+1), n=normalize(dx*strength, dy*strength, 1) packed to RGB ((n*0.5+0.5)*255). Return a CanvasTexture with RepeatWrapping, colorSpace=NoColorSpace/LinearSRGB (normal maps must NOT be sRGB). Seams: walls strength~2.0, concrete floor ~1.2, tile ~3.0 (deep grout grooves).
- TEXTURES — add createRoughnessMap helper (src/render/textures/createRoughnessMap.ts): single-channel-ish grayscale canvas where dark=smooth, light=rough. Drive it from the same stain/puddle data: stains/grime -> lighter (rougher), wet puddles in shower -> dark blobs (smooth/wet), tile faces slightly darker than grout. colorSpace = NoColorSpace. This gives spatially-varying highlights instead of one flat roughness scalar — the single biggest realism win.
- TEXTURES — refactor createConcreteTexture/createTileTexture to optionally also emit a height canvas so normal+roughness derive from the SAME pattern (cracks become grooves, seams become grout). Cheapest approach: add an exported buildConcreteHeight(repeat) and buildTileHeight(tiles) that return an offscreen canvas; createNormalMap/createRoughnessMap consume it. Keeps a single source of pattern truth.
- WORLDRENDER — walls (WorldRenderer.ts:77): replace bodyMat with map+normalMap+roughnessMap, roughness 0.9 (let map modulate), metalness 0.04, normalScale new THREE.Vector2(0.8,0.8), REMOVE flatShading:true (flatShading is a primary cartoon tell on the box walls — it kills the normal map and faceted-shades everything). Cap mat: roughness 0.85, slight metalness 0.05.
- WORLDRENDER — floors (lines 33,46): add normalMap+roughnessMap to base concrete and per-room floor materials. Wet shower: roughness 0.25 + metalness 0.35 + envMap for reflective sheen (see env map item). Dry rooms: keep roughnessMap-driven 0.7-0.95. Drop the separate transparent grime PLANE overlay (lines 49-51) into an aoMap/darkening baked into the roughness+color instead, or keep but reduce opacity — the floating overlay plane reads flat.
- WORLDRENDER — add a small procedural cubemap/PMREM environment so MeshStandardMaterial gets real specular reflections (without an env map, metalness/roughness look dead). Build a 6-face gradient cube (dark floor color below, warm-grey ceiling above) via THREE.WebGLCubeRenderTarget or a DataTexture equirect, run through PMREMGenerator, assign scene.environment. This alone makes metal bars/door frames and wet floors look grounded. Cheap: generated once at startup.
- THREEAPP lighting (ThreeApp.ts:21-34) — kill the flat wash and build a 3-point rig: AmbientLight intensity 1.35 -> 0.25; HemisphereLight 0.85 -> 0.35 (sky warm-grey, ground dark concrete). Key DirectionalLight: keep but warmer (0xffe8c4) intensity ~2.2, raise shadow.radius to 4-6 and use VSM or keep PCFSoft with mapSize 2048 (1024 on mobile), bias -0.0004 + normalBias 0.02 to kill peter-panning. Add a cool FILL DirectionalLight (0x6a82b4, intensity ~0.4, opposite side, NO shadow). Add a RIM/back light (0xbfd4ff, intensity ~0.6, low and behind) to separate characters/walls from background — rim light is the classic realism separator.
- THREEAPP — soften + tune: set renderer.toneMappingExposure ~1.0 (down from 1.22 so highlights aren't blown), scene.fog near/far tighter and color matched to a moodier bg (e.g. 0x1c2029) for atmospheric depth that hides the flat horizon. Add renderer.shadowMap.type = THREE.VSMShadowMap option on high tier for softer penumbra (or PCFSoft on mobile).
- VISUALTHEME (VisualTheme.ts) — moodier, lower-key palette: drop bg/fog to 0x1c2026 (cool charcoal), warm the key light, desaturate+darken room floor tints (cafeteria stays warm but less candy-orange), reduce per-room lightI by ~25% (PointLights at 1.5x were over-lighting). Lower ambientI/hemiI as above. Wall side color slightly darker + add a roughness scalar field per surface. Add THEME.quality presets (high/low) consumed by ThreeApp + PostFX.
- POST — adapt legacy/game/PostFX.ts into the core path. Create src/render/PostFX.ts (copy the legacy class — it already imports EffectComposer/GTAOPass/UnrealBloomPass/SMAAPass/BrightnessContrastShader/VignetteShader/OutputPass, all present in three r160 examples/jsm). Tune: GTAO radius ~1.5 samples 6-8 (grounds props/corners — replaces the missing contact AO), Bloom strength 0.12 threshold 0.85 (only lamps/signs glow), grade contrast +0.18 brightness -0.03 (gritty), vignette darkness 0.55. SMAA instead of MSAA for cheap AA after the buffer passes.
- CORE WIRING — in src/core/Game.ts: instantiate PostFX after scene build (this.fx = new PostFX(this.app.renderer, this.app.scene, this.cam.activeCamera)) gated by a quality check; at line 564 replace `this.app.renderer.render(...)` with `if (this.fx) this.fx.render(); else this.app.renderer.render(this.app.scene, this.cam.activeCamera)`. NOTE: PostFX binds a camera at construction but the game swaps cam.activeCamera (iso vs char cam) — add fx.setCamera(cam.activeCamera) before render each frame (update renderPass.camera + gtao camera) so post follows the active camera. Also call fx.resize() from ThreeApp.resize/Game resize.
- MOBILE GATING — detect tier: const lowEnd = /Mobi|Android/i.test(navigator.userAgent) || (navigator.deviceMemory ?? 8) <= 4 || window.innerWidth*window.devicePixelRatio < 1600. On lowEnd: skip PostFX entirely (render direct), shadow.mapSize 1024, pixelRatio cap 1.5, drop fill+rim to ambient only, skip env PMREM (use a flat scene.environment color), normalScale halved. Expose THEME.quality + a settings toggle so users can force High/Low.

**Files:** D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/ThreeApp.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/VisualTheme.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/WorldRenderer.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/textures/createConcreteTexture.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/textures/createTileTexture.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/textures/createGrimeTexture.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/textures/createNormalMap.ts (NEW), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/textures/createRoughnessMap.ts (NEW), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/PostFX.ts (NEW, adapt from src/legacy/game/PostFX.ts), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/core/Game.ts

**Snippets:**
```ts
// src/render/textures/createNormalMap.ts — Sobel height->normal, procedural
export function createNormalMap(height: HTMLCanvasElement, strength = 2, repeat = 6): THREE.Texture {
  const S = height.width; const src = height.getContext('2d')!.getImageData(0,0,S,S).data;
  const out = document.createElement('canvas'); out.width = out.height = S;
  const octx = out.getContext('2d')!; const dst = octx.createImageData(S,S); const o = dst.data;
  const L = (x:number,y:number)=>{ const i=(((y+S)%S)*S+((x+S)%S))*4; return src[i]/255; };
  for (let y=0;y<S;y++) for (let x=0;x<S;x++){
    const dx=(L(x-1,y)-L(x+1,y))*strength, dy=(L(x,y-1)-L(x,y+1))*strength;
    const len=Math.hypot(dx,dy,1)||1; const i=(y*S+x)*4;
    o[i]=((dx/len)*0.5+0.5)*255; o[i+1]=((dy/len)*0.5+0.5)*255; o[i+2]=((1/len)*0.5+0.5)*255; o[i+3]=255;
  }
  octx.putImageData(dst,0,0);
  const t=new THREE.CanvasTexture(out); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repeat,repeat);
  t.colorSpace=THREE.NoColorSpace; return t; // normal maps must be linear, NOT sRGB
}
```
```ts
// ThreeApp.ts — flatten LESS, light MORE deliberately (3-point rig)
this.scene.add(new THREE.AmbientLight(THEME.lights.ambient, 0.25));               // was 1.35
const hemi=new THREE.HemisphereLight(THEME.lights.hemiSky, THEME.lights.hemiGround, 0.35); // was 0.85
this.scene.add(hemi);
const key=new THREE.DirectionalLight(0xffe8c4, 2.2); key.position.set(26,44,18);
key.castShadow=true; key.shadow.mapSize.set(quality.high?2048:1024);
key.shadow.radius=quality.high?5:2; key.shadow.bias=-0.0004; key.shadow.normalBias=0.02; this.scene.add(key);
const fill=new THREE.DirectionalLight(0x6a82b4,0.4); fill.position.set(-30,20,-22); this.scene.add(fill); // cool fill, no shadow
const rim=new THREE.DirectionalLight(0xbfd4ff,0.6); rim.position.set(-10,8,-34); this.scene.add(rim);   // back/rim separator
this.renderer.toneMappingExposure=1.0;
```
```ts
// WorldRenderer.ts walls — drop flatShading, add normal+roughness maps + tiny metalness
const wallH = buildConcreteHeight(1);
const bodyMat = new THREE.MeshStandardMaterial({
  map: concreteTex, normalMap: createNormalMap(wallH, 2.0, 1), roughnessMap: createRoughnessMap(wallH, 1),
  color: THEME.walls.side, roughness: 0.9, metalness: 0.04,
  normalScale: new THREE.Vector2(quality.high?0.85:0.45, quality.high?0.85:0.45)
}); // removed flatShading:true  <-- key cartoon fix
```
```ts
// src/render/PostFX.ts (adapt legacy) wired into core/Game.ts loop
this.fx = quality.high ? new PostFX(this.app.renderer, this.app.scene, this.cam.activeCamera) : null;
// ...in loop(), before drawing:
if (this.fx){ this.fx.setCamera(this.cam.activeCamera); this.fx.render(); }
else this.app.renderer.render(this.app.scene, this.cam.activeCamera);
// setCamera updates renderPass.camera + gtaoPass.camera since active cam swaps (iso<->char)
```
```ts
// procedural environment for real specular (metal bars, wet floor) — once at startup
const pmrem=new THREE.PMREMGenerator(this.renderer);
const envScene=new THREE.Scene(); // tiny gradient room: dark below, warm-grey above
envScene.background=new THREE.Color(0x2a2e36);
this.scene.environment=pmrem.fromScene(envScene,0,0.1,40).texture; pmrem.dispose();
```


## render: CharacterFactory.ts + PropRenderer.ts material/geometry overhaul, plus a new procedural normal/roughness texture-gen module shared with textures/  _(effort M, mobile: Net NEUTRAL to slightly positive. WINS: removing the BackSide OUTLINE shells deletes ~10-14 extra meshes per character (each was a full duplicate draw) — for a yard of 20+ inmates that's hundreds of fewer draw calls, more than paying for the added work. Texture maps are shared at MODULE scope (SKIN/CLOTH/DENIM/METAL built once, ~5 textures total at 256px = trivial VRAM, a few MB), so NO per-character/per-prop texture allocation. NEW COSTS: normal+roughness sampling adds a few texture fetches per fragment in MeshStandardMaterial — negligible on the small screen-footprint of chars/props. The onBeforeCompile SSS is one extra shader variant compiled ONCE (shared skin material), 3 cheap ALU ops per skin fragment. The PMREM/RoomEnvironment is a single offscreen bake at startup (0.04 quality = cheap), zero per-frame cost, and lets you DROP some fill lighting later. Keep textures at 256px, normalScale low (0.25-0.5), and do NOT add a post-processing EffectComposer (the existing additive-sprite bloom stays). Material.clone() for per-prop wear adds materials but they share geometry+textures; cap wear-cloning to hero props (lockers/bunks/counter), not every decal. Verdict: ships on mid-tier mobile.)_

The "cartoony/AI" read comes from three specific things in the current code, all fixable while staying procedural and mobile-OK: (1) every body part carries a BackSide MeshBasicMaterial OUTLINE shell (CharacterFactory L27-34) — this is THE toon tell and also doubles char draw calls; drop it entirely. (2) Every char/prop material is a flat MeshStandardMaterial with only color+roughness — zero maps, so surfaces read as untextured plastic. Add procedural normalMap + roughnessMap (derived from the SAME canvas noise you already generate) to skin, cloth, and metal. (3) Faces use literal sphere eyes/cone nose/box mouth glued on (L180-207) which screams "AI low-poly"; replace with a single baked face CanvasTexture on the head + subtle geometry. The plan: remove outline shells, switch lit materials to mapped MeshStandardMaterial, add one shared makeSurfaceMaps() that returns {normalMap,roughnessMap} from a tiled canvas, add a cheap rim/SSS cheat via onBeforeCompile on skin only (no post pass), smooth limbs with higher-segment capsules + merged head/neck, and enrich props with bevels (RoundedBox-style via small chamfer boxes), per-instance wear tint, edge grime, and emissive accent strips. Keep one shared texture set (generate once, reuse) so VRAM and draw calls stay flat. No EffectComposer/post-processing — keep the existing additive-sprite bloom. Net mobile cost is roughly NEUTRAL because removing ~12 outline meshes per character offsets the added texture sampling.

**Changes:**
- DROP THE TOON OUTLINE SHELLS. Delete the OUTLINE material + shell() helper (CharacterFactory L27-28) and every shell() call (L34, L138, L174). This single change removes the #1 cartoony tell AND halves character mesh count (~10-14 fewer meshes per char). Replace the lost silhouette pop with a subtle Fresnel rim in the skin/cloth shader (see snippet) + the existing contact shadow.
- ADD a shared procedural map generator module src/render/textures/createSurfaceMaps.ts that returns {map?, normalMap, roughnessMap} from one tiled 256px canvas. Reuse your existing speckle/noise loop (same as createConcreteTexture) but ALSO emit a normal map by computing per-pixel height = luminance, then Sobel dx/dy into RGB (0.5+dx, 0.5+dy, 1.0) on a second canvas, and a roughness map from inverted/blurred luminance. normalMap.colorSpace must stay LinearSRGBColorSpace (NOT sRGB) or lighting is wrong.
- BUILD shared map sets ONCE at module scope (not per character): SKIN_MAPS (fine pore noise, normalScale ~0.25), CLOTH_MAPS (woven directional noise via horizontal+vertical line passes, normalScale ~0.45, roughness 0.85-1.0), DENIM_MAPS for trousers, WORN_METAL_MAPS (brushed streaks + scratch lines + edge-darken, metalness 0.7, roughnessMap with bright scratch lines = polished where worn). Assign these to the existing skinMat/uniMat/legMat (CharacterFactory L117-120) and the M.* prop materials (PropRenderer L11-26).
- SMOOTH the humanoid: bump CapsuleGeometry segments in limb() from (3,8) to (4,12) radial — still cheap. Merge neck+head visually by making the head a slightly squashed CapsuleGeometry or keeping the sphere but adding a skinMat neck that overlaps (already present L170). Widen shoulder taper and add a thin chest/back bevel box so the torso isn't a raw cuboid. Use buildDef to also vary head size slightly per build for less clone-army feel.
- REPLACE the glued-on face primitives (eyes/brows/nose/mouth/ears, L180-207) with a baked FACE CanvasTexture applied to the FRONT of the head only (a small planar decal mesh at z=+0.2, or set headMesh material.map to a face texture with UVs facing +z). Draw eyes/brows/mouth with canvas strokes + soft shadows so they read as painted-on, not 3D blobs. Keep ears as tiny geometry. This is the second-biggest realism win after the outlines.
- ADD a cheap SSS/skin cheat via skinMat.onBeforeCompile: inject a warm Fresnel term into gl_FragColor (rim = pow(1.0 - dot(N,V), 2.0)) tinted toward a subsurface red (~0.55,0.25,0.20) at low intensity (~0.12). Apply ONLY to skin (1 material, ~all chars share it) so it compiles one extra shader, not N. Gives ears/edges that translucent glow without any post pass.
- ENRICH props with bevels + wear. Add a roundedBox(w,h,d,bevel,mat) helper (cheap: a slightly inset core box + thin chamfer boxes, OR use a low-seg geometry with beveled corners) and swap the raw box() calls in bunk/locker/table/counter/desk for it on the prominent edges. Add per-prop wear by cloning the shared material and multiplying color by a small random factor (0.9-1.05) and nudging roughness, so the locker row isn't identical. Add AO-ish edge darkening by baking a dark border into the metal/wood color maps.
- ADD emissive ACCENT detail to props: thin emissive strip on lockers (number plate), warm rim on the serving counter food wells, a subtle screen flicker tint on desk monitors (M.screen already emissive — give it an emissiveMap CanvasTexture with scanlines). Keep using the existing glowSprite() for halos (no post pass).
- TIGHTEN material PBR values: skin roughness 0.55 (not 0.75) so light wraps; cloth 0.85 with normalMap; worn metal metalness 0.7 + roughnessMap; porcelain metalness 0.0 roughness 0.25 for a wet ceramic sheen. Add envMap via a cheap PMREM from a tiny gradient (or scene.environment from a RoomEnvironment) so metals/porcelain actually reflect something instead of reading flat — this is the single biggest 'looks rendered not flat' upgrade for metal/ceramic and costs one PMREM render at startup.
- SET scene.environment once in ThreeApp.ts using THREE.PMREMGenerator on a RoomEnvironment (or a hand-built gradient scene) so ALL MeshStandardMaterials get image-based reflections. envMapIntensity ~0.5-0.8. This alone removes most of the 'flat AI' look on metal/porcelain/screens for ~zero per-frame cost (baked once).

**Files:** D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/CharacterFactory.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/PropRenderer.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/ThreeApp.ts, D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/textures/createSurfaceMaps.ts (NEW), D:/ClaudeResourcesProjects/Projects-working-on/Lockdown-Life-3D/src/render/VisualTheme.ts (minor: skin/cloth roughness + envMapIntensity tuning)

**Snippets:**
```ts
// === src/render/textures/createSurfaceMaps.ts (NEW) ===
// One canvas -> color + normal + roughness. Reuses the speckle approach already in createConcreteTexture.
import * as THREE from 'three';
export interface SurfaceMaps { map?: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture; }
export function createSurfaceMaps(opts: {
  base?: string; grain?: number; dirX?: number; dirY?: number; // directional weave/brush
  scratches?: number; repeat?: number;
}): SurfaceMaps {
  const S = 256; const grain = opts.grain ?? 26; const rep = opts.repeat ?? 4;
  const hgt = new Float32Array(S * S);
  // base height field = value noise + directional streaks
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = (Math.random() - 0.5) * grain;
    if (opts.dirX) h += Math.sin(y * 0.6) * opts.dirX;   // horizontal weave
    if (opts.dirY) h += Math.sin(x * 0.6) * opts.dirY;   // vertical weave
    hgt[y * S + x] = h;
  }
  // scratch lines bump the height sharply (worn metal)
  // ... (draw N random thin lines into hgt) ...
  // --- normal map via Sobel on the height field ---
  const nC = document.createElement('canvas'); nC.width = nC.height = S; const nctx = nC.getContext('2d')!;
  const nImg = nctx.createImageData(S, S); const nd = nImg.data;
  const at = (x: number, y: number) => hgt[((y + S) % S) * S + ((x + S) % S)];
  const strength = 2.0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
    const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
    const i = (y * S + x) * 4;
    nd[i] = 128 + dx; nd[i + 1] = 128 + dy; nd[i + 2] = 255; nd[i + 3] = 255; // RGB normal
  }
  nctx.putImageData(nImg, 0, 0);
  const normalMap = new THREE.CanvasTexture(nC);
  normalMap.colorSpace = THREE.LinearSRGBColorSpace;        // CRITICAL: normals are NOT sRGB
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.repeat.set(rep, rep);
  // --- roughness map: darker height = more polished (worn), so invert luminance ---
  const rC = document.createElement('canvas'); rC.width = rC.height = S; const rctx = rC.getContext('2d')!;
  const rImg = rctx.createImageData(S, S); const rdd = rImg.data;
  for (let p = 0; p < S * S; p++) { const v = 200 - hgt[p]; const i = p * 4; rdd[i] = rdd[i + 1] = rdd[i + 2] = Math.max(0, Math.min(255, v)); rdd[i + 3] = 255; }
  rctx.putImageData(rImg, 0, 0);
  const roughnessMap = new THREE.CanvasTexture(rC);
  roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping; roughnessMap.repeat.set(rep, rep);
  return { normalMap, roughnessMap };
}
```
```ts
// === CharacterFactory.ts: DELETE these (the toon tell) ===
// const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b0b0e, side: THREE.BackSide });
// function shell(mesh, s=1.12){ ... mesh.add(m); }   <-- remove
// remove every  shell(m, ...)  call (limb L34, torso L138, head L174)

// === Shared map sets, module scope (built ONCE) ===
import { createSurfaceMaps } from './textures/createSurfaceMaps';
const SKIN_MAPS  = createSurfaceMaps({ grain: 10, repeat: 2 });            // fine pores
const CLOTH_MAPS = createSurfaceMaps({ grain: 8, dirX: 6, dirY: 6, repeat: 6 }); // woven
const DENIM_MAPS = createSurfaceMaps({ grain: 14, dirX: 10, repeat: 8 });

const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.55,
  normalMap: SKIN_MAPS.normalMap, normalScale: new THREE.Vector2(0.25, 0.25),
  roughnessMap: SKIN_MAPS.roughnessMap, envMapIntensity: 0.4 });
const uniMat = new THREE.MeshStandardMaterial({ color: uniColor, roughness: 0.9,
  normalMap: CLOTH_MAPS.normalMap, normalScale: new THREE.Vector2(0.45, 0.45),
  roughnessMap: CLOTH_MAPS.roughnessMap });
const legMat = new THREE.MeshStandardMaterial({ color: trouserColor, roughness: 0.95,
  normalMap: DENIM_MAPS.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
```
```ts
// === Cheap SSS / rim on SKIN ONLY (no post pass). One shared material -> one shader compile ===
skinMat.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <output_fragment>',
    `
    vec3 V = normalize( vViewPosition );
    float fres = pow( 1.0 - clamp( dot( normalize(normal), V ), 0.0, 1.0 ), 2.0 );
    vec3 sss = vec3(0.55, 0.25, 0.20) * fres * 0.12;   // warm translucent edge
    outgoingLight += sss;
    #include <output_fragment>
    `
  );
};
// NOTE r160: if 'output_fragment' include is gone in your build, target
// '#include <opaque_fragment>' or the 'gl_FragColor = vec4( outgoingLight, ...' line instead.
```
```ts
// === ThreeApp.ts: IBL so metal/porcelain stop looking flat (baked once, ~0 per-frame cost) ===
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
// in constructor, after renderer setup:
const pmrem = new THREE.PMREMGenerator(this.renderer);
this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// then on metal/porcelain materials set envMapIntensity ~0.5-0.8.
// Cost: one offscreen render at startup, no runtime cost. Mobile-safe.
```
```ts
// === PropRenderer.ts: beveled box + per-prop wear (kills the 'identical AI boxes' look) ===
function roundedBox(w:number,h:number,d:number,bevel:number,mat:THREE.Material,x=0,y=0,z=0){
  const g=new THREE.Group();
  g.add(box(w, h-bevel*2, d, mat, x, y, z));          // core
  g.add(box(w-bevel*2, h, d-bevel*2, mat, x, y, z));   // chamfer cross gives rounded read
  return g;
}
// wear: clone shared mat so the locker ROW isn't a clone army
function worn(mat: THREE.MeshStandardMaterial){ const m=mat.clone();
  const f=0.9+Math.random()*0.15; m.color.multiplyScalar(f); m.roughness=Math.min(1, m.roughness+(Math.random()-0.5)*0.2); return m; }
// shared metal now carries maps:
metal: new THREE.MeshStandardMaterial({ color:0x6b7079, roughness:0.6, metalness:0.45,
  normalMap: METAL_MAPS.normalMap, normalScale:new THREE.Vector2(0.3,0.3),
  roughnessMap: METAL_MAPS.roughnessMap, envMapIntensity:0.8 })
```
```ts
// === Baked FACE texture instead of glued-on eye/nose/mouth blobs (L180-207) ===
function faceTexture(skin:number): THREE.CanvasTexture {
  const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d')!;
  x.fillStyle = '#'+new THREE.Color(skin).getHexString(); x.fillRect(0,0,128,128);
  // soft eye sockets (shadow), painted eyes, brows, subtle mouth — all 2D, reads realistic
  x.fillStyle='rgba(0,0,0,0.18)'; x.beginPath(); x.ellipse(46,58,12,8,0,0,7); x.ellipse(82,58,12,8,0,0,7); x.fill();
  x.fillStyle='#f8f8f6'; x.beginPath(); x.ellipse(46,58,7,4,0,0,7); x.ellipse(82,58,7,4,0,0,7); x.fill();
  x.fillStyle='#2a2622'; x.beginPath(); x.arc(46,58,3,0,7); x.arc(82,58,3,0,7); x.fill();
  x.strokeStyle='#3a2c20'; x.lineWidth=3; x.beginPath(); x.moveTo(36,46); x.lineTo(56,44); x.moveTo(72,44); x.lineTo(92,46); x.stroke();
  x.strokeStyle='rgba(60,30,30,0.5)'; x.lineWidth=2; x.beginPath(); x.moveTo(54,86); x.quadraticCurveTo(64,90,74,86); x.stroke();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
// apply: give headMesh material a per-char clone with .map = faceTexture(skinColor),
// head UVs already face +z on SphereGeometry; rotate head so seam is at back.
```
