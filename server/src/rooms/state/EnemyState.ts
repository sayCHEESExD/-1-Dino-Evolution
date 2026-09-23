import { Schema, type } from '@colyseus/schema';

/**
 * One enemy of ONE PLAYER'S RUN. Every player fights their own wave: position
 * and health are the server's; `hits` and `swings` are counters so the owner's
 * client can play each flinch and each attack exactly once.
 */
export class EnemyState extends Schema {
  /** The global enemy id (index into ENEMIES). */
  @type('uint16') id = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('float32') yaw = 0;
  @type('float64') hp = 0;
  @type('boolean') alive = true;
  @type('boolean') moving = false;
  @type('uint16') hits = 0;
  @type('uint16') swings = 0;
}
