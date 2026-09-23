import { CatmullRomCurve3, Color, Vector3 } from 'three';
import type { Look, Palette, SkinPattern } from './DinoLooks.js';
import { buildSkeleton, sectionAt, type LimbChain, type SkeletonLayout } from './DinoSkeleton.js';
import type { Feature, HeadKind, Section, SpeciesSpec } from './DinoSpecies.js';
import { SPECIES } from './DinoSpecies.js';
import { SkinnedMeshData, type Influence, type PartTag } from './geometry/SkinnedMeshData.js';

/**
 * BLOCK-BUILT DINOSAURS: the Roblox construction.
 *
 * Every animal keeps its species' real skeleton - the same bones, proportions,
 * silhouette and animation as before - but its body is built the way a
 * Roblox modeller builds one: RIGID BLOCKS, each welded to one bone, slightly
 * overlapping at the joints so a bending neck or a swinging tail never opens
 * a gap. Tapered boxes for the body, neck and tail segments; a cranium, snout
 * and jaw of boxes; boxy thighs, shins and feet; pyramids for teeth, claws,
 * horns and spikes; thin slabs for sails, frills, crests and plates.
 *
 * Colour is flat, bright "SmoothPlastic": the back colour on top faces, the
 * flank colour on the sides, the belly underneath, and the species' markings
 * as crisp decal blocks (a raptor's flank stripe, a tiger's bands, spots)
 * sitting a hair proud of the surface - no gradients, no noise, no texture.
 */

/** Rideable dinosaurs and bosses build at 'high', wave dinosaurs at 'medium', pets at 'low'. */
export type BuildQuality = 'high' | 'medium' | 'low';

export interface BuiltDino {
  readonly data: SkinnedMeshData;
  readonly layout: SkeletonLayout;
  readonly spec: SpeciesSpec;
  /** Where the rider sits, model space, and on which bone. */
  readonly seat: { readonly bone: number; readonly pos: Vector3 };
  /** Half-width and depth of the back at the seat, for the saddle. */
  readonly seatSection: Section;
}

/** A block welded to one bone. */
const single = (bone: number): Influence => ({ bones: [bone], weights: [1] });

/** Hatchling proportions: a bigger head and eyes, a shorter snout, stubbier limbs and tail, smaller ornaments. */
export const juvenileSpec = (spec: SpeciesSpec): SpeciesSpec => ({
  ...spec,
  head: {
    ...spec.head,
    length: spec.head.length * 1.3,
    height: spec.head.height * 1.5,
    width: spec.head.width * 1.45,
    eye: spec.head.eye * 1.9,
    toothSize: spec.head.toothSize * 0.6,
  },
  neck: { ...spec.neck, length: spec.neck.length * 0.8 },
  tail: { ...spec.tail, length: spec.tail.length * 0.8 },
  legs: { ...spec.legs, thigh: spec.legs.thigh * 1.15, shin: spec.legs.shin * 1.2, foot: spec.legs.foot * 1.2 },
  features: spec.features.map((f): Feature => {
    switch (f.kind) {
      case 'sail':
      case 'ridge':
      case 'plates':
        return { ...f, height: f.height * 0.6 };
      case 'browHorns':
        return { ...f, length: f.length * 0.45 };
      case 'noseHorn':
      case 'thagomizer':
      case 'shoulderSpikes':
      case 'sideSpikes':
      case 'quills':
        return { ...f, length: f.length * 0.5 };
      case 'frill':
        return { ...f, size: f.size * 0.7 };
      case 'tubeCrest':
        return { ...f, length: f.length * 0.45 };
      default:
        return f;
    }
  }),
});

type RGB = readonly [number, number, number];

interface Sec {
  /** Half-width. */
  readonly w: number;
  /** Extent above the centre line (negative: the top plane sits below it). */
  readonly top: number;
  /** Extent below the centre line (negative: the bottom plane sits above it). */
  readonly bot: number;
}

interface Faces {
  readonly top: RGB;
  readonly bottom: RGB;
  readonly side: RGB;
  readonly cap: RGB;
}

interface Tones {
  readonly back: RGB;
  readonly side: RGB;
  readonly belly: RGB;
  readonly pattern: RGB;
  readonly accent: RGB;
  readonly accent2: RGB;
  readonly horn: RGB;
  readonly claw: RGB;
  readonly teeth: RGB;
  readonly mouth: RGB;
  readonly eye: RGB;
  readonly pupil: RGB;
  readonly kind: SkinPattern;
  readonly strength: number;
}

const V = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const Y = V(0, 1, 0);
const Z = V(0, 0, 1);
const TMP = new Color();

/** Palette colours pushed toward clean, saturated plastic. */
const plastic = (hex: string, satBoost = 1.22, lift = 1.04): RGB => {
  TMP.set(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  TMP.getHSL(hsl);
  TMP.setHSL(hsl.h, Math.min(1, hsl.s * satBoost + 0.03), Math.min(0.94, hsl.l * lift + 0.01));
  return [TMP.r, TMP.g, TMP.b];
};

const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scaleRgb = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

const tonesOf = (palette: Palette, silhouette: boolean): Tones => {
  if (silhouette) {
    const d: RGB = [0.03, 0.03, 0.035];
    const d2: RGB = [0.05, 0.05, 0.055];
    return { back: d, side: d, belly: d2, pattern: d, accent: d2, accent2: d2, horn: d2, claw: d, teeth: d2, mouth: d, eye: d2, pupil: d, kind: 'none', strength: 0 };
  }
  const effigy = palette.material !== undefined && palette.material !== 'skin';
  const boost = effigy ? 1.05 : 1.32;
  return {
    back: plastic(palette.back, boost, effigy ? 1.04 : 1.12),
    side: plastic(palette.side, boost, effigy ? 1.04 : 1.1),
    belly: plastic(palette.belly, boost, 1.06),
    pattern: plastic(palette.patternColor, 1.3),
    accent: plastic(palette.accent, 1.3),
    accent2: plastic(palette.accent2, 1.3),
    horn: plastic(palette.horn, 1.0),
    claw: plastic(palette.claw, 1.0, 0.9),
    teeth: [0.95, 0.94, 0.9],
    mouth: plastic('#c8303a', 1.1, 1),
    eye: plastic(palette.eye, 1.3, 1.05),
    pupil: [0.02, 0.02, 0.025],
    kind: effigy ? 'none' : palette.pattern,
    strength: palette.patternStrength,
  };
};

const faces = (top: RGB, side: RGB, bottom: RGB, cap: RGB = side): Faces => ({ top, side, bottom, cap });
const flat = (c: RGB): Faces => ({ top: c, side: c, bottom: c, cap: c });

const lerpSec = (a: Sec, b: Sec, t: number): Sec => ({ w: a.w + (b.w - a.w) * t, top: a.top + (b.top - a.top) * t, bot: a.bot + (b.bot - a.bot) * t });
const toSec = (s: Section): Sec => ({ w: s.w, top: s.hTop, bot: s.hBot });

/** A rigid box segment's frame, for decals and features that follow it. */
interface Segment {
  readonly p0: Vector3;
  readonly p1: Vector3;
  readonly t: Vector3;
  readonly up: Vector3;
  readonly side: Vector3;
  readonly s0: Sec;
  readonly s1: Sec;
  readonly inf: Influence;
  readonly b0: number;
  readonly b1: number;
}

// ---------------------------------------------------------------- geometry

class Blocks {
  constructor(readonly data: SkinnedMeshData) {}

  private face(corners: readonly Vector3[], center: Vector3, color: RGB, inf: Influence, part: PartTag): void {
    const [a, b, c, d] = corners as [Vector3, Vector3, Vector3, Vector3];
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    const fc = new Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
    const order = n.dot(fc.sub(center)) < 0 ? [a, d, c, b] : [a, b, c, d];
    const i0 = this.data.addVertex(order[0]!, 0, 0, color, inf, part);
    const i1 = this.data.addVertex(order[1]!, 1, 0, color, inf, part);
    const i2 = this.data.addVertex(order[2]!, 1, 1, color, inf, part);
    const i3 = this.data.addVertex(order[3]!, 0, 1, color, inf, part);
    this.data.triangle(i0, i1, i2);
    this.data.triangle(i0, i2, i3);
  }

  /** Eight corners: [start lb, rb, rt, lt, end lb, rb, rt, lt]. */
  hexa(c: readonly Vector3[], colors: Faces, inf: Influence, part: PartTag, capPart: PartTag = part, bottomPart: PartTag = part): void {
    const center = new Vector3();
    for (const p of c) center.add(p);
    center.multiplyScalar(1 / 8);
    const q = (i: number, j: number, k: number, l: number): Vector3[] => [c[i]!, c[j]!, c[k]!, c[l]!];
    this.face(q(3, 2, 6, 7), center, colors.top, inf, part);
    this.face(q(0, 1, 5, 4), center, colors.bottom, inf, bottomPart);
    this.face(q(0, 3, 7, 4), center, colors.side, inf, part);
    this.face(q(1, 2, 6, 5), center, colors.side, inf, part);
    this.face(q(0, 1, 2, 3), center, colors.cap, inf, capPart);
    this.face(q(4, 5, 6, 7), center, colors.cap, inf, capPart);
  }

  /** The frame of a segment from p0 to p1 with a reference up. */
  frame(p0: Vector3, p1: Vector3, upRef: Vector3): { t: Vector3; up: Vector3; side: Vector3 } {
    const t = new Vector3().subVectors(p1, p0);
    if (t.lengthSq() < 1e-10) t.copy(Z);
    t.normalize();
    const up = upRef.clone().addScaledVector(t, -upRef.dot(t));
    if (up.lengthSq() < 1e-6) up.copy(Math.abs(t.z) < 0.9 ? Z : Y).addScaledVector(t, -(Math.abs(t.z) < 0.9 ? t.z : t.y));
    up.normalize();
    const side = new Vector3().crossVectors(up, t).normalize();
    return { t, up, side };
  }

  /** A tapered box from p0 (section s0) to p1 (section s1). */
  frustum(
    p0: Vector3,
    p1: Vector3,
    s0: Sec,
    s1: Sec,
    upRef: Vector3,
    inf: Influence,
    colors: Faces,
    part: PartTag,
    opts: { ext0?: number; ext1?: number; capPart?: PartTag; bottomPart?: PartTag } = {},
  ): { t: Vector3; up: Vector3; side: Vector3; a: Vector3; b: Vector3 } {
    const f = this.frame(p0, p1, upRef);
    const a = p0.clone().addScaledVector(f.t, -(opts.ext0 ?? 0));
    const b = p1.clone().addScaledVector(f.t, opts.ext1 ?? 0);
    const ring = (p: Vector3, s: Sec): Vector3[] => [
      p.clone().addScaledVector(f.side, -s.w).addScaledVector(f.up, -s.bot),
      p.clone().addScaledVector(f.side, s.w).addScaledVector(f.up, -s.bot),
      p.clone().addScaledVector(f.side, s.w).addScaledVector(f.up, s.top),
      p.clone().addScaledVector(f.side, -s.w).addScaledVector(f.up, s.top),
    ];
    this.hexa([...ring(a, s0), ...ring(b, s1)], colors, inf, part, opts.capPart ?? part, opts.bottomPart ?? part);
    return { ...f, a, b };
  }

  /** An axis-aligned-in-its-frame box: centre, half extents along (side, up, forward). */
  box(center: Vector3, hx: number, hy: number, hz: number, up: Vector3, forward: Vector3, inf: Influence, colors: Faces, part: PartTag): void {
    const f = forward.clone().normalize();
    const p0 = center.clone().addScaledVector(f, -hz);
    const p1 = center.clone().addScaledVector(f, hz);
    const s: Sec = { w: hx, top: hy, bot: hy };
    this.frustum(p0, p1, s, s, up, inf, colors, part);
  }

  /** A square pyramid from a base centre to a tip (teeth, claws, horns, spikes). */
  pyramid(base: Vector3, tip: Vector3, r: number, sideRef: Vector3, inf: Influence, color: RGB, part: PartTag, flatten = 1): void {
    const dir = new Vector3().subVectors(tip, base);
    if (dir.lengthSq() < 1e-10) return;
    dir.normalize();
    const u = sideRef.clone().addScaledVector(dir, -sideRef.dot(dir));
    if (u.lengthSq() < 1e-6) u.copy(Math.abs(dir.y) < 0.9 ? Y : Z).addScaledVector(dir, -(Math.abs(dir.y) < 0.9 ? dir.y : dir.z));
    u.normalize();
    const s = new Vector3().crossVectors(dir, u).normalize();
    const c = [
      base.clone().addScaledVector(u, r * flatten).addScaledVector(s, r),
      base.clone().addScaledVector(u, r * flatten).addScaledVector(s, -r),
      base.clone().addScaledVector(u, -r * flatten).addScaledVector(s, -r),
      base.clone().addScaledVector(u, -r * flatten).addScaledVector(s, r),
    ];
    const center = base.clone().lerp(tip, 0.25);
    const tri = (a: Vector3, b: Vector3, cc: Vector3): void => {
      const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(cc, a));
      const fc = new Vector3().add(a).add(b).add(cc).multiplyScalar(1 / 3);
      const flip = n.dot(fc.sub(center)) < 0;
      const i0 = this.data.addVertex(a, 0, 0, color, inf, part);
      const i1 = this.data.addVertex(flip ? cc : b, 1, 0, color, inf, part);
      const i2 = this.data.addVertex(flip ? b : cc, 0, 1, color, inf, part);
      this.data.triangle(i0, i1, i2);
    };
    for (let i = 0; i < 4; i += 1) tri(c[i]!, c[(i + 1) % 4]!, tip);
    tri(c[0]!, c[1]!, c[2]!);
    tri(c[0]!, c[2]!, c[3]!);
  }
}

// ---------------------------------------------------------------- the build

const EYES: Readonly<Record<HeadKind, readonly [number, number]>> = {
  theropod: [0.26, 0.5],
  raptor: [0.26, 0.45],
  tyrant: [0.25, 0.5],
  abelisaur: [0.28, 0.5],
  croc: [0.2, 0.75],
  beak: [0.3, 0.45],
  duck: [0.25, 0.45],
  ceratopsian: [0.3, 0.45],
  dome: [0.3, 0.3],
  armored: [0.32, 0.35],
  sauropod: [0.32, 0.45],
  stego: [0.32, 0.35],
};

/** Skull profile per kind: [cranium w, cranium top, cranium bot, snout-root w, top, bot, snout-tip w, top, bot] as fractions of W, H. */
const SKULL: Readonly<Record<HeadKind, readonly number[]>> = {
  theropod: [0.5, 0.56, 0.44, 0.44, 0.48, 0.36, 0.3, 0.3, 0.24],
  raptor: [0.5, 0.52, 0.42, 0.4, 0.38, 0.3, 0.24, 0.2, 0.18],
  tyrant: [0.6, 0.62, 0.5, 0.5, 0.52, 0.4, 0.38, 0.36, 0.3],
  abelisaur: [0.54, 0.6, 0.46, 0.48, 0.52, 0.38, 0.34, 0.36, 0.28],
  croc: [0.46, 0.42, 0.3, 0.3, 0.26, 0.22, 0.22, 0.17, 0.16],
  beak: [0.5, 0.54, 0.38, 0.4, 0.4, 0.3, 0.14, 0.14, 0.1],
  duck: [0.5, 0.5, 0.38, 0.36, 0.3, 0.26, 0.38, 0.18, 0.18],
  ceratopsian: [0.52, 0.52, 0.4, 0.4, 0.44, 0.36, 0.16, 0.24, 0.3],
  dome: [0.5, 0.48, 0.36, 0.38, 0.34, 0.28, 0.2, 0.14, 0.12],
  armored: [0.56, 0.42, 0.32, 0.46, 0.36, 0.28, 0.3, 0.2, 0.18],
  sauropod: [0.48, 0.6, 0.34, 0.42, 0.44, 0.3, 0.3, 0.22, 0.2],
  stego: [0.42, 0.4, 0.32, 0.34, 0.3, 0.26, 0.14, 0.14, 0.12],
};

const hash = (i: number, salt: number): number => {
  let h = Math.imul(i + 17, 374761393) ^ Math.imul(salt + 3, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export const buildBlockDino = (look: Look, quality: BuildQuality, silhouette = false): BuiltDino => {
  const species = SPECIES[look.species] as SpeciesSpec;
  const natural: SpeciesSpec = look.features ? { ...species, features: [...species.features, ...look.features] } : species;
  const spec = look.juvenile ? juvenileSpec(natural) : natural;
  const layout = buildSkeleton(spec);
  const data = new SkinnedMeshData();
  const k = new Blocks(data);
  const tone = tonesOf(look.palette, silhouette);
  const detailed = quality !== 'low';

  const body = buildBody(k, spec, layout, tone, detailed);
  buildHead(k, spec, layout, tone, detailed);
  for (const leg of layout.hind) buildHindLeg(k, spec, layout, leg, tone);
  for (const limb of layout.fore) buildFore(k, spec, layout, limb, tone);
  for (const feature of spec.features) buildFeature(k, spec, layout, body, feature, tone);

  const seatSection = sectionAt(spec, spec.stance === 'biped' ? 0.36 : 0.45);
  return { data, layout, spec, seat: layout.seat, seatSection };
};

// ------------------------------------------------------------------ body

const buildBody = (k: Blocks, spec: SpeciesSpec, layout: SkeletonLayout, tone: Tones, detailed: boolean): Segment[] => {
  const line = layout.centerline;
  const skin = faces(tone.back, tone.side, tone.belly);
  const segments: Segment[] = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = a.pos.distanceTo(b.pos);
    if (len < 1e-4) continue;
    const mid = toSec(sectionAt(spec, (a.b + b.b) / 2));
    // Mildly tapered: each block reads as one chunky part, stepping down the tail.
    const s0 = lerpSec(mid, toSec(sectionAt(spec, Math.max(-1, a.b + 0.02))), 0.55);
    const s1 = lerpSec(mid, toSec(sectionAt(spec, Math.min(2, b.b))), 0.55);
    const inf = single(a.bone);
    const ext0 = i === 0 ? 0 : Math.min(len * 0.18, Math.max(s0.w, s0.top) * 0.5);
    const ext1 = Math.min(len * 0.18, Math.max(s1.w, s1.top) * 0.5);
    const f = k.frustum(a.pos, b.pos, s0, s1, Y, inf, skin, 'body', { ext0, ext1 });
    const seg: Segment = { p0: f.a, p1: f.b, t: f.t, up: f.up, side: f.side, s0, s1, inf, b0: a.b, b1: b.b };
    segments.push(seg);
    if (detailed || i % 2 === 0) decorate(k, seg, tone, i);
  }
  return segments;
};

/** A slice of a segment, reshaped: the decals (markings) and belly plates. */
const slice = (k: Blocks, seg: Segment, f0: number, f1: number, shape: (s: Sec) => Sec, colors: Faces, part: PartTag = 'body'): void => {
  const p0 = seg.p0.clone().lerp(seg.p1, f0);
  const p1 = seg.p0.clone().lerp(seg.p1, f1);
  k.frustum(p0, p1, shape(lerpSec(seg.s0, seg.s1, f0)), shape(lerpSec(seg.s0, seg.s1, f1)), seg.up, seg.inf, colors, part);
};

const decorate = (k: Blocks, seg: Segment, tone: Tones, index: number): void => {
  const b = (seg.b0 + seg.b1) / 2;
  if (b < -0.9 || b > 2) return;
  const pat = flat(tone.pattern);
  // A pale belly band down the flanks' lower edge: the two-tone plastic look.
  if (b > -0.75 && b < 1.95) {
    slice(k, seg, 0.02, 0.98, (s) => ({ w: s.w * 1.02, top: -s.bot * 0.42, bot: s.bot * 1.02 }), faces(tone.belly, tone.belly, tone.belly));
  }
  if (tone.strength < 0.15) return;
  switch (tone.kind) {
    case 'lateral':
      // One bold stripe down each flank, neck to tail.
      if (b > -0.85) slice(k, seg, 0, 1, (s) => ({ w: s.w * 1.035, top: s.top * 0.34, bot: -s.top * 0.06 }), pat);
      break;
    case 'tiger':
    case 'bands': {
      const wide = tone.kind === 'bands' ? 0.22 : 0.13;
      const count = seg.p0.distanceTo(seg.p1) > Math.max(seg.s0.w, seg.s0.top) * 3 ? 2 : 1;
      for (let j = 0; j < count; j += 1) {
        const c = count === 1 ? 0.55 : 0.28 + j * 0.44;
        slice(k, seg, c - wide, c + wide, (s) => ({ w: s.w * 1.04, top: s.top * 1.04, bot: s.bot * (tone.kind === 'bands' ? 0.1 : -0.15) }), pat);
      }
      break;
    }
    case 'saddle':
      if (index % 2 === 0) slice(k, seg, 0.15, 0.85, (s) => ({ w: s.w * 1.03, top: s.top * 1.04, bot: -s.top * 0.35 }), pat);
      break;
    case 'mottle':
    case 'spots': {
      const n = tone.kind === 'spots' ? 3 : 2;
      for (let j = 0; j < n; j += 1) {
        const f = 0.15 + hash(index, j) * 0.7;
        const across = (hash(index, j + 9) - 0.5) * 1.4;
        const at = seg.p0.clone().lerp(seg.p1, f);
        const s = lerpSec(seg.s0, seg.s1, f);
        const size = Math.max(s.w, s.top) * (tone.kind === 'spots' ? 0.22 : 0.4);
        // On the back, or the upper flank.
        const onTop = tone.kind === 'mottle' || Math.abs(across) < 0.45;
        const center = onTop
          ? at.clone().addScaledVector(seg.up, s.top).addScaledVector(seg.side, across * s.w)
          : at.clone().addScaledVector(seg.up, s.top * 0.35).addScaledVector(seg.side, Math.sign(across) * s.w);
        const normal = onTop ? seg.up : seg.side.clone().multiplyScalar(Math.sign(across));
        const lateral = onTop ? seg.side : seg.up;
        // A thin tile flush on the face.
        const p0 = center.clone().addScaledVector(normal, -size * 0.12);
        const p1 = center.clone().addScaledVector(normal, size * 0.05);
        const sec: Sec = { w: size, top: size * 0.7, bot: size * 0.7 };
        k.frustum(p0, p1, sec, sec, onTop ? seg.t : seg.t, seg.inf, pat, 'body');
        void lateral;
      }
      break;
    }
    default:
      break;
  }
};

/** The body segment and its local frame at a body coordinate. */
const bodyAt = (segments: readonly Segment[], b: number): { center: Vector3; seg: Segment; s: Sec } => {
  let best = segments[0]!;
  for (const seg of segments) {
    if (b >= Math.min(seg.b0, seg.b1) && b <= Math.max(seg.b0, seg.b1)) {
      best = seg;
      break;
    }
    if (Math.abs((seg.b0 + seg.b1) / 2 - b) < Math.abs((best.b0 + best.b1) / 2 - b)) best = seg;
  }
  const span = best.b1 - best.b0;
  const f = Math.min(1, Math.max(0, span === 0 ? 0.5 : (b - best.b0) / span));
  return { center: best.p0.clone().lerp(best.p1, f), seg: best, s: lerpSec(best.s0, best.s1, f) };
};

// ------------------------------------------------------------------ head

interface Skull {
  readonly origin: Vector3;
  readonly up: Vector3;
  readonly fwd: Vector3;
  readonly right: Vector3;
  readonly L: number;
  readonly H: number;
  readonly W: number;
  readonly cranium: Sec;
  readonly root: Sec;
  readonly tip: Sec;
  /** Point along the skull at fraction s (0 back of the cranium, 1 the snout tip). */
  at(s: number): Vector3;
  /** The skull's section at fraction s. */
  sec(s: number): Sec;
}

const skullOf = (spec: SpeciesSpec, layout: SkeletonLayout): Skull => {
  const { origin, forward, up } = layout.headFrame;
  const right = new Vector3().crossVectors(up, forward).normalize();
  const L = spec.head.length;
  const H = spec.head.height;
  const W = spec.head.width;
  const p = SKULL[spec.head.kind];
  const cranium: Sec = { w: p[0]! * W, top: p[1]! * H, bot: p[2]! * H };
  const root: Sec = { w: p[3]! * W, top: p[4]! * H, bot: p[5]! * H };
  const tip: Sec = { w: p[6]! * W, top: p[7]! * H, bot: p[8]! * H };
  const start = origin.clone().addScaledVector(forward, -L * 0.14);
  // The snout's centre line drops a little toward the nose, as a real skull's does.
  const at = (s: number): Vector3 => start.clone().addScaledVector(forward, s * L).addScaledVector(up, -Math.max(0, s - 0.4) * H * 0.18);
  const sec = (s: number): Sec => (s <= 0.42 ? cranium : lerpSec(root, tip, (s - 0.42) / 0.58));
  return { origin, up, fwd: forward, right, L, H, W, cranium, root, tip, at, sec };
};

const buildHead = (k: Blocks, spec: SpeciesSpec, layout: SkeletonLayout, tone: Tones, detailed: boolean): void => {
  const sk = skullOf(spec, layout);
  const head = single(layout.head);
  const jawInf = single(layout.jaw);
  const kind = spec.head.kind;
  const skin = faces(tone.back, tone.side, tone.belly);

  // Cranium and snout.
  k.frustum(sk.at(0), sk.at(0.44), sk.cranium, sk.cranium, sk.up, head, skin, 'head');
  k.frustum(sk.at(0.4), sk.at(1), sk.root, sk.tip, sk.up, head, faces(tone.back, tone.side, tone.mouth), 'head', { bottomPart: 'mouth' });
  if (tone.kind === 'lateral' && tone.strength > 0.15) {
    // The stripe runs on from the eye to the nose.
    const shape = (s: Sec): Sec => ({ w: s.w * 1.04, top: s.top * 0.3, bot: -s.top * 0.02 });
    k.frustum(sk.at(0.3), sk.at(0.44), shape(sk.cranium), shape(sk.cranium), sk.up, head, flat(tone.pattern), 'head');
    k.frustum(sk.at(0.44), sk.at(0.92), shape(sk.root), shape(lerpSec(sk.root, sk.tip, 0.85)), sk.up, head, flat(tone.pattern), 'head');
  }

  // The lower jaw: a box hinged under the skull, its top the red of the mouth.
  const jawEnd = kind === 'ceratopsian' || kind === 'duck' ? 0.9 : 0.97;
  const jawH0 = sk.H * (kind === 'tyrant' ? 0.34 : 0.28);
  const jawH1 = sk.H * 0.14;
  const j0 = sk.at(0.1).addScaledVector(sk.up, -sk.cranium.bot * 0.72);
  const j1 = sk.at(jawEnd).addScaledVector(sk.up, -sk.tip.bot * 0.98);
  k.frustum(
    j0,
    j1,
    { w: sk.root.w * 0.9, top: jawH0 * 0.25, bot: jawH0 * 0.75 },
    { w: sk.tip.w * 0.88, top: jawH1 * 0.3, bot: jawH1 * 0.7 },
    sk.up,
    jawInf,
    faces(tone.mouth, tone.side, tone.belly),
    'jaw',
  );

  // Teeth: white pyramids along both jaws.
  if (spec.head.teeth > 0 && !silhouetteLike(tone)) {
    const count = Math.min(detailed ? 7 : 4, spec.head.teeth);
    const size = Math.max(spec.head.toothSize * 1.25, sk.H * 0.055);
    for (const sign of [-1, 1]) {
      for (let i = 0; i < count; i += 1) {
        const s = 0.5 + (0.46 * i) / Math.max(1, count - 1);
        const sec = sk.sec(s);
        const base = sk.at(s).addScaledVector(sk.right, sign * sec.w * 0.78).addScaledVector(sk.up, -sec.bot * 0.95);
        const len = size * (i === 1 ? 1.35 : 1);
        k.pyramid(base, base.clone().addScaledVector(sk.up, -len), len * 0.32, sk.fwd, head, tone.teeth, 'tooth');
        if (i < count - 1) {
          const s2 = s + 0.46 / Math.max(1, count - 1) / 2;
          const sec2 = sk.sec(s2);
          const lb = sk.at(s2).addScaledVector(sk.right, sign * sec2.w * 0.74).addScaledVector(sk.up, -sec2.bot * 0.98);
          k.pyramid(lb, lb.clone().addScaledVector(sk.up, len * 0.75), len * 0.26, sk.fwd, jawInf, tone.teeth, 'tooth');
        }
      }
    }
  }

  // Eyes: a flat square of iris with a black slit pupil, under a heavy brow.
  const [eyeS, eyeH] = EYES[kind];
  const eyeR = Math.max(spec.head.eye * 1.35, sk.H * 0.1);
  for (const sign of [-1, 1]) {
    const out = sk.right.clone().multiplyScalar(sign);
    const center = sk.at(eyeS).addScaledVector(sk.up, sk.cranium.top * eyeH * 0.8).addScaledVector(out, sk.cranium.w);
    // A dark socket, the iris plate on it, then the slit a hair further out.
    const socket = { w: eyeR * 1.3, top: eyeR * 1.05, bot: eyeR * 1.05 };
    k.frustum(center.clone().addScaledVector(out, -eyeR * 0.3), center.clone().addScaledVector(out, eyeR * 0.05), socket, socket, sk.up, head, flat(scaleRgb(tone.back, 0.28)), 'head');
    k.frustum(center.clone().addScaledVector(out, -eyeR * 0.3), center.clone().addScaledVector(out, eyeR * 0.12), { w: eyeR, top: eyeR * 0.8, bot: eyeR * 0.8 }, { w: eyeR, top: eyeR * 0.8, bot: eyeR * 0.8 }, sk.up, head, flat(tone.eye), 'eye');
    k.frustum(center.clone().addScaledVector(out, 0), center.clone().addScaledVector(out, eyeR * 0.2), { w: eyeR * 0.26, top: eyeR * 0.8, bot: eyeR * 0.8 }, { w: eyeR * 0.26, top: eyeR * 0.8, bot: eyeR * 0.8 }, sk.up, head, flat(tone.pupil), 'pupil');
    // The brow: a ledge over the eye, so it reads as a glare rather than a stare.
    const brow = center.clone().addScaledVector(sk.up, eyeR * 1.05).addScaledVector(out, -eyeR * 0.25);
    k.box(brow, eyeR * 0.45, eyeR * 0.32, eyeR * 1.35, sk.up, sk.fwd, head, skin, 'head');
    // Nostril.
    const nose = sk.at(0.9).addScaledVector(sk.up, sk.sec(0.9).top * 0.7).addScaledVector(out, sk.sec(0.9).w * 0.7);
    k.box(nose, sk.W * 0.05, sk.H * 0.035, sk.L * 0.035, sk.up, sk.fwd, head, flat(scaleRgb(tone.back, 0.35)), 'nostril');
  }
};

const silhouetteLike = (tone: Tones): boolean => tone.back[0] < 0.04 && tone.back[1] < 0.04 && tone.side === tone.back;

// ------------------------------------------------------------------ limbs

/** Limb blocks run the flank colour, a shade darker toward the feet. */
const limbFaces = (tone: Tones, depth: number): Faces => {
  const c = mixRgb(tone.side, tone.back, 0.3);
  const d = scaleRgb(c, 1 - depth * 0.12);
  return faces(d, d, mixRgb(d, tone.belly, 0.25), d);
};

const buildHindLeg = (k: Blocks, spec: SpeciesSpec, layout: SkeletonLayout, leg: LimbChain, tone: Tones): void => {
  const [socket, knee, ankle, ball, tip] = leg.joints as [Vector3, Vector3, Vector3, Vector3, Vector3];
  const legs = spec.legs;
  const column = !!legs.column;
  const sprawl = spec.stance === 'sprawl';
  const [thighBone, shinBone, metaBone, toeBone] = leg.bones as [number, number, number, number];
  const root = socket.clone().add(V(0, spec.rump.hBot * 0.18, 0));
  const upRef = sprawl ? Y : Z;
  // Chunkier than life: a Roblox leg reads from across the map.
  const T = legs.thigh * 1.1;
  const S = legs.shin * 1.35;
  const F = legs.foot * 1.35;
  if (column) {
    k.frustum(root, knee, { w: T * 1.05, top: T * 1.15, bot: T * 1.15 }, { w: S * 1.05, top: S * 1.1, bot: S * 1.1 }, upRef, single(thighBone), limbFaces(tone, 0), 'leg', { ext1: S * 0.4 });
    k.frustum(knee, ankle, { w: S * 1.0, top: S * 1.05, bot: S * 1.05 }, { w: S * 0.95, top: S * 1.0, bot: S * 1.0 }, upRef, single(shinBone), limbFaces(tone, 0.5), 'leg', { ext0: S * 0.3, ext1: F * 0.3 });
    k.frustum(ankle, ball.clone().setY(0), { w: F * 1.4, top: F * 1.5, bot: F * 1.5 }, { w: F * 1.55, top: F * 1.7, bot: F * 1.5 }, upRef, single(metaBone), limbFaces(tone, 1), 'leg', { ext0: F * 0.2 });
    for (let i = 0; i < Math.min(4, legs.toes); i += 1) {
      const a = (i / Math.max(1, legs.toes - 1) - 0.5) * 1.2;
      const at = ball.clone().setY(F * 0.35).add(V(Math.sin(a) * F * 1.2, 0, Math.cos(a) * F * 1.55));
      k.box(at, F * 0.28, F * 0.3, F * 0.18, Y, Z, single(toeBone), flat(tone.horn), 'claw');
    }
    return;
  }
  // A drumstick thigh: one big block, only slightly narrower at the knee.
  k.frustum(root, knee, { w: T * 1.0, top: T * 1.15, bot: T * 1.0 }, { w: T * 0.78, top: T * 0.85, bot: T * 0.75 }, upRef, single(thighBone), limbFaces(tone, 0), 'leg', { ext0: T * 0.2, ext1: S * 0.5 });
  k.frustum(knee, ankle, { w: S * 1.05, top: S * 1.2, bot: S * 1.05 }, { w: F * 1.0, top: F * 1.0, bot: F * 1.0 }, upRef, single(shinBone), limbFaces(tone, 0.5), 'leg', { ext0: S * 0.4, ext1: F * 0.5 });
  k.frustum(ankle, ball, { w: F * 0.95, top: F * 0.95, bot: F * 0.95 }, { w: F * 0.9, top: F * 0.85, bot: F * 0.85 }, upRef, single(metaBone), limbFaces(tone, 0.9), 'leg', { ext0: F * 0.4, ext1: F * 0.4 });
  // Toes: blocks fanning from the ball of the foot, each tipped with a dark claw.
  const forward = new Vector3().subVectors(tip, ball).setY(0).normalize();
  const lateral = new Vector3().crossVectors(Y, forward).normalize();
  const count = Math.min(4, legs.toes);
  const spread = sprawl ? 0.45 : 0.3;
  const toeInf = single(toeBone);
  for (let i = 0; i < count; i += 1) {
    const a = (count === 1 ? 0 : i / (count - 1) - 0.5) * 2 * spread;
    const dir = forward.clone().multiplyScalar(Math.cos(a)).addScaledVector(lateral, Math.sin(a) * -leg.side).normalize();
    const length = Math.max(legs.toe, F * 1.4) * (i === Math.floor(count / 2) ? 1 : 0.8);
    const start = ball.clone().setY(F * 0.45);
    const end = start.clone().addScaledVector(dir, length);
    k.frustum(start, end, { w: F * 0.48, top: F * 0.4, bot: F * 0.45 }, { w: F * 0.36, top: F * 0.3, bot: F * 0.4 }, Y, toeInf, limbFaces(tone, 1), 'leg');
    const clawLen = Math.max(legs.claw * 1.2, F * 0.55);
    k.pyramid(end.clone().add(V(0, -F * 0.05, 0)), end.clone().addScaledVector(dir, clawLen).setY(0.02), F * 0.3, Y, toeInf, tone.claw, 'claw', 1.1);
  }
  if (legs.sickle) {
    const base = ball.clone().addScaledVector(lateral, leg.side * -F * 0.6).add(V(0, F * 0.9, F * 0.2));
    const tipPoint = base.clone().add(V(0, legs.sickle * 0.5, legs.sickle * 0.95));
    k.pyramid(base, tipPoint, F * 0.34, lateral, single(metaBone), tone.claw, 'claw', 0.5);
  }
};

const buildFore = (k: Blocks, spec: SpeciesSpec, layout: SkeletonLayout, limb: LimbChain, tone: Tones): void => {
  const [socket, elbow, wrist, tip] = limb.joints as [Vector3, Vector3, Vector3, Vector3];
  const [upperBone, lowerBone, handBone] = limb.bones as [number, number, number];
  if (!limb.walks && spec.arms) {
    const arms = spec.arms;
    const A = arms.thick * 1.6;
    const root = socket.clone().add(V(0, A * 0.3, -A * 0.2));
    k.frustum(root, elbow, { w: A * 1.1, top: A * 1.3, bot: A * 1.2 }, { w: A * 0.9, top: A, bot: A }, Z, single(upperBone), limbFaces(tone, 0.2), 'arm', { ext0: A * 0.3, ext1: A * 0.5 });
    k.frustum(elbow, wrist, { w: A * 0.85, top: A * 0.95, bot: A * 0.95 }, { w: A * 0.75, top: A * 0.8, bot: A * 0.8 }, Z, single(lowerBone), limbFaces(tone, 0.3), 'arm', { ext0: A * 0.4, ext1: A * 0.3 });
    // Fingers ending in claws (a Therizinosaurus' are long flat scythes).
    const handDir = new Vector3().subVectors(tip, wrist).normalize();
    const lateral = new Vector3().crossVectors(handDir, Y).normalize();
    const hand = single(handBone);
    const fingers = Math.min(3, arms.fingers);
    for (let i = 0; i < fingers; i += 1) {
      const a = (fingers === 1 ? 0 : i / (fingers - 1) - 0.5) * 0.55;
      const dir = handDir.clone().addScaledVector(lateral, a).normalize();
      const len = wrist.distanceTo(tip) * 0.85;
      const start = wrist.clone().addScaledVector(dir, A * 0.2);
      const end = start.clone().addScaledVector(dir, len);
      k.frustum(start, end, { w: A * 0.4, top: A * 0.4, bot: A * 0.4 }, { w: A * 0.3, top: A * 0.3, bot: A * 0.3 }, Y, hand, limbFaces(tone, 0.4), 'arm');
      const clawTip = end.clone().addScaledVector(dir, arms.claw).add(V(0, -arms.claw * 0.45, 0));
      const scythe = arms.claw > arms.thick * 3;
      k.pyramid(end, clawTip, Math.max(A * 0.32, arms.claw * (scythe ? 0.14 : 0.18)), lateral, hand, tone.claw, 'claw', scythe ? 0.3 : 0.8);
    }
    return;
  }
  // A walking front leg: upper, forearm, a block foot with blunt nails.
  const fore = spec.fore!;
  const Tk = fore.thick * 1.25;
  const root = socket.clone().add(V(0, spec.chest.hBot * 0.14, 0));
  const ground = tip.clone().setZ(wrist.z).setY(0);
  k.frustum(root, elbow, { w: Tk * 1.35, top: Tk * 1.5, bot: Tk * 1.4 }, { w: Tk * 1.05, top: Tk * 1.1, bot: Tk * 1.05 }, Z, single(upperBone), limbFaces(tone, 0.1), 'leg', { ext0: Tk * 0.3, ext1: Tk * 0.4 });
  k.frustum(elbow, wrist, { w: Tk * 1.0, top: Tk * 1.05, bot: Tk * 1.0 }, { w: Tk * 0.95, top: Tk * 1.0, bot: Tk * 0.95 }, Z, single(lowerBone), limbFaces(tone, 0.5), 'leg', { ext0: Tk * 0.35, ext1: Tk * 0.2 });
  const hand = single(handBone);
  k.frustum(wrist, ground, { w: Tk * 1.0, top: Tk * 1.1, bot: Tk * 1.0 }, { w: Tk * 1.2, top: Tk * 1.35, bot: Tk * 1.1 }, Z, hand, limbFaces(tone, 1), 'leg', { ext0: Tk * 0.2 });
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 2 - 0.5) * 1.1;
    const at = ground.clone().add(V(Math.sin(a) * Tk * 0.9, Tk * 0.22, Math.cos(a) * Tk * 1.3));
    k.box(at, Tk * 0.22, Tk * 0.22, Tk * 0.16, Y, Z, hand, flat(tone.horn), 'claw');
  }
};

// --------------------------------------------------------------- features

const buildFeature = (k: Blocks, spec: SpeciesSpec, layout: SkeletonLayout, body: readonly Segment[], feature: Feature, tone: Tones): void => {
  const sk = skullOf(spec, layout);
  const headInf = single(layout.head);
  const top = (b: number, lift = 0.92): { p: Vector3; seg: Segment; s: Sec } => {
    const at = bodyAt(body, b);
    return { p: at.center.clone().addScaledVector(at.seg.up, at.s.top * lift), seg: at.seg, s: at.s };
  };
  const hornFaces = flat(tone.horn);

  switch (feature.kind) {
    case 'sail':
    case 'ridge': {
      const from = Math.min(feature.from, feature.to);
      const to = Math.max(feature.from, feature.to);
      // Stepped slabs: a pixel-stepped profile, two tones - skin at the root, the accent above.
      const steps = feature.kind === 'sail' ? 12 : 10;
      for (let i = 0; i < steps; i += 1) {
        const t = (i + 0.5) / steps;
        const b = from + (to - from) * t;
        const at = top(b, 0.75);
        const next = top(from + (to - from) * Math.min(1, t + 1 / steps), 0.75);
        const len = Math.max(0.05, at.p.distanceTo(next.p) * 0.6 + 0.02);
        const profile = feature.kind === 'sail' ? Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.65) * (0.8 + 0.2 * t) : 0.45 + 0.55 * Math.sin(Math.PI * t);
        const h = feature.height * profile + 0.02;
        const thick = Math.max(0.05, feature.height * (feature.kind === 'sail' ? 0.05 : 0.22));
        const fwd = at.seg.t;
        const up = at.seg.up;
        if (feature.kind === 'sail') {
          const split = h * 0.45;
          k.box(at.p.clone().addScaledVector(up, split / 2), thick, split / 2, len, up, fwd, at.seg.inf, faces(tone.back, tone.back, tone.back), 'sail');
          k.box(at.p.clone().addScaledVector(up, split + (h - split) / 2), thick * 0.9, (h - split) / 2, len, up, fwd, at.seg.inf, faces(tone.accent2, tone.accent, tone.accent), 'sail');
        } else {
          k.box(at.p.clone().addScaledVector(up, h / 2), thick, h / 2, len * 0.8, up, fwd, at.seg.inf, flat(mixRgb(tone.back, tone.horn, 0.25)), 'scute');
        }
      }
      return;
    }
    case 'plates': {
      for (let i = 0; i < feature.count; i += 1) {
        const t = feature.count === 1 ? 0.5 : i / (feature.count - 1);
        const b = feature.from + (feature.to - feature.from) * t;
        const at = top(b, 0.85);
        const h = feature.height * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)));
        const shift = (i % 2 === 0 ? 1 : -1) * at.s.w * 0.18;
        const center = at.p.clone().addScaledVector(at.seg.side, shift).addScaledVector(at.seg.up, h * 0.42);
        // A square turned 45 degrees: a diamond plate.
        const diagUp = at.seg.up.clone().add(at.seg.t).normalize();
        const diagFwd = at.seg.t.clone().sub(at.seg.up).normalize();
        k.box(center, Math.max(0.04, h * 0.06), h * 0.33, h * 0.33, diagUp, diagFwd, at.seg.inf, faces(tone.accent2, tone.accent, tone.accent), 'plate');
      }
      return;
    }
    case 'thagomizer': {
      const tailEnd = single(layout.tail[layout.tail.length - 1]!);
      for (const [b, angle] of [[-0.9, 0.55], [-0.8, 0.75]] as const) {
        const at = bodyAt(body, b);
        for (const sign of [-1, 1]) {
          const base = at.center.clone().addScaledVector(at.seg.up, at.s.top * 0.4).addScaledVector(at.seg.side, sign * at.s.w * 0.6);
          const dir = at.seg.side.clone().multiplyScalar(sign * Math.cos(angle)).addScaledVector(at.seg.up, Math.sin(angle)).addScaledVector(at.seg.t, -0.55).normalize();
          k.pyramid(base, base.clone().addScaledVector(dir, feature.length), feature.length * 0.14, at.seg.t, tailEnd, tone.horn, 'spike');
        }
      }
      return;
    }
    case 'scutes': {
      const rows = Math.max(1, feature.rows);
      const perRow = Math.max(1, Math.round(feature.count / rows / 1.6));
      for (let r = 0; r < rows; r += 1) {
        const across = rows === 1 ? 0 : (r / (rows - 1) - 0.5) * 1.3;
        for (let i = 0; i < perRow; i += 1) {
          const t = perRow === 1 ? 0.5 : i / (perRow - 1);
          const b = feature.from + (feature.to - feature.from) * t;
          const at = top(b, 0.98);
          const size = feature.size * (0.7 + 0.3 * Math.sin(Math.PI * t)) * Math.min(1, at.s.top / (spec.rump.hTop * 0.5));
          if (size < 0.03) continue;
          const c = at.p.clone().addScaledVector(at.seg.side, across * at.s.w * 0.7);
          k.box(c, size * 0.5, size * 0.35, size * 0.55, at.seg.up, at.seg.t, at.seg.inf, flat(mixRgb(scaleRgb(tone.back, 0.8), tone.horn, 0.3)), 'scute');
        }
      }
      return;
    }
    case 'sideSpikes': {
      for (let i = 0; i < feature.count; i += 1) {
        const t = feature.count === 1 ? 0.5 : i / (feature.count - 1);
        const at = bodyAt(body, feature.from + (feature.to - feature.from) * t);
        for (const sign of [-1, 1]) {
          const base = at.center.clone().addScaledVector(at.seg.side, sign * at.s.w * 0.9).addScaledVector(at.seg.up, at.s.top * 0.1);
          const dir = at.seg.side.clone().multiplyScalar(sign).addScaledVector(at.seg.up, 0.25).addScaledVector(at.seg.t, -0.35).normalize();
          const len = feature.length * (0.7 + 0.3 * Math.sin(Math.PI * t));
          k.pyramid(base, base.clone().addScaledVector(dir, len), len * 0.24, at.seg.up, at.seg.inf, tone.horn, 'spike');
        }
      }
      return;
    }
    case 'shoulderSpikes': {
      const at = bodyAt(body, 0.95);
      for (const sign of [-1, 1]) {
        const base = at.center.clone().addScaledVector(at.seg.side, sign * at.s.w * 0.85);
        const dir = at.seg.side.clone().multiplyScalar(sign * 0.7).addScaledVector(at.seg.up, 0.2).addScaledVector(at.seg.t, -0.7).normalize();
        k.pyramid(base, base.clone().addScaledVector(dir, feature.length), feature.length * 0.14, at.seg.up, at.seg.inf, tone.horn, 'spike');
      }
      return;
    }
    case 'club': {
      const bone = single(layout.tail[layout.tail.length - 1]!);
      const at = bodyAt(body, -0.97);
      const c = at.center;
      const clubFaces = flat(mixRgb(scaleRgb(tone.back, 0.8), tone.horn, 0.35));
      k.box(c, feature.size * 0.55, feature.size * 0.35, feature.size * 0.5, at.seg.up, at.seg.t, bone, clubFaces, 'club');
      for (const sign of [-1, 1]) {
        k.box(c.clone().addScaledVector(at.seg.side, sign * feature.size * 0.5), feature.size * 0.3, feature.size * 0.28, feature.size * 0.38, at.seg.up, at.seg.t, bone, clubFaces, 'club');
      }
      return;
    }
    case 'quills': {
      for (let i = 0; i < feature.count; i += 1) {
        const t = feature.count === 1 ? 0.5 : i / (feature.count - 1);
        const at = top(feature.from + (feature.to - feature.from) * t, 0.85);
        const len = feature.length * (0.55 + 0.45 * Math.sin(Math.PI * t));
        const dir = at.seg.up.clone().multiplyScalar(0.75).addScaledVector(at.seg.t, -0.65).normalize();
        k.pyramid(at.p, at.p.clone().addScaledVector(dir, len), len * 0.12, at.seg.side, at.seg.inf, tone.accent, 'spike');
      }
      return;
    }
    case 'feathers': {
      const L2 = feature.length;
      const feather = faces(tone.accent2, tone.accent, tone.accent);
      if (feature.back) {
        for (let i = 0; i < 7; i += 1) {
          const at = top(-0.25 + (i / 6) * 2.05, 0.9);
          const dir = at.seg.up.clone().multiplyScalar(0.55).addScaledVector(at.seg.t, -0.85).normalize();
          const c = at.p.clone().addScaledVector(dir, L2 * 0.2);
          k.box(c, L2 * 0.05, L2 * 0.06, L2 * 0.22, at.seg.up, dir, at.seg.inf, feather, 'feather');
        }
      }
      if (feature.tail) {
        for (let i = 0; i < 4; i += 1) {
          const at = bodyAt(body, -0.45 - i * 0.14);
          for (const sign of [-1, 1]) {
            const reach = L2 * (1.1 - 0.18 * i);
            const c = at.center.clone().addScaledVector(at.seg.side, sign * (at.s.w + reach * 0.45));
            k.box(c, reach * 0.45, L2 * 0.035, L2 * 0.2, at.seg.up, at.seg.t, at.seg.inf, feather, 'feather');
          }
        }
      }
      if (feature.arms) {
        for (const limb of layout.fore) {
          if (limb.walks) continue;
          const [, elbow, wrist] = limb.joints as [Vector3, Vector3, Vector3, Vector3];
          const along = new Vector3().subVectors(wrist, elbow);
          for (let i = 0; i < 3; i += 1) {
            const p = elbow.clone().addScaledVector(along, 0.2 + i * 0.3);
            const c = p.clone().add(V(0, -L2 * 0.35, -L2 * 0.15));
            k.box(c, L2 * 0.03, L2 * 0.35, L2 * 0.14, Y, along.clone().normalize(), single(limb.bones[1]!), feather, 'feather');
          }
        }
      }
      return;
    }
    case 'browHorns': {
      const base0 = sk.at(0.22).addScaledVector(sk.up, sk.cranium.top * 0.95);
      for (const sign of [-1, 1]) {
        const out = sk.right.clone().multiplyScalar(sign);
        const base = base0.clone().addScaledVector(out, sk.W * feature.spread * 0.6);
        const dir = sk.up.clone().multiplyScalar(0.55).addScaledVector(sk.fwd, feature.forward).addScaledVector(out, feature.forward < 0 ? 0.9 : 0.12).normalize();
        const mid = base.clone().addScaledVector(dir, feature.length * 0.45);
        const r = Math.max(0.06, feature.length * 0.15);
        k.frustum(base, mid, { w: r, top: r, bot: r }, { w: r * 0.75, top: r * 0.75, bot: r * 0.75 }, sk.fwd, headInf, hornFaces, 'horn');
        const bent = dir.clone().addScaledVector(sk.fwd, 0.25).normalize();
        k.pyramid(mid, mid.clone().addScaledVector(bent, feature.length * 0.6), r * 0.75, sk.fwd, headInf, tone.horn, 'horn');
      }
      return;
    }
    case 'noseHorn': {
      const s = kind(spec) === 'ceratopsian' ? 0.74 : 0.7;
      const base = sk.at(s).addScaledVector(sk.up, sk.sec(s).top * 0.9);
      const tip = base.clone().addScaledVector(sk.up, feature.length).addScaledVector(sk.fwd, feature.length * 0.25);
      k.pyramid(base, tip, Math.max(0.06, feature.length * 0.24), sk.fwd, headInf, tone.horn, 'horn');
      return;
    }
    case 'frill': {
      // A shield of radial slabs swept up and back from the skull, knobs round its rim.
      const base0 = sk.at(0.06);
      const back = sk.fwd.clone().multiplyScalar(-1);
      const n = 7;
      for (let i = 0; i < n; i += 1) {
        const t = i / (n - 1);
        const a = (t - 0.5) * Math.PI * 1.05;
        const radial = sk.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(sk.right, Math.sin(a));
        const base = base0.clone().addScaledVector(sk.up, sk.cranium.top * 0.3 * Math.cos(a)).addScaledVector(sk.right, Math.sin(a) * sk.cranium.w * 0.8);
        const reach = feature.size * (0.75 + 0.25 * Math.cos(a));
        const outDir = radial.clone().multiplyScalar(0.62).addScaledVector(back, 0.62).addScaledVector(sk.up, 0.25).normalize();
        const end = base.clone().addScaledVector(outDir, reach);
        const width = reach * 0.32;
        const thick = Math.max(0.06, feature.size * 0.05);
        const frame = k.frame(base, end, sk.fwd);
        k.frustum(base, end, { w: width * 0.55, top: thick, bot: thick }, { w: width, top: thick, bot: thick }, frame.up, headInf, faces(tone.accent, tone.accent2, tone.accent), 'frill');
        const rim = end.clone();
        if (feature.spikes > 0 && t > 0.15 && t < 0.85) {
          k.pyramid(rim, rim.clone().addScaledVector(outDir, feature.size * 0.6), feature.size * 0.09, sk.fwd, headInf, tone.horn, 'horn');
        } else if (feature.hooks > 0 && t > 0.1 && t < 0.9) {
          k.pyramid(rim, rim.clone().addScaledVector(sk.fwd, feature.size * 0.35).addScaledVector(outDir, feature.size * 0.12), feature.size * 0.07, outDir, headInf, tone.horn, 'horn');
        } else {
          const r = feature.size * 0.08;
          k.box(rim, r, r, r, sk.up, sk.fwd, headInf, hornFaces, 'horn');
        }
      }
      return;
    }
    case 'tubeCrest': {
      const p0 = sk.at(0.55).addScaledVector(sk.up, sk.root.top * 0.8);
      const p1 = sk.origin.clone().addScaledVector(sk.up, sk.H * 0.9).addScaledVector(sk.fwd, sk.L * 0.05);
      const p2 = sk.origin.clone().addScaledVector(sk.up, sk.H * 1.05).addScaledVector(sk.fwd, -feature.length * 0.5);
      const p3 = sk.origin.clone().addScaledVector(sk.up, sk.H * 0.9).addScaledVector(sk.fwd, -feature.length * 0.95);
      const curve = new CatmullRomCurve3([p0, p1, p2, p3]);
      const n = 4;
      for (let i = 0; i < n; i += 1) {
        const a = curve.getPoint(i / n);
        const b = curve.getPoint((i + 1) / n);
        const r = sk.H * 0.17 * (i === n - 1 ? 0.8 : 1);
        k.frustum(a, b, { w: r * 0.85, top: r, bot: r }, { w: r * 0.85, top: r, bot: r }, sk.up, headInf, faces(tone.accent2, tone.accent, tone.accent), 'crest', { ext0: r * 0.3, ext1: r * 0.3 });
      }
      return;
    }
    case 'twinCrest':
    case 'monoCrest': {
      const offsets = feature.kind === 'twinCrest' ? [-0.22, 0.22] : [0];
      for (const offset of offsets) {
        const n = 5;
        for (let i = 0; i < n; i += 1) {
          const t = (i + 0.5) / n;
          const s = 0.25 + 0.65 * t;
          const h = feature.height * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8) * (feature.kind === 'twinCrest' ? 1.1 - 0.4 * t : 1);
          const base = sk.at(s).addScaledVector(sk.up, sk.sec(s).top).addScaledVector(sk.right, offset * sk.W);
          k.box(base.clone().addScaledVector(sk.up, h / 2), Math.max(0.03, feature.height * 0.06), h / 2, sk.L * 0.075, sk.up, sk.fwd, headInf, faces(tone.accent2, tone.accent, tone.accent), 'crest');
        }
      }
      return;
    }
    case 'dome': {
      const c = sk.at(0.22).addScaledVector(sk.up, sk.cranium.top * 0.7);
      const domeFaces = flat(mixRgb(tone.back, tone.horn, 0.45));
      k.box(c, feature.size * 0.55, feature.size * 0.4, feature.size * 0.62, sk.up, sk.fwd, headInf, domeFaces, 'horn');
      k.box(c.clone().addScaledVector(sk.up, feature.size * 0.45), feature.size * 0.4, feature.size * 0.14, feature.size * 0.46, sk.up, sk.fwd, headInf, domeFaces, 'horn');
      for (let i = 0; i < feature.spikes; i += 2) {
        const a = (i / Math.max(1, feature.spikes - 1) - 0.5) * Math.PI * 1.3;
        const dir = sk.fwd.clone().multiplyScalar(-Math.cos(a)).addScaledVector(sk.right, Math.sin(a)).addScaledVector(sk.up, 0.3).normalize();
        const base = c.clone().addScaledVector(dir, feature.size * 0.55);
        const len = feature.size * (feature.spikes > 10 ? 0.5 : 0.2);
        k.pyramid(base, base.clone().addScaledVector(dir, len), len * 0.35, sk.up, headInf, tone.horn, 'horn');
      }
      return;
    }
    case 'neckFrill': {
      if (layout.frill < 0) return;
      const inf = single(layout.frill);
      const at = bodyAt(body, 1.85);
      for (let i = 0; i < 7; i += 1) {
        const t = i / 6;
        const a = (t - 0.5) * Math.PI * 1.35;
        const radial = at.seg.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(at.seg.side, Math.sin(a));
        const base = at.center.clone().addScaledVector(radial, Math.max(at.s.w, at.s.top) * 0.9);
        const reach = feature.size * (0.7 + 0.3 * Math.cos(a));
        const end = base.clone().addScaledVector(radial, reach).addScaledVector(at.seg.t, -reach * 0.2);
        const frame = k.frame(base, end, at.seg.t);
        k.frustum(base, end, { w: reach * 0.16, top: 0.03, bot: 0.03 }, { w: reach * 0.3, top: 0.03, bot: 0.03 }, frame.up, inf, faces(tone.accent, tone.accent2, tone.accent), 'frill');
      }
      return;
    }
    case 'browBumps': {
      for (const sign of [-1, 1]) {
        const c = sk.at(0.24).addScaledVector(sk.up, sk.cranium.top * 0.95).addScaledVector(sk.right, sign * sk.cranium.w * 0.6);
        k.box(c, feature.size * 0.6, feature.size * 0.4, feature.size, sk.up, sk.fwd, headInf, faces(tone.back, tone.back, tone.back), 'head');
      }
      return;
    }
    case 'collar': {
      const at = bodyAt(body, 1.3);
      const p0 = at.center.clone().addScaledVector(at.seg.t, -0.12);
      const p1 = at.center.clone().addScaledVector(at.seg.t, 0.12);
      const s: Sec = { w: at.s.w * 1.12, top: at.s.top * 1.12, bot: at.s.bot * 1.12 };
      k.frustum(p0, p1, s, s, at.seg.up, at.seg.inf, flat([0.14, 0.09, 0.06]), 'strap');
      const light = at.center.clone().addScaledVector(at.seg.up, s.top + 0.05);
      k.box(light, 0.08, 0.05, 0.1, at.seg.up, at.seg.t, at.seg.inf, flat([0.95, 0.2, 0.15]), 'metal');
      return;
    }
    default:
      return;
  }
};

const kind = (spec: SpeciesSpec): HeadKind => spec.head.kind;
