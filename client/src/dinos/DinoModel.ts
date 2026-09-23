import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Sphere,
  BoxGeometry,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildBlockDino, type BuildQuality } from './DinoBlocks.js';
import { lookById, type Look } from './DinoLooks.js';
import type { SkeletonLayout } from './DinoSkeleton.js';
import type { Section, SpeciesSpec } from './DinoSpecies.js';

/**
 * ONE LOOK, BUILT ONCE: the geometry, the material and the skeleton layout of
 * a dinosaur look at a quality, cached - every animal of that look shares them
 * and owns only its bones.
 */
export interface DinoAsset {
  readonly lookId: string;
  readonly look: Look;
  readonly spec: SpeciesSpec;
  readonly geometry: BufferGeometry;
  readonly material: Material;
  /** The skeleton layout at the look's final size. */
  readonly layout: SkeletonLayout;
  readonly scale: number;
  readonly saddle: BufferGeometry | null;
  readonly seatBone: number;
  /** The seat, in the seat bone's local frame. */
  readonly seatLocal: Vector3;
  readonly hip: number;
  readonly length: number;
  readonly height: number;
}

const assets = new Map<string, DinoAsset>();
const materials = new Map<string, MeshStandardMaterial>();
let saddleMaterial: MeshStandardMaterial | null = null;

const scaleLayout = (layout: SkeletonLayout, k: number): SkeletonLayout => {
  if (k === 1) return layout;
  const s = (v: Vector3): Vector3 => v.clone().multiplyScalar(k);
  return {
    ...layout,
    bones: layout.bones.map((b) => ({ ...b, pos: s(b.pos) })),
    hind: layout.hind.map((c) => ({ ...c, joints: c.joints.map(s) })),
    fore: layout.fore.map((c) => ({ ...c, joints: c.joints.map(s) })),
    centerline: layout.centerline.map((p) => ({ ...p, pos: s(p.pos) })),
    headFrame: { ...layout.headFrame, origin: s(layout.headFrame.origin) },
    jawHinge: s(layout.jawHinge),
    seat: { bone: layout.seat.bone, pos: s(layout.seat.pos) },
    hipPos: s(layout.hipPos),
    shoulderPos: s(layout.shoulderPos),
    length: layout.length * k,
    height: layout.height * k,
  };
};

/**
 * The skin material, patched so a per-vertex `glow` attribute lights up the
 * eyes of the hybrids and the cracks of the lava breeds, whatever the scene's
 * lighting - one material, no second mesh.
 */
const skinMaterial = (look: Look, silhouette: boolean): MeshStandardMaterial => {
  const key = `${JSON.stringify(look.palette)}|${silhouette}`;
  const cached = materials.get(key);
  if (cached) return cached;
  const palette = look.palette;
  const material = new MeshStandardMaterial({
    vertexColors: true,
    // Roblox SmoothPlastic: flat colour, a soft sheen, no surface texture.
    roughness: silhouette ? 0.9 : Math.min(palette.roughness ?? 0.55, 0.6),
    metalness: silhouette ? 0 : palette.metalness ?? 0,
    flatShading: true,
    emissive: new Color(!silhouette && palette.emissive ? palette.emissive : '#000000'),
    emissiveIntensity: palette.emissiveIntensity ?? 0,
  });
  material.onBeforeCompile = patchGlow;
  material.customProgramCacheKey = () => 'dino-glow';
  materials.set(key, material);
  return material;
};

const patchGlow = (shader: { vertexShader: string; fragmentShader: string }): void => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.6;');
};

/**
 * A material of the animal's own, for an instance that flashes when it is hit.
 * Same shader program as the shared one; only the uniforms differ.
 */
export const ownMaterial = (asset: DinoAsset): MeshStandardMaterial => {
  const material = (asset.material as MeshStandardMaterial).clone();
  material.onBeforeCompile = patchGlow;
  material.customProgramCacheKey = () => 'dino-glow';
  return material;
};

/**
 * The riding saddle, built of blocks like everything else: a cloth that drapes
 * down both flanks with a gold trim, a leather seat, a raised cantle and
 * pommel, and a girth strap round the belly.
 */
const buildSaddle = (section: Section, spec: SpeciesSpec, look: Look): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  const w = section.w;
  const h = section.hTop;
  const length = Math.max(0.8, Math.min(2.3, spec.torso * 0.38));
  const cloth = new Color(look.palette.accent).lerp(new Color('#c02828'), 0.6);
  const trim = new Color('#ffc83a');
  const leather = new Color('#8a4a22');
  const leatherDark = new Color('#5a2e14');
  // The seat anchor sits on the back; the body's centre line is below it.
  const back = -0.02;
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: Color): void => {
    const g = new BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x, y, z);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  const drop = Math.min(h * 0.75, w * 0.85);
  // The cloth over the back, and a skirt down each flank with its trim.
  box(w * 2.2, 0.08, length, 0, back, 0, cloth);
  for (const side of [-1, 1]) {
    box(0.08, drop, length * 0.92, side * (w * 1.1), back - drop / 2, 0, cloth);
    box(0.1, 0.1, length * 0.94, side * (w * 1.1 + 0.01), back - drop, 0, trim);
    box(0.1, drop * 0.9, 0.1, side * (w * 1.1 + 0.01), back - drop / 2, length * 0.46, trim);
    box(0.1, drop * 0.9, 0.1, side * (w * 1.1 + 0.01), back - drop / 2, -length * 0.46, trim);
  }
  // The seat, cantle and pommel.
  box(w * 1.25, 0.16, length * 0.72, 0, back + 0.1, 0, leather);
  box(w * 1.25, 0.34, 0.16, 0, back + 0.25, -length * 0.34, leatherDark);
  box(w * 0.5, 0.3, 0.16, 0, back + 0.22, length * 0.32, leatherDark);
  box(w * 0.22, 0.14, 0.14, 0, back + 0.42, length * 0.32, trim);
  // The girth: down both flanks and under the belly.
  const girth = h + section.hBot;
  for (const side of [-1, 1]) box(0.12, girth, 0.2, side * (w * 1.02 + 0.06), back - girth / 2, 0, leatherDark);
  box(w * 2.1, 0.12, 0.2, 0, back - girth, 0, leatherDark);
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged ?? new BufferGeometry();
};

/** The cached asset for a look at a quality. */
export const dinoAsset = (lookId: string, quality: BuildQuality = 'high', silhouette = false): DinoAsset => {
  const key = `${lookId}|${quality}|${silhouette ? 's' : ''}`;
  const cached = assets.get(key);
  if (cached) return cached;
  const look = lookById(lookId);
  const built = buildBlockDino(look, quality, silhouette);
  const k = look.scale ?? 1;
  const eyeGlow = !silhouette && !!look.palette.eyeGlow;
  const emissive = !silhouette && (look.palette.emissiveIntensity ?? 0) > 0.1;
  const geometry = built.data.build((i) => {
    const part = built.data.parts[i];
    if (eyeGlow && part === 'eye') return 1.4;
    if (emissive) {
      // Lava breeds: the brightest orange of the pattern burns.
      const r = built.data.colors[i * 3]!;
      const g = built.data.colors[i * 3 + 1]!;
      const b = built.data.colors[i * 3 + 2]!;
      return Math.max(0, r - (g + b) * 0.55 - 0.18) * 2.2;
    }
    return 0;
  });
  if (k !== 1) geometry.scale(k, k, k);
  // Room for a lunge, a rear-up and a fall: the bind-pose bounds are too tight for a moving animal.
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere ?? new Sphere();
  sphere.radius *= 1.6;
  const layout = scaleLayout(built.layout, k);
  const seatBonePos = layout.bones[layout.seat.bone]!.pos;
  const saddle = look.saddle && !silhouette ? buildSaddle(built.seatSection, built.spec, look) : null;
  if (saddle && k !== 1) saddle.scale(k, k, k);
  const asset: DinoAsset = {
    lookId,
    look,
    spec: built.spec,
    geometry,
    material: skinMaterial(look, silhouette),
    layout,
    scale: k,
    saddle,
    seatBone: layout.seat.bone,
    seatLocal: layout.seat.pos.clone().sub(seatBonePos),
    hip: built.spec.hip * k,
    length: layout.length,
    height: layout.height,
  };
  assets.set(key, asset);
  return asset;
};

/**
 * ONE ANIMAL: its own bones over a shared geometry.
 *
 *   root      where the owner puts it; the animator never moves this
 *     mesh    the skinned body (and the skeleton's root bone inside it)
 *
 * `seat` is an anchor on the seat bone at the saddle, for the rider.
 */
export class DinoInstance {
  readonly root = new Group();
  readonly mesh: SkinnedMesh;
  readonly bones: Bone[];
  readonly seat: Object3D;
  readonly saddle: Mesh | null;

  constructor(readonly asset: DinoAsset) {
    const layout = asset.layout;
    this.bones = layout.bones.map((def) => {
      const bone = new Bone();
      bone.name = def.name;
      return bone;
    });
    layout.bones.forEach((def, i) => {
      const bone = this.bones[i]!;
      if (def.parent >= 0) {
        const parent = layout.bones[def.parent]!;
        bone.position.subVectors(def.pos, parent.pos);
        this.bones[def.parent]!.add(bone);
      } else {
        bone.position.copy(def.pos);
      }
    });
    this.mesh = new SkinnedMesh(asset.geometry, asset.material);
    this.mesh.add(this.bones[0]!);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new Skeleton(this.bones));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.root.add(this.mesh);

    this.seat = new Object3D();
    this.seat.position.copy(asset.seatLocal);
    this.bones[asset.seatBone]!.add(this.seat);
    if (asset.saddle) {
      if (!saddleMaterial) saddleMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, flatShading: true });
      this.saddle = new Mesh(asset.saddle, saddleMaterial);
      this.saddle.castShadow = true;
      this.seat.add(this.saddle);
    } else {
      this.saddle = null;
    }
  }

  get layout(): SkeletonLayout {
    return this.asset.layout;
  }

  bone(index: number): Bone {
    return this.bones[index]!;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.mesh.skeleton.dispose();
  }
}

/** Build a fresh instance of a look. */
export const createDino = (lookId: string, quality: BuildQuality = 'high', silhouette = false): DinoInstance =>
  new DinoInstance(dinoAsset(lookId, quality, silhouette));
