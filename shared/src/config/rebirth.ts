/**
 * REBIRTH: the prestige ladder.
 *
 *   maxLevel         = 10 x (rebirths + 1)      R0 -> Level 10, R1 -> 20, R2 -> 30 ...
 *   damageMultiplier = rebirths + 1             R0 -> x1, R1 -> x2, R2 -> x3 ...
 *
 * A player must reach their MAX LEVEL to rebirth. Every rebirth adds +1x damage
 * and +10 max levels, without end. A rebirth resets Damage, Level (XP) and Wins
 * - and ONLY those: dinosaurs, pets, items and the stage record are kept.
 * Eligibility is the server's own level.
 */
export const LEVELS_PER_REBIRTH = 10;

/** The highest level a player can reach at this rebirth count. */
export const maxLevelFor = (rebirths: number): number => LEVELS_PER_REBIRTH * (Math.max(0, Math.floor(rebirths)) + 1);

/** The rebirth factor of the damage formula. */
export const rebirthMultiplier = (rebirths: number): number => Math.max(0, Math.floor(rebirths)) + 1;

/** Level the NEXT rebirth needs: the current max level. */
export const rebirthRequiredLevel = (rebirths: number): number => maxLevelFor(rebirths);

export const canRebirth = (level: number, rebirths: number): boolean =>
  Math.floor(level) >= rebirthRequiredLevel(rebirths);
