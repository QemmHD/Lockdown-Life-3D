# Changelog

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
