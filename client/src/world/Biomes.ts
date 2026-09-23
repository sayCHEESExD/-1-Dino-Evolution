import type { StageTheme } from '@dino/shared';
import type { PartBuilder } from '../render/PartBuilder.js';
import {
  araucaria,
  boulders,
  bush,
  crystals,
  cycad,
  deadTree,
  fern,
  glowShrooms,
  grassTuft,
  horsetails,
  mangrove,
  mesa,
  palm,
  redwood,
  rock,
  spire,
  treeFern,
  type Rand,
} from './Nature.js';
import { bonePile, crates, electricFence, fossilSlab, hut, jeep, ribcage, skull, torch } from './ParkProps.js';
import type { GroundStyle } from './WorldTextures.js';

/**
 * THE BIOMES: what each stage looks like and how it FEELS - its ground, the
 * rock of its walls, what grows (and lies dead) in and around it, and its
 * atmosphere: fog, sky, the colour and strength of the sun. The road runs from
 * a sunny fern meadow through rivers, swamps, canyons, redwoods, deserts, tar,
 * ash, geysers, tundra, falls, badlands, lagoons, volcanoes, an overgrown
 * research site and a moonlit jungle to the island's summit.
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

export interface Biome {
  readonly ground: GroundStyle;
  readonly outer: GroundStyle;
  readonly cliff: number;
  readonly cliffCap: number | null;
  readonly accent: number;
  readonly air: Atmosphere;
  /** Big scenery beyond the walls: [placer, weight, scale]. */
  readonly beyond: readonly (readonly [Placer, number, number])[];
  /** What fills the six foreground prop clusters (on their solids). */
  readonly cluster: readonly (readonly [Placer, number, number])[];
  /** Low, non-solid dressing on the arena floor, kept to the edges. */
  readonly scatter: readonly (readonly [Placer, number, number])[];
  /** Sheets of water, mud, tar or lava laid flat on the floor (decals, never solid). */
  readonly pools?: { readonly color: number; readonly glow: boolean; readonly count: number; readonly size: number };
  /** Particles in the air: snow, ash, embers, mist, fireflies. */
  readonly particles?: { readonly color: number; readonly kind: 'snow' | 'ash' | 'embers' | 'mist' | 'fireflies' | 'rain' | 'spores' };
}

const g = (base: string, dark: string, light: string, detail: GroundStyle['detail'], density = 1, seed = 1): GroundStyle => ({ base, dark, light, detail, density, seed });

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

// ------------------------------------------------------------- placers

const fernP: Placer = (b, r, x, y, z, s) => fern(b, r, x, y, z, s);
const treeFernP: Placer = (b, r, x, y, z, s) => treeFern(b, r, x, y, z, s);
const cycadP: Placer = (b, r, x, y, z, s) => cycad(b, r, x, y, z, s);
const palmP: Placer = (b, r, x, y, z, s) => palm(b, r, x, y, z, s);
const araucariaP: Placer = (b, r, x, y, z, s) => araucaria(b, r, x, y, z, s);
const redwoodP: Placer = (b, r, x, y, z, s) => redwood(b, r, x, y, z, s);
const horsetailP: Placer = (b, r, x, y, z, s) => horsetails(b, r, x, y, z, s);
const bushP: Placer = (b, r, x, y, z, s) => bush(b, r, x, y, z, s, 3);
const bareBushP: Placer = (b, r, x, y, z, s) => bush(b, r, x, y, z, s, 0);
const mangroveP: Placer = (b, r, x, y, z, s) => mangrove(b, r, x, y, z, s);
const rocksP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    boulders(b, r, x, y, z, s, color);
const rockP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    rock(b, r, x, y, z, s, color);
const deadP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    deadTree(b, r, x, y, z, s, color);
const grassP =
  (color: number): Placer =>
  (b, r, x, y, z, s) =>
    grassTuft(b, r, x, y, z, s, color);
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
const skullP: Placer = (b, r, x, _y, z, s) => skull(b, r, x, z, s * 0.9, r() * 6);
const ribsP: Placer = (b, r, x, _y, z, s) => ribcage(b, r, x, z, s * 0.6, r() * 6);
const bonesP: Placer = (b, r, x, _y, z, s) => bonePile(b, r, x, z, s);
const fossilP: Placer = (b, r, x, _y, z, s) => fossilSlab(b, r, x, z, s, r() * 6);
const cratesP: Placer = (b, r, x, _y, z, s) => crates(b, r, x, z, s);
const jeepP: Placer = (b, r, x, _y, z, s) => jeep(b, x, z, r() * 6, s * 0.9, r() < 0.5 ? 0x6a7a44 : 0x8a4a34);
const hutP: Placer = (b, r, x, _y, z, s) => hut(b, r, x, z, s * 0.9, r() * 6);
const torchP: Placer = (b, _r, x, _y, z) => torch(b, x, z, 4);
const fenceP: Placer = (b, r, x, _y, z, s) => {
  const a = r() * Math.PI;
  const half = s * 5;
  electricFence(b, x - Math.cos(a) * half, z - Math.sin(a) * half, x + Math.cos(a) * half, z + Math.sin(a) * half, s * 4, false);
};
const iceP: Placer = (b, r, x, y, z, s) => crystals(b, r, x, y, z, s * 1.4, 0xcfeaff);
const snowRockP: Placer = (b, r, x, y, z, s) => {
  boulders(b, r, x, y, z, s, 0x9aa4b0);
  rock(b, r, x, y + s * 0.8, z, s * 0.9, 0xf4f8fc);
};
const snowPineP: Placer = (b, r, x, y, z, s) => araucaria(b, r, x, y, z, s * 0.8);

// ------------------------------------------------------------- the table

const LUSH: readonly (readonly [Placer, number, number])[] = [
  [treeFernP, 3, 1],
  [cycadP, 2, 1.2],
  [araucariaP, 2, 1],
  [bushP, 2, 1.4],
  [fernP, 3, 2],
];

export const BIOMES: Readonly<Record<StageTheme | 'park', Biome>> = {
  park: {
    ground: g('#5f8f3a', '#4a7a2c', '#78a848', 'blades', 1.2, 3),
    outer: g('#557f34', '#446a28', '#6a9a42', 'blades', 1, 4),
    cliff: 0x8a7e6a,
    cliffCap: 0x4f8030,
    accent: 0xffc23a,
    air: air(0xcfe8ff, 0x3f9bf0, 0xa2d6ff, 0xfff6e4, 2.2, 0xdcefff, 0x8aa070, { fogNear: 220, fogFar: 760 }),
    beyond: LUSH,
    cluster: [[rocksP(0x8a8478), 1, 1.3]],
    scatter: [[fernP, 2, 1.2], [grassP(0x6a9a3a), 3, 1]],
  },
  meadow: {
    ground: g('#6a9a3e', '#557f30', '#86b452', 'blades', 1.3, 11),
    outer: g('#5a8a36', '#4a722c', '#72a44a', 'blades', 1, 12),
    cliff: 0x9a8e74,
    cliffCap: 0x5a9036,
    accent: 0xffd23a,
    air: air(0xd8ecd8, 0x4a9ae8, 0xb0dcf8, 0xfff4dc, 2.1, 0xcfeaff, 0x7a8a52),
    beyond: [[cycadP, 3, 1.3], [treeFernP, 2, 1], [bushP, 3, 1.6], [araucariaP, 1, 0.9]],
    cluster: [[rocksP(0x9a8e74), 2, 1.2], [bushP, 2, 1.5], [fernP, 2, 2]],
    scatter: [[grassP(0x6a9a3a), 5, 1.2], [bushP, 1, 0.7], [rockP(0x9a8e74), 1, 0.5]],
  },
  grassland: {
    ground: g('#8a9a4a', '#6f7e3a', '#a6b060', 'blades', 1.6, 21),
    outer: g('#7e8e44', '#667236', '#96a456', 'blades', 1.4, 22),
    cliff: 0x9a8a70,
    cliffCap: 0x7e8e44,
    accent: 0xff5a2a,
    air: air(0xe8e4c8, 0x5a9ed8, 0xc4dcee, 0xfff0c8, 2.1, 0xe0ecff, 0x8a8a52),
    beyond: [[araucariaP, 2, 1], [bareBushP, 3, 1.4], [fenceP, 2, 1]],
    cluster: [[rocksP(0x9a8a70), 2, 1.1], [fenceP, 1, 0.7], [cratesP, 1, 1]],
    scatter: [[grassP(0xa0a852), 6, 1.4], [rockP(0x9a8a70), 1, 0.4]],
  },
  river: {
    ground: g('#7a8a5a', '#626e48', '#94a270', 'pebbles', 1.4, 31),
    outer: g('#5e8a3a', '#4c7430', '#72a04a', 'blades', 1, 32),
    cliff: 0x8a8272,
    cliffCap: 0x4f8030,
    accent: 0x3fc8ff,
    air: air(0xd4e8e4, 0x4a9ad8, 0xacd6ec, 0xfff0d8, 2.0, 0xc8e6ff, 0x6a7a5a),
    beyond: [[treeFernP, 3, 1.1], [horsetailP, 2, 1.5], [palmP, 2, 1], [fernP, 2, 2]],
    cluster: [[rocksP(0x8a8272), 3, 1.2], [horsetailP, 2, 1.4]],
    scatter: [[horsetailP, 2, 0.9], [rockP(0x8a8272), 3, 0.6], [fernP, 2, 1]],
    pools: { color: 0x3a8ab8, glow: false, count: 5, size: 9 },
    particles: { color: 0xffffff, kind: 'mist' },
  },
  swamp: {
    ground: g('#4e5a36', '#3a4428', '#62704a', 'blades', 0.9, 41),
    outer: g('#445030', '#343e24', '#586444', 'none', 1, 42),
    cliff: 0x5e5e4a,
    cliffCap: 0x3e5a2a,
    accent: 0xb8ff4a,
    air: air(0x8a9a78, 0x5a7a6a, 0x9aaa8a, 0xe8e8c0, 1.4, 0xa8b89a, 0x3a4a2a, { fogNear: 60, fogFar: 330, ambient: 0.4 }),
    beyond: [[mangroveP, 3, 1.2], [deadP(0x5a5040), 2, 1], [horsetailP, 2, 1.6], [treeFernP, 1, 1]],
    cluster: [[mangroveP, 2, 0.8], [deadP(0x5a5040), 1, 0.8], [rocksP(0x5e5e4a), 1, 1]],
    scatter: [[horsetailP, 3, 1], [fernP, 2, 1], [deadP(0x5a5040), 1, 0.5]],
    pools: { color: 0x3a9a7a, glow: false, count: 7, size: 10 },
    particles: { color: 0xc8d8a0, kind: 'spores' },
  },
  jungle: {
    ground: g('#3e5a2a', '#2e4620', '#52723a', 'blades', 1.2, 51),
    outer: g('#34502a', '#263e1e', '#466638', 'blades', 1, 52),
    cliff: 0x6a6a52,
    cliffCap: 0x2e5a22,
    accent: 0x7dff5a,
    air: air(0x9ab88a, 0x4a8a6a, 0x9ac8a8, 0xfff0c0, 1.6, 0xb8dcb8, 0x2a4a22, { fogNear: 80, fogFar: 380 }),
    beyond: [[treeFernP, 4, 1.3], [palmP, 2, 1.1], [araucariaP, 2, 1.2], [fernP, 3, 2.4]],
    cluster: [[treeFernP, 2, 0.9], [fernP, 3, 2], [rocksP(0x6a6a52), 1, 1]],
    scatter: [[fernP, 5, 1.4], [bushP, 1, 1]],
    particles: { color: 0xd0f0a0, kind: 'mist' },
  },
  canyon: {
    ground: g('#b8784a', '#9a5e38', '#d08e5e', 'pebbles', 1.2, 61),
    outer: g('#a8683e', '#8a5232', '#c07c50', 'cracks', 1, 62),
    cliff: 0xb0643e,
    cliffCap: null,
    accent: 0xffa23a,
    air: air(0xf0d0b0, 0x5a96d8, 0xe0c8a8, 0xffe8c0, 2.3, 0xffe0c0, 0x9a5a3a),
    beyond: [[mesaP([0xb86a44, 0xc8845a, 0xa85a3a]), 3, 1.4], [spireP(0xb0643e), 2, 1.3], [deadP(0x8a6a4a), 1, 1]],
    cluster: [[rocksP(0xb0643e), 3, 1.4], [deadP(0x8a6a4a), 1, 0.7]],
    scatter: [[rockP(0xb0643e), 4, 0.7], [bareBushP, 1, 0.6]],
  },
  redwood: {
    ground: g('#5a4a32', '#443826', '#6e5a3e', 'pebbles', 0.8, 71),
    outer: g('#4a4028', '#3a3220', '#5a4e34', 'none', 1, 72),
    cliff: 0x6a5e4a,
    cliffCap: 0x2e4a24,
    accent: 0xff8a3a,
    air: air(0xa8b8a0, 0x5a8ac8, 0xa8c4c8, 0xffe0b0, 1.7, 0xb8d0c0, 0x4a3a28, { fogNear: 90, fogFar: 420 }),
    beyond: [[redwoodP, 4, 1.1], [treeFernP, 2, 1.2], [fernP, 3, 2.4]],
    cluster: [[fernP, 3, 2.2], [rocksP(0x6a5e4a), 1, 1.2], [treeFernP, 1, 0.8]],
    scatter: [[fernP, 4, 1.3], [rockP(0x6a5e4a), 1, 0.5]],
    particles: { color: 0xffe0a0, kind: 'mist' },
  },
  cycad: {
    ground: g('#7a8a42', '#626e34', '#96a456', 'blades', 1.1, 81),
    outer: g('#6e7e3c', '#586430', '#869650', 'blades', 1, 82),
    cliff: 0xa09078,
    cliffCap: 0x6a8a3a,
    accent: 0xff7a3a,
    air: air(0xe4e8c8, 0x5aa0e0, 0xbcdcf0, 0xfff2d0, 2.1, 0xd8ecff, 0x7a8a4a),
    beyond: [[cycadP, 5, 1.6], [horsetailP, 2, 1.6], [araucariaP, 1, 1]],
    cluster: [[cycadP, 3, 1.1], [rocksP(0xa09078), 1, 1]],
    scatter: [[cycadP, 2, 0.6], [grassP(0x8a9a4a), 3, 1]],
  },
  highland: {
    ground: g('#6e8a4a', '#58703a', '#86a45e', 'blades', 1, 91),
    outer: g('#627a42', '#4e6436', '#789454', 'blades', 1, 92),
    cliff: 0x7e7e78,
    cliffCap: 0x5a7a3a,
    accent: 0xffc23a,
    air: air(0xd8e4e8, 0x3a86d8, 0xb4d4f0, 0xfff4e0, 2.2, 0xd8ecff, 0x6a7a5a, { fogNear: 180, fogFar: 640 }),
    beyond: [[araucariaP, 3, 1.1], [rocksP(0x7e7e78), 3, 2.2], [bareBushP, 2, 1.4]],
    cluster: [[rocksP(0x7e7e78), 3, 1.5], [bareBushP, 1, 1]],
    scatter: [[rockP(0x7e7e78), 3, 0.6], [grassP(0x7a9a4e), 3, 1]],
  },
  desert: {
    ground: g('#e0b878', '#c89a5a', '#f0cc90', 'ripples', 1.2, 101),
    outer: g('#d8ac6a', '#c09252', '#ecc488', 'ripples', 1, 102),
    cliff: 0xc89a62,
    cliffCap: null,
    accent: 0xff8a2a,
    air: air(0xf4e0b8, 0x4a90d8, 0xf0dcb8, 0xfff0c8, 2.5, 0xfff0d8, 0xb08a52, { fogNear: 170, fogFar: 600 }),
    beyond: [[mesaP([0xd8a46a, 0xe8b87a, 0xc8905a]), 2, 1.2], [deadP(0xb8a488), 2, 1.1], [skullP, 1, 2.2], [ribsP, 1, 1.6]],
    cluster: [[rocksP(0xc89a62), 2, 1.2], [skullP, 1, 1.2], [deadP(0xb8a488), 1, 0.7]],
    scatter: [[bonesP, 2, 0.8], [rockP(0xc89a62), 2, 0.5]],
    particles: { color: 0xf0d8a8, kind: 'ash' },
  },
  tarpit: {
    ground: g('#4a4034', '#34302a', '#5e5444', 'cracks', 1, 111),
    outer: g('#3e3830', '#2c2824', '#524a3e', 'cracks', 1, 112),
    cliff: 0x5a5448,
    cliffCap: 0x3a4a2a,
    accent: 0xff9a3a,
    air: air(0xa89c8a, 0x6a88a8, 0xb0a898, 0xffe0b0, 1.6, 0xc8c0b0, 0x3a3228, { fogNear: 90, fogFar: 420 }),
    beyond: [[deadP(0x4a4238), 3, 1.1], [ribsP, 2, 1.6], [horsetailP, 1, 1.2]],
    cluster: [[rocksP(0x5a5448), 2, 1.2], [skullP, 1, 1], [ribsP, 1, 0.7]],
    scatter: [[bonesP, 3, 0.8], [rockP(0x5a5448), 1, 0.5]],
    pools: { color: 0x0e0c0a, glow: false, count: 6, size: 9 },
  },
  mangrove: {
    ground: g('#b8a878', '#9a8a5e', '#cebe8e', 'ripples', 1, 121),
    outer: g('#7a8a5a', '#627048', '#92a06e', 'blades', 1, 122),
    cliff: 0x8a8070,
    cliffCap: 0x4a7a3a,
    accent: 0x3ae0d0,
    air: air(0xd0e0d8, 0x4aa0d8, 0xb8dcec, 0xfff0d0, 2.0, 0xd0ecff, 0x7a7a5a),
    beyond: [[mangroveP, 4, 1.3], [palmP, 3, 1.2], [horsetailP, 1, 1.4]],
    cluster: [[mangroveP, 2, 0.8], [rocksP(0x8a8070), 1, 1]],
    scatter: [[horsetailP, 2, 0.8], [rockP(0x8a8070), 1, 0.5]],
    pools: { color: 0x2a8a9a, glow: false, count: 6, size: 11 },
  },
  ash: {
    ground: g('#6a6664', '#524e4c', '#82807c', 'speckle', 1.4, 131),
    outer: g('#5e5a58', '#484442', '#747270', 'cracks', 1, 132),
    cliff: 0x4a4644,
    cliffCap: null,
    accent: 0xff6a2a,
    air: air(0x8a8480, 0x5a5a64, 0x9a9290, 0xffc890, 1.3, 0xb0a8a0, 0x3a3432, { fogNear: 70, fogFar: 340, ambient: 0.35 }),
    beyond: [[deadP(0x3a3634), 4, 1.2], [rocksP(0x4a4644), 2, 2]],
    cluster: [[rocksP(0x4a4644), 2, 1.2], [deadP(0x3a3634), 2, 0.8]],
    scatter: [[rockP(0x4a4644), 3, 0.5], [deadP(0x3a3634), 1, 0.4]],
    particles: { color: 0xc8c0b8, kind: 'ash' },
  },
  geyser: {
    ground: g('#c8b890', '#b09a6e', '#e0d4ae', 'cracks', 1, 141),
    outer: g('#a89a78', '#8e8062', '#c0b28e', 'speckle', 1, 142),
    cliff: 0xc0b098,
    cliffCap: 0x7a9a4a,
    accent: 0x4ad8ff,
    air: air(0xe0e4e0, 0x5a9ad8, 0xc8dce8, 0xfff4e0, 2.0, 0xe4f0ff, 0x9a8a6a, { fogNear: 110, fogFar: 460 }),
    beyond: [[crystalP(0xe8d8a8), 2, 1.4], [rocksP(0xc0b098), 3, 1.8], [deadP(0xd8ccb0), 1, 1]],
    cluster: [[rocksP(0xc0b098), 3, 1.2], [crystalP(0xe8d8a8), 1, 0.8]],
    scatter: [[rockP(0xc0b098), 2, 0.5]],
    pools: { color: 0x3ab8d8, glow: false, count: 5, size: 7 },
    particles: { color: 0xffffff, kind: 'mist' },
  },
  tundra: {
    ground: g('#e8eef4', '#c8d4e0', '#ffffff', 'speckle', 0.8, 151),
    outer: g('#dce6ee', '#bccad6', '#f4f8fc', 'speckle', 1, 152),
    cliff: 0x8a96a4,
    cliffCap: 0xf4f8fc,
    accent: 0x7ad8ff,
    air: air(0xe8f0f8, 0x6a9ad0, 0xd8e8f4, 0xf0f4ff, 1.8, 0xe8f4ff, 0xa0aab8, { fogNear: 80, fogFar: 380 }),
    beyond: [[snowPineP, 4, 1.1], [snowRockP, 3, 2], [iceP, 1, 1.4]],
    cluster: [[snowRockP, 3, 1.1], [iceP, 1, 0.8]],
    scatter: [[snowRockP, 2, 0.4], [iceP, 1, 0.4]],
    particles: { color: 0xffffff, kind: 'snow' },
  },
  titanplains: {
    ground: g('#9aa258', '#808a46', '#b2b870', 'blades', 1.4, 161),
    outer: g('#8a9450', '#727c40', '#a2aa62', 'blades', 1.2, 162),
    cliff: 0x9a9078,
    cliffCap: 0x7a8a44,
    accent: 0xffd23a,
    air: air(0xe8ecd8, 0x4a92e0, 0xc4e0f4, 0xfff2d8, 2.2, 0xdceeff, 0x8a8a52, { fogNear: 200, fogFar: 700 }),
    beyond: [[araucariaP, 3, 1.4], [cycadP, 2, 1.4], [bareBushP, 2, 1.6]],
    cluster: [[rocksP(0x9a9078), 2, 1.4], [bushP, 1, 1.4]],
    scatter: [[grassP(0xa0a852), 5, 1.4]],
  },
  waterfall: {
    ground: g('#5a6e4a', '#46583a', '#6e845a', 'pebbles', 1.2, 171),
    outer: g('#4e6a3e', '#3c5430', '#628050', 'blades', 1, 172),
    cliff: 0x6e7270,
    cliffCap: 0x3e6a30,
    accent: 0x6ad8ff,
    air: air(0xc8dce0, 0x4a8ad0, 0xa8cce4, 0xfff0d8, 1.9, 0xc8e4ff, 0x4a5a44, { fogNear: 90, fogFar: 420 }),
    beyond: [[treeFernP, 3, 1.2], [rocksP(0x6e7270), 3, 2.4], [fernP, 2, 2.4]],
    cluster: [[rocksP(0x6e7270), 3, 1.4], [fernP, 2, 1.8]],
    scatter: [[rockP(0x6e7270), 3, 0.6], [fernP, 2, 1]],
    pools: { color: 0x4a9ac8, glow: false, count: 5, size: 8 },
    particles: { color: 0xffffff, kind: 'mist' },
  },
  badlands: {
    ground: g('#c8a078', '#a88058', '#dcb890', 'cracks', 1.2, 181),
    outer: g('#b88e68', '#9a724e', '#d0a680', 'cracks', 1, 182),
    cliff: 0xc08a60,
    cliffCap: null,
    accent: 0xffe08a,
    air: air(0xf0dcc0, 0x5a96d0, 0xe4d0b8, 0xffecc8, 2.3, 0xffecd8, 0x9a6a4a),
    beyond: [[mesaP([0xc8905a, 0xe0b890, 0xa86a4a, 0xf0d8b8]), 3, 1.3], [spireP(0xc08a60), 3, 1.4], [skullP, 1, 2.4]],
    cluster: [[fossilP, 1, 1.2], [ribsP, 1, 0.8], [rocksP(0xc08a60), 2, 1.2]],
    scatter: [[bonesP, 3, 0.9], [fossilP, 1, 0.6]],
  },
  petrified: {
    ground: g('#8a8478', '#6e6a60', '#a49e90', 'pebbles', 1, 191),
    outer: g('#7e786c', '#645e54', '#968e82', 'speckle', 1, 192),
    cliff: 0x7a7470,
    cliffCap: 0x6a7a4a,
    accent: 0xc8a0ff,
    air: air(0xd8d4e0, 0x6a8ad0, 0xc8c8e0, 0xfff0e0, 1.9, 0xe0e0f4, 0x7a7068),
    beyond: [[deadP(0x8a7e74), 4, 1.3], [crystalP(0xb898e8), 2, 1.6], [rocksP(0x7a7470), 2, 2]],
    cluster: [[deadP(0x8a7e74), 2, 0.8], [crystalP(0xb898e8), 1, 1], [rocksP(0x7a7470), 1, 1]],
    scatter: [[rockP(0x7a7470), 2, 0.5], [crystalP(0xb898e8), 1, 0.4]],
  },
  lagoon: {
    ground: g('#f0dcaa', '#d8c08c', '#fff0c8', 'ripples', 1, 201),
    outer: g('#e8d4a2', '#d0b886', '#f8e8c0', 'ripples', 1, 202),
    cliff: 0xb8a888,
    cliffCap: 0x5a9a3a,
    accent: 0x3ae8e0,
    air: air(0xd8f0f4, 0x3a9ae8, 0xb8e4f8, 0xfff8e8, 2.3, 0xe0f4ff, 0xb8a882, { fogNear: 180, fogFar: 640 }),
    beyond: [[palmP, 5, 1.3], [rocksP(0xb8a888), 2, 1.6]],
    cluster: [[palmP, 2, 0.7], [rocksP(0xb8a888), 2, 1.1]],
    scatter: [[rockP(0xb8a888), 2, 0.4]],
    pools: { color: 0x3ac8d0, glow: false, count: 6, size: 12 },
  },
  volcano: {
    ground: g('#3e302c', '#2a201e', '#524038', 'cracks', 1.4, 211),
    outer: g('#342826', '#221a18', '#463632', 'cracks', 1, 212),
    cliff: 0x3a2e2a,
    cliffCap: null,
    accent: 0xff5a1a,
    air: air(0x7a4a3a, 0x3a2430, 0x8a5a4a, 0xff9a5a, 1.4, 0xff9a6a, 0x3a1a14, { fogNear: 70, fogFar: 360, ambient: 0.4 }),
    beyond: [[rocksP(0x3a2e2a), 4, 2.4], [spireP(0x2a2220), 2, 1.6], [deadP(0x2a2220), 1, 1]],
    cluster: [[rocksP(0x3a2e2a), 3, 1.3]],
    scatter: [[rockP(0x3a2e2a), 3, 0.6]],
    pools: { color: 0xff5a1a, glow: true, count: 6, size: 7 },
    particles: { color: 0xff8a3a, kind: 'embers' },
  },
  amber: {
    ground: g('#9a7a3a', '#7e622c', '#b8944e', 'blades', 1, 221),
    outer: g('#8a6c32', '#705828', '#a68446', 'blades', 1, 222),
    cliff: 0x8a6a3a,
    cliffCap: 0x7a8a2a,
    accent: 0xffb02a,
    air: air(0xf0d8a0, 0x7a9ac8, 0xf0d8a8, 0xffd890, 2.0, 0xffe8b8, 0x7a5a2a),
    beyond: [[araucariaP, 3, 1.2], [crystalP(0xffa82a, true), 2, 1.6], [treeFernP, 2, 1.1]],
    cluster: [[crystalP(0xffa82a, true), 2, 1], [rocksP(0x8a6a3a), 1, 1]],
    scatter: [[crystalP(0xffa82a), 1, 0.4], [fernP, 2, 1]],
    particles: { color: 0xffd070, kind: 'fireflies' },
  },
  facility: {
    ground: g('#6e7268', '#585c54', '#868a80', 'cracks', 1, 231),
    outer: g('#4e6a3a', '#3e5430', '#5e7e48', 'blades', 1, 232),
    cliff: 0x7a7c78,
    cliffCap: 0x3e6a2e,
    accent: 0xff3a2a,
    air: air(0xb8c4bc, 0x5a86b8, 0xb0c4cc, 0xfff0d8, 1.7, 0xd0e0e8, 0x5a5a4a, { fogNear: 90, fogFar: 420 }),
    beyond: [[fenceP, 3, 1.4], [hutP, 1, 1.4], [treeFernP, 2, 1.1], [cratesP, 1, 1.4]],
    cluster: [[cratesP, 2, 1.1], [jeepP, 1, 0.9], [torchP, 1, 1]],
    scatter: [[cratesP, 1, 0.6], [fernP, 2, 1]],
  },
  paddocks: {
    ground: g('#5a7a3a', '#48622e', '#6e924a', 'blades', 1.3, 241),
    outer: g('#4e6e34', '#3e582a', '#628444', 'blades', 1, 242),
    cliff: 0x7a7470,
    cliffCap: 0x3e6a2e,
    accent: 0xffc23a,
    air: air(0xc4d4c0, 0x5a8ac8, 0xb4d0dc, 0xfff0d8, 1.8, 0xd0e8ec, 0x5a6a4a),
    beyond: [[fenceP, 4, 1.6], [treeFernP, 2, 1.2], [palmP, 1, 1.1], [jeepP, 1, 1.2]],
    cluster: [[fenceP, 1, 0.8], [jeepP, 1, 0.9], [treeFernP, 1, 0.8]],
    scatter: [[fernP, 3, 1.2], [grassP(0x6a9a3a), 3, 1.2]],
  },
  caldera: {
    ground: g('#2e2826', '#1e1a18', '#443a36', 'cracks', 1.6, 251),
    outer: g('#2a2422', '#1a1614', '#3e3432', 'cracks', 1, 252),
    cliff: 0x2e2826,
    cliffCap: null,
    accent: 0xff3a1a,
    air: air(0x5a2e26, 0x2a141a, 0x6a3a2e, 0xff7a3a, 1.3, 0xff8a5a, 0x2a0e0a, { fogNear: 60, fogFar: 320, ambient: 0.35 }),
    beyond: [[spireP(0x221c1a), 3, 1.8], [rocksP(0x2e2826), 3, 2.6]],
    cluster: [[rocksP(0x2e2826), 3, 1.3], [crystalP(0x2a1a2e), 1, 1]],
    scatter: [[rockP(0x2e2826), 3, 0.6]],
    pools: { color: 0xff4a0a, glow: true, count: 8, size: 8 },
    particles: { color: 0xff6a2a, kind: 'embers' },
  },
  storm: {
    ground: g('#4e5a4e', '#3a463c', '#626e62', 'blades', 1, 261),
    outer: g('#46524a', '#343e38', '#5a665e', 'blades', 1, 262),
    cliff: 0x4e5456,
    cliffCap: 0x3a4a36,
    accent: 0x8ab8ff,
    air: air(0x5a6470, 0x2a3440, 0x6a7482, 0xb8c8e0, 1.1, 0x8a9aae, 0x2a302a, { fogNear: 60, fogFar: 340, ambient: 0.38 }),
    beyond: [[araucariaP, 3, 1.1], [rocksP(0x4e5456), 3, 2.4], [deadP(0x3a3e3a), 1, 1]],
    cluster: [[rocksP(0x4e5456), 3, 1.3]],
    scatter: [[rockP(0x4e5456), 3, 0.6], [grassP(0x4a5a44), 2, 1]],
    particles: { color: 0xc8d4e4, kind: 'rain' },
  },
  nightjungle: {
    ground: g('#243424', '#18241a', '#34483a', 'blades', 1, 271),
    outer: g('#1e2e20', '#141e16', '#2c3e2e', 'blades', 1, 272),
    cliff: 0x3a3e40,
    cliffCap: 0x1e3420,
    accent: 0x6affd8,
    air: air(0x1a2438, 0x0a1022, 0x1e2a44, 0x8aa8ff, 0.7, 0x4a5a8a, 0x0a120e, { fogNear: 50, fogFar: 280, ambient: 0.32, hemiIntensity: 0.8 }),
    beyond: [[treeFernP, 4, 1.3], [shroomP(0x6affd8), 2, 2], [palmP, 1, 1.1]],
    cluster: [[shroomP(0x6affd8), 2, 1.6], [treeFernP, 1, 0.8], [shroomP(0xc86aff), 1, 1.4]],
    scatter: [[shroomP(0x6affd8), 2, 0.7], [fernP, 3, 1.2]],
    particles: { color: 0x9aff8a, kind: 'fireflies' },
  },
  glacier: {
    ground: g('#d8e8f4', '#b0c8dc', '#f4faff', 'cracks', 0.6, 281),
    outer: g('#d0e0ee', '#aac0d4', '#eef6fc', 'speckle', 1, 282),
    cliff: 0x9ab8d0,
    cliffCap: 0xf4faff,
    accent: 0x6ad0ff,
    air: air(0xd8e8f4, 0x5a8ac8, 0xc8dcf0, 0xe8f0ff, 1.9, 0xe4f0ff, 0x8aa0b8, { fogNear: 70, fogFar: 360 }),
    beyond: [[iceP, 4, 2.4], [snowRockP, 2, 2.2], [snowPineP, 1, 0.9]],
    cluster: [[iceP, 3, 1.3], [snowRockP, 1, 1]],
    scatter: [[iceP, 2, 0.5]],
    particles: { color: 0xffffff, kind: 'snow' },
  },
  meteor: {
    ground: g('#3a3a34', '#262622', '#4e4e46', 'cracks', 1.4, 291),
    outer: g('#34342e', '#22221e', '#46463e', 'cracks', 1, 292),
    cliff: 0x3e3c38,
    cliffCap: null,
    accent: 0x4aff7a,
    air: air(0x3a4a3a, 0x1a2420, 0x4a5a48, 0xc8ffb0, 1.2, 0x8aaa8a, 0x1a2218, { fogNear: 60, fogFar: 320, ambient: 0.36 }),
    beyond: [[crystalP(0x4aff7a, true), 3, 2], [rocksP(0x3e3c38), 3, 2.4], [deadP(0x2a2a26), 1, 1]],
    cluster: [[crystalP(0x4aff7a, true), 2, 1.1], [rocksP(0x3e3c38), 2, 1.2]],
    scatter: [[crystalP(0x4aff7a, true), 1, 0.4], [rockP(0x3e3c38), 2, 0.5]],
    particles: { color: 0x8aff9a, kind: 'embers' },
  },
  summit: {
    ground: g('#7a7468', '#5e5a50', '#948e80', 'pebbles', 1, 301),
    outer: g('#6a6458', '#524e46', '#827c70', 'cracks', 1, 302),
    cliff: 0x6a6258,
    cliffCap: 0x4a6a34,
    accent: 0xffd23a,
    air: air(0xe8c8b0, 0x3a5ab0, 0xe8b8a0, 0xffc890, 1.8, 0xffd8c0, 0x5a4a3a, { fogNear: 140, fogFar: 600 }),
    beyond: [[araucariaP, 2, 1.2], [rocksP(0x6a6258), 3, 2.6], [spireP(0x5a5248), 2, 1.6], [torchP, 1, 1]],
    cluster: [[rocksP(0x6a6258), 2, 1.3], [torchP, 1, 1], [skullP, 1, 1.2]],
    scatter: [[rockP(0x6a6258), 2, 0.6], [bonesP, 1, 0.8]],
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
