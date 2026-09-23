import { ALL_DINO_BITS, DINO_COUNT, ITEM_EQUIP_MAX, STARTER_DINO_BITS, itemById, petById } from '@dino/shared';
import {
  emptyProgress,
  progressOf,
  storage,
  type MigrationFields,
  type ProfileFields,
  type ProgressFields,
  type StoredProfile,
} from '../persistence/index.js';
import { ItemStack, PetState, type PlayerState } from '../rooms/state/PlayerState.js';
import { logger } from '../util/logger.js';

const SCOPE = 'profiles';

/** How often the leaderboard cache is re-read from storage. */
const CACHE_REFRESH_MS = 30_000;

/**
 * Progression that outlives a session.
 *
 * A thin, PER-KEY front on the storage: a profile is READ FROM STORAGE AT
 * JOIN TIME, never from a cache filled at boot, because several pods share
 * one database and the boot cache of one knows nothing of what another has
 * written since. The cache here exists for exactly one reader - the
 * leaderboards, which want everyone at once - and is refreshed on a timer
 * with newer `updatedAt` winning.
 */
class ProfileStore {
  private readonly cache = new Map<string, StoredProfile>();
  private refreshTimer: NodeJS.Timeout | null = null;

  get kind(): string {
    return storage.kind;
  }

  /** Connect the store and warm the leaderboard cache. Never throws. */
  async open(): Promise<void> {
    await storage.open();
    await this.refresh();
    this.refreshTimer = setInterval(() => void this.refresh(), CACHE_REFRESH_MS);
    this.refreshTimer.unref?.();
  }

  /** Profiles known to the cache, for the boards. */
  get size(): number {
    return this.cache.size;
  }

  entries(): IterableIterator<[string, StoredProfile]> {
    return this.cache.entries();
  }

  /** The profile under a key, read from storage NOW. Throws when storage is unreachable. */
  async load(key: string): Promise<StoredProfile | null> {
    const profile = await storage.get(key);
    if (profile) this.remember(key, profile);
    return profile;
  }

  /** What a live session is worth on disk: the deriving facts and the identity. */
  snapshot(player: PlayerState): ProfileFields {
    const equipped: number[] = [];
    for (const pet of player.pets) if (pet.equipped) equipped.push(pet.uid);
    return {
      strength: player.strength,
      bestStrength: player.bestStrength,
      xp: player.xp,
      wins: player.wins,
      lifetimeWins: player.lifetimeWins,
      rebirths: player.rebirths,
      ownedDinos: player.ownedDinos,
      dinoSlot: player.dinoSlot,
      pets: player.pets.map((pet) => ({ uid: pet.uid, petId: pet.petId })),
      equippedPets: equipped,
      nextPetUid: player.nextPetUid,
      petsHatched: player.petsHatched,
      items: player.items.map((stack) => ({ itemId: stack.itemId, count: stack.count })),
      equippedItems: [...player.equippedItems].map((id) => id ?? 0),
      kills: player.kills,
      bestStage: player.bestStage,
      playSeconds: player.playSeconds,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      updatedAt: Date.now(),
    };
  }

  /**
   * Apply a profile onto player state - or the fresh-player defaults when
   * there is none. Only the DERIVING facts: level, damage and speed are
   * recomputed by the progression service, which the room runs right after.
   */
  applyTo(player: PlayerState, profile: StoredProfile | null, keepIdentity = false): void {
    const p = profile ? progressOf(profile) : freshProgress();
    player.strength = p.strength;
    player.bestStrength = Math.max(p.bestStrength, p.strength);
    player.xp = p.xp;
    player.wins = p.wins;
    player.lifetimeWins = Math.max(p.lifetimeWins, p.wins);
    player.rebirths = Math.floor(p.rebirths);
    player.ownedDinos = (Math.floor(p.ownedDinos) & ALL_DINO_BITS) | STARTER_DINO_BITS;
    const slot = Math.floor(p.dinoSlot);
    player.dinoSlot = slot >= 1 && slot <= DINO_COUNT && (player.ownedDinos & (1 << (slot - 1))) !== 0 ? slot : 1;
    player.kills = Math.floor(p.kills);
    player.items.clear();
    for (const record of p.items) {
      if (!itemById(record.itemId)) continue;
      const stack = new ItemStack();
      stack.itemId = record.itemId;
      stack.count = Math.min(65_535, Math.floor(record.count));
      player.items.push(stack);
    }
    for (let i = 0; i < ITEM_EQUIP_MAX; i += 1) player.equippedItems[i] = Math.floor(p.equippedItems[i] ?? 0);
    player.pets.clear();
    const equipped = new Set(p.equippedPets);
    let nextUid = Math.max(1, Math.floor(p.nextPetUid));
    for (const record of p.pets) {
      if (!petById(record.petId)) continue;
      const pet = new PetState();
      pet.uid = record.uid;
      pet.petId = record.petId;
      pet.equipped = equipped.has(record.uid);
      player.pets.push(pet);
      if (record.uid >= nextUid) nextUid = record.uid + 1;
    }
    player.nextPetUid = nextUid;
    player.petsHatched = Math.max(Math.floor(p.petsHatched), p.pets.length);
    player.bestStage = Math.floor(p.bestStage);
    for (let i = 0; i < player.killMasks.length; i += 1) player.killMasks[i] = 0;
    player.playSeconds = p.playSeconds;
    if (!keepIdentity) {
      player.displayName = profile?.displayName ?? '';
      player.avatarUrl = profile?.avatarUrl ?? '';
    }
  }

  /** Save a live session under a key. Resolves once the write has landed. */
  async save(key: string, player: PlayerState, extras?: MigrationFields): Promise<void> {
    const fields = this.snapshot(player);
    this.remember(key, { ...(this.cache.get(key) ?? {}), ...fields, ...extras } as StoredProfile);
    await storage.put(key, fields, extras);
  }

  /** Create a profile only if the key is free. Throws when storage is unreachable. */
  async insertIfAbsent(key: string, profile: ProfileFields & MigrationFields): Promise<boolean> {
    const inserted = await storage.insertIfAbsent(key, profile);
    if (inserted) this.remember(key, { ...profile });
    return inserted;
  }

  /**
   * RETIRE a guest profile whose progress just became an account's: reset its
   * progress, keep what it held as `migratedSnapshot`, and mark where it went.
   * A retired guest is never migrated again and never ranks on a board.
   */
  async retireGuest(
    guestKey: string,
    accountKey: string,
    snapshot: ProgressFields,
    identity: { displayName: string; avatarUrl: string },
  ): Promise<void> {
    const now = Date.now();
    const fields: ProfileFields = { ...freshProgress(), ...identity, updatedAt: now };
    const extras: MigrationFields = { migratedTo: accountKey, migratedAt: now, migratedSnapshot: snapshot };
    this.remember(guestKey, { ...(this.cache.get(guestKey) ?? {}), ...fields, ...extras } as StoredProfile);
    await storage.put(guestKey, fields, extras);
  }

  flush(timeoutMs?: number): Promise<boolean> {
    return storage.flush(timeoutMs);
  }

  async close(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    await storage.close();
  }

  private remember(key: string, profile: StoredProfile): void {
    const known = this.cache.get(key);
    if (known && known.updatedAt > profile.updatedAt) return;
    this.cache.set(key, profile);
  }

  private async refresh(): Promise<void> {
    try {
      for (const [key, profile] of await storage.loadAll()) this.remember(key, profile);
    } catch (error) {
      logger.warn(SCOPE, `leaderboard cache not refreshed: ${String(error)}`);
    }
  }
}

/** What a brand-new player holds: 0 Damage, the Compsognathus, nothing else. */
const freshProgress = (): ProgressFields => emptyProgress();

export const profileStore = new ProfileStore();
