import {
  BOARDS,
  DINOS,
  DINO_PADS,
  DUMMIES,
  EGGS,
  EGG_PLACEMENTS,
  FEED_TROUGH,
  FOSSIL_DISPLAYS,
  HATCHERY,
  HATCHERY_POOL,
  HUB,
  HUB_BACK_WALL_DEPTH,
  HUB_GATE,
  HUB_TORCHES,
  HUB_TREES,
  PADDOCK,
  PADDOCK_STAIRS,
  SPAWN,
  TRAINING,
  TRAINING_CRATES,
  TRAINING_TIERS,
  dummyHeight,
  formatAmount,
  formatWins,
  ownsDino,
  plinthOf,
  stairBoxes,
} from '@dino/shared';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isMobileGpu } from '../config/device.js';
import { DinoAnimator, createMotion, type DinoMotion } from '../dinos/DinoAnimator.js';
import { createDino, type DinoInstance } from '../dinos/DinoModel.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { studPlastic } from '../render/Studs.js';
import { BIOMES } from './Biomes.js';
import { CanvasSign } from './CanvasSign.js';
import { blend, plantLedges } from './Habitats.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import { araucaria, boulders, broadleaf, bush, cattails, fern, flowers, grassTuft, horsetails, jungleGiant, rock, seeded, shade, type Rand } from './Nature.js';
import { bone, bonePile, fallenLog, fossilSlab, log, nest, skull, stonePad, stump, torch } from './Relics.js';
import { TILE, paintTerrain, tickWater, tileHash, valueNoise, waterSurface, waterfallSurface, type Cell } from './Terrain.js';
import { bigFallenTree, branch, bromeliad, cascade, giantLeaves, hangingVine, lilyPads, mushrooms, reeds, rockFormation, tallGrass, terrainWall, waterfallGeometry, type Ledge, type WallTier } from './Wild.js';
import { Scoreboard } from './Scoreboard.js';
import { worldTextures } from './WorldTextures.js';

/** The valley's palette: the park biome's look, and a few colours of its own. */
const LOOK = BIOMES.park.look;
const ROCK = LOOK.rock;
const TURF = LOOK.cap!;
const SAND = 0xe6d29a;
const WATER = 0x2fb4e8;
const FALL = 0x8adcff;
const PACKED = 0xd8b27a;
const BONE_WHITE = 0xf2e8d0;

/** The pond at the foot of the waterfall behind the spawn. */
const POND = { x: 0, z: -30.5, rx: 9, rz: 6.2 } as const;
/** The trails worn between the camp's places: [ax, az, bx, bz, half-width]. */
const TRAILS: readonly (readonly [number, number, number, number, number])[] = [
  [0, SPAWN.z - 5, 0, HUB.maxZ + HUB_BACK_WALL_DEPTH, 3.2],
  [-3, -8, TRAINING.maxX, -8, 2.4],
  [3, -8, PADDOCK.ground.minX, -8, 2.4],
  [-3, 30, HATCHERY.maxX, 30, 2.2],
  [3, 31, PADDOCK.stairFromX, 38.5, 2.2],
];

/** The three wall tiers of the valley: an earth bank, a rock shelf and the cliff. */
const tiers = (bank: readonly [number, number], shelf: readonly [number, number], cliff: readonly [number, number]): WallTier[] => [
  { depth: 3.4, height: bank, color: LOOK.bank },
  { depth: 5, height: shelf, color: ROCK },
  { depth: 10, height: cliff, color: shade(ROCK, 1.08) },
];

interface Statue {
  readonly slot: number;
  readonly dino: DinoInstance;
  readonly animator: DinoAnimator;
  readonly motion: DinoMotion;
  readonly label: LabelSprite;
  readonly ring: MeshLambertMaterial;
  shown: 'locked' | 'owned' | 'ridden' | '';
}

interface Effigy {
  readonly tier: number;
  readonly dino: DinoInstance;
  readonly label: LabelSprite;
  readonly mat: MeshBasicMaterial;
  wobble: number;
  wobbleYaw: number;
}

/**
 * THE VALLEY CAMP: the hub every run starts from - a clearing in a prehistoric
 * jungle valley, closed in by terraced cliffs, not a theme park.
 *
 *   centre   the spawn plate in the open lobby; behind it a waterfall pours off
 *            the front cliff into a pond, fossil rocks either side
 *   left     the paddock: an earth terrace and a rock shelf above it, the
 *            thirteen rideable dinosaurs on their plinths, a fall behind them
 *   right    the training clearing: seven carved dinosaur effigies to attack
 *   back-r   the nesting grounds: four eggs on their nests, a pool and a fall
 *   back     the leaderboard cliff, and under its middle board the bone-tusk
 *            archway out to Stage 1
 *
 * The ground is one painted surface (grass tones, worn trails, sand round the
 * pond); every raised floor is painted on its own solid's top. Nothing lies on
 * top of anything else in the same plane, so nothing flickers.
 */
export class HubWorld {
  readonly root = new Group();
  readonly scoreboard = new Scoreboard();
  private readonly statues: Statue[] = [];
  private readonly effigies: Effigy[] = [];
  private readonly eggs: Mesh[] = [];
  private readonly materials: Material[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly labels: LabelSprite[] = [];
  private readonly waters: BufferGeometry[] = [];
  private readonly falls: BufferGeometry[] = [];
  private time = 0;
  private statueSignature = '';
  private rebirths = -1;
  private readonly mobile = isMobileGpu();
  private frame = 0;

  constructor() {
    this.root.name = 'park';
    this.root.add(this.scoreboard.root);
    const b = new PartBuilder();
    const r = seeded(0x9a7c);
    this.buildGround(b, r);
    this.buildFrontCliff(b, r);
    this.buildSideCliffs(b, r);
    this.buildBackCliffs(b, r);
    this.buildLeaderboardCliff(b, r);
    this.buildPaddock(b, r);
    this.buildTraining(b, r);
    this.buildHatchery(b, r);
    this.buildLobby(b, r);
    this.root.add(b.build('park-static'));
    this.buildWater();
    this.buildStatues();
    this.buildEffigies();
    this.buildEggs();
    this.buildSigns();
  }

  // ---------------------------------------------------------------- ground

  /**
   * THE VALLEY FLOOR, one painted surface: grass in three tones with meadow
   * patches, worn trails from the spawn to every place, a clearing round the
   * spawn, sand round the pond, litter at the foot of the cliffs - and the pond
   * itself cut into it.
   */
  private buildGround(b: PartBuilder, r: Rand): void {
    const tone = valueNoise(11);
    const meadow = valueNoise(12);
    const shore = valueNoise(13);
    const [base, light, dark] = LOOK.floor;
    const inPond = (x: number, z: number): boolean => {
      const dx = (x - POND.x) / POND.rx;
      const dz = (z - POND.z) / POND.rz;
      return z > HUB.minZ - 1.2 && dx * dx + dz * dz + (shore(x * 0.3, z * 0.3) - 0.5) * 0.35 < 1;
    };
    const paint = (x: number, z: number): Cell => {
      const h = tileHash(x, z, 77);
      // The pond first: it runs in under the front cliff, so its falls land in water.
      if (inPond(x, z)) return { color: base, liquid: 'water', liquidColor: shade(WATER, 0.94 + shore(x * 0.2, z * 0.2) * 0.12) };
      if (x < HUB.minX || x > HUB.maxX || z < HUB.minZ) return { color: LOOK.outer };
      if (inPond(x + TILE, z) || inPond(x - TILE, z) || inPond(x, z + TILE) || inPond(x, z - TILE)) return { color: shade(SAND, h < 0.5 ? 1 : 0.95) };
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 7.4) return { color: shade(LOOK.soil, h < 0.3 ? 0.95 : 1.04) };
      let edge = false;
      for (const [ax, az, bx, bz, half] of TRAILS) {
        const d = segmentDistance(x, z, ax, az, bx, bz);
        if (d < half) return { color: shade(LOOK.soil, h < 0.2 ? 0.93 : 1) };
        if (d < half + 1.1) edge = true;
      }
      if (edge) return { color: blend(LOOK.soil, base, 0.55) };
      if (x < HUB.minX + 2.2 || x > HUB.maxX - 2.2 || z < HUB.minZ + 2.2 || z > HUB.maxZ - 2.2) return { color: shade(LOOK.litter, h < 0.3 ? 0.9 : 1) };
      const t = tone(x * 0.07, z * 0.07);
      let color = t < 0.34 ? dark : t > 0.68 ? light : base;
      if (meadow(x * 0.12, z * 0.12) > 0.74) color = 0x9ad852;
      if (h < 0.06) color = shade(color, 0.92);
      else if (h > 0.965) color = shade(color, 1.07);
      return { color };
    };
    const ground = paintTerrain({ minX: -110, maxX: 124, minZ: -76, maxZ: HUB.maxZ + HUB_BACK_WALL_DEPTH, y: 0, paint, bank: 0x8a6a3a });
    b.addPainted(ground.ground, 'stud');
    if (ground.water) this.waters.push(ground.water);

    // THE SPAWN PLATE: a Roblox spawn pad - a stone border, a gold plate a step
    // above it, and a three-toed dinosaur print a step above that.
    b.box(11.2, 0.1, 11.2, 0x7a6a58, 'flat', { x: SPAWN.x, y: 0.05, z: SPAWN.z });
    b.box(9.6, 0.16, 9.6, 0xffc81e, 'flat', { x: SPAWN.x, y: 0.08, z: SPAWN.z });
    b.box(3.2, 0.22, 2.6, 0x8a5a1e, 'flat', { x: SPAWN.x, y: 0.11, z: SPAWN.z - 1.2 });
    for (const [dx, dz, ry] of [[-1.3, 1.1, 0.45], [0, 1.6, 0], [1.3, 1.1, -0.45]] as const) {
      b.box(0.9, 0.22, 2.4, 0x8a5a1e, 'flat', { x: SPAWN.x + dx, y: 0.11, z: SPAWN.z + dz, ry });
    }
    void r;
  }

  // ----------------------------------------------------------------- walls

  /**
   * THE FRONT CLIFF behind the spawn: terraced rock either side, and in the
   * middle a tall buttress with the valley's waterfall pouring off it into the
   * pond.
   */
  private buildFrontCliff(b: PartBuilder, r: Rand): void {
    const face = HUB.minZ;
    const wall = tiers([4, 6], [11, 15], [20, 26]);
    const ledges: Ledge[] = [
      ...terrainWall(b, r, { run: 'x', face, out: -1, from: HUB.minX - 14, to: -6, tiers: wall, cap: TURF, vines: 0.45 }),
      ...terrainWall(b, r, { run: 'x', face, out: -1, from: 6, to: HUB.maxX + 14, tiers: wall, cap: TURF, vines: 0.45 }),
    ];
    // The falls buttress: stacked strata stepping back as they rise, turf on top.
    const top = 24;
    const heights = [-0.3, 8.2, 16.4, top];
    for (let m = 0; m < 3; m += 1) {
      const inset = m * 0.25;
      const depth = 14 - inset;
      b.box(12, heights[m + 1]! - heights[m]!, depth, shade(ROCK, m % 2 ? 0.86 : 1), 'flat', { x: 0, y: (heights[m]! + heights[m + 1]!) / 2, z: face - 0.2 - inset - depth / 2 });
    }
    b.box(12, 0.44, 14 - 0.5 + 0.3, TURF, 'flat', { x: 0, y: top + 0.22, z: face - 0.2 - 0.5 + 0.15 - (14 - 0.5 + 0.3) / 2 });
    for (const s of [-1, 1]) {
      boulders(b, r, s * 7.5, -0.9, face + 1.2, 1.4, ROCK);
      hangingVine(b, r, s * 4.8, top, face - 0.5, 9 + r() * 5);
    }
    const fall = waterfallGeometry(0, face - 0.2, 6.4, top + 0.05, -0.1, 0, 1, FALL);
    if (fall) this.falls.push(fall);
    for (let i = 0; i < 9; i += 1) b.box(0.8 + r() * 0.6, 0.3 + r() * 0.3, 0.8 + r() * 0.6, shade(0xf4fbff, 0.95 + r() * 0.05), 'flat', { x: (r() - 0.5) * 6.4, y: 0.02, z: face + 0.6 + r() * 1.6, ry: r() });
    araucaria(b, r, -2.5, top + 0.44, face - 7, 0.9);
    broadleaf(b, r, 3, top + 0.44, face - 10, 1.1);
    plantLedges(b, r, ledges, LOOK, this.mobile);
    // Over the cliff: the jungle canopy.
    for (let i = 0; i < 7; i += 1) jungleGiant(b, r, HUB.minX + 10 + i * 24 + r() * 8, 0, face - 20 - r() * 12, 1.2 + r() * 0.3);
  }

  /**
   * THE WEST CLIFF behind the training clearing and the nesting grounds, with
   * a flat sign rock for the TRAINING GROUNDS board and a fall into the
   * nesting pool; THE EAST CLIFF is the paddock's backdrop (built with it).
   */
  private buildSideCliffs(b: PartBuilder, r: Rand): void {
    const face = HUB.minX;
    const wall = tiers([4.5, 6.5], [12, 16], [21, 27]);
    const signFrom = TRAINING_SIGN_Z - 10;
    const signTo = TRAINING_SIGN_Z + 10;
    const south = terrainWall(b, r, { run: 'z', face, out: -1, from: HUB.minZ - 14, to: signFrom, tiers: wall, cap: TURF, vines: 0.4 });
    const north = terrainWall(b, r, { run: 'z', face, out: -1, from: signTo, to: HUB.maxZ + HUB_BACK_WALL_DEPTH + 10, tiers: wall, cap: TURF, vines: 0.4 });
    this.signRock(b, r, 'z', face - 0.8, -1, signFrom, signTo, 19, 12);
    this.board(b, 'z', face - 0.8, -1, TRAINING_SIGN_Z, 12, 19, 5.2);
    plantLedges(b, r, [...south, ...north], LOOK, this.mobile);
    // The fall into the nesting pool.
    const poolZ = (HATCHERY_POOL.minZ + HATCHERY_POOL.maxZ) / 2;
    this.falls.push(...cascade(b, r, north, face, -1, poolZ, 4, HATCHERY_POOL.maxY - 0.05, FALL));
    for (let i = 0; i < 5; i += 1) jungleGiant(b, r, face - 22 - r() * 10, 0, HUB.minZ + 6 + i * 18 + r() * 6, 1.15 + r() * 0.3);
  }

  /** The back cliffs either side of the leaderboard cliff, with a sign rock for the HATCHERY board. */
  private buildBackCliffs(b: PartBuilder, r: Rand): void {
    const face = HUB.maxZ;
    const wall = tiers([6, 8], [14, 18], [22, 28]);
    const ledges: Ledge[] = [
      ...terrainWall(b, r, { run: 'x', face, out: 1, from: HUB.minX - 14, to: HATCHERY_SIGN_X - 10, tiers: wall, cap: TURF, vines: 0.4 }),
      ...terrainWall(b, r, { run: 'x', face, out: 1, from: HATCHERY_SIGN_X + 10, to: -BOARDS.wallHalf - 0.2, tiers: wall, cap: TURF, vines: 0.4 }),
      ...terrainWall(b, r, { run: 'x', face, out: 1, from: BOARDS.wallHalf + 0.2, to: PADDOCK.backX, tiers: wall, cap: TURF, vines: 0.4 }),
    ];
    this.signRock(b, r, 'x', face + 0.8, 1, HATCHERY_SIGN_X - 10, HATCHERY_SIGN_X + 10, 22, 10);
    this.board(b, 'x', face + 0.8, 1, HATCHERY_SIGN_X, 13, 17, 4.8);
    plantLedges(b, r, ledges, LOOK, this.mobile);
    for (const x of [-62, -46, 50, 66, 82]) jungleGiant(b, r, x + r() * 6, 0, face + 18 + r() * 8, 1.2 + r() * 0.25);
  }

  /**
   * A SIGN ROCK: a broad block of cliff with one flat face (at `face`), its
   * strata stacked without stepping, turf on top - somewhere for a board to hang.
   */
  private signRock(b: PartBuilder, r: Rand, run: 'x' | 'z', face: number, out: 1 | -1, from: number, to: number, height: number, depth: number): void {
    const len = to - from;
    const mid = (from + to) / 2;
    const at = (across: number): { x: number; z: number } => (run === 'z' ? { x: face + out * across, z: mid } : { x: mid, z: face + out * across });
    const size = (w: number, d: number): [number, number] => (run === 'z' ? [d, w] : [w, d]);
    const cuts = [-0.3, height * 0.3, height * 0.55, height * 0.8, height];
    for (let m = 0; m < 4; m += 1) {
      const p = at(depth / 2);
      const [sx, sz] = size(len, depth);
      b.box(sx, cuts[m + 1]! - cuts[m]!, sz, shade(ROCK, m % 2 ? 0.88 : 1.02 + r() * 0.04), 'flat', { x: p.x, y: (cuts[m]! + cuts[m + 1]!) / 2, z: p.z });
    }
    const p = at(depth / 2 - 0.15);
    const [sx, sz] = size(len, depth + 0.3);
    b.box(sx, 0.44, sz, TURF, 'flat', { x: p.x, y: height + 0.22, z: p.z });
    for (let i = 0; i < 3; i += 1) {
      const along = from + (i + 0.5) * (len / 3);
      const q = run === 'z' ? { x: face - out * 0.2, z: along } : { x: along, z: face - out * 0.2 };
      if (i !== 1) hangingVine(b, r, q.x, height, q.z, 4 + r() * 6);
    }
    broadleaf(b, r, at(depth * 0.6).x, height + 0.44, at(depth * 0.6).z, 1.1);
  }

  /**
   * A PLANK BOARD lashed flat to a rock face, for a sign: planks with a gap
   * between each, two rope bindings. `face` is the rock's face, `out` which
   * way is into the rock; the board stands just proud of it.
   */
  private board(b: PartBuilder, run: 'x' | 'z', face: number, out: 1 | -1, along: number, y: number, w: number, h: number): void {
    const across = face - out * 0.16;
    const planks = Math.max(2, Math.round(h / 1.5));
    for (let i = 0; i < planks; i += 1) {
      const py = y - h / 2 + (i + 0.5) * (h / planks);
      const len = w - (i % 2) * 0.3;
      const [sx, sz] = run === 'z' ? [0.3, len] : [len, 0.3];
      b.box(sx, h / planks - 0.1, sz, shade(0x8a5a2e, 0.92 + (i % 2) * 0.1), 'flat', run === 'z' ? { x: across, y: py, z: along } : { x: along, y: py, z: across });
    }
    for (const s of [-1, 1]) {
      const at = along + s * (w / 2 - 1);
      const [sx, sz] = run === 'z' ? [0.44, 0.5] : [0.5, 0.44];
      b.box(sx, h + 0.4, sz, 0xd8b070, 'flat', run === 'z' ? { x: across, y, z: at } : { x: at, y, z: across });
    }
  }

  // ------------------------------------------------------- leaderboard cliff

  /**
   * THE LEADERBOARD CLIFF, the whole back of the lobby: a sheer face of banded
   * rock with the three boards mounted on it, fire bowls on ledges at its
   * ends, turf, trees and a great skull on top - and under the middle board the
   * way out to Stage 1: a rock arch framed by two giant curved tusks.
   */
  private buildLeaderboardCliff(b: PartBuilder, r: Rand): void {
    const z0 = HUB.maxZ;
    const z1 = HUB.maxZ + HUB_BACK_WALL_DEPTH;
    const half = BOARDS.wallHalf + 0.2;
    const gate = HUB_GATE;
    const jamb = gate.towerOuter + 0.5;
    // The face, in columns of banded rock; each column's face a hair behind the boards' backs.
    let previous = 0;
    const tops: { x0: number; x1: number; y: number }[] = [];
    const topAt = (x: number): number => (tops.find((t) => x >= t.x0 && x <= t.x1)?.y ?? BOARDS.wallHeight) + 0.44;
    for (const s of [-1, 1]) {
      let x = jamb;
      while (x < half - 0.01) {
        const w = Math.min(half - x, 3.5 + r() * 2.5);
        let h = BOARDS.wallHeight - 2 + r() * 4;
        if (Math.abs(h - previous) < 0.4) h += 0.7;
        previous = h;
        const fz = z0 + r() * 0.2;
        const bz = z1 + r() * 0.25;
        this.column(b, r, s * (x + w / 2), w, fz, bz, h);
        tops.push({ x0: Math.min(s * x, s * (x + w)), x1: Math.max(s * x, s * (x + w)), y: h });
        x += w;
      }
      // The jamb: a rock pillar beside the way through, carrying the wall above.
      const jz0 = z0 - 0.4;
      const jh = BOARDS.wallHeight - 1 + r() * 1.6;
      this.column(b, r, s * ((gate.maxX + 0.05 + jamb) / 2), jamb - gate.maxX - 0.05, jz0, z1 + 0.2, jh);
      tops.push({ x0: Math.min(s * (gate.maxX + 0.05), s * jamb), x1: Math.max(s * (gate.maxX + 0.05), s * jamb), y: jh });
      // A fire bowl on a ledge at each end of the face.
      const fx = s * (half - 1.9);
      b.box(2.4, 0.5, 1.2, shade(ROCK, 0.85), 'flat', { x: fx, y: 8.75, z: z0 - 0.4 });
      b.box(1.3, 0.5, 1.0, 0xa8583a, 'flat', { x: fx, y: 9.25, z: z0 - 0.45, ry: Math.PI / 4 });
      b.box(0.9, 1.0, 0.7, 0xff8a1e, 'glow', { x: fx, y: 9.95, z: z0 - 0.45, ry: Math.PI / 4 });
      b.box(0.5, 1.2, 0.5, 0xffe060, 'glow', { x: fx, y: 10.1, z: z0 - 0.45 });
    }
    // Over the way through: the lintel stone, and the wall above it behind the middle board.
    b.box(jamb * 2 - 0.6, 2.4, z1 - z0 + 0.3, shade(ROCK, 0.84), 'flat', { x: 0, y: gate.height + 1.2, z: (z0 + z1) / 2 - 0.25 + 0.15 });
    const crown = BOARDS.wallHeight + 2.2;
    this.column(b, r, 0, gate.maxX * 2 + 0.6, z0 + 0.05, z1 + 0.15, crown, gate.height + 2.4);
    // THE TUSKS: two great curved bones rising from the jambs and bowing over the way.
    for (const s of [-1, 1]) {
      const segs = 9;
      let px = s * 10.1;
      let py = 0;
      for (let i = 1; i <= segs; i += 1) {
        const t = i / segs;
        const nx = s * (10.1 - 4.4 * t * t);
        const ny = 12.9 * Math.sin((t * Math.PI) / 2);
        const len = Math.hypot(nx - px, ny - py);
        const thick = 1.0 - t * 0.45;
        b.box(thick, len + 0.12, thick, shade(BONE_WHITE, 0.94 + (i % 2) * 0.06), 'flat', { x: (px + nx) / 2, y: (py + ny) / 2, z: z0 - 0.7, rz: -Math.atan2(nx - px, ny - py) });
        px = nx;
        py = ny;
      }
      b.box(1.5, 0.8, 1.5, shade(BONE_WHITE, 0.8), 'flat', { x: s * 10.1, y: 0.3, z: z0 - 0.7 });
    }
    // Vines down the face in the gaps between the boards and at its ends.
    for (const s of [-1, 1]) {
      hangingVine(b, r, s * 9.25, topAt(s * 9.25) - 0.44, z0 - 0.3, 8 + r() * 3);
      hangingVine(b, r, s * 28.4, topAt(s * 28.4) - 0.44, z0 - 0.3, 14 + r() * 8);
      hangingVine(b, r, s * 29.5, topAt(s * 29.5) - 0.44, z0 - 0.3, 8 + r() * 6);
    }
    // The way-out board between the tusks' tips, on the lintel.
    this.board(b, 'x', z0 - 0.25, 1, 0, gate.height + 1.1, 10, 1.8);
    // On top: turf, a great skull looking down on the lobby, trees and ferns.
    skull(b, r, 0, (z0 + z1) / 2 + 0.4, 1.4, Math.PI, BONE_WHITE, crown + 0.44);
    [-22.5, -13, 14, 23.5].forEach((x, i) => (i % 2 ? araucaria : broadleaf)(b, r, x, topAt(x), (z0 + z1) / 2 + 0.5, 0.95));
    for (const x of [-27, 27]) fern(b, r, x, topAt(x), z0 + 1.2, 1.3);
    // The LEADERBOARDS board across the top.
    this.board(b, 'x', z0, 1, 0, BOARDS.wallHeight - 2.3, 16.5, 3.4);
    // Planting along the foot, clear of the way through.
    for (const x of [-27, -21, 21, 27]) bush(b, r, x, 0, z0 - 1.6, 1.0, 2);
    for (const x of [-15, 15]) giantLeaves(b, r, x, 0, z0 - 1.8, 1.1);
  }

  /**
   * One column of cliff: strata stacked to `h` (from `y0`), each band a
   * slightly different stone, all flush on the face; a turf cap on top.
   */
  private column(b: PartBuilder, r: Rand, x: number, w: number, fz: number, bz: number, h: number, y0 = -0.3): void {
    const bands = Math.max(2, Math.round((h - y0) / 7));
    let y = y0;
    for (let i = 0; i < bands; i += 1) {
      const y1 = i === bands - 1 ? h : y0 + ((h - y0) * (i + 1)) / bands + (r() - 0.5) * 1.2;
      b.box(w, y1 - y, bz - fz, shade(ROCK, i % 2 ? 0.9 : 1.02 + r() * 0.05), 'flat', { x, y: (y + y1) / 2, z: (fz + bz) / 2 });
      y = y1;
    }
    b.box(w, 0.44, bz - fz + 0.3, shade(TURF, 0.95 + r() * 0.1), 'flat', { x, y: h + 0.22, z: (fz + bz) / 2 });
  }

  // --------------------------------------------------------------- paddock

  /**
   * THE PADDOCK: an earth terrace (the ground storey) and a rock shelf above
   * it (the upper storey), stone steps cut up both ends, the dinosaurs on
   * their plinths, vines down the shelf's face, and behind it all the east
   * cliff with a fall into a pool on the shelf.
   */
  private buildPaddock(b: PartBuilder, r: Rand): void {
    const g = PADDOCK.ground;
    const u = PADDOCK.upper;
    const tone = valueNoise(21);
    const floor = (walkFrom: number, walkTo: number, pool: boolean) => (x: number, z: number): Cell => {
      const h = tileHash(x, z, 31);
      if (pool && x > u.maxX - 6.6 && Math.abs(z - POOL_Z) < 3.4) return { color: LOOK.floor[0], liquid: 'water', liquidColor: WATER };
      if (x >= walkFrom && x <= walkTo) return { color: shade(LOOK.soil, h < 0.3 ? 0.93 : 1) };
      const t = tone(x * 0.08, z * 0.08);
      const color = t < 0.35 ? LOOK.floor[2] : t > 0.68 ? LOOK.floor[1] : LOOK.floor[0];
      return { color: h < 0.07 ? shade(color, 0.92) : color };
    };
    // The ground storey: painted on its solid's top, an earth skirt down its sides.
    const lower = paintTerrain({ minX: g.minX, maxX: g.maxX, minZ: g.minZ, maxZ: g.maxZ, y: g.top, paint: floor(g.padX - 3.3, g.padX + 3.3, false), skirtTo: -0.05, skirtColor: LOOK.bank });
    b.addPainted(lower.ground, 'stud');
    // The upper storey: a rock shelf in three strata, each stepping back from the face, its turf painted on top.
    const cuts = [-0.3, 3.8, 6.4, u.top - 0.5];
    for (let m = 0; m < 3; m += 1) {
      const inset = m * 0.2;
      b.box(PADDOCK.backX + 0.6 - (u.minX + inset), cuts[m + 1]! - cuts[m]!, u.maxZ - u.minZ - inset * 2, shade(ROCK, m % 2 ? 0.86 : 1), 'flat', {
        x: (u.minX + inset + PADDOCK.backX + 0.6) / 2,
        y: (cuts[m]! + cuts[m + 1]!) / 2,
        z: (u.minZ + u.maxZ) / 2,
      });
    }
    const upper = paintTerrain({ minX: u.minX, maxX: PADDOCK.backX + 0.6, minZ: u.minZ, maxZ: u.maxZ, y: u.top, paint: floor(u.padX - 3.3, u.padX + 3.3, true), skirtTo: u.top - 0.5, skirtColor: TURF, bank: LOOK.bank });
    b.addPainted(upper.ground, 'stud');
    if (upper.water) this.waters.push(upper.water);
    // Vines down the shelf's face between the upper pads, ferns along its lip.
    for (let z = u.minZ + 4; z < u.maxZ - 2; z += 9) hangingVine(b, r, u.minX - 0.3, u.top, z + 4.5, 2.5 + r() * 4);
    for (let z = u.minZ + 2; z < u.maxZ; z += 4.5) {
      if (DINO_PADS.some((p) => p.storey === 1 && Math.abs(p.z - z) < p.half + 0.8)) continue;
      (r() < 0.5 ? flowers : grassTuft)(b, r, u.minX + 0.8, u.top, z, 1);
    }
    // Stone steps up both ends.
    for (const stair of PADDOCK_STAIRS) {
      stairBoxes(stair).forEach((tread, i) => {
        b.box(tread.maxX - tread.minX, tread.maxY + 0.3, tread.maxZ - tread.minZ, shade(ROCK, i % 2 ? 0.9 : 1.02), 'flat', {
          x: (tread.minX + tread.maxX) / 2,
          y: (tread.maxY - 0.3) / 2,
          z: (tread.minZ + tread.maxZ) / 2,
        });
      });
    }
    // Each pad's stone frame; its coloured plate is per rider (see buildStatues).
    for (const pad of DINO_PADS) b.box(pad.half * 2 + 0.6, 0.12, pad.half * 2 + 0.6, 0x6a6052, 'flat', { x: pad.x, y: pad.y + 0.06, z: pad.z });
    // The shelf's back: ferns and bushes behind the statues' tails.
    for (let z = u.minZ + 3; z < u.maxZ - 2; z += 6) {
      if (Math.abs(z - POOL_Z) < 5) continue;
      (r() < 0.5 ? fern : giantLeaves)(b, r, PADDOCK.backX - 2.5 - r() * 2, u.top, z + r() * 2, 1.2);
    }
    reeds(b, r, PADDOCK.backX - 7.2, u.top, POOL_Z + 3, 0.9);
    lilyPads(b, r, PADDOCK.backX - 3.5, u.top - 0.1, POOL_Z, 0.8);
    // THE EAST CLIFF behind the paddock, with a sign rock and the fall into the pool.
    const face = PADDOCK.backX;
    const wall: WallTier[] = [
      { depth: 2.4, height: [12.5, 14.5], color: ROCK },
      { depth: 4, height: [19, 23], color: shade(ROCK, 0.95) },
      { depth: 10, height: [27, 33], color: shade(ROCK, 1.08) },
    ];
    const south = terrainWall(b, r, { run: 'z', face, out: 1, from: HUB.minZ - 14, to: PADDOCK_SIGN_Z - 10, tiers: wall, cap: TURF, vines: 0.5 });
    const north = terrainWall(b, r, { run: 'z', face, out: 1, from: PADDOCK_SIGN_Z + 10, to: HUB.maxZ + HUB_BACK_WALL_DEPTH + 12, tiers: wall, cap: TURF, vines: 0.5 });
    this.signRock(b, r, 'z', face + 0.4, 1, PADDOCK_SIGN_Z - 10, PADDOCK_SIGN_Z + 10, 30, 12);
    this.board(b, 'z', face + 0.4, 1, PADDOCK_SIGN_Z, u.top + 13, 23, 5.4);
    this.falls.push(...cascade(b, r, north, face, 1, POOL_Z, 4.4, u.top - 0.1, FALL));
    plantLedges(b, r, [...south, ...north], LOOK, this.mobile);
    for (let i = 0; i < 5; i += 1) jungleGiant(b, r, face + 24 + r() * 10, 0, HUB.minZ + 4 + i * 20 + r() * 6, 1.2 + r() * 0.3);
    // Ferns at the ends of the ground storey.
    fern(b, r, g.minX + 1.8, g.top, g.minZ + 1.4, 1.1);
    fern(b, r, g.minX + 1.8, g.top, g.maxZ - 1.4, 1.1);
  }

  private buildStatues(): void {
    for (const pad of DINO_PADS) {
      const tier = DINOS[pad.slot - 1]!;
      const dino = createDino(tier.look, this.mobile ? 'medium' : 'high');
      const plinth = plinthOf(pad.slot);
      dino.root.position.set(pad.statueX, pad.y + 0.55, pad.z);
      dino.root.rotation.y = -Math.PI / 2;
      if (dino.saddle) dino.saddle.visible = false;
      this.root.add(dino.root);
      // The status plate - red, green when affordable, gold when owned, cyan when
      // ridden - on the pad and on the statue's base.
      const ringMaterial = this.mat(studPlastic({ color: 0xe8342a }));
      const ring = new Mesh(new BoxGeometry(pad.half * 2 - 0.2, 0.1, pad.half * 2 - 0.2), ringMaterial);
      ring.position.set(pad.x, pad.y + 0.17, pad.z);
      ring.receiveShadow = true;
      this.root.add(ring);
      const base = new Mesh(new BoxGeometry(plinth.maxX - plinth.minX, 0.4, plinth.maxZ - plinth.minZ), this.mat(studPlastic({ color: 0x7a6a58 })));
      base.position.set((plinth.minX + plinth.maxX) / 2, pad.y + 0.2, (plinth.minZ + plinth.maxZ) / 2);
      base.receiveShadow = true;
      base.castShadow = true;
      this.root.add(base);
      const top = new Mesh(new BoxGeometry(plinth.maxX - plinth.minX - 0.5, 0.15, plinth.maxZ - plinth.minZ - 0.5), ringMaterial);
      top.position.set(base.position.x, pad.y + 0.475, base.position.z);
      top.receiveShadow = true;
      this.root.add(top);
      const label = new LabelSprite(6.2, 2.64, 320);
      label.sprite.position.set(pad.statueX - 2, pad.y + dino.asset.height + 2.2, pad.z);
      this.root.add(label.sprite);
      this.labels.push(label);
      this.statues.push({ slot: pad.slot, dino, animator: new DinoAnimator(dino), motion: createMotion(), label, ring: ringMaterial, shown: '' });
    }
  }

  /**
   * The paddock reflects the local rider. EVERY dinosaur is shown in its real
   * colours - the evolution path on display - and its state is told by its
   * plate and label: red LOCKED, green when it can be afforded, gold owned,
   * cyan ridden.
   */
  setDinos(wins: number, owned: number, ridden: number): void {
    const trophy = trophyIcon(() => {
      this.statueSignature = '';
    });
    const signature = `${Math.floor(wins)}|${owned}|${ridden}|${trophy ? 1 : 0}`;
    if (signature === this.statueSignature) return;
    this.statueSignature = signature;
    for (const statue of this.statues) {
      const tier = DINOS[statue.slot - 1]!;
      const has = ownsDino(owned, statue.slot);
      statue.shown = statue.slot === ridden ? 'ridden' : has ? 'owned' : 'locked';
      const affordable = !has && wins >= tier.cost;
      statue.ring.color.setHex(statue.shown === 'ridden' ? 0x3ad8ff : has ? 0xffc81e : affordable ? 0x4ae04a : 0xe8342a);
      statue.label.set([
        { text: tier.name, color: tier.color, size: 1.1 },
        { text: `+${formatAmount(tier.damage)} Damage`, color: '#ffffff', size: 0.9 },
        statue.shown === 'ridden'
          ? { text: 'RIDING', color: '#6ae8ff', size: 0.9 }
          : has
            ? { text: 'OWNED - STEP ON TO RIDE', color: '#ffd23a', size: 0.8 }
            : tier.cost === 0
              ? { text: 'FREE', color: '#7dff6a', size: 0.9 }
              : affordable
                ? { text: `${formatWins(tier.cost)} Wins - STEP ON TO EVOLVE`, color: '#7dff6a', size: 0.8, icon: trophy }
                : { text: `LOCKED - ${formatWins(tier.cost)} Wins`, color: '#ff9a9a', size: 0.85, icon: trophy },
      ]);
    }
  }

  // -------------------------------------------------------------- training

  /**
   * THE TRAINING CLEARING: packed earth trampled bare, a fringe of grass round
   * its edge, each effigy on a stone slab; striking posts, bones and a fossil
   * along the back; a hollow-log trough; a stack of cut logs by the front cliff.
   */
  private buildTraining(b: PartBuilder, r: Rand): void {
    const T = TRAINING;
    const tone = valueNoise(41);
    const paint = (x: number, z: number): Cell => {
      const h = tileHash(x, z, 43);
      const edge = Math.min(x - T.minX, T.maxX - x, z - T.minZ, T.maxZ - z);
      if (edge < TILE) return { color: shade(LOOK.floor[0], h < 0.5 ? 1 : 0.92) };
      const t = tone(x * 0.1, z * 0.1);
      let color = t > 0.62 ? shade(PACKED, 1.05) : t < 0.3 ? shade(PACKED, 0.9) : PACKED;
      if (h < 0.08) color = shade(PACKED, 0.84);
      return { color };
    };
    const floor = paintTerrain({ minX: T.minX, maxX: T.maxX, minZ: T.minZ, maxZ: T.maxZ, y: T.floorTop, paint, skirtTo: -0.05, skirtColor: LOOK.bank });
    b.addPainted(floor.ground, 'stud');
    for (const dummy of DUMMIES) {
      b.box(dummy.half * 2.3, 0.5, dummy.half * 2.3, shade(ROCK, 0.8), 'flat', { x: dummy.x, y: T.floorTop + 0.25, z: dummy.z });
      b.box(dummy.half * 2.0, 0.56, dummy.half * 2.0, shade(ROCK, 0.62), 'flat', { x: dummy.x, y: T.floorTop + 0.28, z: dummy.z });
    }
    // The back strip, behind the heavy row: striking posts wrapped in rope, bones and a fossil.
    const backX = T.minX + 2.3;
    for (const z of [-30, -16, 0]) {
      log(b, backX, T.floorTop, z, 3.4, 0.36, 0x8a5a2e, false);
      b.box(1.0, 0.5, 1.0, 0xd8b070, 'flat', { x: backX, y: T.floorTop + 2.2, z });
      b.box(1.0, 0.5, 1.0, 0xd8b070, 'flat', { x: backX, y: T.floorTop + 1.1, z });
    }
    bonePile(b, r, backX, -23, 0.9, T.floorTop);
    skull(b, r, backX + 0.5, -8, 0.7, Math.PI / 2, BONE_WHITE, T.floorTop);
    fossilSlab(b, r, backX, 7, 1, Math.PI / 2, T.floorTop);
    // The feed trough: a hollowed log heaped with fruit and leaves, on its solid.
    const t = FEED_TROUGH;
    const tx = (t.minX + t.maxX) / 2;
    const tz = (t.minZ + t.maxZ) / 2;
    b.box(t.maxX - t.minX - 0.4, 1.6, t.maxZ - t.minZ, 0x8a5a2e, 'flat', { x: tx, y: t.minY + 0.8, z: tz });
    b.box(t.maxX - t.minX - 1.2, 0.3, t.maxZ - t.minZ - 0.8, 0x4a2e18, 'flat', { x: tx, y: t.minY + 1.62, z: tz });
    for (let i = 0; i < 9; i += 1) b.box(0.55, 0.55, 0.55, [0xff4a3a, 0xff9a2a, 0xffd23a][i % 3]!, 'flat', { x: tx + (r() - 0.5) * 3, y: t.minY + 1.95, z: tz + (r() - 0.5) * 4.4, ry: r() });
    for (let i = 0; i < 4; i += 1) b.box(1.6, 0.12, 0.7, shade(0x4fbf3a, 0.9 + r() * 0.2), 'leaf', { x: tx + (r() - 0.5) * 2.4, y: t.minY + 1.86, z: tz + (r() - 0.5) * 4, ry: r() * 3, rz: 0.2 });
    // Cut logs stacked by the front cliff, on their solid.
    const c = TRAINING_CRATES;
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    for (const [dz, y] of [[-0.5, 0.45], [0.5, 0.45], [0, 1.35]] as const) {
      b.box(c.maxX - c.minX, 0.9, 0.9, shade(0x8a5a2e, 0.9 + r() * 0.2), 'flat', { x: cx, y, z: cz + dz });
      for (const s of [-1, 1]) b.box(0.08, 0.7, 0.7, 0xd8b070, 'flat', { x: cx + s * ((c.maxX - c.minX) / 2 + 0.03), y, z: cz + dz });
    }
    // The strip between the clearing and the west cliff: its two great trees, rocks, ferns, a fallen log.
    for (const z of [-22, -4]) {
      rock(b, r, -66, 0, z, 1.1, ROCK);
      fern(b, r, -64.6, 0, z + 2, 1.2);
      bromeliad(b, r, -67.4, 0, z - 1.6, 0.9, 0xff6a2a);
    }
    fallenLog(b, r, -66, 4, 6, 0, 0.9);
    for (const x of [-56, -44, -32]) fern(b, r, x, 0, T.minZ - 1.2, 1.0);
    for (const x of [-58, -48]) tallGrass(b, r, x, 0, T.maxZ + 2, 0.9);
  }

  private buildEffigies(): void {
    for (const dummy of DUMMIES) {
      const tier = TRAINING_TIERS[dummy.tier]!;
      const dino = createDino(tier.look, 'medium');
      // Scaled to its solid: the effigy fills the dummy's footprint, head to tail.
      const length = Math.max(0.5, dino.asset.length);
      const scale = (dummy.half * 3.1) / length;
      dino.root.scale.setScalar(scale);
      dino.root.position.set(dummy.x, TRAINING.floorTop + 0.56, dummy.z);
      dino.root.rotation.y = Math.PI / 2;
      this.root.add(dino.root);
      // The mat: a translucent square a clear step above the clearing's floor.
      const matMaterial = this.mat(new MeshBasicMaterial({ color: 0xe8c88a, transparent: true, opacity: 0.28, depthWrite: false }));
      const mat = new Mesh(new PlaneGeometry(dummy.mat * 1.45, dummy.mat * 1.45), matMaterial);
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(dummy.x, TRAINING.floorTop + 0.05, dummy.z);
      mat.renderOrder = 2;
      this.root.add(mat);
      const label = new LabelSprite(5.2, 2.08, 320);
      label.sprite.position.set(dummy.x, TRAINING.floorTop + 0.5 + Math.max(dummyHeight(dummy.half), dino.asset.height * scale) + 1.6, dummy.z);
      this.root.add(label.sprite);
      this.labels.push(label);
      this.effigies.push({ tier: dummy.tier, dino, label, mat: matMaterial, wobble: 0, wobbleYaw: 0 });
    }
    this.setRebirths(0);
  }

  /** Which dummies the local rider may train on. */
  setRebirths(rebirths: number): void {
    if (rebirths === this.rebirths) return;
    this.rebirths = rebirths;
    for (const effigy of this.effigies) {
      const tier = TRAINING_TIERS[effigy.tier]!;
      const open = rebirths >= tier.rebirthsRequired;
      effigy.mat.color.setHex(open ? 0x7dff6a : 0xff6a5a);
      effigy.label.set([
        { text: `x${tier.multiplier} Multiplier`, color: '#ffd23a', size: 1.2 },
        { text: tier.rebirthsRequired === 0 ? 'FREE' : open ? tier.name : `LOCKED - ${tier.rebirthsRequired} Rebirth${tier.rebirthsRequired === 1 ? '' : 's'}`, color: open ? '#ffffff' : '#ff9a9a', size: 0.8 },
      ]);
    }
  }

  /** A dummy takes a blow: it rocks on its base. */
  strikeDummy(tier: number, yaw: number): void {
    const effigy = this.effigies[tier];
    if (!effigy) return;
    effigy.wobble = 1;
    effigy.wobbleYaw = yaw;
  }

  // -------------------------------------------------------------- hatchery

  /**
   * THE NESTING GROUNDS: mossy earth with sand round each nest, the four nests
   * of stone and twig, a stone pad before each, ferns and bromeliads between
   * them, and the rock-rimmed pool fed by the west cliff's fall.
   */
  private buildHatchery(b: PartBuilder, r: Rand): void {
    const H = HATCHERY;
    const tone = valueNoise(51);
    const paint = (x: number, z: number): Cell => {
      const h = tileHash(x, z, 53);
      if (EGG_PLACEMENTS.some((p) => Math.abs(x - p.x) < H.nestHalf + 1.6 && z > H.padZ - H.padHalf - 1 && z < H.nestZ + H.nestHalf + 1)) return { color: shade(SAND, h < 0.4 ? 0.95 : 1) };
      const t = tone(x * 0.1, z * 0.1);
      const color = t < 0.4 ? 0x5cb845 : t > 0.7 ? 0x86c95a : 0x6ec04e;
      return { color: h < 0.07 ? shade(color, 0.9) : color };
    };
    const floor = paintTerrain({ minX: H.minX, maxX: H.maxX, minZ: H.minZ, maxZ: H.maxZ, y: 0.3, paint, skirtTo: -0.05, skirtColor: LOOK.bank });
    b.addPainted(floor.ground, 'stud');
    for (const placement of EGG_PLACEMENTS) {
      nest(b, r, placement.x, H.nestZ, H.nestHalf, H.nestTop, 0.3);
      stonePad(b, placement.x, 0.3, H.padZ, H.padHalf, 0xc8bca8, 0x7a6e5e);
    }
    for (let i = 0; i < EGG_PLACEMENTS.length - 1; i += 1) {
      const x = (EGG_PLACEMENTS[i]!.x + EGG_PLACEMENTS[i + 1]!.x) / 2;
      fern(b, r, x, 0.3, H.nestZ + 1.5, 1.1);
      bromeliad(b, r, x, 0.3, H.padZ - 1, 0.8, [0xe84aa8, 0xff8a2a, 0x9a5ae8][i % 3]);
    }
    for (const placement of EGG_PLACEMENTS) giantLeaves(b, r, placement.x + 3.5, 0.3, H.maxZ - 1.3, 0.9);
    // The pool at the grounds' end: a rim of rock round water fed by the fall.
    const pool = HATCHERY_POOL;
    const rim = 0.9;
    const water = paintTerrain({ minX: HUB.minX - 0.3, maxX: pool.maxX - rim + 0.05, minZ: pool.minZ + rim - 0.05, maxZ: pool.maxZ - rim + 0.05, y: pool.maxY + 0.05, paint: () => ({ color: 0, liquid: 'water', liquidColor: WATER }) });
    b.addPainted(water.ground, 'stud');
    if (water.water) this.waters.push(water.water);
    const rimY = pool.maxY + 0.3;
    b.box(rim, rimY + 0.3, pool.maxZ - pool.minZ, shade(ROCK, 0.95), 'flat', { x: pool.maxX - rim / 2, y: (rimY - 0.3) / 2, z: (pool.minZ + pool.maxZ) / 2 });
    for (const z of [pool.minZ + rim / 2, pool.maxZ - rim / 2]) b.box(pool.maxX - rim - HUB.minX + 0.3, rimY + 0.3, rim, shade(ROCK, 0.9), 'flat', { x: (HUB.minX - 0.3 + pool.maxX - rim) / 2, y: (rimY - 0.3) / 2, z });
    for (let i = 0; i < 6; i += 1) rock(b, r, pool.maxX - 0.4, rimY - 0.3, pool.minZ + 1.5 + i * 2.6, 0.45, ROCK);
    horsetails(b, r, pool.maxX + 1.5, 0, pool.minZ + 1, 1.1);
    cattails(b, r, pool.maxX + 1.2, 0, pool.maxZ - 1.5, 1.1);
  }

  private buildEggs(): void {
    EGGS.forEach((egg, index) => {
      const placement = EGG_PLACEMENTS[index]!;
      const map = worldTextures.eggShell(egg.color, egg.speckle);
      const lava = egg.id === 4;
      const material = this.mat(
        new MeshStandardMaterial({
          map,
          roughness: 0.55,
          metalness: 0,
          emissive: lava ? new Color(0xff4a0a) : new Color(0x000000),
          emissiveMap: lava ? map : null,
          emissiveIntensity: lava ? 0.9 : 0,
        }),
      );
      const shell = new Mesh(new SphereGeometry(1.8, 20, 16), material);
      shell.scale.set(1, 1.32, 1);
      // Seated in the nest's bowl.
      shell.position.set(placement.x, HATCHERY.nestTop + 1.8 * 1.32 - 0.25, HATCHERY.nestZ);
      shell.castShadow = true;
      this.root.add(shell);
      this.eggs.push(shell);
      const label = new LabelSprite(5.4, 2.16, 300);
      label.sprite.position.set(placement.x, HATCHERY.nestTop + 6.8, HATCHERY.nestZ);
      label.set([
        { text: egg.name, color: '#ffffff', size: 1.1 },
        { text: `${formatWins(egg.cost)} Wins`, color: '#ffd23a', size: 0.9, icon: trophyIcon() },
      ]);
      this.root.add(label.sprite);
      this.labels.push(label);
      const glow = new Mesh(
        new PlaneGeometry(HATCHERY.padHalf * 1.8, HATCHERY.padHalf * 1.8),
        this.mat(new MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false })),
      );
      glow.rotation.x = -Math.PI / 2;
      // A clear step over the pad's slab (0.3 floor + 0.36 slab).
      glow.position.set(placement.x, 0.72, HATCHERY.padZ);
      glow.renderOrder = 2;
      this.root.add(glow);
    });
  }

  // ----------------------------------------------------------------- lobby

  /**
   * THE LOBBY: the pond and its shore, the fossil rocks either side of it, the
   * pole torches along the trails, the camp's great trees, and deliberate
   * clusters on the grass - never on a trail, a pad or a mat.
   */
  private buildLobby(b: PartBuilder, r: Rand): void {
    // The pond: lily pads, reeds at its edge, rocks on its shore, a log fallen across a corner.
    lilyPads(b, r, -4, -0.1, POND.z + 1, 1.1);
    lilyPads(b, r, 5, -0.1, POND.z - 1.5, 0.9);
    reeds(b, r, -8.2, -0.95, POND.z - 2, 1);
    reeds(b, r, 8.4, -0.95, POND.z + 1.5, 1);
    for (const [x, z, s] of [[-9.8, -26, 0.9], [10.2, -27.5, 0.8], [-6.5, -24.6, 0.6], [7, -24.8, 0.55]] as const) rock(b, r, x, 0, z, s, ROCK);
    cattails(b, r, -10.5, 0, -28.5, 1.1);
    cattails(b, r, 10.8, 0, -30.5, 1.1);
    // The fossil rocks on their solids: stepped rock, a skull on top, bones set in the pond-side face.
    for (const [i, box] of FOSSIL_DISPLAYS.entries()) {
      const cx = (box.minX + box.maxX) / 2;
      const cz = (box.minZ + box.maxZ) / 2;
      const tops = rockFormation(b, r, cx, cz, box.maxX - box.minX, box.maxZ - box.minZ, box.maxY - 0.6, ROCK, TURF);
      const inward = i === 0 ? 1 : -1;
      skull(b, r, cx, cz - 0.6, 0.62, Math.PI, BONE_WHITE, tops[0]!.y);
      for (let k = 0; k < 3; k += 1) bone(b, cx + inward * ((box.maxX - box.minX) / 2 + 0.12), 1.2 + k * 0.9, cz - 2.5 + k * 2.2, 1.8, 0.14, Math.PI / 2, 0.3 - k * 0.3);
      fern(b, r, cx + inward * 2.4, 0, box.maxZ + 1.2, 1.1);
    }
    // The pole torches along the trails.
    for (const [x, z] of HUB_TORCHES) torch(b, x, z, 4.6);
    // The camp's great trees, each trunk on its solid.
    for (const [x, z, scale] of HUB_TREES) broadleaf(b, r, x, 0, z, scale * 2);
    // Clusters on the grass.
    this.cluster(b, r, 14, -19, 'ferns');
    this.cluster(b, r, -13, -19, 'flowers');
    this.cluster(b, r, 12.5, 8, 'log');
    this.cluster(b, r, -12.5, 8, 'ferns');
    this.cluster(b, r, 13, 20, 'bones');
    this.cluster(b, r, -12, 19, 'leaves');
    this.cluster(b, r, 18, 41.5, 'leaves');
    this.cluster(b, r, -12.5, 41, 'flowers');
    this.cluster(b, r, 8.5, -21.5, 'shore');
    this.cluster(b, r, -8.5, -21.5, 'shore');
    this.cluster(b, r, 38, 44, 'ferns');
  }

  private cluster(b: PartBuilder, r: Rand, x: number, z: number, kind: 'ferns' | 'log' | 'bones' | 'flowers' | 'leaves' | 'shore'): void {
    switch (kind) {
      case 'ferns':
        rock(b, r, x, 0, z, 1.0, ROCK);
        fern(b, r, x + 1.6, 0, z + 1.2, 1.2);
        fern(b, r, x - 1.4, 0, z - 1.4, 1.0);
        bromeliad(b, r, x + 0.4, 0, z - 2.2, 0.8, 0xff6a2a);
        break;
      case 'log':
        bigFallenTree(b, r, x, z, 6, 0.25, 0.6);
        fern(b, r, x + 2, 0, z - 2.8, 1.0);
        mushrooms(b, r, x - 1.8, 0, z + 3, 0.9);
        break;
      case 'bones':
        bonePile(b, r, x, z, 0.9);
        rock(b, r, x + 2.2, 0, z - 1, 0.8, ROCK);
        fern(b, r, x - 2, 0, z + 1, 0.9);
        break;
      case 'flowers':
        bush(b, r, x, 0, z, 1.0, 3);
        flowers(b, r, x + 1.8, 0, z + 1.6, 1.1);
        flowers(b, r, x - 1.5, 0, z - 1.8, 1, 0xffd23a);
        break;
      case 'leaves':
        giantLeaves(b, r, x, 0, z, 1.1);
        bromeliad(b, r, x + 2, 0, z - 1.2, 0.9, 0xe84aa8);
        stump(b, r, x - 1.8, z + 0.6, 0.9);
        break;
      case 'shore':
        rock(b, r, x, 0, z, 0.8, ROCK);
        grassTuft(b, r, x + 1.2, 0, z + 0.6, 1.1, 0xb8d84a);
        branch(b, r, x - 0.6, z - 0.4, 2.8, 1.2, 0.8);
        break;
    }
  }

  // ------------------------------------------------------------------ water

  /** Every still water and every fall of the valley, merged onto the shared water materials. */
  private buildWater(): void {
    const add = (parts: BufferGeometry[], material: Material, name: string): void => {
      if (!parts.length) return;
      const merged = mergeGeometries(parts, false);
      for (const g of parts) g.dispose();
      if (!merged) return;
      const mesh = new Mesh(merged, material);
      mesh.name = name;
      mesh.renderOrder = 1;
      this.root.add(mesh);
    };
    add(this.waters, waterSurface(), 'park-water');
    add(this.falls, waterfallSurface(), 'park-falls');
  }

  // ------------------------------------------------------------------ signs

  private buildSigns(): void {
    // On the leaderboard cliff: its name across the top, the way out on the lintel.
    this.sign(15, 2.8, [{ text: 'LEADERBOARDS', size: 1, fill: '#ffffff', stroke: '#2a1206', strokeWidth: 0.2 }], 0, BOARDS.wallHeight - 2.3, HUB.maxZ - 0.38, Math.PI);
    this.sign(9.2, 1.4, [{ text: 'STAGE 1  >>', size: 1, fill: '#ffd23a', stroke: '#1a0a06', strokeWidth: 0.2 }], 0, HUB_GATE.height + 1.1, HUB.maxZ - 0.62, Math.PI);
    // On the sign rocks, each on its lashed board.
    this.sign(22, 4.4, [{ text: 'EVOLVE YOUR DINO', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], PADDOCK.backX + 0.4 - 0.38, PADDOCK.upper.top + 13, PADDOCK_SIGN_Z, -Math.PI / 2);
    this.sign(18, 4.2, [{ text: 'TRAINING GROUNDS', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], HUB.minX - 0.8 + 0.38, 12, TRAINING_SIGN_Z, Math.PI / 2);
    this.sign(16, 3.8, [{ text: 'HATCHERY', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], HATCHERY_SIGN_X, 13, HUB.maxZ + 0.8 - 0.38, Math.PI);
  }

  private sign(w: number, h: number, lines: ConstructorParameters<typeof CanvasSign>[2], x: number, y: number, z: number, ry: number): void {
    const sign = new CanvasSign(w, h, lines);
    sign.mesh.position.set(x, y, z);
    sign.mesh.rotation.y = ry;
    this.root.add(sign.mesh);
    this.signs.push(sign);
  }

  private mat<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  update(delta: number, px = SPAWN.x, pz = SPAWN.z): void {
    this.time += delta;
    this.frame += 1;
    tickWater(delta);
    // Statues breathe and look about; far ones (and every other frame on a phone) rest.
    for (const statue of this.statues) {
      const p = statue.dino.root.position;
      if (Math.hypot(p.x - px, p.z - pz) > 120) continue;
      if (this.mobile && (this.frame + statue.slot) % 2 === 1) continue;
      statue.animator.update(this.mobile ? delta * 2 : delta, statue.motion);
    }
    for (const effigy of this.effigies) {
      if (effigy.wobble <= 0) continue;
      effigy.wobble = Math.max(0, effigy.wobble - delta * 2.4);
      const k = effigy.wobble * effigy.wobble;
      const swing = Math.sin(this.time * 34) * 0.12 * k;
      effigy.dino.root.rotation.set(Math.cos(effigy.wobbleYaw) * swing, Math.PI / 2, -Math.sin(effigy.wobbleYaw) * swing);
    }
    for (const egg of this.eggs) egg.rotation.z = Math.sin(this.time * 1.6 + egg.position.x) * 0.06;
  }

  dispose(): void {
    for (const statue of this.statues) statue.dino.dispose();
    for (const effigy of this.effigies) effigy.dino.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const label of this.labels) label.dispose();
    for (const material of this.materials) material.dispose();
    this.scoreboard.dispose();
    this.root.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh && !(mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) mesh.geometry.dispose();
    });
    this.root.removeFromParent();
  }
}

/** Where the signs hang: the training board on the west cliff, the paddock's on the east, the hatchery's on the back. */
const TRAINING_SIGN_Z = (TRAINING.minZ + TRAINING.maxZ) / 2;
const PADDOCK_SIGN_Z = -14;
const HATCHERY_SIGN_X = -46;
/** The pool on the paddock's shelf, at the foot of the east fall. */
const POOL_Z = 4;

/** Distance from a point to a segment on the ground plane. */
const segmentDistance = (x: number, z: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
};
