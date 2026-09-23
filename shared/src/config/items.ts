/**
 * KILL-DROP ITEMS: what a defeated stage dinosaur may leave behind.
 *
 * Items STACK ("Bone x3"). Three are worn at once; each worn item adds its
 * `bonus` percent, and the item factor of the damage formula is
 * 1 + sum / 100. The same item may be worn more than once if the player holds
 * that many.
 *
 * Drops are rolled by the SERVER on a kill it validated (`rollDrop`, with the
 * server's own randomness): a boss always drops, a wave dinosaur sometimes. An
 * item can only drop at or past the stage it is first found in, so better
 * items come from deeper stages. A full bag loses the drop.
 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type ItemIcon =
  | 'rock'
  | 'coconut'
  | 'fishbone'
  | 'bone'
  | 'fossil'
  | 'claw'
  | 'amber'
  | 'tooth'
  | 'eggfossil'
  | 'meteorite';

export interface ItemDef {
  /** 1-based, stable. Never reuse one. */
  readonly id: number;
  readonly name: string;
  readonly rarity: ItemRarity;
  /** Damage bonus in percent, per worn copy. */
  readonly bonus: number;
  /** First stage this item can drop in. */
  readonly minStage: number;
  /** Relative drop weight among the items a stage can drop. */
  readonly weight: number;
  readonly icon: ItemIcon;
}

export const ITEMS: readonly ItemDef[] = [
  { id: 1, name: 'Rock', rarity: 'common', bonus: 5, minStage: 1, weight: 40, icon: 'rock' },
  { id: 2, name: 'Coconut', rarity: 'common', bonus: 8, minStage: 1, weight: 34, icon: 'coconut' },
  { id: 3, name: 'Fish Bone', rarity: 'uncommon', bonus: 12, minStage: 2, weight: 26, icon: 'fishbone' },
  { id: 4, name: 'Bone', rarity: 'uncommon', bonus: 18, minStage: 3, weight: 22, icon: 'bone' },
  { id: 5, name: 'Fossil', rarity: 'rare', bonus: 30, minStage: 4, weight: 16, icon: 'fossil' },
  { id: 6, name: 'Raptor Claw', rarity: 'rare', bonus: 45, minStage: 7, weight: 12, icon: 'claw' },
  { id: 7, name: 'Amber', rarity: 'epic', bonus: 75, minStage: 11, weight: 8, icon: 'amber' },
  { id: 8, name: 'T-Rex Tooth', rarity: 'epic', bonus: 110, minStage: 15, weight: 6, icon: 'tooth' },
  { id: 9, name: 'Fossil Egg', rarity: 'legendary', bonus: 180, minStage: 20, weight: 4, icon: 'eggfossil' },
  { id: 10, name: 'Meteorite Shard', rarity: 'mythic', bonus: 300, minStage: 25, weight: 2, icon: 'meteorite' },
];

export const ITEM_RARITY_COLORS: Readonly<Record<ItemRarity, string>> = {
  common: '#c9d3df',
  uncommon: '#5ed64f',
  rare: '#3fa9ff',
  epic: '#b16bff',
  legendary: '#ffb21a',
  mythic: '#ff3fa0',
};

/** Worn at once. */
export const ITEM_EQUIP_MAX = 3;
/** Most items held in total, every stack counted. */
export const ITEM_BAG_MAX = 250;
/** Chance a wave dinosaur drops something; a boss always does. */
export const WAVE_DROP_CHANCE = 0.2;

export const itemById = (id: number): ItemDef | undefined => ITEMS.find((item) => item.id === Math.floor(id));

/** Items that can drop in a stage. */
export const dropsFor = (stage: number): readonly ItemDef[] => ITEMS.filter((item) => item.minStage <= stage);

/**
 * Roll a kill's drop, with two uniforms in [0, 1) from the server. Null for
 * nothing. A boss always drops, and rolls its item twice keeping the better.
 */
export const rollDrop = (stage: number, boss: boolean, chance01: number, pick01: number, pick01b = pick01): ItemDef | null => {
  if (!boss && chance01 >= WAVE_DROP_CHANCE) return null;
  const pool = dropsFor(stage);
  if (pool.length === 0) return null;
  const pick = (u: number): ItemDef => {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let at = Math.min(Math.max(u, 0), 0.999999) * total;
    for (const item of pool) {
      if (at < item.weight) return item;
      at -= item.weight;
    }
    return pool[pool.length - 1]!;
  };
  const first = pick(pick01);
  if (!boss) return first;
  const second = pick(pick01b);
  return second.bonus > first.bonus ? second : first;
};

/** The item factor of the damage formula, from the WORN item ids (0 = empty slot). */
export const itemMultiplier = (equippedItemIds: readonly number[]): number => {
  let sum = 0;
  for (const id of equippedItemIds.slice(0, ITEM_EQUIP_MAX)) sum += itemById(id)?.bonus ?? 0;
  return 1 + sum / 100;
};
