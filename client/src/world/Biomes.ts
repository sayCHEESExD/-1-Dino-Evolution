import type { StageTheme } from '@dino/shared';
import type { PartBuilder } from '../render/PartBuilder.js';
import {
  araucaria,
  boulders,
  bush,
  crystals,
  cycad,
  deadTree,
  glowShrooms,
  horsetails,
  jungleGiant,
  mangrove,
  mesa,
  palm,
  redwood,
  rock,
  spire,
  treeFern,
  type Rand,
} from './Nature.js';
import { ribcage, skull } from './Relics.js';
import type { Liquid } from './Terrain.js';
import { giantLeaves, ruins } from './Wild.js';

/**
 * THE BIOMES: what each of the thirty habitats looks like and how it FEELS -
 * its painted ground, its liquids, the rock and turf of its walls, the family
 * of plants and relics it is dressed with, the big scenery over its walls, and
 * its air. The road runs from a sunny fern meadow and a raptor thicket through
 * rivers and swamps, canyons, redwoods, dunes, tar, ash, geysers, tundra,
 * falls, badlands, lagoons, volcanoes, amber groves, overgrown ruins and a
 * moonlit jungle to the island's summit - each one more dramatic than the last.
 */
export type Placer = (b: PartBuilder, r: Rand, x: number, y: number, z: number, s: number) => void;

export interface Atmosphere {
  readonly fog: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly skyTop: number;
  readonly sky: number;
  readonly sun: number;
  readonly sunIntensity: number;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemiIntensity: number;
  readonly ambient: number;
}

/**
 * The family a habitat is dressed from: what grows along its walls, what
 * stands on its rock solids, what lies about its floor.
 */
export type Family = 'meadow' | 'jungle' | 'river' | 'swamp' | 'rocky' | 'volcanic' | 'frozen' | 'forest' | 'ruins' | 'beach';

/** Where a habitat's liquid lies: a few puddles, a river across, marsh, pools, a lagoon, glowing veins. */
export type LiquidLayout = 'puddles' | 'river' | 'marsh' | 'pools' | 'lagoon' | 'veins';

export interface Look {
  readonly family: Family;
  /** The ground's three tones: base, lighter patches, darker patches. */
  readonly floor: readonly [number, number, number];
  /** Trails and bare earth (or sand, or packed snow). */
  readonly soil: number;
  /** The band of litter at the foot of the walls. */
  readonly litter: number;
  readonly rock: number;
  /** The low bank in front of the rock. */
  readonly bank: number;
  /** Turf, snow or moss on every top, or bare rock. */
  readonly cap: number | null;
  readonly liquid: { readonly layout: LiquidLayout; readonly kind: Liquid; readonly color: number } | null;
  /** The wall's three tiers' height ranges: bank, shelf, cliff. */
  readonly tiers: readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
  /** The land beyond the walls. */
  readonly outer: number;
  /** The habitat's signature colour: blooms, crystals, glows. */
  readonly accent: number;
}

export interface Biome {
  readonly look: Look;
  readonly air: Atmosphere;
  /** Big scenery beyond the walls: [placer, weight, scale]. */
  readonly beyond: readonly (readonly [Placer, number, number])[];
  /** Particles in the air: snow, ash, embers, mist, fireflies. */
  readonly particles?: { readonly color: number; readonly kind: 'snow' | 'ash' | 'embers' | 'mist' | 'fireflies' | 'rain' | 'spores' };
}

const air = (
  fog: number,
  skyTop: number,
  sky: number,
  sun: number,
  sunIntensity: number,
  hemiSky: number,
  hemiGround: number,
  extra: Partial<Atmosphere> = {},
): Atmosphere => ({
  fog,
  // Roblox daylight: a long clear view, strong sky bounce, soft shadows.
  fogNear: 200,
  fogFar: 720,
  skyTop,
  sky,
  sun,
  sunIntensity,
  hemiSky,
  hemiGround,
  hemiIntensity: 1.3,
  ambient: 0.6,
  ...extra,
});

type Tiers = Look['tiers'];
const T = (a: number, b: number, c: number, d: number, e: number, f: number): Tiers => [
  [a, b],
  [c, d],
  [e, f],
];

// ------------------------------------------------------------- placers

const treeFernP: Placer = (b, r, x, y, z, s) => treeFern(b, r, x, y, z, s);
const cycadP: Placer = (b, r, x, y, z, s) => cycad(b, r, x, y, z, s);
const palmP: Placer = (b, r, x, y, z, s) => palm(b, r, x, y, z, s);
const araucariaP: Placer = (b, r, x, y, z, s) => araucaria(b, r, x, y, z, s);
const redwoodP: Placer = (b, r, x, y, z, s) => redwood(b, r, x, y, z, s);
const giantP: Placer = (b, r, x, y, z, s) => jungleGiant(b, r, x, y, z, s);
const horsetailP: Placer = (b, r, x, y, z, s) => horsetails(b, r, x, y, z, s);
const bushP: Placer = (b, r, x, y, z, s) => bush(b, r, x, y, z, s, 3);
const leavesP: Placer = (b, r, x, y, z, s) => giantLeaves(b, r, x, y, z, s);
const mangroveP: Placer = (b, r, x, y, z, s) => mangrove(b, r, x, y, z, s);
const rocksP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    boulders(b, r, x, y, z, s, color);
const deadP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    deadTree(b, r, x, y, z, s, color);
const mesaP =
  (colors: readonly number[]): Placer =>
  (b, r, x, y, z, s) =>
    mesa(b, r, x, y, z, s, colors);
const spireP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    spire(b, r, x, y, z, s, color);
const crystalP =
  (color: number, glow = false): Placer =>
  (b, r, x, y, z, s) =>
    crystals(b, r, x, y, z, s, color, glow);
const shroomP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    glowShrooms(b, r, x, y, z, s, color);
const skullP: Placer = (b, r, x, y, z, s) => skull(b, r, x, z, s * 0.9, r() * 6, undefined, y);
const ribsP: Placer = (b, r, x, _y, z, s) => ribcage(b, r, x, z, s * 0.6, r() * 6);
const ruinP: Placer = (b, r, x, _y, z, s) => ruins(b, r, x, z, 5 * s, 6 * s, 4 * s);
const iceP: Placer = (b, r, x, y, z, s) => crystals(b, r, x, y, z, s * 1.4, 0xcfeaff);
const snowRockP: Placer = (b, r, x, y, z, s) => {
  boulders(b, r, x, y, z, s, 0x9aa4b0);
  rock(b, r, x, y + s * 0.8, z, s * 0.9, 0xf4f8fc);
};
const snowPineP: Placer = (b, r, x, y, z, s) => araucaria(b, r, x, y, z, s * 0.8);

// ------------------------------------------------------------- the table

const W = (layout: LiquidLayout, color: number, kind: Liquid = 'water'): Look['liquid'] => ({ layout, kind, color });

export const BIOMES: Readonly<Record<StageTheme | 'park', Biome>> = {
  park: {
    look: {
      family: 'jungle',
      floor: [0x5ec83e, 0x74d24a, 0x4cb036],
      soil: 0xc08a50,
      litter: 0x7a5a32,
      rock: 0xa8947e,
      bank: 0xa8703a,
      cap: 0x56c23a,
      liquid: W('pools', 0x2fb4e8),
      tiers: T(4, 6, 12, 16, 22, 28),
      outer: 0x4cb036,
      accent: 0xffc23a,
    },
    air: air(0xcfe8ff, 0x3f9bf0, 0xa2d6ff, 0xfff6e4, 2.2, 0xdcefff, 0x8aa070, { fogNear: 220, fogFar: 760 }),
    beyond: [[giantP, 3, 1.2], [araucariaP, 2, 1.1], [treeFernP, 2, 1.2]],
  },
  meadow: {
    look: {
      family: 'meadow',
      floor: [0x6fcb46, 0x86d652, 0x58b63c],
      soil: 0xc49058,
      litter: 0x8a6a3a,
      rock: 0xa39a8a,
      bank: 0xa8743e,
      cap: 0x62c43e,
      liquid: W('puddles', 0x3ab8e8),
      tiers: T(3.6, 5, 7, 10, 11, 15),
      outer: 0x5fbf3e,
      accent: 0xffd23a,
    },
    air: air(0xd8ecd8, 0x4a9ae8, 0xb0dcf8, 0xfff4dc, 2.1, 0xcfeaff, 0x7a8a52),
    beyond: [[cycadP, 3, 1.3], [treeFernP, 2, 1], [bushP, 3, 1.6], [araucariaP, 2, 0.9]],
  },
  grassland: {
    look: {
      family: 'jungle',
      floor: [0x3faa44, 0x4cb84a, 0x2e9038],
      soil: 0x9a6436,
      litter: 0x5a4a2a,
      rock: 0x7d7a6e,
      bank: 0x8a5a32,
      cap: 0x2f9e3c,
      liquid: W('puddles', 0x4a9a7a),
      tiers: T(4, 6, 11, 15, 18, 24),
      outer: 0x2f8a36,
      accent: 0xff7a2a,
    },
    air: air(0xb8d4b0, 0x4a8ac8, 0xa8d0b8, 0xfff0c8, 1.9, 0xc8e4c8, 0x3a5a2a, { fogNear: 110, fogFar: 460 }),
    beyond: [[giantP, 4, 1.25], [treeFernP, 3, 1.3], [araucariaP, 2, 1.1]],
    particles: { color: 0xd0f0a0, kind: 'mist' },
  },
  river: {
    look: {
      family: 'river',
      floor: [0x62c048, 0x76cc52, 0x4caa3e],
      soil: 0xe4cc8e,
      litter: 0xb89a60,
      rock: 0x8f8b84,
      bank: 0x9a7a4e,
      cap: 0x52b83e,
      liquid: W('river', 0x2aa8e0),
      tiers: T(3.6, 5, 8, 12, 13, 18),
      outer: 0x4fb03e,
      accent: 0x3fc8ff,
    },
    air: air(0xd4e8e4, 0x4a9ad8, 0xacd6ec, 0xfff0d8, 2.0, 0xc8e6ff, 0x6a7a5a),
    beyond: [[treeFernP, 3, 1.1], [palmP, 2, 1], [giantP, 2, 1.1], [horsetailP, 2, 1.5]],
    particles: { color: 0xffffff, kind: 'mist' },
  },
  swamp: {
    look: {
      family: 'swamp',
      floor: [0x6a9a3e, 0x7aa848, 0x557f32],
      soil: 0x6b4a2c,
      litter: 0x4a3a24,
      rock: 0x6e6c5c,
      bank: 0x5e4630,
      cap: 0x4f8f36,
      liquid: W('marsh', 0x3fa07e),
      tiers: T(3.6, 4.6, 7, 10, 12, 16),
      outer: 0x46783a,
      accent: 0xb8ff4a,
    },
    air: air(0x9aaa88, 0x5a7a6a, 0x9aaa8a, 0xe8e8c0, 1.5, 0xa8b89a, 0x3a4a2a, { fogNear: 70, fogFar: 340, ambient: 0.45 }),
    beyond: [[mangroveP, 3, 1.3], [deadP(0x5a5040), 2, 1.1], [giantP, 2, 1.1], [horsetailP, 2, 1.6]],
    particles: { color: 0xc8d8a0, kind: 'spores' },
  },
  jungle: {
    look: {
      family: 'jungle',
      floor: [0x3cae4a, 0x52c055, 0x2c9440],
      soil: 0x8a5a30,
      litter: 0x4a3a22,
      rock: 0x77786a,
      bank: 0x7a5230,
      cap: 0x2fa845,
      liquid: W('puddles', 0x3aa8c8),
      tiers: T(4, 6, 12, 16, 20, 26),
      outer: 0x2a8a3a,
      accent: 0xff4ab0,
    },
    air: air(0x9ab88a, 0x4a8a6a, 0x9ac8a8, 0xfff0c0, 1.6, 0xb8dcb8, 0x2a4a22, { fogNear: 80, fogFar: 380 }),
    beyond: [[giantP, 4, 1.3], [treeFernP, 4, 1.3], [palmP, 2, 1.1], [araucariaP, 1, 1.2]],
    particles: { color: 0xd0f0a0, kind: 'mist' },
  },
  canyon: {
    look: {
      family: 'rocky',
      floor: [0xe6b27a, 0xeec290, 0xd49a64],
      soil: 0xf2d4a0,
      litter: 0xa8683e,
      rock: 0xbc5836,
      bank: 0xa84e30,
      cap: null,
      liquid: null,
      tiers: T(5, 8, 13, 18, 22, 30),
      outer: 0xc87a4a,
      accent: 0xffa23a,
    },
    air: air(0xf0d0b0, 0x5a96d8, 0xe0c8a8, 0xffe8c0, 2.3, 0xffe0c0, 0x9a5a3a),
    beyond: [[mesaP([0xc8703e, 0xd88a5a, 0xb05a36]), 3, 1.4], [spireP(0xc0643a), 2, 1.3], [deadP(0x8a6a4a), 1, 1]],
  },
  redwood: {
    look: {
      family: 'forest',
      floor: [0x5f9a3e, 0x6ea648, 0x4f8534],
      soil: 0x9a6a3e,
      litter: 0x8a5a36,
      rock: 0x857868,
      bank: 0x7a5234,
      cap: 0x3f9a3a,
      liquid: W('puddles', 0x3aa0c0),
      tiers: T(4, 6, 10, 14, 16, 22),
      outer: 0x3f7f34,
      accent: 0xff8a3a,
    },
    air: air(0xa8b8a0, 0x5a8ac8, 0xa8c4c8, 0xffe0b0, 1.7, 0xb8d0c0, 0x4a3a28, { fogNear: 90, fogFar: 420 }),
    beyond: [[redwoodP, 5, 1.1], [treeFernP, 2, 1.2]],
    particles: { color: 0xffe0a0, kind: 'mist' },
  },
  cycad: {
    look: {
      family: 'meadow',
      floor: [0x92c84e, 0xa8d45e, 0x7ab442],
      soil: 0xc49a5e,
      litter: 0x9a7a44,
      rock: 0xb8a482,
      bank: 0xb07e48,
      cap: 0x84c046,
      liquid: W('puddles', 0x3ab8e0),
      tiers: T(3.6, 5, 8, 11, 13, 17),
      outer: 0x7ab040,
      accent: 0xff7a3a,
    },
    air: air(0xe4e8c8, 0x5aa0e0, 0xbcdcf0, 0xfff2d0, 2.1, 0xd8ecff, 0x7a8a4a),
    beyond: [[cycadP, 5, 1.6], [horsetailP, 2, 1.6], [araucariaP, 1, 1]],
  },
  highland: {
    look: {
      family: 'rocky',
      floor: [0x80b84e, 0x92c25a, 0x6aa244],
      soil: 0xb8986a,
      litter: 0x8a7a5a,
      rock: 0x9696a0,
      bank: 0x8a8478,
      cap: 0x6aae44,
      liquid: W('puddles', 0x4ab0e0),
      tiers: T(4.5, 7, 11, 15, 18, 24),
      outer: 0x6aa044,
      accent: 0xffc23a,
    },
    air: air(0xd8e4e8, 0x3a86d8, 0xb4d4f0, 0xfff4e0, 2.2, 0xd8ecff, 0x6a7a5a, { fogNear: 180, fogFar: 640 }),
    beyond: [[araucariaP, 3, 1.1], [rocksP(0x8e8e98), 3, 2.2], [spireP(0x8a8a94), 1, 1.2]],
  },
  desert: {
    look: {
      family: 'rocky',
      floor: [0xf0cf92, 0xf6dca8, 0xdcb478],
      soil: 0xe8c080,
      litter: 0xc89a62,
      rock: 0xdca060,
      bank: 0xd08c52,
      cap: null,
      liquid: null,
      tiers: T(4, 6, 10, 14, 16, 22),
      outer: 0xe8c486,
      accent: 0xff8a2a,
    },
    air: air(0xf4e0b8, 0x4a90d8, 0xf0dcb8, 0xfff0c8, 2.5, 0xfff0d8, 0xb08a52, { fogNear: 170, fogFar: 600 }),
    beyond: [[mesaP([0xd8a46a, 0xe8b87a, 0xc8905a]), 2, 1.2], [deadP(0xb8a488), 2, 1.1], [skullP, 1, 2.2], [ribsP, 1, 1.6]],
    particles: { color: 0xf0d8a8, kind: 'ash' },
  },
  tarpit: {
    look: {
      family: 'swamp',
      floor: [0x7a6a4e, 0x8a7a5a, 0x655840],
      soil: 0x5a4a36,
      litter: 0x3e342a,
      rock: 0x6a6254,
      bank: 0x4a3e30,
      cap: 0x6a8a3a,
      liquid: W('pools', 0x16120e, 'tar'),
      tiers: T(4, 5, 9, 12, 14, 19),
      outer: 0x5a5040,
      accent: 0xff9a3a,
    },
    air: air(0xa89c8a, 0x6a88a8, 0xb0a898, 0xffe0b0, 1.6, 0xc8c0b0, 0x3a3228, { fogNear: 90, fogFar: 420 }),
    beyond: [[deadP(0x4a4238), 3, 1.1], [ribsP, 2, 1.6], [horsetailP, 1, 1.2]],
  },
  mangrove: {
    look: {
      family: 'swamp',
      floor: [0xdcc68e, 0x9ccc5e, 0xc8b078],
      soil: 0xe8d49a,
      litter: 0x8a7a4e,
      rock: 0x8f8676,
      bank: 0xa08a5a,
      cap: 0x4cb048,
      liquid: W('marsh', 0x2ab8c0),
      tiers: T(3.6, 4.6, 7, 10, 12, 16),
      outer: 0x5aa84a,
      accent: 0x3ae0d0,
    },
    air: air(0xd0e0d8, 0x4aa0d8, 0xb8dcec, 0xfff0d0, 2.0, 0xd0ecff, 0x7a7a5a),
    beyond: [[mangroveP, 4, 1.3], [palmP, 3, 1.2], [horsetailP, 1, 1.4]],
  },
  ash: {
    look: {
      family: 'volcanic',
      floor: [0x827c78, 0x908a86, 0x6c6663],
      soil: 0x5a5552,
      litter: 0x4a4644,
      rock: 0x514b48,
      bank: 0x3e3a38,
      cap: null,
      liquid: W('veins', 0xff6a1a, 'lava'),
      tiers: T(5, 7, 12, 16, 20, 26),
      outer: 0x6a6462,
      accent: 0xff6a2a,
    },
    air: air(0x8a8480, 0x5a5a64, 0x9a9290, 0xffc890, 1.3, 0xb0a8a0, 0x3a3432, { fogNear: 70, fogFar: 340, ambient: 0.35 }),
    beyond: [[deadP(0x3a3634), 4, 1.2], [rocksP(0x4a4644), 2, 2], [spireP(0x3a3634), 1, 1.4]],
    particles: { color: 0xc8c0b8, kind: 'ash' },
  },
  geyser: {
    look: {
      family: 'volcanic',
      floor: [0xe0cf9e, 0xecdcb4, 0xcdb884],
      soil: 0xf2e6c8,
      litter: 0xd88a3a,
      rock: 0xc8b89c,
      bank: 0xd8a060,
      cap: 0x86b04a,
      liquid: W('pools', 0x28c8f0),
      tiers: T(4, 6, 10, 13, 15, 20),
      outer: 0xc8b48a,
      accent: 0x4ad8ff,
    },
    air: air(0xe0e4e0, 0x5a9ad8, 0xc8dce8, 0xfff4e0, 2.0, 0xe4f0ff, 0x9a8a6a, { fogNear: 110, fogFar: 460 }),
    beyond: [[crystalP(0xe8d8a8), 2, 1.4], [rocksP(0xc0b098), 3, 1.8], [deadP(0xd8ccb0), 1, 1]],
    particles: { color: 0xffffff, kind: 'mist' },
  },
  tundra: {
    look: {
      family: 'frozen',
      floor: [0xf0f6fc, 0xe2ecf6, 0xd4e2ee],
      soil: 0xc8d6e4,
      litter: 0xb0bccc,
      rock: 0x8c98a8,
      bank: 0xa4b0c0,
      cap: 0xffffff,
      liquid: W('pools', 0x9ad8f4, 'ice'),
      tiers: T(4, 6, 10, 14, 16, 22),
      outer: 0xe8f0f8,
      accent: 0x7ad8ff,
    },
    air: air(0xe8f0f8, 0x6a9ad0, 0xd8e8f4, 0xf0f4ff, 1.8, 0xe8f4ff, 0xa0aab8, { fogNear: 80, fogFar: 380 }),
    beyond: [[snowPineP, 4, 1.1], [snowRockP, 3, 2], [iceP, 1, 1.4]],
    particles: { color: 0xffffff, kind: 'snow' },
  },
  titanplains: {
    look: {
      family: 'meadow',
      floor: [0xa2c852, 0xb6d266, 0x8ab444],
      soil: 0xcaa468,
      litter: 0x9a8448,
      rock: 0xa89e84,
      bank: 0xae8a52,
      cap: 0x8cbc48,
      liquid: W('puddles', 0x3ab0e0),
      tiers: T(3.6, 5, 8, 11, 13, 18),
      outer: 0x94b84a,
      accent: 0xffd23a,
    },
    air: air(0xe8ecd8, 0x4a92e0, 0xc4e0f4, 0xfff2d8, 2.2, 0xdceeff, 0x8a8a52, { fogNear: 200, fogFar: 700 }),
    beyond: [[araucariaP, 4, 1.5], [cycadP, 2, 1.4], [bushP, 2, 1.6]],
  },
  waterfall: {
    look: {
      family: 'river',
      floor: [0x52b458, 0x64c262, 0x3f9e48],
      soil: 0x9a8a6a,
      litter: 0x6a6a5a,
      rock: 0x7f8890,
      bank: 0x6a6a64,
      cap: 0x3fa844,
      liquid: W('river', 0x38b4ec),
      tiers: T(5, 7, 14, 18, 24, 30),
      outer: 0x3f9a44,
      accent: 0x6ad8ff,
    },
    air: air(0xc8dce0, 0x4a8ad0, 0xa8cce4, 0xfff0d8, 1.9, 0xc8e4ff, 0x4a5a44, { fogNear: 90, fogFar: 420 }),
    beyond: [[treeFernP, 3, 1.2], [giantP, 2, 1.3], [rocksP(0x6e7270), 3, 2.4]],
    particles: { color: 0xffffff, kind: 'mist' },
  },
  badlands: {
    look: {
      family: 'rocky',
      floor: [0xe0b084, 0xeac29a, 0xcc9a6c],
      soil: 0xf0d2a8,
      litter: 0xb07a52,
      rock: 0xc88a58,
      bank: 0xb87a4e,
      cap: null,
      liquid: null,
      tiers: T(5, 8, 13, 18, 22, 30),
      outer: 0xd8a478,
      accent: 0xffe08a,
    },
    air: air(0xf0dcc0, 0x5a96d0, 0xe4d0b8, 0xffecc8, 2.3, 0xffecd8, 0x9a6a4a),
    beyond: [[mesaP([0xc8905a, 0xe0b890, 0xa86a4a, 0xf0d8b8]), 3, 1.3], [spireP(0xc08a60), 3, 1.4], [skullP, 1, 2.4], [ribsP, 1, 2]],
  },
  petrified: {
    look: {
      family: 'rocky',
      floor: [0xa49e90, 0xb2ac9e, 0x8e887c],
      soil: 0xc8c0ae,
      litter: 0x7a746a,
      rock: 0x8a7e86,
      bank: 0x7a7068,
      cap: 0x7aa25a,
      liquid: null,
      tiers: T(4.5, 6, 11, 15, 18, 24),
      outer: 0x8a8478,
      accent: 0xc8a0ff,
    },
    air: air(0xd8d4e0, 0x6a8ad0, 0xc8c8e0, 0xfff0e0, 1.9, 0xe0e0f4, 0x7a7068),
    beyond: [[deadP(0x8a7e74), 4, 1.4], [crystalP(0xb898e8), 2, 1.6], [rocksP(0x7a7470), 2, 2]],
  },
  lagoon: {
    look: {
      family: 'beach',
      floor: [0xf4e2ae, 0xfaeec8, 0xe6d096],
      soil: 0xe0c890,
      litter: 0xc8b07a,
      rock: 0xcab690,
      bank: 0xd8c08a,
      cap: 0x5ab848,
      liquid: W('lagoon', 0x28d0d8),
      tiers: T(3.6, 5, 8, 11, 12, 16),
      outer: 0xeedcaa,
      accent: 0x3ae8e0,
    },
    air: air(0xd8f0f4, 0x3a9ae8, 0xb8e4f8, 0xfff8e8, 2.3, 0xe0f4ff, 0xb8a882, { fogNear: 180, fogFar: 640 }),
    beyond: [[palmP, 5, 1.3], [rocksP(0xb8a888), 2, 1.6]],
  },
  volcano: {
    look: {
      family: 'volcanic',
      floor: [0x5a4640, 0x6a524a, 0x4a3a34],
      soil: 0x3a2e2a,
      litter: 0x2a2220,
      rock: 0x46362f,
      bank: 0x32261f,
      cap: null,
      liquid: W('pools', 0xff5a1a, 'lava'),
      tiers: T(6, 8, 14, 18, 24, 32),
      outer: 0x3e302c,
      accent: 0xff5a1a,
    },
    air: air(0x7a4a3a, 0x3a2430, 0x8a5a4a, 0xff9a5a, 1.4, 0xff9a6a, 0x3a1a14, { fogNear: 70, fogFar: 360, ambient: 0.4 }),
    beyond: [[rocksP(0x3a2e2a), 4, 2.4], [spireP(0x2a2220), 2, 1.6], [deadP(0x2a2220), 1, 1]],
    particles: { color: 0xff8a3a, kind: 'embers' },
  },
  amber: {
    look: {
      family: 'jungle',
      floor: [0xc8b848, 0xd6c65a, 0xb09c3a],
      soil: 0xb07a3a,
      litter: 0x8a5a2a,
      rock: 0xa8784a,
      bank: 0x9a6a3a,
      cap: 0xa8c03e,
      liquid: W('pools', 0xffa82a, 'lava'),
      tiers: T(4, 6, 11, 15, 18, 24),
      outer: 0xa89a3a,
      accent: 0xffb02a,
    },
    air: air(0xf0d8a0, 0x7a9ac8, 0xf0d8a8, 0xffd890, 2.0, 0xffe8b8, 0x7a5a2a),
    beyond: [[araucariaP, 3, 1.2], [crystalP(0xffa82a, true), 2, 1.6], [treeFernP, 2, 1.1]],
    particles: { color: 0xffd070, kind: 'fireflies' },
  },
  facility: {
    look: {
      family: 'ruins',
      floor: [0x5fb24a, 0x70bc56, 0x4e9a3e],
      soil: 0xb8b0a0,
      litter: 0x6a6a5a,
      rock: 0xa8a296,
      bank: 0x8a8478,
      cap: 0x4caa40,
      liquid: W('puddles', 0x3aa8c8),
      tiers: T(4, 6, 10, 14, 16, 22),
      outer: 0x4a9a3e,
      accent: 0xffd23a,
    },
    air: air(0xc4d4c0, 0x5a86b8, 0xb0c4cc, 0xfff0d8, 1.8, 0xd0e0e8, 0x5a5a4a, { fogNear: 90, fogFar: 420 }),
    beyond: [[ruinP, 2, 1.3], [giantP, 2, 1.2], [treeFernP, 2, 1.1]],
  },
  paddocks: {
    look: {
      family: 'jungle',
      floor: [0x48b04a, 0x5cbe58, 0x36963e],
      soil: 0x9a6a3a,
      litter: 0x5a4a2a,
      rock: 0x7f8474,
      bank: 0x7a5a36,
      cap: 0x36a644,
      liquid: W('river', 0x2fb0d8),
      tiers: T(5, 7, 13, 17, 22, 28),
      outer: 0x2f8a3a,
      accent: 0xe84aa8,
    },
    air: air(0xc4d4c0, 0x5a8ac8, 0xb4d0dc, 0xfff0d8, 1.8, 0xd0e8ec, 0x5a6a4a),
    beyond: [[giantP, 4, 1.35], [treeFernP, 2, 1.2], [palmP, 1, 1.1], [leavesP, 2, 2.4]],
  },
  caldera: {
    look: {
      family: 'volcanic',
      floor: [0x3a302c, 0x483a34, 0x2c2420],
      soil: 0x2a2220,
      litter: 0x1e1816,
      rock: 0x332826,
      bank: 0x241c1a,
      cap: null,
      liquid: W('pools', 0xff4a0a, 'lava'),
      tiers: T(6, 9, 15, 20, 26, 34),
      outer: 0x2e2624,
      accent: 0xff3a1a,
    },
    air: air(0x5a2e26, 0x2a141a, 0x6a3a2e, 0xff7a3a, 1.3, 0xff8a5a, 0x2a0e0a, { fogNear: 60, fogFar: 320, ambient: 0.35 }),
    beyond: [[spireP(0x221c1a), 3, 1.8], [rocksP(0x2e2826), 3, 2.6]],
    particles: { color: 0xff6a2a, kind: 'embers' },
  },
  storm: {
    look: {
      family: 'rocky',
      floor: [0x5e8a56, 0x6e9862, 0x4e7648],
      soil: 0x8a8a7a,
      litter: 0x5a5a52,
      rock: 0x626a70,
      bank: 0x5a5e62,
      cap: 0x4e8a46,
      liquid: W('puddles', 0x4a8ab0),
      tiers: T(6, 8, 15, 20, 26, 34),
      outer: 0x4e7a48,
      accent: 0x8ab8ff,
    },
    air: air(0x5a6470, 0x2a3440, 0x6a7482, 0xb8c8e0, 1.1, 0x8a9aae, 0x2a302a, { fogNear: 60, fogFar: 340, ambient: 0.38 }),
    beyond: [[araucariaP, 3, 1.1], [rocksP(0x4e5456), 3, 2.4], [spireP(0x565c60), 2, 1.8]],
    particles: { color: 0xc8d4e4, kind: 'rain' },
  },
  nightjungle: {
    look: {
      family: 'jungle',
      floor: [0x2e6a44, 0x3a7a4e, 0x245a3a],
      soil: 0x4a3a2a,
      litter: 0x2a2a20,
      rock: 0x4a5058,
      bank: 0x3a3228,
      cap: 0x2a7a44,
      liquid: W('puddles', 0x2a6aa8),
      tiers: T(4, 6, 12, 16, 20, 26),
      outer: 0x1e4a30,
      accent: 0x6affd8,
    },
    air: air(0x1a2438, 0x0a1022, 0x1e2a44, 0x8aa8ff, 0.7, 0x4a5a8a, 0x0a120e, { fogNear: 50, fogFar: 280, ambient: 0.32, hemiIntensity: 0.8 }),
    beyond: [[giantP, 3, 1.3], [treeFernP, 3, 1.3], [shroomP(0x6affd8), 2, 2]],
    particles: { color: 0x9aff8a, kind: 'fireflies' },
  },
  glacier: {
    look: {
      family: 'frozen',
      floor: [0xdcecf8, 0xeaf4fc, 0xc4dcee],
      soil: 0xb8d4ec,
      litter: 0xa0bcd4,
      rock: 0x9ab8d4,
      bank: 0x8aa8c4,
      cap: 0xf8fcff,
      liquid: W('pools', 0x7ac8f0, 'ice'),
      tiers: T(5, 7, 13, 17, 22, 30),
      outer: 0xd8e8f4,
      accent: 0x6ad0ff,
    },
    air: air(0xd8e8f4, 0x5a8ac8, 0xc8dcf0, 0xe8f0ff, 1.9, 0xe4f0ff, 0x8aa0b8, { fogNear: 70, fogFar: 360 }),
    beyond: [[iceP, 4, 2.4], [snowRockP, 2, 2.2], [snowPineP, 1, 0.9]],
    particles: { color: 0xffffff, kind: 'snow' },
  },
  meteor: {
    look: {
      family: 'volcanic',
      floor: [0x4a4a42, 0x58584e, 0x3a3a34],
      soil: 0x2e2e2a,
      litter: 0x222220,
      rock: 0x46443e,
      bank: 0x33322e,
      cap: null,
      liquid: W('veins', 0x4aff7a, 'lava'),
      tiers: T(5, 7, 13, 17, 22, 30),
      outer: 0x3a3a34,
      accent: 0x4aff7a,
    },
    air: air(0x3a4a3a, 0x1a2420, 0x4a5a48, 0xc8ffb0, 1.2, 0x8aaa8a, 0x1a2218, { fogNear: 60, fogFar: 320, ambient: 0.36 }),
    beyond: [[crystalP(0x4aff7a, true), 3, 2], [rocksP(0x3e3c38), 3, 2.4], [deadP(0x2a2a26), 1, 1]],
    particles: { color: 0x8aff9a, kind: 'embers' },
  },
  summit: {
    look: {
      family: 'rocky',
      floor: [0x8a9a6a, 0x9aa878, 0x7a8a5e],
      soil: 0xb0a48a,
      litter: 0x7a7060,
      rock: 0x857a6c,
      bank: 0x6e6456,
      cap: 0x5a9a44,
      liquid: null,
      tiers: T(6, 9, 16, 20, 26, 34),
      outer: 0x7a8a60,
      accent: 0xffd23a,
    },
    air: air(0xe8c8b0, 0x3a5ab0, 0xe8b8a0, 0xffc890, 1.8, 0xffd8c0, 0x5a4a3a, { fogNear: 140, fogFar: 600 }),
    beyond: [[araucariaP, 2, 1.2], [rocksP(0x6a6258), 3, 2.6], [spireP(0x5a5248), 2, 1.6]],
    particles: { color: 0xffc890, kind: 'embers' },
  },
};

/** Choose from a weighted table. */
export const weighted = <T>(r: Rand, table: readonly (readonly [T, number, number])[]): readonly [T, number, number] => {
  const total = table.reduce((sum, entry) => sum + entry[1], 0);
  let at = r() * total;
  for (const entry of table) {
    if (at < entry[1]) return entry;
    at -= entry[1];
  }
  return table[table.length - 1]!;
};

