# +1 Dino Evolution

A browser multiplayer dinosaur evolution game. Ride your dinosaur, and every attack makes it stronger: train on
the dinosaur effigies, evolve from a Compsognathus through Blue, Triceratops, Spinosaurus and the Tyrannosaurus
to the Indominus Rex, hatch baby-dinosaur pets, collect fossils and bones from wild dinosaurs, rebirth for
permanent multipliers and fight through thirty prehistoric stages for Wins.

Three.js client, authoritative Colyseus server (15 players per room), hosted on Bloxity.

## Play

| Action | PC | Mobile |
| --- | --- | --- |
| Walk | WASD / arrows | left stick |
| Jump | Space | JUMP |
| Attack | click (hold) / F / E | ATTACK |
| Rebirth / Pets / Dinos / Items / Teleport | R / P / C / I / T | left tiles |
| Music | M | Music tile |

Standing at a training effigy attacks it automatically. Walk onto a paddock pad to evolve into (or ride) a
dinosaur, onto an egg's pad to hatch, and onto a stage's gold pad (after defeating every dinosaur) to claim its
Wins.

## Develop

```bash
npm install
npm run dev
```

Client on http://localhost:5190, server on :2590. See `CLAUDE.md` for the rules, verification scripts and
layout facts.

## Deploy (Bloxity Hosting)

`.github/workflows/deploy.yml` publishes on every push:

| Branch | Channel | Frontend | Backend (WebSocket) |
| --- | --- | --- | --- |
| `dev` | DEV | https://dino-evolution.dev.play.bloxity.io | wss://dino-evolution.dev.host.bloxity.io |
| `main` | PROD | https://dino-evolution.play.bloxity.io | wss://dino-evolution.host.bloxity.io |

Any other branch does not deploy. A manual run (Actions, "Run workflow") follows the same mapping.

- **Backend:** the Colyseus server is built from the root `Dockerfile` and pushed to
  `ghcr.io/<owner>/dino-evolution-server:<channel>-<sha>`. It is rolled with
  `POST https://legion.bloxity.io/v1/apps/dino-evolution/deploy`, using the commit SHA as the version,
  `seatCap` 15 (the room size) and `maxReplicas` 5. Legion injects `PORT` and `MONGODB_URI`, and
  probes `/health`.
- **Frontend:** `client/dist` is built with that channel's WebSocket URL baked in, zipped with
  `index.html` at the root, and uploaded raw to
  `POST https://api.bloxity.io/v1/hosting/games/dino-evolution/frontend?channel=<channel>&version=<sha>`.

One-time setup:

1. Create the game `dino-evolution` on https://hosting.bloxity.io (My Games).
2. Add the repository secret `LEGION_DEPLOY_TOKEN` (the token from My Games, behind the eye icon).
3. After the first run, make the GHCR package `dino-evolution-server` **public**: Legion pulls
   anonymously and Bloxity supports no registry credentials, so a private package leaves every pod unable
   to start and the backend answering 503 "game backend unreachable".
   - Owner-level packages: GitHub profile/org -> Packages -> `dino-evolution-server` -> Package settings
     -> Danger Zone -> Change visibility -> Public. For an ORGANISATION-owned package (this repo lives under
     `LEGiON-Platforms`), the org's member privileges must allow public packages first.
   - A quick check that needs no login: a public package answers 200, a private one 401.

     ```bash
     TOKEN=$(curl -s 'https://ghcr.io/token?scope=repository:OWNER/dino-evolution-server:pull&service=ghcr.io' | jq -r .token); curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" https://ghcr.io/v2/OWNER/dino-evolution-server/tags/list
     ```
   - Then re-run the deploy workflow so Legion pulls the image again.

Progress lives in the Legion-injected MongoDB, per channel, so deploys never reset players.
