// Single source of truth for art direction. No magic colors scattered elsewhere.
// Stage 3.8A: brighter, more readable palette — orange jumpsuits pop, less muddy grey.
export const THEME = {
  // Camera defaults for the classic iso overview.
  camera: { zoom: 9, min: 5.5, max: 40, offset: { x: 22, y: 28, z: 22 }, frameRight: 3, panHold: 4 },
  // Character camera: a perspective close-up that FOLLOWS the player from a fixed high 3/4 angle
  // (does not orbit behind the player — that caused spinning). High enough to clear the 2.0 walls,
  // far enough not to feel cramped. distance = horizontal pullback, height = camera elevation.
  charCamera: { fov: 50, distance: 12, height: 15, lookHeight: 1.2, minDistance: 7, maxDistance: 22 },

  bg: 0x2a3040,
  fog: { color: 0x2a3040, near: 90, far: 200 },

  // more directional contrast (lower fill, stronger key) so the prison reads less flat/grey
  lights: {
    ambient: 0xc4cee6, ambientI: 1.12,
    key: 0xfff1d6, keyI: 1.85,
    hemiSky: 0xcfe0ff, hemiGround: 0x4e4e3c, hemiI: 0.8
  },

  // cooler, slightly more saturated concrete with a brighter cap = walls pop off the floor
  walls: { side: 0x5b6473, top: 0xacb4c6, base: 0x383c46, grime: 0x33363f, bars: 0x2a2f38, frame: 0x5a6070 },

  floor: { base: 0x474e5b },

  // per room-type look: brighter floor tints + warmer room lights
  rooms: {
    hallway:   { floor: 0x5a5f6a, accent: 0x44484f, light: 0xd0daf0, lightI: 1.0 },
    cellblock: { floor: 0x686d78, accent: 0x7a7f8a, light: 0xbaccea, lightI: 1.15 },
    cafeteria: { floor: 0x8a7858, accent: 0x9a8560, light: 0xffe4b0, lightI: 1.4 },
    shower:    { floor: 0x628090, accent: 0x80aab8, light: 0xc0e4f4, lightI: 1.2 },
    guardroom: { floor: 0x546070, accent: 0x667888, light: 0xa0b8e0, lightI: 1.15 },
    yard:      { floor: 0x748258, accent: 0x809060, light: 0xf0f6ff, lightI: 1.15 }
  } as Record<string, { floor: number; accent: number; light: number; lightI: number }>,

  prisoners: {
    // vibrant orange jumpsuits that pop against grey walls
    uniforms: [0xff8c22, 0xf05a28, 0xffa030, 0xf07030, 0xe84828],
    skins: [0xf5cc8d, 0xe4b878, 0xd49a5a, 0x9a6838, 0xffdeb8, 0x7a5030],
    hair: [0x2b1d0e, 0x111111, 0x5a3a1a, 0x888888, 0xd9b382, 0x7a3b2a]
  },
  prisonerTrousers: 0x4a5060,
  guard: { uniform: 0x28384e, trousers: 0x1e2a3a, cap: 0x141e2a, badge: 0xf5d55a, skin: 0xe4b878 },

  selection: 0x6dff9e,
  contactShadow: 0x000000,
  exterior: 0x242830
};

export const hex = (n: number) => '#' + (n >>> 0).toString(16).padStart(6, '0');
