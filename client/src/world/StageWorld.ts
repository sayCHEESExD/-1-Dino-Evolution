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
} from '@dino/shared';
import { BoxGeometry, ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isMobileGpu } from '../config/device.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { studPlastic } from '../render/Studs.js';
import { BIOMES, weighted, type Look } from './Biomes.js';
import { CanvasSign } from './CanvasSign.js';
import { blend, edgeCluster, feature, fieldDressing, painter, plantLedges, type Painter } from './Habitats.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import { jungleGiant, redwood, rock, seeded, shade, type Rand } from './Nature.js';
import { bone, stonePad } from './Relics.js';
import { paintTerrain, waterSurface, waterfallSurface } from './Terrain.js';
import { cascade, hangingVine, terrainWall, type Ledge } from './Wild.js';
import { WinPlatformFx } from './WinPlatform.js';

/** An arena's rock and earth are built when the rider is within the first figure, dropped past the second. */
const BUILD_NEAR = 420;
const BUILD_FAR = 520;
/** Its plants and relics, nearer. */
const DRESS_NEAR = 260;
const DRESS_FAR = 380;
/** How far the land beyond the walls runs. */
const BEYOND = 100;

interface ArenaVisual {
  readonly stage: number;
  readonly root: Group;
  readonly look: Look;
  readonly painter: Painter;
  readonly doors: Group | null;
  /** The thorn-vine curtain sealing a later gate: it rolls up into the arch when the wave is down. */
  readonly curtain: Group | null;
  readonly lamps: MeshBasicMaterial | null;
  readonly reward: LabelSprite;
  readonly rewardDisc: MeshLambertMaterial;
  /** The cleared-stage effects over the Win platform. */
  readonly winFx: Group;
  /** "Defeat all enemies first!", floating before the shut gate. */
  readonly warn: LabelSprite | null;
  /** Terrain, walls, gate, henge and features: built near the rider. */
  body: Group | null;
  ledges: Ledge[];
  /** Plants and relics: built nearer still. */
  dressing: Group | null;
  doorOpen: number;
  curtainOpen: number;
}

/**
 * THE THIRTY HABITATS down the stage road: each a prehistoric enclosure made
 * by nature, not by a park. Its ground is painted terrain - grass tones, a
 * winding trail, puddles, a river, marsh, tar, lava or ice cut into it - and
 * it is closed in by NATURAL TERRAIN WALLS: an earth bank, a rock shelf and a
 * cliff stepping up behind, turf and vines on every lip, trees on every top.
 * Rock formations, basalt, ice, ruins or mangrove islands stand on its rock
 * solids; clusters of logs, bones, ferns, reeds and roots gather at its walls;
 * the middle stays open for the fight. Each family - meadow, jungle, river,
 * swamp, rocky, volcanic, frozen, forest, ruins, beach - dresses it its own
 * way, and the walls climb higher stage by stage.
 *
 * The way on is a rock arch. Stage 1's is shut by lashed log doors; every
 * later arch is sealed by a curtain of thorn vines that rolls up once the wave
 * is down. Before it: the reward pad under a stone henge. Inside the entrance:
 * the return pad home.
 */
export class StageWorld {
  readonly root = new Group();
  private readonly arenas: ArenaVisual[] = [];
  private readonly materials: Material[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly labels: LabelSprite[] = [];
  private readonly winFx = new WinPlatformFx();
  private readonly sparse = isMobileGpu();
  private opened = -1;
  private rewardSignature = '';
  private time = 0;

  constructor() {
    this.root.name = 'stages';
    for (const stage of STAGES) this.createArena(stage.index);
    this.setProgress(0, null);
  }

  /** The light, interactive parts of an arena: labels, doors or curtain, lamps, pads' state. */
  private createArena(index: number): void {
    const stage = STAGES[index - 1]!;
    const look = BIOMES[stage.theme].look;
    const start = arenaStartZ(index);
    const end = arenaEndZ(index);
    const group = new Group();
    group.name = `arena-${index}`;
    const r = seeded(0xa7e0 + index * 131);

    let doors: Group | null = null;
    let curtain: Group | null = null;
    let lamps: MeshBasicMaterial | null = null;
    let warn: LabelSprite | null = null;
    if (index < STAGE_COUNT) {
      lamps = this.mat(new MeshBasicMaterial({ color: 0xff2a1a }));
      if (index === 1) {
        doors = this.buildDoors(index, r, end);
        group.add(doors);
      } else {
        curtain = this.buildCurtain(index, r, end);
        group.add(curtain);
      }
      warn = new LabelSprite(12, 4.6, 360);
      warn.set([
        { text: 'Defeat all', color: '#ffffff', size: 1.25 },
        { text: 'enemies first!', color: '#ffffff', size: 1.25 },
      ]);
      warn.sprite.position.set(0, ARENA.portalHeight * 0.62, end - 2);
      group.add(warn.sprite);
      this.labels.push(warn);
    }

    const reward = rewardPadOf(index);
    const back = returnPadOf(index);
    const rewardMaterial = this.mat(studPlastic({ color: 0x5a5a6a }));
    const disc = new Mesh(new BoxGeometry(reward.half * 1.8, 0.1, reward.half * 1.8), rewardMaterial);
    // On top of the pad's slab (0.05 base + 0.36).
    disc.position.set(reward.x, 0.46, reward.z);
    disc.receiveShadow = true;
    group.add(disc);
    const backGlow = new Mesh(
      new PlaneGeometry(back.half * 1.8, back.half * 1.8),
      this.mat(new MeshBasicMaterial({ color: 0x4ab8ff, transparent: true, opacity: 0.55, depthWrite: false })),
    );
    backGlow.rotation.x = -Math.PI / 2;
    // A clear step over the pad's slab (its top is 0.36).
    backGlow.position.set(back.x, 0.42, back.z);
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
    backLabel.set([{ text: 'Return to Spawn', color: '#9fdcff' }]);
    group.add(backLabel.sprite);
    this.labels.push(backLabel);

    // THE STAGE TITLE floating over the entrance: the stage, and the damage it asks for.
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
    // The habitat's name, carved on a plank board lashed to the rock over the way in.
    const banner = new CanvasSign(20, 3.8, [{ text: stage.name.toUpperCase(), size: 1, fill: '#ffffff', stroke: '#2a1a0a', strokeWidth: 0.16 }]);
    banner.mesh.position.set(0, ARENA.portalHeight + 5, start + 0.78);
    group.add(banner.mesh);
    this.signs.push(banner);

    this.root.add(group);
    this.arenas.push({
      stage: index,
      root: group,
      look,
      painter: painter(index, look, start, end),
      doors,
      curtain,
      lamps,
      reward: rewardLabel,
      rewardDisc: rewardMaterial,
      winFx,
      warn,
      body: null,
      ledges: [],
      dressing: null,
      doorOpen: 0,
      curtainOpen: 0,
    });
  }

  // ------------------------------------------------------------------ body

  /** The heavy half of an arena: its ground, walls, gate, henge, pads and the features on its solids. */
  private buildBody(arena: ArenaVisual): Group {
    const index = arena.stage;
    const look = arena.look;
    const start = arenaStartZ(index);
    const end = arenaEndZ(index);
    const W = ARENA.halfWidth;
    const r = seeded(0xb0d7 + index * 131);
    const b = new PartBuilder();
    const group = new Group();
    group.name = `arena-${index}-body`;
    // The walls climb as the road goes on: every habitat a little more dramatic.
    const drama = Math.min(1.3, 1 + (index - 1) * 0.011);

    // THE GROUND: one painted surface, liquids cut into it.
    const floor = paintTerrain({ minX: -W, maxX: W, minZ: start, maxZ: end + ARENA.gateDepth, y: 0, paint: arena.painter.paint, bank: look.bank });
    b.addPainted(floor.ground, 'stud');
    if (floor.glow) b.addPainted(floor.glow, 'glow');
    if (floor.water) {
      const water = new Mesh(floor.water, waterSurface());
      water.renderOrder = 1;
      group.add(water);
    }
    for (const side of [-1, 1]) {
      const land = paintTerrain({
        minX: side < 0 ? -W - BEYOND : W,
        maxX: side < 0 ? -W : W + BEYOND,
        minZ: start,
        maxZ: end + ARENA.gateDepth,
        y: 0,
        paint: () => ({ color: look.outer }),
      });
      b.addPainted(land.ground, 'stud');
    }

    // THE SIDE WALLS: bank, shelf and cliff stepping up and back.
    const tiers = look.tiers;
    const wallFrom = index === 1 ? start : start - ARENA.gateDepth;
    const wallTo = index === STAGE_COUNT ? end + ARENA.gateDepth : end;
    const vines = look.family === 'jungle' ? 0.55 : look.family === 'ruins' ? 0.45 : look.family === 'swamp' ? 0.4 : look.family === 'forest' || look.family === 'river' ? 0.25 : look.family === 'meadow' ? 0.12 : 0;
    const band =
      look.family === 'rocky' ? blend(look.rock, look.soil, 0.5)
      : look.family === 'volcanic' ? blend(look.rock, look.accent, 0.22)
      : look.family === 'frozen' ? 0xeef4fa
      : undefined;
    const ledges: Ledge[] = [];
    for (const side of [-1, 1] as const) {
      ledges.push(
        ...terrainWall(b, r, {
          run: 'z',
          face: side * W,
          out: side,
          from: wallFrom,
          to: wallTo,
          tiers: [
            { depth: 3.6, height: [tiers[0][0], tiers[0][1]], color: look.bank },
            { depth: 5.5, height: [tiers[1][0] * drama, tiers[1][1] * drama], color: look.rock, band },
            { depth: 10, height: [tiers[2][0] * drama, tiers[2][1] * drama], color: shade(look.rock, 1.08), band },
          ],
          cap: look.cap,
          vines,
        }),
      );
    }
    arena.ledges = ledges;

    // THE WAY ON: a rock arch (or, at the summit, a sheer wall).
    if (index < STAGE_COUNT) this.buildArch(b, r, group, arena, end, drama);
    else {
      ledges.push(
        ...terrainWall(b, r, {
          run: 'x',
          face: end,
          out: 1,
          from: -W,
          to: W,
          tiers: [
            { depth: 3, height: [tiers[0][0], tiers[0][1]], color: look.bank },
            { depth: 3, height: [tiers[1][0] * drama, tiers[1][1] * drama], color: look.rock, band },
            { depth: 4, height: [tiers[2][0] * drama, tiers[2][1] * drama], color: shade(look.rock, 1.08), band },
          ],
          cap: look.cap,
          vines,
        }),
      );
    }

    // Waterfalls down the side walls into a river that crosses the arena.
    if (look.liquid?.layout === 'river') this.buildFalls(b, r, group, arena, look);

    // THE FEATURES on the rock solids.
    for (const spot of arenaPropSpots(index)) feature(b, r, spot, look);

    // The henge over the reward pad; the return pad by the entrance.
    this.buildHenge(b, r, index, look);
    const back = returnPadOf(index);
    stonePad(b, back.x, 0, back.z, back.half + 0.6, 0x8a9ab8, 0x4a5a78);
    // The plank board this habitat's name hangs on, lashed to the rock over the way in.
    this.plankBoard(b, 0, ARENA.portalHeight + 5, start + 0.55, 21, 4.4);

    group.add(b.build(`arena-${index}-parts`));
    return group;
  }

  /**
   * THE ROCK ARCH out of an arena: two stacked-rock jambs on the gate solids,
   * a lintel spanning the way, a keystone boulder, turf and vines where the
   * habitat grows, and two crystal lamps set in the lintel's face - red while
   * the gate is sealed, green once it is open.
   */
  private buildArch(b: PartBuilder, r: Rand, group: Group, arena: ArenaVisual, end: number, drama: number): void {
    const look = arena.look;
    const W = ARENA.halfWidth;
    const half = ARENA.portalHalfWidth;
    const H = ARENA.portalHeight;
    const z0 = end;
    const z1 = end + ARENA.gateDepth;
    const zc = (z0 + z1) / 2;
    let previous = 0;
    for (const side of [-1, 1]) {
      let x = half;
      while (x < W + 0.4) {
        const w = Math.min(W + 1 - x, 3 + r() * 2.6);
        let h = (H + 4.5 + r() * 6) * drama;
        if (Math.abs(h - previous) < 0.4) h += 0.6;
        previous = h;
        // Each face wanders a little; upper layers step back from both faces and from the way through.
        const j0 = 0.2 + r() * 0.1;
        const j1 = 0.2 + r() * 0.1;
        let y0 = -0.3;
        const layers = 3;
        for (let m = 0; m < layers; m += 1) {
          const y1 = m === layers - 1 ? h : h * ((m + 1) / layers) * (0.94 + r() * 0.08);
          const inset = m * 0.2;
          const xa = x === half ? half + r() * 0.15 + inset : x;
          const xb = x + w;
          const za = z0 - j0 + inset;
          const zb = z1 + j1 - inset;
          b.box(xb - xa, y1 - y0, zb - za, shade(look.rock, m % 2 ? 0.86 : 0.98 + r() * 0.06), 'flat', { x: (side * (xa + xb)) / 2, y: (y0 + y1) / 2, z: (za + zb) / 2 });
          y0 = y1;
        }
        if (look.cap !== null) {
          const xa = x === half ? half + 0.25 : x;
          b.box(x + w - xa, 0.44, z1 - z0 + 0.34, shade(look.cap, 0.94 + r() * 0.1), 'flat', { x: (side * (xa + x + w)) / 2, y: h + 0.22, z: zc });
          if (look.family === 'jungle' || look.family === 'swamp' || look.family === 'ruins') {
            hangingVine(b, r, side * (x + w * 0.5), h, z0 - 0.55, Math.min(h - 3, 3 + r() * 5));
          }
        }
        x += w;
      }
    }
    // The lintel: a heavy beam stone at the way's height, a taller stone on it, a keystone boulder.
    const lintelTop = (H + 5.4 + r() * 1.2) * Math.min(drama, 1.12);
    b.box(half * 2 + 3.6, 2.6, z1 - z0 + 0.7, shade(look.rock, 0.88), 'flat', { x: 0, y: H + 1.3, z: zc });
    b.box(half * 2 + 3, lintelTop - H - 2.6, z1 - z0 + 0.3, look.rock, 'flat', { x: 0, y: (H + 2.6 + lintelTop) / 2, z: zc });
    rock(b, r, 0, lintelTop - 0.4, zc, 1.8, shade(look.rock, 1.05));
    if (look.cap !== null) b.box(half * 2 + 3.3, 0.4, z1 - z0 + 0.6, shade(look.cap, 1.02), 'flat', { x: 0, y: lintelTop + 0.19, z: zc });
    // Two crystal lamps set into the beam's face, pointing out at the arena.
    const lamps: BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        const g = new ConeGeometry(0.42 - i * 0.08, 1.7 - i * 0.3, 5);
        g.rotateX(-Math.PI / 2 + (i - 1) * 0.35);
        g.rotateY((i - 1) * 0.3);
        g.translate(s * (half - 2) + (i - 1) * 0.55, H + 1.3 + (i === 1 ? 0.4 : -0.1), z0 - 0.35 - 0.55);
        lamps.push(g);
      }
    }
    const merged = mergeGeometries(lamps, false);
    for (const g of lamps) g.dispose();
    if (merged && arena.lamps) group.add(new Mesh(merged, arena.lamps));
  }

  /** Planks lashed side by side into a board, facing +Z (the way in), for a sign to hang on. */
  private plankBoard(b: PartBuilder, x: number, y: number, z: number, w: number, h: number): void {
    const planks = 3;
    for (let i = 0; i < planks; i += 1) {
      const py = y - h / 2 + (i + 0.5) * (h / planks);
      b.box(w - (i % 2) * 0.3, h / planks - 0.1, 0.3, shade(0x8a5a2e, 0.92 + (i % 2) * 0.1), 'flat', { x, y: py, z });
    }
    for (const s of [-1, 1]) b.box(0.5, h + 0.4, 0.44, 0xd8b070, 'flat', { x: x + s * (w / 2 - 1.2), y, z });
  }

  /** Stage 1's log doors, hinged at the arch: square logs lashed with rope, a brace and crossed bones. */
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
      const logs = 6;
      for (let i = 0; i < logs; i += 1) {
        const lh = H - (i % 2) * 0.5;
        leaf.box(w / logs - 0.08, lh, 0.8, shade(0x9a6232, 0.88 + r() * 0.2), 'flat', { x: -s * (w / (logs * 2) + (i * w) / logs), y: lh / 2, z: 0 });
      }
      for (const y of [2.6, H - 2.6]) leaf.box(w, 0.6, 1.0, 0xd8b070, 'flat', { x: (-s * w) / 2, y, z: 0 });
      leaf.box(0.6, H * 0.86, 0.96, 0x6a4020, 'flat', { x: (-s * w) / 2, y: H / 2, z: 0, rz: s * 0.62 });
      // Crossed bones fixed to the logs' face (the face toward the arena, -Z).
      bone(leaf, (-s * w) / 2, H * 0.66, -0.66, 3.2, 0.18, 0, 0.7);
      bone(leaf, (-s * w) / 2, H * 0.66, -0.7, 3.2, 0.18, 0, -0.7);
      hinge.add(leaf.build(`gate-${index}-${s}`));
      doors.add(hinge);
    }
    return doors;
  }

  /**
   * A CURTAIN OF THORN VINES across a later arch: dark strands hanging from the
   * lintel to the ground, tangled together, studded with glowing red thorns.
   * It hangs from its top, so it rolls up into the arch when the wave is down.
   */
  private buildCurtain(index: number, r: Rand, end: number): Group {
    const half = ARENA.portalHalfWidth;
    const H = ARENA.portalHeight;
    const curtain = new Group();
    curtain.position.set(0, H, end + 1.3);
    const b = new PartBuilder();
    const strands = 17;
    for (let i = 0; i < strands; i += 1) {
      const x = -half + (i + 0.5) * ((half * 2) / strands);
      const segs = 10;
      const seg = H / segs;
      for (let k = 0; k < segs; k += 1) {
        const sway = Math.sin(k * 0.8 + i * 1.7) * 0.18;
        const y = -seg * (k + 0.5);
        b.box(0.34, seg * 1.04, 0.34, shade(0x2e6a2a, 0.85 + r() * 0.3), 'flat', { x: x + sway, y, z: (i % 2) * 0.3 - 0.15 });
        if ((k + i) % 2 === 0) b.box(0.8, 0.12, 0.44, shade(0x3a9a3a, 0.9 + r() * 0.2), 'leaf', { x: x + sway, y: y - seg * 0.2, z: (i % 2) * 0.3 - 0.15, ry: r() * 3, rz: 0.4 });
        if ((k * 3 + i) % 4 === 0) b.add(new ConeGeometry(0.12, 0.5, 4), 0xff3a2a, 'glow', { x: x + sway - 0.3, y, z: -0.3, rz: Math.PI / 2 });
      }
    }
    // Cross tangles binding the strands.
    for (let k = 0; k < 4; k += 1) b.box(half * 2, 0.26, 0.3, 0x27582a, 'flat', { x: 0, y: -H * (0.2 + k * 0.2) + (r() - 0.5), z: -0.35, rz: (r() - 0.5) * 0.1 });
    curtain.add(b.build(`curtain-${index}`, false));
    return curtain;
  }

  /** Waterfalls cascading down both side walls, tier by tier, into the river. */
  private buildFalls(b: PartBuilder, r: Rand, group: Group, arena: ArenaVisual, look: Look): void {
    const width = 5;
    const color = shade(look.liquid!.color, 1.25);
    const parts: BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      // Where the river's course meets this wall (the painter's own curve).
      const zr = arena.painter.riverZ + Math.sin(side * (ARENA.halfWidth - 1) * 0.11 + arena.stage) * 2.6;
      const wall = arena.ledges.filter((l) => l.run === 'z' && Math.sign(l.x) === side);
      parts.push(...cascade(b, r, wall, side * ARENA.halfWidth, side as 1 | -1, zr, width, -0.1, color));
    }
    const merged = parts.length ? mergeGeometries(parts, false) : null;
    for (const g of parts) g.dispose();
    if (merged) {
      const falls = new Mesh(merged, waterfallSurface());
      falls.renderOrder = 1;
      group.add(falls);
    }
  }

  /**
   * THE HENGE over the reward pad: two standing stones on the reward-arch
   * solids, a lintel stone across them, glowing runes on their faces and an
   * amber gem set in the lintel.
   */
  private buildHenge(b: PartBuilder, r: Rand, index: number, look: Look): void {
    const pad = rewardPadOf(index);
    const z1 = arenaEndZ(index);
    const stone = shade(look.rock, 1.18);
    const span = REWARD_ARCH.halfSpan;
    const H = REWARD_ARCH.height;
    for (const s of [-1, 1]) {
      const x = pad.x + s * span;
      b.box(2.1, H * 0.6, 2.2, stone, 'flat', { x, y: H * 0.3 - 0.2, z: z1 - 1.05 });
      b.box(1.8, H * 0.42, 1.9, shade(stone, 0.9), 'flat', { x, y: H * 0.6 - 0.2 + H * 0.21, z: z1 - 1.05 });
      for (let k = 0; k < 3; k += 1) b.box(0.9 - k * 0.2, 0.16, 0.12, look.accent, 'glow', { x, y: 2.2 + k * 1.6, z: z1 - 2.2 });
      rock(b, r, x + s * 1.6, 0, z1 - 2.6, 0.6, look.rock);
    }
    b.box(span * 2 + 3.8, 1.8, 2.6, shade(stone, 0.95), 'flat', { x: pad.x, y: H + 0.7, z: z1 - 1.1 });
    b.box(1.3, 1.3, 0.5, 0xffb02a, 'glow', { x: pad.x, y: H + 0.7, z: z1 - 2.4, rz: Math.PI / 4 });
    stonePad(b, pad.x, 0.05, pad.z, pad.half + 0.8, shade(look.rock, 1.25), 0xb8902a);
  }

  private mat<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  // -------------------------------------------------------------- dressing

  /**
   * Dress an arena: plants on every terrace, deliberate groups along the foot
   * of both walls, low life over the open floor, and the habitat's big
   * scenery over the walls. The middle stays open for the fight.
   */
  private dress(arena: ArenaVisual): Group {
    const stage = arena.stage;
    const def = STAGES[stage - 1]!;
    const biome = BIOMES[def.theme];
    const look = arena.look;
    const r = seeded(0xd0e5 + stage * 977);
    const b = new PartBuilder();
    const start = arenaStartZ(stage);
    const end = arenaEndZ(stage);
    const mid = (start + end) / 2;
    const W = ARENA.halfWidth;

    plantLedges(b, r, arena.ledges, look, this.sparse);

    // Along both walls, between the rock solids: a group every stretch.
    for (const side of [-1, 1]) {
      for (const z of [start + 16, start + 26, mid + 10, end - 8]) {
        // The reward pad and its henge hold the far corner of the +X side.
        if (side > 0 && z > end - 20) continue;
        edgeCluster(b, r, side * (W - 2.6), z, side, look);
      }
    }
    fieldDressing(b, r, stage, start, end, look, arena.painter.wet, this.sparse);

    // Beyond the walls: the habitat's big scenery, and for the green ones a row of
    // giant trees whose canopies lean over the walls.
    const beyond = this.sparse ? 5 : 8;
    for (const side of [-1, 1]) {
      for (let i = 0; i < beyond; i += 1) {
        const x = side * (W + 20 + r() * 48);
        const z = start - 4 + r() * (end - start + 8);
        const [placer, , scale] = weighted(r, biome.beyond);
        placer(b, r, x, 0, z, scale * (0.8 + r() * 0.4));
      }
      if (look.family === 'jungle' || look.family === 'swamp' || look.family === 'river' || look.family === 'ruins') {
        for (let i = 0; i < 5; i += 1) jungleGiant(b, r, side * (W + 13 + r() * 5), 0, start + ((i + 0.2 + r() * 0.6) / 5) * (end - start), 1.1 + r() * 0.35);
      } else if (look.family === 'forest') {
        for (let i = 0; i < 4; i += 1) redwood(b, r, side * (W + 14 + r() * 5), 0, start + ((i + 0.3 + r() * 0.4) / 4) * (end - start), 1 + r() * 0.2);
      }
    }
    // Plants and relics take the light but cast no shadow: the shadow pass would otherwise draw every leaf twice.
    return b.build(`arena-${stage}-dressing`, false);
  }

  // ------------------------------------------------------------- progress

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

  /** Only arenas near the rider are built and drawn; the rest of the road is fogged anyway. */
  update(delta: number, z: number): void {
    this.time += delta;
    this.winFx.update(delta);
    let built = false;
    for (const arena of this.arenas) {
      const mid = (arenaStartZ(arena.stage) + arenaEndZ(arena.stage)) / 2;
      const distance = Math.abs(mid - z);
      arena.root.visible = distance < 340;
      // At most one heavy build per frame, so riding the road never hitches twice.
      if (!arena.body && distance < BUILD_NEAR && !built) {
        built = true;
        arena.body = this.buildBody(arena);
        arena.root.add(arena.body);
      } else if (arena.body && distance > BUILD_FAR) {
        if (arena.dressing) releaseGroup(arena.dressing);
        arena.dressing = null;
        releaseGroup(arena.body);
        arena.body = null;
        arena.ledges = [];
      }
      if (arena.body && !arena.dressing && distance < DRESS_NEAR && !built) {
        built = true;
        arena.dressing = this.dress(arena);
        arena.root.add(arena.dressing);
      } else if (arena.dressing && distance > DRESS_FAR) {
        releaseGroup(arena.dressing);
        arena.dressing = null;
      }
      if (!arena.root.visible) continue;
      const want = arena.stage <= this.opened ? 1 : 0;
      // Stage 1's doors swing open (and shut again on a new run).
      if (arena.doors) {
        arena.doorOpen += (want - arena.doorOpen) * (1 - Math.exp(-3 * delta));
        const [left, right] = arena.doors.children;
        if (left) left.rotation.y = -arena.doorOpen * 1.45;
        if (right) right.rotation.y = arena.doorOpen * 1.45;
      }
      // A later gate's thorn curtain rolls up into its arch (and drops again).
      if (arena.curtain) {
        arena.curtainOpen += (want - arena.curtainOpen) * (1 - Math.exp(-2.6 * delta));
        const k = 1 - arena.curtainOpen;
        arena.curtain.scale.y = Math.max(0.02, k);
        arena.curtain.visible = k > 0.03;
      }
    }
  }

  dispose(): void {
    for (const arena of this.arenas) {
      if (arena.dressing) releaseGroup(arena.dressing);
      if (arena.body) releaseGroup(arena.body);
    }
    for (const sign of this.signs) sign.dispose();
    for (const label of this.labels) label.dispose();
    for (const material of this.materials) material.dispose();
    this.winFx.dispose();
    this.root.removeFromParent();
  }
}

/** Drop a built group: its merged geometries are its own (the materials are shared). */
const releaseGroup = (group: Group): void => {
  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
  group.removeFromParent();
};

export type { Rand };
