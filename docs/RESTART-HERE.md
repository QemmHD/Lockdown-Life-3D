# 🔖 RESTART POINT — Lockdown-Life-3D (modern Hard Time remake)

> Stopping point saved **2026-06-19**. Pick up here next session.

## Where we are
- **Version:** `v4.13.1-spirit` · **branch:** `main` · **HEAD:** `1572ff1` (clean, fully pushed)
- **Live:** https://qemmhd.github.io/Lockdown-Life-3D/ (GitHub Pages auto-deploys on push to `main`)
- **Repo:** `QemmHD/Lockdown-Life-3D` · **local:** `D:\ClaudeResourcesProjects\Projects-working-on\Lockdown-Life-3D`
- **North star:** a modern version of **Mdickie's _Hard Time_** (procedural art + audio, no asset files).

## How to resume (commands)
```bash
npm install
npm run dev          # play at http://localhost:5173 (or --host for phone on same Wi-Fi)
npm run build        # tsc --noEmit + vite build (must be green before committing)
node smoke.mjs       # headless-Chrome smoke test (needs `npm run preview` up + puppeteer-core)
# puppeteer-core for smoke/shot harnesses (gitignored): npm install puppeteer-core --no-save
```
- **Architecture invariant:** `src/sim/Simulation.ts` is authoritative; `src/render/*` + `src/audio/*` are READ-ONLY presentation (listen to EventBus, never write sim). Save format is **v16**.
- **Workflow:** each stage = build → `npm run build` + `node smoke.mjs` green → commit → push to `main` (auto-deploys). Bump `version` in `package.json` + the `version:` label in `src/core/Game.ts` + add a `CHANGELOG.md` entry each stage.

## What's shipped (this session, all live)
Sentence → release/escape/death endings · warden release conditions · death & injuries · gear ladder (weapons/armor/escape-tools) · bleeding blades · escape-as-a-project · stats & training (STR/AGI/SKILL/STAMINA + the "25% rule") · survival/death-by-neglect · **Spirit bar** (adrenaline/breakdown, event-responsive) · allies-on-sight · conversations (compliment/recruit) · NPC grudge fights · realism lighting · decor clutter · 22-inmate population. Plus all playtest balance: longer days + slower needs, guard detection/LOS + attackable guards, allies-deadliness fixes.

## What's next (build-ready plans in `docs/HARDTIME-ROADMAP.md`)
1. **Map reorg** — a more accurate prison layout (`src/world/WorldGen.ts`).
2. **Graphics realism v2** — EffectComposer post stack (GTAO/grade/vignette, adapt `src/legacy/game/PostFX.ts`) + procedural normal/roughness maps + PBR material tuning.
3. **Smarter guards** — notice-then-investigate (LOS + delay) instead of dispatch; the additive intent scorer + self-defense/surrender intents.
4. **Court / parole hearings** · **grapples/throws** · **props-as-weapons (pick up / throw)** · **vices** (smoking/drinking → Spirit) · **commissary/crafting** · **character editor** · **persistent-death world**.

## Design docs in repo
- `docs/HARDTIME-DESIGN.md` — the design bible (the soul of Hard Time, system by system).
- `docs/HARDTIME-ROADMAP.md` — build-ready stage plans + the full missed-mechanics + deep-research backlog (ranked).
- `docs/ARCHITECTURE.md` — code organisation + invariants.
