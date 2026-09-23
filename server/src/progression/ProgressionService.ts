import {
  COMBAT,
  JUMP_VELOCITY,
  MAX_STRENGTH,
  damageMultiplierOf,
  damagePerAttack,
  damagePerDummyHit,
  describeDamage,
  levelForXp,
  maxHealthFor,
  speedForLevel,
  xpCapFor,
  type StrengthInputs,
} from '@dino/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { logger } from '../util/logger.js';

const SCOPE = 'progression';

interface Tracker {
  /** Seconds since this player last took damage. */
  sinceHurt: number;
  loggedDamage: number;
}

/** The equipped pets' kinds, in inventory order. */
export const equippedPetIds = (player: PlayerState): number[] => {
  const ids: number[] = [];
  for (const pet of player.pets) if (pet.equipped) ids.push(pet.petId);
  return ids;
};

/** The worn item ids, one per slot (0 = empty). */
export const equippedItemIds = (player: PlayerState): number[] => {
  const ids: number[] = [];
  for (const id of player.equippedItems) ids.push(id ?? 0);
  return ids;
};

export const strengthInputsOf = (player: PlayerState): StrengthInputs => ({
  dinoSlot: player.dinoSlot,
  ownedDinos: player.ownedDinos,
  rebirths: player.rebirths,
  equippedPetIds: equippedPetIds(player),
  equippedItemIds: equippedItemIds(player),
});

/**
 * Server authority over Damage, XP, levels, health and every DERIVED stat.
 *
 * THE ONE PLACE DAMAGE AND XP ARE GRANTED, and they are granted for exactly one
 * thing: an attack the combat service accepted (rate limited, and validated
 * against its target if it named one). One attack pays the same figure to both.
 * Walking, jumping and standing about pay nothing - there is no movement credit
 * anywhere in the server.
 *
 * XP stops at the rebirth's max level; Damage keeps climbing (it is what the
 * stages are fought with).
 *
 * `syncDerived` is the one place level, damage-per-attack, the multiplier,
 * speed and max health are written. Every service that changes an input to
 * them (a dinosaur, a pet, an item, a rebirth) calls it afterwards.
 */
export class ProgressionService {
  private readonly trackers = new Map<string, Tracker>();

  initialise(player: PlayerState): void {
    this.trackers.set(player.sessionId, { sinceHurt: 99, loggedDamage: -1 });
    this.syncDerived(player);
    player.health = player.maxHealth;
  }

  forget(sessionId: string): void {
    this.trackers.delete(sessionId);
  }

  /** Credit one accepted attack. `dummyMult` > 0 on a training dummy. Returns the Damage paid. */
  creditAttack(player: PlayerState, dummyMult: number): number {
    const inputs = strengthInputsOf(player);
    const gain = dummyMult > 0 ? damagePerDummyHit(inputs, dummyMult) : damagePerAttack(inputs);
    const before = player.strength;
    player.strength = Math.min(MAX_STRENGTH, before + gain);
    if (player.strength > player.bestStrength) player.bestStrength = player.strength;
    // XP: the same figure, up to exactly the rebirth's max level and no further.
    const cap = xpCapFor(player.rebirths);
    if (player.xp < cap) player.xp = Math.min(cap, player.xp + gain);
    const paid = player.strength - before;
    this.syncLevel(player);
    return paid;
  }

  /** Take damage. Returns true when the player was defeated by it. */
  hurt(player: PlayerState, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || player.health <= 0) return false;
    player.health = Math.max(0, player.health - amount);
    const tracker = this.trackers.get(player.sessionId);
    if (tracker) tracker.sinceHurt = 0;
    return player.health <= 0;
  }

  /** Restore full health (a respawn). */
  heal(player: PlayerState): void {
    player.health = player.maxHealth;
  }

  /** Regenerate health a little while nothing is hurting the player. */
  tick(delta: number, player: PlayerState): void {
    const tracker = this.trackers.get(player.sessionId);
    if (!tracker) return;
    tracker.sinceHurt += delta;
    if (tracker.sinceHurt < COMBAT.regenDelay || player.health >= player.maxHealth || player.health <= 0) return;
    player.health = Math.min(player.maxHealth, player.health + player.maxHealth * COMBAT.regenRate * delta);
  }

  /** Level and speed follow XP; max health follows Damage, keeping its fraction as the cap grows. */
  private syncLevel(player: PlayerState): void {
    const level = levelForXp(player.xp, player.rebirths).level;
    if (player.level !== level) player.level = level;
    const speed = speedForLevel(level);
    if (player.moveSpeed !== speed) player.moveSpeed = speed;
    const max = maxHealthFor(player.strength);
    if (max !== player.maxHealth) {
      const fraction = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
      player.maxHealth = max;
      player.health = Math.min(max, Math.max(player.health, max * fraction));
    }
  }

  /**
   * Re-derive every figure that follows from the player's own server state.
   * THE ONLY WRITER of those fields.
   */
  syncDerived(player: PlayerState): void {
    const inputs = strengthInputsOf(player);
    // A restored or rebirthed XP above the cap is trimmed to it.
    const cap = xpCapFor(player.rebirths);
    if (player.xp > cap) player.xp = cap;
    player.damagePerAttack = damagePerAttack(inputs);
    player.multiplier = damageMultiplierOf(inputs);
    player.jumpVelocity = JUMP_VELOCITY;
    this.syncLevel(player);

    const tracker = this.trackers.get(player.sessionId);
    if (tracker && tracker.loggedDamage !== player.damagePerAttack) {
      tracker.loggedDamage = player.damagePerAttack;
      logger.info(SCOPE, `${player.sessionId} L${player.level} damage/attack: ${describeDamage(inputs)}`);
    }
  }
}
