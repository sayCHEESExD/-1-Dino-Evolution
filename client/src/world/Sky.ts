import {
  BackSide,
  Color,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from './Nature.js';

/** How far out the dome sits. Inside the camera's far plane. */
const DOME_RADIUS = 1500;
const RING_RADIUS = 900;

/**
 * THE SKY OVER THE ISLAND: a gradient dome, a ring of jungle-clad mountains on
 * the horizon with a smoking volcano among them, and soft banks of cloud. The
 * whole thing follows the viewer (the stage road is longer than the dome is
 * wide), and its colours are set by the atmosphere of the biome the rider is in
 * - so the swamp's sky is sick green, the caldera's red, the moonlit jungle's
 * deep blue.
 */
export class Sky {
  readonly root = new Group();
  private readonly dome: Mesh;
  private readonly domeMaterial: ShaderMaterial;
  private readonly mountainMaterial: MeshBasicMaterial;
  private readonly farMaterial: MeshBasicMaterial;
  private readonly cloudMaterial: MeshBasicMaterial;
  private readonly smokeMaterial: MeshBasicMaterial;
  private readonly smoke: Mesh[] = [];
  private readonly disposables: (BufferGeometry | ShaderMaterial | MeshBasicMaterial)[] = [];
  private time = 0;

  constructor() {
    this.domeMaterial = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new Color(0x4a9ae0) },
        midColor: { value: new Color(0xa8d4f0) },
        bottomColor: { value: new Color(0xcfe6d8) },
      },
      vertexShader: `
        varying float vHeight;
        void main() {
          vHeight = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        varying float vHeight;
        void main() {
          float h = clamp(vHeight, -1.0, 1.0);
          vec3 sky = mix(midColor, topColor, clamp(h * 1.6, 0.0, 1.0));
          vec3 low = mix(bottomColor, midColor, clamp((h + 0.05) * 5.0, 0.0, 1.0));
          gl_FragColor = vec4(h > 0.03 ? sky : low, 1.0);
        }
      `,
    });
    const domeGeometry = new SphereGeometry(DOME_RADIUS, 24, 16);
    this.disposables.push(domeGeometry, this.domeMaterial);
    this.dome = new Mesh(domeGeometry, this.domeMaterial);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -2;
    this.root.add(this.dome);

    this.mountainMaterial = new MeshBasicMaterial({ color: 0x5a7a6a, fog: false });
    this.farMaterial = new MeshBasicMaterial({ color: 0x8aa8a8, fog: false });
    this.cloudMaterial = new MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
    this.smokeMaterial = new MeshBasicMaterial({ color: 0x8a8480, fog: false, transparent: true, opacity: 0.55, depthWrite: false });
    this.disposables.push(this.mountainMaterial, this.farMaterial, this.cloudMaterial, this.smokeMaterial);
    this.buildMountains();
    this.buildClouds();
  }

  private buildMountains(): void {
    const r = seeded(0x5ca1);
    const near: BufferGeometry[] = [];
    const far: BufferGeometry[] = [];
    for (let i = 0; i < 46; i += 1) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.05;
      const radius = RING_RADIUS + r() * 120;
      const h = 90 + r() * 160;
      const w = 110 + r() * 120;
      // Blocky mountains: three stacked, shrinking, turned blocks.
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      for (let k = 0; k < 3; k += 1) {
        const f = 1 - k * 0.3;
        const g = new BoxGeometry(w * f * 1.3, h / 3 + 2, w * f);
        g.rotateY(a + k * 0.35);
        g.translate(x, (h / 3) * (k + 0.5) - 25, z);
        near.push(g);
      }
      const fr = radius + 180;
      const fx = Math.cos(a + 0.05) * fr;
      const fz = Math.sin(a + 0.05) * fr;
      for (let k = 0; k < 2; k += 1) {
        const f = 1 - k * 0.35;
        const g = new BoxGeometry(w * f * 1.7, h * 0.75 + 2, w * f * 1.3);
        g.rotateY(a + 0.6 + k * 0.4);
        g.translate(fx, h * 0.75 * (k + 0.5) - 30, fz);
        far.push(g);
      }
    }
    // The volcano: broad, truncated, smoking.
    const va = -Math.PI * 0.62;
    const vx = Math.cos(va) * (RING_RADIUS + 60);
    const vz = Math.sin(va) * (RING_RADIUS + 60);
    for (let k = 0; k < 4; k += 1) {
      const f = 1 - k * 0.2;
      const volcano = new BoxGeometry(520 * f, 84, 480 * f);
      volcano.rotateY(k * 0.3);
      volcano.translate(vx, 84 * (k + 0.5) - 25, vz);
      near.push(volcano);
    }
    const mergedNear = mergeGeometries(near, false);
    const mergedFar = mergeGeometries(far, false);
    for (const g of [...near, ...far]) g.dispose();
    if (mergedFar) {
      this.disposables.push(mergedFar);
      const mesh = new Mesh(mergedFar, this.farMaterial);
      mesh.renderOrder = -1;
      this.root.add(mesh);
    }
    if (mergedNear) {
      this.disposables.push(mergedNear);
      const mesh = new Mesh(mergedNear, this.mountainMaterial);
      mesh.renderOrder = -1;
      this.root.add(mesh);
    }
    for (let i = 0; i < 5; i += 1) {
      const puff = new Mesh(new BoxGeometry(70 + i * 22, 50 + i * 16, 70 + i * 22), this.smokeMaterial);
      puff.position.set(vx, 320 + i * 55, vz);
      puff.userData['base'] = puff.position.y;
      this.smoke.push(puff);
      this.disposables.push(puff.geometry as BufferGeometry);
      this.root.add(puff);
    }
  }

  private buildClouds(): void {
    const r = seeded(0xc10d);
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < 26; i += 1) {
      const a = r() * Math.PI * 2;
      const d = 350 + r() * 650;
      const cx = Math.cos(a) * d;
      const cz = Math.sin(a) * d;
      const cy = 220 + r() * 180;
      const blobs = 4 + Math.floor(r() * 4);
      for (let k = 0; k < blobs; k += 1) {
        // Block clouds, as a Roblox skybox's.
        const size = 26 + r() * 30;
        const g = new BoxGeometry(size * 2.2, size * 0.7, size * 1.4);
        g.translate(cx + (k - blobs / 2) * 34 + r() * 10, cy + r() * 12, cz + (r() - 0.5) * 30);
        parts.push(g);
      }
    }
    const merged = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    if (!merged) return;
    this.disposables.push(merged);
    const clouds = new Mesh(merged, this.cloudMaterial);
    clouds.renderOrder = -1;
    this.root.add(clouds);
  }

  /** The biome's sky: zenith, horizon and the haze at the mountains' feet. */
  setColors(top: Color, mid: Color, bottom: Color, fog: Color, dim: number): void {
    (this.domeMaterial.uniforms['topColor']!.value as Color).copy(top);
    (this.domeMaterial.uniforms['midColor']!.value as Color).copy(mid);
    (this.domeMaterial.uniforms['bottomColor']!.value as Color).copy(bottom);
    // Mountains read as silhouettes against the haze: darker near, paler far.
    this.mountainMaterial.color.copy(fog).lerp(new Color(0x3a8a4a), 0.4);
    this.farMaterial.color.copy(fog).lerp(mid, 0.35).lerp(new Color(0x5a8a7a), 0.15);
    this.cloudMaterial.color.setScalar(1).lerp(fog, 0.12).multiplyScalar(Math.max(0.35, dim));
  }

  /** Keep the sky centred on the viewer. */
  follow(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  update(delta: number): void {
    this.time += delta;
    this.smoke.forEach((puff, i) => {
      const base = puff.userData['base'] as number;
      puff.position.y = base + ((this.time * 6 + i * 40) % 220);
      puff.scale.setScalar(1 + (((this.time * 6 + i * 40) % 220) / 220) * 0.8);
    });
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
    this.root.removeFromParent();
  }
}
