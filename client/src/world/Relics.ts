import { BoxGeometry, ConeGeometry } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { rock, shade, type Rand } from './Nature.js';

/**
 * THE WILD'S RELICS, built of Roblox parts: bones, skulls, ribcages and
 * fossils; nests; fallen logs and stumps; standing stones; and the lashed
 * pole torches of the valley camp. Square blocks throughout, bright clean
 * colours; the studs come from the shared plastic material.
 *
 * Every piece that lays one block over another keeps their faces apart
 * (a trim is always a little larger or smaller than what it wraps), so no two
 * surfaces ever share a plane.
 */

const WOOD = 0x9a6232;
const WOOD_DARK = 0x6a4020;
const BONE = 0xf2e8d0;
const ROPE = 0xd8b070;

const box = (w: number, h: number, d: number): BoxGeometry => new BoxGeometry(w, h, d);

/** A square post, optionally with a pyramid cap. */
export const log = (b: PartBuilder, x: number, y: number, z: number, h: number, r: number, color = WOOD, pointed = true): void => {
  b.add(box(r * 1.8, h, r * 1.8), color, 'flat', { x, y: y + h / 2, z });
  if (pointed) b.add(new ConeGeometry(r * 1.27, r * 1.8, 4), shade(color, 0.85), 'flat', { x, y: y + h + r * 0.9, z, ry: Math.PI / 4 });
};

/**
 * A POLE TORCH: a banded bamboo pole lashed with rope, a clay bowl and a
 * block flame - the camp's light, nothing a park would put up.
 */
export const torch = (b: PartBuilder, x: number, z: number, h = 4.6, y = 0): void => {
  const bands = 4;
  for (let i = 0; i < bands; i += 1) {
    b.add(box(0.46, h / bands - 0.06, 0.46), shade(0xc8a050, i % 2 ? 0.92 : 1), 'flat', { x, y: y + (h / bands) * (i + 0.5), z });
    b.add(box(0.56, 0.1, 0.56), 0x8a6a2a, 'flat', { x, y: y + (h / bands) * (i + 1) - 0.03, z });
  }
  b.add(box(0.62, 0.34, 0.62), ROPE, 'flat', { x, y: y + h * 0.78, z });
  b.add(box(1.1, 0.46, 1.1), 0xa8583a, 'flat', { x, y: y + h + 0.2, z, ry: Math.PI / 4 });
  b.add(box(0.8, 0.9, 0.8), 0xff8a1e, 'glow', { x, y: y + h + 0.85, z, ry: Math.PI / 4 });
  b.add(box(0.46, 1.1, 0.46), 0xffe060, 'glow', { x, y: y + h + 1.0, z });
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

/** A scatter of bones on the ground (at height y). */
export const bonePile = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, y = 0): void => {
  for (let i = 0; i < 5; i += 1) {
    bone(b, x + (r() - 0.5) * s * 3, y + s * 0.18, z + (r() - 0.5) * s * 3, s * (0.8 + r() * 1.2), s * 0.1, r() * Math.PI, 0);
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
    for (const side of [-1, 1]) {
      b.add(box(s * 0.3, size * 0.9, s * 0.3), c, 'flat', { x: cx + fz * side * size * 0.8, y: size * 0.45, z: cz - fx * side * size * 0.8, ry, rz: side * 0.25 });
      b.add(box(s * 0.3, s * 0.3, size * 0.7), c, 'flat', { x: cx + fz * side * size * 0.45, y: size * 0.95, z: cz - fx * side * size * 0.45, ry: ry + Math.PI / 2, rx: side * 0.3 });
    }
  }
  b.add(box(s * 0.44, s * 0.44, s * 6), color, 'flat', { x, y: s * 3.3, z, ry });
};

/** A great block skull half-buried: cranium, dark sockets, a row of teeth. */
export const skull = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0, color = BONE, y = 0): void => {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  b.add(box(s * 2.2, s * 1.6, s * 2.2), color, 'flat', { x, y: y + s * 0.8, z, ry });
  b.add(box(s * 1.7, s * 1.1, s * 2.0), shade(color, 0.96), 'flat', { x: x + fx * s * 1.9, y: y + s * 0.55, z: z + fz * s * 1.9, ry });
  for (const side of [-1, 1]) {
    b.add(box(s * 0.24, s * 0.55, s * 0.6), 0x2a2420, 'flat', { x: x + fx * s * 0.4 + fz * side * s * 1.02, y: y + s * 1.15, z: z + fz * s * 0.4 - fx * side * s * 1.02, ry });
  }
  for (let i = 0; i < 5; i += 1) {
    const d = s * (1.1 + i * 0.4);
    for (const side of [-1, 1]) {
      b.add(new ConeGeometry(s * 0.14, s * 0.45, 4), 0xfff8e8, 'flat', { x: x + fx * d + fz * side * s * 0.72, y: y + s * 0.05, z: z + fz * d - fx * side * s * 0.72, rx: Math.PI });
    }
  }
  rock(b, r, x - fx * s * 1.8, y, z - fz * s * 1.8, s * 0.6);
};

/** A slab of rock with a block fossil imprint: rings of bone, each a step proud of the last. */
export const fossilSlab = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, ry = 0, y = 0): void => {
  b.box(s * 2.4, s * 0.5, s * 1.8, 0xa8a09a, 'flat', { x, y: y + s * 0.25, z, ry });
  for (let i = 0; i < 4; i += 1) {
    const size = s * (1.3 - i * 0.26);
    b.box(size, s * 0.1, size * 0.8, i % 2 ? 0xf2e8d0 : 0xd8c8a8, 'flat', { x, y: y + s * 0.5 + (i + 0.5) * 0.06, z, ry: ry + i * 0.5 });
  }
  void r;
};

/** A nest of block stones around an egg's plinth, with a twig bowl on top. */
export const nest = (b: PartBuilder, r: Rand, x: number, z: number, radius: number, top: number, y = 0): void => {
  const stones = 10;
  for (let i = 0; i < stones; i += 1) {
    const a = (i / stones) * Math.PI * 2;
    rock(b, r, x + Math.cos(a) * radius * 0.95, y + top * 0.1, z + Math.sin(a) * radius * 0.95, radius * 0.24, 0x9a8e7e);
  }
  b.box(radius * 1.8, top - y, radius * 1.8, 0x7a5a3a, 'flat', { x, y: (top + y) / 2, z });
  b.box(radius * 1.95, (top - y) * 0.3, radius * 1.95, 0x5e4430, 'flat', { x, y: y + (top - y) * 0.15, z });
  for (let i = 0; i < 12; i += 1) {
    const a = r() * Math.PI * 2;
    const d = radius * (0.3 + r() * 0.55);
    b.add(box(0.16, 0.16, radius * 0.9), shade(0xb88a4e, 0.85 + r() * 0.3), 'flat', { x: x + Math.cos(a) * d, y: top + 0.1 + (i % 3) * 0.06, z: z + Math.sin(a) * d, ry: r() * 6 });
  }
  // A ring of leaves round the bowl's rim.
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3;
    b.add(box(radius * 0.5, 0.12, radius * 0.24), shade(0x4fbf3a, 0.85 + r() * 0.3), 'flat', { x: x + Math.cos(a) * radius * 0.82, y: top + 0.14, z: z + Math.sin(a) * radius * 0.82, ry: -a, rz: 0.25 });
  }
};

/** A pad: a square slab of stone with a darker rim, set on the ground at y. */
export const stonePad = (b: PartBuilder, x: number, y: number, z: number, radius: number, color = 0x9a9aa2, rim = 0x5a5a64): void => {
  b.box(radius * 2.1, 0.3, radius * 2.1, rim, 'flat', { x, y: y + 0.15, z });
  b.box(radius * 1.8, 0.36, radius * 1.8, color, 'flat', { x, y: y + 0.18, z });
};

/** A tall stone pillar with a block cap and base. */
export const pillar = (b: PartBuilder, x: number, z: number, h: number, w: number, color = 0x9a9aa2): void => {
  b.box(w, h, w, color, 'flat', { x, y: h / 2, z });
  b.box(w * 1.25, w * 0.35, w * 1.25, shade(color, 0.85), 'flat', { x, y: h + w * 0.17, z });
  b.box(w * 1.2, w * 0.3, w * 1.2, shade(color, 0.85), 'flat', { x, y: w * 0.15, z });
};

/** A fallen log lying on the ground: a square trunk, a broken stub, a strip of moss along the top. */
export const fallenLog = (b: PartBuilder, r: Rand, x: number, z: number, len = 5, ry = 0, s = 1, y = 0): void => {
  const thick = s * (0.9 + r() * 0.3);
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  b.add(box(thick, thick, len), shade(0x8a5a2e, 0.9 + r() * 0.2), 'flat', { x, y: y + thick / 2, z, ry });
  b.add(box(thick * 1.08, thick * 0.2, len * 0.7), 0x5cc43a, 'flat', { x: x + fx * len * 0.05, y: y + thick * 1.04, z: z + fz * len * 0.05, ry });
  b.add(box(thick * 1.12, thick * 1.12, thick * 0.3), 0xc8a060, 'flat', { x: x + fx * len * 0.5, y: y + thick / 2, z: z + fz * len * 0.5, ry });
  b.add(box(thick * 0.45, thick * 1.2, thick * 0.45), 0x7a4e28, 'flat', { x: x - fx * len * 0.2 + fz * thick * 0.4, y: y + thick * 0.9, z: z - fz * len * 0.2 - fx * thick * 0.4, ry, rz: 0.5 });
};

/** A tree stump: a short block trunk with a pale cut top and a rim of bark. */
export const stump = (b: PartBuilder, r: Rand, x: number, z: number, s = 1, y = 0): void => {
  const h = s * (0.7 + r() * 0.5);
  const ry = r();
  b.add(box(s * 1.2, h, s * 1.2), shade(0x8a5a2e, 0.9 + r() * 0.2), 'flat', { x, y: y + h / 2, z, ry });
  b.add(box(s * 1.0, 0.12, s * 1.0), 0xd8b070, 'flat', { x, y: y + h + 0.06, z, ry });
};

/** A standing stone: a tall, slightly leaning block of rock with a lichen patch. */
export const standingStone = (b: PartBuilder, r: Rand, x: number, z: number, h: number, w: number, color = 0x9a948a, ry = 0): void => {
  const lean = (r() - 0.5) * 0.08;
  b.add(box(w, h * 0.62, w * 0.8), color, 'flat', { x, y: h * 0.31, z, ry, rz: lean });
  b.add(box(w * 0.86, h * 0.42, w * 0.68), shade(color, 1.06), 'flat', { x: x - Math.sin(lean) * h * 0.55, y: h * 0.79, z, ry, rz: lean });
  b.add(box(w * 0.5, h * 0.18, w * 0.84), 0x7ab84a, 'flat', { x, y: h * 0.12, z, ry, rz: lean });
};

export const COLORS = { WOOD, WOOD_DARK, BONE, ROPE } as const;
