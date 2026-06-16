// Single source of truth for art direction. No magic colors scattered elsewhere.
export const THEME = {
  camera: { zoom: 15, min: 9, max: 30, offset: { x: 22, y: 28, z: 22 } },

  bg: 0x12141a,
  fog: { color: 0x12141a, near: 55, far: 150 },

  lights: {
    ambient: 0x9aa6c0, ambientI: 0.78,
    key: 0xfff1da, keyI: 1.05,
    hemiSky: 0xb9cdf0, hemiGround: 0x2a2922, hemiI: 0.45
  },

  walls: { side: 0x4c4f57, top: 0x6d717b, base: 0x33353c, grime: 0x2a2c32, bars: 0x1d2026, frame: 0x3a3d44 },

  floor: { base: 0x303239 },

  // per room-type look: floor tint, accent, and a moody light color
  rooms: {
    hallway:   { floor: 0x3b3e46, accent: 0x33363d, light: 0x9fb4d6, lightI: 0.35 },
    cellblock: { floor: 0x4a4d55, accent: 0x6a6e78, light: 0x8fa6cc, lightI: 0.5 },
    cafeteria: { floor: 0x6a5a44, accent: 0x8a7350, light: 0xffd9a0, lightI: 0.85 },
    shower:    { floor: 0x46606a, accent: 0x6f97a4, light: 0x9fc6d8, lightI: 0.6 },
    guardroom: { floor: 0x3a4350, accent: 0x556074, light: 0x6f86b0, lightI: 0.45 },
    yard:      { floor: 0x55633f, accent: 0x6f8050, light: 0xcfe0ff, lightI: 0.25 }
  } as Record<string, { floor: number; accent: number; light: number; lightI: number }>,

  prisoners: {
    uniforms: [0xd8722c, 0xc94d3a, 0xd8b13a, 0x8a8f98, 0xb5683a],
    skins: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4423],
    hair: [0x2b1d0e, 0x111111, 0x5a3a1a, 0x888888, 0xd9b382, 0x7a3b2a]
  },
  guard: { uniform: 0x2b3a4f, cap: 0x1b2734, badge: 0xe3c14a, skin: 0xe0ac69 },

  selection: 0x57ff8a,
  contactShadow: 0x000000
};

export const hex = (n: number) => '#' + (n >>> 0).toString(16).padStart(6, '0');
