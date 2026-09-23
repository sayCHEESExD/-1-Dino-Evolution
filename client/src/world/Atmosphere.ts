import { STAGE_COUNT, stageAt, stageByIndex } from '@dino/shared';
import { Color, Fog } from 'three';
import type { SceneManager } from '../rendering/SceneManager.js';
import { BIOMES, type Atmosphere as Air, type Biome } from './Biomes.js';
import type { Sky } from './Sky.js';

const EASE = 1.4;

const cache = new Map<string, Air>();
const LIFT = new Color();

/** A colour with its lightness raised to at least `min`, its saturation scaled. */
const lift = (hex: number, min: number, sat = 1): number => {
  LIFT.setHex(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  LIFT.getHSL(hsl);
  LIFT.setHSL(hsl.h, Math.min(1, hsl.s * sat), Math.max(min, hsl.l));
  return LIFT.getHex();
};

/**
 * ROBLOX DAYLIGHT: every biome keeps its tint - the swamp's green haze, the
 * caldera's red, the tundra's blue - but the air is cleared and brightened to
 * the look of a Roblox map: a long clear view, a bright sky, strong bounce
 * light and never a murky, gritty gloom. Night biomes stay night, just
 * readable.
 */
const robloxAir = (key: string, air: Air): Air => {
  const cached = cache.get(key);
  if (cached) return cached;
  const night = air.sunIntensity < 1;
  const out: Air = {
    fog: lift(air.fog, night ? 0.28 : 0.66, 0.85),
    fogNear: Math.max(air.fogNear, night ? 90 : 150),
    fogFar: Math.max(air.fogFar, night ? 400 : 600),
    skyTop: lift(air.skyTop, night ? 0.16 : 0.48, 1.1),
    sky: lift(air.sky, night ? 0.24 : 0.68, 1.05),
    sun: lift(air.sun, 0.8),
    sunIntensity: Math.max(air.sunIntensity, night ? 1.0 : 1.9),
    hemiSky: lift(air.hemiSky, night ? 0.45 : 0.75),
    hemiGround: lift(air.hemiGround, night ? 0.2 : 0.4),
    hemiIntensity: Math.max(air.hemiIntensity, night ? 0.95 : 1.2),
    ambient: Math.max(air.ambient, night ? 0.42 : 0.55),
  };
  cache.set(key, out);
  return out;
};

/**
 * THE MOOD OF THE PLACE: fog, sky, sun, bounce light and ambient, eased toward
 * the biome the rider is standing in. Riding from the sunny park into the swamp
 * the air thickens and greens over a couple of seconds; into the caldera it
 * reddens and darkens; the moonlit jungle turns everything night-blue. This is
 * as much of what makes thirty stages feel like thirty places as the props are.
 */
export class Atmosphere {
  private readonly fog = new Color();
  private readonly skyTop = new Color();
  private readonly sky = new Color();
  private readonly sun = new Color();
  private readonly hemiSky = new Color();
  private readonly hemiGround = new Color();
  private near = 150;
  private far = 560;
  private sunIntensity = 2;
  private hemiIntensity = 1;
  private ambient = 0.45;
  private biomeKey = '';
  private readonly target = new Color();

  constructor(
    private readonly scene: SceneManager,
    private readonly skyDome: Sky,
  ) {
    this.snap(robloxAir('park', BIOMES.park.air));
  }

  /** The biome at a position: a stage's theme, or the park. */
  static biomeAt(z: number): { key: string; biome: Biome } {
    const stage = stageAt(z, STAGE_COUNT);
    const theme = stage > 0 ? stageByIndex(stage)!.theme : 'park';
    return { key: theme, biome: BIOMES[theme] };
  }

  private snap(air: Air): void {
    this.fog.setHex(air.fog);
    this.skyTop.setHex(air.skyTop);
    this.sky.setHex(air.sky);
    this.sun.setHex(air.sun);
    this.hemiSky.setHex(air.hemiSky);
    this.hemiGround.setHex(air.hemiGround);
    this.near = air.fogNear;
    this.far = air.fogFar;
    this.sunIntensity = air.sunIntensity;
    this.hemiIntensity = air.hemiIntensity;
    this.ambient = air.ambient;
    this.apply();
  }

  /** Jump straight to the mood at a position (a teleport or a respawn). */
  snapTo(z: number): void {
    const { key, biome } = Atmosphere.biomeAt(z);
    this.biomeKey = key;
    this.snap(robloxAir(key, biome.air));
  }

  update(delta: number, z: number): void {
    const { key, biome } = Atmosphere.biomeAt(z);
    this.biomeKey = key;
    const air = robloxAir(key, biome.air);
    const k = 1 - Math.exp(-EASE * delta);
    const ease = (color: Color, hex: number): void => {
      color.lerp(this.target.setHex(hex), k);
    };
    ease(this.fog, air.fog);
    ease(this.skyTop, air.skyTop);
    ease(this.sky, air.sky);
    ease(this.sun, air.sun);
    ease(this.hemiSky, air.hemiSky);
    ease(this.hemiGround, air.hemiGround);
    this.near += (air.fogNear - this.near) * k;
    this.far += (air.fogFar - this.far) * k;
    this.sunIntensity += (air.sunIntensity - this.sunIntensity) * k;
    this.hemiIntensity += (air.hemiIntensity - this.hemiIntensity) * k;
    this.ambient += (air.ambient - this.ambient) * k;
    this.apply();
  }

  get key(): string {
    return this.biomeKey;
  }

  private apply(): void {
    const scene = this.scene.scene;
    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(this.fog);
      scene.fog.near = this.near;
      scene.fog.far = this.far;
    }
    if (scene.background instanceof Color) scene.background.copy(this.fog);
    this.scene.sun.color.copy(this.sun);
    this.scene.sun.intensity = this.sunIntensity;
    this.scene.hemi.color.copy(this.hemiSky);
    this.scene.hemi.groundColor.copy(this.hemiGround);
    this.scene.hemi.intensity = this.hemiIntensity;
    this.scene.ambient.intensity = this.ambient;
    this.skyDome.setColors(this.skyTop, this.sky, this.fog, this.fog, this.sunIntensity / 2);
  }
}
