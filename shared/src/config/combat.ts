/**
 * Attack tuning, shared so the client's attack and the server's validation
 * agree on the same numbers.
 *
 * An attack is a REQUEST. The client names what it attacked (a hint) and the
 * server decides: the rate limit first, then the target - it must exist, be
 * alive, be attackable by this player, and be within the ridden dinosaur's
 * reach of the position the SERVER simulated. With no valid target the attack
 * still happens (at thin air) and pays the base Damage. The Damage paid and the
 * hit dealt are always the server's own figures.
 */
export const COMBAT = {
  /** Seconds between two attacks the client plays. */
  attackInterval: 0.34,
  /**
   * The server's rate limit: a bucket of `burst` attacks refilled one per
   * `refillSeconds`. A touch looser than the client so network jitter never
   * eats an honest click; an auto-clicker gains nothing past it.
   */
  refillSeconds: 0.31,
  burst: 3,
  /** Extra reach the server allows for latency: the client attacks from a newer position. */
  reachSlack: 2.5,
  /** How long the fighting stance holds after the last attack, seconds. */
  stanceSeconds: 1.4,
  /** Health regained per second, as a fraction of max, after `regenDelay` seconds unhurt. */
  regenRate: 0.12,
  regenDelay: 3,
  /**
   * Seconds a defeated rider lies in the death state before the server sends
   * them home. The client's death animation (shorter than this) always finishes
   * first; in between the server refuses their movement, attacks and claims.
   */
  deathSeconds: 3,
} as const;

/** Attack targets: an enemy id, or a training dummy offset past it. */
export const DUMMY_TARGET_BASE = 1000;
export const NO_TARGET = -1;

export const dummyTarget = (tier: number): number => DUMMY_TARGET_BASE + tier;
export const isDummyTarget = (target: number): boolean => target >= DUMMY_TARGET_BASE;
