import { Bone, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { DinoInstance } from './DinoModel.js';
import { solveTwoBone, type LimbChain } from './DinoSkeleton.js';
import type { AttackKind } from './DinoSpecies.js';

/**
 * WHAT THE ANIMAL IS DOING this frame. Written by its owner (the local
 * player's prediction, a remote's replicated state, an enemy's replicated
 * state) and only ever read here.
 */
export interface DinoMotion {
  /** Horizontal speed, world units per second. */
  speed: number;
  grounded: boolean;
  verticalVelocity: number;
  /** Signed yaw rate, radians per second, for the body's bend into a turn. */
  turnRate: number;
  /** Seconds since the current attack began, or -1. */
  attackTime: number;
  /** Alternates each attack (which arm leads, which way the tail swings). */
  attackVariant: number;
  /** Seconds since the last hit taken, or -1. */
  hitTime: number;
  /** Seconds since death, or -1 while alive. */
  deathTime: number;
  /** Seconds since a roar began, or -1. */
  roarTime: number;
  /** True on the frame it touched down. */
  landed: boolean;
}

export const createMotion = (): DinoMotion => ({
  speed: 0,
  grounded: true,
  verticalVelocity: 0,
  turnRate: 0,
  attackTime: -1,
  attackVariant: 0,
  hitTime: -1,
  deathTime: -1,
  roarTime: -1,
  landed: false,
});

/** How long one attack plays, and where in it the blow lands (fraction). */
export const ATTACK_SECONDS = 0.42;
export const ATTACK_IMPACT = 0.45;
export const ROAR_SECONDS = 1.3;
/** How long the fall takes: the death animation is done well within the server's death state. */
export const DEATH_FALL_SECONDS = 1.25;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const damp = (current: number, target: number, rate: number, dt: number): number => current + (target - current) * (1 - Math.exp(-rate * dt));
/** 0 -> 1 -> 0 over [a, b]. */
const bump = (t: number, a: number, b: number): number => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));

interface LegRig {
  readonly chain: LimbChain;
  readonly bones: Bone[];
  /** Bind directions of each bone to its child, in its parent's frame (identity bind). */
  readonly rest: Vector3[];
  readonly lengths: number[];
  /** Bind ball-of-foot (hind) or wrist (fore) position. */
  readonly home: Vector3;
  /** Bind direction ankle -> ball (hind). */
  readonly metaDir: Vector3;
  readonly phaseOffset: number;
  readonly hind: boolean;
  readonly pole: Vector3;
  /** The bones above the limb root, for its parent's rotation. */
  readonly parents: Bone[];
}

const E = new Euler();
const Q = new Quaternion();
const Q2 = new Quaternion();
const V1 = new Vector3();
const V2 = new Vector3();
const V3 = new Vector3();
const KNEE = new Vector3();
const M = new Matrix4();

/**
 * PROCEDURAL ANIMATION FOR EVERY DINOSAUR. No clips ship: the animal is
 * animated from its own skeleton every frame, so a Compsognathus and a
 * Brachiosaurus walk with the same code and each looks like itself.
 *
 *   locomotion  a gait cycle whose stride matches the ground speed; feet are
 *               PLANTED by two-bone IK (hind: femur+tibia to the ankle, the
 *               metatarsus angled to the ball of the foot; fore: humerus+radius
 *               to the wrist) so they do not skate. Bipeds alternate; quadrupeds
 *               walk a lateral sequence; sprawlers trot diagonally. The hips
 *               bob twice a cycle and roll, the tail swings in a travelling
 *               wave against the hips, the neck holds the head level.
 *   idle        breathing through the ribs, a slow look around, the tail
 *               stirring, the odd jaw twitch.
 *   attack      per species: a lunging bite, a raking claw swipe, a kick, a
 *               headbutt, a horn toss, a tail swing, a sauropod's rear and stomp.
 *   jump/land   crouch, tuck, reach, absorb.
 *   hit         the head snaps back and the body shudders.
 *   death       a stagger, then the animal topples onto its side and lies with
 *               its neck and tail slumped.
 */
export class DinoAnimator {
  private readonly legs: LegRig[] = [];
  private readonly arms: LegRig[] = [];
  private readonly pelvis: Bone;
  private readonly spine: Bone[];
  private readonly neck: Bone[];
  private readonly head: Bone;
  private readonly jaw: Bone;
  private readonly frill: Bone | null;
  private readonly tail: Bone[];
  private readonly pelvisHome: Vector3;
  private readonly legLength: number;
  private readonly hip: number;
  private readonly quadruped: boolean;
  private readonly attackKind: AttackKind;
  private readonly cadence: number;

  private phase = 0;
  private time = Math.random() * 10;
  private move = 0;
  private run = 0;
  private air = 0;
  private landDip = 0;
  private bend = 0;
  private lookYaw = 0;
  private lookTarget = 0;
  private lookTimer = 0;
  private twitch = 0;
  private flinch = 0;
  private stride = 0;

  constructor(private readonly dino: DinoInstance, attack?: AttackKind) {
    const layout = dino.layout;
    const bones = dino.bones;
    this.pelvis = bones[layout.pelvis]!;
    this.spine = layout.spine.map((i) => bones[i]!);
    this.neck = layout.neck.map((i) => bones[i]!);
    this.head = bones[layout.head]!;
    this.jaw = bones[layout.jaw]!;
    this.frill = layout.frill >= 0 ? bones[layout.frill]! : null;
    this.tail = layout.tail.map((i) => bones[i]!);
    this.pelvisHome = this.pelvis.position.clone();
    this.hip = dino.asset.hip;
    const spec = dino.asset.spec;
    this.quadruped = spec.stance !== 'biped';
    this.attackKind = attack ?? spec.attack;
    this.cadence = spec.cadence;

    const sprawl = spec.stance === 'sprawl';
    const makeRig = (chain: LimbChain, hind: boolean, offset: number, parents: Bone[]): LegRig => {
      const chainBones = chain.bones.map((i) => bones[i]!);
      const rest: Vector3[] = [];
      const lengths: number[] = [];
      for (let i = 0; i < chain.bones.length; i += 1) {
        const from = chain.joints[i]!;
        const to = chain.joints[i + 1]!;
        rest.push(new Vector3().subVectors(to, from).normalize());
        lengths.push(from.distanceTo(to));
      }
      const home = hind ? chain.joints[3]!.clone() : chain.joints[2]!.clone();
      const metaDir = hind ? new Vector3().subVectors(chain.joints[3]!, chain.joints[2]!).normalize() : new Vector3(0, -1, 0);
      const outward = chain.side < 0 ? 1 : -1;
      const pole = sprawl ? new Vector3(outward, 1.2, hind ? 0.2 : -0.3) : hind ? new Vector3(0, 0.2, 1) : new Vector3(0, 0, -1);
      return { chain, bones: chainBones, rest, lengths, home, metaDir, phaseOffset: offset, hind, pole, parents };
    };
    const pelvisChain = [this.pelvis];
    const shoulderChain = [this.pelvis, this.spine[0]!, this.spine[1]!];
    // Gait phase offsets: bipeds alternate; quadrupeds walk a lateral sequence; sprawlers trot.
    layout.hind.forEach((chain) => {
      const left = chain.side < 0;
      this.legs.push(makeRig(chain, true, left ? 0 : 0.5, pelvisChain));
    });
    layout.fore.forEach((chain) => {
      const left = chain.side < 0;
      const offset = sprawl ? (left ? 0.5 : 0) : left ? 0.25 : 0.75;
      const rig = makeRig(chain, false, offset, shoulderChain);
      if (chain.walks) this.legs.push(rig);
      else this.arms.push(rig);
    });
    const hindLeg = this.legs.find((l) => l.hind);
    this.legLength = hindLeg ? hindLeg.lengths.slice(0, 3).reduce((a, b) => a + b, 0) : this.hip;
  }

  reset(): void {
    this.phase = 0;
    this.move = 0;
    this.run = 0;
    this.air = 0;
    this.landDip = 0;
    this.bend = 0;
    this.flinch = 0;
    this.dino.mesh.position.set(0, 0, 0);
    this.dino.mesh.rotation.set(0, 0, 0);
  }

  update(dtRaw: number, m: DinoMotion): void {
    const dt = Math.min(0.1, Math.max(0, dtRaw));
    this.time += dt;
    const dead = m.deathTime >= 0;
    const speed = dead ? 0 : m.speed;

    // --- state blends
    this.move = damp(this.move, speed > 0.4 ? 1 : 0, 8, dt);
    const runRef = this.hip * 5;
    this.run = damp(this.run, clamp((speed - runRef * 0.6) / runRef, 0, 1), 5, dt);
    this.air = damp(this.air, !m.grounded && !dead ? 1 : 0, 12, dt);
    if (m.landed) this.landDip = 1;
    this.landDip = Math.max(0, this.landDip - dt * 3.2);
    this.bend = damp(this.bend, clamp(m.turnRate * 0.12, -0.4, 0.4), 6, dt);
    if (m.hitTime >= 0 && m.hitTime < 0.05) this.flinch = 1;
    this.flinch = Math.max(0, this.flinch - dt * 4);

    // --- gait: stride grows with speed, cadence rises until the legs run out
    const legs = this.legLength;
    const maxFreq = (2.2 * this.cadence) / Math.sqrt(Math.max(0.5, this.hip / 2.5));
    let stride = clamp(legs * (0.55 + speed / (legs * 6)), legs * 0.5, legs * (1.2 + this.run * 1.1));
    let freq = speed / Math.max(0.01, stride);
    if (freq > maxFreq) {
      freq = maxFreq;
      stride = Math.min(legs * 2.4, speed / freq);
    }
    this.stride = damp(this.stride, stride, 10, dt);
    this.phase = (this.phase + freq * dt) % 1;
    const cycle = this.phase * Math.PI * 2;

    // --- idle life
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = 2 + Math.random() * 3.5;
      this.lookTarget = (Math.random() - 0.5) * 0.9;
      if (Math.random() < 0.35) this.twitch = 1;
    }
    this.twitch = Math.max(0, this.twitch - dt * 2.2);
    this.lookYaw = damp(this.lookYaw, this.lookTarget * (1 - this.move), 1.6, dt);
    const breath = Math.sin(this.time * 1.7);

    // --- attack envelope
    const attacking = m.attackTime >= 0 && m.attackTime < ATTACK_SECONDS && !dead;
    const k = attacking ? m.attackTime / ATTACK_SECONDS : 0;
    const wind = attacking ? smooth(k / 0.38) * (1 - smooth((k - 0.38) / 0.12)) : 0;
    const strike = attacking ? bump(k, 0.3, 0.85) : 0;
    const snap = attacking ? smooth((k - 0.34) / 0.14) * (1 - smooth((k - 0.62) / 0.35)) : 0;
    const variant = m.attackVariant % 2 === 0 ? 1 : -1;
    const roaring = m.roarTime >= 0 && m.roarTime < ROAR_SECONDS && !dead;
    const roar = roaring ? bump(m.roarTime, 0, ROAR_SECONDS) : 0;

    // --- the hips: bob, roll, pitch, lunge
    const bobAmp = this.hip * (0.025 + 0.035 * this.run) * this.move;
    const bob = (this.quadruped ? Math.cos(cycle * 2) * 0.6 : Math.cos(cycle * 2)) * bobAmp;
    const roll = Math.sin(cycle) * (this.quadruped ? 0.025 : 0.06) * this.move;
    const sway = Math.sin(cycle) * this.hip * 0.02 * this.move * (this.quadruped ? 0.3 : 1);
    let pitch = this.run * (this.quadruped ? 0.03 : 0.1) + clamp(-m.verticalVelocity * 0.012, -0.25, 0.25) * this.air;
    let lunge = 0;
    let rise = 0;
    let yawBody = this.bend * 0.5;
    let rollBody = roll;

    switch (this.attackKind) {
      case 'bite':
        pitch += -wind * 0.08 + strike * 0.14;
        lunge = strike * this.hip * 0.28 - wind * this.hip * 0.06;
        break;
      case 'claws':
        pitch += -wind * 0.12 + strike * 0.16;
        lunge = strike * this.hip * 0.22;
        rise = wind * this.hip * 0.04;
        break;
      case 'kick':
        pitch += -strike * 0.12;
        rise = strike * this.hip * 0.06;
        break;
      case 'headbutt':
      case 'horns':
        pitch += wind * 0.05 + strike * 0.08;
        lunge = strike * this.hip * 0.32 - wind * this.hip * 0.1;
        break;
      case 'tail':
        yawBody += variant * (wind * -0.15 + strike * 0.35);
        rollBody += variant * strike * 0.05;
        break;
      case 'stomp':
        pitch += -wind * 0.32 + strike * 0.12;
        rise = wind * this.hip * 0.08;
        break;
    }
    pitch -= roar * 0.1;
    const dip = this.landDip * this.landDip * this.hip * 0.14 + this.air * this.hip * 0.06 - rise;
    this.pelvis.position.set(this.pelvisHome.x + sway, this.pelvisHome.y + bob - dip + breath * this.hip * 0.004, this.pelvisHome.z + lunge);
    this.setRot(this.pelvis, pitch, yawBody + Math.sin(cycle) * 0.04 * this.move, rollBody);

    // --- the spine: breathing, counter-roll, the bend into a turn
    const breathe = breath * 0.012 * (1 - this.move * 0.5);
    this.setRot(this.spine[0]!, breathe - pitch * 0.25, this.bend * 0.35, -roll * 0.5);
    this.setRot(this.spine[1]!, -breathe * 0.6 - pitch * 0.2 + (this.attackKind === 'stomp' ? -wind * 0.15 : 0), this.bend * 0.3, -roll * 0.3);

    // --- the neck: holds the head steady, looks about, strikes
    const n = this.neck.length;
    let neckPitch = -pitch * 0.6 / Math.max(1, n) - Math.cos(cycle * 2) * 0.02 * this.move;
    let headPitch = 0;
    let jawOpen = this.twitch * 0.12 * Math.max(0, Math.sin(this.twitch * Math.PI)) + (this.move > 0.5 ? this.run * 0.08 : 0);
    let neckYaw = (this.lookYaw + this.bend * 0.6) / Math.max(1, n);
    let headRoll = 0;
    switch (this.attackKind) {
      case 'bite':
        neckPitch += (-wind * 0.22 + snap * 0.3) / Math.max(1, n) * 2;
        headPitch += -wind * 0.18 + snap * 0.22;
        jawOpen = Math.max(jawOpen, attacking ? clamp(k / 0.36, 0, 1) * (1 - smooth((k - 0.4) / 0.14)) * 0.95 : 0);
        break;
      case 'claws':
        neckPitch += (-wind * 0.12 + strike * 0.2) / Math.max(1, n) * 2;
        jawOpen = Math.max(jawOpen, strike * 0.75);
        headRoll = variant * strike * 0.12;
        break;
      case 'kick':
        neckPitch += (-strike * 0.15) / Math.max(1, n) * 2;
        jawOpen = Math.max(jawOpen, strike * 0.3);
        break;
      case 'headbutt':
        neckPitch += (-wind * 0.25 + strike * 0.45) / Math.max(1, n) * 2;
        headPitch += strike * 0.25;
        break;
      case 'horns':
        neckPitch += (wind * 0.3 - snap * 0.35) / Math.max(1, n) * 2;
        headPitch += wind * 0.15 - snap * 0.3;
        break;
      case 'tail':
        neckYaw += (-variant * strike * 0.25) / Math.max(1, n);
        jawOpen = Math.max(jawOpen, strike * 0.3);
        break;
      case 'stomp':
        neckPitch += (-wind * 0.15) / Math.max(1, n);
        jawOpen = Math.max(jawOpen, wind * 0.4);
        break;
    }
    // Roar: head up and back, jaws wide, a shake.
    neckPitch += (-roar * 0.35) / Math.max(1, n);
    headPitch += roar * 0.15 + Math.sin(this.time * 28) * 0.03 * roar;
    jawOpen = Math.max(jawOpen, roar * 1.0);
    // A flinch snaps the head back.
    neckPitch += (-this.flinch * 0.25) / Math.max(1, n);
    headRoll += Math.sin(this.time * 40) * 0.08 * this.flinch;
    // Airborne: head up a touch; the landing drops it.
    neckPitch += (-this.air * 0.15 + this.landDip * 0.12) / Math.max(1, n);
    for (const bone of this.neck) this.setRot(bone, neckPitch, neckYaw, 0);
    this.setRot(this.head, headPitch - neckPitch * n * 0.35, this.lookYaw * 0.4, headRoll);
    this.setRot(this.jaw, jawOpen * 0.55 * this.jawRange(), 0, 0);
    if (this.frill) {
      const open = Math.max(roar, strike, this.flinch);
      const s = 0.35 + 0.65 * open;
      this.frill.scale.set(s, s, s);
    }

    // --- the tail: a travelling wave against the hips, swinging out of turns
    const t = this.tail.length;
    for (let i = 0; i < t; i += 1) {
      const f = i / Math.max(1, t - 1);
      const wave = Math.sin(cycle - f * 1.8) * 0.07 * this.move * (0.4 + f);
      const idleWave = Math.sin(this.time * 0.9 - f * 1.4) * 0.05 * (1 - this.move) * (0.3 + f);
      let yaw = wave + idleWave - this.bend * 0.25 * (0.5 + f);
      let tPitch = Math.sin(cycle * 2 - f * 1.5) * 0.025 * this.move - pitch * 0.2 * (1 - f) - this.air * 0.06 + this.landDip * 0.05;
      if (this.attackKind === 'tail') yaw += variant * (-wind * 0.12 + strike * 0.45) * (0.4 + f);
      if (this.attackKind === 'stomp') tPitch += wind * 0.08;
      tPitch += roar * 0.03;
      this.setRot(this.tail[i]!, tPitch, yaw, 0);
    }

    // --- the arms (bipeds): tucked, swinging, raking
    for (const arm of this.arms) {
      const lead = arm.chain.side * variant;
      let upperPitch = Math.sin(cycle + (arm.chain.side > 0 ? Math.PI : 0)) * 0.12 * this.move;
      let lowerPitch = -0.1 - this.air * 0.3;
      if (this.attackKind === 'claws') {
        const reach = lead > 0 ? 1 : 0.55;
        upperPitch += (-wind * 1.1 + strike * 1.5) * reach;
        lowerPitch += (-wind * 0.6 + strike * 0.4) * reach;
      } else if (attacking) {
        upperPitch += strike * 0.35;
      }
      upperPitch -= roar * 0.4 + this.flinch * 0.3;
      this.setRot(arm.bones[0]!, upperPitch, 0, arm.chain.side * (0.05 + strike * 0.15));
      this.setRot(arm.bones[1]!, lowerPitch, 0, 0);
      this.setRot(arm.bones[2]!, -0.1 + strike * 0.3, 0, 0);
    }

    // --- the legs: planted by IK
    const mesh = this.dino.mesh;
    mesh.updateMatrixWorld(true);
    M.copy(mesh.matrixWorld).invert();
    const stanceShare = 0.62 - 0.24 * this.run;
    const lift = this.hip * (0.1 + 0.12 * this.run);
    for (const leg of this.legs) {
      const target = V1.copy(leg.home);
      if (!dead) {
        const p = (this.phase + leg.phaseOffset) % 1;
        let z: number;
        let up = 0;
        if (p < stanceShare) {
          z = this.stride * (0.5 - p / stanceShare);
        } else {
          const s = (p - stanceShare) / (1 - stanceShare);
          z = this.stride * (-0.5 + smooth(s));
          up = Math.sin(s * Math.PI) * lift;
        }
        target.z += z * this.move;
        target.y += up * this.move;
        // The body's lunge leaves the feet where they stood.
        // Airborne: hind legs tuck up and forward, fore legs fold.
        target.y += this.air * this.hip * (leg.hind ? 0.32 : 0.18);
        target.z += this.air * this.hip * (leg.hind ? 0.1 : -0.05);
        // Gallimimus kick: the lead leg lashes forward.
        if (this.attackKind === 'kick' && leg.hind && leg.chain.side * variant > 0) {
          target.z += strike * this.hip * 0.7;
          target.y += strike * this.hip * 0.45;
        }
        // A sauropod rears: the front feet leave the ground, then stamp.
        if (this.attackKind === 'stomp' && !leg.hind) target.y += wind * this.hip * 0.55;
        if (this.landDip > 0) target.z += 0;
      } else {
        // Dead: the legs go stiff, splayed from the body.
        target.y += this.hip * 0.25;
        target.z += leg.hind ? this.hip * 0.25 : this.hip * 0.1;
      }
      this.solveLeg(leg, target, dead ? 0 : this.move);
    }

    // --- death: the fall, applied to the whole body
    if (dead) {
      const td = m.deathTime;
      const stagger = bump(td, 0, 0.35);
      const fall = smooth((td - 0.2) / (DEATH_FALL_SECONDS - 0.2));
      const width = this.hip * 0.42;
      const angle = fall * 1.35 + Math.sin(clamp((td - DEATH_FALL_SECONDS) * 6, 0, Math.PI)) * 0.05;
      mesh.rotation.set(-stagger * 0.08, 0, angle);
      mesh.position.set(Math.sin(angle) * width * 0.6, -fall * this.hip * 0.18, 0);
      // Head and tail slump; the jaw falls open.
      for (const bone of this.neck) this.setRot(bone, fall * 0.28, fall * 0.15, 0);
      this.setRot(this.head, fall * 0.2, 0, 0);
      this.setRot(this.jaw, (stagger * 0.8 + fall * 0.4) * 0.55 * this.jawRange(), 0, 0);
      for (let i = 0; i < this.tail.length; i += 1) this.setRot(this.tail[i]!, fall * 0.06, fall * 0.05, 0);
    } else if (mesh.rotation.z !== 0 || mesh.position.y !== 0) {
      mesh.rotation.set(0, 0, 0);
      mesh.position.set(0, 0, 0);
    }
  }

  private jawRange(): number {
    const kind = this.dino.asset.spec.head.kind;
    return kind === 'croc' ? 1.1 : kind === 'tyrant' ? 1.0 : kind === 'beak' || kind === 'duck' || kind === 'ceratopsian' ? 0.6 : 0.9;
  }

  private setRot(bone: Bone, x: number, y: number, z: number): void {
    E.set(x, y, z, 'YXZ');
    bone.quaternion.setFromEuler(E);
  }

  /** Two-bone IK to the ankle (or wrist), the metatarsus to the ball, the toe flat. */
  private solveLeg(leg: LegRig, target: Vector3, moving: number): void {
    // The limb root's parent orientation, in mesh space.
    Q.identity();
    for (const bone of leg.parents) Q.multiply(bone.quaternion);
    // The socket, in mesh space: the parent chain's transform of the bind offset.
    const socket = V2.copy(leg.chain.joints[0]!);
    this.meshSpacePosition(leg.bones[0]!, socket);

    let ankle: Vector3;
    if (leg.hind) {
      // Toe-off steepens the metatarsus as the foot lifts.
      const meta = V3.copy(leg.metaDir);
      ankle = target.clone().addScaledVector(meta, -leg.lengths[2]!);
    } else {
      ankle = target.clone();
    }
    solveTwoBone(socket, ankle, leg.lengths[0]!, leg.lengths[1]!, leg.pole, KNEE);

    // Aim each bone at its child, parent frame first.
    const aim = (index: number, from: Vector3, to: Vector3): void => {
      const dir = V1.subVectors(to, from).normalize();
      Q2.copy(Q).invert();
      dir.applyQuaternion(Q2);
      const bone = leg.bones[index]!;
      bone.quaternion.setFromUnitVectors(leg.rest[index]!, dir);
      Q.multiply(bone.quaternion);
    };
    const kneePos = KNEE.clone();
    aim(0, socket, kneePos);
    // The shin reaches the ankle actually reachable from the knee.
    const reached = kneePos.clone().add(new Vector3().subVectors(ankle, kneePos).normalize().multiplyScalar(leg.lengths[1]!));
    aim(1, kneePos, reached);
    if (leg.hind) {
      const ball = reached.clone().addScaledVector(leg.metaDir, leg.lengths[2]!);
      aim(2, reached, ball);
      // The toes lie flat, curling a little as the foot swings.
      const toeTarget = ball.clone().add(new Vector3(0, -0.02 - moving * 0.02, 1).normalize().multiplyScalar(leg.lengths[3]!));
      toeTarget.y = Math.min(toeTarget.y, ball.y);
      aim(3, ball, toeTarget);
    } else {
      // The hand/foot points down to the ground.
      aim(2, reached, reached.clone().add(new Vector3(0, -1, 0.15).normalize().multiplyScalar(leg.lengths[2]!)));
    }
  }

  /** A bone's head in mesh space, written into `out`. */
  private meshSpacePosition(bone: Bone, out: Vector3): Vector3 {
    bone.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(bone.matrixWorld);
    this.dino.mesh.updateWorldMatrix(true, false);
    M.copy(this.dino.mesh.matrixWorld).invert();
    return out.applyMatrix4(M);
  }
}
