import { maxLevelFor } from './rebirth.js';

/**
 * LEVELS: bands of XP, capped by the rebirth.
 *
 * XP is earned exactly as Damage is - one accepted attack pays the same figure
 * to both - and walking pays neither. The XP a level asks for grows by x1.4575
 * per level up to Level 10 (a new player levels every minute or so), then by
 * x1.18, so a late rebirth's hundred-odd levels stay a real climb without
 * becoming impossible:
 *
 *   Level 1 -> 2:   50 XP        Level 4 -> 5:  155 XP
 *   Level 9 -> 10:  1,018 XP     Level 10 total: 3,135 XP
 *
 * XP stops at the rebirth's MAX LEVEL (`maxLevelFor`): the bar sits full and
 * the only way on is to rebirth. Every figure is deterministic and shared, so
 * the server, the HUD and the rebirth menu agree.
 */
const BASE = 50;
const EARLY_GROWTH = 1.4575;
const LATE_GROWTH = 1.18;
const JOIN_LEVEL = 10;
/** Hard ceiling, far past anything a float64 of XP can reach. */
export const MAX_LEVEL = 1000;

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number): number => {
  const l = Math.max(1, Math.floor(level));
  if (l < JOIN_LEVEL) return Math.round(BASE * EARLY_GROWTH ** (l - 1));
  const joined = BASE * EARLY_GROWTH ** (JOIN_LEVEL - 2);
  return Math.round(joined * EARLY_GROWTH * LATE_GROWTH ** (l - JOIN_LEVEL));
};

/** Total XP a player holds on first reaching `level`. */
export const xpForLevel = (level: number): number => {
  const target = Math.max(1, Math.min(Math.floor(level), MAX_LEVEL));
  let total = 0;
  for (let l = 1; l < target; l += 1) total += xpToNext(l);
  return total;
};

/** Cached totals, so a lookup is a binary search rather than a loop per frame. */
const TOTALS: number[] = (() => {
  const totals = [0, 0];
  let sum = 0;
  for (let l = 1; l < MAX_LEVEL; l += 1) {
    sum += xpToNext(l);
    totals.push(sum);
    if (!Number.isFinite(sum)) break;
  }
  return totals;
})();

const totalAt = (level: number): number => TOTALS[level] ?? Number.POSITIVE_INFINITY;

export interface LevelProgress {
  readonly level: number;
  /** XP into this level. */
  readonly into: number;
  /** XP this level asks for (0 at the cap). */
  readonly need: number;
  /** 0..1 fill for the level bar. */
  readonly fraction: number;
  /** True when the rebirth's max level has been reached. */
  readonly capped: boolean;
}

/** Resolve an XP total into a level, capped at the rebirth's max level. */
export const levelForXp = (xp: number, rebirths: number): LevelProgress => {
  const total = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const cap = Math.min(maxLevelFor(rebirths), MAX_LEVEL);
  let low = 1;
  let high = cap;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (totalAt(mid) <= total) low = mid;
    else high = mid - 1;
  }
  if (low >= cap) return { level: cap, into: 0, need: 0, fraction: 1, capped: true };
  const from = totalAt(low);
  const need = xpToNext(low);
  const into = Math.max(0, total - from);
  return { level: low, into, need, fraction: need > 0 ? Math.min(1, into / need) : 1, capped: false };
};

/** The most XP a player can hold at this rebirth count: exactly the max level. */
export const xpCapFor = (rebirths: number): number => totalAt(Math.min(maxLevelFor(rebirths), MAX_LEVEL));

/**
 * SPEED: 16 at Level 1, +1 per level (Level 4 runs at 19), up to a ceiling the
 * stages and the camera are built for. There is no sprint; Speed is the only
 * thing that makes a dinosaur faster.
 */
export const BASE_SPEED = 16;
export const SPEED_PER_LEVEL = 1;
export const MAX_SPEED = 72;

export const speedForLevel = (level: number): number =>
  Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_LEVEL * (Math.max(1, Math.floor(level)) - 1));

export const JUMP_VELOCITY = 24;

/** Largest Damage / XP total held (float64 on the wire; saturates here). */
export const MAX_STRENGTH = 1e30;
