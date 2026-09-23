import { ArraySchema, Schema, type } from '@colyseus/schema';
import { ITEM_EQUIP_MAX, JUMP_VELOCITY, SPAWN, STAGE_COUNT, BASE_SPEED } from '@dino/shared';
import { AvatarState } from './AvatarState.js';
import { EnemyState } from './EnemyState.js';

/** One owned pet. */
export class PetState extends Schema {
  @type('uint32') uid = 0;
  @type('uint8') petId = 0;
  @type('boolean') equipped = false;
}

/** One stack of kill-drop items ("Bone x3"). */
export class ItemStack extends Schema {
  @type('uint8') itemId = 0;
  @type('uint16') count = 0;
}

const zeros = (length: number): ArraySchema<number> => {
  const list = new ArraySchema<number>();
  for (let i = 0; i < length; i += 1) list.push(0);
  return list;
};

/**
 * Replicated per-player state.
 *
 * Every field is written by the SERVER: transform and motion by the
 * authoritative simulation, progression and inventories by their own
 * service. Nothing is ever copied from a client message.
 */
export class PlayerState extends Schema {
  @type('string') sessionId = '';

  @type('float32') x: number = SPAWN.x;
  @type('float32') y: number = SPAWN.y;
  @type('float32') z: number = SPAWN.z;
  @type('float32') rotationY: number = SPAWN.yaw;

  @type('float32') speed = 0;
  @type('float32') verticalVelocity = 0;
  @type('boolean') grounded = true;

  /** Authoritative velocity, for client reconciliation. */
  @type('float32') velocityX = 0;
  @type('float32') velocityY = 0;
  @type('float32') velocityZ = 0;
  @type('uint32') lastInputSeq = 0;
  @type('boolean') jumpLatched = false;
  @type('uint32') jumpCount = 0;

  /** Accepted attacks, counted, so every client can play each one. */
  @type('uint32') attackCount = 0;
  /** Which way the last attack faced. */
  @type('float32') attackYaw = 0;

  @type(AvatarState) avatar = new AvatarState();
  @type('string') displayName = '';
  @type('string') avatarUrl = '';

  // ---- progression: every figure is the server's own
  /** THE Damage stat: the total every accepted attack has paid. Reset by a rebirth. */
  @type('float64') strength = 0;
  /** Highest Damage ever held (a rebirth resets `strength`, never this). */
  @type('float64') bestStrength = 0;
  /** XP toward the next level; stops at the rebirth's max level. Reset by a rebirth. */
  @type('float64') xp = 0;
  @type('uint16') level = 1;
  @type('uint16') rebirths = 0;
  /** Written through `Wallet` only. */
  @type('float64') wins = 0;
  @type('float64') lifetimeWins = 0;
  /** Damage one attack pays right now (before a dummy's multiplier). */
  @type('float64') damagePerAttack = 1;
  /** Every factor but the dinosaur's and the dummy's: the HUD's "Multiplier". */
  @type('float32') multiplier = 1;
  @type('float32') moveSpeed = BASE_SPEED;
  @type('float32') jumpVelocity = JUMP_VELOCITY;

  @type('float64') health = 100;
  @type('float64') maxHealth = 100;
  @type('uint32') kills = 0;

  @type('uint8') dinoSlot = 1;
  @type('uint16') ownedDinos = 1;

  @type([PetState]) pets = new ArraySchema<PetState>();
  @type('uint32') petsHatched = 0;
  @type('uint32') nextPetUid = 1;

  /** The item bag, one stack per item kind. */
  @type([ItemStack]) items = new ArraySchema<ItemStack>();
  /** The three worn item slots: item ids, 0 = empty. */
  @type(['uint8']) equippedItems = zeros(ITEM_EQUIP_MAX);

  /** Highest stage ever cleared, in any run (a record; gates follow `runStage`). */
  @type('uint8') bestStage = 0;

  // ---- the current RUN: from leaving the park until back at it
  /** Highest stage cleared in this run: every gate up to it is open. */
  @type('uint8') runStage = 0;
  /** Per stage, this run: the dinosaurs this player has defeated. */
  @type(['uint16']) killMasks = zeros(STAGE_COUNT);
  /** This run's enemies: the wave of the next uncleared stage (and the fallen of the last one). */
  @type([EnemyState]) enemies = new ArraySchema<EnemyState>();

  @type('float64') playSeconds = 0;

  /** True once the server has simulated at least one input for this player. */
  @type('boolean') ready = false;
}
