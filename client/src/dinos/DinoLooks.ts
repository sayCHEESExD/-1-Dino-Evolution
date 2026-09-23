import type { Feature, SpeciesId } from './DinoSpecies.js';

/**
 * HOW EACH DINOSAUR IS PAINTED: a species plus a skin.
 *
 * Skins are clean plastic colours: a back, a flank and a belly tone, and the
 * markings real reptiles wear (tiger bands, a lateral stripe, spots, a dark
 * saddle) as crisp blocks. The rideable thirteen are bright and readable
 * from across the park; wild ones are a little more muted.
 *
 * `material` turns a look into something that is not skin: the carved
 * training effigies (wood, straw, stone, bone, iron, amber, obsidian) and the
 * locked silhouettes in the paddock.
 */
export type SkinPattern = 'none' | 'tiger' | 'lateral' | 'spots' | 'mottle' | 'bands' | 'saddle';

export type SkinMaterial = 'skin' | 'wood' | 'straw' | 'stone' | 'bone' | 'iron' | 'amber' | 'obsidian';

export interface Palette {
  readonly back: string;
  readonly side: string;
  readonly belly: string;
  readonly pattern: SkinPattern;
  readonly patternColor: string;
  /** Pattern frequency multiplier. */
  readonly patternScale: number;
  /** 0..1 how strongly the pattern shows. */
  readonly patternStrength: number;
  /** Crests, sails, frills, feathers, quills. */
  readonly accent: string;
  readonly accent2: string;
  readonly horn: string;
  readonly claw: string;
  readonly teeth: string;
  readonly mouth: string;
  readonly eye: string;
  /** Glowing eyes (hybrids, the lava pets). */
  readonly eyeGlow?: boolean;
  readonly material?: SkinMaterial;
  readonly roughness?: number;
  readonly metalness?: number;
  /** Emissive tint for lava and amber looks. */
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
}

export interface Look {
  readonly species: SpeciesId;
  readonly palette: Palette;
  /** Overall size relative to the species' natural size. */
  readonly scale?: number;
  /** Hatchling proportions: a bigger head, shorter snout, stubbier tail. */
  readonly juvenile?: boolean;
  /** Player mounts carry a saddle. */
  readonly saddle?: boolean;
  /** Voice pitch for the roar, 1 = as recorded. */
  readonly voice?: number;
  /** Extra anatomy or gear this look wears beyond its species' own. */
  readonly features?: readonly Feature[];
}

const base = {
  patternScale: 1,
  patternStrength: 0.7,
  horn: '#d8cfb8',
  claw: '#2a2522',
  teeth: '#f1ead6',
  mouth: '#7a3a3a',
  eye: '#e0a22a',
} as const;

const skin = (p: Partial<Palette> & Pick<Palette, 'back' | 'side' | 'belly' | 'pattern' | 'patternColor' | 'accent'>): Palette => ({
  ...base,
  accent2: p.accent,
  ...p,
});

// ------------------------------------------------------------------ palettes

const P = {
  compy: skin({ back: '#2e8f2a', side: '#3fbf3a', belly: '#d9ef7a', pattern: 'lateral', patternColor: '#f4d63a', patternStrength: 0.9, accent: '#f4d63a', eye: '#f4d63a' }),
  blue: skin({ back: '#8f98a3', side: '#d6dbe0', belly: '#f2f3f4', pattern: 'lateral', patternColor: '#1e4fd0', patternStrength: 1, accent: '#2a62d8', eye: '#f2c43a' }),
  gallimimus: skin({ back: '#a0703a', side: '#d8a15a', belly: '#f5e6c0', pattern: 'tiger', patternColor: '#6a4220', patternScale: 1.4, accent: '#e8903a', eye: '#f0b23a' }),
  parasaurolophus: skin({ back: '#3f9a3a', side: '#74c05a', belly: '#eef2d8', pattern: 'bands', patternColor: '#2a6a2a', patternScale: 1.1, accent: '#ff6a2a', accent2: '#ffc04a', eye: '#e8a02a' }),
  pyroraptor: skin({ back: '#c0321e', side: '#ec5a2a', belly: '#f6d4a8', pattern: 'tiger', patternColor: '#5a140a', patternScale: 1.8, accent: '#ff8a2a', accent2: '#2a0e0a', eye: '#ffd23a' }),
  triceratops: skin({ back: '#d88a1e', side: '#f0aa36', belly: '#f6e0a8', pattern: 'bands', patternColor: '#b0661a', patternStrength: 0.6, accent: '#e86a2a', accent2: '#ffd06a', horn: '#f4ecd6', eye: '#6a3a10' }),
  therizinosaurus: skin({ back: '#3a58b0', side: '#5a7ad0', belly: '#dfe6f4', pattern: 'saddle', patternColor: '#26407a', accent: '#8aa8e8', accent2: '#26407a', claw: '#1e2230', eye: '#f2c43a' }),
  spinosaurus: skin({ back: '#c89a3a', side: '#e8c46a', belly: '#f8ecc8', pattern: 'bands', patternColor: '#8a5a1e', patternStrength: 0.6, accent: '#e8502a', accent2: '#ffb04a', eye: '#e8a02a' }),
  allosaurus: skin({ back: '#2a5aa8', side: '#4a7ad0', belly: '#dce6f4', pattern: 'tiger', patternColor: '#1a3a78', patternScale: 1.3, accent: '#e84a2a', eye: '#f2c43a' }),
  ceratosaurus: skin({ back: '#c85a4a', side: '#e88a78', belly: '#f6dcd0', pattern: 'tiger', patternColor: '#7a2a22', patternScale: 1.5, patternStrength: 0.85, accent: '#ff3a2a', horn: '#ff5a3a', eye: '#ffc23a' }),
  tyrannosaurus: skin({ back: '#c89a3a', side: '#e2b85a', belly: '#f4e2b0', pattern: 'saddle', patternColor: '#9a6c26', patternStrength: 0.6, accent: '#8a5a2a', eye: '#f0b23a' }),
  indoraptor: skin({ back: '#18181e', side: '#2a2a32', belly: '#4a4a54', pattern: 'lateral', patternColor: '#ffc21a', patternStrength: 1, accent: '#1a1a1e', accent2: '#ffc21a', eye: '#ffe23a', eyeGlow: true }),
  indominus: skin({ back: '#d6dbe2', side: '#f1f3f6', belly: '#ffffff', pattern: 'saddle', patternColor: '#a8b0bc', patternStrength: 0.4, accent: '#a8b0bc', horn: '#c8ccd2', eye: '#ff3a2a', eyeGlow: true }),

  // Wild variants.
  compyWild: skin({ back: '#5a6a2e', side: '#8a9a42', belly: '#e0dca0', pattern: 'tiger', patternColor: '#34401a', patternScale: 2.2, accent: '#a8c24a' }),
  raptorWild: skin({ back: '#4a5058', side: '#7a8088', belly: '#cfd0c8', pattern: 'lateral', patternColor: '#2a4a7a', patternStrength: 0.8, accent: '#3a5a8a', eye: '#e6c23a' }),
  baryonyx: skin({ back: '#4a5a3e', side: '#6e7e56', belly: '#c9c49a', pattern: 'tiger', patternColor: '#2a3a24', patternScale: 1.2, accent: '#c86a2a', eye: '#e0a22a' }),
  baryonyxLagoon: skin({ back: '#2e5a5a', side: '#4a8080', belly: '#d0d8c4', pattern: 'tiger', patternColor: '#1a3a3e', patternScale: 1.2, accent: '#3ac0c0', eye: '#e0c23a' }),
  dilophosaurus: skin({ back: '#4e6a3a', side: '#8aa04e', belly: '#e0d6a0', pattern: 'spots', patternColor: '#e0c23a', patternScale: 1.6, accent: '#e84a2a', accent2: '#f0d23a', eye: '#1a1a1a' }),
  monolophosaurus: skin({ back: '#7a4a2a', side: '#a86e3a', belly: '#e0c89a', pattern: 'tiger', patternColor: '#4a2a18', accent: '#e0703a', eye: '#e0a22a' }),
  pachy: skin({ back: '#6a5a3e', side: '#9a845a', belly: '#dccaa0', pattern: 'bands', patternColor: '#4a3a24', accent: '#c8a060', horn: '#8a7a5a', eye: '#c98a2a' }),
  stygimoloch: skin({ back: '#5a3e2e', side: '#8a5a3e', belly: '#d8b894', pattern: 'bands', patternColor: '#3a2618', accent: '#d8703a', horn: '#3a2a22', eye: '#e0a22a' }),
  ankylosaurus: skin({ back: '#5a5040', side: '#7a6e56', belly: '#b8aa8a', pattern: 'mottle', patternColor: '#3a3428', accent: '#8a7a5a', horn: '#cfc4a8', eye: '#b87a2a' }),
  utahraptor: skin({ back: '#5a4a3a', side: '#8a7456', belly: '#d8caa8', pattern: 'tiger', patternColor: '#3a2e22', accent: '#b8906a', accent2: '#3a2e22', eye: '#e0a22a' }),
  utahSnow: skin({ back: '#c9ced4', side: '#e0e4e8', belly: '#f4f6f6', pattern: 'mottle', patternColor: '#8a94a0', patternStrength: 0.45, accent: '#e8eef4', accent2: '#8a94a0', eye: '#7ac8ff' }),
  utahStorm: skin({ back: '#2e3440', side: '#4e5664', belly: '#a8b0bc', pattern: 'tiger', patternColor: '#12161e', accent: '#6a8ac8', accent2: '#c8d8ff', eye: '#8ad8ff', eyeGlow: true }),
  metriacanthosaurus: skin({ back: '#6a3a2a', side: '#9a5a3a', belly: '#dcc09a', pattern: 'tiger', patternColor: '#3a1e14', accent: '#d8703a', eye: '#e0a22a' }),
  kentrosaurus: skin({ back: '#5a5a3a', side: '#8a8a56', belly: '#d0caa0', pattern: 'bands', patternColor: '#3a3a24', accent: '#c86a3a', accent2: '#e0b060', horn: '#e0d0b0', eye: '#b87a2a' }),
  stegosaurus: skin({ back: '#4e5a3a', side: '#7a8a56', belly: '#cfcaa0', pattern: 'mottle', patternColor: '#34401e', accent: '#c8503a', accent2: '#e0a060', horn: '#e0d6bc', eye: '#b87a2a' }),
  styracosaurus: skin({ back: '#6a5a3e', side: '#9a845a', belly: '#d8caa0', pattern: 'mottle', patternColor: '#4a3e28', accent: '#c8703a', accent2: '#3a2a1e', horn: '#e0d6bc', eye: '#b87a2a' }),
  sinoceratops: skin({ back: '#5a4a3a', side: '#8a6e56', belly: '#d8c4a8', pattern: 'bands', patternColor: '#3a2e24', accent: '#e0a03a', accent2: '#c83a2a', horn: '#e0d6bc', eye: '#b87a2a' }),
  majungasaurus: skin({ back: '#6a3a30', side: '#9a5a44', belly: '#dcc0a0', pattern: 'mottle', patternColor: '#3e1e18', accent: '#c8402a', eye: '#e0a22a' }),
  majungaBone: skin({ back: '#b8ac94', side: '#d8ccb4', belly: '#f0e8d6', pattern: 'bands', patternColor: '#6a5e4a', accent: '#8a7e6a', eye: '#e0a22a' }),
  carnotaurus: skin({ back: '#6a2a22', side: '#9a4434', belly: '#d8b894', pattern: 'mottle', patternColor: '#3a1410', accent: '#1e1a18', horn: '#3a2a22', eye: '#ffc23a' }),
  carnoMagma: skin({ back: '#1e1614', side: '#3a2420', belly: '#6a3a2a', pattern: 'tiger', patternColor: '#ff5a1a', patternStrength: 0.9, accent: '#ff6a1a', horn: '#1a1210', eye: '#ffb03a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.25 }),
  dimetrodon: skin({ back: '#5a4a3a', side: '#8a6e54', belly: '#c8b494', pattern: 'mottle', patternColor: '#3a2e24', accent: '#c8603a', accent2: '#f0b060', eye: '#c98a2a' }),
  suchomimus: skin({ back: '#5a5a44', side: '#86865e', belly: '#d8d0a4', pattern: 'tiger', patternColor: '#3a3a2a', accent: '#c8903a', eye: '#e0a22a' }),
  spinoWild: skin({ back: '#3a3e36', side: '#5e6454', belly: '#c4bca0', pattern: 'mottle', patternColor: '#22261e', accent: '#2a7ac8', accent2: '#8ad0f0', eye: '#e0a22a' }),
  spinoMeteor: skin({ back: '#1a1a22', side: '#2e2e3a', belly: '#5a5a6a', pattern: 'spots', patternColor: '#4aff8a', patternStrength: 0.8, accent: '#3aff7a', accent2: '#0a2a1a', eye: '#6aff9a', eyeGlow: true, emissive: '#2aff6a', emissiveIntensity: 0.18 }),
  atrociraptor: skin({ back: '#4a2e22', side: '#7a4a32', belly: '#c89a78', pattern: 'tiger', patternColor: '#241410', patternScale: 1.8, accent: '#8a4a2a', eye: '#ffc23a' }),
  atrociraptorShadow: skin({ back: '#101014', side: '#1e1e26', belly: '#3a3a44', pattern: 'tiger', patternColor: '#3a1a4a', patternScale: 1.8, accent: '#6a2a8a', eye: '#c86aff', eyeGlow: true }),
  carcharodontosaurus: skin({ back: '#5a4a3a', side: '#8a7058', belly: '#d8c4a0', pattern: 'bands', patternColor: '#3a2a1e', accent: '#8a4a2a', eye: '#e0a22a' }),
  carchaMagma: skin({ back: '#1a1210', side: '#3a2018', belly: '#6a3624', pattern: 'mottle', patternColor: '#ff6a1a', patternStrength: 0.8, accent: '#ff8a2a', eye: '#ffb03a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.3 }),
  ceratoWild: skin({ back: '#3a2e24', side: '#8a5a2e', belly: '#d8c09a', pattern: 'tiger', patternColor: '#1e1612', patternScale: 1.5, accent: '#c83a2a', horn: '#b83a2a' }),
  ceratoLava: skin({ back: '#1e1410', side: '#4a2418', belly: '#7a3a22', pattern: 'tiger', patternColor: '#ff6a1a', patternScale: 1.5, patternStrength: 0.9, accent: '#ff5a1a', horn: '#ff7a2a', eye: '#ffc23a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.28 }),
  alloWild: skin({ back: '#6a4e32', side: '#9a7a50', belly: '#e0d0a8', pattern: 'tiger', patternColor: '#5a2a1a', patternScale: 1.3, accent: '#b8402a' }),
  alloFrost: skin({ back: '#8aa0b4', side: '#b8c8d8', belly: '#eef4f8', pattern: 'tiger', patternColor: '#4a6480', patternScale: 1.3, accent: '#6ab8e8', eye: '#8ad8ff', eyeGlow: true }),
  nanuqsaurus: skin({ back: '#8a7a6a', side: '#b8aa98', belly: '#eee6d8', pattern: 'mottle', patternColor: '#5a4a3a', accent: '#e8e0d4', accent2: '#8a7a6a', eye: '#e0a22a' }),
  brachiosaurus: skin({ back: '#5a6258', side: '#7e8876', belly: '#c4c4aa', pattern: 'mottle', patternColor: '#3e463c', patternStrength: 0.45, accent: '#6a7a5e', eye: '#b87a2a' }),
  therizinoWild: skin({ back: '#4e4432', side: '#766a4e', belly: '#cfc4a0', pattern: 'mottle', patternColor: '#342c20', accent: '#8a7a56', accent2: '#3a3224', claw: '#2a2420' }),
  therizinoGold: skin({ back: '#8a6a1e', side: '#c8a03a', belly: '#f0dc94', pattern: 'mottle', patternColor: '#5a4210', accent: '#ffd23a', accent2: '#8a6a1e', claw: '#3a2a0a', eye: '#ffe86a', eyeGlow: true, emissive: '#ffb02a', emissiveIntensity: 0.12 }),
  rexWild: skin({ back: '#3e3a2e', side: '#6a6048', belly: '#c0b090', pattern: 'mottle', patternColor: '#26221a', patternStrength: 0.6, accent: '#5a4a2e' }),
  rexFrost: skin({ back: '#6a8098', side: '#9ab0c4', belly: '#e4eef4', pattern: 'mottle', patternColor: '#3a4e64', accent: '#8ac8f0', eye: '#8ad8ff', eyeGlow: true }),
  giganotosaurus: skin({ back: '#5a4e40', side: '#8a7a64', belly: '#d8caa8', pattern: 'bands', patternColor: '#3a2e22', accent: '#6a3a24', eye: '#e0a22a' }),
  gigaStorm: skin({ back: '#2a3038', side: '#48525e', belly: '#a0aab4', pattern: 'bands', patternColor: '#10141a', accent: '#5a8ac8', eye: '#8ad8ff', eyeGlow: true }),
  sarcosuchus: skin({ back: '#3a4232', side: '#5a6448', belly: '#c8c4a0', pattern: 'bands', patternColor: '#262c1e', accent: '#4a5238', eye: '#d8b83a' }),
  pyroWild: skin({ back: '#b86a1a', side: '#e0962e', belly: '#f4dca8', pattern: 'tiger', patternColor: '#6a3a0a', accent: '#ffb02a', accent2: '#8a4a0a', eye: '#ffd23a' }),
  raptorTagged: skin({ back: '#5a6a4a', side: '#8a9a6e', belly: '#d4d4b8', pattern: 'tiger', patternColor: '#3a4a2e', accent: '#4a5a3a', eye: '#e6c23a' }),
  indoProto: skin({ back: '#3a4640', side: '#5a6a60', belly: '#9aa8a0', pattern: 'lateral', patternColor: '#a8d83a', patternStrength: 0.85, accent: '#2a3430', eye: '#c8ff3a', eyeGlow: true }),
  indoWild: skin({ back: '#12121a', side: '#20202a', belly: '#40404c', pattern: 'lateral', patternColor: '#e0b22a', patternStrength: 1, accent: '#16161c', eye: '#ffe23a', eyeGlow: true }),
  scorpios: skin({ back: '#1e2e1e', side: '#34502e', belly: '#8aa06a', pattern: 'spots', patternColor: '#e0c23a', patternScale: 1.6, accent: '#c8a02a', horn: '#e0c23a', eye: '#ff5a2a', eyeGlow: true }),
  indominusAlpha: skin({ back: '#d8dde2', side: '#eceff2', belly: '#fafaf8', pattern: 'mottle', patternColor: '#9aa2ac', patternStrength: 0.4, accent: '#b82a2a', horn: '#d0d4d8', eye: '#ff2a1a', eyeGlow: true, emissive: '#ff2a1a', emissiveIntensity: 0.04 }),

  // Hatchery pets.
  petGreen: skin({ back: '#4e7a36', side: '#76a24a', belly: '#e0e0a8', pattern: 'tiger', patternColor: '#2e4a1e', patternScale: 2.2, accent: '#9ac84a' }),
  petTrike: skin({ back: '#7a6a50', side: '#a08a68', belly: '#e0d4b4', pattern: 'mottle', patternColor: '#4a3e2e', accent: '#d88a4a', horn: '#f0e8d4' }),
  petStego: skin({ back: '#5e6a42', side: '#8a9a5e', belly: '#e0dcaa', pattern: 'bands', patternColor: '#3a4424', accent: '#e06a3a', accent2: '#f0b060' }),
  petPara: skin({ back: '#5e7040', side: '#90a262', belly: '#e0dcb0', pattern: 'bands', patternColor: '#3a4a24', accent: '#e05a2a', accent2: '#f0a040' }),
  petRaptor: skin({ back: '#5e6670', side: '#9aa2aa', belly: '#e0e0da', pattern: 'lateral', patternColor: '#2a5aa8', patternStrength: 0.9, accent: '#2a62b8' }),
  petRex: skin({ back: '#5a4e3a', side: '#8a7a5a', belly: '#dccca8', pattern: 'mottle', patternColor: '#3a3024', accent: '#6a4a2a' }),
  petProto: skin({ back: '#b09060', side: '#d0b080', belly: '#f0e4c4', pattern: 'mottle', patternColor: '#8a6a40', accent: '#c87a40', horn: '#f0e8d4' }),
  petOvi: skin({ back: '#5a4a6a', side: '#8a7a9a', belly: '#e0d8e4', pattern: 'tiger', patternColor: '#3a2e44', accent: '#e05a4a', accent2: '#3a8ac8' }),
  petPachy: skin({ back: '#8a6a44', side: '#b0905e', belly: '#f0dcb4', pattern: 'bands', patternColor: '#5a3e24', accent: '#e0a060', horn: '#6a5a44' }),
  petVelo: skin({ back: '#9a6a3a', side: '#c89a5e', belly: '#f0dcb4', pattern: 'tiger', patternColor: '#5a3a1e', accent: '#e0903a', accent2: '#5a3a1e' }),
  petAnky: skin({ back: '#7a6a4e', side: '#a0906e', belly: '#dccca8', pattern: 'mottle', patternColor: '#4a3e2e', accent: '#b8a47a', horn: '#e8e0cc' }),
  petDilo: skin({ back: '#4e7a3a', side: '#8ab04e', belly: '#e8e0a8', pattern: 'spots', patternColor: '#f0d23a', patternScale: 1.6, accent: '#ff5a2a', accent2: '#f0d23a', eye: '#1a1a1a' }),
  petDime: skin({ back: '#6a4a3a', side: '#9a6e56', belly: '#d8c0a4', pattern: 'mottle', patternColor: '#3e2a1e', accent: '#e06a3a', accent2: '#ffc060' }),
  petStyg: skin({ back: '#6a3e2e', side: '#9a5e44', belly: '#e0bea0', pattern: 'bands', patternColor: '#3a2014', accent: '#e8803a', horn: '#3a2a22' }),
  petBary: skin({ back: '#4e6a4a', side: '#789a6a', belly: '#dcdcb4', pattern: 'tiger', patternColor: '#2e4a2e', accent: '#e07a3a' }),
  petCarno: skin({ back: '#8a3a2e', side: '#b8584a', belly: '#e8c4a8', pattern: 'mottle', patternColor: '#4a1a14', accent: '#2a1e1a', horn: '#3a2a22' }),
  petSino: skin({ back: '#6a5a4a', side: '#9a846a', belly: '#e0ccb4', pattern: 'bands', patternColor: '#3e3224', accent: '#f0b03a', accent2: '#d0402a', horn: '#f0e8d4' }),
  petGiga: skin({ back: '#6a5a44', side: '#9a8666', belly: '#e0d0ac', pattern: 'bands', patternColor: '#3e3224', accent: '#7a4a2a' }),
  petMagmaCompy: skin({ back: '#1e1614', side: '#3a2018', belly: '#6a3622', pattern: 'tiger', patternColor: '#ff6a1a', patternScale: 2.2, patternStrength: 0.95, accent: '#ff7a2a', eye: '#ffc23a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.35 }),
  petEmberRaptor: skin({ back: '#2a1410', side: '#5a2418', belly: '#8a4428', pattern: 'lateral', patternColor: '#ff8a2a', patternStrength: 0.95, accent: '#ff6a1a', eye: '#ffd23a', eyeGlow: true, emissive: '#ff5a1a', emissiveIntensity: 0.3 }),
  petCinderStego: skin({ back: '#241c1a', side: '#3e2e28', belly: '#6a4a3a', pattern: 'mottle', patternColor: '#ff7a2a', patternStrength: 0.7, accent: '#ff6a1a', accent2: '#ffd06a', eye: '#ffb03a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.3 }),
  petVolcanoTrike: skin({ back: '#1e1614', side: '#3a2622', belly: '#6a3e30', pattern: 'bands', patternColor: '#ff6a1a', patternStrength: 0.85, accent: '#ff7a2a', horn: '#ffc86a', eye: '#ffb03a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.32 }),
  petInfernoSpino: skin({ back: '#1a1210', side: '#3a1e14', belly: '#6a3620', pattern: 'mottle', patternColor: '#ff5a1a', patternStrength: 0.8, accent: '#ff4a0a', accent2: '#ffd06a', eye: '#ffd23a', eyeGlow: true, emissive: '#ff4a0a', emissiveIntensity: 0.4 }),
  petObsidianRex: skin({ back: '#0e0c12', side: '#1e1a26', belly: '#3a3044', pattern: 'lateral', patternColor: '#b86aff', patternStrength: 0.9, accent: '#8a3aff', eye: '#d08aff', eyeGlow: true, emissive: '#8a3aff', emissiveIntensity: 0.2 }),
} satisfies Record<string, Palette>;

const effigy = (material: SkinMaterial, back: string, side: string, belly: string, accent: string, extra: Partial<Palette> = {}): Palette => ({
  ...base,
  back,
  side,
  belly,
  pattern: 'none',
  patternColor: back,
  patternStrength: 0,
  accent,
  accent2: accent,
  horn: accent,
  claw: accent,
  teeth: accent,
  mouth: back,
  eye: accent,
  material,
  ...extra,
});

export const LOOKS: Readonly<Record<string, Look>> = {
  // ---- the rideable thirteen
  compy: { species: 'compsognathus', palette: P.compy, saddle: true, scale: 1.3, voice: 1.6 },
  blue: { species: 'velociraptor', palette: P.blue, saddle: true, scale: 1.1, voice: 1.35 },
  gallimimus: { species: 'gallimimus', palette: P.gallimimus, saddle: true, voice: 1.4 },
  parasaurolophus: { species: 'parasaurolophus', palette: P.parasaurolophus, saddle: true, voice: 0.8 },
  pyroraptor: { species: 'pyroraptor', palette: P.pyroraptor, saddle: true, voice: 1.3 },
  triceratops: { species: 'triceratops', palette: P.triceratops, saddle: true, voice: 0.75 },
  therizinosaurus: { species: 'therizinosaurus', palette: P.therizinosaurus, saddle: true, voice: 0.85 },
  spinosaurus: { species: 'spinosaurus', palette: P.spinosaurus, saddle: true, voice: 0.72 },
  allosaurus: { species: 'allosaurus', palette: P.allosaurus, saddle: true, voice: 0.8 },
  ceratosaurus: { species: 'ceratosaurus', palette: P.ceratosaurus, saddle: true, voice: 0.85 },
  tyrannosaurus: { species: 'tyrannosaurus', palette: P.tyrannosaurus, saddle: true, voice: 0.62 },
  indoraptor: { species: 'indoraptor', palette: P.indoraptor, saddle: true, voice: 1.0 },
  indominus: { species: 'indominus', palette: P.indominus, saddle: true, voice: 0.6 },

  // ---- the wild
  'compy-wild': { species: 'compsognathus', palette: P.compyWild, scale: 0.9, voice: 1.7 },
  'raptor-wild': { species: 'velociraptor', palette: P.raptorWild, voice: 1.35 },
  baryonyx: { species: 'baryonyx', palette: P.baryonyx, voice: 0.85 },
  'baryonyx-lagoon': { species: 'baryonyx', palette: P.baryonyxLagoon, voice: 0.85 },
  dilophosaurus: { species: 'dilophosaurus', palette: P.dilophosaurus, voice: 1.2 },
  monolophosaurus: { species: 'monolophosaurus', palette: P.monolophosaurus, voice: 1.0 },
  pachycephalosaurus: { species: 'pachycephalosaurus', palette: P.pachy, voice: 1.1 },
  stygimoloch: { species: 'stygimoloch', palette: P.stygimoloch, voice: 1.15 },
  ankylosaurus: { species: 'ankylosaurus', palette: P.ankylosaurus, voice: 0.7 },
  utahraptor: { species: 'utahraptor', palette: P.utahraptor, voice: 1.1 },
  'utahraptor-snow': { species: 'utahraptor', palette: P.utahSnow, voice: 1.1 },
  'utahraptor-storm': { species: 'utahraptor', palette: P.utahStorm, voice: 1.05 },
  metriacanthosaurus: { species: 'metriacanthosaurus', palette: P.metriacanthosaurus, voice: 0.85 },
  kentrosaurus: { species: 'kentrosaurus', palette: P.kentrosaurus, voice: 0.95 },
  stegosaurus: { species: 'stegosaurus', palette: P.stegosaurus, voice: 0.7 },
  styracosaurus: { species: 'styracosaurus', palette: P.styracosaurus, voice: 0.8 },
  sinoceratops: { species: 'sinoceratops', palette: P.sinoceratops, voice: 0.78 },
  majungasaurus: { species: 'majungasaurus', palette: P.majungasaurus, voice: 0.9 },
  'majungasaurus-bone': { species: 'majungasaurus', palette: P.majungaBone, voice: 0.9 },
  carnotaurus: { species: 'carnotaurus', palette: P.carnotaurus, voice: 0.85 },
  'carnotaurus-magma': { species: 'carnotaurus', palette: P.carnoMagma, voice: 0.8 },
  dimetrodon: { species: 'dimetrodon', palette: P.dimetrodon, voice: 1.2 },
  suchomimus: { species: 'suchomimus', palette: P.suchomimus, voice: 0.85 },
  'spinosaurus-wild': { species: 'spinosaurus', palette: P.spinoWild, voice: 0.7 },
  'spinosaurus-meteor': { species: 'spinosaurus', palette: P.spinoMeteor, voice: 0.66 },
  atrociraptor: { species: 'atrociraptor', palette: P.atrociraptor, voice: 1.3 },
  'atrociraptor-shadow': { species: 'atrociraptor', palette: P.atrociraptorShadow, voice: 1.2 },
  carcharodontosaurus: { species: 'carcharodontosaurus', palette: P.carcharodontosaurus, voice: 0.66 },
  'carcharodontosaurus-magma': { species: 'carcharodontosaurus', palette: P.carchaMagma, voice: 0.62 },
  'ceratosaurus-wild': { species: 'ceratosaurus', palette: P.ceratoWild, voice: 0.85 },
  'ceratosaurus-lava': { species: 'ceratosaurus', palette: P.ceratoLava, voice: 0.8 },
  'allosaurus-wild': { species: 'allosaurus', palette: P.alloWild, voice: 0.8 },
  'allosaurus-frost': { species: 'allosaurus', palette: P.alloFrost, voice: 0.8 },
  nanuqsaurus: { species: 'nanuqsaurus', palette: P.nanuqsaurus, voice: 0.72 },
  brachiosaurus: { species: 'brachiosaurus', palette: P.brachiosaurus, voice: 0.5 },
  'therizinosaurus-wild': { species: 'therizinosaurus', palette: P.therizinoWild, voice: 0.85 },
  'therizinosaurus-gold': { species: 'therizinosaurus', palette: P.therizinoGold, voice: 0.85 },
  'tyrannosaurus-wild': { species: 'tyrannosaurus', palette: P.rexWild, voice: 0.6 },
  'tyrannosaurus-frost': { species: 'tyrannosaurus', palette: P.rexFrost, voice: 0.6 },
  giganotosaurus: { species: 'giganotosaurus', palette: P.giganotosaurus, voice: 0.58 },
  'giganotosaurus-storm': { species: 'giganotosaurus', palette: P.gigaStorm, voice: 0.56 },
  sarcosuchus: { species: 'sarcosuchus', palette: P.sarcosuchus, voice: 0.55 },
  'pyroraptor-wild': { species: 'pyroraptor', palette: P.pyroWild, voice: 1.3 },
  'raptor-tagged': { species: 'velociraptor', palette: P.raptorTagged, voice: 1.35, features: [{ kind: 'collar' }] },
  'indoraptor-proto': { species: 'indoraptor', palette: P.indoProto, voice: 1.0 },
  'indoraptor-wild': { species: 'indoraptor', palette: P.indoWild, voice: 0.95 },
  scorpios: { species: 'scorpios', palette: P.scorpios, voice: 1.0 },
  'indominus-alpha': { species: 'indominus', palette: P.indominusAlpha, voice: 0.55 },

  // ---- hatchery pets: juveniles, a third of the adult's size or less
  'pet-compy': { species: 'compsognathus', palette: P.petGreen, scale: 0.42, juvenile: true },
  'pet-triceratops': { species: 'triceratops', palette: P.petTrike, scale: 0.2, juvenile: true },
  'pet-stegosaurus': { species: 'stegosaurus', palette: P.petStego, scale: 0.2, juvenile: true },
  'pet-parasaurolophus': { species: 'parasaurolophus', palette: P.petPara, scale: 0.2, juvenile: true },
  'pet-raptor': { species: 'velociraptor', palette: P.petRaptor, scale: 0.32, juvenile: true },
  'pet-rex': { species: 'tyrannosaurus', palette: P.petRex, scale: 0.16, juvenile: true },
  'pet-protoceratops': { species: 'protoceratops', palette: P.petProto, scale: 0.55, juvenile: true },
  'pet-oviraptor': { species: 'oviraptor', palette: P.petOvi, scale: 0.42, juvenile: true },
  'pet-pachy': { species: 'pachycephalosaurus', palette: P.petPachy, scale: 0.28, juvenile: true },
  'pet-velociraptor': { species: 'velociraptor', palette: P.petVelo, scale: 0.32, juvenile: true },
  'pet-ankylosaurus': { species: 'ankylosaurus', palette: P.petAnky, scale: 0.26, juvenile: true },
  'pet-dilophosaurus': { species: 'dilophosaurus', palette: P.petDilo, scale: 0.28, juvenile: true },
  'pet-dimetrodon': { species: 'dimetrodon', palette: P.petDime, scale: 0.55, juvenile: true },
  'pet-stygimoloch': { species: 'stygimoloch', palette: P.petStyg, scale: 0.3, juvenile: true },
  'pet-baryonyx': { species: 'baryonyx', palette: P.petBary, scale: 0.2, juvenile: true },
  'pet-carnotaurus': { species: 'carnotaurus', palette: P.petCarno, scale: 0.19, juvenile: true },
  'pet-sinoceratops': { species: 'sinoceratops', palette: P.petSino, scale: 0.21, juvenile: true },
  'pet-giganotosaurus': { species: 'giganotosaurus', palette: P.petGiga, scale: 0.15, juvenile: true },
  'pet-magmacompy': { species: 'compsognathus', palette: P.petMagmaCompy, scale: 0.42, juvenile: true },
  'pet-emberraptor': { species: 'velociraptor', palette: P.petEmberRaptor, scale: 0.32, juvenile: true },
  'pet-cinderstego': { species: 'stegosaurus', palette: P.petCinderStego, scale: 0.2, juvenile: true },
  'pet-volcanotrike': { species: 'triceratops', palette: P.petVolcanoTrike, scale: 0.2, juvenile: true },
  'pet-infernospino': { species: 'spinosaurus', palette: P.petInfernoSpino, scale: 0.15, juvenile: true },
  'pet-obsidianrex': { species: 'tyrannosaurus', palette: P.petObsidianRex, scale: 0.16, juvenile: true },

  // ---- the training effigies
  'dummy-raptor': { species: 'velociraptor', palette: effigy('wood', '#8a5a30', '#a8743f', '#c89a64', '#5a3a1e'), scale: 0.72 },
  'dummy-triceratops': { species: 'triceratops', palette: effigy('straw', '#c9a24a', '#e3c56a', '#f0dc94', '#8a6a2a'), scale: 0.36 },
  'dummy-stegosaurus': { species: 'stegosaurus', palette: effigy('stone', '#8a8a82', '#a3a39a', '#bcbcb2', '#6a6a64'), scale: 0.36 },
  'dummy-allosaurus': { species: 'allosaurus', palette: effigy('bone', '#d8ccb0', '#efe6cf', '#f8f2e4', '#b8a888'), scale: 0.36 },
  'dummy-ankylosaurus': { species: 'ankylosaurus', palette: effigy('iron', '#4a4f56', '#6f7780', '#8a929c', '#b86a3a', { metalness: 0.6, roughness: 0.45 }), scale: 0.62 },
  'dummy-spinosaurus': { species: 'spinosaurus', palette: effigy('amber', '#c86a0a', '#ffae2a', '#ffd06a', '#8a3a0a', { emissive: '#ff8a1a', emissiveIntensity: 0.35, roughness: 0.25 }), scale: 0.36 },
  'dummy-giganotosaurus': { species: 'giganotosaurus', palette: effigy('obsidian', '#140e1a', '#2a1e36', '#3a2a4a', '#b86aff', { roughness: 0.18, metalness: 0.2, emissive: '#6a2aaa', emissiveIntensity: 0.08 }), scale: 0.38 },
};

export const lookById = (id: string): Look => LOOKS[id] ?? LOOKS['compy']!;
