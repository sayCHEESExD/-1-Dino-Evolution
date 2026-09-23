/**
 * ONE REAL RUN against a running server, as a client plays it: walk into
 * Stage 1, get hunted, fight every enemy with real attacks, watch the stage
 * clear and stay cleared, see the Stage 2 wave fielded and the portal open,
 * walk to the reward pad, claim, and land back at the base with the run reset.
 * A second client in the same room checks that none of it touches them.
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
  room.respawns = [];
  room.onMessage('respawn', (m) => room.respawns.push(m));
  for (const type of ['authState', 'stageAwarded', 'stageCleared', 'notice', 'hit', 'hatched', 'itemDropped']) room.onMessage(type, () => {});
  return room;
};

const stamp = Date.now().toString(36);
const rider = await join(`run-rider-${stamp}`);
const bystander = await join(`run-by-${stamp}`);
await sleep(700);
const me = () => rider.state.players.get(rider.sessionId);
const other = () => bystander.state.players.get(bystander.sessionId);
const aliveOf = (stage) => [...me().enemies].filter((e) => e.alive && S.ENEMIES[e.id].stage === stage);

let seq = 0;
let lastAttack = 0;
/** Walk (real-time input) toward a point, attacking on the way if asked. */
const walkTo = async (x, z, { attack = false, stopAt = 2, maxSeconds = 20, until = () => false } = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxSeconds * 1000) {
    if (until()) return true;
    const p = me();
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    const go = d > stopAt;
    seq += 1;
    rider.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: go ? -dx / d : 0, moveZ: go ? dz / d : 0, jump: false, cameraYaw: 0 });
    if (attack && Date.now() - lastAttack > 320) {
      lastAttack = Date.now();
      rider.send(S.MessageType.Attack, { target: -1 });
    }
    if (!go && !attack) return true;
    await sleep(1000 / 60);
  }
  return until();
};

console.log('\nA run');
check(me().runStage === 0 && aliveOf(1).length === 3, 'the run starts with a fresh Stage 1 wave and every portal closed');
const byHealth = other().health;

// Into Stage 1, in its corner: the whole wave comes.
await walkTo(0, S.arenaStartZ(1) + 3, { stopAt: 1.5 });
await walkTo(-17, S.arenaStartZ(1) + 4, { stopAt: 1.5 });
const spread0 = aliveOf(1).map((e) => Math.hypot(e.x - me().x, e.z - me().z));
await sleep(1500);
const spread1 = aliveOf(1).map((e) => Math.hypot(e.x - me().x, e.z - me().z));
check(spread1.every((d, i) => d < spread0[i]), 'standing in a corner of the stage, every enemy comes for the player');

// Fight until the stage is cleared.
const fightStart = Date.now();
while (me().runStage < 1 && Date.now() - fightStart < 90_000 && me().health > 0) {
  const target = aliveOf(1).sort((a, b) => Math.hypot(a.x - me().x, a.z - me().z) - Math.hypot(b.x - me().x, b.z - me().z))[0];
  if (!target) break;
  await walkTo(target.x, target.z, { attack: true, stopAt: 2.5, maxSeconds: 1 });
}
check(me().runStage === 1 && me().killMasks[0] === S.stageByIndex(1).fullMask, `every Compsognathus down: Stage 1 CLEARED, next portal open (${Math.round((Date.now() - fightStart) / 1000)}s)`);
check(aliveOf(2).length === S.stageByIndex(2).enemies.length, "Stage 2's wave is fielded, waiting");

await sleep(8000);
check(aliveOf(1).length === 0 && me().runStage === 1, 'eight seconds later nothing has respawned: the stage stays cleared');
check(other().health === byHealth && [...other().enemies].filter((e) => e.alive).length === 3, "the other player's health and enemies were never touched");

// The claim: walk to the pad; the server pays and sends the player home.
const winsBefore = me().wins;
const pad = S.rewardPadOf(1);
const respawnsBefore = rider.respawns.length;
await walkTo(pad.x, pad.z, { stopAt: 1, maxSeconds: 25, until: () => rider.respawns.length > respawnsBefore });
rider.send(S.MessageType.ClaimStage, { stage: 1 });
rider.send(S.MessageType.ClaimStage, { stage: 1 });
await sleep(500);
check(me().wins === winsBefore + 1, 'claiming pays the stage Wins, once (a repeated claim pays nothing)');
check(!rider.respawns.slice(respawnsBefore).some((m) => m.reason === 'claimed'), 'the player is held a beat for the trophy celebration');
for (const t0 = Date.now(); !rider.respawns.slice(respawnsBefore).some((m) => m.reason === 'claimed') && Date.now() - t0 < 4000; ) await sleep(100);
await sleep(300);
check(rider.respawns.slice(respawnsBefore).filter((m) => m.reason === 'claimed').length === 1 && Math.hypot(me().x - S.SPAWN.x, me().z - S.SPAWN.z) < 1, 'then the server sends them back to base, once');
check(me().runStage === 0 && [...me().killMasks].every((m) => m === 0) && aliveOf(1).length === 3 && aliveOf(2).length === 0, 'back at base: a new run, stage progress reset, Stage 1 fielded again');

// Death: clear Stage 1 again, then stand in Stage 2 (recommended 50 Damage) and let it hunt.
await walkTo(0, S.arenaStartZ(1) + 3, { stopAt: 1.5 });
const again = Date.now();
while (me().runStage < 1 && Date.now() - again < 90_000) {
  const target = aliveOf(1).sort((a, b) => Math.hypot(a.x - me().x, a.z - me().z) - Math.hypot(b.x - me().x, b.z - me().z))[0];
  if (!target) break;
  await walkTo(target.x, target.z, { attack: true, stopAt: 2.5, maxSeconds: 1 });
}
check(me().runStage === 1, 'a new run: Stage 1 cleared again');
const deathsBefore = rider.respawns.length;
await walkTo(0, S.arenaStartZ(2) + 20, { stopAt: 2, maxSeconds: 20, until: () => rider.respawns.length > deathsBefore });
const damageThen = me().strength;
for (const t0 = Date.now(); me().health > 0 && Date.now() - t0 < 60_000; ) await sleep(50);
const diedAt = Date.now();
check(me().health === 0, `idle in Stage 2 with ${Math.round(damageThen)} Damage, the wave kills the player`);
// The death state: the player stays where they fell, can neither walk nor attack, and is not sent home yet.
const fellAt = { x: me().x, z: me().z };
const damageDead = me().strength;
await walkTo(0, S.arenaStartZ(2) + 60, { attack: true, stopAt: 1, maxSeconds: 1.2 });
check(Math.hypot(me().x - fellAt.x, me().z - fellAt.z) < 0.5 && me().strength === damageDead, 'dead: movement and attacks are refused');
check(rider.respawns.length === deathsBefore, 'and the player lies in the death state (no respawn yet)');
for (const t0 = Date.now(); rider.respawns.length === deathsBefore && Date.now() - t0 < 6000; ) await sleep(50);
const death = rider.respawns.slice(deathsBefore).find((m) => m.reason === 'defeated');
const lay = (Date.now() - diedAt) / 1000;
check(!!death && lay >= S.COMBAT.deathSeconds - 0.3 && rider.respawns.length === deathsBefore + 1, `the respawn comes once, after the death state (${lay.toFixed(2)}s)`);
await sleep(600);
check(Math.hypot(me().x - S.SPAWN.x, me().z - S.SPAWN.z) < 1 && me().health === me().maxHealth, 'defeated: straight back to base at full health');
check(me().runStage === 0 && aliveOf(1).length === 3 && aliveOf(2).length === 0, 'and the run is reset: portals closed, Stage 1 fielded again');

await rider.leave();
await bystander.leave();
console.log(failures === 0 ? '\nrun OK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
