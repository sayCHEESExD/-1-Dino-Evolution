import { dinoDamageOf } from './dinos.js';
import { itemMultiplier } from './items.js';
import { petMultiplier } from './pets.js';
import { rebirthMultiplier } from './rebirth.js';

/**
 * THE ONE DAMAGE FORMULA.
 *
 *   Damage per attack =
 *       ridden dinosaur's base damage   (Compsognathus +1 ... Indominus Rex +18,500)
 *     x rebirth multiplier              (rebirths + 1)
 *     x pet factor                      (1 + equipped pets' % / 100)
 *     x item factor                     (1 + worn items' % / 100)
 *     x training multiplier             (only on a training dummy: x1 .. x70)
 *
 * floored to a whole number, at least 1. There is no other multiplier anywhere,
 * no random roll and no hidden bonus. Every attack the SERVER accepts pays
 * exactly this, to BOTH the Damage stat and XP - on an enemy, on a dummy, or at
 * thin air - and walking pays nothing.
 *
 * DAMAGE (the big number on the HUD) is the total of every attack's pay, and a
 * hit on a stage dinosaur DEALS the attacker's current Damage: that is what a
 * stage's "Recommended Damage" is measured against.
 */
export interface StrengthInputs {
  readonly dinoSlot: number;
  readonly ownedDinos: number;
  readonly rebirths: number;
  readonly equippedPetIds: readonly number[];
  readonly equippedItemIds: readonly number[];
}

/** Every factor except the dinosaur's and the dummy's: the HUD's "Multiplier: Nx". */
export const damageMultiplierOf = (inputs: StrengthInputs): number =>
  rebirthMultiplier(inputs.rebirths) * petMultiplier(inputs.equippedPetIds) * itemMultiplier(inputs.equippedItemIds);

/** Damage one attack pays, before a dummy's multiplier. */
export const damagePerAttack = (inputs: StrengthInputs): number =>
  Math.max(1, Math.floor(dinoDamageOf(inputs.dinoSlot, inputs.ownedDinos) * damageMultiplierOf(inputs)));

/** Damage one attack on a dummy of `dummyMult` pays. */
export const damagePerDummyHit = (inputs: StrengthInputs, dummyMult: number): number =>
  Math.max(1, Math.floor(dinoDamageOf(inputs.dinoSlot, inputs.ownedDinos) * damageMultiplierOf(inputs) * Math.max(1, dummyMult)));

/** Damage one hit deals to a stage dinosaur: the attacker's total Damage. */
export const hitDamageOf = (strength: number): number => Math.max(1, Math.floor(Number.isFinite(strength) ? strength : 1));

export const describeDamage = (inputs: StrengthInputs): string =>
  `dino ${dinoDamageOf(inputs.dinoSlot, inputs.ownedDinos)} x rebirth ${rebirthMultiplier(inputs.rebirths)} x pets ${petMultiplier(inputs.equippedPetIds).toFixed(2)} x items ${itemMultiplier(inputs.equippedItemIds).toFixed(2)} = ${damagePerAttack(inputs)}`;

/** Player health: grows with Damage so a stronger rider survives stronger stages. */
export const maxHealthFor = (strength: number): number => Math.max(100, Math.floor(Math.max(0, strength) * 2));
