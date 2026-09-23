import { petById } from '@dino/shared';
import { Group } from 'three';
import { DinoAnimator, createMotion, type DinoMotion } from '../dinos/DinoAnimator.js';
import { createDino, type DinoInstance } from '../dinos/DinoModel.js';

/** Where each of the four slots trots, relative to the rider: behind and to the sides. */
const SLOTS: readonly (readonly [number, number])[] = [
  [-1.3, -1.6],
  [1.3, -1.6],
  [-2.2, -3.4],
  [2.2, -3.4],
];
const FOLLOW_RATE = 5;
const TURN_RATE = 7;

interface Follower {
  readonly petId: number;
  readonly dino: DinoInstance;
  readonly animator: DinoAnimator;
  readonly motion: DinoMotion;
  x: number;
  z: number;
  yaw: number;
}

const shortest = (from: number, to: number): number => {
  let d = to - from;
  d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
  return d;
};

/**
 * A rider's equipped pets, trotting after them.
 *
 * Hatchling DINOSAURS on the ground, not floating charms: each eases toward its
 * slot behind the rider, turns to face where it is going, and walks or runs
 * with the same procedural gait as the mounts - so a pet swings wide on a turn
 * and scampers to catch up after a sprint.
 */
export class PetFollower {
  readonly root = new Group();
  private followers: Follower[] = [];
  private signature = '';
  private placed = false;

  /** The equipped pets, by species, in slot order. Cheap when unchanged. */
  setPets(petIds: readonly number[]): void {
    const signature = petIds.join(',');
    if (signature === this.signature) return;
    this.signature = signature;
    const previous = this.followers;
    this.followers = [];
    const used = new Set<Follower>();
    for (const petId of petIds.slice(0, SLOTS.length)) {
      const reused = previous.find((entry) => entry.petId === petId && !used.has(entry));
      if (reused) {
        used.add(reused);
        this.followers.push(reused);
        continue;
      }
      const look = petById(petId)?.look ?? 'pet-compy';
      const dino = createDino(look, 'low');
      dino.mesh.castShadow = false;
      this.root.add(dino.root);
      this.followers.push({ petId, dino, animator: new DinoAnimator(dino), motion: createMotion(), x: 0, z: 0, yaw: 0 });
    }
    for (const follower of previous) if (!used.has(follower)) follower.dino.dispose();
    this.placed = false;
  }

  update(delta: number, x: number, y: number, z: number, yaw: number, ownerRadius = 1): void {
    const dt = Math.max(0, delta);
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
    const spread = 1 + ownerRadius * 0.9;
    this.followers.forEach((follower, index) => {
      const [sx, sz] = SLOTS[index]!;
      const ox = sx * spread;
      const oz = sz * spread - ownerRadius;
      // Slot offset rotated into the rider's facing.
      const tx = x + ox * cos + oz * sin;
      const tz = z - ox * sin + oz * cos;
      if (!this.placed) {
        follower.x = tx;
        follower.z = tz;
        follower.yaw = yaw;
      }
      const px = follower.x;
      const pz = follower.z;
      follower.x += (tx - follower.x) * alpha;
      follower.z += (tz - follower.z) * alpha;
      const vx = (follower.x - px) / Math.max(1e-4, dt);
      const vz = (follower.z - pz) / Math.max(1e-4, dt);
      const speed = Math.hypot(vx, vz);
      // Face where it is going; when it stops, face the way its rider faces.
      const want = speed > 0.6 ? Math.atan2(vx, vz) : yaw;
      follower.yaw += shortest(follower.yaw, want) * (1 - Math.exp(-TURN_RATE * dt));
      const root = follower.dino.root;
      root.position.set(follower.x, y, follower.z);
      root.rotation.y = follower.yaw;
      follower.motion.speed = speed;
      follower.motion.grounded = true;
      follower.animator.update(dt, follower.motion);
    });
    this.placed = true;
  }

  /** Snap to the rider on a teleport. */
  snap(): void {
    this.placed = false;
  }

  dispose(): void {
    for (const follower of this.followers) follower.dino.dispose();
    this.followers = [];
    this.root.removeFromParent();
  }
}
