import {
  ARENA,
  COMBAT,
  DUMMIES,
  DUMMY_TARGET_BASE,
  ENEMIES,
  ENEMY_AI,
  STAGE_COUNT,
  TRAINING_TIERS,
  arenaEndZ,
  arenaStartZ,
  canTrainOn,
  dummyMultiplier,
  hitDamageOf,
  isDummyTarget,
  riddenDino,
  stageByIndex,
  type EnemyDef,
  type ItemDef,
} from '@dino/shared';
import { EnemyState } from '../rooms/state/EnemyState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ItemService } from './ItemService.js';
import type { ProgressionService } from './ProgressionService.js';

interface SwingBucket {
  tokens: number;
  at: number;
}

export type AttackNote = 'sealed' | 'locked-dummy' | null;

export type AttackOutcome =
  | { readonly ok: false; readonly reason: 'rate' }
  | {
      readonly ok: true;
      /** Enemy id, dummy target, or -1 for an attack at thin air. */
      readonly target: number;
      /** Damage (and XP) the attack paid. */
      readonly gain: number;
      /** Hit dealt to a stage dinosaur. */
      readonly damage: number;
      readonly after: number;
      readonly killed: boolean;
      /** Why a named target was not hit, for a notice. */
      readonly note: AttackNote;
      readonly tier?: number;
    };

/** A player an enemy's attack defeated. */
export interface Defeat {
  readonly sessionId: string;
  readonly by: string;
}

/** A stage clear the room announces. */
export interface StageClear {
  readonly sessionId: string;
  readonly stage: number;
  /** True the first time this player has ever cleared it. */
  readonly firstClear: boolean;
}

/** An item a kill dropped, for the room to announce. */
export interface Drop {
  readonly sessionId: string;
  readonly item: ItemDef;
  readonly kept: boolean;
  readonly x: number;
  readonly z: number;
}

/** Seconds until an enemy's next attack, per player, per enemy id. */
type SwingClock = Map<number, number>;

/** Highest a rider may be (feet) and still hit or be hunted: a jump, not a ledge. */
const MAX_FIGHT_HEIGHT = 8;

/**
 * THE ONE PLACE A HIT IS DEALT, and the wild dinosaurs' brains.
 *
 * EVERY PLAYER FIGHTS THEIR OWN RUN. A run begins whenever a player is placed
 * at the park (join, death, claim, respawn, return, rebirth) and holds:
 *
 *   - `runStage`: the highest stage cleared this run (it opens the gates);
 *   - `killMasks`: which dinosaurs of each stage they have downed this run;
 *   - `enemies`: their own wave for the next uncleared stage.
 *
 * That wave stands at its posts until the player walks into its arena, and
 * then EVERY dinosaur of the stage hunts that player wherever they are in it.
 * Enemies attack only their owner and only their owner can hit them, so one
 * player's fight never touches another's. A downed dinosaur stays down for the
 * rest of the run.
 *
 * An attack is validated here, in this order: the rate limit, a target that
 * exists and is alive in this player's run, that they may attack it (a boss is
 * sealed until the rest of its wave is down; a dummy needs its rebirths), and
 * that it is within the RIDDEN DINOSAUR's reach of the position the SERVER
 * simulated. The hit is the player's own server-side Damage. The client never
 * supplies a figure.
 */
export class CombatService {
  private readonly buckets = new Map<string, SwingBucket>();
  private readonly clocks = new Map<string, SwingClock>();
  private readonly clears: StageClear[] = [];
  private readonly defeats: Defeat[] = [];
  private readonly drops: Drop[] = [];
  private progression: ProgressionService | null = null;
  private items: ItemService | null = null;

  /** The services enemy attacks hurt players through, and kills drop items through. */
  bind(progression: ProgressionService, items?: ItemService): void {
    this.progression = progression;
    this.items = items ?? null;
  }

  forget(sessionId: string): void {
    this.buckets.delete(sessionId);
    this.clocks.delete(sessionId);
  }

  /** Players defeated since the last call. */
  drainDefeats(): Defeat[] {
    if (this.defeats.length === 0) return [];
    const out = this.defeats.slice();
    this.defeats.length = 0;
    return out;
  }

  /** Stage clears since the last call. */
  drainClears(): StageClear[] {
    if (this.clears.length === 0) return [];
    const out = this.clears.slice();
    this.clears.length = 0;
    return out;
  }

  /** Item drops since the last call. */
  drainDrops(): Drop[] {
    if (this.drops.length === 0) return [];
    const out = this.drops.slice();
    this.drops.length = 0;
    return out;
  }

  // ------------------------------------------------------------------ runs

  /**
   * START A NEW RUN: every stage's progress wiped, the gates shut again, and a
   * fresh Stage 1 wave at its posts. Called whenever the player is placed at
   * the park - and only by the server.
   */
  resetRun(player: PlayerState): void {
    player.runStage = 0;
    for (let i = 0; i < player.killMasks.length; i += 1) if (player.killMasks[i] !== 0) player.killMasks[i] = 0;
    player.enemies.clear();
    this.clocks.delete(player.sessionId);
    this.spawnWave(player, 1);
  }

  /** Put a stage's whole wave at its posts, for this player only. */
  private spawnWave(player: PlayerState, stageIndex: number): void {
    const stage = stageByIndex(stageIndex);
    if (!stage) return;
    const clock = this.clockOf(player.sessionId);
    for (const def of stage.enemies) {
      const enemy = new EnemyState();
      enemy.id = def.id;
      enemy.x = def.x;
      enemy.z = def.z;
      enemy.yaw = Math.PI;
      enemy.hp = def.maxHp;
      player.enemies.push(enemy);
      clock.set(def.id, def.swingSeconds);
    }
  }

  private clockOf(sessionId: string): SwingClock {
    let clock = this.clocks.get(sessionId);
    if (!clock) {
      clock = new Map();
      this.clocks.set(sessionId, clock);
    }
    return clock;
  }

  private enemyOf(player: PlayerState, id: number): EnemyState | undefined {
    for (const enemy of player.enemies) if (enemy.id === id) return enemy;
    return undefined;
  }

  /** May this player hit this enemy at all? A boss waits for its wave. */
  canAttack(player: PlayerState, def: EnemyDef): boolean {
    if (!def.boss) return true;
    const stage = stageByIndex(def.stage);
    if (!stage) return false;
    const mask = player.killMasks[def.stage - 1] ?? 0;
    return (mask & stage.waveMask) === stage.waveMask;
  }

  /** The reach the server allows this player's attacks: the ridden dinosaur's, plus latency slack. */
  reachOf(player: PlayerState): number {
    return riddenDino(player.dinoSlot, player.ownedDinos).reach + COMBAT.reachSlack;
  }

  // --------------------------------------------------------------- attacks

  /**
   * One attack. `hint` is what the client says it attacked; it is only a hint.
   * Every attack that passes the rate limit PAYS: the dummy's multiplier on a
   * dummy the player has the rebirths for, the base damage on anything else -
   * one of their own dinosaurs, or thin air.
   */
  attack(sessionId: string, player: PlayerState, hint: number, progression: ProgressionService): AttackOutcome {
    if (!this.takeToken(sessionId)) return { ok: false, reason: 'rate' };

    const reach = this.reachOf(player);
    let target = this.validTarget(player, hint, reach);
    if (target === null) target = this.nearestTarget(player, reach);
    player.attackCount += 1;

    if (target !== null && isDummyTarget(target)) return this.hitDummy(player, target - DUMMY_TARGET_BASE, progression);
    if (target !== null) return this.hitEnemy(sessionId, player, target, progression);

    // An attack at thin air: it plays for everyone and pays the base damage.
    let note: AttackNote = null;
    let tier: number | undefined;
    if (Number.isFinite(hint) && hint >= 0) {
      const id = Math.floor(hint);
      if (isDummyTarget(id)) {
        tier = id - DUMMY_TARGET_BASE;
        if (TRAINING_TIERS[tier] && !canTrainOn(tier, player.rebirths)) note = 'locked-dummy';
      } else if (ENEMIES[id] && !this.canAttack(player, ENEMIES[id]!)) {
        note = 'sealed';
      }
    }
    const gain = progression.creditAttack(player, 0);
    return { ok: true, target: -1, gain, damage: 0, after: 0, killed: false, note, tier };
  }

  private hitEnemy(sessionId: string, player: PlayerState, id: number, progression: ProgressionService): AttackOutcome {
    const def = ENEMIES[id]!;
    const enemy = this.enemyOf(player, id)!;
    player.attackYaw = Math.atan2(enemy.x - player.x, enemy.z - player.z);
    // Damage is how hard you hit: the hit is the Damage held BEFORE this attack pays.
    const damage = hitDamageOf(player.strength);
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hits = (enemy.hits + 1) % 65536;
    const gain = progression.creditAttack(player, 0);

    let killed = false;
    if (enemy.hp <= 0) {
      killed = true;
      this.kill(sessionId, player, def, enemy);
    }
    return { ok: true, target: id, gain, damage, after: enemy.hp, killed, note: null };
  }

  private hitDummy(player: PlayerState, tier: number, progression: ProgressionService): AttackOutcome {
    const dummy = DUMMIES[tier]!;
    player.attackYaw = Math.atan2(dummy.x - player.x, dummy.z - player.z);
    // The requirement is re-checked here, against the server's own rebirth count.
    const multiplier = dummyMultiplier(tier, player.rebirths);
    const gain = progression.creditAttack(player, multiplier);
    return { ok: true, target: DUMMY_TARGET_BASE + tier, gain, damage: 0, after: 0, killed: false, note: null };
  }

  /**
   * A dinosaur falls - for good, this run - and may drop an item. When it
   * completes its stage the stage is CLEARED: the next gate opens (`runStage`),
   * the reward pad arms, and the next stage's wave takes its posts.
   */
  private kill(sessionId: string, player: PlayerState, def: EnemyDef, enemy: EnemyState): void {
    enemy.alive = false;
    enemy.moving = false;
    player.kills += 1;
    const drop = this.items?.dropFor(player, def);
    if (drop) this.drops.push({ sessionId, item: drop.item, kept: drop.kept, x: enemy.x, z: enemy.z });

    const stage = stageByIndex(def.stage)!;
    const index = stage.index - 1;
    const after = (player.killMasks[index] ?? 0) | (1 << def.bit);
    player.killMasks[index] = after;
    if (after !== stage.fullMask) return;

    const firstClear = stage.index > player.bestStage;
    if (firstClear) player.bestStage = stage.index;
    if (stage.index > player.runStage) player.runStage = stage.index;
    this.clears.push({ sessionId, stage: stage.index, firstClear });
    // Drop the fallen of older stages (this one's stay, for their fall), then field the next wave.
    for (let i = player.enemies.length - 1; i >= 0; i -= 1) {
      const entry = player.enemies[i]!;
      if ((ENEMIES[entry.id]?.stage ?? 0) < stage.index) player.enemies.splice(i, 1);
    }
    if (stage.index < STAGE_COUNT && !this.hasWave(player, stage.index + 1)) this.spawnWave(player, stage.index + 1);
  }

  private hasWave(player: PlayerState, stageIndex: number): boolean {
    for (const enemy of player.enemies) if (ENEMIES[enemy.id]?.stage === stageIndex) return true;
    return false;
  }

  /** The hinted target, if it is a real one this player may hit from here. */
  private validTarget(player: PlayerState, hint: number, reach: number): number | null {
    if (!Number.isFinite(hint) || hint < 0) return null;
    const id = Math.floor(hint);
    if (isDummyTarget(id)) {
      const tier = id - DUMMY_TARGET_BASE;
      const dummy = DUMMIES[tier];
      if (!dummy || !canTrainOn(tier, player.rebirths)) return null;
      return this.withinReach(player, dummy.x, dummy.z, dummy.half, reach) ? id : null;
    }
    const def = ENEMIES[id];
    const enemy = this.enemyOf(player, id);
    if (!def || !enemy || !enemy.alive || !this.canAttack(player, def)) return null;
    return this.withinReach(player, enemy.x, enemy.z, def.radius, reach) ? id : null;
  }

  /** The nearest thing this player may hit from where the server has them. */
  private nearestTarget(player: PlayerState, reach: number): number | null {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    if (Math.abs(player.y) > MAX_FIGHT_HEIGHT) return null;
    for (const enemy of player.enemies) {
      const def = ENEMIES[enemy.id];
      if (!def || !enemy.alive || !this.canAttack(player, def)) continue;
      const d = Math.hypot(enemy.x - player.x, enemy.z - player.z) - def.radius;
      if (d <= reach && d < bestDistance) {
        best = def.id;
        bestDistance = d;
      }
    }
    for (const dummy of DUMMIES) {
      if (!canTrainOn(dummy.tier, player.rebirths)) continue;
      const d = Math.hypot(dummy.x - player.x, dummy.z - player.z) - dummy.half;
      if (d <= reach && d < bestDistance) {
        best = DUMMY_TARGET_BASE + dummy.tier;
        bestDistance = d;
      }
    }
    return best;
  }

  private withinReach(player: PlayerState, x: number, z: number, radius: number, reach: number): boolean {
    if (Math.abs(player.y) > MAX_FIGHT_HEIGHT) return false;
    return Math.hypot(x - player.x, z - player.z) - radius <= reach;
  }

  private takeToken(sessionId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(sessionId);
    if (!bucket) {
      bucket = { tokens: COMBAT.burst, at: now };
      this.buckets.set(sessionId, bucket);
    }
    bucket.tokens = Math.min(COMBAT.burst, bucket.tokens + (now - bucket.at) / 1000 / COMBAT.refillSeconds);
    bucket.at = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  // ------------------------------------------------------------------ AI

  /** Advance every player's own enemies. */
  tick(delta: number, players: Iterable<PlayerState>): void {
    for (const player of players) {
      if (player.enemies.length === 0) continue;
      const clock = this.clockOf(player.sessionId);
      const bodyRadius = riddenDino(player.dinoSlot, player.ownedDinos).radius;
      for (const enemy of player.enemies) {
        if (!enemy.alive) continue;
        const def = ENEMIES[enemy.id];
        if (def) this.think(player, bodyRadius, def, enemy, clock, delta);
      }
      this.separate(player);
    }
  }

  /** True while the player stands in this stage's arena. */
  private inArena(player: PlayerState, stage: number): boolean {
    return (
      player.health > 0 &&
      player.z >= arenaStartZ(stage) &&
      player.z <= arenaEndZ(stage) &&
      Math.abs(player.x) <= ARENA.halfWidth &&
      player.y < MAX_FIGHT_HEIGHT
    );
  }

  /**
   * THE BRAIN: while the owner is in the dinosaur's arena, it hunts them -
   * wherever they are in it - and strikes when in reach. Otherwise it walks
   * back to its post and waits.
   */
  private think(player: PlayerState, bodyRadius: number, def: EnemyDef, enemy: EnemyState, clock: SwingClock, delta: number): void {
    const hunting = this.inArena(player, def.stage);
    const goalX = hunting ? player.x : def.x;
    const goalZ = hunting ? player.z : def.z;
    // Edge to edge: it stops with its jaws at the rider's dinosaur, not inside it.
    const stopAt = hunting ? ENEMY_AI.reach + def.radius + bodyRadius : 0.4;
    const dx = goalX - enemy.x;
    const dz = goalZ - enemy.z;
    const distance = Math.hypot(dx, dz);

    if (distance > stopAt) {
      const step = Math.min(def.speed * delta, distance - stopAt);
      const limit = ARENA.halfWidth - def.radius - 1;
      enemy.x = Math.max(-limit, Math.min(limit, enemy.x + (dx / distance) * step));
      enemy.z = Math.max(arenaStartZ(def.stage) + 3, Math.min(arenaEndZ(def.stage) - 3, enemy.z + (dz / distance) * step));
      enemy.yaw = Math.atan2(dx, dz);
      if (!enemy.moving) enemy.moving = true;
      // Arriving in reach, it strikes soon after: never a free first beat.
      clock.set(def.id, Math.min(clock.get(def.id) ?? def.swingSeconds, def.swingSeconds * 0.5));
      return;
    }
    if (enemy.moving) enemy.moving = false;
    if (!hunting) return;
    enemy.yaw = Math.atan2(dx, dz);
    const next = (clock.get(def.id) ?? def.swingSeconds) - delta;
    if (next > 0) {
      clock.set(def.id, next);
      return;
    }
    clock.set(def.id, def.swingSeconds);
    enemy.swings = (enemy.swings + 1) % 65536;
    this.strike(player, bodyRadius, def, enemy);
  }

  /** An attack LANDS on the owner if they are still in reach (a boss lunges further). */
  private strike(player: PlayerState, bodyRadius: number, def: EnemyDef, enemy: EnemyState): void {
    const progression = this.progression;
    if (!progression || player.health <= 0) return;
    const reach = def.radius + bodyRadius + ENEMY_AI.reach + (def.boss ? ENEMY_AI.bossLunge : 1.2);
    if (Math.hypot(player.x - enemy.x, player.z - enemy.z) > reach) return;
    if (progression.hurt(player, def.damage)) this.defeats.push({ sessionId: player.sessionId, by: def.name });
  }

  /** Keep a wave from stacking into one body: a gentle push apart. */
  private separate(player: PlayerState): void {
    const list = player.enemies;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i]!;
      if (!a.alive || !a.moving) continue;
      const da = ENEMIES[a.id]!;
      for (let j = 0; j < list.length; j += 1) {
        if (i === j) continue;
        const b = list[j]!;
        if (!b.alive) continue;
        const min = da.radius + ENEMIES[b.id]!.radius + 0.6;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-3 && d < min) {
          const push = (min - d) * 0.5;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
        }
      }
    }
  }
}
