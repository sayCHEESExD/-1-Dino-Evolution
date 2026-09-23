import {
  COMBAT,
  DINOS,
  DINO_PADS,
  DUMMIES,
  EGG_PLACEMENTS,
  HATCHERY,
  NO_TARGET,
  SPAWN,
  STAGE_COUNT,
  TRAINING,
  TRAINING_TIERS,
  WorldCollision,
  canRebirth,
  canTrainOn,
  dummyHeight,
  dummyTarget,
  formatAmount,
  formatWins,
  isDummyTarget,
  itemById,
  levelForXp,
  ownsDino,
  returnPadOf,
  rewardPadOf,
  riddenDino,
  stageAt,
  stageByIndex,
  type HitMessage,
  type ItemDroppedMessage,
  type NoticeMessage,
  type RespawnMessage,
  type StageAwardedMessage,
  type StageClearedMessage,
} from '@dino/shared';
import { Vector3 } from 'three';
import { AudioManager } from '../audio/AudioManager.js';
import { PlayerAudio } from '../audio/PlayerAudio.js';
import { attackVoiceOf } from '../audio/attackVoice.js';
import { AvatarDresser } from '../bloxity/AvatarDresser.js';
import { Bloxity } from '../bloxity/Bloxity.js';
import { lookFromLegion } from '../bloxity/avatarLook.js';
import { identityFromLegion } from '../bloxity/identity.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { ClaimCelebration } from '../combat/ClaimCelebration.js';
import { DamagePopups } from '../combat/DamagePopups.js';
import { ImpactEffects } from '../combat/ImpactEffects.js';
import { TargetSelector } from '../combat/TargetSelector.js';
import { clientConfig } from '../config/clientConfig.js';
import { ATTACK_SECONDS } from '../dinos/DinoAnimator.js';
import type { AttackKind } from '../dinos/DinoSpecies.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { InputManager } from '../input/InputManager.js';
import { NetworkClient } from '../net/NetworkClient.js';
import type { ConnectionStatus, NetItemStack, NetPet, NetPlayerState } from '../net/netTypes.js';
import { LocalPlayer } from '../player/LocalPlayer.js';
import { playerModelLoader, type PlayerModelReport } from '../player/PlayerModelLoader.js';
import { RemotePlayerManager } from '../player/RemotePlayerManager.js';
import { RendererManager } from '../rendering/RendererManager.js';
import { SceneManager } from '../rendering/SceneManager.js';
import { BloxityPanel } from '../ui/BloxityPanel.js';
import { Hud, Tile } from '../ui/Hud.js';
import { ICON, ITEM_ICON } from '../ui/icons.js';
import { ModelPortraits } from '../ui/ModelPortraits.js';
import { anyPanelOpen } from '../ui/Panel.js';
import {
  EggWindow,
  InventoryWindow,
  RebirthWindow,
  TeleportWindow,
  anyWindowOpen,
  showHatch,
  type InventoryState,
  type InventoryTab,
} from '../ui/Windows.js';
import { logger } from '../util/logger.js';
import { AmbientParticles } from '../world/AmbientParticles.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { HubWorld } from '../world/HubWorld.js';
import { Sky } from '../world/Sky.js';
import { StageWorld } from '../world/StageWorld.js';

const SCOPE = 'Game';

const shortcutOf = (event: KeyboardEvent): string => {
  const code = event.code;
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  if (code) return code.toLowerCase();
  return (event.key || '').toLowerCase();
};

/** Auto Bite is remembered per browser (a convenience; nothing is lost if storage is blocked). */
const AUTO_BITE_KEY = 'dino-evolution:auto-bite';
const loadAutoBite = (): boolean => {
  try {
    return window.localStorage.getItem(AUTO_BITE_KEY) === '1';
  } catch {
    return false;
  }
};
const saveAutoBite = (on: boolean): void => {
  try {
    window.localStorage.setItem(AUTO_BITE_KEY, on ? '1' : '0');
  } catch {
    /* storage blocked: the toggle still works for this session */
  }
};

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/** When, into a swing, the blow lands: where the effect and the crunch belong. */
const IMPACT_SECONDS = ATTACK_SECONDS * 0.42;

interface PendingImpact {
  time: number;
  readonly from: Vector3;
  readonly at: Vector3;
  readonly kind: AttackKind;
  readonly variant: number;
  readonly size: number;
  /** The attacker's species' attack voice, heard on the impact frame. */
  readonly voice: ReturnType<typeof attackVoiceOf>;
}

const PLACES = [
  { id: 'spawn', name: 'Spawn', detail: 'The waterfall camp' },
  { id: 'dinos', name: 'Dino Paddock', detail: 'Evolve your dinosaur' },
  { id: 'training', name: 'Training', detail: 'Attack the dummies' },
  { id: 'eggs', name: 'Hatchery', detail: 'Hatch pets' },
  { id: 'stage1', name: 'Stage 1', detail: 'Start a run' },
] as const;

/**
 * Composition root. Owns every subsystem and the per-frame order - input,
 * prediction, attacks, pads, camera, network, render - and no gameplay
 * rules: every point of Damage, Win, purchase, drop and kill is the server's.
 */
export class Game {
  private readonly renderer: RendererManager;
  private readonly sceneManager = new SceneManager();
  private readonly camera = new ThirdPersonCamera();
  private readonly input = new InputManager();
  private readonly collision = new WorldCollision();
  private readonly remotePlayers: RemotePlayerManager;
  private hub!: HubWorld;
  private readonly stages = new StageWorld();
  private readonly sky = new Sky();
  private readonly atmosphere: Atmosphere;
  private readonly particles = new AmbientParticles();
  private readonly enemies: EnemyManager;
  private readonly impacts = new ImpactEffects();
  private readonly celebration: ClaimCelebration;
  private readonly damage: DamagePopups;
  private readonly targets = new TargetSelector();
  private readonly hud: Hud;
  private readonly portraits: ModelPortraits;
  private readonly inventory: InventoryWindow;
  private readonly rebirthWindow: RebirthWindow;
  private readonly eggWindow: EggWindow;
  private readonly teleportWindow: TeleportWindow;
  private readonly rebirthTile: Tile;
  private readonly petsTile: Tile;
  private readonly dinosTile: Tile;
  private readonly itemsTile: Tile;
  private readonly teleportTile: Tile;
  private readonly biteTile: Tile;
  /** AUTO BITE: bite whenever a wild enemy is in reach (the server's rate limit and checks still apply). */
  private autoBite = loadAutoBite();
  private readonly musicTile: Tile;
  private readonly corner: HTMLDivElement;
  private readonly audio = new AudioManager();
  private readonly playerAudio: PlayerAudio;
  private readonly bloxity: Bloxity;
  private readonly bloxityPanel: BloxityPanel;
  private readonly fpsReadout: HTMLDivElement;
  private readonly network: NetworkClient;
  private readonly container: HTMLElement;
  private readonly impactsDue: PendingImpact[] = [];

  private dresser: AvatarDresser | null = null;
  private pendingAvatar: (() => void) | null = null;
  private fpsAccum = 0;
  private fpsFrames = 0;

  private localPlayer: LocalPlayer | null = null;
  private localSessionId: string | null = null;
  private local: NetPlayerState | null = null;
  private pendingRespawn: RespawnMessage | null = null;

  private sinceAttack = 99;
  private lastLevel = -1;
  private lastRebirths = -1;
  private lastDino = -1;
  private lastHealth = -1;
  private lastBiome = '';
  /** The pad the player last stood on, so each pad fires once per visit. */
  private onPad = '';
  private claimCooldown = 0;
  private lastEggPad = 0;
  private dismissedEgg = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new RendererManager(container);
    this.remotePlayers = new RemotePlayerManager(this.sceneManager.scene);
    this.atmosphere = new Atmosphere(this.sceneManager, this.sky);
    // Once per dinosaur downed in the local run: its death bellow. Once per boss unsealed: the challenge roar.
    this.enemies = new EnemyManager(
      this.sceneManager.scene,
      (def) => this.audio.play('enemyDeath', def.boss ? 1.3 : 0.8, 0, def.boss ? 0.7 : Math.min(1.5, 1.9 / Math.max(0.6, def.scale))),
      () => this.audio.play('roar', 1.2, 0, 0.85),
      // A wild dinosaur's blow on the rider, in its own species' attack voice (a boss a touch deeper).
      (def) => {
        const voice = attackVoiceOf(def.look);
        this.audio.attack(voice.kind, true, voice.pitch * (def.boss ? 0.88 : 1), def.boss ? 1 : 0.8);
      },
    );
    this.celebration = new ClaimCelebration(this.sceneManager.scene);
    this.damage = new DamagePopups(container);
    this.hud = new Hud(container);
    this.portraits = new ModelPortraits(this.renderer.renderer);

    this.inventory = new InventoryWindow(container, this.portraits, {
      selectDino: (slot) => this.network.dinoSelect(slot),
      petAction: (action, uid) => this.network.petAction(action, uid),
      itemAction: (action, item, slot) => this.network.itemAction(action, item, slot),
    });
    this.rebirthWindow = new RebirthWindow(container, () => this.network.requestRebirth());
    this.eggWindow = new EggWindow(container, this.portraits, (egg, count) => this.network.hatch(egg, count));
    this.eggWindow.onClose = () => {
      this.dismissedEgg = this.lastEggPad;
    };
    this.teleportWindow = new TeleportWindow(container, PLACES, (id) => this.network.teleport(id));

    const rail = this.hud.rail;
    this.rebirthTile = new Tile(rail, 'rebirth', 'Rebirth', ICON.rebirth, 'R', () => this.openOnly('rebirth'));
    this.petsTile = new Tile(rail, 'pets', 'Pets', ICON.pets, 'P', () => this.openOnly('pets'));
    this.dinosTile = new Tile(rail, 'dinos', 'Dinos', ICON.dinos, 'C', () => this.openOnly('dinos'));
    this.itemsTile = new Tile(rail, 'items', 'Items', ICON.backpack, 'I', () => this.openOnly('items'));
    this.teleportTile = new Tile(rail, 'teleport', 'Teleport', ICON.teleport, 'T', () => this.openOnly('teleport'));
    this.biteTile = new Tile(rail, 'bite', 'Auto Bite', ICON.bite, 'Q', () => {
      this.autoBite = !this.autoBite;
      this.biteTile.setOn(this.autoBite);
      saveAutoBite(this.autoBite);
    });
    this.biteTile.setOn(this.autoBite);
    this.corner = document.createElement('div');
    this.corner.className = 'dn-corner';
    container.appendChild(this.corner);
    this.musicTile = new Tile(this.corner, 'music', 'Music', ICON.sound, 'M', () => {
      this.musicTile.setOff(this.audio.toggleMuted());
    });

    this.playerAudio = new PlayerAudio(this.audio);

    this.bloxity = new Bloxity({
      setMasterVolume: (level) => this.audio.setMasterVolume(level),
      setMusicVolume: (level) => this.audio.setMusicVolume(level),
      setGraphicsQuality: (level) => this.renderer.setQuality(level),
      setShowFps: (show) => {
        this.fpsReadout.hidden = !show;
      },
      setCameraSensitivity: (scale) => this.input.look.setSensitivityScale(scale),
      respawn: () => this.network.requestRespawn(),
      pointerLockChanged: (locked) => this.input.look.setCursorFree(!locked),
      avatarChanged: (equipped, proportions) => {
        const look = lookFromLegion(equipped, proportions);
        this.network.sendAvatar(look);
        const apply = (): void => this.dresser?.setLook(look.appearance, look.proportions);
        if (this.dresser) apply();
        else this.pendingAvatar = apply;
      },
    });

    this.fpsReadout = document.createElement('div');
    this.fpsReadout.className = 'aoe-fps aoe-font';
    this.fpsReadout.hidden = true;
    container.appendChild(this.fpsReadout);

    this.bloxityPanel = new BloxityPanel(container, this.bloxity);

    window.addEventListener('keydown', this.onHotkey);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('mousedown', this.onGesture);
    window.addEventListener('touchstart', this.onGesture, { passive: true });

    this.renderer.onResize((width, height) => this.camera.setViewport(width, height));

    this.network = new NetworkClient({
      onStatusChange: (status) => this.onStatusChange(status),
      onSelfJoined: (sessionId) => {
        this.localSessionId = sessionId;
        const roomId = this.network.roomId;
        this.bloxity.updateRoom(roomId);
        this.bloxityPanel.setRoom(roomId);
      },
      onPlayerAdded: (sessionId, player) => this.onPlayerAdded(sessionId, player),
      onPlayerChanged: (sessionId, player) => this.onPlayerChanged(sessionId, player),
      onPlayerRemoved: (sessionId) => this.remotePlayers.remove(sessionId),
      onRespawn: (message) => {
        this.pendingRespawn = message;
        this.applyPendingRespawn();
      },
      onStageAwarded: (message) => this.onStageAwarded(message),
      onStageCleared: (message) => this.onStageCleared(message),
      onHit: (message) => this.onHit(message),
      onItemDropped: (message) => this.onItemDropped(message),
      onHatched: (message) => {
        this.audio.play('unlock');
        showHatch(this.container, this.portraits, message.pets.map((pet) => pet.petId));
      },
      onNotice: (message) => this.onNotice(message),
    });

    this.network.setTokenProvider(() => this.bloxity.getToken());
    this.network.setLookProvider(() => lookFromLegion(this.bloxity.getEquipped(), this.bloxity.getProportions()));
    this.network.setDisplayProvider(() => identityFromLegion(this.bloxity.getUser(), this.bloxity.getGuest()));
    this.bloxity.onUserChanged((user) => {
      this.network.sendAuth(this.bloxity.getToken());
      this.network.sendIdentity(identityFromLegion(user, this.bloxity.getGuest()));
    });
  }

  private readonly onHotkey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) return;
    if (isTyping(event.target)) return;
    switch (shortcutOf(event)) {
      case 'r':
        // R is also "Hatch x3" while an egg is open.
        if (!this.eggWindow.isOpen) this.rebirthTile.press();
        break;
      case 'p':
        this.petsTile.press();
        break;
      case 'c':
        this.dinosTile.press();
        break;
      case 'i':
        this.itemsTile.press();
        break;
      case 't':
        this.teleportTile.press();
        break;
      case 'q':
        this.biteTile.press();
        break;
      case 'm':
        this.musicTile.press();
        break;
      case 'escape':
        this.closeAll();
        this.input.look.setCursorFree(true);
        this.bloxity.showPortalMenu(true);
        break;
      default:
        break;
    }
  };

  private readonly onGesture = (): void => {
    this.audio.resume();
  };

  private closeAll(): void {
    this.inventory.setOpen(false);
    this.rebirthWindow.setOpen(false);
    this.eggWindow.setOpen(false);
    this.teleportWindow.setOpen(false);
  }

  private openOnly(which: 'rebirth' | 'teleport' | InventoryTab): void {
    this.eggWindow.setOpen(false);
    if (which === 'rebirth' || which === 'teleport') {
      const window = which === 'rebirth' ? this.rebirthWindow : this.teleportWindow;
      const other = which === 'rebirth' ? this.teleportWindow : this.rebirthWindow;
      this.inventory.setOpen(false);
      other.setOpen(false);
      window.toggle();
      return;
    }
    this.rebirthWindow.setOpen(false);
    this.teleportWindow.setOpen(false);
    if (this.local) this.inventory.setState(this.inventoryState(this.local));
    if (this.inventory.isOpen && this.inventory.currentTab === which) this.inventory.setOpen(false);
    else this.inventory.show(which);
  }

  startBloxity(): void {
    this.bloxity.start();
    document.body.classList.toggle('aoe-portal-embedded', this.bloxity.embedded);
  }

  loadingStep(text: string): void {
    this.bloxity.loadingStep(text);
  }

  async initialise(): Promise<PlayerModelReport> {
    const scene = this.sceneManager.scene;
    const report = await playerModelLoader.load();
    this.hub = new HubWorld();
    scene.add(this.sky.root, this.hub.root, this.stages.root, this.impacts.root, this.particles.points);

    this.localPlayer = new LocalPlayer(this.collision);
    this.dresser = new AvatarDresser(this.localPlayer.character);
    this.pendingAvatar?.();
    this.pendingAvatar = null;

    scene.add(this.localPlayer.character.root);
    scene.add(this.localPlayer.character.worldRoot);
    this.camera.setMountHeight(this.localPlayer.character.height);
    this.camera.snapTo(this.localPlayer.position);
    this.atmosphere.snapTo(this.localPlayer.position.z);

    logger.info(SCOPE, 'world ready');
    return report;
  }

  async connect(): Promise<void> {
    await this.network.connect();
  }

  start(): void {
    this.input.attach(this.renderer.renderer.domElement);
    this.bloxity.loadingEnd();
    this.bloxity.gameplayStart();
  }

  stop(): void {
    this.input.detach();
    this.bloxity.gameplayEnd();
    this.bloxity.updateRoom('');
    void this.network.disconnect();
  }

  // ---------------------------------------------------------------- frame

  update(delta: number, _now: number): void {
    // Windows own the screen; a claim celebration or the death fall holds the
    // rider still until the server sends them home.
    const dead = this.localPlayer?.character.dead ?? false;
    this.input.setSuppressed(anyWindowOpen() || anyPanelOpen() || this.celebration.playing || dead);
    const input = this.input.sample();
    const player = this.localPlayer;

    this.camera.setOrbit(this.input.look.yaw, this.input.look.pitch);
    this.camera.setZoom(this.input.look.zoom);

    if (player) {
      if (this.local) player.setParams(this.local.moveSpeed, this.local.jumpVelocity, this.local.runStage, riddenDino(this.local.dinoSlot, this.local.ownedDinos).radius);
      player.update(delta, input, this.input.look.yaw);
      this.snapCameraIfPlaced();
      this.camera.setTarget(player.position);
      this.sceneManager.followShadow(player.position.x, player.position.y, player.position.z);
      this.flushInput();
      if (!dead) {
        this.updateAttacks(delta, input.attack || input.attackHeld, this.autoBite, player);
        this.updatePads(delta, player);
      }
      this.playerAudio.update(delta, {
        horizontalSpeed: player.horizontalSpeed,
        isGrounded: player.isGrounded,
        jumpedEdge: player.jumpedEdge,
        landedEdge: player.landedEdge,
        hip: player.character.height * 0.42,
      });
      this.updateHud(player);
    }

    this.tickFps(delta);
    this.hub.scoreboard.update(this.network.leaderboard);
    const px = player?.position.x ?? SPAWN.x;
    const py = player?.position.y ?? 0;
    const pz = player?.position.z ?? SPAWN.z;
    this.sky.follow(px, pz);
    this.sky.update(delta);
    this.atmosphere.update(delta, pz);
    this.updateBiome();
    this.particles.update(delta, px, py, pz);
    this.hub.update(delta, px, pz);
    this.stages.update(delta, pz);
    this.enemies.update(delta, this.network.enemies, pz, this.local?.killMasks ?? null);
    this.remotePlayers.advance(delta, player?.position ?? null);
    this.playRemoteAttacks();
    this.updateImpacts(delta);
    this.impacts.update(delta);
    this.celebration.update(delta);
    this.targets.tick(delta);
    this.camera.update(delta, player?.horizontalSpeed ?? 0);
    this.damage.update(this.camera.camera, this.renderer.width, this.renderer.height);

    this.renderer.renderer.render(this.sceneManager.scene, this.camera.camera);
  }

  /** The biome changed underfoot: its air particles and its dust colour. */
  private updateBiome(): void {
    const key = this.atmosphere.key;
    if (key === this.lastBiome) return;
    this.lastBiome = key;
    const { biome } = Atmosphere.biomeAt(this.localPlayer?.position.z ?? SPAWN.z);
    this.particles.setBiome(biome.particles);
    this.impacts.setGround(biome.look.floor[1]);
  }

  // -------------------------------------------------------------- attacks

  /** The training dummy whose mat the player stands on, if any. */
  private dummyUnderfoot(player: LocalPlayer): number {
    const p = player.position;
    if (p.x < TRAINING.minX - 4 || p.x > TRAINING.maxX + 4) return -1;
    const radius = this.local ? riddenDino(this.local.dinoSlot, this.local.ownedDinos).radius : 1;
    for (const dummy of DUMMIES) {
      if (Math.hypot(dummy.x - p.x, dummy.z - p.z) <= dummy.mat + radius * 0.5) return dummy.tier;
    }
    return -1;
  }

  /**
   * ATTACKING. A click (or the ATTACK button) attacks; standing at a dummy
   * attacks it automatically; AUTO BITE bites only when a wild dinosaur is in
   * reach (never the air). The attack plays at once for feel; the server
   * rate-limits it, validates the reach and target, and pays the Damage.
   */
  private updateAttacks(delta: number, wanted: boolean, autoBite: boolean, player: LocalPlayer): void {
    this.sinceAttack += delta;
    const state = this.local;
    if (!state) return;
    const tier = this.dummyUnderfoot(player);
    const auto = tier >= 0 && canTrainOn(tier, state.rebirths) && state.health > 0;
    const biting = autoBite && state.health > 0;
    if (!wanted && !auto && !biting) return;
    if (this.sinceAttack < COMBAT.attackInterval || anyWindowOpen()) return;

    const dino = riddenDino(state.dinoSlot, state.ownedDinos);
    const p = player.position;
    const target = auto ? dummyTarget(tier) : this.targets.aim(p.x, p.z, player.yaw, dino.reach, this.network.enemies, state);
    // Auto Bite on its own waits for a wild enemy in reach.
    if (!wanted && !auto && (target === NO_TARGET || isDummyTarget(target))) return;
    this.sinceAttack = 0;

    const point = this.targetPoint(target, new Vector3());
    const yaw = point ? Math.atan2(point.x - p.x, point.z - p.z) : null;
    const variant = player.swing(yaw);
    const facing = yaw ?? player.yaw;
    const from = new Vector3(p.x, p.y + dino.height * 0.5, p.z);
    const at =
      point ??
      new Vector3(p.x + Math.sin(facing) * dino.reach * 0.7, p.y + dino.height * 0.35, p.z + Math.cos(facing) * dino.reach * 0.7);
    this.impactsDue.push({ time: IMPACT_SECONDS, from, at, kind: dino.attack, variant, size: dino.height / 4, voice: attackVoiceOf(dino.look) });
    this.network.attack(target);
    if (isDummyTarget(target)) this.hub.strikeDummy(target - 1000, facing);
  }

  /** Each swing's effect and crunch, on the frame the blow lands. */
  private updateImpacts(delta: number): void {
    for (let i = this.impactsDue.length - 1; i >= 0; i -= 1) {
      const impact = this.impactsDue[i]!;
      impact.time -= delta;
      if (impact.time > 0) continue;
      this.impactsDue.splice(i, 1);
      this.impacts.hit(impact.from, impact.at, impact.kind, impact.variant, impact.size);
      this.audio.attack(impact.voice.kind, false, impact.voice.pitch);
    }
  }

  /** Where a target is, for aiming and effects; null for thin air. */
  private targetPoint(target: number, out: Vector3): Vector3 | null {
    if (target === NO_TARGET) return null;
    if (isDummyTarget(target)) {
      const dummy = DUMMIES[target - 1000];
      return dummy ? out.set(dummy.x, TRAINING.floorTop + dummyHeight(dummy.half) * 0.6, dummy.z) : null;
    }
    const at = this.enemies.positionOf(target);
    return at ? out.set(at.x, at.height * 0.55, at.z) : null;
  }

  /** Other riders' attacks: the same burst, played where they stand. */
  private playRemoteAttacks(): void {
    this.remotePlayers.forEachVisible((remote) => {
      if (!remote.attacked) return;
      remote.attacked = false;
      const tier = remote.character.dinoTier;
      const root = remote.character.root.position;
      const yaw = remote.facing;
      const from = new Vector3(root.x, root.y + tier.height * 0.5, root.z);
      const at = new Vector3(root.x + Math.sin(yaw) * tier.reach * 0.7, root.y + tier.height * 0.35, root.z + Math.cos(yaw) * tier.reach * 0.7);
      this.impactsDue.push({ time: IMPACT_SECONDS, from, at, kind: tier.attack, variant: remote.variant, size: tier.height / 5, voice: attackVoiceOf(tier.look) });
    });
  }

  private onHit(message: HitMessage): void {
    if (message.gain > 0) this.hud.pop(`+${formatAmount(message.gain)}`, 'gain');
    if (message.target === NO_TARGET) return;
    this.targets.noteHit(message.target);
    if (isDummyTarget(message.target)) return;
    const at = this.enemies.positionOf(message.target);
    if (at && message.damage > 0) {
      this.damage.show(message.damage, at.x, at.height + 1.2, at.z, message.killed);
      if (message.killed && this.localPlayer) {
        const p = this.localPlayer.position;
        this.impacts.hit(new Vector3(p.x, p.y + 2, p.z), new Vector3(at.x, at.height * 0.5, at.z), 'stomp', 0, at.height / 4, true);
      }
    }
  }

  private onItemDropped(message: ItemDroppedMessage): void {
    const item = itemById(message.item);
    if (!item) return;
    if (message.kept) {
      const player = this.localPlayer;
      if (player) {
        const target = new Vector3();
        this.impacts.loot(item.icon, '#ffd23a', new Vector3(message.x, 1.5, message.z), () =>
          target.set(player.position.x, player.position.y + player.character.height * 0.8, player.position.z),
        );
      }
      this.audio.play('drop');
      this.hud.pop(item.name, 'loot', undefined, undefined, ITEM_ICON[item.icon]);
      this.hud.toast(`Found a ${item.name}! +${item.bonus}% Damage when equipped`, 'gold');
    } else {
      this.hud.toast(`Your bag is full - ${item.name} left behind`, 'bad');
    }
  }

  // ----------------------------------------------------------------- pads

  /**
   * PADS: standing on one is a REQUEST, sent once per visit. Paddock pads
   * evolve or ride, a reward pad claims (only when the stage is cleared), the
   * return pad goes home, an egg pad opens its egg.
   */
  private updatePads(delta: number, player: LocalPlayer): void {
    const p = player.position;
    const state = this.local;
    this.claimCooldown = Math.max(0, this.claimCooldown - delta);
    let pad = '';

    for (const dino of DINO_PADS) {
      if (Math.abs(p.x - dino.x) <= dino.half + 1 && Math.abs(p.z - dino.z) <= dino.half + 1 && Math.abs(p.y - dino.y) < 1.5) {
        pad = `dino:${dino.slot}`;
        if (this.onPad !== pad) this.network.dinoPad(dino.slot);
      }
    }

    const stage = stageAt(p.z, STAGE_COUNT);
    if (stage > 0 && state) {
      const reward = rewardPadOf(stage);
      if (Math.abs(p.x - reward.x) <= reward.half && Math.abs(p.z - reward.z) <= reward.half && p.y < 2.5) {
        pad = `reward:${stage}`;
        const def = stageByIndex(stage)!;
        const cleared = (state.killMasks[stage - 1] ?? 0) === def.fullMask;
        if (cleared && this.claimCooldown <= 0) {
          this.claimCooldown = 0.6;
          this.network.claimStage(stage);
        } else if (!cleared && this.onPad !== pad) {
          this.hud.toast('Defeat every dinosaur to claim this stage!', 'bad');
        }
      }
      const back = returnPadOf(stage);
      if (Math.abs(p.x - back.x) <= back.half && Math.abs(p.z - back.z) <= back.half && p.y < 2.5) {
        pad = `return:${stage}`;
        if (this.onPad !== pad) this.network.teleport('spawn');
      }
    }

    let egg = 0;
    for (const placement of EGG_PLACEMENTS) {
      if (Math.hypot(p.x - placement.x, p.z - HATCHERY.padZ) <= HATCHERY.padHalf + 1) egg = placement.egg;
    }
    if (egg !== this.lastEggPad) {
      this.lastEggPad = egg;
      this.dismissedEgg = 0;
      if (egg > 0) {
        this.closeAll();
        this.eggWindow.openEgg(egg);
      } else if (this.eggWindow.isOpen) {
        this.eggWindow.setOpen(false);
      }
    }
    this.onPad = pad;
  }

  // ------------------------------------------------------------------ HUD

  private updateHud(player: LocalPlayer): void {
    const state = this.local;
    if (!state) return;
    const p = player.position;
    const stage = stageAt(p.z, STAGE_COUNT);
    const def = stage > 0 ? stageByIndex(stage) : undefined;

    const focus = this.targets.focus(p.x, p.z, this.network.enemies, state);
    let info = '';
    if (def) {
      const alive = EnemyManager.aliveIn(stage, this.network.enemies);
      info = `Stage ${def.index}: ${def.name}  -  Recommended Damage ${formatAmount(def.recommendedDamage)}  -  Dinosaurs ${alive}/${def.enemies.length}`;
    }
    this.hud.setFocus(
      focus
        ? { name: focus.name, value: focus.value, max: focus.max, boss: focus.boss, lock: focus.lockText, dummy: focus.kind === 'dummy' }
        : null,
      info,
    );
    this.hud.setHealth(state.health, state.maxHealth, stage > 0 || state.health < state.maxHealth);
    this.hud.setHint(anyWindowOpen() ? '' : this.hintFor(state, stage, player));
  }

  private hintFor(state: NetPlayerState, stage: number, player: LocalPlayer): string {
    const touch = document.body.classList.contains('aoe-touch-mode');
    const tier = this.dummyUnderfoot(player);
    if (tier >= 0 && !canTrainOn(tier, state.rebirths)) {
      return `The ${TRAINING_TIERS[tier]!.name} needs ${TRAINING_TIERS[tier]!.rebirthsRequired} Rebirths`;
    }
    const level = levelForXp(state.xp, state.rebirths).level;
    if (canRebirth(level, state.rebirths) && stage === 0) return 'Max level! Open the Rebirth menu' + (touch ? '' : ' (R)');
    if (stage > 0) {
      const def = stageByIndex(stage)!;
      if ((state.killMasks[stage - 1] ?? 0) === def.fullMask) {
        return stage < STAGE_COUNT
          ? `Stage cleared! Claim ${formatWins(def.reward)} Wins on the gold pad - or push on to Stage ${stage + 1}`
          : `Final stage cleared! Claim your ${formatWins(def.reward)} Wins on the gold pad`;
      }
      if (state.strength < def.recommendedDamage) {
        return `This stage recommends ${formatAmount(def.recommendedDamage)} Damage - train on the dummies to get stronger!`;
      }
      return '';
    }
    if (state.bestStage === 0 && state.strength < 10) {
      return touch
        ? 'Tap ATTACK to gain Damage! The training dummies are to your RIGHT'
        : 'Click to attack and gain Damage! The training dummies are to your RIGHT';
    }
    const next = DINOS.find((dino) => !ownsDino(state.ownedDinos, dino.slot));
    if (next && state.wins >= next.cost) return `You can evolve into ${next.name}! Visit the Dino Paddock to your LEFT`;
    if (state.pets.length === 0 && state.wins >= 10) return 'Hatch a pet at the Hatchery behind the training grounds!';
    if (state.bestStage === 0 && state.strength >= 10) return 'Head through the archway under the leaderboards to fight Stage 1!';
    return '';
  }

  private tickFps(delta: number): void {
    if (this.fpsReadout.hidden) return;
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum < 0.5) return;
    this.fpsReadout.textContent = `${Math.round(this.fpsFrames / this.fpsAccum)} FPS`;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
  }

  private flushInput(): void {
    const player = this.localPlayer;
    if (!player) return;
    for (const message of player.drainOutgoing()) this.network.sendInput(message);
  }

  private applyPendingRespawn(): void {
    const player = this.localPlayer;
    const message = this.pendingRespawn;
    if (!player || !message) return;
    this.pendingRespawn = null;
    player.teleport(message.x, message.y, message.z, message.rotationY);
    this.input.look.setYaw(message.rotationY);
    this.atmosphere.snapTo(message.z);
    // Back at the park: a new run, every stage reset.
    this.targets.clear();
  }

  private snapCameraIfPlaced(): void {
    const player = this.localPlayer;
    if (!player) return;
    const placement = player.consumePlacement();
    if (placement === 'none') return;
    this.camera.snapTo(player.position, placement === 'respawn');
  }

  // ---------------------------------------------------------------- state

  private onPlayerAdded(sessionId: string, state: NetPlayerState): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      return;
    }
    this.remotePlayers.add(sessionId, state);
    this.bloxity.playerJoined(sessionId);
    this.bloxity.playerInRoom(sessionId);
  }

  private onPlayerChanged(sessionId: string, state: NetPlayerState): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      return;
    }
    this.remotePlayers.update(sessionId, state);
  }

  private inventoryState(state: NetPlayerState): InventoryState {
    const pets: NetPet[] = [];
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet) pets.push({ uid: pet.uid, petId: pet.petId, equipped: pet.equipped });
    }
    const items: NetItemStack[] = [];
    for (let i = 0; i < state.items.length; i += 1) {
      const stack = state.items[i];
      if (stack && stack.count > 0) items.push({ itemId: stack.itemId, count: stack.count });
    }
    const equippedItems = Array.from({ length: state.equippedItems.length }, (_, i) => state.equippedItems[i] ?? 0);
    return {
      wins: state.wins,
      rebirths: state.rebirths,
      dinoSlot: state.dinoSlot,
      ownedDinos: state.ownedDinos,
      pets,
      items,
      equippedItems,
    };
  }

  /** Everything the server says about the local player. It derives none of it. */
  private applyLocalState(state: NetPlayerState): void {
    const player = this.localPlayer;
    if (!player) return;
    this.local = state;
    const first = this.lastLevel < 0;
    const dino = riddenDino(state.dinoSlot, state.ownedDinos);

    player.setParams(state.moveSpeed, state.jumpVelocity, state.runStage, dino.radius);
    if (this.lastDino !== state.dinoSlot) {
      player.setDino(state.dinoSlot);
      this.camera.setMountHeight(player.character.height);
      if (!first) {
        player.roar();
        this.audio.play('roar', 1, 0, Math.min(1.4, Math.max(0.7, 4.5 / dino.height)));
        this.hud.toast(`Now riding ${dino.name}!`, 'gold');
      }
      this.lastDino = state.dinoSlot;
    }

    // 0 health is the server's death state. The fall plays once, as it begins.
    const dead = state.health <= 0;
    if (dead && !player.character.dead) {
      this.audio.play('death');
      this.hud.defeated(`Respawning at camp...`);
    }
    player.character.setDead(dead);
    if (!dead && this.lastHealth > 0 && state.health < this.lastHealth - 0.01) {
      const share = (this.lastHealth - state.health) / Math.max(1, state.maxHealth);
      this.hud.hurtFlash(share * 4);
      this.audio.play('hurt', Math.min(1, 0.4 + share * 3));
      player.flinch();
    }
    this.lastHealth = state.health;

    player.setDisplayName(state.displayName, state.avatarUrl);
    const petIds: number[] = [];
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet?.equipped) petIds.push(pet.petId);
    }
    player.setPets(petIds);

    if (state.ready) {
      player.reconcile({
        x: state.x,
        y: state.y,
        z: state.z,
        rotationY: state.rotationY,
        velocityX: state.velocityX,
        velocityY: state.velocityY,
        velocityZ: state.velocityZ,
        grounded: state.grounded,
        jumpLatched: state.jumpLatched,
        jumpCount: state.jumpCount,
        lastInputSeq: state.lastInputSeq,
      });
    }

    this.hud.setStats({
      strength: state.strength,
      xp: state.xp,
      rebirths: state.rebirths,
      multiplier: state.multiplier,
      speed: state.moveSpeed,
      wins: state.wins,
      damagePerAttack: state.damagePerAttack,
      mount: dino.name,
      mountColor: dino.color,
    });
    this.hub.setDinos(state.wins, state.ownedDinos, state.dinoSlot);
    this.hub.setRebirths(state.rebirths);
    this.stages.setProgress(state.runStage, state.killMasks);

    const level = levelForXp(state.xp, state.rebirths).level;
    if (!first && level > this.lastLevel && state.rebirths === this.lastRebirths) {
      this.audio.play('level');
      this.hud.levelUp(this.lastLevel, level, state.moveSpeed);
    }
    if (this.lastRebirths >= 0 && state.rebirths > this.lastRebirths) this.audio.play('rebirth');
    this.lastLevel = level;
    this.lastRebirths = state.rebirths;

    this.rebirthWindow.setProgress(state.xp, state.rebirths);
    this.rebirthTile.setReady(this.rebirthWindow.isEligible);
    this.rebirthTile.setPercent(`${Math.floor(this.rebirthWindow.progress * 100)}%`);
    const affordable = DINOS.some((tier) => !ownsDino(state.ownedDinos, tier.slot) && state.wins >= tier.cost);
    this.dinosTile.setReady(affordable);
    let equipped = false;
    for (let i = 0; i < state.pets.length; i += 1) equipped = equipped || !!state.pets[i]?.equipped;
    this.petsTile.setReady(state.pets.length > 0 && !equipped);
    let worn = false;
    for (let i = 0; i < state.equippedItems.length; i += 1) worn = worn || (state.equippedItems[i] ?? 0) > 0;
    this.itemsTile.setReady(state.items.length > 0 && !worn);
    this.inventory.setState(this.inventoryState(state));
    this.eggWindow.setState(state.wins, state.pets.length);
  }

  private onNotice(message: NoticeMessage): void {
    switch (message.kind) {
      case 'bought':
        this.audio.play('unlock');
        this.hud.toast(message.text, 'good');
        break;
      case 'equipped':
        this.audio.play('buy');
        this.hud.toast(message.text, 'good');
        break;
      case 'rebirth':
        this.hud.toast(message.text, 'pink');
        break;
      case 'refused':
      case 'locked':
        this.audio.play('refuse');
        this.hud.toast(message.text, 'bad');
        break;
      case 'info':
        this.hud.toast(message.text, 'gold');
        break;
    }
  }

  private onStageCleared(message: StageClearedMessage): void {
    const def = stageByIndex(message.stage);
    this.audio.play('claim');
    this.hud.toast(`${def?.name ?? `Stage ${message.stage}`} cleared! Claim your Wins or continue`, 'gold');
  }

  /** A claim the SERVER granted (once per claim): the trophy celebration, then the server sends us home. */
  private onStageAwarded(message: StageAwardedMessage): void {
    if (this.localPlayer) this.celebration.play(this.localPlayer.position);
    this.audio.play('win');
    this.hud.toast(`+${formatWins(message.wins)} Win${message.wins === 1 ? '' : 's'}!`, 'gold');
    logger.info(SCOPE, `stage ${message.stage} banked: +${message.wins} wins`);
  }

  private onStatusChange(status: ConnectionStatus): void {
    if (clientConfig.debug) logger.info(SCOPE, `connection: ${status}`);
    if (status === 'reconnecting') this.hud.toast('Reconnecting...', 'bad');
  }

  dispose(): void {
    this.stop();
    this.hud.dispose();
    this.damage.dispose();
    this.impacts.dispose();
    this.celebration.dispose();
    this.enemies.dispose();
    this.inventory.dispose();
    this.rebirthWindow.dispose();
    this.eggWindow.dispose();
    this.teleportWindow.dispose();
    this.portraits.dispose();
    this.corner.remove();
    window.removeEventListener('keydown', this.onHotkey);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('mousedown', this.onGesture);
    window.removeEventListener('touchstart', this.onGesture);
    this.bloxity.dispose();
    this.bloxityPanel.dispose();
    this.dresser?.dispose();
    this.fpsReadout.remove();
    this.audio.dispose();
    this.remotePlayers.dispose();
    this.particles.dispose();
    this.hub?.dispose();
    this.stages.dispose();
    this.sky.dispose();
    this.renderer.dispose();
  }
}

