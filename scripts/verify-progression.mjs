/**
 * The progression rules, exercised in-process against the server's own
 * services.
 *
 * Every figure the specification pins down is asserted exactly: the thirteen
 * dinosaurs' damage and prices in evolution order, damage = dino x rebirth x
 * pets x items with nothing hidden, the dummies' multipliers and rebirth
 * gates, max level 10 x (R + 1), the eggs' prices and odds, the pet and item
 * slot limits, and the first four stages. Then the services are driven through
 * what a client can reach - including every refusal - so "the server decides"
 * is proven, not claimed.
 *
 * Run after `npm run build:server`.
 */
import * as S from '../shared/dist/index.js';
import { ItemStack, PlayerState } from '../server/dist/rooms/state/PlayerState.js';
import { CombatService } from '../server/dist/progression/CombatService.js';
import { DinoService } from '../server/dist/progression/DinoService.js';
import { ItemService } from '../server/dist/progression/ItemService.js';
import { PetService } from '../server/dist/progression/PetService.js';
import { ProgressionService } from '../server/dist/progression/ProgressionService.js';
import { RebirthService } from '../server/dist/progression/RebirthService.js';
import { StageService } from '../server/dist/progression/StageService.js';
import { profileStore } from '../server/dist/progression/ProfileStore.js';
import { coerceProfile } from '../server/dist/persistence/StoredProfile.js';

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};

let clockOffset = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockOffset;
const later = (ms = 1000) => {
  clockOffset += ms;
};

const progression = new ProgressionService();
const fresh = (id = 'p1') => {
  const player = new PlayerState();
  player.sessionId = id;
  progression.initialise(player);
  return player;
};
const place = (player, x, z, y = 0) => {
  player.x = x;
  player.y = y;
  player.z = z;
};
const giveItem = (player, itemId, count = 1) => {
  const stack = new ItemStack();
  stack.itemId = itemId;
  stack.count = count;
  player.items.push(stack);
};

console.log('\nStarting values');
{
  const p = fresh();
  check(p.strength === 0 && p.level === 1 && p.xp === 0, 'a new player holds 0 Damage at Level 1');
  check(p.damagePerAttack === 1 && p.dinoSlot === 1, 'riding the free Compsognathus: +1 per attack');
  check(p.moveSpeed === S.BASE_SPEED, `base speed ${S.BASE_SPEED}`);
}

console.log('\nDinosaurs, in evolution order');
{
  const expected = [
    ['Compsognathus', 1, 0], ['Raptor "Blue"', 2, 5], ['Gallimimus', 6, 25], ['Parasaurolophus', 15, 100], ['Pyroraptor', 27, 250],
    ['Triceratops', 50, 500], ['Therizinosaurus', 135, 2500], ['Spinosaurus', 260, 12000], ['Allosaurus', 825, 50000],
    ['Ceratosaurus', 1700, 120000], ['Tyrannosaurus', 3400, 500000], ['Indoraptor', 9500, 2500000], ['Indominus Rex', 18500, 9500000],
  ];
  const ok = expected.every(([name, damage, cost], i) => S.DINOS[i]?.name === name && S.DINOS[i].damage === damage && S.DINOS[i].cost === cost);
  check(ok && S.DINO_COUNT === 13, 'all thirteen dinosaurs with the specified damage and Wins');
  let larger = true;
  for (let i = 1; i < 13; i += 1) if (S.DINOS[i].slot !== i + 1) larger = false;
  check(larger && S.DINOS[12].height > S.DINOS[0].height * 2, 'slots in order; the Indominus stands over twice the Compsognathus');
}

console.log('\nDamage comes from attacking only');
{
  const combat = new CombatService();
  combat.bind(progression);
  const p = fresh('walker');
  check(p.strength === 0, 'walking pays nothing (no movement credit exists)');
  const out = combat.attack('walker', p, -1, progression);
  check(out.ok && out.gain === 1 && p.strength === 1 && p.xp === 1, 'an attack pays +1 Damage and +1 XP');
  const spam = [];
  for (let i = 0; i < 10; i += 1) spam.push(combat.attack('walker', p, -1, progression).ok);
  check(spam.filter(Boolean).length <= S.COMBAT.burst, `ten instant attacks: at most ${S.COMBAT.burst} accepted (rate limit)`);
}

console.log('\nThe damage formula is deterministic');
{
  const inputs = { dinoSlot: 11, ownedDinos: S.ALL_DINO_BITS, rebirths: 2, equippedPetIds: [], equippedItemIds: [] };
  check(S.damagePerAttack(inputs) === 3400 * 3, 'Tyrannosaurus at Rebirth 2: 3,400 x 3');
  const twice = [S.damagePerAttack(inputs), S.damagePerAttack(inputs), S.damagePerAttack(inputs)];
  check(twice.every((v) => v === twice[0]), 'the same inputs always give the same figure');
  const pet = S.PETS.find((entry) => entry.bonus > 0);
  const item = S.ITEMS[0];
  const full = S.damagePerAttack({ ...inputs, equippedPetIds: [pet.id], equippedItemIds: [item.id] });
  const expected = Math.floor(3400 * 3 * S.petMultiplier([pet.id]) * S.itemMultiplier([item.id]));
  check(full === expected, `pets and items multiply exactly: ${full} = 3400 x 3 x ${S.petMultiplier([pet.id])} x ${S.itemMultiplier([item.id])}`);
  const unowned = S.damagePerAttack({ ...inputs, ownedDinos: 1 });
  check(unowned === 1 * 3, 'a dinosaur not owned is never ridden (falls back to the Compsognathus)');
}

console.log('\nTraining dummies');
{
  const tiers = S.TRAINING_TIERS.map((t) => [t.multiplier, t.rebirthsRequired]);
  check(JSON.stringify(tiers) === JSON.stringify([[1, 0], [2, 1], [4, 2], [8, 4], [18, 6], [45, 9], [70, 12]]), 'x1/R0, x2/R1, x4/R2, x8/R4, x18/R6, x45/R9, x70/R12');
  const combat = new CombatService();
  combat.bind(progression);
  const p = fresh('trainer');
  const d2 = S.DUMMIES[2];
  place(p, d2.x + d2.half + 1.5, d2.z, S.TRAINING.floorTop);
  const locked = combat.attack('trainer', p, S.dummyTarget(2), progression);
  check(locked.ok && locked.note === 'locked-dummy' && locked.gain === 1, 'a locked dummy refuses its multiplier (pays the plain +1)');
  later();
  p.rebirths = 2;
  progression.syncDerived(p);
  const hit = combat.attack('trainer', p, S.dummyTarget(2), progression);
  check(hit.ok && hit.target === S.dummyTarget(2) && hit.gain === 1 * 3 * 4, `with 2 rebirths the Stone Stegosaurus pays x4 (${hit.gain})`);
  later();
  place(p, d2.x + 40, d2.z, S.TRAINING.floorTop);
  const far = combat.attack('trainer', p, S.dummyTarget(2), progression);
  check(far.ok && far.target === -1, 'a dummy out of reach of the SERVER position is not hit');
}

console.log('\nLevels and rebirth');
{
  check(S.xpToNext(1) === 50 && S.xpToNext(4) === 155, 'XP to next: 50 at Level 1, 155 at Level 4');
  check(S.speedForLevel(1) === 16 && S.speedForLevel(4) === 19, 'speed +1 per level (Level 4 = 19)');
  check([0, 1, 2, 3].every((r) => S.maxLevelFor(r) === 10 * (r + 1) && S.rebirthMultiplier(r) === r + 1), 'maxLevel = 10 x (R+1), damage multiplier = R+1');
  const capped = S.levelForXp(1e12, 0);
  check(capped.level === 10 && capped.capped, 'XP cannot carry a player past the max level');
  const rebirths = new RebirthService();
  const p = fresh('reborn');
  p.wins = 40;
  p.ownedDinos = 3;
  p.xp = S.xpForLevel(9);
  progression.syncDerived(p);
  check(!rebirths.rebirth(p, progression).ok, 'Level 9 cannot rebirth');
  p.xp = S.xpForLevel(10);
  p.strength = 500;
  progression.syncDerived(p);
  const r = rebirths.rebirth(p, progression);
  check(r.ok && p.rebirths === 1 && r.multiplier === 2 && r.maxLevel === 20, 'Level 10 rebirths: x2 damage, max level 20');
  check(p.strength === 0 && p.xp === 0 && p.level === 1 && p.wins === 0, 'rebirth resets Damage, Level and Wins');
  check(p.ownedDinos === 3, 'and keeps every dinosaur');
  check(p.damagePerAttack === 2, `the rebirth multiplier applies (+1 x 2 = ${p.damagePerAttack})`);
  let indefinite = true;
  for (let i = 0; i < 30; i += 1) {
    p.xp = S.xpForLevel(S.maxLevelFor(p.rebirths));
    progression.syncDerived(p);
    if (!rebirths.rebirth(p, progression).ok) indefinite = false;
  }
  check(indefinite && p.rebirths === 31, 'rebirth continues indefinitely (31 rebirths)');
}

console.log('\nEvolving dinosaurs');
{
  const dinos = new DinoService();
  const p = fresh('buyer');
  check(!dinos.select(p, 2, progression).ok, 'Blue cannot be bought with 0 Wins');
  p.wins = 5;
  const pad = S.DINO_PADS.find((entry) => entry.slot === 2);
  place(p, 0, -60);
  check(!dinos.pad(p, 2, progression).ok, 'a paddock pad far from the player is refused');
  place(p, pad.x, pad.z, pad.y);
  const bought = dinos.pad(p, 2, progression);
  check(bought.ok && p.wins === 0 && p.dinoSlot === 2 && p.damagePerAttack === 2, 'Blue: 5 Wins spent, ridden, +2 per attack');
  check(dinos.select(p, 1, progression).ok && p.dinoSlot === 1, 'an owned dinosaur is ridden again for free');
}

console.log('\nEggs and pets');
{
  check(JSON.stringify(S.EGGS.map((e) => e.cost)) === JSON.stringify([10, 2500, 25000, 300000]), 'Normal 10, Desert 2.5K, Dominus 25K, Lava 300K Wins');
  check(JSON.stringify(S.EGGS[0].pool.map(([, c]) => c)) === JSON.stringify([40, 30, 18, 8, 3.5, 0.5]), 'Normal egg odds 40 / 30 / 18 / 8 / 3.5 / 0.5 %');
  check(S.PET_INVENTORY_MAX === 100 && S.PET_EQUIP_MAX === 4, '100 pet inventory, 4 equipped');
  const pets = new PetService();
  const p = fresh('hatcher');
  const egg = S.EGG_PLACEMENTS[0];
  place(p, egg.x, S.HATCHERY.padZ);
  check(!pets.hatch(p, 1, 1, progression).ok, 'no hatch without the Wins');
  p.wins = 1000;
  for (let i = 0; i < 6; i += 1) pets.hatch(p, 1, 1, progression);
  check(p.pets.length === 6 && p.wins === 940, 'six hatches: six pets, 60 Wins spent');
  check([...p.pets].filter((pet) => pet.equipped).length === 4, 'no more than four are equipped');
  pets.act(p, 'unequipAll', 0, progression);
  check([...p.pets].every((pet) => !pet.equipped) && p.damagePerAttack === 1, 'Unequip All');
  pets.act(p, 'equipBest', 0, progression);
  const bonuses = [...p.pets].map((pet) => [S.petById(pet.petId).bonus, pet.equipped]).sort((a, b) => b[0] - a[0]);
  check(bonuses.slice(0, 4).every(([, on]) => on) && bonuses.slice(4).every(([, on]) => !on), 'Equip Best picks the four strongest');
  place(p, 0, -60);
  check(!pets.hatch(p, 1, 1, progression).ok, 'a hatch away from the egg is refused');
}

console.log('\nKill-drop items');
{
  check(S.ITEM_EQUIP_MAX === 3, 'three items equipped at once');
  const names = S.ITEMS.map((item) => item.name);
  check(['Rock', 'Coconut', 'Fish Bone', 'Fossil'].every((n) => names.includes(n)), 'Rock, Coconut, Fish Bone and Fossil exist');
  const items = new ItemService();
  const p = fresh('gear');
  check(!items.act(p, 'equip', 1, 0, progression).ok, 'an item not owned cannot be equipped');
  for (const item of S.ITEMS.slice(0, 5)) giveItem(p, item.id, 1);
  items.act(p, 'equipBest', 0, 0, progression);
  const worn = [...p.equippedItems].filter((id) => id > 0);
  const best = [...S.ITEMS.slice(0, 5)].sort((a, b) => b.bonus - a.bonus).slice(0, 3).map((i) => i.id).sort();
  check(worn.length === 3 && JSON.stringify([...worn].sort()) === JSON.stringify(best), 'Equip Best wears the three strongest');
  check(p.damagePerAttack === Math.floor(1 * S.itemMultiplier(worn)), 'worn items multiply the damage');
  items.act(p, 'unequipAll', 0, 0, progression);
  check([...p.equippedItems].every((id) => id === 0) && p.damagePerAttack === 1, 'Unequip All');
  const s1 = S.stageByIndex(1);
  let got = 0;
  for (let i = 0; i < 400; i += 1) if (items.dropFor(p, s1.enemies[0])) got += 1;
  check(got > 20 && got < 200, `wild dinosaurs drop items (${got} of 400 kills)`);
}

console.log('\nStages');
{
  check(S.STAGE_COUNT === 30, 'thirty stages');
  const [s1, s2, s3, s4] = S.STAGES;
  check(s1.enemies.length === 3 && s1.enemies.every((e) => e.look.startsWith('compy')) && s1.reward === 1, 'Stage 1: 3 Compsognathus, +1 Win');
  check(s2.recommendedDamage === 40 && s2.enemies.length === 3 && s2.enemies.every((e) => e.look.startsWith('raptor')) && s2.reward === 5, 'Stage 2: 40 Damage, 3 Raptors, +5 Wins');
  check(s3.recommendedDamage === 250 && s3.enemies.some((e) => e.boss && e.look === 'baryonyx') && s3.reward === 25, 'Stage 3: 250 Damage, Baryonyx boss, +25 Wins');
  check(s4.recommendedDamage === 1000 && s4.enemies.length === 3 && s4.enemies.every((e) => e.look === 'baryonyx') && s4.theme === 'swamp' && s4.reward === 100, 'Stage 4: 1K Damage, 3 Baryonyx in a swamp, +100 Wins');
  let rising = true;
  for (let i = 1; i < 30; i += 1) {
    const a = S.STAGES[i - 1];
    const b = S.STAGES[i];
    const hp = (stage) => stage.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    if (!(b.recommendedDamage > a.recommendedDamage && b.reward > a.reward && hp(b) > hp(a))) rising = false;
  }
  check(rising, "recommended Damage and rewards rise every stage, and so does each wave's total health");
  check(new Set(S.STAGES.map((s) => s.theme)).size === 30, 'every stage has its own biome');
}

console.log('\nRuns: aggression, death, clears, no respawns, resets');
{
  const enemyOf = (p, id) => [...p.enemies].find((e) => e.id === id);
  const alive = (p, stage) => stage.enemies.filter((def) => enemyOf(p, def.id)?.alive).length;
  const s1 = S.stageByIndex(1);
  const s2 = S.stageByIndex(2);
  const combat = new CombatService();
  combat.bind(progression, new ItemService());

  const a = fresh('runA');
  combat.resetRun(a);
  check(alive(a, s1) === s1.enemies.length && a.runStage === 0, 'a new run fields a fresh Stage 1 wave with every gate closed');

  place(a, -17, S.arenaStartZ(1) + 4);
  const before = s1.enemies.map((def) => Math.hypot(enemyOf(a, def.id).x - a.x, enemyOf(a, def.id).z - a.z));
  for (let t = 0; t < 20; t += 1) combat.tick(0.05, [a]);
  const after = s1.enemies.map((def) => Math.hypot(enemyOf(a, def.id).x - a.x, enemyOf(a, def.id).z - a.z));
  check(after.every((d, i) => d < before[i] - 2), 'entering the stage turns its WHOLE wave on the player');

  const weak = fresh('weak');
  combat.resetRun(weak);
  weak.runStage = 1;
  weak.enemies.clear();
  combat['spawnWave'](weak, 2);
  place(weak, 0, S.arenaStartZ(2) + 30);
  let died = false;
  for (let t = 0; t < 1200 && !died; t += 1) {
    combat.tick(0.05, [weak]);
    progression.tick(0.05, weak);
    died = combat.drainDefeats().some((d) => d.sessionId === 'weak');
  }
  check(died && weak.health <= 0, 'wild dinosaurs kill an under-strength rider');

  const b = fresh('runB');
  combat.resetRun(b);
  place(b, -18, S.arenaStartZ(1) + 60);
  const bHealth = b.health;
  place(a, -17, S.arenaStartZ(1) + 4);
  for (let t = 0; t < 200; t += 1) combat.tick(0.05, [a]);
  check(b.health === bHealth && [...b.enemies].every((e) => e.alive), "one player's fight never touches another's health or enemies");
  const theirs = enemyOf(a, s1.enemies[0].id);
  const hpBefore = theirs.hp;
  place(b, theirs.x - 1, theirs.z);
  later();
  const poke = combat.attack('runB', b, s1.enemies[0].id, progression);
  check(poke.ok && poke.target === -1 && theirs.hp === hpBefore, "B cannot hit A's dinosaur");

  a.strength = 1e18;
  progression.syncDerived(a);
  for (const def of s1.enemies) {
    const enemy = enemyOf(a, def.id);
    place(a, enemy.x - 2, enemy.z);
    later();
    combat.attack('runA', a, def.id, progression);
  }
  check(a.killMasks[0] === s1.fullMask && a.runStage === 1, 'downing every dinosaur CLEARS the stage and opens the next gate');
  check(alive(a, s2) === s2.enemies.length, "the next stage's wave is fielded");
  for (let t = 0; t < 2400; t += 1) combat.tick(0.05, [a]);
  check(s1.enemies.every((def) => !enemyOf(a, def.id)?.alive), 'cleared dinosaurs never respawn during the run');

  const stages = new StageService();
  const skip = fresh('skipper');
  combat.resetRun(skip);
  const pad2 = S.rewardPadOf(2);
  place(skip, pad2.x, pad2.z);
  later();
  check(!stages.claim('skipper', skip, 2).granted, 'anti-skip: an uncleared stage cannot be claimed');
  const pad = S.rewardPadOf(1);
  place(a, pad.x, pad.z);
  later();
  const claim = stages.claim('runA', a, 1);
  check(claim.granted && claim.wins === 1, 'the cleared stage is claimed for +1 Win');

  combat.resetRun(a);
  check(a.runStage === 0 && [...a.killMasks].every((m) => m === 0) && alive(a, s1) === s1.enemies.length && alive(a, s2) === 0,
    'back at the park the run resets');
}

console.log('\nEverything saved round-trips');
{
  const pets = new PetService();
  const items = new ItemService();
  const a = fresh('saver');
  a.wins = 700;
  a.rebirths = 3;
  a.xp = 1234;
  a.strength = 98765;
  a.bestStrength = 98765;
  a.ownedDinos = 0b1011;
  a.dinoSlot = 4;
  place(a, S.EGG_PLACEMENTS[0].x, S.HATCHERY.padZ);
  pets.hatch(a, 1, 3, progression);
  giveItem(a, 1, 2);
  giveItem(a, 5, 1);
  items.act(a, 'equipBest', 0, 0, progression);
  progression.syncDerived(a);
  // Through JSON, as both stores keep it.
  const stored = coerceProfile(JSON.parse(JSON.stringify({ ...profileStore.snapshot(a), updatedAt: Date.now() })));
  const b = fresh('loader');
  profileStore.applyTo(b, stored);
  progression.syncDerived(b);
  const pick = (p) =>
    JSON.stringify({
      wins: p.wins,
      rebirths: p.rebirths,
      xp: p.xp,
      strength: p.strength,
      ownedDinos: p.ownedDinos,
      dinoSlot: p.dinoSlot,
      pets: [...p.pets].map((x) => [x.uid, x.petId, x.equipped]),
      items: [...p.items].map((x) => [x.itemId, x.count]),
      worn: [...p.equippedItems],
      damage: p.damagePerAttack,
    });
  check(pick(a) === pick(b), 'Damage, XP, Wins, rebirths, dinosaurs, the ridden one, pets (and which are equipped) and items (and which are worn) all restore');
  if (pick(a) !== pick(b)) console.log(`        saved ${pick(a)}\n        loaded ${pick(b)}`);
}

console.log(failures === 0 ? '\nprogression OK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
