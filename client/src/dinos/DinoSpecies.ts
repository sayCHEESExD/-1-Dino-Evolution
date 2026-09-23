/**
 * THE ANATOMY OF EVERY DINOSAUR IN THE GAME, as parameters.
 *
 * A species is a body plan (biped, quadruped or sprawler), the heights and
 * lengths of its skeleton in world units (a rider is 3.2 tall), the
 * cross-sections of its body, a skull type, and a list of anatomical features
 * - sails, plates, frills, horns, crests, quills, clubs. `DinoBlocks` turns
 * one of these into a single skinned mesh on a real bone chain, and
 * `DinoAnimator` walks, bites, jumps and dies with it.
 *
 * Positions along the back use one coordinate, `b`:
 *   -1 = the tail tip, 0 = the hips, 1 = the shoulders, 2 = the head.
 */
export type Stance = 'biped' | 'quad' | 'sprawl';

export type HeadKind =
  | 'theropod'
  | 'raptor'
  | 'tyrant'
  | 'abelisaur'
  | 'croc'
  | 'beak'
  | 'duck'
  | 'ceratopsian'
  | 'dome'
  | 'armored'
  | 'sauropod'
  | 'stego';

export type AttackKind = 'bite' | 'claws' | 'kick' | 'headbutt' | 'horns' | 'tail' | 'stomp';

export interface Section {
  /** Half-width. */
  readonly w: number;
  /** Height above the centreline (the back). */
  readonly hTop: number;
  /** Depth below the centreline (the belly). */
  readonly hBot: number;
}

export type Feature =
  | { readonly kind: 'sail'; readonly from: number; readonly to: number; readonly height: number }
  | { readonly kind: 'ridge'; readonly from: number; readonly to: number; readonly height: number }
  | { readonly kind: 'plates'; readonly from: number; readonly to: number; readonly count: number; readonly height: number }
  | { readonly kind: 'thagomizer'; readonly length: number }
  | { readonly kind: 'scutes'; readonly from: number; readonly to: number; readonly rows: number; readonly count: number; readonly size: number }
  | { readonly kind: 'sideSpikes'; readonly from: number; readonly to: number; readonly count: number; readonly length: number }
  | { readonly kind: 'shoulderSpikes'; readonly length: number }
  | { readonly kind: 'club'; readonly size: number }
  | { readonly kind: 'quills'; readonly from: number; readonly to: number; readonly count: number; readonly length: number }
  | { readonly kind: 'feathers'; readonly arms: boolean; readonly tail: boolean; readonly back: boolean; readonly length: number }
  | { readonly kind: 'browHorns'; readonly length: number; readonly spread: number; readonly forward: number }
  | { readonly kind: 'noseHorn'; readonly length: number }
  | { readonly kind: 'frill'; readonly size: number; readonly spikes: number; readonly hooks: number }
  | { readonly kind: 'tubeCrest'; readonly length: number }
  | { readonly kind: 'twinCrest'; readonly height: number }
  | { readonly kind: 'monoCrest'; readonly height: number }
  | { readonly kind: 'dome'; readonly size: number; readonly spikes: number }
  | { readonly kind: 'neckFrill'; readonly size: number }
  | { readonly kind: 'browBumps'; readonly size: number }
  | { readonly kind: 'collar' };

export interface SpeciesSpec {
  readonly stance: Stance;
  /** Hip joint height above the ground. */
  readonly hip: number;
  /** Quadrupeds and sprawlers: shoulder joint height. */
  readonly shoulder?: number;
  /** Hip-to-shoulder distance along the back. */
  readonly torso: number;
  /** Rise of the back from hips to shoulders, radians (+ = shoulders higher). */
  readonly torsoPitch: number;
  readonly rump: Section;
  readonly belly: Section;
  readonly chest: Section;
  readonly neck: {
    readonly length: number;
    readonly segments: number;
    /** Angle of the neck's base above horizontal. */
    readonly pitch: number;
    /** How much the angle relaxes toward the head (0 straight, 1 fully level). */
    readonly bend: number;
    readonly base: Section;
    readonly top: Section;
  };
  readonly tail: {
    readonly length: number;
    readonly segments: number;
    /** Angle below horizontal at the base (+ = droops). */
    readonly droop: number;
    /** Curve back up toward the tip (radians over the length). */
    readonly lift: number;
    readonly base: Section;
    /** Tip radius. */
    readonly tip: number;
  };
  readonly head: {
    readonly kind: HeadKind;
    readonly length: number;
    readonly height: number;
    readonly width: number;
    /** Nose-down angle of the skull, radians. */
    readonly pitch: number;
    /** Teeth per side, top and bottom (0 = beaked). */
    readonly teeth: number;
    readonly toothSize: number;
    readonly eye: number;
  };
  readonly legs: {
    /** Hip socket half-spacing. */
    readonly spread: number;
    readonly thigh: number;
    readonly shin: number;
    readonly foot: number;
    /** Toe length. */
    readonly toe: number;
    readonly toes: number;
    readonly claw: number;
    /** Raptors' raised killing claw. */
    readonly sickle?: number;
    /** Columnar, elephantine legs (quadrupeds and sauropods). */
    readonly column?: boolean;
  };
  /** Bipeds: the arms. */
  readonly arms?: {
    readonly length: number;
    readonly thick: number;
    readonly fingers: number;
    readonly claw: number;
    /** 0 folded against the chest .. 1 reaching forward. */
    readonly reach: number;
  };
  /** Quadrupeds: the front legs. */
  readonly fore?: {
    readonly spread: number;
    readonly thick: number;
    readonly column?: boolean;
  };
  readonly features: readonly Feature[];
  readonly attack: AttackKind;
  /** Steps per second at a walk, relative: heavy animals step slower. */
  readonly cadence: number;
}

const s = (w: number, hTop: number, hBot: number): Section => ({ w, hTop, hBot });

/** A theropod template, scaled by hip height; species override what differs. */
const theropod = (hip: number, over: Partial<SpeciesSpec> & { features?: readonly Feature[] }): SpeciesSpec => {
  const k = hip;
  return {
    stance: 'biped',
    hip: k,
    torso: k * 0.78,
    torsoPitch: -0.06,
    rump: s(k * 0.2, k * 0.2, k * 0.2),
    belly: s(k * 0.24, k * 0.2, k * 0.34),
    chest: s(k * 0.2, k * 0.18, k * 0.3),
    neck: { length: k * 0.5, segments: 3, pitch: 0.75, bend: 0.8, base: s(k * 0.15, k * 0.16, k * 0.19), top: s(k * 0.11, k * 0.12, k * 0.13) },
    tail: { length: k * 1.55, segments: 7, droop: 0.12, lift: 0.1, base: s(k * 0.17, k * 0.2, k * 0.2), tip: k * 0.02 },
    head: { kind: 'theropod', length: k * 0.52, height: k * 0.3, width: k * 0.21, pitch: 0.1, teeth: 10, toothSize: k * 0.035, eye: k * 0.03 },
    legs: { spread: k * 0.17, thigh: k * 0.15, shin: k * 0.08, foot: k * 0.05, toe: k * 0.2, toes: 3, claw: k * 0.05 },
    arms: { length: k * 0.42, thick: k * 0.045, fingers: 3, claw: k * 0.06, reach: 0.4 },
    features: [],
    attack: 'bite',
    cadence: 1,
    ...over,
  };
};

const quad = (hip: number, shoulder: number, over: Partial<SpeciesSpec> & { features?: readonly Feature[] }): SpeciesSpec => {
  const k = hip;
  return {
    stance: 'quad',
    hip: k,
    shoulder,
    torso: k * 1.2,
    torsoPitch: Math.atan2(shoulder - hip, k * 1.2),
    rump: s(k * 0.32, k * 0.3, k * 0.28),
    belly: s(k * 0.42, k * 0.3, k * 0.42),
    chest: s(k * 0.34, k * 0.26, k * 0.36),
    neck: { length: k * 0.35, segments: 2, pitch: 0.15, bend: 0.4, base: s(k * 0.24, k * 0.24, k * 0.28), top: s(k * 0.18, k * 0.18, k * 0.2) },
    tail: { length: k * 1.3, segments: 6, droop: 0.2, lift: 0.1, base: s(k * 0.22, k * 0.24, k * 0.24), tip: k * 0.03 },
    head: { kind: 'ceratopsian', length: k * 0.6, height: k * 0.35, width: k * 0.3, pitch: 0.25, teeth: 0, toothSize: 0, eye: k * 0.03 },
    legs: { spread: k * 0.26, thigh: k * 0.17, shin: k * 0.12, foot: k * 0.1, toe: k * 0.08, toes: 3, claw: k * 0.03, column: true },
    fore: { spread: k * 0.3, thick: k * 0.1, column: true },
    features: [],
    attack: 'horns',
    cadence: 0.8,
    ...over,
  };
};

export const SPECIES = {
  compsognathus: theropod(1.55, {
    torso: 1.05,
    neck: { length: 0.95, segments: 3, pitch: 0.85, bend: 0.85, base: s(0.2, 0.22, 0.26), top: s(0.13, 0.14, 0.15) },
    tail: { length: 2.3, segments: 7, droop: 0.05, lift: 0.12, base: s(0.22, 0.26, 0.26), tip: 0.03 },
    head: { kind: 'raptor', length: 0.72, height: 0.36, width: 0.3, pitch: 0.08, teeth: 8, toothSize: 0.045, eye: 0.065 },
    belly: s(0.36, 0.3, 0.44),
    chest: s(0.3, 0.26, 0.38),
    rump: s(0.3, 0.3, 0.3),
    legs: { spread: 0.26, thigh: 0.22, shin: 0.11, foot: 0.07, toe: 0.36, toes: 3, claw: 0.08 },
    arms: { length: 0.6, thick: 0.07, fingers: 2, claw: 0.07, reach: 0.4 },
    cadence: 1.4,
  }),
  velociraptor: theropod(2.05, {
    torso: 1.55,
    torsoPitch: -0.02,
    neck: { length: 1.15, segments: 3, pitch: 0.95, bend: 0.9, base: s(0.26, 0.28, 0.32), top: s(0.17, 0.18, 0.19) },
    tail: { length: 3.0, segments: 7, droop: -0.02, lift: 0.02, base: s(0.27, 0.32, 0.32), tip: 0.04 },
    head: { kind: 'raptor', length: 1.05, height: 0.46, width: 0.36, pitch: 0.06, teeth: 12, toothSize: 0.05, eye: 0.06 },
    belly: s(0.46, 0.36, 0.55),
    chest: s(0.38, 0.32, 0.5),
    rump: s(0.38, 0.38, 0.36),
    legs: { spread: 0.33, thigh: 0.3, shin: 0.14, foot: 0.08, toe: 0.44, toes: 3, claw: 0.1, sickle: 0.26 },
    arms: { length: 0.95, thick: 0.09, fingers: 3, claw: 0.16, reach: 0.55 },
    attack: 'claws',
    cadence: 1.3,
  }),
  gallimimus: theropod(2.9, {
    torso: 1.6,
    torsoPitch: 0.05,
    neck: { length: 2.1, segments: 4, pitch: 1.05, bend: 0.75, base: s(0.26, 0.28, 0.32), top: s(0.15, 0.15, 0.17) },
    tail: { length: 3.1, segments: 7, droop: 0.08, lift: 0.1, base: s(0.3, 0.34, 0.34), tip: 0.04 },
    head: { kind: 'beak', length: 0.8, height: 0.36, width: 0.3, pitch: 0.18, teeth: 0, toothSize: 0, eye: 0.075 },
    belly: s(0.5, 0.42, 0.62),
    chest: s(0.42, 0.36, 0.54),
    rump: s(0.42, 0.42, 0.42),
    legs: { spread: 0.38, thigh: 0.34, shin: 0.14, foot: 0.08, toe: 0.5, toes: 3, claw: 0.07 },
    arms: { length: 1.2, thick: 0.08, fingers: 3, claw: 0.12, reach: 0.3 },
    attack: 'kick',
    cadence: 1.2,
  }),
  parasaurolophus: quad(3.2, 2.1, {
    torso: 3.3,
    rump: s(0.85, 0.85, 0.8),
    belly: s(1.0, 0.8, 1.05),
    chest: s(0.8, 0.7, 0.85),
    neck: { length: 1.9, segments: 3, pitch: 0.55, bend: 0.5, base: s(0.52, 0.55, 0.6), top: s(0.3, 0.32, 0.34) },
    tail: { length: 4.6, segments: 7, droop: 0.05, lift: 0.08, base: s(0.5, 0.72, 0.7), tip: 0.06 },
    head: { kind: 'duck', length: 1.35, height: 0.62, width: 0.5, pitch: 0.35, teeth: 0, toothSize: 0, eye: 0.085 },
    legs: { spread: 0.72, thigh: 0.6, shin: 0.3, foot: 0.18, toe: 0.38, toes: 3, claw: 0.07 },
    fore: { spread: 0.62, thick: 0.18 },
    features: [{ kind: 'tubeCrest', length: 2.0 }],
    attack: 'headbutt',
    cadence: 0.85,
  }),
  pyroraptor: theropod(2.15, {
    torso: 1.6,
    neck: { length: 1.2, segments: 3, pitch: 0.95, bend: 0.9, base: s(0.28, 0.3, 0.34), top: s(0.18, 0.19, 0.2) },
    tail: { length: 3.1, segments: 7, droop: 0.0, lift: 0.04, base: s(0.28, 0.33, 0.33), tip: 0.05 },
    head: { kind: 'raptor', length: 1.0, height: 0.46, width: 0.36, pitch: 0.06, teeth: 11, toothSize: 0.05, eye: 0.065 },
    belly: s(0.48, 0.38, 0.56),
    chest: s(0.4, 0.34, 0.5),
    rump: s(0.4, 0.4, 0.38),
    legs: { spread: 0.34, thigh: 0.31, shin: 0.14, foot: 0.08, toe: 0.44, toes: 3, claw: 0.1, sickle: 0.28 },
    arms: { length: 1.05, thick: 0.1, fingers: 3, claw: 0.16, reach: 0.55 },
    features: [{ kind: 'feathers', arms: true, tail: true, back: true, length: 0.5 }],
    attack: 'claws',
    cadence: 1.3,
  }),
  triceratops: quad(2.9, 2.4, {
    torso: 3.7,
    rump: s(1.05, 1.0, 0.95),
    belly: s(1.4, 1.1, 1.3),
    chest: s(1.1, 0.95, 1.05),
    neck: { length: 0.8, segments: 2, pitch: 0.05, bend: 0.3, base: s(0.8, 0.8, 0.9), top: s(0.62, 0.6, 0.65) },
    tail: { length: 3.4, segments: 6, droop: 0.28, lift: 0.08, base: s(0.62, 0.72, 0.7), tip: 0.07 },
    head: { kind: 'ceratopsian', length: 2.4, height: 1.25, width: 1.0, pitch: 0.42, teeth: 0, toothSize: 0, eye: 0.1 },
    legs: { spread: 0.9, thigh: 0.62, shin: 0.4, foot: 0.32, toe: 0.24, toes: 4, claw: 0.08, column: true },
    fore: { spread: 0.95, thick: 0.34, column: true },
    features: [
      { kind: 'frill', size: 1.9, spikes: 0, hooks: 0 },
      { kind: 'browHorns', length: 1.7, spread: 0.42, forward: 0.8 },
      { kind: 'noseHorn', length: 0.55 },
    ],
    attack: 'horns',
    cadence: 0.72,
  }),
  therizinosaurus: theropod(3.6, {
    torso: 2.3,
    torsoPitch: 0.34,
    rump: s(0.9, 0.85, 0.85),
    belly: s(1.2, 0.9, 1.35),
    chest: s(0.85, 0.72, 0.95),
    neck: { length: 2.7, segments: 4, pitch: 1.0, bend: 0.8, base: s(0.46, 0.5, 0.55), top: s(0.25, 0.26, 0.28) },
    tail: { length: 2.7, segments: 6, droop: 0.2, lift: 0.1, base: s(0.5, 0.6, 0.55), tip: 0.06 },
    head: { kind: 'beak', length: 0.95, height: 0.46, width: 0.4, pitch: 0.2, teeth: 0, toothSize: 0, eye: 0.08 },
    legs: { spread: 0.6, thigh: 0.56, shin: 0.26, foot: 0.16, toe: 0.55, toes: 4, claw: 0.14 },
    arms: { length: 3.1, thick: 0.22, fingers: 3, claw: 1.35, reach: 0.65 },
    features: [{ kind: 'feathers', arms: true, tail: true, back: true, length: 0.7 }],
    attack: 'claws',
    cadence: 0.8,
  }),
  spinosaurus: theropod(3.9, {
    torso: 3.7,
    torsoPitch: 0.04,
    rump: s(0.85, 0.85, 0.8),
    belly: s(1.0, 0.85, 1.15),
    chest: s(0.85, 0.75, 1.0),
    neck: { length: 2.3, segments: 3, pitch: 0.7, bend: 0.8, base: s(0.62, 0.66, 0.72), top: s(0.4, 0.42, 0.45) },
    tail: { length: 6.6, segments: 8, droop: 0.12, lift: 0.14, base: s(0.62, 0.8, 0.8), tip: 0.08 },
    head: { kind: 'croc', length: 2.9, height: 0.95, width: 0.72, pitch: 0.12, teeth: 16, toothSize: 0.12, eye: 0.09 },
    legs: { spread: 0.7, thigh: 0.66, shin: 0.3, foot: 0.18, toe: 0.7, toes: 4, claw: 0.18 },
    arms: { length: 2.2, thick: 0.2, fingers: 3, claw: 0.4, reach: 0.55 },
    features: [
      { kind: 'sail', from: -0.25, to: 1.25, height: 3.4 },
      { kind: 'monoCrest', height: 0.22 },
    ],
    cadence: 0.78,
  }),
  allosaurus: theropod(3.6, {
    torso: 2.9,
    rump: s(0.8, 0.85, 0.8),
    belly: s(0.95, 0.85, 1.15),
    chest: s(0.8, 0.75, 1.0),
    neck: { length: 1.7, segments: 3, pitch: 0.75, bend: 0.8, base: s(0.62, 0.66, 0.72), top: s(0.46, 0.46, 0.5) },
    tail: { length: 5.6, segments: 8, droop: 0.1, lift: 0.12, base: s(0.62, 0.76, 0.76), tip: 0.07 },
    head: { kind: 'theropod', length: 2.05, height: 1.12, width: 0.8, pitch: 0.1, teeth: 13, toothSize: 0.12, eye: 0.1 },
    legs: { spread: 0.66, thigh: 0.66, shin: 0.3, foot: 0.18, toe: 0.66, toes: 3, claw: 0.16 },
    arms: { length: 1.9, thick: 0.19, fingers: 3, claw: 0.32, reach: 0.45 },
    features: [
      { kind: 'browHorns', length: 0.32, spread: 0.5, forward: 0.1 },
      { kind: 'ridge', from: -0.4, to: 1.8, height: 0.12 },
    ],
    cadence: 0.85,
  }),
  ceratosaurus: theropod(3.3, {
    torso: 2.6,
    rump: s(0.72, 0.78, 0.74),
    belly: s(0.88, 0.8, 1.05),
    chest: s(0.72, 0.7, 0.92),
    neck: { length: 1.6, segments: 3, pitch: 0.78, bend: 0.8, base: s(0.56, 0.6, 0.66), top: s(0.42, 0.44, 0.46) },
    tail: { length: 5.4, segments: 8, droop: 0.1, lift: 0.14, base: s(0.54, 0.86, 0.9), tip: 0.07 },
    head: { kind: 'theropod', length: 1.95, height: 1.12, width: 0.72, pitch: 0.1, teeth: 12, toothSize: 0.14, eye: 0.095 },
    legs: { spread: 0.6, thigh: 0.6, shin: 0.28, foot: 0.17, toe: 0.6, toes: 3, claw: 0.15 },
    arms: { length: 1.3, thick: 0.16, fingers: 4, claw: 0.2, reach: 0.4 },
    features: [
      { kind: 'noseHorn', length: 0.5 },
      { kind: 'browHorns', length: 0.3, spread: 0.46, forward: 0.1 },
      { kind: 'scutes', from: -0.9, to: 1.9, rows: 1, count: 30, size: 0.16 },
    ],
    cadence: 0.88,
  }),
  tyrannosaurus: theropod(4.5, {
    torso: 3.5,
    torsoPitch: -0.04,
    rump: s(1.05, 1.05, 1.0),
    belly: s(1.3, 1.05, 1.45),
    chest: s(1.08, 0.95, 1.3),
    neck: { length: 1.65, segments: 3, pitch: 0.65, bend: 0.75, base: s(0.95, 0.95, 1.05), top: s(0.78, 0.78, 0.82) },
    tail: { length: 6.6, segments: 8, droop: 0.08, lift: 0.1, base: s(0.85, 1.0, 1.0), tip: 0.08 },
    head: { kind: 'tyrant', length: 3.0, height: 1.75, width: 1.45, pitch: 0.1, teeth: 13, toothSize: 0.2, eye: 0.12 },
    legs: { spread: 0.9, thigh: 0.92, shin: 0.42, foot: 0.24, toe: 0.82, toes: 3, claw: 0.2 },
    arms: { length: 1.05, thick: 0.17, fingers: 2, claw: 0.14, reach: 0.25 },
    features: [{ kind: 'browBumps', size: 0.22 }],
    cadence: 0.72,
  }),
  indoraptor: theropod(3.25, {
    torso: 2.4,
    torsoPitch: 0.02,
    rump: s(0.6, 0.62, 0.6),
    belly: s(0.7, 0.62, 0.82),
    chest: s(0.6, 0.55, 0.74),
    neck: { length: 1.95, segments: 3, pitch: 0.95, bend: 0.85, base: s(0.44, 0.46, 0.5), top: s(0.3, 0.32, 0.34) },
    tail: { length: 4.6, segments: 8, droop: 0.02, lift: 0.06, base: s(0.44, 0.52, 0.52), tip: 0.05 },
    head: { kind: 'raptor', length: 1.75, height: 0.8, width: 0.6, pitch: 0.06, teeth: 14, toothSize: 0.09, eye: 0.09 },
    legs: { spread: 0.52, thigh: 0.48, shin: 0.22, foot: 0.13, toe: 0.66, toes: 3, claw: 0.16, sickle: 0.38 },
    arms: { length: 2.5, thick: 0.15, fingers: 3, claw: 0.36, reach: 0.7 },
    features: [
      { kind: 'quills', from: 0.4, to: 2.0, count: 16, length: 0.42 },
      { kind: 'browBumps', size: 0.12 },
    ],
    attack: 'claws',
    cadence: 1.05,
  }),
  indominus: theropod(4.7, {
    torso: 3.7,
    torsoPitch: -0.02,
    rump: s(1.05, 1.05, 1.0),
    belly: s(1.28, 1.05, 1.45),
    chest: s(1.05, 0.95, 1.28),
    neck: { length: 1.95, segments: 3, pitch: 0.7, bend: 0.8, base: s(0.9, 0.92, 1.0), top: s(0.7, 0.72, 0.76) },
    tail: { length: 7.2, segments: 8, droop: 0.06, lift: 0.1, base: s(0.84, 1.0, 1.0), tip: 0.08 },
    head: { kind: 'tyrant', length: 3.05, height: 1.55, width: 1.25, pitch: 0.08, teeth: 15, toothSize: 0.2, eye: 0.11 },
    legs: { spread: 0.9, thigh: 0.9, shin: 0.4, foot: 0.24, toe: 0.84, toes: 3, claw: 0.22 },
    arms: { length: 2.4, thick: 0.24, fingers: 4, claw: 0.42, reach: 0.55 },
    features: [
      { kind: 'browHorns', length: 0.36, spread: 0.46, forward: 0.2 },
      { kind: 'browBumps', size: 0.2 },
      { kind: 'scutes', from: -0.5, to: 1.95, rows: 2, count: 26, size: 0.24 },
    ],
    cadence: 0.72,
  }),

  // ---------------------------------------------------------- wild species
  baryonyx: theropod(3.0, {
    torso: 2.6,
    rump: s(0.64, 0.68, 0.64),
    belly: s(0.8, 0.7, 0.95),
    chest: s(0.66, 0.62, 0.84),
    neck: { length: 1.9, segments: 3, pitch: 0.55, bend: 0.8, base: s(0.5, 0.52, 0.58), top: s(0.32, 0.34, 0.36) },
    tail: { length: 4.9, segments: 8, droop: 0.12, lift: 0.14, base: s(0.52, 0.6, 0.6), tip: 0.06 },
    head: { kind: 'croc', length: 2.1, height: 0.72, width: 0.56, pitch: 0.12, teeth: 16, toothSize: 0.09, eye: 0.075 },
    legs: { spread: 0.54, thigh: 0.54, shin: 0.25, foot: 0.15, toe: 0.55, toes: 3, claw: 0.14 },
    arms: { length: 1.9, thick: 0.18, fingers: 3, claw: 0.48, reach: 0.6 },
    features: [{ kind: 'monoCrest', height: 0.18 }, { kind: 'ridge', from: -0.2, to: 1.5, height: 0.1 }],
    cadence: 0.9,
  }),
  suchomimus: theropod(3.2, {
    torso: 2.8,
    rump: s(0.7, 0.72, 0.66),
    belly: s(0.86, 0.75, 1.0),
    chest: s(0.7, 0.65, 0.88),
    neck: { length: 2.0, segments: 3, pitch: 0.55, bend: 0.8, base: s(0.52, 0.55, 0.6), top: s(0.34, 0.36, 0.38) },
    tail: { length: 5.2, segments: 8, droop: 0.12, lift: 0.14, base: s(0.54, 0.64, 0.62), tip: 0.06 },
    head: { kind: 'croc', length: 2.3, height: 0.74, width: 0.56, pitch: 0.12, teeth: 18, toothSize: 0.09, eye: 0.075 },
    legs: { spread: 0.56, thigh: 0.56, shin: 0.26, foot: 0.15, toe: 0.58, toes: 3, claw: 0.14 },
    arms: { length: 2.0, thick: 0.18, fingers: 3, claw: 0.44, reach: 0.6 },
    features: [{ kind: 'sail', from: -0.1, to: 1.05, height: 0.9 }],
    cadence: 0.9,
  }),
  dilophosaurus: theropod(2.4, {
    torso: 1.9,
    neck: { length: 1.5, segments: 3, pitch: 0.85, bend: 0.85, base: s(0.36, 0.38, 0.42), top: s(0.24, 0.25, 0.26) },
    tail: { length: 3.8, segments: 7, droop: 0.06, lift: 0.1, base: s(0.36, 0.42, 0.42), tip: 0.05 },
    head: { kind: 'theropod', length: 1.2, height: 0.55, width: 0.42, pitch: 0.08, teeth: 12, toothSize: 0.06, eye: 0.07 },
    legs: { spread: 0.4, thigh: 0.38, shin: 0.18, foot: 0.1, toe: 0.46, toes: 3, claw: 0.1 },
    arms: { length: 1.1, thick: 0.1, fingers: 3, claw: 0.14, reach: 0.45 },
    features: [{ kind: 'twinCrest', height: 0.42 }, { kind: 'neckFrill', size: 1.0 }],
    cadence: 1.05,
  }),
  monolophosaurus: theropod(2.8, {
    torso: 2.2,
    neck: { length: 1.5, segments: 3, pitch: 0.8, bend: 0.8, base: s(0.44, 0.46, 0.5), top: s(0.3, 0.32, 0.34) },
    tail: { length: 4.4, segments: 7, droop: 0.08, lift: 0.12, base: s(0.46, 0.54, 0.54), tip: 0.06 },
    head: { kind: 'theropod', length: 1.45, height: 0.72, width: 0.52, pitch: 0.1, teeth: 12, toothSize: 0.08, eye: 0.08 },
    legs: { spread: 0.48, thigh: 0.48, shin: 0.22, foot: 0.13, toe: 0.52, toes: 3, claw: 0.12 },
    features: [{ kind: 'monoCrest', height: 0.42 }],
    cadence: 0.95,
  }),
  pachycephalosaurus: theropod(2.2, {
    torso: 1.9,
    torsoPitch: 0.0,
    rump: s(0.56, 0.58, 0.56),
    belly: s(0.72, 0.62, 0.8),
    chest: s(0.56, 0.52, 0.64),
    neck: { length: 0.95, segments: 2, pitch: 0.55, bend: 0.7, base: s(0.36, 0.38, 0.42), top: s(0.28, 0.3, 0.3) },
    tail: { length: 3.2, segments: 7, droop: 0.02, lift: 0.04, base: s(0.44, 0.5, 0.5), tip: 0.06 },
    head: { kind: 'dome', length: 0.95, height: 0.62, width: 0.52, pitch: 0.3, teeth: 0, toothSize: 0, eye: 0.07 },
    legs: { spread: 0.42, thigh: 0.42, shin: 0.2, foot: 0.12, toe: 0.4, toes: 3, claw: 0.08 },
    arms: { length: 0.7, thick: 0.1, fingers: 4, claw: 0.06, reach: 0.3 },
    features: [{ kind: 'dome', size: 0.62, spikes: 8 }],
    attack: 'headbutt',
    cadence: 1.05,
  }),
  stygimoloch: theropod(2.0, {
    torso: 1.7,
    rump: s(0.5, 0.52, 0.5),
    belly: s(0.64, 0.56, 0.72),
    chest: s(0.5, 0.48, 0.58),
    neck: { length: 0.9, segments: 2, pitch: 0.55, bend: 0.7, base: s(0.32, 0.34, 0.38), top: s(0.26, 0.28, 0.28) },
    tail: { length: 2.9, segments: 7, droop: 0.02, lift: 0.04, base: s(0.4, 0.46, 0.46), tip: 0.05 },
    head: { kind: 'dome', length: 0.85, height: 0.55, width: 0.46, pitch: 0.3, teeth: 0, toothSize: 0, eye: 0.065 },
    legs: { spread: 0.38, thigh: 0.38, shin: 0.18, foot: 0.11, toe: 0.36, toes: 3, claw: 0.07 },
    arms: { length: 0.62, thick: 0.09, fingers: 4, claw: 0.05, reach: 0.3 },
    features: [{ kind: 'dome', size: 0.5, spikes: 14 }],
    attack: 'headbutt',
    cadence: 1.1,
  }),
  ankylosaurus: quad(1.95, 1.65, {
    torso: 3.0,
    rump: s(1.3, 0.8, 0.62),
    belly: s(1.75, 0.95, 0.8),
    chest: s(1.4, 0.8, 0.7),
    neck: { length: 0.6, segments: 2, pitch: -0.05, bend: 0.3, base: s(0.62, 0.52, 0.52), top: s(0.52, 0.44, 0.44) },
    tail: { length: 3.6, segments: 7, droop: 0.05, lift: 0.05, base: s(0.55, 0.45, 0.45), tip: 0.1 },
    head: { kind: 'armored', length: 1.25, height: 0.66, width: 1.0, pitch: 0.2, teeth: 0, toothSize: 0, eye: 0.07 },
    legs: { spread: 0.95, thigh: 0.46, shin: 0.3, foot: 0.24, toe: 0.2, toes: 4, claw: 0.06, column: true },
    fore: { spread: 1.0, thick: 0.26, column: true },
    features: [
      { kind: 'scutes', from: -0.4, to: 1.3, rows: 4, count: 44, size: 0.3 },
      { kind: 'sideSpikes', from: -0.1, to: 1.1, count: 7, length: 0.55 },
      { kind: 'club', size: 0.75 },
    ],
    attack: 'tail',
    cadence: 0.8,
  }),
  stegosaurus: quad(3.4, 1.9, {
    torso: 3.3,
    rump: s(0.95, 1.0, 0.95),
    belly: s(1.1, 1.05, 1.15),
    chest: s(0.8, 0.72, 0.86),
    neck: { length: 1.3, segments: 3, pitch: -0.25, bend: 0.3, base: s(0.46, 0.46, 0.5), top: s(0.28, 0.28, 0.3) },
    tail: { length: 4.4, segments: 7, droop: 0.12, lift: 0.05, base: s(0.56, 0.66, 0.62), tip: 0.08 },
    head: { kind: 'stego', length: 0.85, height: 0.38, width: 0.34, pitch: 0.35, teeth: 0, toothSize: 0, eye: 0.06 },
    legs: { spread: 0.68, thigh: 0.56, shin: 0.36, foot: 0.26, toe: 0.2, toes: 3, claw: 0.06, column: true },
    fore: { spread: 0.62, thick: 0.24, column: true },
    features: [
      { kind: 'plates', from: -0.55, to: 1.7, count: 17, height: 1.5 },
      { kind: 'thagomizer', length: 1.0 },
    ],
    attack: 'tail',
    cadence: 0.72,
  }),
  kentrosaurus: quad(2.1, 1.35, {
    torso: 2.2,
    rump: s(0.6, 0.62, 0.6),
    belly: s(0.72, 0.66, 0.72),
    chest: s(0.52, 0.48, 0.56),
    neck: { length: 0.9, segments: 2, pitch: -0.2, bend: 0.3, base: s(0.32, 0.32, 0.34), top: s(0.2, 0.2, 0.22) },
    tail: { length: 2.9, segments: 7, droop: 0.1, lift: 0.05, base: s(0.36, 0.42, 0.4), tip: 0.06 },
    head: { kind: 'stego', length: 0.6, height: 0.28, width: 0.24, pitch: 0.35, teeth: 0, toothSize: 0, eye: 0.045 },
    legs: { spread: 0.44, thigh: 0.36, shin: 0.24, foot: 0.17, toe: 0.14, toes: 3, claw: 0.05, column: true },
    fore: { spread: 0.42, thick: 0.16, column: true },
    features: [
      { kind: 'plates', from: 0.3, to: 1.6, count: 7, height: 0.6 },
      { kind: 'quills', from: -1.0, to: 0.2, count: 8, length: 0.9 },
      { kind: 'shoulderSpikes', length: 0.9 },
    ],
    attack: 'tail',
    cadence: 0.85,
  }),
  styracosaurus: quad(2.4, 2.0, {
    torso: 3.0,
    rump: s(0.86, 0.82, 0.78),
    belly: s(1.12, 0.9, 1.05),
    chest: s(0.9, 0.78, 0.86),
    neck: { length: 0.66, segments: 2, pitch: 0.05, bend: 0.3, base: s(0.66, 0.66, 0.72), top: s(0.5, 0.5, 0.54) },
    tail: { length: 2.8, segments: 6, droop: 0.28, lift: 0.08, base: s(0.5, 0.6, 0.58), tip: 0.06 },
    head: { kind: 'ceratopsian', length: 1.9, height: 1.0, width: 0.8, pitch: 0.42, teeth: 0, toothSize: 0, eye: 0.085 },
    legs: { spread: 0.74, thigh: 0.5, shin: 0.33, foot: 0.26, toe: 0.2, toes: 4, claw: 0.07, column: true },
    fore: { spread: 0.78, thick: 0.28, column: true },
    features: [
      { kind: 'frill', size: 1.3, spikes: 6, hooks: 0 },
      { kind: 'noseHorn', length: 1.0 },
    ],
    attack: 'horns',
    cadence: 0.78,
  }),
  sinoceratops: quad(2.6, 2.2, {
    torso: 3.3,
    rump: s(0.94, 0.9, 0.84),
    belly: s(1.24, 1.0, 1.15),
    chest: s(0.98, 0.84, 0.94),
    neck: { length: 0.72, segments: 2, pitch: 0.05, bend: 0.3, base: s(0.72, 0.72, 0.8), top: s(0.56, 0.54, 0.6) },
    tail: { length: 3.0, segments: 6, droop: 0.28, lift: 0.08, base: s(0.54, 0.64, 0.62), tip: 0.06 },
    head: { kind: 'ceratopsian', length: 2.1, height: 1.1, width: 0.9, pitch: 0.42, teeth: 0, toothSize: 0, eye: 0.09 },
    legs: { spread: 0.8, thigh: 0.55, shin: 0.36, foot: 0.28, toe: 0.22, toes: 4, claw: 0.07, column: true },
    fore: { spread: 0.84, thick: 0.3, column: true },
    features: [
      { kind: 'frill', size: 1.4, spikes: 0, hooks: 10 },
      { kind: 'noseHorn', length: 0.6 },
    ],
    attack: 'horns',
    cadence: 0.76,
  }),
  protoceratops: quad(1.2, 1.0, {
    torso: 1.3,
    rump: s(0.42, 0.42, 0.4),
    belly: s(0.52, 0.46, 0.5),
    chest: s(0.42, 0.4, 0.42),
    neck: { length: 0.3, segments: 2, pitch: 0.05, bend: 0.3, base: s(0.32, 0.32, 0.34), top: s(0.26, 0.26, 0.28) },
    tail: { length: 1.4, segments: 6, droop: 0.12, lift: 0.08, base: s(0.26, 0.4, 0.34), tip: 0.04 },
    head: { kind: 'ceratopsian', length: 0.95, height: 0.52, width: 0.42, pitch: 0.4, teeth: 0, toothSize: 0, eye: 0.05 },
    legs: { spread: 0.36, thigh: 0.22, shin: 0.14, foot: 0.11, toe: 0.12, toes: 4, claw: 0.04, column: true },
    fore: { spread: 0.36, thick: 0.12, column: true },
    features: [{ kind: 'frill', size: 0.7, spikes: 0, hooks: 0 }],
    attack: 'horns',
    cadence: 1.1,
  }),
  oviraptor: theropod(1.6, {
    torso: 1.2,
    neck: { length: 1.0, segments: 3, pitch: 0.95, bend: 0.8, base: s(0.22, 0.24, 0.26), top: s(0.15, 0.16, 0.17) },
    tail: { length: 1.8, segments: 6, droop: 0.05, lift: 0.1, base: s(0.24, 0.3, 0.28), tip: 0.05 },
    head: { kind: 'beak', length: 0.52, height: 0.42, width: 0.26, pitch: 0.15, teeth: 0, toothSize: 0, eye: 0.06 },
    arms: { length: 0.8, thick: 0.07, fingers: 3, claw: 0.1, reach: 0.4 },
    features: [{ kind: 'monoCrest', height: 0.3 }, { kind: 'feathers', arms: true, tail: true, back: true, length: 0.35 }],
    cadence: 1.3,
  }),
  majungasaurus: theropod(2.9, {
    torso: 2.3,
    rump: s(0.66, 0.7, 0.66),
    belly: s(0.8, 0.72, 0.95),
    chest: s(0.66, 0.62, 0.84),
    neck: { length: 1.3, segments: 3, pitch: 0.6, bend: 0.7, base: s(0.56, 0.58, 0.64), top: s(0.46, 0.46, 0.5) },
    tail: { length: 4.6, segments: 8, droop: 0.08, lift: 0.1, base: s(0.52, 0.62, 0.62), tip: 0.06 },
    head: { kind: 'abelisaur', length: 1.35, height: 0.95, width: 0.7, pitch: 0.08, teeth: 10, toothSize: 0.09, eye: 0.08 },
    legs: { spread: 0.52, thigh: 0.52, shin: 0.24, foot: 0.14, toe: 0.52, toes: 3, claw: 0.12 },
    arms: { length: 0.55, thick: 0.09, fingers: 4, claw: 0.04, reach: 0.1 },
    features: [{ kind: 'noseHorn', length: 0.22 }, { kind: 'scutes', from: -0.4, to: 1.8, rows: 2, count: 22, size: 0.14 }],
    cadence: 0.95,
  }),
  carnotaurus: theropod(3.2, {
    torso: 2.5,
    rump: s(0.66, 0.72, 0.68),
    belly: s(0.8, 0.72, 0.95),
    chest: s(0.66, 0.62, 0.84),
    neck: { length: 1.4, segments: 3, pitch: 0.7, bend: 0.75, base: s(0.52, 0.56, 0.62), top: s(0.42, 0.44, 0.48) },
    tail: { length: 5.0, segments: 8, droop: 0.06, lift: 0.08, base: s(0.52, 0.66, 0.66), tip: 0.06 },
    head: { kind: 'abelisaur', length: 1.45, height: 1.0, width: 0.66, pitch: 0.08, teeth: 11, toothSize: 0.1, eye: 0.08 },
    legs: { spread: 0.54, thigh: 0.56, shin: 0.25, foot: 0.15, toe: 0.58, toes: 3, claw: 0.13 },
    arms: { length: 0.5, thick: 0.09, fingers: 4, claw: 0.03, reach: 0.1 },
    features: [
      { kind: 'browHorns', length: 0.55, spread: 0.46, forward: -0.35 },
      { kind: 'scutes', from: -0.5, to: 1.8, rows: 4, count: 36, size: 0.14 },
    ],
    cadence: 1.0,
  }),
  metriacanthosaurus: theropod(3.3, {
    torso: 2.7,
    rump: s(0.72, 0.76, 0.72),
    belly: s(0.86, 0.78, 1.05),
    chest: s(0.72, 0.68, 0.9),
    neck: { length: 1.6, segments: 3, pitch: 0.75, bend: 0.8, base: s(0.56, 0.6, 0.66), top: s(0.42, 0.42, 0.46) },
    tail: { length: 5.3, segments: 8, droop: 0.1, lift: 0.12, base: s(0.56, 0.72, 0.72), tip: 0.07 },
    head: { kind: 'theropod', length: 1.8, height: 1.0, width: 0.7, pitch: 0.1, teeth: 12, toothSize: 0.11, eye: 0.09 },
    legs: { spread: 0.6, thigh: 0.6, shin: 0.28, foot: 0.16, toe: 0.6, toes: 3, claw: 0.14 },
    arms: { length: 1.5, thick: 0.16, fingers: 3, claw: 0.26, reach: 0.4 },
    features: [{ kind: 'sail', from: -0.2, to: 1.1, height: 0.75 }, { kind: 'browHorns', length: 0.2, spread: 0.48, forward: 0.1 }],
    cadence: 0.9,
  }),
  carcharodontosaurus: theropod(4.4, {
    torso: 3.5,
    rump: s(0.95, 0.98, 0.92),
    belly: s(1.15, 0.98, 1.35),
    chest: s(0.95, 0.88, 1.2),
    neck: { length: 1.9, segments: 3, pitch: 0.7, bend: 0.8, base: s(0.82, 0.84, 0.92), top: s(0.6, 0.6, 0.66) },
    tail: { length: 6.8, segments: 8, droop: 0.08, lift: 0.1, base: s(0.78, 0.92, 0.92), tip: 0.08 },
    head: { kind: 'theropod', length: 3.1, height: 1.5, width: 1.05, pitch: 0.1, teeth: 16, toothSize: 0.2, eye: 0.11 },
    legs: { spread: 0.86, thigh: 0.86, shin: 0.38, foot: 0.22, toe: 0.8, toes: 3, claw: 0.2 },
    arms: { length: 1.7, thick: 0.2, fingers: 3, claw: 0.26, reach: 0.4 },
    features: [{ kind: 'ridge', from: -0.4, to: 1.9, height: 0.16 }, { kind: 'browBumps', size: 0.16 }],
    cadence: 0.72,
  }),
  giganotosaurus: theropod(4.6, {
    torso: 3.7,
    rump: s(1.0, 1.02, 0.96),
    belly: s(1.2, 1.02, 1.4),
    chest: s(1.0, 0.92, 1.25),
    neck: { length: 2.0, segments: 3, pitch: 0.7, bend: 0.8, base: s(0.85, 0.88, 0.96), top: s(0.62, 0.62, 0.68) },
    tail: { length: 7.2, segments: 8, droop: 0.08, lift: 0.1, base: s(0.8, 0.96, 0.96), tip: 0.08 },
    head: { kind: 'theropod', length: 3.3, height: 1.55, width: 1.05, pitch: 0.1, teeth: 16, toothSize: 0.21, eye: 0.11 },
    legs: { spread: 0.9, thigh: 0.9, shin: 0.4, foot: 0.23, toe: 0.84, toes: 3, claw: 0.2 },
    arms: { length: 1.6, thick: 0.2, fingers: 3, claw: 0.24, reach: 0.4 },
    features: [
      { kind: 'ridge', from: -0.5, to: 1.95, height: 0.2 },
      { kind: 'browBumps', size: 0.2 },
      { kind: 'scutes', from: 0.2, to: 1.9, rows: 2, count: 18, size: 0.18 },
    ],
    cadence: 0.7,
  }),
  nanuqsaurus: theropod(3.4, {
    torso: 2.6,
    rump: s(0.82, 0.82, 0.78),
    belly: s(1.0, 0.84, 1.15),
    chest: s(0.84, 0.76, 1.02),
    neck: { length: 1.35, segments: 3, pitch: 0.65, bend: 0.75, base: s(0.74, 0.74, 0.82), top: s(0.6, 0.6, 0.64) },
    tail: { length: 5.0, segments: 8, droop: 0.08, lift: 0.1, base: s(0.66, 0.78, 0.78), tip: 0.07 },
    head: { kind: 'tyrant', length: 2.3, height: 1.35, width: 1.1, pitch: 0.1, teeth: 12, toothSize: 0.16, eye: 0.1 },
    legs: { spread: 0.7, thigh: 0.7, shin: 0.32, foot: 0.18, toe: 0.64, toes: 3, claw: 0.16 },
    arms: { length: 0.8, thick: 0.13, fingers: 2, claw: 0.1, reach: 0.25 },
    features: [{ kind: 'feathers', arms: true, tail: true, back: true, length: 0.9 }],
    cadence: 0.8,
  }),
  atrociraptor: theropod(1.95, {
    torso: 1.5,
    neck: { length: 1.05, segments: 3, pitch: 0.95, bend: 0.9, base: s(0.26, 0.28, 0.32), top: s(0.18, 0.19, 0.2) },
    tail: { length: 2.8, segments: 7, droop: -0.02, lift: 0.02, base: s(0.26, 0.31, 0.31), tip: 0.04 },
    head: { kind: 'raptor', length: 0.86, height: 0.5, width: 0.38, pitch: 0.05, teeth: 11, toothSize: 0.055, eye: 0.06 },
    belly: s(0.45, 0.36, 0.54),
    chest: s(0.38, 0.32, 0.48),
    rump: s(0.37, 0.37, 0.35),
    legs: { spread: 0.32, thigh: 0.3, shin: 0.14, foot: 0.08, toe: 0.42, toes: 3, claw: 0.1, sickle: 0.26 },
    arms: { length: 0.95, thick: 0.09, fingers: 3, claw: 0.16, reach: 0.55 },
    attack: 'claws',
    cadence: 1.3,
  }),
  utahraptor: theropod(2.85, {
    torso: 2.1,
    neck: { length: 1.45, segments: 3, pitch: 0.9, bend: 0.9, base: s(0.38, 0.4, 0.44), top: s(0.25, 0.26, 0.28) },
    tail: { length: 3.9, segments: 7, droop: 0.0, lift: 0.03, base: s(0.38, 0.44, 0.44), tip: 0.05 },
    head: { kind: 'raptor', length: 1.35, height: 0.62, width: 0.48, pitch: 0.06, teeth: 12, toothSize: 0.07, eye: 0.075 },
    belly: s(0.62, 0.5, 0.74),
    chest: s(0.52, 0.44, 0.66),
    rump: s(0.52, 0.52, 0.5),
    legs: { spread: 0.45, thigh: 0.42, shin: 0.2, foot: 0.11, toe: 0.58, toes: 3, claw: 0.12, sickle: 0.4 },
    arms: { length: 1.35, thick: 0.12, fingers: 3, claw: 0.22, reach: 0.55 },
    features: [{ kind: 'feathers', arms: true, tail: true, back: true, length: 0.6 }],
    attack: 'claws',
    cadence: 1.15,
  }),
  scorpios: theropod(3.0, {
    torso: 2.2,
    rump: s(0.56, 0.58, 0.56),
    belly: s(0.68, 0.6, 0.8),
    chest: s(0.56, 0.52, 0.72),
    neck: { length: 1.7, segments: 3, pitch: 0.9, bend: 0.85, base: s(0.42, 0.44, 0.48), top: s(0.3, 0.3, 0.32) },
    tail: { length: 4.2, segments: 8, droop: 0.04, lift: 0.08, base: s(0.44, 0.5, 0.5), tip: 0.05 },
    head: { kind: 'raptor', length: 1.55, height: 0.78, width: 0.58, pitch: 0.06, teeth: 13, toothSize: 0.09, eye: 0.08 },
    legs: { spread: 0.5, thigh: 0.46, shin: 0.22, foot: 0.13, toe: 0.62, toes: 3, claw: 0.15, sickle: 0.34 },
    arms: { length: 2.2, thick: 0.14, fingers: 3, claw: 0.3, reach: 0.65 },
    features: [
      { kind: 'quills', from: -0.9, to: 2.0, count: 34, length: 0.62 },
      { kind: 'sideSpikes', from: -0.3, to: 1.0, count: 6, length: 0.35 },
    ],
    attack: 'claws',
    cadence: 1.05,
  }),
  dimetrodon: {
    stance: 'sprawl',
    hip: 0.95,
    shoulder: 0.9,
    torso: 1.9,
    torsoPitch: 0,
    rump: s(0.46, 0.34, 0.3),
    belly: s(0.56, 0.36, 0.38),
    chest: s(0.46, 0.32, 0.34),
    neck: { length: 0.45, segments: 2, pitch: 0.1, bend: 0.3, base: s(0.32, 0.26, 0.26), top: s(0.28, 0.24, 0.24) },
    tail: { length: 2.6, segments: 7, droop: 0.08, lift: 0.05, base: s(0.28, 0.24, 0.22), tip: 0.03 },
    head: { kind: 'theropod', length: 0.95, height: 0.52, width: 0.38, pitch: 0.05, teeth: 9, toothSize: 0.06, eye: 0.05 },
    legs: { spread: 0.46, thigh: 0.16, shin: 0.11, foot: 0.08, toe: 0.26, toes: 5, claw: 0.05 },
    fore: { spread: 0.44, thick: 0.1 },
    features: [{ kind: 'sail', from: 0.05, to: 1.0, height: 1.7 }],
    attack: 'bite',
    cadence: 1.0,
  },
  sarcosuchus: {
    stance: 'sprawl',
    hip: 1.15,
    shoulder: 1.05,
    torso: 3.2,
    torsoPitch: 0,
    rump: s(0.82, 0.5, 0.42),
    belly: s(1.0, 0.54, 0.52),
    chest: s(0.82, 0.48, 0.46),
    neck: { length: 0.8, segments: 2, pitch: 0.02, bend: 0.3, base: s(0.62, 0.42, 0.4), top: s(0.52, 0.36, 0.34) },
    tail: { length: 4.8, segments: 8, droop: 0.02, lift: 0.0, base: s(0.52, 0.46, 0.4), tip: 0.06 },
    head: { kind: 'croc', length: 3.0, height: 0.6, width: 0.66, pitch: 0.0, teeth: 20, toothSize: 0.1, eye: 0.08 },
    legs: { spread: 0.8, thigh: 0.26, shin: 0.18, foot: 0.14, toe: 0.36, toes: 4, claw: 0.07 },
    fore: { spread: 0.78, thick: 0.18 },
    features: [{ kind: 'scutes', from: -1.0, to: 1.9, rows: 4, count: 60, size: 0.18 }],
    attack: 'bite',
    cadence: 0.9,
  },
  brachiosaurus: quad(5.4, 7.2, {
    torso: 5.4,
    rump: s(1.5, 1.4, 1.4),
    belly: s(1.75, 1.5, 1.8),
    chest: s(1.5, 1.4, 1.6),
    neck: { length: 9.0, segments: 5, pitch: 1.1, bend: 0.35, base: s(1.05, 1.1, 1.2), top: s(0.42, 0.44, 0.46) },
    tail: { length: 8.4, segments: 8, droop: 0.35, lift: 0.18, base: s(0.9, 1.0, 0.95), tip: 0.08 },
    head: { kind: 'sauropod', length: 1.55, height: 0.85, width: 0.62, pitch: 0.55, teeth: 8, toothSize: 0.05, eye: 0.08 },
    legs: { spread: 1.05, thigh: 0.86, shin: 0.6, foot: 0.46, toe: 0.3, toes: 5, claw: 0.09, column: true },
    fore: { spread: 1.1, thick: 0.62, column: true },
    features: [],
    attack: 'stomp',
    cadence: 0.52,
  }),
} satisfies Record<string, SpeciesSpec>;

export type SpeciesId = keyof typeof SPECIES;
