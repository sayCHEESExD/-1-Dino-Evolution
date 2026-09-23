import { BoxGeometry, ConeGeometry } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { rock, shade, type Rand } from './Nature.js';

/**
 * THE PARK, built of Roblox parts: the great timber gates, plank palisades,
 * electric fences hung with warning signs, block torches, ranger huts, a
 * safari jeep - and the island's relics: block skeletons, skulls, ribcages
 * and bones. Square posts and beams everywhere a real park would use logs;
 * bright, clean colours; the studs come from the shared plastic material.
 *
 * Generic island-park dressing; nothing here carries a real brand.
 */

const WOOD = 0x9a6232;
const WOOD_DARK = 0x6a4020;
const STEEL = 0x8a9098;
const BONE = 0xf2e8d0;
const WARN = 0xffc81e;

const box = (w: number, h: number, d: number): BoxGeometry => new BoxGeometry(w, h, d);

/** A square post with a pyramid cap (the palisade's stake). */
export const log = (b: PartBuilder, x: number, y: number, z: number, h: number, r: number, color = WOOD, pointed = true): void => {
  b.add(box(r * 1.8, h, r * 1.8), color, 'flat', { x, y: y + h / 2, z });
  if (pointed) b.add(new ConeGeometry(r * 1.27, r * 1.8, 4), shade(color, 0.85), 'flat', { x, y: y + h + r * 0.9, z, ry: Math.PI / 4 });
};

/** A square beam between two points on the ground plane, at height y. */
export const beam = (b: PartBuilder, x0: number, z0: number, x1: number, z1: number, y: number, r: number, color = WOOD): void => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  b.add(box(r * 1.7, r * 1.7, len), color, 'flat', { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, ry: Math.atan2(dx, dz) });
};

/**
 * A PALISADE along a line: square stakes side by side, two cross-beams
 * lashed across them.
 */
export const palisade = (b: PartBuilder, r: Rand, x0: number, z0: number, x1: number, z1: number, height: number, logR = 0.55): void => {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(2, Math.floor(len / (logR * 1.85)));
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const h = height * (0.94 + r() * 0.08);
    log(b, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, h, logR * 1.0, shade(WOOD, 0.88 + r() * 0.24));
  }
  beam(b, x0, z0, x1, z1, height * 0.35, logR * 0.5, WOOD_DARK);
  beam(b, x0, z0, x1, z1, height * 0.75, logR * 0.5, WOOD_DARK);
};

/** A warning sign on a post: yellow and black, a lightning bolt. */
export const warningSign = (b: PartBuilder, x: number, y: number, z: number, ry = 0, s = 1): void => {
  b.box(s * 1.4, s * 1.0, 0.1, WARN, 'smooth', { x, y, z, ry });
  b.box(s * 1.2, s * 0.14, 0.12, 0x1a1a1a, 'smooth', { x, y: y + s * 0.34, z, ry });
  b.box(s * 1.2, s * 0.14, 0.12, 0x1a1a1a, 'smooth', { x, y: y - s * 0.34, z, ry });
  b.add(new ConeGeometry(s * 0.16, s * 0.5, 3), 0x1a1a1a, 'smooth', { x, y: y + s * 0.05, z, ry, rz: 0.4 });
};

/**
 * AN ELECTRIC FENCE: square steel posts, taut cables, warning signs every few
 * posts. `live` lights the insulators red.
 */
export const electricFence = (b: PartBuilder, x0: number, z0: number, x1: number, z1: number, height: number, live = true): void => {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const posts = Math.max(2, Math.round(len / 6));
  const ry = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= posts; i += 1) {
    const t = i / posts;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    b.box(0.6, height, 0.6, STEEL, 'smooth', { x, y: height / 2, z, ry });
    b.box(0.8, 0.3, 0.8, 0x5a6068, 'smooth', { x, y: height + 0.15, z, ry });
    for (let k = 1; k <= 4; k += 1) b.box(0.26, 0.26, 0.26, live ? 0xff3a2a : 0xd8d8d0, live ? 'glow' : 'smooth', { x, y: (height * k) / 5, z, ry });
    if (i % 3 === 1 && i < posts) warningSign(b, x + (x1 - x0) / posts / 2, height * 0.45, z + (z1 - z0) / posts / 2, ry + Math.PI / 2, 1.1);
  }
  for (let k = 1; k <= 4; k += 1) {
    const y = (height * k) / 5;
    b.add(box(0.1, 0.1, len), 0x2a2a2a, 'smooth', { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, ry });
  }
};

/** A torch: a square post, an iron box basket and a block flame. */
export const torch = (b: PartBuilder, x: number, z: number, h = 4.6): void => {
  b.add(box(0.5, h, 0.5), WOOD, 'flat', { x, y: h / 2, z });
  b.add(box(0.7, 0.35, 0.7), 0x3a3230, 'flat', { x, y: h * 0.72, z });
  b.add(box(1.0, 0.5, 1.0), 0x2a2420, 'flat', { x, y: h + 0.1, z });
  b.add(box(0.7, 0.9, 0.7), 0xff8a1e, 'glow', { x, y: h + 0.75, z, ry: Math.PI / 4 });
  b.add(box(0.42, 1.1, 0.42), 0xffe060, 'glow', { x, y: h + 0.9, z });
};

/** A ranger hut on stilts: block posts, plank floor, walls and a pyramid roof. */
export const hut = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0): void => {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    b.add(box(s * 0.4, s * 1.6, s * 0.4), WOOD_DARK, 'flat', { x: x + dx * s * 1.8, y: s * 0.8, z: z + dz * s * 1.6 });
  }
  b.box(s * 4.2, s * 0.3, s * 3.8, WOOD, 'flat', { x, y: s * 1.7, z, ry });
  b.box(s * 3.8, s * 2.2, s * 3.4, shade(0xc89a5a, 0.95 + r() * 0.1), 'flat', { x, y: s * 2.95, z, ry });
  b.box(s * 1.0, s * 1.6, s * 0.1, 0x3a2414, 'smooth', { x: x + Math.sin(ry) * s * 1.72, y: s * 2.7, z: z + Math.cos(ry) * s * 1.72, ry });
  b.add(new ConeGeometry(s * 3.6, s * 2.4, 4), 0xe8b84a, 'flat', { x, y: s * 5.2, z, ry: ry + Math.PI / 4 });
};

/** An old open-top safari jeep: block body, roll bar, square wheels. Generic. */
export const jeep = (b: PartBuilder, x: number, z: number, ry = 0, s = 1, color = 0x5a9a3a): void => {
  const at = (dx: number, dz: number): { x: number; z: number } => ({ x: x + Math.sin(ry) * dz + Math.cos(ry) * dx, z: z + Math.cos(ry) * dz - Math.sin(ry) * dx });
  let p = at(0, 0);
  b.box(s * 2.6, s * 1.1, s * 5, color, 'flat', { x: p.x, y: s * 1.15, z: p.z, ry });
  p = at(0, s * 1.6);
  b.box(s * 2.4, s * 0.7, s * 1.6, shade(color, 0.9), 'flat', { x: p.x, y: s * 1.95, z: p.z, ry });
  p = at(0, s * 0.4);
  b.box(s * 2.5, s * 0.9, s * 0.1, 0x9ad8f0, 'smooth', { x: p.x, y: s * 2.2, z: p.z, ry, rx: -0.2 });
  for (const side of [-1, 1]) {
    p = at(side * s * 1.1, -s * 0.8);
    b.box(s * 0.16, s * 1.4, s * 0.16, 0x2a2a2a, 'smooth', { x: p.x, y: s * 2.35, z: p.z, ry });
  }
  p = at(0, -s * 0.8);
  b.box(s * 2.3, s * 0.16, s * 0.16, 0x2a2a2a, 'smooth', { x: p.x, y: s * 3.05, z: p.z, ry });
  for (const [dx, dz] of [[-1.3, 1.6], [1.3, 1.6], [-1.3, -1.6], [1.3, -1.6]] as const) {
    p = at(dx * s, dz * s);
    b.box(s * 0.45, s * 1.1, s * 1.1, 0x1e1e1e, 'flat', { x: p.x, y: s * 0.55, z: p.z, ry });
    b.box(s * 0.5, s * 0.4, s * 0.4, 0xb8b8b8, 'flat', { x: p.x, y: s * 0.55, z: p.z, ry });
  }
  p = at(0, -s * 2.6);
  b.box(s * 1.0, s * 1.0, s * 0.35, 0x1e1e1e, 'flat', { x: p.x, y: s * 1.4, z: p.z, ry });
  for (const side of [-1, 1]) {
    p = at(side * s * 1.31, 0);
    b.box(s * 0.04, s * 0.3, s * 4.2, 0xffc81e, 'smooth', { x: p.x, y: s * 1.3, z: p.z, ry });
  }
};

/** Supply crates, stacked. */
export const crates = (b: PartBuilder, r: Rand, x: number, z: number, s = 1): void => {
  for (let i = 0; i < 4; i += 1) {
    const size = s * (0.9 + r() * 0.4);
    const stack = i === 3 ? 1 : 0;
    const cx = x + (i % 2) * s * 1.2 - s * 0.6 + (r() - 0.5) * 0.2;
    const cz = z + Math.floor(i / 2) * s * 1.1 - s * 0.5;
    const ry = (r() - 0.5) * 0.4;
    b.box(size, size, size, shade(0xc8904e, 0.9 + r() * 0.2), 'flat', { x: cx, y: size / 2 + stack * s, z: cz, ry });
    // Dark slats across each face.
    b.box(size * 1.02, size * 0.14, size * 1.02, 0x7a4e22, 'flat', { x: cx, y: size / 2 + stack * s, z: cz, ry });
  }
};

// ----------------------------------------------------------------- relics

/** A bone: a square shaft with block knuckles at both ends. */
export const bone = (b: PartBuilder, x: number, y: number, z: number, len: number, r: number, ry = 0, rz = 0, color = BONE): void => {
  b.add(box(len, r * 1.8, r * 1.8), color, 'flat', { x, y, z, ry, rz });
  for (const s of [-1, 1]) {
    const dx = Math.cos(ry) * Math.cos(rz) * len * 0.5 * s;
    const dz = -Math.sin(ry) * Math.cos(rz) * len * 0.5 * s;
    const dy = Math.sin(rz) * len * 0.5 * s;
    for (const k of [-1, 1]) {
      b.add(box(r * 2.2, r * 2.2, r * 2.2), shade(color, 0.95), 'flat', { x: x + dx + Math.sin(ry) * r * k, y: y + dy, z: z + dz + Math.cos(ry) * r * k, ry });
    }
  }
};

/** A scatter of bones on the ground. */
export const bonePile = (b: PartBuilder, r: Rand, x: number, z: number, s = 1): void => {
  for (let i = 0; i < 5; i += 1) {
    bone(b, x + (r() - 0.5) * s * 3, s * 0.18, z + (r() - 0.5) * s * 3, s * (0.8 + r() * 1.2), s * 0.1, r() * Math.PI, 0);
  }
};

/** A ribcage: stepped block ribs arching over a spine, half sunk in the ground. */
export const ribcage = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0, color = BONE): void => {
  const ribs = 6;
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  for (let i = 0; i < ribs; i += 1) {
    const t = i / (ribs - 1);
    const size = s * (2.2 + Math.sin(t * Math.PI) * 1.2);
    const dz = (t - 0.5) * s * 5;
    const cx = x + fx * dz;
    const cz = z + fz * dz;
    const c = shade(color, 0.92 + r() * 0.12);
    // Each rib: an upright on either side and a lintel block leaning in.
    for (const side of [-1, 1]) {
      b.add(box(s * 0.3, size * 0.9, s * 0.3), c, 'flat', { x: cx + fz * side * size * 0.8, y: size * 0.45, z: cz - fx * side * size * 0.8, ry, rz: side * 0.25 });
      b.add(box(s * 0.3, s * 0.3, size * 0.7), c, 'flat', { x: cx + fz * side * size * 0.45, y: size * 0.95, z: cz - fx * side * size * 0.45, ry: ry + Math.PI / 2, rx: side * 0.3 });
    }
  }
  b.add(box(s * 0.44, s * 0.44, s * 6), color, 'flat', { x, y: s * 3.3, z, ry });
};

/** A great block skull half-buried: cranium, dark sockets, a row of teeth. */
export const skull = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0, color = BONE): void => {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  b.add(box(s * 2.2, s * 1.6, s * 2.2), color, 'flat', { x, y: s * 0.8, z, ry });
  b.add(box(s * 1.7, s * 1.1, s * 2.0), shade(color, 0.96), 'flat', { x: x + fx * s * 1.9, y: s * 0.55, z: z + fz * s * 1.9, ry });
  for (const side of [-1, 1]) {
    b.add(box(s * 0.2, s * 0.55, s * 0.6), 0x2a2420, 'flat', { x: x + fx * s * 0.4 + fz * side * s * 1.02, y: s * 1.15, z: z + fz * s * 0.4 - fx * side * s * 1.02, ry });
  }
  for (let i = 0; i < 5; i += 1) {
    const d = s * (1.1 + i * 0.4);
    for (const side of [-1, 1]) {
      b.add(new ConeGeometry(s * 0.14, s * 0.45, 4), 0xfff8e8, 'flat', { x: x + fx * d + fz * side * s * 0.72, y: s * 0.05, z: z + fz * d - fx * side * s * 0.72, rx: Math.PI });
    }
  }
  rock(b, r, x - fx * s * 1.8, 0, z - fz * s * 1.8, s * 0.6);
};

/**
 * A MUSEUM SKELETON of blocks: a theropod on a plinth - square vertebrae along
 * an S of a spine, a block skull with its jaw dropped, ribs, legs and a tail.
 */
export const skeletonDisplay = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0): void => {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  const at = (d: number, h: number, side = 0): { x: number; y: number; z: number } => ({ x: x + fx * d + fz * side, y: h, z: z + fz * d - fx * side });
  b.box(s * 3, s * 0.8, s * 9, 0x9a9aa2, 'flat', { x, y: s * 0.4, z, ry });
  b.box(s * 3.2, s * 0.14, s * 9.2, 0xffc83a, 'smooth', { x, y: s * 0.86, z, ry });
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const d = (t - 0.55) * s * 11;
    const h = s * (0.8 + 2.9 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.55) + (t > 0.8 ? (t - 0.8) * 4 : 0));
    const size = s * (0.26 + Math.sin(t * Math.PI) * 0.26);
    b.add(box(size, size, size * 1.2), BONE, 'flat', { ...at(d, h), ry });
    if (t > 0.35 && t < 0.72 && i % 2 === 0) {
      for (const side of [-1, 1]) b.add(box(s * 0.14, s * 1.5, s * 0.14), BONE, 'flat', { ...at(d, h - s * 0.8, side * s * 0.5), ry, rz: side * 0.3 });
    }
  }
  b.add(box(s * 0.9, s * 0.9, s * 1.9), BONE, 'flat', { ...at(s * 4.9, s * 4.4), ry });
  b.add(box(s * 0.75, s * 0.25, s * 1.7), shade(BONE, 0.92), 'flat', { ...at(s * 5.1, s * 3.75), ry, rx: 0.35 });
  for (const side of [-1, 1]) {
    b.add(box(s * 0.28, s * 1.45, s * 0.28), BONE, 'flat', { ...at(0, s * 2.4, side * s * 0.6), ry, rx: 0.5 });
    b.add(box(s * 0.22, s * 1.1, s * 0.22), BONE, 'flat', { ...at(s * 0.15, s * 1.4, side * s * 0.65), ry, rx: -0.4 });
    b.add(box(s * 0.45, s * 0.14, s * 0.9), BONE, 'flat', { ...at(0, s * 0.95, side * s * 0.65), ry });
  }
  void r;
};

/** A slab of rock with a block fossil imprint. */
export const fossilSlab = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0): void => {
  b.box(s * 2.4, s * 0.5, s * 1.8, 0xa8a09a, 'flat', { x, y: s * 0.25, z, ry, rx: 0.05 });
  for (let i = 0; i < 4; i += 1) {
    const size = s * (0.25 + i * 0.14);
    b.box(size, s * 0.1, size, i % 2 ? 0xf2e8d0 : 0xd8c8a8, 'flat', { x, y: s * 0.52 + i * 0.01, z, ry: ry + i * 0.5 });
  }
  void r;
};

/** A nest of block stones around an egg's plinth, with a twig bowl on top. */
export const nest = (b: PartBuilder, r: Rand, x: number, z: number, radius: number, top: number): void => {
  const stones = 10;
  for (let i = 0; i < stones; i += 1) {
    const a = (i / stones) * Math.PI * 2;
    rock(b, r, x + Math.cos(a) * radius * 0.95, top * 0.1, z + Math.sin(a) * radius * 0.95, radius * 0.24, 0x8a8a92);
  }
  b.box(radius * 1.8, top, radius * 1.8, 0x5a5a64, 'flat', { x, y: top / 2, z });
  b.box(radius * 1.95, top * 0.25, radius * 1.95, 0x44444c, 'flat', { x, y: top * 0.12, z });
  for (let i = 0; i < 10; i += 1) {
    const a = r() * Math.PI * 2;
    const d = radius * (0.3 + r() * 0.5);
    b.add(box(0.14, 0.14, radius * 0.9), shade(0xa87a3e, 0.85 + r() * 0.3), 'flat', { x: x + Math.cos(a) * d, y: top + 0.08, z: z + Math.sin(a) * d, ry: r() * 6 });
  }
};

/** A pad: a square slab of stone with a darker rim, set into the ground. */
export const stonePad = (b: PartBuilder, x: number, y: number, z: number, radius: number, color = 0x9a9aa2, rim = 0x5a5a64): void => {
  b.box(radius * 2.1, 0.3, radius * 2.1, rim, 'flat', { x, y: y + 0.15, z });
  b.box(radius * 1.8, 0.36, radius * 1.8, color, 'flat', { x, y: y + 0.18, z });
};

/** A tall stone pillar with a block cap and base, for gates and plinths. */
export const pillar = (b: PartBuilder, x: number, z: number, h: number, w: number, color = 0x9a9aa2): void => {
  b.box(w, h, w, color, 'flat', { x, y: h / 2, z });
  b.box(w * 1.25, w * 0.35, w * 1.25, shade(color, 0.85), 'flat', { x, y: h + w * 0.17, z });
  b.box(w * 1.2, w * 0.3, w * 1.2, shade(color, 0.85), 'flat', { x, y: w * 0.15, z });
};

/** A wooden signpost with an arrow board. */
export const signpost = (b: PartBuilder, x: number, z: number, ry = 0): void => {
  b.add(box(0.3, 3, 0.3), WOOD, 'flat', { x, y: 1.5, z });
  b.box(1.8, 0.45, 0.14, 0xd8a45e, 'flat', { x, y: 2.5, z, ry });
};

export const COLORS = { WOOD, WOOD_DARK, STEEL, BONE, WARN } as const;

/** A plank laid flat. */
export const plank = (b: PartBuilder, x: number, y: number, z: number, w: number, d: number, ry = 0): void => {
  b.add(box(w, 0.2, d), 0xa8784a, 'flat', { x, y, z, ry });
};

/** A fallen log lying on the ground: a square trunk, a broken stub, a strip of moss along the top. */
export const fallenLog = (b: PartBuilder, r: Rand, x: number, z: number, len = 5, ry = 0, s = 1): void => {
  const thick = s * (0.9 + r() * 0.3);
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  b.add(box(thick, thick, len), shade(0x8a5a2e, 0.9 + r() * 0.2), 'flat', { x, y: thick / 2, z, ry });
  b.add(box(thick * 1.06, thick * 0.2, len * 0.7), 0x5cc43a, 'flat', { x: x + fx * len * 0.05, y: thick + thick * 0.08, z: z + fz * len * 0.05, ry });
  b.add(box(thick * 1.1, thick * 1.1, thick * 0.3), 0xc8a060, 'flat', { x: x + fx * len * 0.5, y: thick / 2, z: z + fz * len * 0.5, ry });
  b.add(box(thick * 0.45, thick * 1.2, thick * 0.45), 0x7a4e28, 'flat', { x: x - fx * len * 0.2 + fz * thick * 0.4, y: thick * 0.9, z: z - fz * len * 0.2 - fx * thick * 0.4, ry, rz: 0.5 });
};

/** A tree stump: a short block trunk with a pale cut top. */
export const stump = (b: PartBuilder, r: Rand, x: number, z: number, s = 1): void => {
  const h = s * (0.7 + r() * 0.5);
  b.add(box(s * 1.2, h, s * 1.2), shade(0x8a5a2e, 0.9 + r() * 0.2), 'flat', { x, y: h / 2, z, ry: r() });
  b.add(box(s * 1.0, 0.1, s * 1.0), 0xd8b070, 'flat', { x, y: h + 0.05, z, ry: r() });
};
