import { AvatarDresser } from '../bloxity/AvatarDresser.js';
import { lookFromState } from '../bloxity/avatarLook.js';
import { ATTACK_SECONDS } from '../dinos/DinoAnimator.js';
import type { NetPlayerState } from '../net/netTypes.js';
import { NamePlate } from './NamePlate.js';
import { PlayerCharacter } from './PlayerCharacter.js';

const FOLLOW_RATE = 14;
const SNAP_DISTANCE = 14;
const FACE_SECONDS = 0.35;

const shortestAngle = (from: number, to: number): number => {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
};

/**
 * Another player's rider and dinosaur, rendered from replicated state ONLY.
 *
 * The transform is smoothed toward the replicated one. Attacks are derived
 * from the replicated `attackCount`: every increase is one attack to play,
 * facing `attackYaw` - a difference against the count first seen, never a
 * replay of somebody's whole session.
 */
export class RemotePlayer {
  readonly character: PlayerCharacter;

  private readonly plate = new NamePlate();
  private targetX = 0;
  private targetY = 0;
  private targetZ = 0;
  private targetYaw = 0;
  private placed = false;
  private readonly dresser: AvatarDresser;
  private lastLook = '';
  private lastAttackCount = -1;
  private lastHealth = -1;
  private swingTime = -1;
  private swingVariant = 0;
  private faceYaw = 0;
  private faceFor = 0;
  private wasGrounded = true;
  private grounded = true;
  private speed = 0;
  private verticalVelocity = 0;
  private turnRate = 0;
  private displayName = '';
  private avatarUrl = '';
  private readonly petIds: number[] = [];
  /** Set when a new attack arrived, until the game has played its effect. */
  attacked = false;

  get variant(): number {
    return this.swingVariant;
  }

  get facing(): number {
    return this.faceYaw;
  }

  get position(): { readonly x: number; readonly y: number; readonly z: number } {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }

  constructor(state: NetPlayerState) {
    this.character = new PlayerCharacter(state.dinoSlot);
    this.character.root.add(this.plate.sprite);
    this.dresser = new AvatarDresser(this.character);
    this.apply(state);
    this.character.setPosition(this.targetX, this.targetY, this.targetZ);
    this.character.setYaw(this.targetYaw);
    this.placed = true;
  }

  apply(state: NetPlayerState): void {
    this.targetX = state.x;
    this.targetY = state.y;
    this.targetZ = state.z;
    this.targetYaw = state.rotationY;
    this.grounded = state.grounded;
    this.speed = state.speed;
    this.verticalVelocity = state.verticalVelocity;

    const slotChanged = state.dinoSlot !== this.character.slot;
    this.character.setDino(state.dinoSlot);
    if (slotChanged || state.displayName !== this.displayName || state.avatarUrl !== this.avatarUrl) {
      this.displayName = state.displayName;
      this.avatarUrl = state.avatarUrl;
      this.plate.set(state.displayName, state.avatarUrl, this.character.height);
    }
    // 0 health is the server's death state: the mount goes down until the respawn.
    this.character.setDead(state.health <= 0);
    if (this.lastHealth >= 0 && state.health < this.lastHealth && state.health > 0) this.character.motion.hitTime = 0;
    this.lastHealth = state.health;

    this.petIds.length = 0;
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet?.equipped) this.petIds.push(pet.petId);
    }
    this.character.pets.setPets(this.petIds);

    if (this.lastAttackCount >= 0 && state.attackCount > this.lastAttackCount) {
      this.swingTime = 0;
      this.swingVariant = (this.swingVariant + 1) % 2;
      this.faceYaw = state.attackYaw;
      this.faceFor = FACE_SECONDS;
      this.attacked = true;
    }
    this.lastAttackCount = state.attackCount;
    this.dressFrom(state);
  }

  private dressFrom(state: NetPlayerState): void {
    const avatar = state.avatar;
    if (!avatar) return;
    const look = lookFromState(avatar);
    const key = JSON.stringify(look);
    if (key === this.lastLook) return;
    this.lastLook = key;
    this.dresser.setLook(look.appearance, look.proportions);
  }

  update(delta: number): void {
    const dt = Math.max(0, delta);
    const position = this.character.root.position;
    const gap = Math.hypot(this.targetX - position.x, this.targetY - position.y, this.targetZ - position.z);
    const yawBefore = this.character.root.rotation.y;
    if (!this.placed || gap > SNAP_DISTANCE) {
      position.set(this.targetX, this.targetY, this.targetZ);
      this.character.setYaw(this.targetYaw);
      this.character.pets.snap();
      this.placed = true;
    } else {
      const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
      position.x += (this.targetX - position.x) * alpha;
      position.y += (this.targetY - position.y) * alpha;
      position.z += (this.targetZ - position.z) * alpha;
      const yaw = this.character.root.rotation.y;
      const want = this.faceFor > 0 && this.speed < 6 ? this.faceYaw : this.targetYaw;
      this.character.setYaw(yaw + shortestAngle(yaw, want) * Math.min(1, alpha * 1.5));
    }
    const turn = shortestAngle(yawBefore, this.character.root.rotation.y);
    this.turnRate += ((dt > 0 ? turn / dt : 0) - this.turnRate) * Math.min(1, dt * 10);

    if (this.swingTime >= 0) {
      this.swingTime += dt;
      if (this.swingTime >= ATTACK_SECONDS) this.swingTime = -1;
    }
    this.faceFor = Math.max(0, this.faceFor - dt);

    const m = this.character.motion;
    m.speed = this.speed;
    m.grounded = this.grounded;
    m.verticalVelocity = this.verticalVelocity;
    m.turnRate = this.turnRate;
    m.landed = this.grounded && !this.wasGrounded;
    this.wasGrounded = this.grounded;
    m.attackTime = this.swingTime;
    m.attackVariant = this.swingVariant;
    if (m.hitTime >= 0) m.hitTime += dt;
    this.character.update(dt);
    this.character.updatePets(dt);
  }

  dispose(): void {
    this.plate.dispose();
    this.dresser.dispose();
    this.character.dispose();
  }
}
