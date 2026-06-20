# 🔖 RESTART POINT — Lockdown-Life-3D (modern Hard Time remake)

> Big build session **2026-06-19/20**. Pick up here next time.

## Where we are
- **Version:** `v4.30.0-grapplehold` · **branch:** `main` · **HEAD:** latest on `main` (clean, pushed, auto-deployed)
- > The 2026-06-20 session shipped **Stage 4.30 grapple-holds → elimination (submit / unconscious)** on top of the (previously untracked) v4.26→v4.29 combat/camera overhaul. Verified clean: `npm run build` + `node smoke.mjs` + a throwaway `node probe.mjs` covering **11 grapple invariants**, all green; vetted by two multi-agent passes (a pre-build design review and a post-build adversarial code review — all findings fixed, incl. gating the player-holder choke behind the Choke button and making Slam cost stamina / able to whiff).
- **Live:** https://qemmhd.github.io/Lockdown-Life-3D/ (GitHub Pages auto-deploys on push to `main`)
- **Repo:** `QemmHD/Lockdown-Life-3D` · **local:** `D:\ClaudeResourcesProjects\Projects-working-on\Lockdown-Life-3D`
- **North star:** a modern version of **Mdickie's _Hard Time_** (procedural art + audio, no asset files).
- **Save format:** **v18** (loads all older saves; hydrate is version-agnostic + defensive).

## How to resume (commands)
```bash
npm install
npm run dev          # play at http://localhost:5173
npm run build        # tsc --noEmit + vite build (must be green before committing)
npm run preview      # serves dist on :4173 (needed for smoke)
node smoke.mjs       # headless-Chrome smoke (needs preview up + `npm install puppeteer-core --no-save`)
```
- **Architecture invariant:** `src/sim/Simulation.ts` is authoritative; `src/render/*` + `src/audio/*` are READ-ONLY (listen to EventBus, never write sim). EventBus is untyped (emit/on any string). Anything added to `serialize()` MUST get a matching defensive read in `hydrate()`.
- **Per-stage loop:** build + `node smoke.mjs` green → bump `version` in `package.json` + the `version:` label in `src/core/Game.ts` + add a `CHANGELOG.md` entry → commit → push to `main` (auto-deploys). Behavioral changes were each verified with a throwaway `probe.mjs` (puppeteer, drives `sim.step`).

## Shipped this session (v4.14 → v4.25, all live)
1. **Vices** (v4.14) — coffee/cigarette/hooch feed Spirit at a health + sickness cost.
2. **Mind states** (v4.15) — Spirit-0 **nervous breakdown** (loss of control) + Spirit-90 **adrenaline finisher**.
3. **Character builds** (v4.16) — zero-sum training (weights→STR, pull-up→AGI), SKILL↔REP via reading, AGI drives attack cadence.
4. **Animation & combat-FX** (v4.17) — full pose table, weapon-in-hand, brow emotion, limp/KO sprawl/victory pump, blood+spark particle pool.
5. **Smarter guards** (v4.18) — notice → **investigate** (walk over) → respond, instead of teleport-dispatch; alarm/lockdown stay instant.
6. **Throw weapons** (v4.19) — hurl your weapon for a burst/knockdown (lose it) + the whole first adversarial-review fix pass.
7. **Crafting** (v4.20) — Workshop: combine items (ferment hooch, sharpen shiv, pipe, blade, phone), SKILL-gated.
8. **Court** (v4.21) — witnessed crimes → rap sheet → hearing where **reputation works against you**; skill/cash to defend. Save v18.
9. **Graphics realism v2** (v4.22) — EffectComposer grade/vignette/grain post stack.
10. **Onboarding** (v4.23) — first-run 4-card coach overlay (New Game only).
11. **Commissary** (v4.24) — legit store / honest money sink + second review-fix pass (court bribe rebalanced, save hygiene).
12. **Grapple** (v4.25) — STR-contested slam throw; the wrestling verb that pays off a Strength build.

Two multi-agent **adversarial review passes** were run and all findings fixed (training farm, free-Spirit coffee, finisher, guard-stuck-investigating, court-bribe exploit, coach overlay, transient-field save hygiene).

## Shipped after that (v4.26 → v4.29 — test-feedback combat & camera overhaul, was untracked here)
13. **Cause of death + debug tools** (v4.26) — GAME OVER names the specific cause; `?debug` adds hotkeys (`K/B/M/J/G/H/Y`) + `window.__cheats.*`.
14. **Rotatable + brighter camera** (v4.27) — Q/E/← → orbit; exposure/ambient lift, softer post-FX. **(v4.27.1)** rotation as a one-finger swipe for iOS; pinch out → overview pan, pinch in → focus.
15. **Combat juice** (v4.28) — hitstop, decaying screen shake (respects reduce-motion), readable heavy/grab telegraphs; camera mapping fixed to spec.
16. **Combat depth** (v4.29) — momentum meter (build on clean hits, reset on getting hit), timed **parry**, **dodge**, and **guard-break** vs turtling. Read-and-react duel; NPCs use the same rules. Transient combat state only — no save-format change.
17. **Grapple holds → elimination** (v4.30) — a won grab on a worn-down/over-powered foe **clinches into a persistent hold** (states `grappling`/`held`) → **Choke** (out cold / `unconscious` ~14s) or the foe **taps** (`submit`). **Struggle**/**Reverse** to escape; **NPCs grapple** each other + you (choke-out drama in the yard). Full `brain.state` call-site audit; transient state only — **save stays v18**. Probe: 11 invariants green.

## What's next (remaining backlog — ranked, NOT yet built)
- **A — Persistent-death world**: a dead character lives on as an NPC owning the same cell. Needs world-state serialized independent of the save slot (structural; playtest with care). *Now the top combat-spine item is done (4.30), this is the highest-value goal-loop piece left.*
- **A — Map / layout reorg** (`src/world/WorldGen.ts`): dig-zones, sealable perimeter escape routes, an on-the-run outside zone. Touches pathing/collision — re-run `selfTest`/smoke hard.
- **B — Romance** (please-loop → morale/health, jealousy) and **addictive-loop polish** (streak/notoriety surfacing) — peripheral; existing tiers/objectives/alerts already cover most of the latter.

## Design docs in repo
- `docs/HARDTIME-DESIGN.md` — the design bible (system by system).
- `docs/HARDTIME-ROADMAP.md` — older build-ready stage plans + the missed-mechanics backlog.
- `docs/ARCHITECTURE.md` — code organisation + invariants.
