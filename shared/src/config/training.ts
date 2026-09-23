/**
 * THE TRAINING GROUNDS: seven carved dinosaur training dummies, right of the
 * spawn.
 *
 * Every dummy carries a DAMAGE MULTIPLIER and a REBIRTH REQUIREMENT:
 *
 *   x1  free (R0)   x2  R1   x4  R2   x8  R4   x18  R6   x45  R9   x70  R12
 *
 * An attack that lands on a dummy pays `damage per attack x multiplier` to
 * both Damage and XP. The requirement is enforced on the SERVER, per hit,
 * against the server's own rebirth count: a locked dummy refuses the hit and
 * pays nothing.
 */
export interface TrainingTier {
  /** 0-based tier, and the dummy's index. */
  readonly tier: number;
  readonly name: string;
  readonly multiplier: number;
  readonly rebirthsRequired: number;
  /** The effigy's material colour. */
  readonly color: string;
  /** Which dinosaur it is carved as (a look id). */
  readonly look: string;
  /** Material of the carving. */
  readonly material: 'wood' | 'straw' | 'stone' | 'bone' | 'iron' | 'amber' | 'obsidian';
}

export const TRAINING_TIERS: readonly TrainingTier[] = [
  { tier: 0, name: 'Log Raptor', multiplier: 1, rebirthsRequired: 0, color: '#a8743f', look: 'dummy-raptor', material: 'wood' },
  { tier: 1, name: 'Straw Triceratops', multiplier: 2, rebirthsRequired: 1, color: '#e3c56a', look: 'dummy-triceratops', material: 'straw' },
  { tier: 2, name: 'Stone Stegosaurus', multiplier: 4, rebirthsRequired: 2, color: '#a3a39a', look: 'dummy-stegosaurus', material: 'stone' },
  { tier: 3, name: 'Bone Allosaurus', multiplier: 8, rebirthsRequired: 4, color: '#efe6cf', look: 'dummy-allosaurus', material: 'bone' },
  { tier: 4, name: 'Iron Ankylosaurus', multiplier: 18, rebirthsRequired: 6, color: '#6f7780', look: 'dummy-ankylosaurus', material: 'iron' },
  { tier: 5, name: 'Amber Spinosaurus', multiplier: 45, rebirthsRequired: 9, color: '#ffae2a', look: 'dummy-spinosaurus', material: 'amber' },
  { tier: 6, name: 'Obsidian Giganotosaurus', multiplier: 70, rebirthsRequired: 12, color: '#3a2a4a', look: 'dummy-giganotosaurus', material: 'obsidian' },
];

export const trainingTier = (tier: number): TrainingTier | undefined => TRAINING_TIERS[Math.floor(tier)];

export const canTrainOn = (tier: number, rebirths: number): boolean => {
  const t = trainingTier(tier);
  return !!t && Math.floor(rebirths) >= t.rebirthsRequired;
};

/** The multiplier a dummy pays, or 0 when the player lacks the rebirths. */
export const dummyMultiplier = (tier: number, rebirths: number): number => {
  const t = trainingTier(tier);
  if (!t || Math.floor(rebirths) < t.rebirthsRequired) return 0;
  return t.multiplier;
};
