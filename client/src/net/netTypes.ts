import type { AvatarAppearance, AvatarProportions } from '@dino/shared';
import type { MapSchema } from '@colyseus/schema';

/**
 * Client-side TYPE mirror of the server's Colyseus schema.
 *
 * Types only - colyseus.js builds the concrete schema instances at runtime
 * from the handshake reflection.
 */
export interface NetPet {
  uid: number;
  petId: number;
  equipped: boolean;
}

export interface NetItemStack {
  itemId: number;
  count: number;
}

export interface NetPlayerState {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lastInputSeq: number;
  jumpLatched: boolean;
  jumpCount: number;
  attackCount: number;
  attackYaw: number;

  avatar: AvatarAppearance & AvatarProportions;
  displayName: string;
  avatarUrl: string;

  strength: number;
  bestStrength: number;
  xp: number;
  level: number;
  rebirths: number;
  wins: number;
  lifetimeWins: number;
  damagePerAttack: number;
  multiplier: number;
  moveSpeed: number;
  jumpVelocity: number;
  health: number;
  maxHealth: number;
  kills: number;
  dinoSlot: number;
  ownedDinos: number;
  pets: ArrayLike<NetPet>;
  items: ArrayLike<NetItemStack>;
  equippedItems: ArrayLike<number>;
  nextPetUid: number;
  petsHatched: number;
  bestStage: number;
  /** Highest stage cleared in this run: the open portals. */
  runStage: number;
  /** This player's own run enemies. */
  enemies: ArrayLike<NetEnemyState>;
  killMasks: ArrayLike<number>;
  playSeconds: number;
  ready: boolean;
}

export interface NetEnemyState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  moving: boolean;
  hits: number;
  swings: number;
}

export interface NetLeaderEntry {
  handle: string;
  name: string;
  avatarUrl: string;
  value: number;
}

export interface NetLeaderboardState {
  rebirths: ArrayLike<NetLeaderEntry>;
  damage: ArrayLike<NetLeaderEntry>;
  playtime: ArrayLike<NetLeaderEntry>;
}

export interface NetGameState {
  players: MapSchema<NetPlayerState>;
  elapsed: number;
  leaderboard: NetLeaderboardState;
}

/** A leaderboard flattened into plain data, ready to draw. */
export interface LeaderboardSnapshot {
  rebirths: readonly NetLeaderEntry[];
  damage: readonly NetLeaderEntry[];
  playtime: readonly NetLeaderEntry[];
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
