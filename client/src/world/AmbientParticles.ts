import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  NormalBlending,
  Points,
  PointsMaterial,
  type Texture,
} from 'three';
import { isMobileGpu } from '../config/device.js';
import type { Biome } from './Biomes.js';

type Kind = NonNullable<Biome['particles']>['kind'];

const BOX = 70;
const HEIGHT = 34;

let dot: Texture | null = null;
const softDot = (): Texture => {
  if (dot) return dot;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  dot = new CanvasTexture(canvas);
  return dot;
};

/**
 * THE AIR ITSELF: whatever drifts through the biome around the rider - snow on
 * the tundra, ash on the plains, embers over the volcano, mist in the jungle,
 * fireflies in the moonlit forest, rain on the stormbreak cliffs, spores over
 * the swamp. One point cloud that follows the camera and changes its nature
 * with the biome; nothing at all where the air is clear.
 */
export class AmbientParticles {
  readonly points: Points;
  private readonly geometry = new BufferGeometry();
  private readonly material: PointsMaterial;
  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly count: number;
  private kind: Kind | null = null;
  private time = 0;

  constructor() {
    this.count = isMobileGpu() ? 140 : 360;
    this.positions = new Float32Array(this.count * 3);
    this.phases = new Float32Array(this.count);
    for (let i = 0; i < this.count; i += 1) {
      this.positions[i * 3] = (Math.random() - 0.5) * BOX;
      this.positions[i * 3 + 1] = Math.random() * HEIGHT;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * BOX;
      this.phases[i] = Math.random() * Math.PI * 2;
    }
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.material = new PointsMaterial({ size: 0.5, map: softDot(), transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.8 });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Switch to a biome's air (or none). */
  setBiome(particles: Biome['particles'] | undefined): void {
    const kind = particles?.kind ?? null;
    if (kind === this.kind) return;
    this.kind = kind;
    this.points.visible = kind !== null;
    if (!particles) return;
    this.material.color.setHex(particles.color);
    const glow = kind === 'embers' || kind === 'fireflies';
    this.material.blending = glow ? AdditiveBlending : NormalBlending;
    this.material.size = kind === 'mist' ? 7 : kind === 'rain' ? 0.25 : kind === 'snow' ? 0.45 : kind === 'fireflies' ? 0.55 : 0.35;
    this.material.opacity = kind === 'mist' ? 0.08 : kind === 'rain' ? 0.5 : 0.85;
    this.material.needsUpdate = true;
  }

  update(delta: number, x: number, y: number, z: number): void {
    if (!this.kind) return;
    this.time += delta;
    this.points.position.set(x, y, z);
    const p = this.positions;
    const half = BOX / 2;
    for (let i = 0; i < this.count; i += 1) {
      const phase = this.phases[i]!;
      let vx = 0;
      let vy = 0;
      let vz = 0;
      switch (this.kind) {
        case 'snow':
          vy = -2.2;
          vx = Math.sin(this.time * 0.8 + phase) * 0.9;
          break;
        case 'ash':
          vy = -0.7;
          vx = 1.6 + Math.sin(this.time * 0.5 + phase) * 0.6;
          break;
        case 'embers':
          vy = 2.4 + Math.sin(phase) * 0.8;
          vx = Math.sin(this.time * 1.6 + phase) * 0.8;
          break;
        case 'mist':
          vx = 0.6;
          vy = Math.sin(this.time * 0.3 + phase) * 0.05;
          break;
        case 'fireflies':
          vx = Math.sin(this.time * 0.9 + phase) * 1.2;
          vz = Math.cos(this.time * 0.7 + phase * 1.3) * 1.2;
          vy = Math.sin(this.time * 1.3 + phase) * 0.6;
          break;
        case 'rain':
          vy = -38;
          vx = 3;
          break;
        case 'spores':
          vy = 0.3;
          vx = Math.sin(this.time * 0.4 + phase) * 0.5;
          break;
        default:
          break;
      }
      let px = p[i * 3]! + vx * delta;
      let py = p[i * 3 + 1]! + vy * delta;
      let pz = p[i * 3 + 2]! + vz * delta;
      if (this.kind === 'mist') py = Math.min(py, 3);
      if (py < 0) py += HEIGHT;
      if (py > HEIGHT) py -= HEIGHT;
      if (px < -half) px += BOX;
      if (px > half) px -= BOX;
      if (pz < -half) pz += BOX;
      if (pz > half) pz -= BOX;
      p[i * 3] = px;
      p[i * 3 + 1] = py;
      p[i * 3 + 2] = pz;
    }
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    if (this.kind === 'fireflies') this.material.opacity = 0.6 + Math.sin(this.time * 3) * 0.3;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
