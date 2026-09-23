import { arenaStartZ } from './map.js';

/**
 * THE THIRTY STAGES down the stage road, each an arena in its own prehistoric
 * biome holding a wave of wild dinosaurs and, from Stage 3 on, usually a boss.
 * Defeating EVERY dinosaur of a stage (its boss included) clears it:
 *
 *   - the gate to the next stage opens for the rest of the run;
 *   - the stage's reward pad arms, and standing on it banks the stage's Wins.
 *     NO Wins are ever paid before the wave is down.
 *
 * EVERY PLAYER FIGHTS THEIR OWN RUN (server CombatService): entering a stage
 * turns its whole wave on that player. Defeated dinosaurs stay down for the rest
 * of the run - nothing respawns on a timer. Back at the park - by a claim, a
 * death or a respawn - the run resets: gates shut, every wave back at its posts.
 *
 * A boss is SEALED for a player until they have downed every other dinosaur of
 * its stage: before that the server refuses their hits.
 *
 * Damage dealt to a stage dinosaur is the attacker's total Damage, so
 * `recommendedDamage` is the honest figure: at that Damage a wave dinosaur falls
 * in about six hits and a boss in about forty.
 */
export type StageTheme =
  | 'meadow'
  | 'grassland'
  | 'river'
  | 'swamp'
  | 'jungle'
  | 'canyon'
  | 'redwood'
  | 'cycad'
  | 'highland'
  | 'desert'
  | 'tarpit'
  | 'mangrove'
  | 'ash'
  | 'geyser'
  | 'tundra'
  | 'titanplains'
  | 'waterfall'
  | 'badlands'
  | 'petrified'
  | 'lagoon'
  | 'volcano'
  | 'amber'
  | 'facility'
  | 'paddocks'
  | 'caldera'
  | 'storm'
  | 'nightjungle'
  | 'glacier'
  | 'meteor'
  | 'summit';

export interface EnemyDef {
  /** Global id: the index into ENEMIES and the key of the replicated enemy. */
  readonly id: number;
  readonly stage: number;
  /** Bit of this enemy in its stage's kill mask. */
  readonly bit: number;
  readonly name: string;
  /** The look id the client builds (species + skin). */
  readonly look: string;
  readonly boss: boolean;
  readonly maxHp: number;
  /** Health one of its attacks takes from a player. */
  readonly damage: number;
  /** Home post: where it spawns, and where it walks back to. */
  readonly x: number;
  readonly z: number;
  /** Drawn size, relative to the look's natural size. */
  readonly scale: number;
  /** Walk speed, world units per second. */
  readonly speed: number;
  /** Radius the server tests a hit against, and its body in the crowd. */
  readonly radius: number;
  /** Seconds between its attacks. */
  readonly swingSeconds: number;
}

export interface StageDef {
  readonly index: number;
  readonly name: string;
  readonly theme: StageTheme;
  readonly recommendedDamage: number;
  /** Wins banked on the reward pad per clear. */
  readonly reward: number;
  readonly enemies: readonly EnemyDef[];
  /** Mask with every enemy's bit set: a full clear. */
  readonly fullMask: number;
  /** Mask of every non-boss enemy: what unseals the boss. */
  readonly waveMask: number;
  /** The start of the arena along the road. */
  readonly startZ: number;
}

/** [name, look, count, radius] */
type Wave = readonly (readonly [string, string, number, number])[];

interface StagePlan {
  readonly name: string;
  readonly theme: StageTheme;
  readonly damage: number;
  readonly reward: number;
  readonly wave: Wave;
  /** [name, look, radius, drawn scale] */
  readonly boss?: readonly [string, string, number, number];
}

/** Normal dinosaurs take about six recommended-Damage hits; a boss about forty. */
const HITS_PER_ENEMY = 6;
const HITS_PER_BOSS = 40;

/**
 * ENEMY DAMAGE: a share of the stage's recommended Damage per attack (player
 * health is 2x Damage), and the share itself GROWS stage by stage, so later
 * dinosaurs are not just bigger numbers but genuinely more dangerous relative
 * to the Damage they ask for. Deterministic; the server deals exactly this.
 *
 *   wave dinosaur:  6% of recommended Damage at Stage 1 ->  ~11% at Stage 30
 *   boss:          ~19% at Stage 3                     ->  ~51% at Stage 30
 */
const ENEMY_DAMAGE = 0.06;
const ENEMY_DAMAGE_RAMP = 0.03;
const BOSS_DAMAGE = 0.16;
const BOSS_DAMAGE_RAMP = 0.075;

/** The damage share of a stage's wave dinosaurs. */
export const enemyDamageShare = (stage: number): number => ENEMY_DAMAGE * (1 + ENEMY_DAMAGE_RAMP * (stage - 1));
/** The damage share of a stage's boss. */
export const bossDamageShare = (stage: number): number => BOSS_DAMAGE * (1 + BOSS_DAMAGE_RAMP * (stage - 1));

const K = 1_000;
const M = 1_000_000;
const B = 1_000_000_000;
const T = 1_000_000_000_000;

const PLANS: readonly StagePlan[] = [
  { name: 'Fern Meadow', theme: 'meadow', damage: 10, reward: 1, wave: [['Compsognathus', 'compy-wild', 3, 0.8]] },
  { name: 'Raptor Paddock', theme: 'grassland', damage: 40, reward: 5, wave: [['Raptor', 'raptor-wild', 3, 0.95]] },
  { name: 'Riverbank Crossing', theme: 'river', damage: 250, reward: 25, wave: [], boss: ['Baryonyx', 'baryonyx', 2.0, 1.15] },
  { name: 'Baryonyx Swamp', theme: 'swamp', damage: 1 * K, reward: 100, wave: [['Baryonyx', 'baryonyx', 3, 1.7]] },
  {
    name: 'Misty Fern Jungle',
    theme: 'jungle',
    damage: 3 * K,
    reward: 250,
    wave: [['Dilophosaurus', 'dilophosaurus', 4, 1.0]],
    boss: ['Monolophosaurus', 'monolophosaurus', 1.9, 1.3],
  },
  {
    name: 'Boulder Canyon',
    theme: 'canyon',
    damage: 8 * K,
    reward: 550,
    wave: [['Pachycephalosaurus', 'pachycephalosaurus', 4, 1.1]],
    boss: ['Ankylosaurus', 'ankylosaurus', 2.4, 1.3],
  },
  {
    name: 'Redwood Hollow',
    theme: 'redwood',
    damage: 20 * K,
    reward: 1.2 * K,
    wave: [['Utahraptor', 'utahraptor', 5, 1.2]],
    boss: ['Metriacanthosaurus', 'metriacanthosaurus', 2.2, 1.3],
  },
  {
    name: 'Stegosaur Valley',
    theme: 'cycad',
    damage: 50 * K,
    reward: 2.5 * K,
    wave: [['Kentrosaurus', 'kentrosaurus', 5, 1.3]],
    boss: ['Stegosaurus', 'stegosaurus', 2.6, 1.35],
  },
  {
    name: 'Horned Highlands',
    theme: 'highland',
    damage: 120 * K,
    reward: 5 * K,
    wave: [['Styracosaurus', 'styracosaurus', 5, 1.6]],
    boss: ['Sinoceratops', 'sinoceratops', 2.6, 1.35],
  },
  {
    name: 'Carnotaurus Dunes',
    theme: 'desert',
    damage: 300 * K,
    reward: 10 * K,
    wave: [['Majungasaurus', 'majungasaurus', 5, 1.5]],
    boss: ['Carnotaurus', 'carnotaurus', 2.3, 1.35],
  },
  {
    name: 'Black Tar Pits',
    theme: 'tarpit',
    damage: 750 * K,
    reward: 20 * K,
    wave: [['Dimetrodon', 'dimetrodon', 6, 1.2]],
    boss: ['Suchomimus', 'suchomimus', 2.4, 1.35],
  },
  {
    name: 'Mangrove Delta',
    theme: 'mangrove',
    damage: 1.8 * M,
    reward: 40 * K,
    wave: [['Suchomimus', 'suchomimus', 6, 1.8]],
    boss: ['River King Spinosaurus', 'spinosaurus-wild', 2.8, 1.3],
  },
  {
    name: 'Ash Plains',
    theme: 'ash',
    damage: 4.5 * M,
    reward: 75 * K,
    wave: [['Atrociraptor', 'atrociraptor', 6, 1.0]],
    boss: ['Carcharodontosaurus', 'carcharodontosaurus', 2.8, 1.35],
  },
  {
    name: 'Geyser Basin',
    theme: 'geyser',
    damage: 11 * M,
    reward: 140 * K,
    wave: [['Ceratosaurus', 'ceratosaurus-wild', 6, 1.6]],
    boss: ['Allosaurus', 'allosaurus-wild', 2.6, 1.4],
  },
  {
    name: 'Frozen Tundra',
    theme: 'tundra',
    damage: 27 * M,
    reward: 250 * K,
    wave: [['Snow Utahraptor', 'utahraptor-snow', 7, 1.2]],
    boss: ['Nanuqsaurus', 'nanuqsaurus', 2.6, 1.45],
  },
  {
    name: 'Titan Plains',
    theme: 'titanplains',
    damage: 65 * M,
    reward: 450 * K,
    wave: [['Carnotaurus', 'carnotaurus', 6, 1.7]],
    boss: ['Brachiosaurus', 'brachiosaurus', 4.2, 1.0],
  },
  {
    name: 'Thunder Falls',
    theme: 'waterfall',
    damage: 160 * M,
    reward: 800 * K,
    wave: [['Stygimoloch', 'stygimoloch', 7, 1.1]],
    boss: ['Therizinosaurus', 'therizinosaurus-wild', 2.4, 1.35],
  },
  {
    name: 'Bone Badlands',
    theme: 'badlands',
    damage: 400 * M,
    reward: 1.4 * M,
    wave: [['Majungasaurus', 'majungasaurus-bone', 7, 1.5]],
    boss: ['Tyrant Queen', 'tyrannosaurus-wild', 3.0, 1.35],
  },
  {
    name: 'Petrified Forest',
    theme: 'petrified',
    damage: 1 * B,
    reward: 2.4 * M,
    wave: [['Atrociraptor', 'atrociraptor', 7, 1.0]],
    boss: ['Giganotosaurus', 'giganotosaurus', 3.1, 1.35],
  },
  {
    name: 'Coral Lagoon',
    theme: 'lagoon',
    damage: 2.5 * B,
    reward: 4 * M,
    wave: [['Baryonyx', 'baryonyx-lagoon', 8, 1.7]],
    boss: ['Sarcosuchus', 'sarcosuchus', 3.0, 1.4],
  },
  {
    name: 'Volcano Slopes',
    theme: 'volcano',
    damage: 6 * B,
    reward: 6.5 * M,
    wave: [['Lava Ceratosaurus', 'ceratosaurus-lava', 8, 1.6]],
    boss: ['Magma Carcharodontosaurus', 'carcharodontosaurus-magma', 2.9, 1.4],
  },
  {
    name: 'Amber Grove',
    theme: 'amber',
    damage: 15 * B,
    reward: 10 * M,
    wave: [['Pyroraptor', 'pyroraptor-wild', 8, 1.0]],
    boss: ['Golden Therizinosaurus', 'therizinosaurus-gold', 2.5, 1.4],
  },
  {
    name: 'Abandoned Research Site',
    theme: 'facility',
    damage: 37 * B,
    reward: 16 * M,
    wave: [['Tagged Velociraptor', 'raptor-tagged', 8, 0.95]],
    boss: ['Prototype Indoraptor', 'indoraptor-proto', 2.2, 1.35],
  },
  {
    name: 'Overgrown Paddocks',
    theme: 'paddocks',
    damage: 90 * B,
    reward: 25 * M,
    wave: [['Stygimoloch', 'stygimoloch', 9, 1.1]],
    boss: ['Tyrannosaurus', 'tyrannosaurus-wild', 3.0, 1.4],
  },
  {
    name: 'Caldera Crater',
    theme: 'caldera',
    damage: 220 * B,
    reward: 40 * M,
    wave: [['Magma Carnotaurus', 'carnotaurus-magma', 9, 1.7]],
    boss: ['Scorpios Rex', 'scorpios', 2.4, 1.4],
  },
  {
    name: 'Stormbreak Cliffs',
    theme: 'storm',
    damage: 550 * B,
    reward: 60 * M,
    wave: [['Storm Utahraptor', 'utahraptor-storm', 9, 1.2]],
    boss: ['Giganotosaurus', 'giganotosaurus-storm', 3.1, 1.45],
  },
  {
    name: 'Moonlit Jungle',
    theme: 'nightjungle',
    damage: 1.4 * T,
    reward: 90 * M,
    wave: [['Shadow Atrociraptor', 'atrociraptor-shadow', 10, 1.0]],
    boss: ['Indoraptor', 'indoraptor-wild', 2.3, 1.45],
  },
  {
    name: 'Glacier Pass',
    theme: 'glacier',
    damage: 3.5 * T,
    reward: 140 * M,
    wave: [['Frost Allosaurus', 'allosaurus-frost', 10, 1.9]],
    boss: ['Frost Tyrannosaurus', 'tyrannosaurus-frost', 3.1, 1.45],
  },
  {
    name: 'Meteor Impact Zone',
    theme: 'meteor',
    damage: 9 * T,
    reward: 210 * M,
    wave: [['Carcharodontosaurus', 'carcharodontosaurus', 10, 2.1]],
    boss: ['Meteor Spinosaurus', 'spinosaurus-meteor', 3.1, 1.45],
  },
  {
    name: 'Island Summit',
    theme: 'summit',
    damage: 25 * T,
    reward: 320 * M,
    wave: [['Giganotosaurus', 'giganotosaurus', 10, 2.3]],
    boss: ['Indominus Alpha', 'indominus-alpha', 3.2, 1.5],
  },
];

/** Where the wave stands, relative to the arena's centre: spread out, never in a file. */
const POSTS: readonly (readonly [number, number])[] = [
  [-9, -9],
  [9, -9],
  [0, -3],
  [-15, 2],
  [15, 2],
  [-6, 9],
  [6, 9],
  [0, 16],
  [-17, 15],
  [17, 15],
  [-11, 21],
  [11, 21],
];
const BOSS_POST: readonly [number, number] = [0, 25];

const build = (): { stages: StageDef[]; enemies: EnemyDef[] } => {
  const stages: StageDef[] = [];
  const enemies: EnemyDef[] = [];
  PLANS.forEach((plan, index) => {
    const stage = index + 1;
    const centreZ = arenaStartZ(stage) + 30;
    const list: EnemyDef[] = [];
    // Later stages are quicker and strike more often, not just harder.
    const pace = Math.min(stage, 30) / 30;
    let bit = 0;
    for (const [name, look, count, radius] of plan.wave) {
      for (let i = 0; i < count; i += 1) {
        const post = POSTS[bit % POSTS.length]!;
        list.push({
          id: enemies.length + list.length,
          stage,
          bit,
          name,
          look,
          boss: false,
          maxHp: Math.round(plan.damage * HITS_PER_ENEMY),
          // A floor, so even Stage 1's Compsognathus bite a brand-new rider (100 health).
          damage: Math.max(3 + stage, Math.round(plan.damage * enemyDamageShare(stage))),
          x: post[0],
          z: centreZ + post[1],
          scale: 1,
          speed: 7 + pace * 5 - Math.min(2.5, Math.max(0, radius - 1.2) * 1.6),
          radius,
          swingSeconds: 1.4 - pace * 0.45,
        });
        bit += 1;
      }
    }
    const waveMask = (1 << bit) - 1;
    if (plan.boss) {
      const [name, look, radius, scale] = plan.boss;
      list.push({
        id: enemies.length + list.length,
        stage,
        bit,
        name,
        look,
        boss: true,
        maxHp: Math.round(plan.damage * HITS_PER_BOSS),
        damage: Math.max(10 + stage, Math.round(plan.damage * bossDamageShare(stage))),
        x: BOSS_POST[0],
        z: centreZ + BOSS_POST[1],
        scale,
        speed: 6 + pace * 3 - Math.min(2, Math.max(0, radius - 2.4) * 1.2),
        radius,
        swingSeconds: 1.9 - pace * 0.5,
      });
      bit += 1;
    }
    enemies.push(...list);
    stages.push({
      index: stage,
      name: plan.name,
      theme: plan.theme,
      recommendedDamage: plan.damage,
      reward: plan.reward,
      enemies: list,
      fullMask: (1 << bit) - 1,
      waveMask,
      startZ: arenaStartZ(stage),
    });
  });
  return { stages, enemies };
};

const BUILT = build();

export const STAGES: readonly StageDef[] = BUILT.stages;
export const ENEMIES: readonly EnemyDef[] = BUILT.enemies;
export const STAGE_COUNT = STAGES.length;

export const stageByIndex = (index: number): StageDef | undefined => STAGES[Math.floor(index) - 1];

/** Enemy behaviour, in world units. */
export const ENEMY_AI = {
  /** How close a dinosaur walks to its target (edge to edge) before it strikes. */
  reach: 2.2,
  /** A boss's strike lands on its target within this of its own edge (a lunge). */
  bossLunge: 4.5,
} as const;
