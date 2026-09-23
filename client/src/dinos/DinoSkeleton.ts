import { Vector3 } from 'three';
import type { Section, SpeciesSpec } from './DinoSpecies.js';

/**
 * THE SKELETON OF A SPECIES, in its bind pose: every bone's head position in
 * model space (the root at the ground, the animal facing +Z), and the chains
 * the builder skins and the animator drives.
 *
 * Every bone is bound with an IDENTITY rotation, so a bone's local axes are the
 * model's axes at rest: +X across the animal, +Y up, +Z forward. The animator
 * can therefore write "pitch the neck up" as a rotation about X on the neck
 * bone, and the IK can aim a thigh by the direction to its knee.
 */
export interface BoneDef {
  readonly name: string;
  readonly parent: number;
  /** Bind-pose head position, model space. */
  readonly pos: Vector3;
}

export interface LimbChain {
  /** Bone indices, root first: hind [thigh, shin, meta, toe]; fore [upper, lower, hand]. */
  readonly bones: readonly number[];
  /** Joint positions, root first, and the chain's tip last (one more than bones). */
  readonly joints: readonly Vector3[];
  /** -1 left (+X), +1 right (-X). */
  readonly side: number;
  /** True when this limb stands on the ground (every hind leg; quadrupeds' fore legs). */
  readonly walks: boolean;
}

export interface SkeletonLayout {
  readonly bones: BoneDef[];
  readonly root: number;
  readonly pelvis: number;
  readonly spine: readonly number[];
  readonly neck: readonly number[];
  readonly head: number;
  readonly jaw: number;
  /** Extra bone that opens a neck frill (Dilophosaurus), or -1. */
  readonly frill: number;
  readonly tail: readonly number[];
  readonly hind: readonly LimbChain[];
  readonly fore: readonly LimbChain[];
  /** Body centreline from the tail tip to just into the skull, with its section and bones. */
  readonly centerline: readonly CenterPoint[];
  /** The skull's frame at the head joint. */
  readonly headFrame: { readonly origin: Vector3; readonly forward: Vector3; readonly up: Vector3 };
  readonly jawHinge: Vector3;
  /** Where a rider's hips sit, and the bone they ride. */
  readonly seat: { readonly bone: number; readonly pos: Vector3 };
  /** Shoulder point on the back (b = 1) and the hip (b = 0), for features. */
  readonly hipPos: Vector3;
  readonly shoulderPos: Vector3;
  /** Total length nose to tail tip, and the highest point of the back. */
  readonly length: number;
  readonly height: number;
}

export interface CenterPoint {
  readonly pos: Vector3;
  /** Body coordinate: -1 tail tip, 0 hips, 1 shoulders, 2 head. */
  readonly b: number;
  /** The bone owning the segment that STARTS here (toward the head). */
  readonly bone: number;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** Place a knee (or elbow) for a two-bone chain from `root` to `target`, bending toward `pole`. */
export const solveTwoBone = (root: Vector3, target: Vector3, a: number, b: number, pole: Vector3, out: Vector3): Vector3 => {
  const toTarget = new Vector3().subVectors(target, root);
  let d = toTarget.length();
  const minD = Math.abs(a - b) + 1e-4;
  const maxD = a + b - 1e-4;
  d = Math.min(Math.max(d, minD), maxD);
  const u = toTarget.normalize();
  const w = pole.clone().addScaledVector(u, -pole.dot(u));
  if (w.lengthSq() < 1e-8) w.set(0, 0, 1).addScaledVector(u, -u.z);
  w.normalize();
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  return out.copy(root).addScaledVector(u, a * cosA).addScaledVector(w, a * sinA);
};

/** Interpolate a section. */
export const lerpSection = (a: Section, b: Section, t: number): Section => ({
  w: a.w + (b.w - a.w) * t,
  hTop: a.hTop + (b.hTop - a.hTop) * t,
  hBot: a.hBot + (b.hBot - a.hBot) * t,
});

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * The body's cross-section at body coordinate `b`, from the species' keyed
 * sections: the tail tapers from its base to its tip, the torso swells from the
 * rump through the belly to the chest, and the neck narrows to the head.
 */
export const sectionAt = (spec: SpeciesSpec, b: number): Section => {
  const tail = spec.tail;
  if (b <= 0) {
    // -1 tip .. 0 hip. The base blends into the rump over the last tenth.
    const t = Math.min(1, Math.max(0, b + 1));
    if (t > 0.9) return lerpSection(tail.base, spec.rump, smooth((t - 0.9) / 0.1));
    const k = t / 0.9;
    // Thick through most of its length, whipping thin only near the tip.
    const taper = Math.pow(k, 0.55);
    const tip: Section = { w: tail.tip, hTop: tail.tip, hBot: tail.tip };
    return lerpSection(tip, tail.base, taper);
  }
  if (b <= 1) {
    if (b < 0.5) return lerpSection(spec.rump, spec.belly, smooth(b / 0.5));
    return lerpSection(spec.belly, spec.chest, smooth((b - 0.5) / 0.5));
  }
  const t = Math.min(1, b - 1);
  if (t < 0.12) return lerpSection(spec.chest, spec.neck.base, smooth(t / 0.12));
  return lerpSection(spec.neck.base, spec.neck.top, smooth((t - 0.12) / 0.88));
};

export const buildSkeleton = (spec: SpeciesSpec): SkeletonLayout => {
  const bones: BoneDef[] = [];
  const add = (name: string, parent: number, pos: Vector3): number => {
    bones.push({ name, parent, pos: pos.clone() });
    return bones.length - 1;
  };

  const quadLike = spec.stance !== 'biped';
  const hipY = spec.hip;
  const pelvisPos = v(0, hipY, 0);

  // ---- the back: hips to shoulders
  let shoulderPos: Vector3;
  if (quadLike && spec.shoulder !== undefined) {
    const rise = spec.shoulder - hipY;
    const run = Math.sqrt(Math.max(0.01, spec.torso * spec.torso - rise * rise));
    shoulderPos = v(0, spec.shoulder, run);
  } else {
    shoulderPos = v(0, hipY + Math.sin(spec.torsoPitch) * spec.torso, Math.cos(spec.torsoPitch) * spec.torso);
  }
  const torsoDir = new Vector3().subVectors(shoulderPos, pelvisPos).normalize();

  const root = add('root', -1, v(0, 0, 0));
  const pelvis = add('pelvis', root, pelvisPos);
  const spine1Pos = new Vector3().lerpVectors(pelvisPos, shoulderPos, 0.42);
  const spine2Pos = new Vector3().lerpVectors(pelvisPos, shoulderPos, 0.8);
  const spine1 = add('spine1', pelvis, spine1Pos);
  const spine2 = add('spine2', spine1, spine2Pos);

  // ---- the neck: an S-curve relaxing toward the head
  const neckBones: number[] = [];
  const neckJoints: Vector3[] = [];
  let joint = shoulderPos.clone().addScaledVector(torsoDir, spec.chest.hTop * 0.2);
  const segments = Math.max(1, spec.neck.segments);
  const segLen = spec.neck.length / segments;
  let parent = spine2;
  for (let i = 0; i < segments; i += 1) {
    neckJoints.push(joint.clone());
    const bone = add(`neck${i + 1}`, parent, joint);
    neckBones.push(bone);
    parent = bone;
    const t = segments === 1 ? 0 : i / (segments - 1);
    const angle = spec.neck.pitch * (1 - spec.neck.bend * t);
    joint = joint.clone().add(v(0, Math.sin(angle) * segLen, Math.cos(angle) * segLen));
  }
  const headPos = joint.clone();
  const head = add('head', parent, headPos);
  const headForward = v(0, -Math.sin(spec.head.pitch), Math.cos(spec.head.pitch));
  const headUp = v(0, Math.cos(spec.head.pitch), Math.sin(spec.head.pitch));
  const jawHinge = headPos
    .clone()
    .addScaledVector(headForward, spec.head.length * 0.12)
    .addScaledVector(headUp, -spec.head.height * 0.2);
  const jaw = add('jaw', head, jawHinge);
  const frill = spec.features.some((f) => f.kind === 'neckFrill')
    ? add('frill', neckBones[neckBones.length - 1] ?? spine2, headPos.clone().addScaledVector(headForward, -spec.neck.length * 0.12))
    : -1;

  // ---- the tail: from just behind the hips, drooping then lifting toward the tip
  const tailBones: number[] = [];
  const tailJoints: Vector3[] = [];
  const tailCount = Math.max(2, spec.tail.segments);
  const ratio = 0.88;
  const first = (spec.tail.length * (1 - ratio)) / (1 - ratio ** tailCount);
  let tailJoint = pelvisPos.clone().add(v(0, spec.rump.hTop * 0.05, -spec.rump.w * 0.7));
  let tailParent = pelvis;
  for (let i = 0; i < tailCount; i += 1) {
    tailJoints.push(tailJoint.clone());
    const bone = add(`tail${i + 1}`, tailParent, tailJoint);
    tailBones.push(bone);
    tailParent = bone;
    const t = i / (tailCount - 1);
    const angle = spec.tail.droop - spec.tail.lift * t * 1.4;
    const len = first * ratio ** i;
    tailJoint = tailJoint.clone().add(v(0, -Math.sin(angle) * len, -Math.cos(angle) * len));
  }
  const tailTip = tailJoint.clone();

  // ---- the hind legs
  const hind: LimbChain[] = [];
  for (const side of [-1, 1]) {
    const x = -side * spec.legs.spread;
    const socket = v(x, hipY - spec.rump.hBot * 0.18, 0.02 * hipY);
    let a: number;
    let b: number;
    let c: number;
    let ball: Vector3;
    let ankle: Vector3;
    let pole: Vector3;
    if (spec.stance === 'sprawl') {
      a = hipY * 0.62;
      b = hipY * 0.72;
      c = hipY * 0.22;
      ball = v(x * 1.9, 0.04, 0.12 * hipY);
      ankle = ball.clone().add(v(0, c * 0.9, -c * 0.3));
      pole = v(x > 0 ? 1 : -1, 1.2, 0.2);
    } else if (spec.legs.column) {
      a = (socket.y - 0.02) * 0.52;
      b = (socket.y - 0.02) * 0.42;
      c = hipY * 0.11;
      ball = v(x, 0.04, 0.06 * hipY);
      ankle = ball.clone().add(v(0, c, -c * 0.12));
      pole = v(0, 0, 1);
    } else {
      a = hipY * 0.37;
      b = hipY * 0.39;
      c = hipY * 0.33;
      ball = v(x, 0.05 * hipY, 0.1 * hipY);
      ankle = ball.clone().add(v(0, c * Math.sin(1.15), -c * Math.cos(1.15)));
      pole = v(0, 0.2, 1);
    }
    const knee = solveTwoBone(socket, ankle, a, b, pole, new Vector3());
    const toeTip = ball.clone().add(v(spec.stance === 'sprawl' ? x * 0.2 : 0, -ball.y + 0.02, spec.legs.toe));
    const name = side < 0 ? 'L' : 'R';
    const thigh = add(`thigh${name}`, pelvis, socket);
    const shin = add(`shin${name}`, thigh, knee);
    const meta = add(`meta${name}`, shin, ankle);
    const toe = add(`toe${name}`, meta, ball);
    hind.push({ bones: [thigh, shin, meta, toe], joints: [socket, knee, ankle, ball, toeTip], side, walks: true });
  }

  // ---- the fore limbs: arms for bipeds, front legs for the rest
  const fore: LimbChain[] = [];
  if (spec.stance === 'biped' && spec.arms) {
    const arms = spec.arms;
    for (const side of [-1, 1]) {
      const x = -side * spec.chest.w * 0.72;
      const socket = shoulderPos.clone().add(v(x, -spec.chest.hBot * 0.42, -spec.chest.w * 0.05));
      const upperLen = arms.length * 0.44;
      const lowerLen = arms.length * 0.38;
      const handLen = arms.length * 0.18;
      const elbow = socket.clone().add(v(x * 0.08, -upperLen * 0.82, -upperLen * 0.4 + upperLen * 0.5 * arms.reach));
      const wristDir = v(0, -0.55 + arms.reach * 0.4, 0.8).normalize();
      const wrist = elbow.clone().addScaledVector(wristDir, lowerLen);
      const tip = wrist.clone().add(v(0, -handLen * 0.6, handLen * 0.8));
      const name = side < 0 ? 'L' : 'R';
      const upper = add(`upper${name}`, spine2, socket);
      const lower = add(`lower${name}`, upper, elbow);
      const hand = add(`hand${name}`, lower, wrist);
      fore.push({ bones: [upper, lower, hand], joints: [socket, elbow, wrist, tip], side, walks: false });
    }
  } else if (spec.fore) {
    const shoulderY = spec.shoulder ?? hipY;
    for (const side of [-1, 1]) {
      const x = -side * spec.fore.spread;
      const socket = shoulderPos.clone().add(v(x, -spec.chest.hBot * 0.3, 0));
      const standY = socket.y - 0.02;
      let a: number;
      let b: number;
      let hand: number;
      let wrist: Vector3;
      let pole: Vector3;
      let ground: Vector3;
      if (spec.stance === 'sprawl') {
        a = shoulderY * 0.62;
        b = shoulderY * 0.7;
        hand = shoulderY * 0.24;
        ground = v(x * 1.9, 0.03, socket.z + 0.2 * shoulderY);
        wrist = ground.clone().add(v(0, hand * 0.9, -hand * 0.2));
        pole = v(x > 0 ? 1 : -1, 1.2, -0.3);
      } else {
        hand = Math.max(0.12, standY * 0.12);
        a = (standY - hand) * 0.52;
        b = (standY - hand) * 0.52;
        ground = v(x, 0.03, socket.z + 0.05 * shoulderY);
        wrist = ground.clone().add(v(0, hand, 0));
        pole = v(0, 0, -1);
      }
      const elbow = solveTwoBone(socket, wrist, a, b, pole, new Vector3());
      const tip = ground.clone().add(v(0, 0, hand * 0.5));
      const name = side < 0 ? 'L' : 'R';
      const upper = add(`upper${name}`, spine2, socket);
      const lower = add(`lower${name}`, upper, elbow);
      const handBone = add(`hand${name}`, lower, wrist);
      fore.push({ bones: [upper, lower, handBone], joints: [socket, elbow, wrist, tip], side, walks: true });
    }
  }

  // ---- the body centreline, tail tip to head
  const centerline: CenterPoint[] = [];
  centerline.push({ pos: tailTip.clone(), b: -1, bone: tailBones[tailBones.length - 1]! });
  for (let i = tailJoints.length - 1; i >= 0; i -= 1) {
    const bone = i === 0 ? pelvis : tailBones[i - 1]!;
    // b runs -1 at the tip to 0 at the hips, by joint count.
    centerline.push({ pos: tailJoints[i]!.clone(), b: -i / tailJoints.length * 0.97 - 0.03, bone });
  }
  centerline.push({ pos: pelvisPos.clone(), b: 0, bone: pelvis });
  centerline.push({ pos: spine1Pos.clone(), b: 0.42, bone: spine1 });
  centerline.push({ pos: spine2Pos.clone(), b: 0.8, bone: spine2 });
  neckJoints.forEach((jointPos, i) => {
    centerline.push({ pos: jointPos.clone(), b: 1 + (i / segments) * 0.98 + 0.02 * (i === 0 ? 0 : 1), bone: neckBones[i]! });
  });
  centerline.push({ pos: headPos.clone(), b: 2, bone: head });

  // The seat: over the spine, on top of the back, just behind the shoulders' swell.
  const seatB = spec.stance === 'biped' ? 0.36 : 0.45;
  const seatSection = sectionAt(spec, seatB);
  const seatBase = new Vector3().lerpVectors(pelvisPos, shoulderPos, seatB);
  const seat = { bone: spine1, pos: seatBase.clone().add(v(0, seatSection.hTop * 0.96, 0)) };

  let top = 0;
  for (const point of centerline) top = Math.max(top, point.pos.y + sectionAt(spec, point.b).hTop);
  const snout = headPos.clone().addScaledVector(headForward, spec.head.length * 0.9);

  return {
    bones,
    root,
    pelvis,
    spine: [spine1, spine2],
    neck: neckBones,
    head,
    jaw,
    frill,
    tail: tailBones,
    hind,
    fore,
    centerline,
    headFrame: { origin: headPos, forward: headForward, up: headUp },
    jawHinge,
    seat,
    hipPos: pelvisPos,
    shoulderPos,
    length: snout.z - tailTip.z,
    height: Math.max(top, headPos.y + spec.head.height * 0.6),
  };
};
