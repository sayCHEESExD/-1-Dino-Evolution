import { COMBAT, dinoBySlot, type DinoTier } from '@dino/shared';
import { Box3, Group, Mesh, Object3D, Vector3 } from 'three';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { DinoAnimator, createMotion, type DinoMotion } from '../dinos/DinoAnimator.js';
import { createDino, type DinoInstance } from '../dinos/DinoModel.js';
import { sectionAt } from '../dinos/DinoSkeleton.js';
import { PLAYER_MODEL_YAW_OFFSET } from '../config/worldVisuals.js';
import { PetFollower } from '../pets/PetFollower.js';
import { playerModelLoader } from './PlayerModelLoader.js';
import { RiderPose } from './RiderPose.js';

const HIP = new Vector3();
const ROOT = new Vector3();

/**
 * A PLAYER ON SCREEN: a dinosaur, and the player's own avatar riding it.
 *
 *   root          physics transform (position + facing). Gameplay owns it.
 *     dino        the ridden dinosaur - one skinned mesh on its own skeleton,
 *                 animated by `DinoAnimator` from the owner's `DinoMotion`
 *       seat      an anchor on the dinosaur's spine at the saddle
 *         rider   the avatar, seated (`RiderPose`), carried by every stride
 *   worldRoot     the pets, which trot after the player in WORLD space
 *
 * The AVATAR body is the player's own look - the bundled model, or their
 * Bloxity avatar - and `AvatarDresser` owns it through `setModel` / `body`.
 * Swapping dinosaurs moves the rider to the new saddle and rebuilds nothing of
 * the avatar.
 */
/**
 * The rider's size on the saddle. The avatar is drawn a little under life size
 * so even the Compsognathus can carry it, while a Tyrannosaurus dwarfs it.
 */
const RIDER_SCALE = 0.7;

export class PlayerCharacter {
  readonly root = new Group();
  readonly worldRoot = new Group();
  readonly pets = new PetFollower();
  /** What the dinosaur is doing: written by the owner every frame. */
  readonly motion: DinoMotion = createMotion();

  /** The avatar's own group: `BloxityAvatar` scales it by the avatar's height proportion. */
  private readonly riderVisual = new Group();
  /** Places the rider's hips on the saddle. */
  private readonly riderMount = new Group();
  private readonly defaultModel: Object3D;
  private avatarModel: Object3D;
  private rig: PlayerRig;
  private riderPose: RiderPose;
  private dino: DinoInstance;
  private animator: DinoAnimator;
  private tier: DinoTier;
  /** Seconds into the death, or -1 while alive. */
  private deathTime = -1;
  private hipHeight = 1.5;

  constructor(slot = 1) {
    this.tier = dinoBySlot(slot) ?? dinoBySlot(1)!;
    this.dino = createDino(this.tier.look, 'high');
    this.animator = new DinoAnimator(this.dino);
    this.root.add(this.dino.root);

    this.defaultModel = playerModelLoader.createInstance();
    this.avatarModel = this.defaultModel;
    this.avatarModel.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.riderVisual.add(this.avatarModel);
    this.riderMount.add(this.riderVisual);
    this.riderMount.scale.setScalar(RIDER_SCALE);
    this.rig = new PlayerRig(this.avatarModel, this.avatarModel);
    this.riderPose = new RiderPose(this.rig, this.backWidth());
    this.mountRider();
    this.worldRoot.add(this.pets.root);
  }

  /** The AVATAR body, for the dresser. */
  get body(): { visual: Group; model: Object3D } {
    return { visual: this.riderVisual, model: this.avatarModel };
  }

  /** Height of the rider's head above the ground: where name plates sit, what the camera frames. */
  get height(): number {
    return this.tier.height;
  }

  get dinoTier(): DinoTier {
    return this.tier;
  }

  get slot(): number {
    return this.tier.slot;
  }

  get instance(): DinoInstance {
    return this.dino;
  }

  /** Wear a different AVATAR body, or null for the bundled one. */
  setModel(next: Object3D | null): Object3D {
    const target = next ?? this.defaultModel;
    if (target === this.avatarModel) return target;
    const previous = this.avatarModel;
    previous.removeFromParent();
    releaseBody(previous);
    target.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.avatarModel = target;
    this.riderVisual.add(target);
    this.rig = new PlayerRig(target, target);
    this.riderPose.setRig(this.rig);
    this.measureHip();
    return target;
  }

  /** Ride a different dinosaur. Cheap when unchanged. */
  setDino(slot: number): void {
    const tier = dinoBySlot(slot) ?? dinoBySlot(1)!;
    if (tier.slot === this.tier.slot) return;
    this.tier = tier;
    const next = createDino(tier.look, 'high');
    this.dino.dispose();
    this.dino = next;
    this.animator = new DinoAnimator(next);
    this.root.add(next.root);
    this.riderPose.setBackWidth(this.backWidth());
    this.mountRider();
  }

  private backWidth(): number {
    const spec = this.dino.asset.spec;
    return (sectionAt(spec, spec.stance === 'biped' ? 0.36 : 0.45).w * this.dino.asset.scale) / RIDER_SCALE;
  }

  /** Seat the rider on the current dinosaur's saddle. */
  private mountRider(): void {
    this.riderMount.removeFromParent();
    this.dino.seat.add(this.riderMount);
    this.measureHip();
  }

  /** Where the avatar's hips are above its feet, so they can be set on the seat. */
  private measureHip(): void {
    this.rig.resetToBindPose();
    const hip = this.rig.getBone('LegL1') ?? this.rig.getBone('Rig1');
    this.avatarModel.updateMatrixWorld(true);
    if (hip) {
      hip.getWorldPosition(HIP);
      this.avatarModel.getWorldPosition(ROOT);
      const scale = this.riderVisual.getWorldScale(new Vector3()).y || 1;
      this.hipHeight = Math.max(0.6, Math.min(2.4, (HIP.y - ROOT.y) / scale));
    } else {
      const box = new Box3().setFromObject(this.avatarModel);
      this.hipHeight = Math.max(0.6, (box.max.y - box.min.y) * 0.48);
    }
    // Hips on the saddle, a hand's breadth above the leather.
    this.riderMount.position.set(0, 0.12 - this.hipHeight * 0.92 * RIDER_SCALE, -0.05);
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  setYaw(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  /**
   * The death state, straight from the server's health: true starts the fall
   * (once), false - the respawn - stands the animal back up.
   */
  setDead(dead: boolean): void {
    if (dead && this.deathTime < 0) this.deathTime = 0;
    else if (!dead && this.deathTime >= 0) {
      this.deathTime = -1;
      this.animator.reset();
    }
  }

  get dead(): boolean {
    return this.deathTime >= 0;
  }

  /** True while the fall is still playing. */
  get dying(): boolean {
    return this.deathTime >= 0 && this.deathTime < COMBAT.deathSeconds;
  }

  update(delta: number): void {
    const dt = Math.max(0, delta);
    if (this.deathTime >= 0) this.deathTime += dt;
    const m = this.motion;
    m.deathTime = this.deathTime;
    this.animator.update(dt, m);
    this.riderPose.update(dt, {
      attackTime: m.attackTime,
      attackVariant: m.attackVariant,
      grounded: m.grounded,
      verticalVelocity: m.verticalVelocity,
      deathTime: this.deathTime,
      speed: m.speed,
    });
  }

  /** Advance the pets, after the body has moved. */
  updatePets(delta: number): void {
    const p = this.root.position;
    this.pets.update(delta, p.x, p.y, p.z, this.root.rotation.y, this.tier.radius);
  }

  resetAnimation(): void {
    this.animator.reset();
    this.pets.snap();
  }

  dispose(): void {
    this.pets.dispose();
    this.dino.dispose();
    this.root.removeFromParent();
    this.worldRoot.removeFromParent();
  }
}

/** Let go of a Bloxity body's materials when it is swapped out. */
const releaseBody = (model: Object3D): void => {
  if (model.userData['bloxityBody'] !== true) return;
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
};
