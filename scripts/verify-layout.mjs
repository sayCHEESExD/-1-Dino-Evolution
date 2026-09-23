/**
 * THE LAYOUT, checked: every place a player must stand (spawn, teleports,
 * paddock pads, egg pads, reward and return pads, dummy mats, stage entries)
 * and every enemy post is clear of every static solid, and the stage road is
 * continuous. Pure data - no server needed. Run after `npm run build:shared`.
 */
import * as S from '../shared/dist/index.js';

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};

const solids = S.buildStaticSolids(S.STAGE_COUNT);
/** Solids that stand above `floor` at a point's footprint (floors and treads under it don't count). */
const blocked = (x, z, r, floor) =>
  solids.filter((b) => b.maxY > floor + 0.35 && b.minY < floor + 3 && x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ);

const clear = (label, x, z, r, floor = 0) => {
  const hits = blocked(x, z, r, floor);
  check(hits.length === 0, `${label} is clear${hits.length ? ` (hits ${JSON.stringify(hits[0])})` : ''}`);
};

console.log('\nThe park');
clear('spawn', S.SPAWN.x, S.SPAWN.z, 2.5);
for (const [id, p] of Object.entries(S.TELEPORTS)) clear(`teleport ${id}`, p.x, p.z, 2.5);
for (const pad of S.DINO_PADS) clear(`paddock pad ${pad.slot}`, pad.x, pad.z, pad.half * 0.9, pad.y);
for (const egg of S.EGG_PLACEMENTS) clear(`egg pad ${egg.egg}`, egg.x, S.HATCHERY.padZ, S.HATCHERY.padHalf * 0.9, 0.3);
for (const dummy of S.DUMMIES) {
  // Somewhere on the mat, on the avenue side, a rider can stand.
  clear(`dummy ${dummy.tier} mat (front)`, dummy.x + dummy.half + 2.2, dummy.z, 1.5, S.TRAINING.floorTop);
}
for (let i = 0; i < S.DUMMIES.length; i += 1) {
  for (let j = i + 1; j < S.DUMMIES.length; j += 1) {
    const a = S.DUMMIES[i];
    const b = S.DUMMIES[j];
    check(Math.hypot(a.x - b.x, a.z - b.z) >= a.mat + b.mat, `mats ${a.tier} and ${b.tier} do not overlap`);
  }
}
check(S.HUB.maxX - S.HUB.minX <= 160 && S.HUB.maxZ - S.HUB.minZ <= 112, `the park is compact (${S.HUB.maxX - S.HUB.minX} x ${S.HUB.maxZ - S.HUB.minZ})`);

console.log('\nThe stages');
check(S.ARENA.halfWidth * 2 <= 56, `arenas are ${S.ARENA.halfWidth * 2} wide`);
let stagesOk = true;
let enemiesOk = true;
for (let stage = 1; stage <= S.STAGE_COUNT; stage += 1) {
  const e = S.stageEntry(stage);
  const reward = S.rewardPadOf(stage);
  const back = S.returnPadOf(stage);
  if (blocked(e.x, e.z, 2.5, 0).length || blocked(reward.x, reward.z, reward.half * 0.9, 0).length || blocked(back.x, back.z, back.half * 0.9, 0).length) stagesOk = false;
  // The walk from entry to the far gate down the middle is open.
  for (let z = S.arenaStartZ(stage) + 2; z < S.arenaEndZ(stage) - 3; z += 2) if (blocked(0, z, 3, 0).length) stagesOk = false;
}
check(stagesOk, 'every stage entry, reward pad, return pad and centre lane is clear');
for (const def of S.ENEMIES) {
  if (blocked(def.x, def.z, def.radius, 0).length || Math.abs(def.x) + def.radius > S.ARENA.halfWidth - 1) enemiesOk = false;
}
check(enemiesOk, `all ${S.ENEMIES.length} enemy posts stand clear, inside their arena`);

console.log(failures === 0 ? '\nlayout OK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
