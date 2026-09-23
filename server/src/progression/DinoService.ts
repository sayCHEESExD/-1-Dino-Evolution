import { DINO_PADS, dinoBySlot, ownsDino, type DinoTier } from '@dino/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';
import { wallet } from './Wallet.js';

export type DinoResult =
  | { readonly ok: true; readonly action: 'bought' | 'equipped'; readonly tier: DinoTier }
  | { readonly ok: false; readonly reason: 'unknown' | 'not-on-pad' | 'too-few-wins' | 'already-ridden'; readonly tier?: DinoTier };

/** Slack on the pad footprint, for the latency between the client's step and the server's. */
const PAD_SLACK = 1.4;

/**
 * Server authority over the Evolution Paddock and the Dinos menu.
 *
 * Stepping onto a pad is a REQUEST: the server checks the player is standing on
 * that pad by its own simulated position. The menu asks the same thing without
 * the position. Either way the server either BUYS the dinosaur (the Wins are
 * spent through the wallet, then it is owned and ridden) or, if already owned,
 * rides it. Damage per attack, collision size and reach follow at once.
 */
export class DinoService {
  pad(player: PlayerState, slotRaw: unknown, progression: ProgressionService): DinoResult {
    const slot = Math.floor(Number(slotRaw));
    const pad = DINO_PADS.find((entry) => entry.slot === slot);
    if (!dinoBySlot(slot) || !pad) return { ok: false, reason: 'unknown' };
    const half = pad.half + PAD_SLACK;
    if (Math.abs(player.x - pad.x) > half || Math.abs(player.z - pad.z) > half || Math.abs(player.y - pad.y) > 1.6) {
      return { ok: false, reason: 'not-on-pad', tier: dinoBySlot(slot) };
    }
    return this.select(player, slot, progression);
  }

  select(player: PlayerState, slotRaw: unknown, progression: ProgressionService): DinoResult {
    const slot = Math.floor(Number(slotRaw));
    const tier = dinoBySlot(slot);
    if (!tier) return { ok: false, reason: 'unknown' };

    if (ownsDino(player.ownedDinos, slot)) {
      if (player.dinoSlot === slot) return { ok: false, reason: 'already-ridden', tier };
      player.dinoSlot = slot;
      progression.syncDerived(player);
      return { ok: true, action: 'equipped', tier };
    }

    if (!wallet.spend(player, tier.cost)) return { ok: false, reason: 'too-few-wins', tier };
    player.ownedDinos |= 1 << (slot - 1);
    player.dinoSlot = slot;
    progression.syncDerived(player);
    return { ok: true, action: 'bought', tier };
  }
}
