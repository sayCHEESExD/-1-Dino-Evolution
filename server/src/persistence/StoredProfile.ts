/**
 * The DERIVING facts of a player's progression: everything a session is
 * rebuilt from. Level, damage-per-attack, speed and health are recomputed from
 * these by the same shared formulas a live session uses.
 */
export interface PetRecord {
  /** Unique per player, never reused. */
  uid: number;
  petId: number;
}

export interface ItemRecord {
  itemId: number;
  count: number;
}

export interface ProgressFields {
  /** Total Damage held (reset by a rebirth). */
  strength: number;
  /** Highest Damage ever held: the Top Damage board. */
  bestStrength: number;
  /** XP (reset by a rebirth). */
  xp: number;
  wins: number;
  /** Wins earned, ever. */
  lifetimeWins: number;
  rebirths: number;
  /** Bitmask of dinosaurs owned (slot 1 = bit 0, always owned). */
  ownedDinos: number;
  /** The ridden dinosaur's slot. */
  dinoSlot: number;
  pets: PetRecord[];
  /** uids of the equipped pets. */
  equippedPets: number[];
  /** The next pet uid to hand out. */
  nextPetUid: number;
  /** Pets ever hatched. */
  petsHatched: number;
  /** The item bag, one stack per item kind. */
  items: ItemRecord[];
  /** The three worn item slots (item ids, 0 = empty). */
  equippedItems: number[];
  /** Dinosaurs defeated, ever. */
  kills: number;
  /** Highest stage ever cleared. */
  bestStage: number;
  /** Seconds played, lifetime: the Top Playtime board. */
  playSeconds: number;
}

/** What one save writes. */
export interface ProfileFields extends ProgressFields {
  /** The portal's display name and portrait as last seen. Cleared when empty. */
  displayName: string;
  avatarUrl: string;
  /** Wall clock of the save. */
  updatedAt: number;
}

/**
 * The first-login migration's bookkeeping.
 *
 *   - An ACCOUNT profile created from a browser's guest progress carries
 *     `migratedFrom`, the guest key it came from.
 *   - That GUEST profile is then RETIRED: its progress is reset, it carries
 *     `migratedTo` (the account key), `migratedAt`, and `migratedSnapshot` -
 *     the progress it held at that moment, kept as a recovery copy.
 */
export interface MigrationFields {
  migratedFrom?: string;
  migratedTo?: string;
  migratedAt?: number;
  migratedSnapshot?: ProgressFields;
}

/**
 * A profile as READ from storage. Beyond the fields this build knows, it may
 * carry any field a newer or older build wrote: those are kept and written
 * back untouched, never dropped.
 */
export type StoredProfile = ProfileFields & MigrationFields & { [field: string]: unknown };

const NUMERIC_KEYS = [
  'strength',
  'bestStrength',
  'xp',
  'wins',
  'lifetimeWins',
  'rebirths',
  'ownedDinos',
  'dinoSlot',
  'nextPetUid',
  'petsHatched',
  'kills',
  'bestStage',
  'playSeconds',
] as const satisfies readonly (keyof ProgressFields)[];

/** Optional string fields a save may CLEAR. The only fields ever $unset. */
export const CLEARABLE_FIELDS = ['displayName', 'avatarUrl'] as const;

const numeric = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const numbers = (value: unknown, limit: number): number[] =>
  Array.isArray(value) ? value.slice(0, limit).map(numeric) : [];

const petRecords = (value: unknown): PetRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: PetRecord[] = [];
  const seen = new Set<number>();
  for (const entry of value.slice(0, 160)) {
    if (!entry || typeof entry !== 'object') continue;
    const uid = numeric((entry as { uid?: unknown }).uid);
    const petId = numeric((entry as { petId?: unknown }).petId);
    if (uid <= 0 || petId <= 0 || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid: Math.floor(uid), petId: Math.floor(petId) });
  }
  return out;
};

const itemRecords = (value: unknown): ItemRecord[] => {
  if (!Array.isArray(value)) return [];
  const byId = new Map<number, number>();
  for (const entry of value.slice(0, 64)) {
    if (!entry || typeof entry !== 'object') continue;
    const itemId = Math.floor(numeric((entry as { itemId?: unknown }).itemId));
    const count = Math.floor(numeric((entry as { count?: unknown }).count));
    if (itemId <= 0 || count <= 0) continue;
    byId.set(itemId, (byId.get(itemId) ?? 0) + count);
  }
  return [...byId.entries()].map(([itemId, count]) => ({ itemId, count }));
};

export const emptyProgress = (): ProgressFields => ({
  strength: 0,
  bestStrength: 0,
  xp: 0,
  wins: 0,
  lifetimeWins: 0,
  rebirths: 0,
  ownedDinos: 1,
  dinoSlot: 1,
  pets: [],
  equippedPets: [],
  nextPetUid: 1,
  petsHatched: 0,
  items: [],
  equippedItems: [0, 0, 0],
  kills: 0,
  bestStage: 0,
  playSeconds: 0,
});

/** Just the progression of a profile, coerced. */
export const progressOf = (source: Partial<ProgressFields>): ProgressFields => {
  const out = emptyProgress();
  for (const key of NUMERIC_KEYS) out[key] = numeric(source[key]);
  if (out.ownedDinos === 0) out.ownedDinos = 1;
  if (out.dinoSlot === 0) out.dinoSlot = 1;
  if (out.nextPetUid === 0) out.nextPetUid = 1;
  out.pets = petRecords(source.pets);
  out.equippedPets = numbers(source.equippedPets, 8).map(Math.floor);
  out.items = itemRecords(source.items);
  const worn = numbers(source.equippedItems, 3).map(Math.floor);
  out.equippedItems = [worn[0] ?? 0, worn[1] ?? 0, worn[2] ?? 0];
  return out;
};

/**
 * Coerce whatever storage held into a profile, KEEPING every unknown field.
 */
export const coerceProfile = (raw: unknown): StoredProfile | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const profile: StoredProfile = {
    ...source,
    ...progressOf(source as Partial<ProgressFields>),
    displayName: text(source['displayName']),
    avatarUrl: text(source['avatarUrl']),
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedFrom'] !== 'string') delete profile.migratedFrom;
  if (typeof source['migratedTo'] !== 'string') delete profile.migratedTo;
  if (typeof source['migratedAt'] !== 'number') delete profile.migratedAt;
  if (source['migratedSnapshot'] && typeof source['migratedSnapshot'] === 'object') {
    profile.migratedSnapshot = progressOf(source['migratedSnapshot'] as Partial<ProgressFields>);
  } else {
    delete profile.migratedSnapshot;
  }
  return profile;
};

/**
 * Whether a profile holds anything worth carrying into an account. A player
 * who opened the game and stood still has nothing to migrate.
 */
export const hasProgress = (p: ProgressFields): boolean =>
  p.strength > 0 ||
  p.bestStrength > 0 ||
  p.xp > 0 ||
  p.wins > 0 ||
  p.lifetimeWins > 0 ||
  p.bestStage > 0 ||
  p.rebirths > 0 ||
  p.ownedDinos > 1 ||
  p.pets.length > 0 ||
  p.items.length > 0;
