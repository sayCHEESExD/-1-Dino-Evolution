import type { ItemIcon } from '@dino/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type Texture,
} from 'three';
import type { AttackKind } from '../dinos/DinoSpecies.js';

interface Particle {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  max: number;
  spin: Vector3;
  gravity: number;
  grow: number;
  fade: boolean;
}

interface Arc {
  mesh: Mesh;
  life: number;
  max: number;
}

interface Flyer {
  sprite: Sprite;
  from: Vector3;
  to: () => Vector3;
  life: number;
  max: number;
}

const V = new Vector3();

/**
 * WHAT A HIT LOOKS LIKE: not a floating number but a blow landing.
 *
 *   - a white flash at the point of impact,
 *   - the stroke itself: a bite's crescent snapping shut, three raking claw
 *     trails, a horn's upward sweep, a stomp's ring of force across the ground,
 *   - dust thrown up from under the target and chips of debris flung outward,
 *     more of both the bigger the attacker,
 *   - on a kill, a heavier burst as the animal goes down.
 *
 * Everything draws from small pools of shared geometry and materials, so a
 * frantic fight allocates nothing per frame.
 */
export class ImpactEffects {
  readonly root = new Group();
  private readonly particles: Particle[] = [];
  private readonly arcs: Arc[] = [];
  private readonly flyers: Flyer[] = [];
  private readonly dustGeometry = new SphereGeometry(0.5, 7, 5);
  private readonly chipGeometry = new DodecahedronGeometry(0.22, 0);
  private readonly flashGeometry = new SphereGeometry(0.6, 10, 8);
  private readonly crescent = new TorusGeometry(1, 0.08, 4, 18, Math.PI * 0.9);
  private readonly ring = new RingGeometry(0.85, 1, 40);
  private readonly dust = new MeshLambertMaterial({ color: 0xc8b490, transparent: true, opacity: 0.6, depthWrite: false });
  private readonly chip = new MeshLambertMaterial({ color: 0x7a6a54, flatShading: true });
  private readonly flash = new MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  private readonly stroke = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  private readonly shock = new MeshBasicMaterial({ color: 0xffe8b0, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  private readonly icons = new Map<string, Texture>();

  /** Dust colour follows the ground under the fight. */
  setGround(color: number): void {
    this.dust.color.set(color).lerp(new Color(0xd8ccb0), 0.4);
    this.chip.color.set(color).multiplyScalar(0.7);
  }

  /**
   * One blow landing at `at`, struck from `from`.
   * @param size the attacker's size (its hip height): how big the burst is
   */
  hit(from: Vector3, at: Vector3, kind: AttackKind, variant: number, size: number, kill = false): void {
    const s = Math.max(0.6, Math.min(4, size / 2.2));
    const yaw = Math.atan2(at.x - from.x, at.z - from.z);
    // The flash.
    this.addParticle(this.flashGeometry, this.flash, at, V.set(0, 0, 0), 0.14, s * (kill ? 1.8 : 1.1), 0, 5, true);
    // The stroke.
    const arc = new Mesh(kind === 'stomp' || kind === 'tail' ? this.ring : this.crescent, this.stroke);
    arc.position.copy(at);
    const r = s * (kind === 'bite' ? 1.2 : 1.6);
    arc.scale.setScalar(r);
    if (kind === 'bite') {
      arc.rotation.set(0, yaw + Math.PI / 2, variant % 2 === 0 ? 0.4 : -0.4);
    } else if (kind === 'claws') {
      // Three rakes, top to bottom.
      for (let i = -1; i <= 1; i += 1) {
        const rake = new Mesh(this.crescent, this.stroke);
        rake.position.copy(at).add(V.set(0, i * 0.35 * s, 0));
        rake.scale.setScalar(r);
        rake.rotation.set(0.6 * (variant % 2 === 0 ? 1 : -1), yaw, Math.PI / 2 + 0.5);
        this.root.add(rake);
        this.arcs.push({ mesh: rake, life: 0, max: 0.22 });
      }
      arc.visible = false;
    } else if (kind === 'horns' || kind === 'headbutt') {
      arc.rotation.set(Math.PI / 2 - 0.4, 0, yaw);
    } else {
      arc.rotation.x = -Math.PI / 2;
      arc.position.y = 0.2;
    }
    this.root.add(arc);
    this.arcs.push({ mesh: arc, life: 0, max: 0.22 });
    // Dust from under the target, and chips flung outward.
    const dust = Math.round((kill ? 10 : 5) * Math.min(2, s));
    for (let i = 0; i < dust; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 3) * s;
      this.addParticle(this.dustGeometry, this.dust, V.set(at.x + Math.cos(a) * s * 0.6, 0.3, at.z + Math.sin(a) * s * 0.6), new Vector3(Math.cos(a) * speed, 1 + Math.random() * 2, Math.sin(a) * speed), 0.7 + Math.random() * 0.5, s * (0.8 + Math.random() * 0.8), -1, 2.2, true);
    }
    const chips = kill ? 10 : 4;
    for (let i = 0; i < chips; i += 1) {
      const a = yaw + (Math.random() - 0.5) * 2.2;
      const speed = (4 + Math.random() * 5) * Math.sqrt(s);
      this.addParticle(this.chipGeometry, this.chip, at, new Vector3(Math.sin(a) * speed, 3 + Math.random() * 5, Math.cos(a) * speed), 0.8 + Math.random() * 0.4, s * (0.5 + Math.random() * 0.6), 22, 0, false);
    }
    // A heavy attacker's blow shakes the ground.
    if (s > 1.6 || kill) {
      const ring = new Mesh(this.ring, this.shock);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(at.x, 0.15, at.z);
      ring.scale.setScalar(s);
      this.root.add(ring);
      this.arcs.push({ mesh: ring, life: 0, max: 0.4 });
    }
  }

  /** A burst of dust where a heavy foot or a body hits the ground. */
  thump(at: Vector3, size: number): void {
    const s = Math.max(0.6, size / 2.2);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      this.addParticle(this.dustGeometry, this.dust, V.set(at.x, 0.3, at.z), new Vector3(Math.cos(a) * 4 * s, 0.8, Math.sin(a) * 4 * s), 0.8, s * 1.2, -0.5, 2, true);
    }
  }

  /** An item leaps from where it dropped and arcs into the rider. */
  loot(icon: ItemIcon, color: string, from: Vector3, to: () => Vector3): void {
    const sprite = new Sprite(new SpriteMaterial({ map: this.icon(icon, color), transparent: true, depthWrite: false }));
    sprite.scale.setScalar(1.6);
    sprite.position.copy(from);
    this.root.add(sprite);
    this.flyers.push({ sprite, from: from.clone(), to, life: 0, max: 0.9 });
  }

  private icon(icon: ItemIcon, color: string): Texture {
    const key = `${icon}:${color}`;
    const cached = this.icons.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    const texture = new CanvasTexture(canvas);
    this.icons.set(key, texture);
    return texture;
  }

  private addParticle(geometry: SphereGeometry | DodecahedronGeometry, material: MeshBasicMaterial | MeshLambertMaterial, at: Vector3, velocity: Vector3, life: number, scale: number, spin: number, grow: number, fade: boolean): void {
    if (this.particles.length > 220) {
      const old = this.particles.shift();
      old?.mesh.removeFromParent();
    }
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(at);
    mesh.scale.setScalar(scale);
    this.root.add(mesh);
    this.particles.push({
      mesh,
      velocity: velocity.clone(),
      life: 0,
      max: life,
      spin: new Vector3(Math.random() * spin, Math.random() * spin, Math.random() * spin),
      gravity: fade ? 0 : 26,
      grow,
      fade,
    });
  }

  update(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]!;
      p.life += delta;
      if (p.life >= p.max) {
        p.mesh.removeFromParent();
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= p.gravity * delta;
      p.velocity.multiplyScalar(p.fade ? Math.exp(-3 * delta) : 1);
      p.mesh.position.addScaledVector(p.velocity, delta);
      if (p.mesh.position.y < 0.1 && !p.fade) {
        p.mesh.position.y = 0.1;
        p.velocity.set(p.velocity.x * 0.4, Math.abs(p.velocity.y) * 0.3, p.velocity.z * 0.4);
      }
      p.mesh.rotation.x += p.spin.x * delta;
      p.mesh.rotation.y += p.spin.y * delta;
      const t = p.life / p.max;
      if (p.grow !== 0) p.mesh.scale.multiplyScalar(1 + p.grow * delta);
      if (p.fade) p.mesh.visible = t < 0.95;
    }
    for (let i = this.arcs.length - 1; i >= 0; i -= 1) {
      const arc = this.arcs[i]!;
      arc.life += delta;
      const t = arc.life / arc.max;
      if (t >= 1) {
        arc.mesh.removeFromParent();
        this.arcs.splice(i, 1);
        continue;
      }
      arc.mesh.scale.multiplyScalar(1 + delta * 2.5);
      arc.mesh.visible = arc.mesh.visible && t < 0.95;
    }
    // Shared materials pulse rather than fade per instance.
    this.dust.opacity = 0.5;
    for (let i = this.flyers.length - 1; i >= 0; i -= 1) {
      const f = this.flyers[i]!;
      f.life += delta;
      const t = Math.min(1, f.life / f.max);
      const to = f.to();
      f.sprite.position.lerpVectors(f.from, to, t * t);
      f.sprite.position.y += Math.sin(t * Math.PI) * 4;
      f.sprite.scale.setScalar(1.6 * (1 - t * 0.6));
      if (t >= 1) {
        f.sprite.removeFromParent();
        f.sprite.material.dispose();
        this.flyers.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const p of this.particles) p.mesh.removeFromParent();
    for (const a of this.arcs) a.mesh.removeFromParent();
    for (const f of this.flyers) f.sprite.removeFromParent();
    this.dustGeometry.dispose();
    this.chipGeometry.dispose();
    this.flashGeometry.dispose();
    this.crescent.dispose();
    this.ring.dispose();
    for (const m of [this.dust, this.chip, this.flash, this.stroke, this.shock]) m.dispose();
    for (const t of this.icons.values()) t.dispose();
    this.root.removeFromParent();
  }
}
