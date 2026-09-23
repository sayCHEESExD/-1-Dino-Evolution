import { ENEMIES, arenaStartZ, stageByIndex, type EnemyDef } from '@dino/shared';
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
  type MeshStandardMaterial,
  type Scene,
} from 'three';
import { ATTACK_IMPACT, ATTACK_SECONDS, DinoAnimator, createMotion, type DinoMotion } from '../dinos/DinoAnimator.js';
import { createDino, ownMaterial, type DinoInstance } from '../dinos/DinoModel.js';
import type { NetEnemyState } from '../net/netTypes.js';
import { worldTextures } from '../world/WorldTextures.js';

/** Stages within this distance (along the road) have their dinosaurs built. */
const BUILD_DISTANCE = 150;
const FOLLOW_RATE = 12;
/** Seconds a fallen dinosaur lies before it sinks away. */
const LIE_SECONDS = 2.4;
const SINK_SECONDS = 1.2;
const FLASH_SECONDS = 0.16;

const shortestAngle = (from: number, to: number): number => {
  let diff = to - from;
  diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
  return diff;
};

const WHITE = new Color(1, 0.92, 0.85);

/** One wild dinosaur on screen, driven by replicated state. */
class EnemyVisual {
  readonly root = new Group();
  private readonly dino: DinoInstance;
  private readonly animator: DinoAnimator;
  private readonly motion: DinoMotion = createMotion();
  private readonly material: MeshStandardMaterial;
  private readonly baseEmissive: Color;
  private readonly baseIntensity: number;
  private readonly seal: Mesh | null = null;
  private readonly sealRing: Mesh | null = null;
  private lastHits = -1;
  private lastSwings = -1;
  private swingVariant = 0;
  private flash = 0;
  private knock = 0;
  private deathTime = -1;
  private alive = true;
  private placed = false;
  private targetX = 0;
  private targetZ = 0;
  private targetYaw = 0;
  private moving = false;
  private wasSealed = false;
  /** Set on the frame a sealed boss's ward falls: the game roars. */
  unsealed = false;
  /** An attack is under way and its jaws have not closed yet. */
  private bitePending = false;
  /** The jaws closed this frame: the manager plays the bite. */
  bit = false;

  constructor(readonly def: EnemyDef) {
    this.dino = createDino(def.look, def.boss ? 'high' : 'medium');
    this.material = ownMaterial(this.dino.asset);
    this.dino.mesh.material = this.material;
    this.baseEmissive = this.material.emissive.clone();
    this.baseIntensity = this.material.emissiveIntensity;
    this.animator = new DinoAnimator(this.dino);
    this.dino.root.scale.setScalar(def.scale);
    this.root.add(this.dino.root);

    if (def.boss) {
      // The SEAL: an amber ward around a boss the local rider cannot fight yet.
      const r = def.radius * 1.9;
      this.seal = new Mesh(
        new SphereGeometry(r, 24, 16),
        new MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }),
      );
      this.seal.position.y = this.dino.asset.height * def.scale * 0.45;
      this.seal.scale.y = Math.max(0.8, (this.dino.asset.height * def.scale) / (r * 1.6));
      this.sealRing = new Mesh(
        new PlaneGeometry(def.radius * 5, def.radius * 5),
        new MeshBasicMaterial({ map: worldTextures.runeCircle('#ffd27a'), transparent: true, depthWrite: false, blending: AdditiveBlending }),
      );
      this.sealRing.rotation.x = -Math.PI / 2;
      this.sealRing.position.y = 0.08;
      this.root.add(this.seal, this.sealRing);
    }
  }

  /** Where the animal's head is, roughly, for effects. */
  get headHeight(): number {
    return this.dino.asset.height * this.def.scale * 0.8;
  }

  /**
   * Out of this run: hidden, and primed so the next state it is given - a
   * fresh wave's dinosaur - snaps to its post with nothing carried over.
   */
  vanish(): void {
    this.root.visible = false;
    this.alive = false;
    this.deathTime = -1;
    this.lastHits = -1;
    this.lastSwings = -1;
    this.motion.attackTime = -1;
    this.bitePending = false;
    this.bit = false;
  }

  /** Show a replicated state. Returns true on the one frame this dinosaur is seen to fall. */
  apply(state: NetEnemyState, sealed: boolean): boolean {
    const died = this.alive && !state.alive;
    this.targetX = state.x;
    this.targetZ = state.z;
    this.targetYaw = state.yaw;
    this.moving = state.moving;
    if (this.lastHits >= 0 && state.hits !== this.lastHits) {
      this.flash = FLASH_SECONDS;
      this.knock = 1;
      this.motion.hitTime = 0;
    }
    this.lastHits = state.hits;
    if (this.lastSwings >= 0 && state.swings !== this.lastSwings) {
      this.motion.attackTime = 0;
      this.swingVariant += 1;
      this.bitePending = true;
    }
    this.lastSwings = state.swings;
    if (this.alive && !state.alive) this.deathTime = 0;
    if (!this.alive && state.alive) {
      this.deathTime = -1;
      this.placed = false;
      this.animator.reset();
    }
    this.alive = state.alive;
    if (this.seal && this.sealRing) {
      const show = sealed && state.alive;
      this.seal.visible = show;
      this.sealRing.visible = show;
      if (this.wasSealed && !sealed && state.alive) this.unsealed = true;
      this.wasSealed = sealed;
    }
    return died;
  }

  update(dt: number): void {
    const p = this.root.position;
    if (!this.placed) {
      p.set(this.targetX, 0, this.targetZ);
      this.root.rotation.y = this.targetYaw;
      this.placed = true;
    } else if (this.deathTime < 0) {
      const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
      p.x += (this.targetX - p.x) * alpha;
      p.z += (this.targetZ - p.z) * alpha;
      this.root.rotation.y += shortestAngle(this.root.rotation.y, this.targetYaw) * alpha;
    }

    const m = this.motion;
    if (this.deathTime >= 0) {
      this.deathTime += dt;
      m.deathTime = this.deathTime;
      const sink = Math.max(0, this.deathTime - LIE_SECONDS) / SINK_SECONDS;
      this.dino.root.position.y = -sink * this.dino.asset.height * this.def.scale * 0.8;
      this.root.visible = sink < 1;
    } else {
      this.root.visible = true;
      m.deathTime = -1;
      this.dino.root.position.y = 0;
    }
    // A hit rocks it back on its heels.
    this.knock = Math.max(0, this.knock - dt * 5);
    this.dino.root.position.z = -Math.sin(this.knock * Math.PI) * 0.25 * this.def.radius;

    m.speed = this.moving && this.deathTime < 0 ? this.def.speed : 0;
    m.grounded = true;
    if (m.attackTime >= 0) {
      m.attackTime += dt;
      // The jaws close: the bite is heard now, on the animation's impact frame.
      if (this.bitePending && m.attackTime >= ATTACK_SECONDS * ATTACK_IMPACT * 1.5) {
        this.bitePending = false;
        if (this.deathTime < 0) this.bit = true;
      }
      if (m.attackTime >= ATTACK_SECONDS * 1.5) m.attackTime = -1;
    }
    m.attackVariant = this.swingVariant;
    if (m.hitTime >= 0) m.hitTime += dt;
    // Enemies attack a touch slower than players: a readable wind-up to dodge.
    const saved = m.attackTime;
    if (saved >= 0) m.attackTime = saved / 1.5;
    this.animator.update(dt, m);
    m.attackTime = saved;

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const k = this.flash / FLASH_SECONDS;
      this.material.emissive.copy(this.baseEmissive).lerp(WHITE, k);
      this.material.emissiveIntensity = this.baseIntensity + k * 0.9;
    } else if (this.material.emissiveIntensity !== this.baseIntensity) {
      this.material.emissive.copy(this.baseEmissive);
      this.material.emissiveIntensity = this.baseIntensity;
    }
    if (this.sealRing?.visible) this.sealRing.rotation.z += dt * 0.6;
  }

  dispose(): void {
    this.dino.dispose();
    this.material.dispose();
    if (this.seal) {
      this.seal.geometry.dispose();
      (this.seal.material as Material).dispose();
    }
    if (this.sealRing) {
      this.sealRing.geometry.dispose();
      (this.sealRing.material as Material).dispose();
    }
    this.root.removeFromParent();
  }
}

/**
 * The LOCAL rider's run: every wild dinosaur they are fighting, drawn from
 * replicated state ONLY.
 *
 * Built lazily per stage, only while the rider is near that stage, and torn
 * down when they leave: a player can only ever see one or two stages at once.
 */
export class EnemyManager {
  private readonly visuals = new Map<number, EnemyVisual>();
  private readonly builtStages = new Set<number>();
  /** Which replicated state each visual last showed: a new object is a new run's dinosaur. */
  private readonly bound = new Map<number, NetEnemyState>();
  /** Dinosaurs whose fall has been announced: each of each run exactly once. */
  private readonly announced = new WeakSet<NetEnemyState>();

  /**
   * @param onDeath  once per dinosaur downed in the local run (the bellow)
   * @param onUnseal once per boss whose ward falls (the challenge roar)
   * @param onBite   each time a dinosaur's attack on the rider lands (its impact frame)
   */
  constructor(
    private readonly scene: Scene,
    private readonly onDeath: (def: EnemyDef) => void = () => undefined,
    private readonly onUnseal: (def: EnemyDef) => void = () => undefined,
    private readonly onBite: (def: EnemyDef) => void = () => undefined,
  ) {}

  /** How many dinosaurs are alive right now in a stage, from replicated state. */
  static aliveIn(stage: number, enemies: ArrayLike<NetEnemyState> | null): number {
    let alive = 0;
    for (const def of stageByIndex(stage)?.enemies ?? []) if (enemies?.[def.id]?.alive) alive += 1;
    return alive;
  }

  /** The on-screen position of a dinosaur, if it is built. */
  positionOf(id: number): { x: number; z: number; height: number } | null {
    const visual = this.visuals.get(id);
    return visual ? { x: visual.root.position.x, z: visual.root.position.z, height: visual.headHeight } : null;
  }

  update(dt: number, enemies: ArrayLike<NetEnemyState> | null, localZ: number, killMasks: ArrayLike<number> | null): void {
    this.cull(localZ);
    for (const [id, visual] of this.visuals) {
      const state = enemies?.[id];
      // Every rider fights their own run: a dinosaur not in the local run is not drawn.
      if (state !== this.bound.get(id)) {
        visual.vanish();
        if (state) this.bound.set(id, state);
        else this.bound.delete(id);
      }
      if (!state) continue;
      const stage = stageByIndex(visual.def.stage);
      const mask = killMasks?.[visual.def.stage - 1] ?? 0;
      const sealed = visual.def.boss && !!stage && (mask & stage.waveMask) !== stage.waveMask;
      if (visual.apply(state, sealed) && !this.announced.has(state)) {
        this.announced.add(state);
        this.onDeath(visual.def);
      }
      if (visual.unsealed) {
        visual.unsealed = false;
        this.onUnseal(visual.def);
      }
      visual.update(dt);
      if (visual.bit) {
        visual.bit = false;
        this.onBite(visual.def);
      }
    }
  }

  private cull(localZ: number): void {
    const stages = new Set<number>();
    for (const def of ENEMIES) stages.add(def.stage);
    for (const stage of stages) {
      const centre = arenaStartZ(stage) + 48;
      const near = Math.abs(localZ - centre) < BUILD_DISTANCE;
      if (near && !this.builtStages.has(stage)) {
        this.builtStages.add(stage);
        for (const def of ENEMIES) {
          if (def.stage !== stage) continue;
          const visual = new EnemyVisual(def);
          // Hidden until the local run fields it.
          visual.vanish();
          this.visuals.set(def.id, visual);
          this.scene.add(visual.root);
        }
      } else if (!near && this.builtStages.has(stage) && Math.abs(localZ - centre) > BUILD_DISTANCE + 40) {
        this.builtStages.delete(stage);
        for (const def of ENEMIES) {
          if (def.stage !== stage) continue;
          this.visuals.get(def.id)?.dispose();
          this.visuals.delete(def.id);
          this.bound.delete(def.id);
        }
      }
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) visual.dispose();
    this.visuals.clear();
    this.builtStages.clear();
  }
}
