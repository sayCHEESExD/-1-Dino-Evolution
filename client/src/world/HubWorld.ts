import {
  ARENA,
  BOARDS,
  DINOS,
  DINO_PADS,
  DUMMIES,
  EGGS,
  EGG_PLACEMENTS,
  ENTRANCE,
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
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
} from 'three';
import { isMobileGpu } from '../config/device.js';
import { DinoAnimator, createMotion, type DinoMotion } from '../dinos/DinoAnimator.js';
import { createDino, type DinoInstance } from '../dinos/DinoModel.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { studPlastic } from '../render/Studs.js';
import { CanvasSign } from './CanvasSign.js';
import { DecalBuilder } from './Decals.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import { araucaria, broadleaf, bush, cliff, fern, grassTuft, horsetails, palm, rock, seeded, shade, type Rand } from './Nature.js';
import {
  bone,
  bonePile,
  crates,
  fallenLog,
  fossilSlab,
  log,
  nest,
  pillar,
  skeletonDisplay,
  skull,
  stonePad,
  stump,
  torch,
} from './ParkProps.js';
import { Scoreboard } from './Scoreboard.js';
import { worldTextures } from './WorldTextures.js';

/** The lobby palette, from the reference: bright studded plastic throughout. */
const LAWN = 0x5ccd3c;
const GRASS = 0x5fcf3e;
const PLAZA = 0xaabed8;
const PLAZA_DARK = 0x8fa4c0;
const KERB = 0x6c7d96;
const DIRT = 0xa8703a;
const WALL_STONE = 0xd4cdb8;
const STONE = 0x9aa0aa;
const STONE_DARK = 0x5f6672;
const TIMBER = 0x9a6232;
const TIMBER_DARK = 0x6a4020;

/** The cross path from the training grounds to the paddock: its centre and half-width. */
const CROSS_Z = 4;
const CROSS_HALF = 5;
/** Height of the courtyard's and the park's walls, and of the tall stone behind the terraces. */
const PARK_WALL = 26;
/** Where the TRAINING GROUNDS sign hangs on the west wall, and the stretch kept clear in front of it. */
const TRAINING_SIGN_Z = (TRAINING.minZ + TRAINING.maxZ) / 2;
const TRAINING_SIGN_CLEAR: readonly [number, number] = [TRAINING_SIGN_Z - 15, TRAINING_SIGN_Z + 15];

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
 * THE PARK: the hub every run starts from, compact and dressed like a Roblox
 * lobby.
 *
 *   centre   the spawn plate in the open lobby; behind it the PARK GATE, shut
 *            in the front wall - two timber towers, a crossbeam
 *   left     the EVOLUTION PADDOCK: two storeys of the thirteen rideable
 *            dinosaurs on plinths, in their real colours whether owned or not
 *   right    the TRAINING GROUNDS: seven carved dinosaur effigies to attack
 *   back-r   the HATCHERY: four eggs on their nests
 *   back     the LEADERBOARD WALL, the archway to Stage 1 under its middle board
 *
 * Everything solid is drawn exactly on a solid from the shared map; every
 * decoration stands on the surface under it (ground, storey, training floor
 * or a wall's turf top), never floating, never sunk.
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
  private readonly flames: MeshBasicMaterial[] = [];
  private readonly water: MeshBasicMaterial[] = [];
  private time = 0;
  private statueSignature = '';
  private rebirths = -1;
  private readonly mobile = isMobileGpu();
  private frame = 0;

  constructor() {
    this.root.name = 'park';
    this.root.add(this.scoreboard.root);
    const b = new PartBuilder();
    const decals = new DecalBuilder();
    const r = seeded(0x9a7c);
    this.buildGround(b, decals, r);
    this.buildWalls(b, r);
    this.buildEntrance(b, r);
    this.buildPaddock(b, r);
    this.buildTraining(b, decals, r);
    this.buildHatchery(b, r);
    this.buildLeaderboardWall(b, r);
    this.buildLawns(b, r);
    this.root.add(b.build('park-static'));
    for (const mesh of decals.build()) this.root.add(mesh);
    this.buildStatues();
    this.buildEffigies();
    this.buildEggs();
    this.buildSigns();
  }

  // ---------------------------------------------------------------- ground

  /** A studded floor laid ON another surface: offset in depth, never lifted, so it neither hovers nor flickers. */
  private overlay(color: number): MeshLambertMaterial {
    return this.mat(studPlastic({ color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  }

  private plane(material: Material, x: number, z: number, w: number, d: number, y: number): Mesh {
    const mesh = new Mesh(new PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /**
   * THE LOBBY FLOOR, as the reference: studded lawn, and pale blue-grey
   * studded paths - the courtyard square, the avenue and the cross path - with
   * darker kerbs; darker and paler grass patches break the lawn up.
   */
  private buildGround(b: PartBuilder, decals: DecalBuilder, r: Rand): void {
    const w = HUB.maxX - HUB.minX + 80;
    const d = HUB.maxZ - HUB.minZ + 80;
    this.plane(this.mat(studPlastic({ color: LAWN })), (HUB.minX + HUB.maxX) / 2, (HUB.minZ + HUB.maxZ) / 2, w, d, 0);
    const plaza = this.overlay(PLAZA);
    // The avenue from the park gate to the leaderboard wall, and the cross path.
    this.plane(plaza, 0, (ENTRANCE.maxZ + HUB.maxZ) / 2, 20, HUB.maxZ - ENTRANCE.maxZ, 0);
    this.plane(plaza, (TRAINING.maxX + PADDOCK.ground.minX) / 2, CROSS_Z, PADDOCK.ground.minX - TRAINING.maxX, CROSS_HALF * 2, 0);
    // Kerbs: a low dark edge along each path, broken where paths meet and round the spawn plate.
    const kerb = (x0: number, x1: number, z0: number, z1: number): void => {
      b.box(Math.max(0.6, x1 - x0), 0.16, Math.max(0.6, z1 - z0), KERB, 'stud', { x: (x0 + x1) / 2, y: 0.08, z: (z0 + z1) / 2 });
    };
    for (const s of [-1, 1]) {
      kerb(s * 10.3 - 0.3, s * 10.3 + 0.3, ENTRANCE.maxZ, CROSS_Z - CROSS_HALF);
      kerb(s * 10.3 - 0.3, s * 10.3 + 0.3, CROSS_Z + CROSS_HALF, HUB.maxZ);
    }
    kerb(10.6, PADDOCK.ground.minX, CROSS_Z - CROSS_HALF - 0.6, CROSS_Z - CROSS_HALF);
    kerb(10.6, PADDOCK.ground.minX, CROSS_Z + CROSS_HALF, CROSS_Z + CROSS_HALF + 0.6);
    kerb(TRAINING.maxX, -10.6, CROSS_Z + CROSS_HALF, CROSS_Z + CROSS_HALF + 0.6);
    kerb(TRAINING.maxX, -10.6, CROSS_Z - CROSS_HALF - 0.6, CROSS_Z - CROSS_HALF);
    // THE SPAWN PLATE: a Roblox spawn pad laid flush in the avenue - a dark rim,
    // a gold field and a three-toed dinosaur footprint.
    decals.patch(SPAWN.x, 0, SPAWN.z, 11, 11, 0x3a4458);
    decals.patch(SPAWN.x, 0, SPAWN.z, 9.6, 9.6, 0xffc81e);
    decals.patch(SPAWN.x, 0, SPAWN.z - 1.2, 3.2, 2.6, 0x8a5a1e);
    for (const [dx, dz, ry] of [[-1.3, 1.1, 0.45], [0, 1.6, 0], [1.3, 1.1, -0.45]] as const) {
      decals.patch(SPAWN.x + dx, 0, SPAWN.z + dz, 0.9, 2.4, 0x8a5a1e, ry);
    }
    // Grass patches on the lawns (never on a path).
    const patches: readonly (readonly [number, number])[] = [
      [16, -18],
      [17, 22],
      [-15, -18],
      [-15, 16],
      [-66, -12],
      [-66, 30],
      [60, 44],
    ];
    for (const [x, z] of patches) decals.patch(x, 0, z, 4 + r() * 3, 3 + r() * 3, shade(LAWN, r() < 0.5 ? 0.86 : 1.1), r() * Math.PI);
  }

  // ----------------------------------------------------------------- walls

  /**
   * A park wall the reference's way: a front terrace of brown dirt with a grass
   * top, and behind it a taller wall of pale studded stone, also grass-topped.
   * Returns the terrace's and the wall's turf heights, for what grows on them.
   */
  private terraceWall(b: PartBuilder, r: Rand, minX: number, maxX: number, minZ: number, maxZ: number, height: number, inward: 'x+' | 'x-' | 'z+' | 'z-'): { front: Box2; back: Box2; frontTop: number; backTop: number } {
    const alongX = inward === 'z+' || inward === 'z-';
    const thick = alongX ? maxZ - minZ : maxX - minX;
    const whole: Box2 = { minX, maxX, minZ, maxZ };
    if (thick < 8) {
      const top = cliff(b, r, minX, maxX, minZ, maxZ, height, WALL_STONE, GRASS);
      return { front: whole, back: whole, frontTop: top, backTop: top };
    }
    const depth = thick * 0.42;
    const front: Box2 = { ...whole };
    const back: Box2 = { ...whole };
    if (inward === 'x+') {
      front.minX = maxX - depth;
      back.maxX = front.minX;
    } else if (inward === 'x-') {
      front.maxX = minX + depth;
      back.minX = front.maxX;
    } else if (inward === 'z+') {
      front.minZ = maxZ - depth;
      back.maxZ = front.minZ;
    } else {
      front.maxZ = minZ + depth;
      back.minZ = front.maxZ;
    }
    const frontTop = cliff(b, r, front.minX, front.maxX, front.minZ, front.maxZ, height * 0.4, DIRT, GRASS);
    const backTop = cliff(b, r, back.minX, back.maxX, back.minZ, back.maxZ, height, WALL_STONE, GRASS);
    return { front, back, frontTop, backTop };
  }

  private buildWalls(b: PartBuilder, r: Rand): void {
    const west = this.terraceWall(b, r, HUB.minX - 12, HUB.minX, HUB.minZ, HUB.maxZ + 4, PARK_WALL, 'x+');
    const east = this.terraceWall(b, r, HUB.maxX, HUB.maxX + 12, HUB.minZ, HUB.maxZ + 4, PARK_WALL, 'x-');
    const south = this.terraceWall(b, r, HUB.minX, HUB.maxX, HUB.minZ - 12, HUB.minZ, PARK_WALL, 'z+');
    // Trees planted ON the terraces, standing on their turf: rows along each wall.
    const plant = (area: Box2, top: number, count: number, alongX: boolean, scale: number, keepClear?: readonly [number, number]): void => {
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.5) / count;
        const x = alongX ? area.minX + t * (area.maxX - area.minX) : (area.minX + area.maxX) / 2;
        const z = alongX ? (area.minZ + area.maxZ) / 2 : area.minZ + t * (area.maxZ - area.minZ);
        // Nothing grows in front of a sign.
        if (keepClear && z > keepClear[0] && z < keepClear[1]) continue;
        const pickTree = i % 3;
        if (pickTree === 0) broadleaf(b, r, x, top, z, scale);
        else if (pickTree === 1) araucaria(b, r, x, top, z, scale * 0.8);
        else bush(b, r, x, top, z, scale * 1.3, 2);
      }
    };
    plant(west.front, west.frontTop, 9, false, 1.0, TRAINING_SIGN_CLEAR);
    plant(east.front, east.frontTop, 9, false, 1.0);
    // The front terrace, clear of the park gate set into it.
    const southLeft: Box2 = { ...south.front, maxX: -ENTRANCE.towerOuter - 3 };
    const southRight: Box2 = { ...south.front, minX: ENTRANCE.towerOuter + 3 };
    plant(southLeft, south.frontTop, 5, true, 1.0);
    plant(southRight, south.frontTop, 6, true, 1.0);
    plant(west.back, west.backTop, 7, false, 1.2, TRAINING_SIGN_CLEAR);
    plant(east.back, east.backTop, 7, false, 1.2);
    // The back wall either side of the leaderboard wall.
    const bwLeft = cliff(b, r, HUB.minX, -BOARDS.wallHalf, HUB.maxZ, HUB.maxZ + 4, 24, WALL_STONE, GRASS);
    cliff(b, r, BOARDS.wallHalf, HUB.maxX, HUB.maxZ, HUB.maxZ + 4, 24, WALL_STONE, GRASS);
    for (let i = 0; i < 3; i += 1) araucaria(b, r, -BOARDS.wallHalf - 8 - i * 12, bwLeft, HUB.maxZ + 2, 0.9);
  }

  // -------------------------------------------------------------- entrance

  /**
   * THE PARK GATE, set into the front wall behind the spawn with its doors
   * shut: two banded timber towers on stone footings with fire baskets, a
   * crossbeam carrying the park's name, and the great doors between them -
   * everything on the gate's solids against the wall face.
   */
  private buildEntrance(b: PartBuilder, r: Rand): void {
    const z0 = ENTRANCE.minZ;
    const z1 = ENTRANCE.maxZ;
    const zc = (z0 + z1) / 2;
    const d = z1 - z0;
    const H = ENTRANCE.towerHeight;
    for (const s of [-1, 1]) {
      const x0 = s * ENTRANCE.openHalf;
      const x1 = s * ENTRANCE.towerOuter;
      const xc = (x0 + x1) / 2;
      const w = Math.abs(x1 - x0);
      b.box(w, 5, d, STONE, 'stud', { x: xc, y: 2.5, z: zc });
      b.box(w + 0.3, 0.8, d, STONE_DARK, 'stud', { x: xc, y: 5.2, z: zc });
      b.box(w - 1, H - 5.6, d - 0.4, TIMBER, 'stud', { x: xc, y: 5.6 + (H - 5.6) / 2, z: zc - 0.2 });
      for (let y = 9; y < H - 2; y += 4.5) b.box(w - 0.4, 1.0, d - 0.2, TIMBER_DARK, 'stud', { x: xc, y, z: zc - 0.1 });
      for (const dx of [-1, 1]) b.box(1.2, H - 5.6, d, TIMBER_DARK, 'stud', { x: xc + dx * (w / 2 - 0.6), y: 5.6 + (H - 5.6) / 2, z: zc });
      b.box(w + 0.4, 1.2, d, TIMBER_DARK, 'stud', { x: xc, y: H - 0.6, z: zc });
      b.box(w - 2, 1.0, d - 0.6, STONE_DARK, 'stud', { x: xc, y: H + 0.5, z: zc });
      this.flame(xc, H + 1.0, zc, 1.4);
      torch(b, s * (ENTRANCE.towerOuter + 1.4), z1 + 0.6, 5);
    }
    // The shut doors, flush against the wall: planks, cross braces, iron studs.
    const doorH = ENTRANCE.beamBottom;
    const planks = 8;
    const span = ENTRANCE.openHalf * 2;
    for (let i = 0; i < planks; i += 1) {
      b.box(span / planks - 0.02, doorH, 0.8, shade(TIMBER, 0.9 + r() * 0.15), 'stud', { x: -ENTRANCE.openHalf + (span / planks) * (i + 0.5), y: doorH / 2, z: z0 + 0.4 });
    }
    for (const y of [3, doorH - 3]) b.box(span, 0.9, 1.0, TIMBER_DARK, 'stud', { x: 0, y, z: z0 + 0.5 });
    b.box(0.5, doorH, 1.05, TIMBER_DARK, 'stud', { x: 0, y: doorH / 2, z: z0 + 0.5 });
    for (const sx of [-1, 1]) b.box(0.9, doorH * 0.85, 1.0, TIMBER_DARK, 'stud', { x: (sx * ENTRANCE.openHalf) / 2, y: doorH / 2, z: z0 + 0.5, rz: sx * 0.62 });
    // The crossbeam and the name board on it.
    b.box(ENTRANCE.towerOuter * 2 + 2, 1.4, 1.6, TIMBER_DARK, 'stud', { x: 0, y: ENTRANCE.beamBottom + 0.7, z: z0 + 0.8 });
    b.box(ENTRANCE.openHalf * 2 + 4, ENTRANCE.beamTop - ENTRANCE.beamBottom - 1.4, 1.2, TIMBER, 'stud', { x: 0, y: (ENTRANCE.beamBottom + 1.4 + ENTRANCE.beamTop) / 2, z: z0 + 0.6 });
    b.box(ENTRANCE.openHalf * 2 + 5, 0.8, 1.6, TIMBER_DARK, 'stud', { x: 0, y: ENTRANCE.beamTop + 0.4, z: z0 + 0.8 });
    // Ferns and grass banked at the gate's feet.
    for (const sx of [-1, 1]) {
      fern(b, r, sx * (ENTRANCE.towerOuter + 3.5), 0, z1 + 1.2, 1.2);
      grassTuft(b, r, sx * (ENTRANCE.towerOuter + 5.5), 0, z1 + 2.5, 1.2);
    }
  }

  // --------------------------------------------------------------- paddock

  private buildPaddock(b: PartBuilder, r: Rand): void {
    const g = PADDOCK.ground;
    const u = PADDOCK.upper;
    // The ground storey: a studded terrace with a kerbed front edge.
    b.box(g.maxX - g.minX, g.top, g.maxZ - g.minZ, PLAZA, 'stud', { x: (g.minX + g.maxX) / 2, y: g.top / 2, z: (g.minZ + g.maxZ) / 2 });
    b.box(0.6, g.top + 0.2, g.maxZ - g.minZ, KERB, 'stud', { x: g.minX + 0.3, y: (g.top + 0.2) / 2, z: (g.minZ + g.maxZ) / 2 });
    // The upper storey: a solid terrace, its face a darker stone band.
    b.box(u.maxX - u.minX, u.top, u.maxZ - u.minZ, PLAZA_DARK, 'stud', { x: (u.minX + u.maxX) / 2, y: u.top / 2, z: (u.minZ + u.maxZ) / 2 });
    b.box(0.5, u.top, u.maxZ - u.minZ, KERB, 'stud', { x: u.minX - 0.25, y: u.top / 2, z: (u.minZ + u.maxZ) / 2 });
    b.box(0.9, 0.8, u.maxZ - u.minZ, STONE_DARK, 'stud', { x: u.minX - 0.2, y: u.top - 0.4, z: (u.minZ + u.maxZ) / 2 });
    for (let z = u.minZ + 1; z <= u.maxZ - 1; z += 9) pillar(b, u.minX + 0.6, z, 1.2, 0.7, STONE_DARK);
    for (const stair of PADDOCK_STAIRS) {
      for (const tread of stairBoxes(stair)) {
        b.box(tread.maxX - tread.minX, tread.maxY, tread.maxZ - tread.minZ, shade(PLAZA, 0.92 + (Math.round(tread.maxY * 2) % 2) * 0.08), 'stud', {
          x: (tread.minX + tread.maxX) / 2,
          y: tread.maxY / 2,
          z: (tread.minZ + tread.maxZ) / 2,
        });
      }
    }
    // The backdrop: a stone wall with a waterfall down it into a pool on the upper storey.
    const backTop = cliff(b, r, PADDOCK.backX, HUB.maxX, u.minZ - 4, u.maxZ + 4, 30, WALL_STONE, GRASS);
    const fall = this.mat(new MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: 0.8, side: DoubleSide }));
    this.water.push(fall);
    const waterfall = new Mesh(new PlaneGeometry(6, 30 - u.top), fall);
    waterfall.position.set(PADDOCK.backX - 0.05, u.top + (30 - u.top) / 2, CROSS_Z);
    waterfall.rotation.y = -Math.PI / 2;
    this.root.add(waterfall);
    const pool = new Mesh(new PlaneGeometry(6, 8), this.mat(new MeshBasicMaterial({ color: 0x3ab4ff, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(PADDOCK.backX - 3, u.top, CROSS_Z);
    this.root.add(pool);
    b.box(6.6, 0.4, 0.5, STONE_DARK, 'stud', { x: PADDOCK.backX - 3, y: u.top + 0.2, z: CROSS_Z - 4.25 });
    b.box(6.6, 0.4, 0.5, STONE_DARK, 'stud', { x: PADDOCK.backX - 3, y: u.top + 0.2, z: CROSS_Z + 4.25 });
    b.box(0.5, 0.4, 9, STONE_DARK, 'stud', { x: PADDOCK.backX - 6.25, y: u.top + 0.2, z: CROSS_Z });
    for (let i = 0; i < 4; i += 1) broadleaf(b, r, (PADDOCK.backX + HUB.maxX) / 2, backTop, u.minZ + 6 + i * 22, 1.0);
    // Each pad's dark frame; its coloured plate is per rider (see buildStatues).
    for (const pad of DINO_PADS) b.box(pad.half * 2 + 0.6, 0.12, pad.half * 2 + 0.6, STONE_DARK, 'stud', { x: pad.x, y: pad.y + 0.06, z: pad.z });
    // Greenery along the upper storey's back, behind the statues' tails, and the storeys' ends.
    for (const z of [-30, 18, 34]) broadleaf(b, r, u.maxX - 3, u.top, z, 1.0);
    for (let i = 0; i < 8; i += 1) fern(b, r, u.maxX - 2 - r() * 3, u.top, u.minZ + 3 + i * 10 + r() * 3, 1.3);
    fern(b, r, g.minX + 2, g.top, g.minZ + 1.5, 1.1);
    fern(b, r, g.minX + 2, g.top, g.maxZ - 1.5, 1.1);
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
      // ridden - on the pad and on the statue's base, as the reference's coloured bases.
      const ringMaterial = this.mat(studPlastic({ color: 0xe8342a }));
      const ring = new Mesh(new BoxGeometry(pad.half * 2 - 0.2, 0.1, pad.half * 2 - 0.2), ringMaterial);
      ring.position.set(pad.x, pad.y + 0.17, pad.z);
      ring.receiveShadow = true;
      this.root.add(ring);
      const base = new Mesh(new BoxGeometry(plinth.maxX - plinth.minX, 0.4, plinth.maxZ - plinth.minZ), this.mat(studPlastic({ color: 0x3a3f48 })));
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

  private buildTraining(b: PartBuilder, decals: DecalBuilder, r: Rand): void {
    const T = TRAINING;
    const cx = (T.minX + T.maxX) / 2;
    const cz = (T.minZ + T.maxZ) / 2;
    // The yard: a studded floor on its solid, kerbed round its edge.
    b.box(T.maxX - T.minX, T.floorTop, T.maxZ - T.minZ, PLAZA, 'stud', { x: cx, y: T.floorTop / 2, z: cz });
    for (const z of [T.minZ + 0.3, T.maxZ - 0.3]) b.box(T.maxX - T.minX, T.floorTop + 0.2, 0.6, KERB, 'stud', { x: cx, y: (T.floorTop + 0.2) / 2, z });
    for (const x of [T.minX + 0.3, T.maxX - 0.3]) b.box(0.6, T.floorTop + 0.2, T.maxZ - T.minZ, KERB, 'stud', { x, y: (T.floorTop + 0.2) / 2, z: cz });
    // Each dummy's base: a dark block platform on its solid.
    for (const dummy of DUMMIES) {
      b.box(dummy.half * 2.3, 0.5, dummy.half * 2.3, STONE_DARK, 'stud', { x: dummy.x, y: T.floorTop + 0.25, z: dummy.z });
      b.box(dummy.half * 2.0, 0.56, dummy.half * 2.0, 0x2e323a, 'stud', { x: dummy.x, y: T.floorTop + 0.28, z: dummy.z });
    }
    // Floor variation: a worn dirt patch under each mat's edge.
    for (const dummy of DUMMIES) decals.patch(dummy.x + dummy.half + 2, T.floorTop, dummy.z, 3.2, dummy.half * 2.4, shade(PLAZA, 0.9), 0);
    // The back strip, behind the heavy row: training posts, bones and a fossil.
    const backX = T.minX + 2.3;
    for (const z of [-30, -16, 0]) {
      log(b, backX, T.floorTop, z, 3.2, 0.35, TIMBER, false);
      b.box(2.4, 0.5, 0.5, TIMBER_DARK, 'flat', { x: backX, y: T.floorTop + 2.4, z });
      b.box(1.1, 1.1, 1.1, 0xe8c060, 'flat', { x: backX, y: T.floorTop + 1.6, z: z + 0.1 });
    }
    bonePile(b, r, backX, -23, 0.9);
    skull(b, r, backX + 0.5, -8, 0.7, Math.PI / 2);
    fossilSlab(b, r, backX, 7, 1, Math.PI / 2);
    // The feed trough and hay on its solid, crates by the entrance on theirs.
    const trough = FEED_TROUGH;
    b.box(trough.maxX - trough.minX, 1.4, trough.maxZ - trough.minZ, TIMBER, 'stud', { x: (trough.minX + trough.maxX) / 2, y: trough.minY + 0.7, z: (trough.minZ + trough.maxZ) / 2 });
    b.box(trough.maxX - trough.minX - 0.6, 0.8, trough.maxZ - trough.minZ - 0.6, 0xf2d24a, 'stud', { x: (trough.minX + trough.maxX) / 2, y: trough.minY + 1.6, z: (trough.minZ + trough.maxZ) / 2 });
    const crateBox = TRAINING_CRATES;
    crates(b, r, (crateBox.minX + crateBox.maxX) / 2, (crateBox.minZ + crateBox.maxZ) / 2, 1);
    // Round the yard on the lawn: the west strip between the yard and the park wall, and its ends.
    for (const z of [-22, -4, 26]) {
      rock(b, r, -66, 0, z, 1.1);
      fern(b, r, -66 + 1.5, 0, z + 2, 1.2);
    }
    fallenLog(b, r, -66, 4, 6, 0, 0.9);
    horsetails(b, r, -66, 0, -38, 1);
    for (const x of [-56, -44, -32]) fern(b, r, x, 0, T.minZ - 2, 1.1);
    for (const x of [-58, -40]) grassTuft(b, r, x, 0, T.maxZ + 2, 1.2);
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
      const matMaterial = this.mat(new MeshBasicMaterial({ color: 0xe8c88a, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
      const mat = new Mesh(new PlaneGeometry(dummy.mat * 1.45, dummy.mat * 1.45), matMaterial);
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(dummy.x, TRAINING.floorTop, dummy.z);
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

  private buildHatchery(b: PartBuilder, r: Rand): void {
    const H = HATCHERY;
    b.box(H.maxX - H.minX, 0.3, H.maxZ - H.minZ, PLAZA_DARK, 'stud', { x: (H.minX + H.maxX) / 2, y: 0.15, z: (H.minZ + H.maxZ) / 2 });
    for (const placement of EGG_PLACEMENTS) {
      nest(b, r, placement.x, H.nestZ, H.nestHalf, H.nestTop);
      stonePad(b, placement.x, 0.3, H.padZ, H.padHalf, 0xb8c4d8, 0x6c7d96);
    }
    // Ferns between and behind the nests, standing on the hatchery floor.
    for (let i = 0; i < EGG_PLACEMENTS.length - 1; i += 1) fern(b, r, (EGG_PLACEMENTS[i]!.x + EGG_PLACEMENTS[i + 1]!.x) / 2, 0.3, H.nestZ + 2, 1.1);
    for (let i = 0; i < EGG_PLACEMENTS.length; i += 1) grassTuft(b, r, EGG_PLACEMENTS[i]!.x + 3, 0.3, H.maxZ - 1.2, 1);
    // The pool at the hatchery's end, on its rim solid, fed by a fall down the terrace face.
    const pool = HATCHERY_POOL;
    b.box(pool.maxX - pool.minX, pool.maxY, pool.maxZ - pool.minZ, STONE, 'stud', { x: (pool.minX + pool.maxX) / 2, y: pool.maxY / 2, z: (pool.minZ + pool.maxZ) / 2 });
    const water = this.mat(new MeshBasicMaterial({ color: 0x3ab4ff, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    this.water.push(water);
    this.plane(water, (pool.minX + pool.maxX) / 2, (pool.minZ + pool.maxZ) / 2, pool.maxX - pool.minX - 1, pool.maxZ - pool.minZ - 1, pool.maxY);
    const fallHeight = PARK_WALL * 0.4;
    const falls = new Mesh(new PlaneGeometry(4, fallHeight), this.mat(new MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: 0.8, side: DoubleSide })));
    falls.position.set(HUB.minX + 0.05, fallHeight / 2, (pool.minZ + pool.maxZ) / 2);
    falls.rotation.y = Math.PI / 2;
    this.root.add(falls);
    horsetails(b, r, pool.maxX + 1.5, 0, pool.minZ + 1, 1.1);
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
        this.mat(new MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })),
      );
      glow.rotation.x = -Math.PI / 2;
      // On top of the pad's slab (0.3 floor + 0.36 slab).
      glow.position.set(placement.x, 0.66, HATCHERY.padZ);
      glow.renderOrder = 2;
      this.root.add(glow);
    });
  }

  // ------------------------------------------------------- leaderboard wall

  /**
   * THE LEADERBOARD WALL, the whole back of the lobby: a tall wall of pale
   * studded stone with a timber frame, stone pillars between the three boards,
   * torches, a grass top with crossed fossil bones over the middle - and, under
   * the middle board, the timber archway out to Stage 1. The boards themselves
   * are the Scoreboard's, mounted on its face.
   */
  private buildLeaderboardWall(b: PartBuilder, r: Rand): void {
    const H = BOARDS.wallHeight;
    const z0 = HUB.maxZ;
    const depth = HUB_BACK_WALL_DEPTH;
    const zc = z0 + depth / 2;
    const half = BOARDS.wallHalf;
    const gate = HUB_GATE;
    // The wall: two full-height wings either side of the archway, and the block over it.
    for (const s of [-1, 1]) {
      const x0 = s * gate.maxX;
      const x1 = s * half;
      b.box(Math.abs(x1 - x0), H, depth, WALL_STONE, 'stud', { x: (x0 + x1) / 2, y: H / 2, z: zc });
    }
    b.box(gate.maxX * 2, H - gate.height, depth, WALL_STONE, 'stud', { x: 0, y: (gate.height + H) / 2, z: zc });
    // A dark stone plinth band along its foot, a timber band under the boards and one along its top.
    for (const s of [-1, 1]) b.box(half - gate.maxX, 2.4, 0.6, STONE_DARK, 'stud', { x: (s * (half + gate.maxX)) / 2, y: 1.2, z: z0 - 0.3 });
    b.box(half * 2, 1.0, 0.7, TIMBER_DARK, 'stud', { x: 0, y: BOARDS.centreY - BOARDS.height / 2 - 1.9, z: z0 - 0.35 });
    b.box(half * 2 + 1, 1.2, depth + 1, TIMBER_DARK, 'stud', { x: 0, y: H - 0.6, z: zc });
    b.box(half * 2 + 1, 1.1, depth + 1, GRASS, 'flat', { x: 0, y: H + 0.55, z: zc });
    const grassTop = H + 1.1;
    // Stone pillars between and beside the boards, each carrying a torch.
    const pillarXs = [-(BOARDS.width + 1.5 + BOARDS.width / 2) - 0.5, -(BOARDS.width / 2 + 1.75), BOARDS.width / 2 + 1.75, BOARDS.width + 1.5 + BOARDS.width / 2 + 0.5];
    for (const x of pillarXs) {
      b.box(2.2, H - 1.2, 1.2, STONE, 'stud', { x, y: (H - 1.2) / 2, z: z0 - 0.6 });
      b.box(2.8, 1.2, 1.6, STONE_DARK, 'stud', { x, y: H - 1.8, z: z0 - 0.8 });
      b.box(1.0, 0.6, 1.2, 0x2a2420, 'flat', { x, y: 9.3, z: z0 - 1.6 });
      b.box(0.7, 0.9, 0.7, 0xff8a1e, 'glow', { x, y: 10.05, z: z0 - 1.6, ry: Math.PI / 4 });
    }
    // Crossed fossil bones and a pair of ferns on the grass over the middle board.
    bone(b, -1.4, grassTop + 0.5, z0 + 1.5, 7, 0.34, 0, 0.55);
    bone(b, 1.4, grassTop + 0.5, z0 + 1.5, 7, 0.34, 0, -0.55);
    for (const sx of [-1, 1]) fern(b, r, sx * (half - 3), grassTop, z0 + 2, 1.3);
    // THE ARCHWAY to Stage 1: timber posts and a lintel under the middle board.
    for (const s of [-1, 1]) log(b, s * (gate.maxX + 0.7), 0, z0 - 0.7, gate.height + 1, 0.8, TIMBER_DARK, false);
    b.box(gate.maxX * 2 + 3.4, 1.4, 1.6, TIMBER_DARK, 'stud', { x: 0, y: gate.height + 0.7, z: z0 - 0.7 });
    // Planting along the foot of the back wall, clear of the archway.
    for (const x of [-24, 24, 59, 66, 73]) bush(b, r, x, 0, HUB.maxZ - 1.6, 1.0, 2);
  }

  // ----------------------------------------------------------------- lawns

  /**
   * The lawns between the paths and the areas: trees and torches on their
   * solids, the fossil skeletons, and clusters of prehistoric dressing - never
   * on a path, a pad or a mat.
   */
  private buildLawns(b: PartBuilder, r: Rand): void {
    HUB_TREES.forEach(([x, z, scale], i) => {
      if (i % 3 === 0) araucaria(b, r, x, 0, z, scale);
      else if (i % 3 === 1) broadleaf(b, r, x, 0, z, scale * 1.1);
      else palm(b, r, x, 0, z, scale);
    });
    for (const [x, z] of HUB_TORCHES) torch(b, x, z, 4.6);
    for (const [i, box] of FOSSIL_DISPLAYS.entries()) {
      skeletonDisplay(b, r, (box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2, (box.maxX - box.minX) / 3.2, i === 0 ? Math.PI : 0);
    }
    // East lawn (avenue to paddock).
    this.cluster(b, r, 16.5, -18, 'ferns');
    this.cluster(b, r, 16, 18, 'log');
    this.cluster(b, r, 16.5, 29, 'bones');
    // West lawn (avenue to training), narrower: smaller clusters.
    this.cluster(b, r, -15.5, -18, 'bush');
    this.cluster(b, r, -15.5, 16, 'ferns');
    // Beside the paddock stairs, and flanking the park gate at the front.
    this.cluster(b, r, 36, 44, 'bush');
    this.cluster(b, r, 24, -31, 'ferns');
    this.cluster(b, r, -24, -31, 'log');
  }

  private cluster(b: PartBuilder, r: Rand, x: number, z: number, kind: 'ferns' | 'log' | 'bones' | 'bush'): void {
    switch (kind) {
      case 'ferns':
        rock(b, r, x, 0, z, 1.0);
        fern(b, r, x + 1.6, 0, z + 1.2, 1.2);
        fern(b, r, x - 1.4, 0, z - 1.4, 1.0);
        grassTuft(b, r, x + 0.4, 0, z - 2.2, 1.1);
        break;
      case 'log':
        fallenLog(b, r, x, z, 5, 0.25, 0.8);
        fern(b, r, x + 2, 0, z - 2.5, 1.0);
        grassTuft(b, r, x - 1.8, 0, z + 2.8, 1.1);
        break;
      case 'bones':
        bonePile(b, r, x, z, 0.9);
        rock(b, r, x + 2.2, 0, z - 1, 0.8);
        fern(b, r, x - 2, 0, z + 1, 0.9);
        break;
      case 'bush':
        bush(b, r, x, 0, z, 1.0, 3);
        rock(b, r, x + 1.8, 0, z + 1.6, 0.7);
        grassTuft(b, r, x - 1.5, 0, z - 1.8, 1.0);
        break;
    }
  }

  // ------------------------------------------------------------------ signs

  private buildSigns(): void {
    const zc = (ENTRANCE.minZ + ENTRANCE.maxZ) / 2;
    // On the park gate's name board, facing the lobby.
    this.sign(20, 3.2, [{ text: 'DINO EVOLUTION', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], 0, (ENTRANCE.beamBottom + 1.4 + ENTRANCE.beamTop) / 2, ENTRANCE.minZ + 1.22, 0);
    // On the leaderboard wall: the wall's name over its top band, the way out on the archway's lintel.
    this.sign(15, 2.8, [{ text: 'LEADERBOARDS', size: 1, fill: '#ffffff', stroke: '#2a1206', strokeWidth: 0.2 }], 0, BOARDS.wallHeight - 2.3, HUB.maxZ - 0.02, Math.PI);
    this.sign(12, 1.3, [{ text: 'STAGE 1  >>', size: 1, fill: '#ffd23a', stroke: '#1a0a06', strokeWidth: 0.2 }], 0, HUB_GATE.height + 0.7, HUB.maxZ - 1.52, Math.PI);
    // On the paddock's backdrop wall, the west wall's stone and the back wall.
    this.sign(24, 4.4, [{ text: 'EVOLUTION PADDOCK', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], PADDOCK.backX - 0.02, PADDOCK.upper.top + 14, -14, -Math.PI / 2);
    this.sign(24, 4.4, [{ text: 'TRAINING GROUNDS', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], HUB.minX - 12 * 0.42 + 0.02, 18, TRAINING_SIGN_Z, Math.PI / 2);
    this.sign(18, 3.6, [{ text: 'HATCHERY', size: 1, fill: '#ffd23a', stroke: '#2a1206', strokeWidth: 0.2 }], (HATCHERY.minX + HATCHERY.maxX) / 2, 14, HUB.maxZ - 0.02, Math.PI);
  }

  private sign(w: number, h: number, lines: ConstructorParameters<typeof CanvasSign>[2], x: number, y: number, z: number, ry: number): void {
    const sign = new CanvasSign(w, h, lines);
    sign.mesh.position.set(x, y, z);
    sign.mesh.rotation.y = ry;
    this.root.add(sign.mesh);
    this.signs.push(sign);
  }

  private flame(x: number, y: number, z: number, size: number): void {
    const material = this.mat(new MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
    this.flames.push(material);
    const outer = new Mesh(new BoxGeometry(size * 1.2, size * 2, size * 1.2), material);
    outer.rotation.y = Math.PI / 4;
    outer.position.set(x, y + size, z);
    this.root.add(outer);
  }

  private mat<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  update(delta: number, px = SPAWN.x, pz = SPAWN.z): void {
    this.time += delta;
    this.frame += 1;
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
    for (const flame of this.flames) flame.opacity = 0.75 + Math.sin(this.time * 11 + flame.uuid.charCodeAt(0)) * 0.15;
    for (const water of this.water) water.opacity = 0.72 + Math.sin(this.time * 3) * 0.06;
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

interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
