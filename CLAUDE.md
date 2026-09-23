# +1 Dino Evolution

Browser multiplayer dinosaur-riding evolution game: Three.js client, Colyseus server, npm workspaces
(`shared` / `server` / `client`). Infrastructure (Bloxity auth, persistence, Bux grants, deploy) follows
the Evolution series (`D:\+1 Katana Evolution`); gameplay, world and UI are this game's own.

## Commands

```bash
npm run dev                 # builds shared, then server (tsx watch, :2590) + Vite client (:5190)
npm run build               # shared + server + client (client/dist)
npm run typecheck           # all workspaces
npm run verify              # verify:progression + verify:layout + verify:assets
npm run verify:layout       # pads, teleports, mats, stage lanes and enemy posts clear of every solid
npm run verify:capacity     # needs a running server on :2590; 18 clients, expects 15-per-room routing
npm run verify:multiplayer  # needs a running server; one client walks + attacks, another watches
npm run verify:run          # needs a running server; a full stage run: hunted, clear, claim, death, reset
npm run verify:persistence  # identity/storage/migration/purchases, JSON and Mongo (if mongod is found)
npm run size:client         # client/dist size against the 12 MB budget
```

Dev-only dinosaur viewer: http://localhost:5190/dinolab.html (every look, every animation; not in the build).

Do NOT use python from the Bash tool on this machine. Use node/sed/perl. Never embed backticks in shell
strings (`node -e "..."`): write a .cjs file to the scratchpad and run it.

## Non-negotiable rules

- Ports: server **2590**, Vite **5190**, preview 4190. Room `dinoevolution`, Bloxity slug
  `dino-evolution`, 15 per room.
- **Client build under 12 MB** (currently ~4.4 MB). Only `assets/` ships as files; `verify-assets` pins digests.
- **Art style: a polished ROBLOX game** (the user's reference screenshots are the target). Everything is block-built,
  flat-coloured "plastic", no realistic textures:
  - Dinosaurs: species spec (`client/src/dinos/DinoSpecies.ts`) -> real skeleton -> `DinoBlocks.ts` builds RIGID
    BOXES welded one-per-bone (tapered body/neck/tail blocks, box skull/snout/jaw, pyramid teeth/claws/horns, slab
    sails/frills), flat per-face colour (back on top, flank on sides, belly under) and markings as decal blocks. One
    `SkinnedMesh` per animal, `flatShading` SmoothPlastic material; animated by `DinoAnimator.ts`.
  - World: `render/Studs.ts` draws Roblox studs in the shader from world position on every studded material
    (`PartBuilder` kinds, floors). `world/Nature.ts` / `ParkProps.ts` build trees, rocks, cliffs, props from blocks
    (layered-slab conifers, cube canopies, plank fronds, dirt terraces with grass caps). Hub palette constants live
    at the top of `HubWorld.ts`; arenas get `vivid()` biome colours, pale studded walls and dirt terraces.
  - Light: `Atmosphere.robloxAir` normalises every biome's air to clear, bright Roblox daylight (tint kept).
- **Damage is the progress stat and ATTACKING is the only way to earn it** (in the air, on a dummy, on a wild
  dinosaur). Walking pays nothing. Damage per attack = ridden dino x (rebirths + 1) x pets x items (x dummy),
  deterministic, nothing hidden: `shared/src/config/strength.ts`. XP is paid 1:1 with Damage, capped at the
  rebirth's max level (`leveling.ts`: 50 to Level 2, 155 at Level 4; speed 16 + 1 per level).
- No Shift sprint. Walk + jump only (`shared/src/sim/PlayerSim.ts`); the sim's body radius is the ridden dino's.
- Everything is server-authoritative: attack rate limit (`COMBAT` token bucket), target reach (the ridden dino's
  reach) against the server position, dummy rebirth gates, dino/egg purchases, item equips (only owned copies),
  stage clears (kill masks), reward claims (full kill mask, standing on the pad), rebirth eligibility
  (max level = 10 x (R + 1)).
- Pinned values (asserted by `verify:progression`): 13 dinos (Compsognathus +1 free ... Indominus Rex +18,500 /
  9.5M Wins); dummies x1/R0, x2/R1, x4/R2, x8/R4, x18/R6, x45/R9, x70/R12; eggs 10 / 2.5K / 25K / 300K Wins at
  40/30/18/8/3.5/0.5 %; 100 pets, 4 equipped; 3 items equipped; Stage 1 = 3 Compys +1 Win, Stage 2 = 40 Damage
  3 Raptors +5, Stage 3 = 250 Damage Baryonyx boss +25, Stage 4 = 1K Damage 3 Baryonyx (swamp) +100.
  30 stages, each its own biome (`client/src/world/Biomes.ts`).
- **Responsive HUD: one unit** `--u` with px floors/caps; the dinosaur HUD and menus live in
  `client/src/ui/dinoStyles.ts` (`dn-` classes), built by `Hud.ts` / `Windows.ts`. Left tiles stay small on narrow
  screens; status bottom centre.
- **Stage runs are per player** (`server/src/progression/CombatService.ts`). A run starts at every placement at the
  park (join, defeat, claim, respawn, Return pad, rebirth): `runStage` 0, `killMasks` wiped, a fresh Stage 1 wave in
  `PlayerState.enemies`. Entering a stage turns its whole wave on its owner; enemies hit only their owner and only
  their owner can hit them. Downed dinosaurs never respawn during the run; each can drop an item
  (`ItemService.dropFor`, crypto random, `rollDrop`). A clear opens the next gate and fields the next wave; a claim
  pays and sends the player home `CLAIM_HOME_DELAY_MS` later. A defeat is a DEATH STATE for `COMBAT.deathSeconds`
  (the dinosaur's death fall), then the server heals and sends them home.
- **No overlapping solids.** Every walkable surface / solid is in `shared/src/config/map.ts` (named solids such as
  `GATE_DOORS`, `COURTYARD_JEEP`, `FOSSIL_DISPLAYS`); scenery stands outside walls or is non-colliding decoration.

## Layout facts

- COMPACT by design (the user asked for it): park x -70..84, z -36..46; arenas 52 wide (halfWidth 26) x 72 long.
  Changing sizes means editing `shared/src/config/map.ts` (+ enemy POSTS in `stages.ts`), then `npm run verify:layout`
  and the test scripts that place players (they use arena-relative positions).
- Spawn (0, 0, -12) on a gold spawn plate in the OPEN lobby (no courtyard/cave), facing +Z. Behind it the park gate
  sits shut in the front wall (z -36). Player's LEFT is +X: the two-storey Dino Paddock (7 pads ground x 22..46, 6 upper
  x 46..80). RIGHT (-X): Training Grounds (x -62..-20) and the Hatchery behind them (z 24..44; eggs stay put). The whole
  BACK is the LEADERBOARD WALL (z 46): Top Rebirths / Top Damage / Top Playtime side by side, wall-mounted, with the
  archway to Stage 1 (HUB_GATE, 11 high) under the middle board. Arena 1 starts z=50; each arena 72 long + 8 gate.
- Locked dinosaurs are shown in full colour (plate + label say LOCKED); never black them out.
- Only Stage 1 has timber doors; later gates are a red forcefield. Flat ground dressing goes through
  `world/Decals.ts` (flush, polygon-offset); anything on a wall/terrace/outcrop stands at the height `cliff()` returns.

## Progress and identity

Per-key storage (`server/src/persistence/`), Mongo via `MONGODB_URI` else JSON (`DINO_DATA_DIR`), profile read
at join, Bloxity token verified server-side, guest -> account migration, webhook Bux grants. Profile:
`strength, bestStrength, xp, wins, lifetimeWins, rebirths, ownedDinos, dinoSlot, pets, nextPetUid, petsHatched,
items, equippedItems, kills, bestStage, playSeconds`.
