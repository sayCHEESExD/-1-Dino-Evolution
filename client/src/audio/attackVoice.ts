import { LOOKS } from '../dinos/DinoLooks.js';
import { SPECIES, type AttackKind } from '../dinos/DinoSpecies.js';

/**
 * A look's ATTACK VOICE: its species' attack style (the same one its attack
 * animation plays) and its voice pitch. Every rideable and every wild
 * dinosaur resolves through here, so each sounds like its own species.
 */
export const attackVoiceOf = (lookId: string): { readonly kind: AttackKind; readonly pitch: number } => {
  const look = LOOKS[lookId];
  const species = look ? (SPECIES as Readonly<Record<string, { readonly attack: AttackKind }>>)[look.species] : undefined;
  return { kind: species?.attack ?? 'bite', pitch: look?.voice ?? 1 };
};
