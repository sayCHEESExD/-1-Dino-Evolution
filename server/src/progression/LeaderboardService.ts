import { LEADERBOARD_SIZE, handleFor } from '@dino/shared';
import type { LeaderEntry, LeaderboardState } from '../rooms/state/GameState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { profileStore } from './ProfileStore.js';

/** Seconds between rebuilds. A board is not a thing that needs 20 Hz. */
const REFRESH_SECONDS = 2;

interface Candidate {
  readonly handle: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly rebirths: number;
  readonly damage: number;
  readonly playtime: number;
}

/**
 * The three boards on the back wall: Top Rebirths, Top Damage (the most
 * Damage ever held - a rebirth resets the stat, never the record) and Top
 * Playtime (seconds played, ever).
 *
 * Every figure is the SERVER's, merged from stored profiles and live state,
 * the live figure winning wherever both exist. Rebuilt on a timer, not per tick.
 */
export class LeaderboardService {
  private timer = 0;

  update(delta: number, board: LeaderboardState, live: Iterable<[string, PlayerState]>, playerIds: ReadonlyMap<string, string>): boolean {
    this.timer -= delta;
    if (this.timer > 0) return false;
    this.timer = REFRESH_SECONDS;
    this.rebuild(board, live, playerIds);
    return true;
  }

  rebuild(board: LeaderboardState, live: Iterable<[string, PlayerState]>, playerIds: ReadonlyMap<string, string>): void {
    const byHandle = new Map<string, Candidate>();

    for (const [id, profile] of profileStore.entries()) {
      // A guest whose progress moved into an account ranks as the account now, not twice.
      if (profile.migratedTo) continue;
      const handle = handleFor(id);
      byHandle.set(handle, {
        handle,
        name: profile.displayName ?? '',
        avatarUrl: profile.avatarUrl ?? '',
        rebirths: profile.rebirths ?? 0,
        damage: profile.bestStrength ?? 0,
        playtime: profile.playSeconds ?? 0,
      });
    }

    for (const [sessionId, player] of live) {
      const id = playerIds.get(sessionId);
      if (!id) continue;
      const handle = handleFor(id);
      byHandle.set(handle, {
        handle,
        name: player.displayName,
        avatarUrl: player.avatarUrl,
        rebirths: player.rebirths,
        damage: player.bestStrength,
        playtime: player.playSeconds,
      });
    }

    const all = [...byHandle.values()];
    fill(board.rebirths, all, (c) => c.rebirths);
    fill(board.damage, all, (c) => c.damage);
    fill(board.playtime, all, (c) => c.playtime);
  }
}

/** Rank by one field and write the top N into a replicated array, in place. */
const fill = (into: LeaderEntry[], all: readonly Candidate[], pick: (candidate: Candidate) => number): void => {
  const ranked = all
    .filter((candidate) => pick(candidate) > 0)
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, LEADERBOARD_SIZE);

  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) {
    const entry = into[i];
    if (!entry) continue;
    const candidate = ranked[i];
    const handle = candidate ? candidate.handle : '';
    const name = candidate ? candidate.name : '';
    const avatarUrl = candidate ? candidate.avatarUrl : '';
    const value = candidate ? Math.floor(pick(candidate)) : 0;
    if (entry.handle !== handle) entry.handle = handle;
    if (entry.name !== name) entry.name = name;
    if (entry.avatarUrl !== avatarUrl) entry.avatarUrl = avatarUrl;
    if (entry.value !== value) entry.value = value;
  }
};

export const leaderboardService = new LeaderboardService();
