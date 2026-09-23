/**
 * PETS: hatchling dinosaurs, and the four eggs of the Hatchery they come from.
 *
 * Each egg holds six pets, one per rarity. The Normal Egg's odds are
 * 40 / 30 / 18 / 8 / 3.5 / 0.5 %, and the other eggs roll on the same ladder.
 * Hatching spends Wins and rolls on the SERVER; the client only ever asks.
 *
 * A pet's bonus is a damage percentage. The equipped pets' bonuses ADD, and the
 * pet factor of the damage formula is 1 + sum / 100 - deterministic, the same
 * figure every time for the same pets.
 *
 * Inventory: at most PET_INVENTORY_MAX owned and PET_EQUIP_MAX equipped.
 */
export type PetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface PetKind {
  /** Stable id. Never reuse one. */
  readonly id: number;
  readonly name: string;
  readonly rarity: PetRarity;
  /** Damage bonus in percent while equipped. */
  readonly bonus: number;
  /** The hatchling look the client builds (species + skin). */
  readonly look: string;
}

export interface EggKind {
  /** 1..4, and the nest order in the Hatchery. */
  readonly id: number;
  readonly name: string;
  readonly cost: number;
  /** Shell colours: base and speckle. */
  readonly color: string;
  readonly speckle: string;
  /** [petId, chance %] - the chances sum to 100. */
  readonly pool: readonly (readonly [number, number])[];
}

export const PETS: readonly PetKind[] = [
  // Normal Egg - the jungle's hatchlings.
  { id: 1, name: 'Baby Compy', rarity: 'common', bonus: 5, look: 'pet-compy' },
  { id: 2, name: 'Baby Triceratops', rarity: 'uncommon', bonus: 10, look: 'pet-triceratops' },
  { id: 3, name: 'Baby Stegosaurus', rarity: 'rare', bonus: 20, look: 'pet-stegosaurus' },
  { id: 4, name: 'Baby Parasaur', rarity: 'epic', bonus: 35, look: 'pet-parasaurolophus' },
  { id: 5, name: 'Baby Raptor', rarity: 'legendary', bonus: 60, look: 'pet-raptor' },
  { id: 6, name: 'Baby T-Rex', rarity: 'mythic', bonus: 100, look: 'pet-rex' },
  // Desert Egg.
  { id: 7, name: 'Protoceratops', rarity: 'common', bonus: 60, look: 'pet-protoceratops' },
  { id: 8, name: 'Oviraptor', rarity: 'uncommon', bonus: 90, look: 'pet-oviraptor' },
  { id: 9, name: 'Pachycephalosaurus', rarity: 'rare', bonus: 130, look: 'pet-pachy' },
  { id: 10, name: 'Velociraptor', rarity: 'epic', bonus: 190, look: 'pet-velociraptor' },
  { id: 11, name: 'Ankylosaurus', rarity: 'legendary', bonus: 280, look: 'pet-ankylosaurus' },
  { id: 12, name: 'Dilophosaurus', rarity: 'mythic', bonus: 400, look: 'pet-dilophosaurus' },
  // Dominus Egg.
  { id: 13, name: 'Dimetrodon', rarity: 'common', bonus: 350, look: 'pet-dimetrodon' },
  { id: 14, name: 'Stygimoloch', rarity: 'uncommon', bonus: 500, look: 'pet-stygimoloch' },
  { id: 15, name: 'Baryonyx', rarity: 'rare', bonus: 700, look: 'pet-baryonyx' },
  { id: 16, name: 'Carnotaurus', rarity: 'epic', bonus: 1_000, look: 'pet-carnotaurus' },
  { id: 17, name: 'Sinoceratops', rarity: 'legendary', bonus: 1_400, look: 'pet-sinoceratops' },
  { id: 18, name: 'Giganotosaurus', rarity: 'mythic', bonus: 2_000, look: 'pet-giganotosaurus' },
  // Lava Egg.
  { id: 19, name: 'Magma Compy', rarity: 'common', bonus: 1_200, look: 'pet-magmacompy' },
  { id: 20, name: 'Ember Raptor', rarity: 'uncommon', bonus: 1_700, look: 'pet-emberraptor' },
  { id: 21, name: 'Cinder Stegosaurus', rarity: 'rare', bonus: 2_400, look: 'pet-cinderstego' },
  { id: 22, name: 'Volcano Triceratops', rarity: 'epic', bonus: 3_400, look: 'pet-volcanotrike' },
  { id: 23, name: 'Inferno Spinosaurus', rarity: 'legendary', bonus: 4_800, look: 'pet-infernospino' },
  { id: 24, name: 'Obsidian Rex', rarity: 'mythic', bonus: 7_000, look: 'pet-obsidianrex' },
];

/** The six chances, by rarity order. They sum to 100. */
export const EGG_CHANCES: readonly number[] = [40, 30, 18, 8, 3.5, 0.5];

const ladder = (firstPet: number): (readonly [number, number])[] =>
  EGG_CHANCES.map((chance, index) => [firstPet + index, chance] as const);

export const EGGS: readonly EggKind[] = [
  { id: 1, name: 'Normal Egg', cost: 10, color: '#f3ecd8', speckle: '#8fa86a', pool: ladder(1) },
  { id: 2, name: 'Desert Egg', cost: 2_500, color: '#e8c48a', speckle: '#a0683a', pool: ladder(7) },
  { id: 3, name: 'Dominus Egg', cost: 25_000, color: '#3b4a6b', speckle: '#ffd23a', pool: ladder(13) },
  { id: 4, name: 'Lava Egg', cost: 300_000, color: '#2a1a14', speckle: '#ff6a1a', pool: ladder(19) },
];

export const PET_RARITY_COLORS: Readonly<Record<PetRarity, string>> = {
  common: '#c9d3df',
  uncommon: '#5ed64f',
  rare: '#3fa9ff',
  epic: '#b16bff',
  legendary: '#ffb21a',
  mythic: '#ff3fa0',
};

export const PET_INVENTORY_MAX = 100;
export const PET_EQUIP_MAX = 4;
/** Most eggs one Hatch press opens. */
export const HATCH_MULTI = 3;

export const petById = (id: number): PetKind | undefined => PETS.find((pet) => pet.id === id);
export const eggById = (id: number): EggKind | undefined => EGGS.find((egg) => egg.id === Math.floor(id));

/**
 * Roll one pet from an egg, given a uniform random number in [0, 1). The
 * randomness is supplied, so the server owns it and the roll itself is testable.
 */
export const rollEgg = (egg: EggKind, random01: number): PetKind => {
  let at = Math.min(Math.max(random01, 0), 0.999999) * 100;
  for (const [petId, chance] of egg.pool) {
    if (at < chance) return petById(petId) as PetKind;
    at -= chance;
  }
  return petById(egg.pool[egg.pool.length - 1]![0]) as PetKind;
};

/** The pet factor of the damage formula, from the EQUIPPED pets' ids. */
export const petMultiplier = (equippedPetIds: readonly number[]): number => {
  let sum = 0;
  for (const id of equippedPetIds.slice(0, PET_EQUIP_MAX)) sum += petById(id)?.bonus ?? 0;
  return 1 + sum / 100;
};
