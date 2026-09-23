/**
 * Two real clients in one room: one ATTACKS and WALKS, the other watches it
 * replicate - every attack counted once, the Damage the server paid, and the
 * position the server simulated. Then the refusals: walking pays no Damage, a
 * dinosaur claimed from the wrong place is not granted, and a rebirth asked for
 * too early does nothing.
 *
 * Needs a running server (`npm run dev`), default ws://localhost:2590.
 */
import { Client } from 'colyseus.js';
import * as S from '../shared/dist/index.js';

const ENDPOINT = process.env.ENDPOINT ?? `ws://localhost:${S.DEFAULT_SERVER_PORT}`;
let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const join = async (id) => {
  const client = new Client(ENDPOINT);
  const room = await client.joinOrCreate(S.ROOM_NAME, { playerId: id });
  for (const type of ['respawn', 'authState', 'stageAwarded', 'stageCleared', 'notice', 'hit', 'hatched', 'itemDropped']) room.onMessage(type, () => {});
  return room;
};

const stamp = Date.now().toString(36);
const fighter = await join(`mp-fighter-${stamp}`);
const watcher = await join(`mp-watcher-${stamp}`);
await sleep(600);
check(fighter.roomId === watcher.roomId, 'both clients share a room');

const self = () => fighter.state.players.get(fighter.sessionId);
const seen = () => watcher.state.players.get(fighter.sessionId);

// Walking: real-time input at 60 Hz, forward for a second.
let seq = 0;
const damageBefore = self().strength;
for (let i = 0; i < 60; i += 1) {
  seq += 1;
  fighter.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: 0, moveZ: 1, jump: false, cameraYaw: 0 });
  await sleep(1000 / 60);
}
await sleep(300);
check(self().z > S.SPAWN.z + 5, `the server moved the walker (z ${self().z.toFixed(1)})`);
check(Math.abs(seen().z - self().z) < 0.01, 'the watcher sees the same position');
check(self().strength === damageBefore, 'walking paid no Damage');

// Attacking.
const attacksBefore = seen().attackCount;
for (let i = 0; i < 5; i += 1) {
  fighter.send(S.MessageType.Attack, { target: -1 });
  await sleep(350);
}
await sleep(300);
check(seen().attackCount === attacksBefore + 5, `the watcher saw each of 5 attacks once (${seen().attackCount - attacksBefore})`);
check(seen().strength === damageBefore + 5, `each attack paid the Compsognathus' +1 (Damage ${seen().strength})`);

// Spam: far faster than the rate limit.
const spamBefore = self().strength;
for (let i = 0; i < 20; i += 1) fighter.send(S.MessageType.Attack, { target: -1 });
await sleep(400);
check(self().strength - spamBefore <= S.COMBAT.burst + 1, `20 instant attacks paid at most the burst (${self().strength - spamBefore})`);

// Refusals: an item not owned, a dinosaur from the wrong place, an early rebirth.
fighter.send(S.MessageType.ItemAction, { action: 'equip', item: 10 });
fighter.send(S.MessageType.DinoPad, { slot: 13 });
fighter.send(S.MessageType.Rebirth, {});
await sleep(400);
check(self().dinoSlot === 1 && self().ownedDinos === 1, 'a dinosaur claimed from the wrong place (and without Wins) is not granted');
check([...self().equippedItems].every((id) => id === 0), 'an item the player does not own cannot be equipped');
check(self().rebirths === 0, 'a rebirth below Level 10 does nothing');

await fighter.leave();
await watcher.leave();
console.log(failures === 0 ? '\nmultiplayer OK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
