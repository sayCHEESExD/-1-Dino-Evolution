import { canRebirth, maxLevelFor, rebirthMultiplier } from '@dino/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

export type RebirthResult =
  | { readonly ok: true; readonly rebirths: number; readonly multiplier: number; readonly maxLevel: number }
  | { readonly ok: false; readonly reason: 'not-eligible' };

/**
 * Server authority over rebirths.
 *
 * Eligibility is the server's own level: the player must stand at their max
 * level (10 x (rebirths + 1)). A rebirth resets Damage, Level (XP) and Wins -
 * and only those - for a permanently higher damage multiplier (rebirths + 1)
 * and ten more levels to climb. Dinosaurs, pets, items and the stage record are
 * kept. The client sends an empty message.
 */
export class RebirthService {
  rebirth(player: PlayerState, progression: ProgressionService): RebirthResult {
    if (!canRebirth(player.level, player.rebirths)) return { ok: false, reason: 'not-eligible' };
    player.rebirths += 1;
    player.strength = 0;
    player.xp = 0;
    player.wins = 0;
    player.maxHealth = 100;
    player.health = 100;
    progression.syncDerived(player);
    progression.heal(player);
    return {
      ok: true,
      rebirths: player.rebirths,
      multiplier: rebirthMultiplier(player.rebirths),
      maxLevel: maxLevelFor(player.rebirths),
    };
  }
}
