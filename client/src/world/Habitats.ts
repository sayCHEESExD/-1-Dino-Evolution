import { ARENA, returnPadOf, rewardPadOf } from '@dino/shared';
import { Color } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import type { Family, Look } from './Biomes.js';
import {
  araucaria,
  boulders,
  broadleaf,
  bush,
  cattails,
  crystals,
  cycad,
  deadTree,
  fern,
  flowers,
  glowShrooms,
  grassTuft,
  horsetails,
  mangrove,
  palm,
  redwood,
  rock,
  shade,
  spire,
  trunkGeometry,
  type Rand,
} from './Nature.js';
import { bonePile, fossilSlab, ribcage, skull, stump } from './Relics.js';
import { TILE, tileHash, valueNoise, type Cell } from './Terrain.js';
import {
  basaltColumns,
  bigFallenTree,
  branch,
  bromeliad,
  coral,
  giantLeaves,
  hangingVine,
  iceBlocks,
  lilyPads,
  mushrooms,
  pebbles,
  reeds,
  rockFormation,
  rootTangle,
  ruins,
  tallGrass,
  type Ledge,
} from './Wild.js';

/**
 * HOW EACH HABITAT IS DRESSED: the painter that lays its ground (tones,
 * trails, puddles, a river, marsh, pools, a lagoon, glowing veins, and the
 * sand or mud round them), the feature standing on each rock solid, the
 * clusters along the foot of its walls, what grows on its terraces, and the
 * low life scattered over its floor - all by the habitat's family, so a
 * swamp is roots and reeds and a canyon is bones and banded rock.
 *
 * Clusters, not scatter: every group is a deliberate composition (rock +
 * ferns + a fallen log + bones), and the middle of each arena stays open for
 * the fight.
 */

const C = new Color();
const D = new Color();
export const blend = (a: number, b: number, t: number): number => C.setHex(a).lerp(D.setHex(b), t).getHex();

export type Paint = (x: number, z: number) => Cell;

/** Families whose floors are worn with a winding trail from gate to gate. */
const TRAILED: readonly Family[] = ['meadow', 'jungle', 'forest', 'ruins', 'rocky', 'frozen', 'river'];

export interface Painter {
  readonly paint: Paint;
  /** Whether a point lies in the habitat's liquid. */
  readonly wet: (x: number, z: number) => boolean;
  /** The liquid's surface height there, for what floats on it. */
  readonly riverZ: number;
}

/**
 * THE PAINTER of one arena's ground. Liquids never lie on the entrance, the
 * pads, the far apron or under the gate; sand, mud or scorched earth rings
 * every liquid; a band of litter grounds the walls.
 */
export const painter = (stage: number, look: Look, start: number, end: number): Painter => {
  const W = ARENA.halfWidth;
  const L = end - start;
  const tone = valueNoise(stage * 7 + 1);
  const blobs = valueNoise(stage * 7 + 2);
  const wander = valueNoise(stage * 7 + 3);
  const [base, light, dark] = look.floor;
  const reward = rewardPadOf(stage);
  const back = returnPadOf(stage);
  const riverZ = start + L * 0.42;
  const liquid = look.liquid;
  // Puddles and pools: fixed centres, off the middle lane.
  const r = mulberry(stage * 977 + 13);
  const pools: [number, number, number][] = [];
  if (liquid && (liquid.layout === 'puddles' || liquid.layout === 'pools')) {
    const count = liquid.layout === 'puddles' ? 3 : 5;
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (7 + r() * (W - 14));
      const z = start + 16 + ((i + 0.3 + r() * 0.4) / count) * (L - 38);
      const radius = liquid.layout === 'puddles' ? 2.4 + r() * 1.6 : 3.4 + r() * 2.4;
      pools.push([x, z, radius]);
    }
  }
  const dry = (x: number, z: number): boolean =>
    z < start + 11 || z > end - 6 || Math.hypot(x - back.x, z - back.z) < back.half + 3.5 || (x > reward.x - 11 && z > end - 22);
  const wet = (x: number, z: number): boolean => {
    if (!liquid || dry(x, z)) return false;
    switch (liquid.layout) {
      case 'puddles':
      case 'pools':
        return pools.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) / pr + (blobs(x * 0.35, z * 0.35) - 0.5) * 0.5 < 1);
      case 'river': {
        const centre = riverZ + Math.sin(x * 0.11 + stage) * 2.6;
        return Math.abs(z - centre) < 3.4 + (blobs(x * 0.18, 3.3) - 0.5) * 1.8;
      }
      case 'marsh':
        return Math.abs(x) < W - 2 && blobs(x * 0.085, z * 0.085) > 0.6;
      case 'lagoon':
        return x < -3 + Math.sin(z * 0.09 + stage) * 3.5 && z > start + 14 && z < end - 20;
      case 'veins':
        return Math.abs(x) < W - 2 && Math.abs(blobs(x * 0.07, z * 0.07) - 0.5) < 0.028;
    }
    return false;
  };
  const shoreColor =
    !liquid ? look.soil
    : liquid.kind === 'lava' ? blend(look.soil, 0x1a1210, 0.6)
    : liquid.kind === 'ice' ? 0xffffff
    : liquid.kind === 'tar' ? blend(look.soil, 0x1a1612, 0.45)
    : look.family === 'swamp' ? look.soil
    : 0xe6d29a;
  const trailed = TRAILED.includes(look.family);
  const paint: Paint = (x, z) => {
    const h = tileHash(x, z, stage);
    // Under the gate: a worn threshold of the habitat's earth.
    if (z > end) return { color: shade(look.soil, h < 0.5 ? 0.9 : 0.82) };
    if (wet(x, z)) return { color: base, liquid: liquid!.kind, liquidColor: liquidTint(liquid!.color, blobs(x * 0.2, z * 0.2)) };
    if (liquid && (wet(x + TILE, z) || wet(x - TILE, z) || wet(x, z + TILE) || wet(x, z - TILE))) {
      return { color: shade(shoreColor, h < 0.5 ? 1 : 0.94) };
    }
    // The litter band at the foot of the walls.
    if (Math.abs(x) > W - 2.3) return { color: shade(look.litter, h < 0.3 ? 0.9 : 1) };
    if (trailed) {
      const tx = Math.sin((z - start) * 0.085 + stage) * 5 + (wander(z * 0.06, 1.7) - 0.5) * 4;
      const dx = Math.abs(x - tx);
      if (dx < 2.3) {
        // Ruins are paved: flagstones in a chequer of two stones.
        if (look.family === 'ruins') return { color: shade(look.soil, (Math.floor(x / TILE) + Math.floor(z / TILE)) % 2 ? 0.9 : 1.04) };
        return { color: shade(look.soil, h < 0.2 ? 0.92 : 1) };
      }
      if (dx < 3.4) return { color: blend(look.soil, base, 0.55) };
    }
    const t = tone(x * 0.07, z * 0.07);
    let color = t < 0.34 ? dark : t > 0.68 ? light : base;
    if (h < 0.06) color = shade(color, 0.92);
    else if (h > 0.965) color = shade(color, 1.07);
    return { color };
  };
  return { paint, wet, riverZ };
};

const liquidTint = (color: number, n: number): number => shade(color, 0.92 + n * 0.16);

/** A small seeded generator (the painter's own, so it never shifts the builder's sequence). */
const mulberry = (seed: number): Rand => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ------------------------------------------------------------ the dressing

type Dress = (b: PartBuilder, r: Rand, x: number, y: number, z: number, look: Look) => void;

const tuft = (look: Look): number => blend(look.floor[1], 0xd8e04a, 0.45);
const pickFrom = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;

/** What grows on each terrace tier, per family: [bank, shelf, cliff top]. */
const TERRACE: Record<Family, readonly [readonly Dress[], readonly Dress[], readonly Dress[]]> = {
  meadow: [
    [(b, r, x, y, z) => flowers(b, r, x, y, z, 1), (b, r, x, y, z, l) => grassTuft(b, r, x, y, z, 1.2, tuft(l)), (b, r, x, y, z) => fern(b, r, x, y, z, 0.9)],
    [(b, r, x, y, z) => bush(b, r, x, y, z, 1, 2), (b, r, x, y, z) => cycad(b, r, x, y, z, 0.8), (b, r, x, y, z) => fern(b, r, x, y, z, 1.3)],
    [(b, r, x, y, z) => broadleaf(b, r, x, y, z, 0.9), (b, r, x, y, z) => araucaria(b, r, x, y, z, 0.7)],
  ],
  jungle: [
    [(b, r, x, y, z) => fern(b, r, x, y, z, 1.1), (b, r, x, y, z, l) => bromeliad(b, r, x, y, z, 0.9, l.accent), (b, r, x, y, z) => giantLeaves(b, r, x, y, z, 0.8)],
    [(b, r, x, y, z) => treeFernAt(b, r, x, y, z, 0.8), (b, r, x, y, z) => giantLeaves(b, r, x, y, z, 1.2), (b, r, x, y, z) => bush(b, r, x, y, z, 1.1, 1)],
    [(b, r, x, y, z) => broadleaf(b, r, x, y, z, 1.1), (b, r, x, y, z) => treeFernAt(b, r, x, y, z, 1.2), (b, r, x, y, z) => palm(b, r, x, y, z, 0.9)],
  ],
  river: [
    [(b, r, x, y, z) => reeds(b, r, x, y, z, 0.9), (b, r, x, y, z) => fern(b, r, x, y, z, 1), (b, r, x, y, z) => flowers(b, r, x, y, z, 1)],
    [(b, r, x, y, z) => bush(b, r, x, y, z, 1, 2), (b, r, x, y, z) => treeFernAt(b, r, x, y, z, 0.7), (b, r, x, y, z) => horsetails(b, r, x, y, z, 1)],
    [(b, r, x, y, z) => broadleaf(b, r, x, y, z, 0.9), (b, r, x, y, z) => palm(b, r, x, y, z, 0.9)],
  ],
  swamp: [
    [(b, r, x, y, z) => reeds(b, r, x, y, z, 0.9, 0x8ab84a), (b, r, x, y, z) => horsetails(b, r, x, y, z, 0.8), (b, r, x, y, z) => mushrooms(b, r, x, y, z, 1)],
    [(b, r, x, y, z) => mangrove(b, r, x, y, z, 0.5), (b, r, x, y, z) => horsetails(b, r, x, y, z, 1.1), (b, r, x, y, z) => deadTree(b, r, x, y, z, 0.5, 0x5a5040)],
    [(b, r, x, y, z) => mangrove(b, r, x, y, z, 0.7), (b, r, x, y, z) => deadTree(b, r, x, y, z, 0.8, 0x5a5040)],
  ],
  rocky: [
    [(b, r, x, y, z, l) => rock(b, r, x, y, z, 0.55, l.rock), (b, r, x, y, z, l) => pebbles(b, r, x, y, z, 1, l.rock), (b, r, x, y, z, l) => (l.cap === null ? bonePile(b, r, x, z, 0.6, y) : grassTuft(b, r, x, y, z, 1.1, tuft(l)))],
    [(b, r, x, y, z, l) => deadTree(b, r, x, y, z, 0.6, shade(l.rock, 0.7)), (b, r, x, y, z, l) => boulders(b, r, x, y, z, 0.7, l.rock), (b, r, x, y, z, l) => (l.cap === null ? rock(b, r, x, y, z, 0.8, l.rock) : bush(b, r, x, y, z, 0.9, 0))],
    [(b, r, x, y, z, l) => (l.cap === null ? spire(b, r, x, y, z, 0.35, shade(l.rock, 1.05)) : araucaria(b, r, x, y, z, 0.7)), (b, r, x, y, z, l) => boulders(b, r, x, y, z, 1, l.rock)],
  ],
  volcanic: [
    [(b, r, x, y, z, l) => crystals(b, r, x, y, z, 0.5, l.accent, true), (b, r, x, y, z, l) => rock(b, r, x, y, z, 0.6, shade(l.rock, 0.8))],
    [(b, r, x, y, z, l) => deadTree(b, r, x, y, z, 0.5, shade(l.rock, 0.6)), (b, r, x, y, z, l) => spire(b, r, x, y, z, 0.25, shade(l.rock, 0.9))],
    [(b, r, x, y, z, l) => deadTree(b, r, x, y, z, 0.7, shade(l.rock, 0.55)), (b, r, x, y, z, l) => crystals(b, r, x, y, z, 1, l.accent, true)],
  ],
  frozen: [
    [(b, r, x, y, z) => rock(b, r, x, y, z, 0.5, 0xf4f8fc), (b, r, x, y, z, l) => crystals(b, r, x, y, z, 0.5, l.accent)],
    [(b, r, x, y, z) => araucaria(b, r, x, y, z, 0.45), (b, r, x, y, z) => rock(b, r, x, y, z, 0.8, 0xe8f0f8)],
    [(b, r, x, y, z) => araucaria(b, r, x, y, z, 0.6)],
  ],
  forest: [
    [(b, r, x, y, z) => fern(b, r, x, y, z, 1.2), (b, r, x, y, z) => mushrooms(b, r, x, y, z, 1, 0xff8a2a), (b, r, x, y, z) => stump(b, r, x, z, 1, y)],
    [(b, r, x, y, z) => treeFernAt(b, r, x, y, z, 0.9), (b, r, x, y, z) => fern(b, r, x, y, z, 1.5)],
    [(b, r, x, y, z) => redwood(b, r, x, y, z, 0.55)],
  ],
  ruins: [
    [(b, r, x, y, z) => fern(b, r, x, y, z, 1), (b, r, x, y, z, l) => bromeliad(b, r, x, y, z, 0.8, l.accent), (b, r, x, y, z, l) => b.box(1.2, 0.9, 1.2, shade(l.soil, 0.9), 'flat', { x, y: y + 0.4, z, ry: r() })],
    [(b, r, x, y, z) => bush(b, r, x, y, z, 1, 2), (b, r, x, y, z) => giantLeaves(b, r, x, y, z, 1)],
    [(b, r, x, y, z) => broadleaf(b, r, x, y, z, 1), (b, r, x, y, z) => treeFernAt(b, r, x, y, z, 1)],
  ],
  beach: [
    [(b, r, x, y, z, l) => grassTuft(b, r, x, y, z, 1.1, tuft(l)), (b, r, x, y, z, l) => rock(b, r, x, y, z, 0.5, l.rock), (b, r, x, y, z) => flowers(b, r, x, y, z, 1, 0xff8ac8)],
    [(b, r, x, y, z) => palm(b, r, x, y, z, 0.6), (b, r, x, y, z) => bush(b, r, x, y, z, 1, 2)],
    [(b, r, x, y, z) => palm(b, r, x, y, z, 1)],
  ],
};

const treeFernAt = (b: PartBuilder, r: Rand, x: number, y: number, z: number, s: number): void => {
  // A tree fern: a block trunk and a crown of long plank fronds (Nature's, placed on a ledge).
  const h = s * (3.4 + r() * 2.2);
  b.add(trunkGeometry(h, s * 0.34, s * 0.28, 0, 4, 4), 0x7a4e28, 'flat', { x, y, z, ry: r() * 6 });
  fern(b, r, x, y + h, z, s * 1.6);
};

/** Plant a wall's terraces: low things on the bank, shrubs on the shelf, trees on top. */
export const plantLedges = (b: PartBuilder, r: Rand, ledges: readonly Ledge[], look: Look, sparse = false): void => {
  const lists = TERRACE[look.family];
  for (const ledge of ledges) {
    const list = lists[Math.min(2, ledge.tier)]!;
    const step = [3.6, 5.2, 7.5][Math.min(2, ledge.tier)]! * (sparse ? 1.6 : 1);
    const length = ledge.s1 - ledge.s0;
    const count = Math.max(1, Math.floor(length / step));
    const across = ledge.run === 'z' ? ledge.w : ledge.d;
    if (across < 0.9) continue;
    for (let i = 0; i < count; i += 1) {
      if (r() < 0.18) continue;
      const along = ledge.s0 + ((i + 0.3 + r() * 0.4) / count) * length;
      const off = (r() - 0.5) * Math.max(0, across - 1.6) * 0.6;
      const x = ledge.run === 'z' ? ledge.x + off : along;
      const z = ledge.run === 'z' ? along : ledge.z + off;
      pickFrom(r, list)(b, r, x, ledge.y, z, look);
    }
  }
};

// ------------------------------------------------------ features on solids

export interface Spot {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * The FEATURE standing on one of an arena's rock solids: it fills the solid
 * (so nobody walks into thin air, nor through rock), in the habitat's way.
 */
export const feature = (b: PartBuilder, r: Rand, spot: Spot, look: Look): void => {
  const cx = (spot.minX + spot.maxX) / 2;
  const cz = (spot.minZ + spot.maxZ) / 2;
  const w = spot.maxX - spot.minX;
  const d = spot.maxZ - spot.minZ;
  const side = cx > 0 ? 1 : -1;
  const inward = -side;
  const foot = cx + inward * (w / 2 + 1.1);
  switch (look.family) {
    case 'meadow': {
      const tops = rockFormation(b, r, cx, cz, w * 0.95, d * 0.9, 4.2, look.rock, look.cap);
      broadleaf(b, r, tops[0]!.x, tops[0]!.y, tops[0]!.z, 0.8);
      flowers(b, r, tops[2]!.x + inward * w * 0.3, tops[2]!.y, tops[2]!.z + d * 0.3, 1.1);
      fern(b, r, tops[1]!.x, tops[1]!.y, tops[1]!.z - d * 0.2, 1);
      branch(b, r, foot, cz + d * 0.2, 3.2, 0.3, 1);
      flowers(b, r, foot, 0, cz - d * 0.3, 1);
      break;
    }
    case 'jungle':
    case 'ruins': {
      if (look.family === 'ruins') {
        ruins(b, r, cx, cz, w, d, 5, shade(look.soil, 0.95));
        hangingVine(b, r, cx + inward * (w * 0.1), 4.1, cz + d * 0.25, 3.2);
        giantLeaves(b, r, foot, 0, cz, 1);
        break;
      }
      const tops = rockFormation(b, r, cx, cz, w * 0.95, d * 0.92, 5.2, look.rock, look.cap);
      const top = tops[0]!;
      if (r() < 0.5) broadleaf(b, r, top.x, top.y, top.z, 1.05);
      else treeFernAt(b, r, top.x, top.y, top.z, 1.1);
      for (let i = 0; i < 3; i += 1) hangingVine(b, r, cx + inward * (w * 0.475 + 0.25), tops[2]!.y - 0.2, spot.minZ + (i + 0.5) * (d / 3), 1.6 + r() * 2.2);
      giantLeaves(b, r, foot, 0, cz - d * 0.2, 1.1);
      bromeliad(b, r, foot, 0, cz + d * 0.35, 1, look.accent);
      fern(b, r, tops[1]!.x, tops[1]!.y, tops[1]!.z, 1.1);
      break;
    }
    case 'river':
    case 'beach': {
      const big = [
        [cx + (r() - 0.5) * 1.2, cz - d * 0.22, 2.3],
        [cx + (r() - 0.5) * 1.2, cz + d * 0.24, 2.0],
        [cx + side * w * 0.12, cz, 2.6],
      ] as const;
      for (const [x, z, s] of big) rock(b, r, x, 0, z, s, look.rock);
      rock(b, r, cx, 2.0, cz, 1.3, shade(look.rock, 1.08));
      palm(b, r, cx + side * w * 0.2, 2.0, cz + d * 0.1, 0.75);
      if (look.family === 'river') reeds(b, r, foot, 0, cz - d * 0.3, 1);
      flowers(b, r, foot, 0, cz + d * 0.3, 1);
      break;
    }
    case 'swamp': {
      b.box(w * 0.9, 1.4, d * 0.88, look.soil, 'flat', { x: cx, y: 0.5, z: cz });
      b.box(w * 0.9 + 0.3, 0.34, d * 0.88 + 0.3, shade(look.cap ?? 0x4f8f36, 0.9), 'flat', { x: cx, y: 1.36, z: cz });
      mangrove(b, r, cx, 1.53, cz, 0.95);
      rootTangle(b, r, cx + side * w * 0.15, cz + d * 0.3, 0.6, 1.53);
      reeds(b, r, foot, 0, cz - d * 0.25, 1, 0x8ab84a);
      mushrooms(b, r, foot, 0, cz + d * 0.3, 1.1, 0xff8a2a);
      break;
    }
    case 'rocky': {
      const tops = rockFormation(b, r, cx, cz, w * 0.95, d * 0.92, 5.4, look.rock, look.cap);
      if (look.cap === null) skull(b, r, tops[0]!.x, tops[0]!.z, 0.55, r() * 6, undefined, tops[0]!.y);
      else araucaria(b, r, tops[0]!.x, tops[0]!.y, tops[0]!.z, 0.55);
      if (r() < 0.5) bonePile(b, r, foot, cz, 0.8);
      else fossilSlab(b, r, foot, cz, 1, r());
      pebbles(b, r, foot, 0, cz + d * 0.35, 1, look.rock);
      break;
    }
    case 'volcanic':
      basaltColumns(b, r, cx, cz, w * 0.95, d * 0.92, 5.6, look.rock, look.accent);
      crystals(b, r, foot, 0, cz, 0.7, look.accent, true);
      break;
    case 'frozen':
      iceBlocks(b, r, cx, cz, w * 0.95, d * 0.92, 5.2);
      araucaria(b, r, cx + side * w * 0.2, 0, cz, 0.45);
      break;
    case 'forest': {
      // A GIANT STUMP: a massive cut trunk on a flare of roots.
      const rad = Math.min(w, d) * 0.42;
      b.add(trunkGeometry(4.8, rad, rad * 0.92, 0, 4, 3), 0x9a4a2c, 'flat', { x: cx, y: -0.2, z: cz, ry: r() });
      b.box(rad * 1.7, 0.2, rad * 1.7, 0xd8a870, 'flat', { x: cx, y: 4.64, z: cz });
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        b.box(1.0, 1.6, rad * 0.9, 0x8a3e24, 'flat', { x: cx + Math.sin(a) * rad * 1.05, y: 0.6, z: cz + Math.cos(a) * rad * 1.05, ry: a });
      }
      fern(b, r, cx, 4.74, cz, 1.2);
      mushrooms(b, r, foot, 0, cz, 1.1, 0xff8a2a);
      break;
    }
  }
};

// --------------------------------------------------------- wall-foot groups

/** One deliberate group at the foot of a wall (x on the wall side, facing in). */
export const edgeCluster = (b: PartBuilder, r: Rand, x: number, z: number, side: number, look: Look): void => {
  const inward = -side;
  const along = side > 0 ? Math.PI : 0;
  switch (look.family) {
    case 'meadow':
      rock(b, r, x, 0, z, 1.1, look.rock);
      fern(b, r, x + inward * 1.8, 0, z + 1.4, 1.1);
      fern(b, r, x + inward * 0.6, 0, z - 2, 0.9);
      flowers(b, r, x + inward * 2.6, 0, z - 0.6, 1);
      if (r() < 0.5) branch(b, r, x + inward * 1.2, z + 3.2, 3, along + 0.3, 1);
      else stump(b, r, x + inward * 0.4, z + 3, 1);
      break;
    case 'jungle':
      giantLeaves(b, r, x, 0, z, 1.1);
      fern(b, r, x + inward * 2, 0, z + 2.2, 1.2);
      bromeliad(b, r, x + inward * 2.4, 0, z - 1.8, 0.9, look.accent);
      rock(b, r, x + side * 0.4, 0, z - 3, 0.9, look.rock);
      if (r() < 0.45) bigFallenTree(b, r, x + side * 0.3, z + 1, 7, along, 0.75);
      else mushrooms(b, r, x + inward * 1, 0, z + 3.4, 1);
      tallGrass(b, r, x + inward * 3.6, 0, z + 0.4, 0.9, tuft(look));
      break;
    case 'river':
    case 'beach':
      boulders(b, r, x, 0, z, 1, look.rock);
      if (look.family === 'river') reeds(b, r, x + inward * 2, 0, z + 2, 1);
      else coral(b, r, x + inward * 2, 0, z + 2, 0.8);
      branch(b, r, x + inward * 1.5, z - 2.5, 3.4, along - 0.4, 1.1);
      flowers(b, r, x + inward * 2.8, 0, z - 0.4, 1);
      break;
    case 'swamp':
      bigFallenTree(b, r, x + side * 0.2, z, 7.5, along + (r() - 0.5) * 0.3, 0.8);
      reeds(b, r, x + inward * 2.2, 0, z + 3.5, 1, 0x8ab84a);
      horsetails(b, r, x + inward * 1.8, 0, z - 3.6, 0.9);
      mushrooms(b, r, x + inward * 1.2, 0, z - 1, 0.9, 0xf0e0a0);
      break;
    case 'rocky':
      boulders(b, r, x, 0, z, 1.1, look.rock);
      if (r() < 0.4) skull(b, r, x + inward * 2, z + 2, 0.6, along + (r() - 0.5));
      else if (r() < 0.5) ribcage(b, r, x + inward * 0.5, z + 2.5, 0.45, along + Math.PI / 2);
      else bonePile(b, r, x + inward * 1.8, z + 2, 0.8);
      pebbles(b, r, x + inward * 2.8, 0, z - 1.5, 1, look.rock);
      if (look.cap !== null) grassTuft(b, r, x + inward * 1.2, 0, z - 2.8, 1.1, tuft(look));
      break;
    case 'volcanic':
      boulders(b, r, x, 0, z, 1, shade(look.rock, 0.9));
      crystals(b, r, x + inward * 1.8, 0, z + 1.6, 0.8, look.accent, true);
      pebbles(b, r, x + inward * 2.6, 0, z - 1.8, 1, shade(look.rock, 0.8));
      break;
    case 'frozen':
      rock(b, r, x, 0, z, 1.2, 0xf4f8fc);
      rock(b, r, x + inward * 1.4, 0, z + 1.4, 0.7, 0x9aa4b0);
      crystals(b, r, x + inward * 2, 0, z - 1.6, 0.7, look.accent);
      bonePile(b, r, x + inward * 2.4, z + 2.6, 0.6);
      break;
    case 'forest':
      bigFallenTree(b, r, x + side * 0.3, z, 8, along, 0.85);
      fern(b, r, x + inward * 2.4, 0, z + 2.5, 1.3);
      mushrooms(b, r, x + inward * 1.6, 0, z - 2.5, 1, 0xff8a2a);
      break;
    case 'ruins':
      b.box(1.4, 1.3, 3.2, shade(look.soil, 0.9), 'flat', { x: x + inward * 0.5, y: 0.65, z, ry: along + 0.4 });
      b.box(1.5, 1.3, 1.5, shade(look.soil, 1.02), 'flat', { x: x + side * 0.2, y: 0.65, z: z + 3, ry: 0.3 });
      fern(b, r, x + inward * 2, 0, z - 2, 1.1);
      bromeliad(b, r, x + inward * 2.4, 0, z + 1.6, 0.9, look.accent);
      break;
  }
};

// ---------------------------------------------------------- the open floor

/**
 * The low life of the floor: small groups a dinosaur walks straight through -
 * tufts and flowers, tall grass, mushrooms, pebbles; reeds and lily pads in
 * the water, coral in a lagoon. Never on a pad, a trail's heart or the gate.
 */
export const fieldDressing = (b: PartBuilder, r: Rand, stage: number, start: number, end: number, look: Look, wet: (x: number, z: number) => boolean, sparse: boolean): void => {
  const W = ARENA.halfWidth;
  const reward = rewardPadOf(stage);
  const back = returnPadOf(stage);
  const count = Math.round((sparse ? 10 : 18) * (look.family === 'swamp' ? 1.6 : 1));
  const clear = (x: number, z: number): boolean =>
    Math.hypot(x - reward.x, z - reward.z) > reward.half + 3 && Math.hypot(x - back.x, z - back.z) > back.half + 3 && Math.abs(x) > 3 && z > start + 4 && z < end - 3;
  for (let i = 0; i < count; i += 1) {
    const x = (r() - 0.5) * (W - 4) * 2;
    const z = start + 6 + r() * (end - start - 10);
    if (!clear(x, z)) continue;
    if (wet(x, z)) {
      if (!look.liquid || look.liquid.kind !== 'water') continue;
      if (look.family === 'beach') coral(b, r, x, -0.95, z, 0.9);
      else if (r() < 0.6) lilyPads(b, r, x, -0.1, z, 1);
      else reeds(b, r, x, -0.95, z, 1);
      continue;
    }
    const k = r();
    switch (look.family) {
      case 'meadow':
        if (k < 0.45) for (let j = 0; j < 3; j += 1) grassTuft(b, r, x + (r() - 0.5) * 2.4, 0, z + (r() - 0.5) * 2.4, 0.9 + r() * 0.5, tuft(look));
        else if (k < 0.8) flowers(b, r, x, 0, z, 1.1);
        else pebbles(b, r, x, 0, z, 1, look.rock);
        break;
      case 'jungle':
      case 'ruins':
        if (k < 0.4) tallGrass(b, r, x, 0, z, 0.9, tuft(look));
        else if (k < 0.65) fern(b, r, x, 0, z, 0.8);
        else if (k < 0.85) flowers(b, r, x, 0, z, 1, look.accent);
        else mushrooms(b, r, x, 0, z, 0.8);
        break;
      case 'river':
      case 'beach':
        if (k < 0.5) pebbles(b, r, x, 0, z, 1.2, look.rock);
        else if (k < 0.8) grassTuft(b, r, x, 0, z, 1, tuft(look));
        else flowers(b, r, x, 0, z, 1);
        break;
      case 'swamp':
        if (k < 0.4) mushrooms(b, r, x, 0, z, 0.9, 0xe8c85a);
        else if (k < 0.7) horsetails(b, r, x, 0, z, 0.6);
        else cattails(b, r, x, 0, z, 1);
        break;
      case 'rocky':
        if (k < 0.5) pebbles(b, r, x, 0, z, 1.2, look.rock);
        else if (k < 0.75) bonePile(b, r, x, z, 0.6);
        else if (look.cap !== null) grassTuft(b, r, x, 0, z, 1, tuft(look));
        break;
      case 'volcanic':
        if (k < 0.6) pebbles(b, r, x, 0, z, 1.2, shade(look.rock, 0.85));
        else crystals(b, r, x, 0, z, 0.35, look.accent, true);
        break;
      case 'frozen':
        if (k < 0.6) pebbles(b, r, x, 0, z, 1, 0xf4f8fc);
        else crystals(b, r, x, 0, z, 0.35, look.accent);
        break;
      case 'forest':
        if (k < 0.5) fern(b, r, x, 0, z, 0.9);
        else if (k < 0.8) mushrooms(b, r, x, 0, z, 0.9, 0xff8a2a);
        else branch(b, r, x, z, 2.6, r() * 6, 0.8);
        break;
    }
  }
  // The night jungle's glowing fungi.
  if (look.accent === 0x6affd8) for (let i = 0; i < 8; i += 1) glowShrooms(b, r, (r() < 0.5 ? -1 : 1) * (W - 3 - r() * 4), 0, start + 8 + r() * (end - start - 16), 1.1, look.accent);

  // THICKETS: in the jungle, the forest, the ruins and the swamp the growth closes in
  // from both sides - tall grass, ferns and giant leaves (reeds and roots in a swamp)
  // in bands that leave a natural path down the middle. All of it walked through.
  const dense = look.family === 'jungle' || look.family === 'forest' || look.family === 'ruins' || look.family === 'swamp';
  if (dense) {
    const rows = look.family === 'jungle' ? [11.5, 17.5] : [14];
    for (const side of [-1, 1]) {
      for (const row of rows) for (let z = start + 13 + (row > 15 ? 2.5 : 0); z < end - 6; z += sparse ? 9 : 5.5) {
        const x = side * (row + r() * 4.5);
        const zz = z + (r() - 0.5) * 2.5;
        if (!clear(x, zz)) continue;
        if (wet(x, zz)) {
          if (look.liquid?.kind !== 'water') continue;
          if (r() < 0.5) reeds(b, r, x, -0.95, zz, 1.1);
          else lilyPads(b, r, x, -0.1, zz, 1);
          continue;
        }
        switch (look.family) {
          case 'swamp':
            cattails(b, r, x, 0, zz, 1.1);
            if (r() < 0.5) mushrooms(b, r, x + side * 1.4, 0, zz + 1.2, 0.9, 0xe8c85a);
            else horsetails(b, r, x - side * 1.2, 0, zz - 1, 0.8);
            break;
          case 'forest':
            fern(b, r, x, 0, zz, 1.3);
            if (r() < 0.5) fern(b, r, x + side * 1.8, 0, zz + 1.5, 1.1);
            else mushrooms(b, r, x + side * 1.2, 0, zz - 1.2, 0.9, 0xff8a2a);
            break;
          default:
            tallGrass(b, r, x, 0, zz, look.family === 'jungle' ? 1.35 : 1.1, tuft(look));
            if (r() < 0.5) giantLeaves(b, r, x + side * 1.8, 0, zz + 1.2, 0.9);
            else fern(b, r, x + side * 1.6, 0, zz - 1.2, 1.1);
            if (r() < 0.35) bromeliad(b, r, x - side * 1.2, 0, zz + 1.8, 0.8, look.accent);
        }
      }
    }
  }
};
