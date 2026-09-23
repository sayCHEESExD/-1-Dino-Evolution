import type { Aabb } from '../types/math.js';
import { DINO_COUNT } from './dinos.js';
import { EGGS } from './pets.js';
import { TRAINING_TIERS } from './training.js';

/**
 * THE MAP, as pure data. Every coordinate in the game lives here; collision
 * (shared, both sides) and the client's visuals both read it, so the thing a
 * player walks on and the thing they see cannot drift apart.
 *
 * Axes: +Z runs from the park entrance toward the wild stages. The spawn faces
 * +Z, so the camera's RIGHT is world -X and its LEFT is world +X:
 *
 *   - the SPAWN is in the open lobby, a waterfall and its pond behind it at the
 *     foot of the front cliff (-Z);
 *   - the EVOLUTION PADDOCK, two storeys of dinosaurs, is on the LEFT (+X);
 *   - the TRAINING GROUNDS are on the RIGHT (-X), the HATCHERY behind them;
 *   - the whole BACK WALL (+Z) is the LEADERBOARD WALL: three great boards side
 *     by side, the archway out to Stage 1 beneath the middle one.
 *
 * The central avenue from gate to gate is wide and kept clear.
 */

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing, radians: 0 faces +Z, -PI/2 faces -X. */
  readonly yaw: number;
}

const aabb = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Aabb => ({ minX, maxX, minY, maxY, minZ, maxZ });

/**
 * The valley: the walkable rectangle inside the cliffs.
 * Compact on purpose: every area is a short ride from the spawn.
 */
export const HUB = { minX: -70, maxX: 84, minZ: -36, maxZ: 46 } as const;

/** The spawn: the middle of the open lobby, facing the leaderboard wall. */
export const SPAWN: Placement = { x: 0, y: 0, z: -12, yaw: 0 };

// ----------------------------------------------------- Evolution Paddock

/**
 * THE EVOLUTION PADDOCK, left of the park (+X): two storeys of display
 * plinths, every dinosaur standing on its own, facing the avenue (-X).
 *
 *   ground storey  x 22..46, top 0.6  - slots 1..7, pads at x 26.5
 *   upper storey   x 46..80, top 8.6  - slots 8..13, pads at x 50.5
 *
 * Stairs climb at both ends (z -34..-27 and 35..42). Each plinth is a solid
 * as tall as its dinosaur, so a statue is never walked through.
 */
export const PADDOCK = {
  ground: { minX: 22, maxX: 46, minZ: -27, maxZ: 35, top: 0.6, padX: 26.5, statueX: 38 },
  upper: { minX: 46, maxX: 80, minZ: -34, maxZ: 42, top: 8.6, padX: 50.5, statueX: 64 },
  groundPadZ: [-23, -14, -5, 4, 13, 22, 31],
  upperPadZ: [-18.5, -9.5, -0.5, 8.5, 17.5, 26.5],
  padHalf: 2.8,
  /** The stair lanes, z ranges; each climbs +X from x 24 to 46. */
  stairLanes: [
    [-34, -27],
    [35, 42],
  ],
  stairFromX: 24,
  stairSteps: 9,
  backX: 80,
} as const;

export interface DinoPad {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly half: number;
  /** Where the dinosaur statue stands. */
  readonly statueX: number;
  /** The storey the pad is on: 0 ground, 1 upper. */
  readonly storey: 0 | 1;
}

export const DINO_PADS: readonly DinoPad[] = (() => {
  const pads: DinoPad[] = [];
  let slot = 1;
  for (const z of PADDOCK.groundPadZ) {
    if (slot > DINO_COUNT) break;
    pads.push({ slot, x: PADDOCK.ground.padX, y: PADDOCK.ground.top, z, half: PADDOCK.padHalf, statueX: PADDOCK.ground.statueX, storey: 0 });
    slot += 1;
  }
  for (const z of PADDOCK.upperPadZ) {
    if (slot > DINO_COUNT) break;
    pads.push({ slot, x: PADDOCK.upper.padX, y: PADDOCK.upper.top, z, half: PADDOCK.padHalf, statueX: PADDOCK.upper.statueX, storey: 1 });
    slot += 1;
  }
  return pads;
})();

/**
 * A plinth's footprint and the statue's collision height, per slot: the
 * dinosaurs are displayed at their real size, so the plinths are sized to them.
 */
export const plinthOf = (slot: number): Aabb => {
  const pad = DINO_PADS[slot - 1]!;
  // Half-length along X and half-width along Z, from small to huge.
  const halfX = [2.4, 3.0, 3.6, 5.0, 3.4, 5.2, 5.0, 7.8, 6.2, 5.8, 7.6, 5.4, 8.4][slot - 1] ?? 5;
  const halfZ = [1.4, 1.5, 1.6, 2.2, 1.6, 2.6, 2.2, 2.8, 2.4, 2.3, 2.8, 2.2, 3.0][slot - 1] ?? 2.4;
  const height = [3.2, 4.2, 5.0, 6.0, 4.4, 5.6, 7.4, 8.0, 7.0, 6.6, 8.4, 6.8, 9.4][slot - 1] ?? 6;
  return aabb(pad.statueX - halfX, pad.statueX + halfX, pad.y, pad.y + height, pad.z - halfZ, pad.z + halfZ);
};

/** A stair: `steps` treads climbing from `fromY` to `toY` along +X. */
export interface Stair {
  readonly x0: number;
  readonly x1: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly fromY: number;
  readonly toY: number;
  readonly steps: number;
}

export const PADDOCK_STAIRS: readonly Stair[] = PADDOCK.stairLanes.map(([minZ, maxZ]) => ({
  x0: PADDOCK.stairFromX,
  x1: PADDOCK.upper.minX,
  minZ,
  maxZ,
  fromY: 0,
  toY: PADDOCK.upper.top,
  steps: PADDOCK.stairSteps,
}));

/** The boxes of one stair's treads, each a solid block from the ground up. */
export const stairBoxes = (stair: Stair): Aabb[] => {
  const boxes: Aabb[] = [];
  const run = (stair.x1 - stair.x0) / stair.steps;
  const rise = (stair.toY - stair.fromY) / (stair.steps + 1);
  for (let i = 1; i <= stair.steps; i += 1) {
    const minX = stair.x0 + run * (i - 1);
    boxes.push(aabb(minX, minX + run, -1, stair.fromY + rise * i, stair.minZ, stair.maxZ));
  }
  return boxes;
};

// ---------------------------------------------------------------- Training

/**
 * THE TRAINING GROUNDS, right of the park (-X): a compact yard with seven
 * carved dinosaur dummies, each on its own mat. The four lighter ones stand in
 * the front row nearest the avenue, the three heavy ones behind. Each dummy
 * faces +X, toward the players coming from the avenue.
 */
export const TRAINING = {
  minX: -62,
  maxX: -20,
  minZ: -34,
  maxZ: 20,
  floorTop: 0.3,
} as const;

export interface DummyPlacement {
  readonly tier: number;
  readonly x: number;
  readonly z: number;
  /** Half-size of the dummy's solid footprint. */
  readonly half: number;
  /** Standing within this of the dummy auto-attacks it. */
  readonly mat: number;
}

const DUMMY_SPOTS: readonly (readonly [number, number, number])[] = [
  [-28, -27, 2.2],
  [-28, -14, 2.5],
  [-28, -1, 2.7],
  [-28, 12, 2.9],
  [-50, -24, 3.3],
  [-50, -8, 3.7],
  [-50, 8, 4.1],
];

export const DUMMIES: readonly DummyPlacement[] = TRAINING_TIERS.map((tier) => {
  const spot = DUMMY_SPOTS[tier.tier]!;
  return { tier: tier.tier, x: spot[0], z: spot[1], half: spot[2], mat: spot[2] + 3.2 };
});

/** Height of a dummy's solid, above the training floor. */
export const dummyHeight = (half: number): number => 2 + half * 1.6;

// ---------------------------------------------------------------- Hatchery

/**
 * THE HATCHERY, behind the training grounds (back-right): four eggs on nests
 * of stone and fern, each with a pad in front.
 */
export const HATCHERY = {
  minX: -62,
  maxX: -16,
  minZ: 24,
  maxZ: 44,
  nestZ: 38,
  padZ: 30,
  padHalf: 3,
  nestHalf: 3.6,
  nestTop: 1.3,
  /** A hatch is accepted within this distance of the egg's pad centre. */
  serviceRadius: 9,
} as const;

export interface EggPlacement {
  readonly egg: number;
  readonly x: number;
}

export const EGG_PLACEMENTS: readonly EggPlacement[] = EGGS.map((egg, index) => ({ egg: egg.id, x: -24 - index * 11 }));

// ------------------------------------------------------------------ Boards

/**
 * THE LEADERBOARD CLIFF along the back of the valley: Top Rebirths, Top Damage and
 * Top Playtime side by side, mounted high on a cliff of banded rock facing the
 * spawn (-Z). The middle board crowns the archway out to Stage 1.
 */
export const BOARDS = {
  z: 45.2,
  centreY: 20,
  width: 15,
  height: 12,
  xs: [18.5, 0, -18.5],
  /** The wall's half-width and height. */
  wallHalf: 30,
  wallHeight: 38,
} as const;

/** The archway out to Stage 1, beneath the middle board. */
export const HUB_GATE = { minX: -8, maxX: 8, z: 46, towerOuter: 11, height: 11 } as const;
export const HUB_BACK_WALL_DEPTH = 4;

// --------------------------------------------------------------- Hub props

/** Torches along the avenue: solid posts. */
export const HUB_TORCHES: readonly (readonly [number, number])[] = [
  [-12.5, -30],
  [12.5, -30],
  [-12.5, -14],
  [12.5, -14],
  [-12.5, 14],
  [12.5, 14],
  [-12.5, 36],
  [12.5, 36],
];
export const TORCH_HALF = 0.45;

/** Big trees around the park (solid trunks): [x, z, scale]. */
export const HUB_TREES: readonly (readonly [number, number, number])[] = [
  [14, -33, 1.0],
  [-66, -30, 1.2],
  [-66, 14, 1.1],
];
export const TREE_HALF = 0.9;

/**
 * DRESSING THAT STANDS IN THE VALLEY: every piece a player could walk into is
 * a solid, listed once so the client draws exactly what collision holds. All
 * of it is clear of the avenue, the pads, the mats and the nests.
 */
/**
 * The two fossil rocks either side of the pond behind the spawn: stepped rock
 * with a skull on top and bones set in its face, each one solid.
 */
export const FOSSIL_DISPLAYS: readonly Aabb[] = [aabb(-19.5, -16.5, 0, 5, -33, -24), aabb(16.5, 19.5, 0, 5, -33, -24)];

/** A stack of cut logs by the training grounds' front corner. */
export const TRAINING_CRATES: Aabb = aabb(-19, -15, 0, 2.2, -35.6, -33.6);

/** The feed trough inside the training grounds: a hollowed log heaped with fruit. */
export const FEED_TROUGH: Aabb = aabb(-62, -57, 0.3, 2.5, 13, 19);

/** The rock-rimmed pool at the hatchery's end, fed by a fall down the west cliff. */
export const HATCHERY_POOL: Aabb = aabb(-69, -63.5, 0, 1.2, 26, 42);

export const HUB_PROP_SOLIDS: readonly Aabb[] = [
  ...FOSSIL_DISPLAYS,
  TRAINING_CRATES,
  FEED_TROUGH,
  HATCHERY_POOL,
];

// ------------------------------------------------------------------ Stages

/**
 * THE STAGE ROAD: arenas one after another along +Z, each behind a gate.
 * Every arena is its own biome; the gate out of it stays shut until its wave
 * is down.
 */
export const ARENA = {
  /** Wide enough for an Indominus to turn and a wave to spread; no wider. */
  halfWidth: 26,
  length: 72,
  /** A gate wall between two arenas. */
  gateDepth: 8,
  firstStartZ: HUB.maxZ + HUB_BACK_WALL_DEPTH,
  portalHalfWidth: 9,
  portalHeight: 15,
  wallHeight: 24,
} as const;

export const arenaStartZ = (stage: number): number => ARENA.firstStartZ + (stage - 1) * (ARENA.length + ARENA.gateDepth);
export const arenaEndZ = (stage: number): number => arenaStartZ(stage) + ARENA.length;
/** Centre z of the gate wall LEAVING a stage (into stage + 1). */
export const gateZ = (stage: number): number => arenaEndZ(stage) + ARENA.gateDepth / 2;

/**
 * THE ARENA FOREGROUND: six prop clusters per stage, hugging the side walls at
 * the entrance, the middle and the far end. Each is a solid footprint the
 * client fills with its biome's rocks, logs and trees. They stay clear of the
 * central lane, the return and reward pads and the enemy posts.
 */
export const ARENA_PROP_HEIGHT = 6;

export const arenaPropSpots = (stage: number): Aabb[] => {
  const start = arenaStartZ(stage);
  const end = arenaEndZ(stage);
  const mid = (start + end) / 2;
  const spots: Aabb[] = [];
  for (const side of [-1, 1]) {
    const inner = side * (ARENA.halfWidth - 6.5);
    const outer = side * ARENA.halfWidth;
    const minX = Math.min(inner, outer);
    const maxX = Math.max(inner, outer);
    spots.push(aabb(minX, maxX, 0, ARENA_PROP_HEIGHT, start + 2, start + 11));
    spots.push(aabb(minX, maxX, 0, ARENA_PROP_HEIGHT, mid - 4, mid + 4));
    spots.push(aabb(minX, maxX, 0, ARENA_PROP_HEIGHT, end - 24, end - 16));
  }
  return spots;
};

/** The reward pad of a stage: beside its forward gate. */
export const rewardPadOf = (stage: number): { x: number; z: number; half: number } => ({
  x: 17,
  z: arenaEndZ(stage) - 10,
  half: 4,
});

/**
 * THE WIN PLATFORM's backdrop: a stone arch standing against the stage's far
 * wall behind the reward pad, its two pillars solid. The pad in front stays open.
 */
export const REWARD_ARCH = { halfSpan: 6.5, pillar: 0.8, depth: 2, height: 12 } as const;

export const rewardArchSolids = (stage: number): Aabb[] => {
  const pad = rewardPadOf(stage);
  const z1 = arenaEndZ(stage);
  return [-1, 1].map((side) => {
    const x = pad.x + side * REWARD_ARCH.halfSpan;
    return aabb(x - REWARD_ARCH.pillar, x + REWARD_ARCH.pillar, 0, REWARD_ARCH.height, z1 - REWARD_ARCH.depth, z1);
  });
};

/** The return pad of a stage: just inside its entrance, back to the spawn. */
export const returnPadOf = (stage: number): { x: number; z: number; half: number } => ({
  x: -12,
  z: arenaStartZ(stage) + 7,
  half: 3.5,
});

// ------------------------------------------------------------------ Solids

/**
 * Every STATIC solid in the world, as boxes. Stage gates are separate
 * (`gateBox`) because whether they are solid depends on the player.
 */
export const buildStaticSolids = (stageCount: number): Aabb[] => {
  const boxes: Aabb[] = [];
  const box = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void => {
    boxes.push(aabb(minX, maxX, minY, maxY, minZ, maxZ));
  };

  // The valley.s cliffs: the front one behind the spawn and its falls, both sides.
  box(HUB.minX - 30, HUB.maxX + 30, -2, 40, HUB.minZ - 30, HUB.minZ);
  box(HUB.minX - 30, HUB.minX, -2, 40, HUB.minZ, HUB.maxZ + HUB_BACK_WALL_DEPTH);
  box(HUB.maxX, HUB.maxX + 30, -2, 40, HUB.minZ, HUB.maxZ + HUB_BACK_WALL_DEPTH);

  // The leaderboard wall across the back, with the archway to Stage 1 beneath the middle board.
  const backZ0 = HUB.maxZ;
  const backZ1 = HUB.maxZ + HUB_BACK_WALL_DEPTH;
  box(HUB.minX, -HUB_GATE.towerOuter, -2, 30, backZ0, backZ1);
  box(HUB_GATE.towerOuter, HUB.maxX, -2, 30, backZ0, backZ1);
  box(-HUB_GATE.towerOuter, HUB_GATE.minX, -2, 30, backZ0 - 1, backZ1);
  box(HUB_GATE.maxX, HUB_GATE.towerOuter, -2, 30, backZ0 - 1, backZ1);
  box(HUB_GATE.minX, HUB_GATE.maxX, HUB_GATE.height, 30, backZ0, backZ1);

  // Evolution Paddock: the two storeys, the stairs, the back wall, the statue plinths.
  const g = PADDOCK.ground;
  const u = PADDOCK.upper;
  box(g.minX, g.maxX, -1, g.top, g.minZ, g.maxZ);
  box(u.minX, u.maxX, -1, u.top, u.minZ, u.maxZ);
  for (const stair of PADDOCK_STAIRS) boxes.push(...stairBoxes(stair));
  box(PADDOCK.backX, HUB.maxX, -1, 30, u.minZ - 4, u.maxZ + 4);
  for (let slot = 1; slot <= DINO_COUNT; slot += 1) boxes.push(plinthOf(slot));

  // Training grounds: the floor and every dummy.
  box(TRAINING.minX, TRAINING.maxX, -1, TRAINING.floorTop, TRAINING.minZ, TRAINING.maxZ);
  for (const dummy of DUMMIES) {
    box(dummy.x - dummy.half, dummy.x + dummy.half, TRAINING.floorTop, TRAINING.floorTop + dummyHeight(dummy.half), dummy.z - dummy.half, dummy.z + dummy.half);
  }

  // Hatchery: the floor and the four nests.
  box(HATCHERY.minX, HATCHERY.maxX, -1, 0.3, HATCHERY.minZ, HATCHERY.maxZ);
  for (const placement of EGG_PLACEMENTS) {
    const h = HATCHERY.nestHalf;
    box(placement.x - h, placement.x + h, 0, HATCHERY.nestTop, HATCHERY.nestZ - h, HATCHERY.nestZ + h);
  }

  // Trees and torches.
  for (const [x, z, scale] of HUB_TREES) {
    const h = TREE_HALF * scale;
    box(x - h, x + h, 0, 14, z - h, z + h);
  }
  for (const [x, z] of HUB_TORCHES) box(x - TORCH_HALF, x + TORCH_HALF, 0, 5, z - TORCH_HALF, z + TORCH_HALF);

  boxes.push(...HUB_PROP_SOLIDS);

  // The stage road: walls down both sides, the gate walls, the end wall.
  const roadStart = HUB.maxZ;
  const roadEnd = arenaEndZ(stageCount) + 14;
  box(ARENA.halfWidth, ARENA.halfWidth + 30, -2, 40, roadStart, roadEnd);
  box(-ARENA.halfWidth - 30, -ARENA.halfWidth, -2, 40, roadStart, roadEnd);
  for (let stage = 1; stage < stageCount; stage += 1) {
    const z0 = arenaEndZ(stage);
    const z1 = z0 + ARENA.gateDepth;
    box(-ARENA.halfWidth, -ARENA.portalHalfWidth, -2, ARENA.wallHeight, z0, z1);
    box(ARENA.portalHalfWidth, ARENA.halfWidth, -2, ARENA.wallHeight, z0, z1);
    box(-ARENA.portalHalfWidth, ARENA.portalHalfWidth, ARENA.portalHeight, ARENA.wallHeight, z0, z1);
  }
  box(-ARENA.halfWidth, ARENA.halfWidth, -2, 40, arenaEndZ(stageCount), roadEnd);
  for (let stage = 1; stage <= stageCount; stage += 1) boxes.push(...arenaPropSpots(stage), ...rewardArchSolids(stage));

  return boxes;
};

/** The locked gate between stage `stage` and `stage + 1`: solid until the stage is cleared this run. */
export const gateBox = (stage: number): Aabb => {
  const z = gateZ(stage);
  return aabb(-ARENA.portalHalfWidth, ARENA.portalHalfWidth, -2, ARENA.portalHeight, z - 1, z + 1);
};

/** The whole walkable world, for a hard clamp that no displacement can tunnel. */
export const worldBounds = (stageCount: number): Aabb => ({
  minX: HUB.minX,
  maxX: HUB.maxX,
  minY: -5,
  maxY: 200,
  minZ: HUB.minZ,
  maxZ: arenaEndZ(stageCount),
});

// --------------------------------------------------------------- Teleports

export type TeleportId = 'spawn' | 'dinos' | 'training' | 'eggs' | `stage${number}`;

export const TELEPORTS: Readonly<Record<'spawn' | 'dinos' | 'training' | 'eggs', Placement>> = {
  spawn: SPAWN,
  dinos: { x: 15, y: 0, z: 4, yaw: Math.PI / 2 },
  training: { x: -15, y: 0, z: -8, yaw: -Math.PI / 2 },
  eggs: { x: -40, y: 0, z: 21, yaw: 0 },
};

export const stageEntry = (stage: number): Placement => ({ x: 0, y: 0, z: arenaStartZ(stage) + 5, yaw: 0 });

/** Which stage arena a point is in, or 0 for the park / a gate. */
export const stageAt = (z: number, stageCount: number): number => {
  for (let stage = 1; stage <= stageCount; stage += 1) {
    if (z >= arenaStartZ(stage) && z < arenaEndZ(stage)) return stage;
  }
  return 0;
};

export const inRect = (
  x: number,
  z: number,
  rect: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number },
): boolean => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
