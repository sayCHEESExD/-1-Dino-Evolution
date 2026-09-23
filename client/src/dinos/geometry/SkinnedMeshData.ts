import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

/** What a colour callback is told about the vertex it colours. */
export interface ColorContext {
  /** Which part of the animal this vertex belongs to. */
  readonly part: PartTag;
  /** 0..1 along the piece (a limb from its root, the body from the tail tip). */
  readonly along: number;
  /** -1 (underside) .. +1 (top) around the ring. */
  readonly top: number;
  /** -1 .. +1 across the ring (the side). */
  readonly side: number;
  /** Model-space position in the bind pose. */
  readonly position: Vector3;
}

export type PartTag =
  | 'body'
  | 'head'
  | 'jaw'
  | 'mouth'
  | 'tongue'
  | 'leg'
  | 'arm'
  | 'claw'
  | 'tooth'
  | 'eye'
  | 'pupil'
  | 'horn'
  | 'frill'
  | 'crest'
  | 'sail'
  | 'plate'
  | 'spike'
  | 'scute'
  | 'feather'
  | 'club'
  | 'nostril'
  | 'saddle'
  | 'strap'
  | 'metal';

export type ColorFn = (ctx: ColorContext) => readonly [number, number, number];

/** One vertex influence set: up to four bones. */
export interface Influence {
  readonly bones: readonly number[];
  readonly weights: readonly number[];
}

/**
 * An accumulator for one skinned, vertex-coloured mesh: every piece of a
 * dinosaur - body, skull, jaw, limbs, horns, teeth - is appended here and the
 * whole animal becomes ONE geometry, ONE material, ONE draw call.
 */
export class SkinnedMeshData {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colors: number[] = [];
  readonly skinIndex: number[] = [];
  readonly skinWeight: number[] = [];
  readonly indices: number[] = [];
  /** The anatomical part of each vertex, for effects that single one out (glowing eyes). */
  readonly parts: PartTag[] = [];
  /** Pairs of vertex indices that sit on the same spot (a loft's seam): their normals are averaged. */
  private readonly seams: [number, number][] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  addVertex(p: Vector3, uvU: number, uvV: number, color: readonly [number, number, number], influence: Influence, part: PartTag = 'body'): number {
    const index = this.vertexCount;
    this.parts.push(part);
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(0, 0, 0);
    this.uvs.push(uvU, uvV);
    this.colors.push(color[0], color[1], color[2]);
    const b = influence.bones;
    const w = influence.weights;
    let total = 0;
    for (let i = 0; i < 4; i += 1) total += w[i] ?? 0;
    const norm = total > 0 ? 1 / total : 0;
    for (let i = 0; i < 4; i += 1) {
      this.skinIndex.push(b[i] ?? 0);
      this.skinWeight.push((w[i] ?? 0) * norm || (i === 0 && total === 0 ? 1 : 0));
    }
    return index;
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  seam(a: number, b: number): void {
    this.seams.push([a, b]);
  }

  /** Recolour every vertex from `from` onward with a callback of its bind position. */
  recolor(from: number, to: number, fn: (index: number) => readonly [number, number, number]): void {
    for (let i = from; i < to; i += 1) {
      const c = fn(i);
      this.colors[i * 3] = c[0];
      this.colors[i * 3 + 1] = c[1];
      this.colors[i * 3 + 2] = c[2];
    }
  }

  build(glow?: (index: number) => number): BufferGeometry {
    const geometry = new BufferGeometry();
    if (glow) {
      const values = new Float32Array(this.vertexCount);
      for (let i = 0; i < values.length; i += 1) values[i] = glow(i);
      geometry.setAttribute('glow', new BufferAttribute(values, 1));
    }
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(this.skinIndex), 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(this.skinWeight), 4));
    const count = this.vertexCount;
    geometry.setIndex(count > 65535 ? new BufferAttribute(new Uint32Array(this.indices), 1) : new BufferAttribute(new Uint16Array(this.indices), 1));
    geometry.computeVertexNormals();
    const normal = geometry.getAttribute('normal') as BufferAttribute;
    for (const [a, b] of this.seams) {
      const x = normal.getX(a) + normal.getX(b);
      const y = normal.getY(a) + normal.getY(b);
      const z = normal.getZ(a) + normal.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      normal.setXYZ(a, x / l, y / l, z / l);
      normal.setXYZ(b, x / l, y / l, z / l);
    }
    normal.needsUpdate = true;
    geometry.computeBoundingSphere();
    return geometry;
  }
}
