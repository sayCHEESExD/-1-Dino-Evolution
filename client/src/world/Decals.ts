import { BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { studPlastic } from '../render/Studs.js';

/**
 * FLAT GROUND DECALS: patches of darker grass, bare earth, mud, puddles, sand -
 * the variation laid ON a floor. Each is a flat quad at the floor's exact height
 * drawn with a polygon offset, so it sits flush: no visible hover, no z-fight,
 * no clipping, whatever the camera distance. Solid patches merge into one
 * studded mesh; water into one transparent mesh.
 */
const COLOR = new Color();

let solid: Material | null = null;
let water: MeshBasicMaterial | null = null;

const solidMaterial = (): Material => {
  if (!solid) solid = studPlastic({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  return solid;
};

export class DecalBuilder {
  private readonly solids: BufferGeometry[] = [];
  private readonly waters: BufferGeometry[] = [];
  /** Each decal a hair above the last, so overlapping patches layer instead of fighting. */
  private layer = 0;

  /** A flat patch at height y (the floor under it), turned by `ry`. */
  patch(x: number, y: number, z: number, w: number, d: number, color: number, ry = 0, isWater = false): this {
    // Non-indexed, like the blobs, so every decal merges into one geometry.
    const g = new PlaneGeometry(w, d).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.rotateY(ry);
    this.layer = (this.layer + 1) % 24;
    g.translate(x, y + this.layer * 0.0015, z);
    g.deleteAttribute('uv');
    COLOR.setHex(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) colors.set([COLOR.r, COLOR.g, COLOR.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    (isWater ? this.waters : this.solids).push(g);
    return this;
  }

  /**
   * An irregular flat polygon (5-8 corners, each at its own radius): the
   * angular grass and dirt patches of the reference arenas.
   */
  blob(x: number, y: number, z: number, radius: number, color: number, rand: () => number, isWater = false): this {
    const sides = 5 + Math.floor(rand() * 4);
    const turn = rand() * Math.PI * 2;
    const ring: [number, number][] = [];
    for (let i = 0; i < sides; i += 1) {
      const a = turn + (i / sides) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      const rr = radius * (0.7 + rand() * 0.45);
      ring.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]);
    }
    this.layer = (this.layer + 1) % 24;
    const yy = y + this.layer * 0.0015;
    const positions: number[] = [];
    for (let i = 0; i < sides; i += 1) {
      const [ax, az] = ring[i]!;
      const [bx, bz] = ring[(i + 1) % sides]!;
      // Wound so the face points up.
      positions.push(x, yy, z, bx, yy, bz, ax, yy, az);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    g.setAttribute('normal', new BufferAttribute(normals, 3));
    COLOR.setHex(color);
    const count = positions.length / 3;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) colors.set([COLOR.r, COLOR.g, COLOR.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    (isWater ? this.waters : this.solids).push(g);
    return this;
  }

  build(): Mesh[] {
    const meshes: Mesh[] = [];
    if (this.solids.length) {
      const merged = mergeGeometries(this.solids, false);
      for (const g of this.solids) g.dispose();
      if (merged) {
        const mesh = new Mesh(merged, solidMaterial());
        mesh.receiveShadow = true;
        mesh.renderOrder = 1;
        meshes.push(mesh);
      }
    }
    if (this.waters.length) {
      if (!water) water = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
      const merged = mergeGeometries(this.waters, false);
      for (const g of this.waters) g.dispose();
      if (merged) {
        const mesh = new Mesh(merged, water);
        mesh.renderOrder = 2;
        meshes.push(mesh);
      }
    }
    this.solids.length = 0;
    this.waters.length = 0;
    return meshes;
  }
}
