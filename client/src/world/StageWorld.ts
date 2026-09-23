import {
  ARENA,
  REWARD_ARCH,
  STAGES,
  STAGE_COUNT,
  arenaEndZ,
  arenaPropSpots,
  arenaStartZ,
  formatAmount,
  formatWins,
  returnPadOf,
  rewardPadOf,
  type StageTheme,
} from '@dino/shared';
import { BoxGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { studPlastic } from '../render/Studs.js';
import { BIOMES, weighted, type Biome } from './Biomes.js';
import { CanvasSign } from './CanvasSign.js';
import { DecalBuilder } from './Decals.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import {
  araucaria,
  archRoot,
  broadleaf,
  bush,
  cattails,
  cliff,
  deadTree,
  fern,
  flowers,
  grassTuft,
  horsetails,
  jungleGiant,
  jungleVine,
  mangrove,
  rock,
  seeded,
  shade,
  type Rand,
} from './Nature.js';
import { bonePile, fallenLog, fossilSlab, log, pillar, skull, stonePad, stump, torch, warningSign } from './ParkProps.js';
import { WinPlatformFx } from './WinPlatform.js';
import type { GroundStyle } from './WorldTextures.js';

/** A biome colour pushed to clean, saturated Roblox plastic. */
const vivid = (color: string | number): number => {
  const c = new Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.max(hsl.s, Math.min(0.7, hsl.s * 1.3 + 0.03)), Math.min(0.88, hsl.l * 1.1 + 0.08));
  return c.getHex();
};

/** The low terrace in front of an arena wall: earth for the living biomes, the wall's own tone for the rest. */
const terraceColor = (biome: Biome): number => {
  const wall = new Color(vivid(biome.cliff));
  return wall.lerp(new Color(0xa8703a), biome.cliffCap === null ? 0.2 : 0.55).getHex();
};

/** The broad character of a biome, for what grows and lies about in it. */
type Character = 'lush' | 'wet' | 'dry' | 'cold';
const WET: readonly StageTheme[] = ['river', 'swamp', 'mangrove', 'lagoon', 'tarpit', 'waterfall'];
const COLD: readonly StageTheme[] = ['tundra', 'glacier'];
const characterOf = (theme: StageTheme, biome: Biome): Character => {
  if (COLD.includes(theme)) return 'cold';
  if (WET.includes(theme)) return 'wet';
  return biome.cliffCap === null ? 'dry' : 'lush';
};

/**
 * THE JUNGLE LOOK of the reference arenas, for every green stage: a bright lime
 * or grass-green studded floor under angular patches of deeper green, lime and
 * bare earth; yellow-green tufts, cattails and flowers; stepped stone-and-dirt
 * terraces; giant jungle trees standing over the walls.
 */
const LIME = 0xb8e040;
const GRASS = 0x4cc83a;
const DEEP = 0x2fa42e;
const EARTH = 0xa8703a;
const TUFT = 0xc4da48;
const BRICK = 0xb8543a;
const isJungle = (character: Character): boolean => character === 'lush' || character === 'wet';
const blend = (a: number, b: number, t: number): number => new Color(a).lerp(new Color(b), t).getHex();

/** Dressing is built for arenas within this of the player, and dropped past the second figure. */
const DRESS_NEAR = 260;
const DRESS_FAR = 380;
/** How far the ground beyond the walls runs. */
const BEYOND = 90;
/** The low terrace's depth in front of each side wall. */
const TERRACE = 3.4;

interface Terrace {
  /** The block's centre across the wall, and its side (-1 / +1). */
  readonly x: number;
  readonly side: number;
  /** A tree terrace (the tall dirt tier) or a low stone ledge in front of it. */
  readonly kind: 'tier' | 'ledge';
  readonly z0: number;
  readonly z1: number;
  /** The turf's top: what stands on the terrace stands at exactly this height. */
  readonly top: number;
}

interface ArenaVisual {
  readonly stage: number;
  readonly root: Group;
  readonly doors: Group | null;
  readonly lamps: MeshBasicMaterial | null;
  readonly field: Mesh | null;
  readonly reward: LabelSprite;
  readonly rewardDisc: MeshLambertMaterial;
  /** The cleared-stage effects over the Win platform. */
  readonly winFx: Group;
  readonly pools: MeshBasicMaterial[];
  readonly terraces: readonly Terrace[];
  /** "Defeat all enemies first!", floating before the shut gate. */
  readonly warn: LabelSprite | null;
  /** The environment round the arena, built only while the player is near. */
  dressing: Group | null;
  doorOpen: number;
}

/**
 * THE THIRTY STAGES down the stage road, each its own prehistoric biome, laid
 * out like a designed Roblox combat area: a compact studded floor with worn
 * trails, patches and pools, low dirt terraces with trees along both sides in
 * front of tall pale studded walls, rock outcrops on their solids, and
 * clusters of logs, bones, fossils, ferns and reeds along the edges - the
 * middle left open for the fight.
 *
 * Only Stage 1 ends in the great timber doors; every later gate is an archway
 * sealed by a red forcefield until its wave is down. Before each gate: the
 * reward pad under a stone arch. Inside the entrance: the return pad home.
 * Every flat thing (patch, pool, pad glow) is a flush decal; every sign and
 * lamp is mounted on the face it belongs to.
 */
export class StageWorld {
  readonly root = new Group();
  private readonly arenas: ArenaVisual[] = [];
  private readonly materials: Material[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly labels: LabelSprite[] = [];
  private readonly winFx = new WinPlatformFx();
  private readonly groundMaterials = new Map<string, MeshLambertMaterial>();
  private opened = -1;
  private rewardSignature = '';
  private time = 0;

  constructor() {
    this.root.name = 'stages';
    for (const stage of STAGES) this.buildArena(stage.index);
    this.setProgress(0, null);
  }

  /** A studded plastic floor in a biome ground's colour (shared per colour). */
  private groundMaterial(style: GroundStyle | number): MeshLambertMaterial {
    const color = typeof style === 'number' ? style : vivid(style.base);
    const key = color.toString(16);
    let material = this.groundMaterials.get(key);
    if (!material) {
      material = studPlastic({ color });
      this.groundMaterials.set(key, material);
      this.materials.push(material);
    }
    return material;
  }

  private buildArena(index: number): void {
    const stage = STAGES[index - 1]!;
    const biome = BIOMES[stage.theme];
    const character = characterOf(stage.theme, biome);
    const start = arenaStartZ(index);
    const end = arenaEndZ(index);
    const length = end - start;
    const mid = (start + end) / 2;
    const W = ARENA.halfWidth;
    const group = new Group();
    group.name = `arena-${index}`;
    const r = seeded(0xa7e0 + index * 131);

    // The arena floor, and the land beyond its walls.
    const floorLength = length + ARENA.gateDepth;
    const jungle = isJungle(character);
    // Jungle floors alternate, as the reference's do: lime under green patches, or grass-green under deep green.
    const limeFloor = index % 2 === 1;
    const own = vivid(biome.ground.base);
    const pull = character === 'wet' ? 0.45 : 0.7;
    const floorColor = jungle ? blend(own, limeFloor ? LIME : GRASS, pull) : own;
    const floor = new Mesh(new PlaneGeometry(W * 2, floorLength), this.groundMaterial(floorColor));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, mid + (index === STAGE_COUNT ? 0 : ARENA.gateDepth / 2));
    floor.receiveShadow = true;
    group.add(floor);
    for (const side of [-1, 1]) {
      const beyond = new Mesh(new PlaneGeometry(BEYOND, floorLength), this.groundMaterial(biome.outer));
      beyond.rotation.x = -Math.PI / 2;
      beyond.position.set(side * (W + BEYOND / 2), 0, floor.position.z);
      beyond.receiveShadow = true;
      group.add(beyond);
    }

    const b = new PartBuilder();
    const decals = new DecalBuilder();
    const wallStone = new Color(vivid(biome.cliff)).lerp(new Color(0xffffff), 0.24).getHex();
    const terrace = terraceColor(biome);
    const turf = biome.cliffCap === null ? null : vivid(biome.cliffCap);

    // THE FLOOR's design, all flush decals. Jungle floors: big angular patches of
    // deeper green (or lime on a green floor) spread across the whole arena, a few
    // of bare earth. Other biomes: a worn trail and patches of their own ground.
    if (jungle) {
      const patch = limeFloor ? blend(own, GRASS, 0.75) : blend(own, DEEP, 0.7);
      const accent = limeFloor ? blend(own, DEEP, 0.6) : blend(own, LIME, 0.65);
      for (let i = 0; i < 12; i += 1) {
        const px = (r() - 0.5) * W * 1.7;
        const pz = start + 6 + ((i + r()) / 12) * (length - 12);
        decals.blob(px, 0, pz, 5 + r() * 5, i % 4 === 3 ? accent : patch, r);
      }
      for (let i = 0; i < 4; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        decals.blob(side * (6 + r() * (W - 12)), 0, start + 12 + ((i + 0.5) / 4) * (length - 28), 2.5 + r() * 2.5, blend(own, EARTH, 0.8), r);
      }
    } else {
      const trail = shade(floorColor, 0.84);
      for (let z = start + 4; z < end - 10; z += 9) decals.patch((r() - 0.5) * 3, 0, z + 4, 6 + r() * 2, 9.5, trail, (r() - 0.5) * 0.25);
      for (let i = 0; i < 6; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const px = side * (W * 0.5 + r() * 5);
        const pz = start + 8 + ((i + 0.5) / 6) * (length - 16);
        decals.blob(px, 0, pz, 3.5 + r() * 2.5, shade(floorColor, r() < 0.5 ? 0.86 : 1.1), r);
        decals.blob(px + (r() - 0.5) * 4, 0, pz + (r() - 0.5) * 4, 2 + r() * 1.5, shade(floorColor, 0.78), r);
      }
    }
    // The brick-red apron across the far end, where the reward pad and the gate stand.
    if (index < STAGE_COUNT) {
      decals.patch(0, 0, end - 7, W * 2, 14, BRICK);
      decals.patch(0, 0, end - 14.3, W * 2, 0.8, shade(BRICK, 0.7));
    }

    // Pools: water, mud or tar laid flush on the floor toward the sides, a darker
    // rim of wet ground round each; lava glows on its own material.
    const pools: MeshBasicMaterial[] = [];
    if (biome.pools) {
      const count = Math.min(5, biome.pools.count);
      const lava: PlaneGeometry[] = [];
      for (let i = 0; i < count; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (8 + r() * (W - 16));
        const z = start + 14 + ((i + 0.5) / count) * (length - 30);
        const size = Math.min(7, biome.pools.size * 0.6) * (0.7 + r() * 0.4);
        const ry = r() * Math.PI;
        decals.patch(x, 0, z, size * 2.1, size * 1.5, shade(floorColor, 0.7), ry);
        if (biome.pools.glow) {
          const geometry = new PlaneGeometry(size * 1.8, size * 1.2);
          geometry.rotateX(-Math.PI / 2);
          geometry.rotateY(ry);
          geometry.translate(x, 0, z);
          lava.push(geometry);
        } else {
          decals.patch(x, 0, z, size * 1.8, size * 1.2, vivid(biome.pools.color), ry, true);
        }
      }
      const merged = lava.length ? mergeGeometries(lava, false) : null;
      for (const g of lava) g.dispose();
      if (merged) {
        const mesh = new Mesh(merged, this.mat(new MeshBasicMaterial({ color: biome.pools.color, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })));
        mesh.renderOrder = 2;
        group.add(mesh);
      }
    }
    // Riverbank Crossing and the falls: a stream right across the arena.
    if (stage.theme === 'river' || stage.theme === 'waterfall') {
      decals.patch(0, 0, start + length * 0.42, W * 2, 12, shade(floorColor, 0.72));
      decals.patch(0, 0, start + length * 0.42, W * 2, 9, 0x3ab4ff, 0, true);
    }

    // THE SIDE WALLS: a low dirt terrace in front, a tall studded stone wall
    // behind - both on the wall solids, flat-topped so what grows on them
    // stands exactly on their turf.
    const terraces: Terrace[] = [];
    const wallFrom = index === 1 ? start : start - ARENA.gateDepth / 2;
    const wallTo = index === STAGE_COUNT ? end + 6 : end + ARENA.gateDepth / 2;
    for (const side of [-1, 1]) {
      const pieces = 4;
      const step = (wallTo - wallFrom) / pieces;
      for (let i = 0; i < pieces; i += 1) {
        const z0 = wallFrom + step * i;
        const z1 = z0 + step;
        const ix0 = side * W;
        const ix1 = side * (W + TERRACE);
        const ox1 = side * (W + 8);
        // Stepped, as the reference's: a low pale-stone ledge in front, a dirt tier behind it.
        const im = side * (W + TERRACE * 0.42);
        const ledgeTop = cliff(b, r, Math.min(ix0, im), Math.max(ix0, im), z0, z1, 1.6 + (i % 2) * 0.8, shade(wallStone, 0.94), turf);
        const tierTop = cliff(b, r, Math.min(im, ix1), Math.max(im, ix1), z0, z1, 3.4 + (i % 2) * 2.5, terrace, turf);
        terraces.push({ x: (ix0 + im) / 2, side, kind: 'ledge', z0, z1, top: ledgeTop });
        terraces.push({ x: (im + ix1) / 2, side, kind: 'tier', z0, z1, top: tierTop });
        cliff(b, r, Math.min(ix1, ox1), Math.max(ix1, ox1), z0, z1, ARENA.wallHeight - (i % 2) * 3, wallStone, turf);
      }
    }

    // THE GATE out of this arena: a stone wall with an archway - timber posts
    // and a lintel. Stage 1 alone keeps the great timber doors; every later
    // gate is sealed by a red forcefield. Lamps sit flush on the lintel's face.
    const gz = end + ARENA.gateDepth / 2;
    const half = ARENA.portalHalfWidth;
    let doors: Group | null = null;
    let lamps: MeshBasicMaterial | null = null;
    let field: Mesh | null = null;
    let warn: LabelSprite | null = null;
    if (index < STAGE_COUNT) {
      for (const s of [-1, 1]) {
        cliff(b, r, Math.min(s * half, s * W), Math.max(s * half, s * W), end, end + ARENA.gateDepth, ARENA.wallHeight, wallStone, turf);
        log(b, s * (half + 1.1), 0, end + 1.1, ARENA.portalHeight + 3, 1.1, 0x6a4020, false);
        log(b, s * (half + 1.1), 0, end + ARENA.gateDepth - 1.1, ARENA.portalHeight + 3, 1.1, 0x6a4020, false);
        torch(b, s * (half + 3.2), end - 0.8, 5);
      }
      b.box(half * 2 + 5, 3, ARENA.gateDepth, 0x6a4020, 'stud', { x: 0, y: ARENA.portalHeight + 1.5, z: gz });
      b.box(half * 2 + 6, 0.8, ARENA.gateDepth + 0.6, 0x4a2c16, 'stud', { x: 0, y: ARENA.portalHeight + 3.4, z: gz });
      lamps = this.mat(new MeshBasicMaterial({ color: 0xff2a1a }));
      for (const s of [-1, 1]) {
        const lamp = new Mesh(new BoxGeometry(1.3, 1.3, 0.4), lamps);
        lamp.position.set(s * (half - 1.5), ARENA.portalHeight + 1.5, end - 0.2);
        group.add(lamp);
      }
      if (index === 1) {
        doors = this.buildDoors(index, r, end);
        group.add(doors);
      } else {
        // The forcefield: a translucent red slab filling the archway.
        field = new Mesh(
          new BoxGeometry(half * 2, ARENA.portalHeight, 0.4),
          this.mat(new MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.3, side: DoubleSide, depthWrite: false })),
        );
        field.position.set(0, ARENA.portalHeight / 2, end + 1.2);
        group.add(field);
        // Brick-red threshold under the archway, as the reference's.
        decals.patch(0, 0, gz, half * 2, ARENA.gateDepth, BRICK);
      }
      warn = new LabelSprite(12, 4.6, 360);
      warn.set([
        { text: 'Defeat all', color: '#ffffff', size: 1.25 },
        { text: 'enemies first!', color: '#ffffff', size: 1.25 },
      ]);
      warn.sprite.position.set(0, ARENA.portalHeight * 0.62, end - 2);
      group.add(warn.sprite);
      this.labels.push(warn);
    } else {
      // The summit's end: a sheer wall.
      cliff(b, r, -W, W, end, end + 8, 26, wallStone, turf);
    }

    // THE OUTCROPS, one on each prop solid: stepped flat-topped rock with turf,
    // plants standing on its ledges, loose stones at its foot.
    for (const spot of arenaPropSpots(index)) this.outcrop(b, r, spot, biome, character);

    // The reward pad under its arch; the return pad by the entrance.
    const reward = rewardPadOf(index);
    const back = returnPadOf(index);
    this.buildWinArch(b, index, biome);
    stonePad(b, back.x, 0, back.z, back.half + 0.6, 0x7a9ac8, 0x3a4a6a);
    group.add(b.build(`arena-${index}-parts`));
    for (const mesh of decals.build()) group.add(mesh);

    const rewardMaterial = this.mat(studPlastic({ color: 0x5a5a6a }));
    const disc = new Mesh(new BoxGeometry(reward.half * 1.8, 0.1, reward.half * 1.8), rewardMaterial);
    // On top of the pad's slab (0.05 base + 0.36).
    disc.position.set(reward.x, 0.46, reward.z);
    disc.receiveShadow = true;
    group.add(disc);
    const backGlow = new Mesh(
      new PlaneGeometry(back.half * 1.8, back.half * 1.8),
      this.mat(new MeshBasicMaterial({ color: 0x4ab8ff, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })),
    );
    backGlow.rotation.x = -Math.PI / 2;
    backGlow.position.set(back.x, 0.36, back.z);
    backGlow.renderOrder = 2;
    group.add(backGlow);
    const winFx = this.winFx.create(index);
    group.add(winFx);

    const rewardLabel = new LabelSprite(6.4, 2.6, 320);
    rewardLabel.sprite.position.set(reward.x, 6.4, reward.z);
    group.add(rewardLabel.sprite);
    this.labels.push(rewardLabel);
    const backLabel = new LabelSprite(6, 2, 256);
    backLabel.sprite.position.set(back.x, 3.2, back.z);
    backLabel.set([{ text: 'Return to Park', color: '#9fdcff' }]);
    group.add(backLabel.sprite);
    this.labels.push(backLabel);

    // THE STAGE TITLE floating over the entrance, as the reference's: the stage,
    // and the damage it asks for in big yellow figures.
    const title = new LabelSprite(11, 7.2, 400);
    title.set([
      { text: `Stage ${index}`, color: '#ffffff', size: 1.5 },
      { text: 'Recommended', color: '#ffffff', size: 0.72 },
      { text: 'Damage:', color: '#ffffff', size: 0.72 },
      { text: formatAmount(stage.recommendedDamage), color: '#ffd23a', size: 1.35 },
    ]);
    title.sprite.position.set(0, 10.5, start + 9);
    group.add(title.sprite);
    this.labels.push(title);
    // The stage's name on the inner face of its entrance wall, facing the fight.
    const banner = new CanvasSign(20, 3.8, [{ text: stage.name.toUpperCase(), size: 1, fill: '#ffffff', stroke: '#2a1a0a', strokeWidth: 0.16 }]);
    banner.mesh.position.set(0, ARENA.portalHeight + 5, start + 0.03);
    group.add(banner.mesh);
    this.signs.push(banner);

    this.root.add(group);
    this.arenas.push({ stage: index, root: group, doors, lamps, field, reward: rewardLabel, rewardDisc: rewardMaterial, winFx, pools, terraces, warn, dressing: null, doorOpen: 0 });
  }

  /** Stage 1's great timber doors, hinged at the posts; their warning signs are fixed to the planks. */
  private buildDoors(index: number, r: Rand, end: number): Group {
    const half = ARENA.portalHalfWidth;
    const doors = new Group();
    doors.position.set(0, 0, end + 1.4);
    for (const s of [-1, 1]) {
      const hinge = new Group();
      hinge.position.x = s * half;
      const leaf = new PartBuilder();
      const w = half - 0.1;
      const H = ARENA.portalHeight - 0.4;
      for (let i = 0; i < 5; i += 1) {
        leaf.box(w / 5 - 0.02, H, 0.5, shade(0x9a6232, 0.9 + r() * 0.2), 'stud', { x: -s * (w / 10 + (i * w) / 5), y: H / 2, z: 0 });
      }
      for (const y of [3, H - 3]) leaf.box(w, 0.8, 0.7, 0x5a3418, 'stud', { x: (-s * w) / 2, y, z: 0 });
      leaf.box(0.5, H * 0.9, 0.7, 0x5a3418, 'stud', { x: (-s * w) / 2, y: H / 2, z: 0, rz: s * 0.62 });
      // The sign sits on the planks' front face (the planks are 0.5 deep, centred on the hinge line).
      warningSign(leaf, (-s * w) / 2, H * 0.62, -0.31, Math.PI, 1.3);
      hinge.add(leaf.build(`gate-${index}-${s}`));
      doors.add(hinge);
    }
    return doors;
  }

  /**
   * A rock outcrop on a prop solid: a broad flat-topped block, a smaller one
   * stepped on top, turf caps where the biome grows, plants standing on both
   * ledges and loose stones round its foot.
   */
  private outcrop(b: PartBuilder, r: Rand, spot: { minX: number; maxX: number; minZ: number; maxZ: number }, biome: Biome, character: Character): void {
    const cx = (spot.minX + spot.maxX) / 2;
    const cz = (spot.minZ + spot.maxZ) / 2;
    const w = spot.maxX - spot.minX;
    const d = spot.maxZ - spot.minZ;
    const rockColor = shade(vivid(biome.cliff), 1.05);
    const cap = biome.cliffCap === null ? null : vivid(biome.cliffCap);
    const h1 = 2.2;
    const h2 = 1.8;
    b.box(w, h1, d, rockColor, 'flat', { x: cx, y: h1 / 2, z: cz });
    const w2 = w * 0.6;
    const d2 = d * 0.55;
    const ox = (r() - 0.5) * (w - w2) * 0.6;
    const oz = (r() - 0.5) * (d - d2) * 0.6;
    b.box(w2, h2, d2, shade(rockColor, 0.93), 'flat', { x: cx + ox, y: h1 + h2 / 2, z: cz + oz });
    let ledge = h1;
    let summit = h1 + h2;
    if (cap !== null) {
      b.box(w + 0.3, 0.3, d + 0.3, cap, 'flat', { x: cx, y: h1 + 0.15, z: cz });
      b.box(w2 + 0.3, 0.3, d2 + 0.3, shade(cap, 1.06), 'flat', { x: cx + ox, y: h1 + h2 + 0.15, z: cz + oz });
      ledge += 0.3;
      summit += 0.3;
    }
    // What stands on it.
    const onLedgeX = cx - ox * 1.2;
    const onLedgeZ = cz - oz - Math.sign(oz || 1) * d * 0.25;
    if (character === 'lush') {
      broadleaf(b, r, cx + ox, summit, cz + oz, 0.8);
      fern(b, r, onLedgeX, ledge, onLedgeZ, 1.1);
    } else if (character === 'wet') {
      mangrove(b, r, cx + ox, summit, cz + oz, 0.55);
      horsetails(b, r, onLedgeX, ledge, onLedgeZ, 0.9);
    } else if (character === 'cold') {
      araucaria(b, r, cx + ox, summit, cz + oz, 0.55);
      rock(b, r, onLedgeX, ledge, onLedgeZ, 0.6, 0xf4f8fc);
    } else {
      deadTree(b, r, cx + ox, summit, cz + oz, 0.6, shade(rockColor, 0.7));
      rock(b, r, onLedgeX, ledge, onLedgeZ, 0.6, rockColor);
    }
    // Loose stones at its foot, on the arena side.
    const inward = cx > 0 ? -1 : 1;
    rock(b, r, cx + inward * (w / 2 + 0.9), 0, cz + (r() - 0.5) * d * 0.6, 0.5, rockColor);
    rock(b, r, cx + inward * (w / 2 + 0.6), 0, cz + (r() - 0.5) * d * 0.6, 0.35, rockColor);
  }

  /** The stone arch over the reward pad, its pillars on the reward-arch solids, torches either side. */
  private buildWinArch(b: PartBuilder, index: number, biome: Biome): void {
    const pad = rewardPadOf(index);
    const z1 = arenaEndZ(index);
    const color = shade(vivid(biome.cliff), 1.2);
    const span = REWARD_ARCH.halfSpan;
    for (const s of [-1, 1]) {
      const x = pad.x + s * span;
      pillar(b, x, z1 - 1, REWARD_ARCH.height - 1, 1.6, color);
    }
    b.box(span * 2 + 3.5, 1.6, 2.2, shade(color, 0.9), 'stud', { x: pad.x, y: REWARD_ARCH.height + 0.2, z: z1 - 1 });
    // The gold plaque on the lintel's face.
    b.box(4, 1.2, 0.3, 0xffc81e, 'smooth', { x: pad.x, y: REWARD_ARCH.height + 0.2, z: z1 - 2.25 });
    stonePad(b, pad.x, 0.05, pad.z, pad.half + 0.8, shade(color, 0.95), 0xb8902a);
  }

  private mat<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  /**
   * Dress an arena's surroundings: planting on the terrace tops, deliberate
   * clusters along both walls (logs, bones, fossils, reeds, ferns, bushes and
   * rocks, by biome), clumps of grass round them, and the biome's big scenery
   * beyond the walls. The middle stays open for the fight.
   */
  private dress(stage: number): Group {
    const def = STAGES[stage - 1]!;
    const biome = BIOMES[def.theme];
    const character = characterOf(def.theme, biome);
    const arena = this.arenas[stage - 1];
    const r = seeded(0xd0e5 + stage * 977);
    const b = new PartBuilder();
    const decals = new DecalBuilder();
    const start = arenaStartZ(stage);
    const end = arenaEndZ(stage);
    const W = ARENA.halfWidth;
    const floorColor = vivid(biome.ground.base);
    const jungle = isJungle(character);
    const tuft = jungle ? TUFT : shade(vivid(biome.ground.light), 1.1);

    // Beyond the walls: big scenery on the land either side. Jungle stages get a
    // row of giant trees tall enough to stand over the walls - the canopy seen
    // from inside, as in the reference.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        const x = side * (W + 14 + r() * (BEYOND - 24));
        const z = start - 4 + r() * (end - start + 8);
        const [placer, , scale] = weighted(r, biome.beyond);
        placer(b, r, x, 0, z, scale * (0.8 + r() * 0.4));
      }
      if (jungle) {
        for (let i = 0; i < 6; i += 1) {
          jungleGiant(b, r, side * (W + 12 + r() * 6), 0, start - 2 + ((i + r() * 0.6) / 6) * (end - start + 4), 1.15 + r() * 0.35);
        }
      }
    }

    // On the terraces: trees on the dirt tiers, tufts, flowers and cattails along the stone ledges.
    for (const t of arena?.terraces ?? []) {
      if (t.kind === 'ledge') {
        if (!jungle && character !== 'cold') continue;
        for (let k = 0; k < 3; k += 1) {
          const z = t.z0 + (t.z1 - t.z0) * (0.2 + k * 0.3);
          if (character === 'cold') rock(b, r, t.x, t.top, z, 0.35, 0xf4f8fc);
          else if (k === 1) flowers(b, r, t.x, t.top, z, 1);
          else if (k === 2 && character === 'wet') cattails(b, r, t.x, t.top, z, 0.9);
          else grassTuft(b, r, t.x, t.top, z, 1.1, TUFT);
        }
        continue;
      }
      for (let k = 0; k < 2; k += 1) {
        const z = t.z0 + (t.z1 - t.z0) * (0.28 + k * 0.44);
        const x = t.x + (r() - 0.5) * 0.6;
        if (character === 'lush') (k === 0 ? broadleaf : bush)(b, r, x, t.top, z, k === 0 ? 0.75 : 1.0);
        else if (character === 'wet') (k === 0 ? mangrove : fern)(b, r, x, t.top, z, k === 0 ? 0.55 : 1.1);
        else if (character === 'cold') araucaria(b, r, x, t.top, z, 0.5);
        else if (k === 0) deadTree(b, r, x, t.top, z, 0.55, shade(vivid(biome.cliff), 0.7));
        else rock(b, r, x, t.top, z, 0.5, vivid(biome.cliff));
      }
    }

    // Clusters along both walls, clear of the outcrops, pads and the middle.
    const spots = [0.24, 0.42, 0.62, 0.86];
    for (const side of [-1, 1]) {
      for (const f of spots) {
        const z = start + f * (end - start);
        // The reward pad sits on the +X side near the gate: keep that corner open.
        if (side > 0 && f > 0.8) continue;
        const x = side * (W - 3.2);
        this.edgeCluster(b, decals, r, x, z, side, character, biome, floorColor);
        for (let k = 0; k < 4; k += 1) grassTuft(b, r, x - side * (2.5 + r() * 3), 0, z + (r() - 0.5) * 6, 0.9 + r() * 0.5, tuft);
      }
    }
    // Out in the field: clumps of tufts, flowers and cattails, as the reference's
    // floors are scattered with them - decoration the fight walks straight through.
    if (jungle) {
      for (let i = 0; i < 16; i += 1) {
        const cx = (r() - 0.5) * W * 1.7;
        const cz = start + 8 + r() * (end - start - 24);
        for (let k = 0; k < 3; k += 1) grassTuft(b, r, cx + (r() - 0.5) * 2.4, 0, cz + (r() - 0.5) * 2.4, 0.9 + r() * 0.5, tuft);
        if (i % 3 === 0) flowers(b, r, cx + 1.5, 0, cz - 1.2, 1);
      }
      for (let i = 0; i < 6; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        cattails(b, r, side * (W - 1.5 - r() * 3), 0, start + 10 + ((i + 0.5) / 6) * (end - start - 30), 1.1);
      }
    } else if (character !== 'dry' && character !== 'cold') {
      for (let i = 0; i < 5; i += 1) {
        const cx = (r() - 0.5) * W * 1.2;
        const cz = start + 10 + r() * (end - start - 24);
        for (let k = 0; k < 3; k += 1) grassTuft(b, r, cx + (r() - 0.5) * 2, 0, cz + (r() - 0.5) * 2, 0.9 + r() * 0.4, tuft);
      }
    }
    const group = b.build(`arena-${stage}-dressing`);
    for (const mesh of decals.build()) group.add(mesh);
    return group;
  }

  /** One deliberate cluster against a wall: a feature, its plants, a stone, and the ground under it. */
  private edgeCluster(b: PartBuilder, decals: DecalBuilder, r: Rand, x: number, z: number, side: number, character: Character, biome: Biome, floorColor: number): void {
    const inward = -side;
    const [plant, , plantScale] = weighted(r, biome.scatter);
    switch (character) {
      case 'lush': {
        const pick = r();
        // An arching root over the edge, a curling vine, a fallen log or bones.
        if (pick < 0.3) archRoot(b, r, x - side * 0.5, 0, z - 3.5, 0.8, 0);
        else if (pick < 0.55) jungleVine(b, r, x, 0, z, 1.1, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        else if (pick < 0.8) fallenLog(b, r, x + inward * 0.5, z, 4.5, 0.15 * side, 0.8);
        else bonePile(b, r, x, z, 0.8);
        flowers(b, r, x + inward * 3, 0, z + 1, 1);
        fern(b, r, x + inward * 2.2, 0, z - 2, 1.1);
        bush(b, r, x, 0, z + 3, 0.9, 2);
        rock(b, r, x + inward * 1.2, 0, z + 1.5, 0.6);
        decals.patch(x + inward * 1.5, 0, z, 6, 7, shade(floorColor, 0.86), r());
        break;
      }
      case 'wet': {
        // A puddle ringed with mud, reeds at its edge, a log half in it.
        decals.patch(x + inward * 2, 0, z, 6.5, 5, 0x6a4a2a, r());
        decals.patch(x + inward * 2, 0, z, 4.5, 3.2, vivid(biome.pools?.color ?? 0x3ab4ff), r(), true);
        horsetails(b, r, x, 0, z - 2, 1.0);
        fallenLog(b, r, x + inward * 0.8, z + 2.5, 4, 0.3 * side, 0.7);
        fern(b, r, x, 0, z + 4.5, 1.0);
        break;
      }
      case 'cold': {
        rock(b, r, x, 0, z, 1.0, 0xf4f8fc);
        rock(b, r, x + inward * 1.5, 0, z + 1.2, 0.6, 0x9aa4b0);
        bonePile(b, r, x + inward * 2, z - 2, 0.7);
        decals.patch(x + inward * 1.5, 0, z, 6, 6, shade(floorColor, 0.9), r());
        break;
      }
      default: {
        const pick = r();
        if (pick < 0.35) skull(b, r, x + inward * 0.6, z, 0.7, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        else if (pick < 0.7) fossilSlab(b, r, x, z, 1.1, r());
        else bonePile(b, r, x, z, 0.9);
        rock(b, r, x + inward * 1.6, 0, z + 2, 0.8, vivid(biome.cliff));
        decals.patch(x + inward * 1.5, 0, z, 6, 5, shade(floorColor, 0.8), r());
        break;
      }
    }
    plant(b, r, x + inward * 1.5, 0, z - 3.5, Math.min(1.2, plantScale));
  }

  /**
   * The local rider's progress: which gates are open this run, and which
   * reward pads are armed (the wave is down and the Wins are waiting).
   */
  setProgress(runStage: number, killMasks: ArrayLike<number> | null): void {
    if (runStage !== this.opened) {
      this.opened = runStage;
      for (const arena of this.arenas) {
        const open = arena.stage <= runStage;
        if (arena.lamps) arena.lamps.color.setHex(open ? 0x3aff5a : 0xff2a1a);
        if (arena.field) arena.field.visible = !open;
        if (arena.warn) arena.warn.sprite.visible = !open;
      }
    }
    const trophy = trophyIcon(() => {
      this.rewardSignature = '';
    });
    let signature = trophy ? 't' : 'n';
    for (const arena of this.arenas) {
      const stage = STAGES[arena.stage - 1]!;
      signature += (killMasks?.[arena.stage - 1] ?? 0) === stage.fullMask ? '1' : '0';
    }
    if (signature === this.rewardSignature) return;
    this.rewardSignature = signature;
    for (const arena of this.arenas) {
      const stage = STAGES[arena.stage - 1]!;
      const ready = (killMasks?.[arena.stage - 1] ?? 0) === stage.fullMask;
      arena.rewardDisc.color.setHex(ready ? 0xffd23a : 0x5a5a6a);
      arena.winFx.visible = ready;
      arena.reward.set([
        { text: `+${formatWins(stage.reward)} Wins`, color: ready ? '#ffd23a' : '#dddddd', size: 1.1, icon: trophy },
        { text: ready ? 'STEP ON TO CLAIM!' : 'Defeat every dinosaur!', color: ready ? '#7dff6a' : '#ff8a8a', size: 0.8 },
      ]);
    }
  }

  /** Only arenas near the rider are drawn; the rest of the road is fogged anyway. */
  update(delta: number, z: number): void {
    this.time += delta;
    this.winFx.update(delta);
    let built = false;
    for (const arena of this.arenas) {
      const mid = (arenaStartZ(arena.stage) + arenaEndZ(arena.stage)) / 2;
      const distance = Math.abs(mid - z);
      arena.root.visible = distance < 340;
      // At most one arena dressed per frame, so riding the road never hitches twice.
      if (!arena.dressing && distance < DRESS_NEAR && !built) {
        built = true;
        arena.dressing = this.dress(arena.stage);
        arena.root.add(arena.dressing);
      } else if (arena.dressing && distance > DRESS_FAR) {
        releaseGroup(arena.dressing);
        arena.dressing = null;
      }
      // Stage 1's doors swing open (and shut again on a new run).
      if (arena.doors && arena.root.visible) {
        const want = arena.stage <= this.opened ? 1 : 0;
        arena.doorOpen += (want - arena.doorOpen) * (1 - Math.exp(-3 * delta));
        const [left, right] = arena.doors.children;
        if (left) left.rotation.y = -arena.doorOpen * 1.45;
        if (right) right.rotation.y = arena.doorOpen * 1.45;
      }
      if (arena.field?.visible) (arena.field.material as MeshBasicMaterial).opacity = 0.26 + Math.sin(this.time * 4 + arena.stage) * 0.06;
    }
  }

  dispose(): void {
    for (const arena of this.arenas) if (arena.dressing) releaseGroup(arena.dressing);
    for (const sign of this.signs) sign.dispose();
    for (const label of this.labels) label.dispose();
    for (const material of this.materials) material.dispose();
    this.winFx.dispose();
    this.root.removeFromParent();
  }
}

/** Drop a built dressing: its merged geometries are its own (the materials are shared). */
const releaseGroup = (group: Group): void => {
  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
  group.removeFromParent();
};

export type { Rand };
