import type { AudioManager } from './AudioManager.js';

const MIN_AUDIBLE_SPEED = 2.5;
const MAX_STEPS_PER_SECOND = 6;

export interface PlayerAudioInput {
  readonly horizontalSpeed: number;
  readonly isGrounded: boolean;
  readonly jumpedEdge: boolean;
  readonly landedEdge: boolean;
  /** The ridden dinosaur's hip height: its stride, and how heavily it lands. */
  readonly hip: number;
}

/**
 * The local rider's movement sounds: a footfall per stride - a patter under a
 * Compsognathus, a ground-shaking thud under a Tyrannosaurus - the jump and
 * the landing.
 */
export class PlayerAudio {
  private stride = 0;
  private sinceBeat = 0;

  constructor(private readonly audio: AudioManager) {}

  update(delta: number, player: PlayerAudioInput): void {
    const size = Math.max(0.5, player.hip);
    // Pitch falls as the animal grows: 1.6 for the smallest, ~0.5 for a giant.
    const pitch = Math.min(1.6, Math.max(0.45, 2.2 / size));
    if (player.jumpedEdge) this.audio.play('jump');
    if (player.landedEdge) this.audio.play('land', Math.min(1, 0.4 + size * 0.12), 0, pitch);

    this.sinceBeat += delta;
    if (!player.isGrounded || player.horizontalSpeed < MIN_AUDIBLE_SPEED) {
      this.stride = 0;
      return;
    }
    this.stride += player.horizontalSpeed * delta;
    // A stride is about one leg length.
    if (this.stride < size * 1.3) return;
    this.stride = 0;
    if (this.sinceBeat < 1 / MAX_STEPS_PER_SECOND) return;
    this.sinceBeat = 0;
    this.audio.play('step', Math.min(1, 0.25 + size * 0.1), 0, pitch);
  }
}
