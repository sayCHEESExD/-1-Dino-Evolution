import type { PoseDefinition } from '../animation/PoseBuffer.js';
import { PoseBuffer } from '../animation/PoseBuffer.js';
import type { PlayerRig } from '../animation/rig/PlayerRig.js';

const deg = (d: number): number => (d * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * THE RIDER: the player's own avatar, seated astride the saddle.
 *
 * Written in the rig's character-space convention (`PlayerRig`): +X pitch
 * swings a limb BACKWARD, so a thigh raised forward is a large negative X; +Z
 * on a left limb swings it out to the side. The legs straddle wider on a
 * broader back; the hands hold the reins forward.
 *
 * On top of the seat's own motion (the rider is parented to the dinosaur's
 * spine, so every stride and lunge carries them), the pose reacts: a thrown
 * arm and a forward lean on each attack, a lean back in the air, a brace on
 * landing, and a flail as the mount goes down.
 */
const seated = (splay: number): PoseDefinition => ({
  Spine1: { x: deg(-8) },
  Spine2: { x: deg(-4) },
  Neck1: { x: deg(6) },
  LegL1: { x: deg(-78), z: splay },
  LegR1: { x: deg(-78), z: -splay },
  LegL2: { x: deg(84) },
  LegR2: { x: deg(84) },
  ArmL1: { x: deg(-42), z: deg(10) },
  ArmR1: { x: deg(-42), z: deg(-10) },
  ArmL2: { x: deg(-48) },
  ArmR2: { x: deg(-48) },
});

export interface RiderInput {
  /** Seconds into the mount's attack, or -1. */
  attackTime: number;
  attackVariant: number;
  grounded: boolean;
  verticalVelocity: number;
  /** Seconds since the mount died, or -1. */
  deathTime: number;
  speed: number;
}

export class RiderPose {
  private readonly pose = new PoseBuffer();
  private readonly base = new PoseBuffer();
  private lean = 0;
  private air = 0;
  private time = 0;

  constructor(
    private rig: PlayerRig,
    /** Half-width of the back the rider straddles. */
    private backWidth: number,
  ) {
    this.rebuildBase();
  }

  setRig(rig: PlayerRig): void {
    this.rig = rig;
  }

  setBackWidth(width: number): void {
    this.backWidth = width;
    this.rebuildBase();
  }

  private rebuildBase(): void {
    // Wider backs spread the thighs further; a Compsognathus barely parts them.
    const splay = clamp(Math.atan2(this.backWidth * 1.05, 0.72), deg(14), deg(72));
    this.base.applyDefinition(seated(splay));
  }

  update(dt: number, input: RiderInput): void {
    this.time += dt;
    this.pose.copyFrom(this.base);
    const attacking = input.attackTime >= 0 && input.attackTime < 0.45;
    const k = attacking ? input.attackTime / 0.45 : 0;
    const strike = attacking ? Math.sin(Math.PI * clamp(k, 0, 1)) : 0;
    const wantLean = strike * 0.25 + clamp(input.speed / 60, 0, 1) * 0.12;
    this.lean += (wantLean - this.lean) * (1 - Math.exp(-12 * dt));
    this.air += ((input.grounded ? 0 : 1) - this.air) * (1 - Math.exp(-10 * dt));

    this.pose.add('Spine1', -this.lean + this.air * 0.18);
    this.pose.add('Neck1', this.lean * 0.5);
    // The command: one arm thrown forward with each attack, the other hand keeps the reins.
    const arm = input.attackVariant % 2 === 0 ? 'ArmR1' : 'ArmL1';
    const forearm = arm === 'ArmR1' ? 'ArmR2' : 'ArmL2';
    this.pose.add(arm, -strike * 1.5, 0, (arm === 'ArmR1' ? -1 : 1) * strike * 0.2);
    this.pose.add(forearm, strike * 0.9);
    // Airborne: knees grip higher, arms lift for balance.
    this.pose.add('LegL1', -this.air * 0.2);
    this.pose.add('LegR1', -this.air * 0.2);
    this.pose.add('ArmL1', -this.air * 0.4, 0, this.air * 0.4);
    this.pose.add('ArmR1', -this.air * 0.4, 0, -this.air * 0.4);
    // Going down with the mount: thrown back, arms out.
    if (input.deathTime >= 0) {
      const t = clamp(input.deathTime / 0.8, 0, 1);
      this.pose.add('Spine1', t * 0.5);
      this.pose.add('ArmL1', -t * 1.8 + Math.sin(this.time * 18) * 0.15 * (1 - t), 0, t * 0.9);
      this.pose.add('ArmR1', -t * 1.8 + Math.cos(this.time * 17) * 0.15 * (1 - t), 0, -t * 0.9);
      this.pose.add('Neck1', t * 0.4);
    }
    // A little life: the head turns about when idle.
    this.pose.add('Neck1', 0, Math.sin(this.time * 0.45) * 0.12 * (1 - clamp(input.speed / 10, 0, 1)));
    this.rig.applyPose(this.pose);
  }
}
