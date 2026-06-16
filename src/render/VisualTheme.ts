// Single source of truth for art direction. No magic colors scattered elsewhere.
export const THEME = {
  camera: { zoom: 12.5, min: 7, max: 28, offset: { x: 22, y: 28, z: 22 } },

  bg: 0x14171e,
  fog: { color: 0x14171e, near: 70, far: 170 },

  lights: {
    ambient: 0xaab4cc, ambientI: 1.05,
    key: 0xfff1da, keyI: 1.2,
    hemiSky: 0xc3d4f2, hemiGround: 0x3a3a30, hemiI: 0.62
  },

  walls: { side: 0x53565f, top: 0x868b96, base: 0x33353c, grime: 0x2a2c32, bars: 0x20242b, frame: 0x474b54 },

  floor: { base: 0x3a3d44 },

  // per room-type look: floor tint, accent, and a moody light color
  rooms: {
    hallway:   { floor: 0x474b54, accent: 0x33363d, light: 0xbcccea, lightI: 0.75 },
    cellblock: { floor: 0x565a63, accent: 0x6a6e78, light: 0x9fb6dc, lightI: 0.9 },
    cafeteria: { floor: 0x7a6850, accent: 0x8a7350, light: 0xffd9a0, lightI: 1.15 },
    shower:    { floor: 0x52707c, accent: 0x6f97a4, light: 0xaed4e6, lightI: 0.95 },
    guardroom: { floor: 0x44505f, accent: 0x556074, light: 0x8fa6d0, lightI: 0.9 },
    yard:      { floor: 0x63724a, accent: 0x6f8050, light: 0xdfecff, lightI: 0.9 }
  } as Record<string, { floor: number; accent: number; light: number; lightI: number }>,

  prisoners: {
    uniforms: [0xef7a22, 0xe24a2f, 0xe8b52e, 0xde6a26, 0xd14a2a],
    skins: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4423],
    hair: [0x2b1d0e, 0x111111, 0x5a3a1a, 0x888888, 0xd9b382, 0x7a3b2a]
  },
  // prisoners: bright jumpsuit; darker trousers for a two-tone "uniform" read
  prisonerTrousers: 0x394050,
  guard: { uniform: 0x1f2c3e, trousers: 0x18222f, cap: 0x0e151f, badge: 0xf2cf4e, skin: 0xe0ac69 },

  selection: 0x6dff9e,
  contactShadow: 0x000000,
  exterior: 0x1a1c22
};

export const hex = (n: number) => '#' + (n >>> 0).toString(16).padStart(6, '0');
