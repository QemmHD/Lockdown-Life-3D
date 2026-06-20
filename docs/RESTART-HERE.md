# 🔖 RESTART POINT — Lockdown-Life-3D (modern Hard Time remake)

> Big build session **2026-06-19/20**. Pick up here next time.

## Where we are
- **Version:** `v4.25.0-grapple` · **branch:** `main` · **HEAD:** `e1c804f` (clean, fully pushed)
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

## What's next (remaining backlog — ranked, NOT yet built)
- **S — Grapple holds → elimination states** (UNCONSCIOUS / SUBMIT): extend the throw into a persistent grab + choke/struggle meter. Highest combat-spine value left.
- **A — Persistent-death world**: a dead character lives on as an NPC owning the same cell. Needs world-state serialized independent of the save slot (structural; playtest with care).
- **A — Map / layout reorg** (`src/world/WorldGen.ts`): dig-zones, sealable perimeter escape routes, an on-the-run outside zone. Touches pathing/collision — re-run `selfTest`/smoke hard.
- **B — Romance** (please-loop → morale/health, jealousy) and **addictive-loop polish** (streak/notoriety surfacing) — peripheral; existing tiers/objectives/alerts already cover most of the latter.

## Design docs in repo
- `docs/HARDTIME-DESIGN.md` — the design bible (system by system).
- `docs/HARDTIME-ROADMAP.md` — older build-ready stage plans + the missed-mechanics backlog.
- `docs/ARCHITECTURE.md` — code organisation + invariants.
