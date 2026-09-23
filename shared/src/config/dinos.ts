/**
 * THE THIRTEEN RIDEABLE DINOSAURS of the Evolution Paddock, in evolution order.
 *
 * `damage` is the dinosaur's BASE DAMAGE PER ATTACK - the first factor of the
 * one damage formula (`strength.ts`). `cost` is a Wins PRICE: stepping onto the
 * dinosaur's pad (or pressing Buy in the Dinos menu) with enough Wins buys it,
 * the Wins are spent, and the player rides it. Slot 1, the Compsognathus, is
 * owned by everyone.
 *
 * `radius` is the half-width of the dinosaur's collision body, and `reach` how
 * far its attack lands from its centre: a Tyrannosaurus bites from further away
 * than a Compsognathus and cannot squeeze through the same gaps. Both are read
 * by the shared simulation and by the server's attack validation.
 *
 * `attack` names the attack the client animates; it has no gameplay weight.
 *
 * Order is the paddock order and the pad order. Never reorder: owned dinosaurs
 * are a bitmask keyed by slot.
 */
export type DinoAttack = 'bite' | 'kick' | 'headbutt' | 'horns' | 'claws';

export interface DinoTier {
  /** 1-based slot, and the pad number in the paddock. */
  readonly slot: number;
  readonly name: string;
  /** The look id the client builds (species + skin). */
  readonly look: string;
  /** Base damage gained per attack. */
  readonly damage: number;
  /** Wins price. */
  readonly cost: number;
  /** The label colour in the paddock and the menus. */
  readonly color: string;
  readonly attack: DinoAttack;
  /** Collision half-width, world units. */
  readonly radius: number;
  /** Attack reach from the dinosaur's centre to a target's edge. */
  readonly reach: number;
  /** Seated rider height above the ground, for the camera and the name plate. */
  readonly height: number;
}

export const DINOS: readonly DinoTier[] = [
  { slot: 1, name: 'Compsognathus', look: 'compy', damage: 1, cost: 0, color: '#9fe07a', attack: 'bite', radius: 0.85, reach: 4.2, height: 3.6 },
  { slot: 2, name: 'Raptor "Blue"', look: 'blue', damage: 2, cost: 5, color: '#7fb8ff', attack: 'claws', radius: 0.9, reach: 4.6, height: 4.3 },
  { slot: 3, name: 'Gallimimus', look: 'gallimimus', damage: 6, cost: 25, color: '#f2d27a', attack: 'kick', radius: 1.0, reach: 5.0, height: 5.2 },
  { slot: 4, name: 'Parasaurolophus', look: 'parasaurolophus', damage: 15, cost: 100, color: '#8fd06a', attack: 'headbutt', radius: 1.4, reach: 5.6, height: 6.2 },
  { slot: 5, name: 'Pyroraptor', look: 'pyroraptor', damage: 27, cost: 250, color: '#ff8a4a', attack: 'claws', radius: 1.0, reach: 5.0, height: 4.6 },
  { slot: 6, name: 'Triceratops', look: 'triceratops', damage: 50, cost: 500, color: '#e0b070', attack: 'horns', radius: 1.7, reach: 6.2, height: 6.3 },
  { slot: 7, name: 'Therizinosaurus', look: 'therizinosaurus', damage: 135, cost: 2_500, color: '#c9a07a', attack: 'claws', radius: 1.5, reach: 6.6, height: 7.6 },
  { slot: 8, name: 'Spinosaurus', look: 'spinosaurus', damage: 260, cost: 12_000, color: '#5fc0c8', attack: 'bite', radius: 1.9, reach: 7.4, height: 8.2 },
  { slot: 9, name: 'Allosaurus', look: 'allosaurus', damage: 825, cost: 50_000, color: '#e0925a', attack: 'bite', radius: 1.7, reach: 7.0, height: 7.4 },
  { slot: 10, name: 'Ceratosaurus', look: 'ceratosaurus', damage: 1_700, cost: 120_000, color: '#ff6a4a', attack: 'bite', radius: 1.6, reach: 6.8, height: 7.0 },
  { slot: 11, name: 'Tyrannosaurus', look: 'tyrannosaurus', damage: 3_400, cost: 500_000, color: '#d9a05a', attack: 'bite', radius: 2.1, reach: 8.0, height: 8.8 },
  { slot: 12, name: 'Indoraptor', look: 'indoraptor', damage: 9_500, cost: 2_500_000, color: '#ffd23a', attack: 'claws', radius: 1.6, reach: 7.0, height: 7.2 },
  { slot: 13, name: 'Indominus Rex', look: 'indominus', damage: 18_500, cost: 9_500_000, color: '#f4f6ff', attack: 'bite', radius: 2.3, reach: 8.6, height: 9.6 },
];

export const DINO_COUNT = DINOS.length;

/** Every dinosaur bit, for sanitising a stored mask. Slot 1 is bit 0. */
export const ALL_DINO_BITS = (1 << DINO_COUNT) - 1;

/** The Compsognathus is always owned. */
export const STARTER_DINO_BITS = 1;

export const dinoBySlot = (slot: number): DinoTier | undefined => DINOS[Math.floor(slot) - 1];

export const ownsDino = (owned: number, slot: number): boolean =>
  slot >= 1 && slot <= DINO_COUNT && ((owned | STARTER_DINO_BITS) & (1 << (slot - 1))) !== 0;

/** The ridden dinosaur; an unowned or unknown slot falls back to the Compsognathus. */
export const riddenDino = (slot: number, owned: number): DinoTier => {
  const tier = dinoBySlot(slot);
  if (!tier || !ownsDino(owned, slot)) return DINOS[0]!;
  return tier;
};

/** Base damage of the ridden dinosaur. */
export const dinoDamageOf = (slot: number, owned: number): number => riddenDino(slot, owned).damage;
