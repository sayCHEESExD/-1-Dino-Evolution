import type { AvatarAppearance, AvatarProportions } from './avatar.js';

/**
 * Client -> server input (MessageType.Move).
 *
 * INPUT ONLY. No position, velocity or target: the server simulates movement
 * from intent and owns the result.
 */
export interface MoveMessage {
  /** Monotonically increasing input sequence number. */
  seq: number;
  /** Seconds this input covers. Clamped and rate-limited server-side. */
  dt: number;
  /** -1..1, camera-relative. */
  moveX: number;
  /** -1..1, camera-relative. */
  moveZ: number;
  /** The jump control, held. Only a fresh press jumps. */
  jump: boolean;
  /** Yaw the camera faced: movement is camera-relative. */
  cameraYaw: number;
}

/** Client -> server: one attack. `target` is a HINT (enemy id, dummy target, or -1). */
export interface AttackMessage {
  target: number;
}

/** Server -> client: an attack was accepted. */
export interface HitMessage {
  /** What it landed on: an enemy id, a dummy target, or -1 for thin air. */
  target: number;
  /** Damage (and XP) the attack paid. */
  gain: number;
  /** Hit dealt to a stage dinosaur (0 for a dummy or thin air). */
  damage: number;
  /** The enemy's health after the hit. */
  after: number;
  killed: boolean;
}

/** Why a player was placed. */
export type RespawnReason = 'manual' | 'join' | 'teleport' | 'rebirth' | 'defeated' | 'claimed';

/** Server -> client authoritative placement (MessageType.Respawn). */
export interface RespawnMessage {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: RespawnReason;
}

export interface TeleportMessage {
  /** A `TeleportId`: spawn, dinos, training, eggs, or stageN. */
  to: string;
}

/** Client -> server: "I am on this stage's reward pad." A request, never a grant. */
export interface ClaimStageMessage {
  stage: number;
}

/** Server -> client: a stage reward landed. Presentation only. */
export interface StageAwardedMessage {
  stage: number;
  wins: number;
  total: number;
}

/** Server -> client: this player just cleared a stage's wave. */
export interface StageClearedMessage {
  stage: number;
  /** True on the clear that opened the next portal. */
  firstClear: boolean;
}

/** Client -> server: "I am on this dinosaur's pad." */
export interface DinoPadMessage {
  slot: number;
}

/** Client -> server: buy or ride a dinosaur from the menu. */
export interface DinoSelectMessage {
  slot: number;
}

export type ItemActionKind = 'equip' | 'unequip' | 'delete' | 'equipBest' | 'unequipAll';

/** Client -> server: an item request. `item` names an item id (equip, delete); `slot` a worn slot 0..2 (unequip). */
export interface ItemActionMessage {
  action: ItemActionKind;
  item?: number;
  slot?: number;
}

/** Server -> client: a kill dropped an item (or would have, into a full bag). */
export interface ItemDroppedMessage {
  item: number;
  /** False when the bag was full and the drop was lost. */
  kept: boolean;
  /** Where it fell, for the pickup effect. */
  x: number;
  z: number;
}

export interface HatchMessage {
  egg: number;
  count: number;
}

export interface HatchedMessage {
  egg: number;
  pets: { uid: number; petId: number }[];
}

export type PetActionKind = 'equip' | 'unequip' | 'delete' | 'equipBest' | 'unequipAll';

export interface PetActionMessage {
  action: PetActionKind;
  /** The pet's uid; ignored by equipBest / unequipAll. */
  uid?: number;
}

/** Server -> client: what happened to a request, so the UI can say so. */
export interface NoticeMessage {
  kind: 'bought' | 'equipped' | 'refused' | 'rebirth' | 'locked' | 'info';
  text: string;
}

export interface SetAvatarMessage {
  appearance: AvatarAppearance;
  proportions: AvatarProportions;
}

export interface SetIdentityMessage {
  displayName: string;
  avatarUrl: string;
}

/** Client -> server: the portal's game TOKEN, or null when signed out. */
export interface SetAuthMessage {
  token: string | null;
}

export type AuthStatus = 'account' | 'guest' | 'unavailable';

export interface AuthStateMessage {
  status: AuthStatus;
  note?: string;
}
