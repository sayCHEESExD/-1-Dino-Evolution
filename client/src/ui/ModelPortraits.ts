import { dinoBySlot, petById } from '@dino/shared';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { DinoAnimator, createMotion } from '../dinos/DinoAnimator.js';
import { createDino } from '../dinos/DinoModel.js';

const SIZE = 224;

/**
 * PORTRAITS OF THE REAL MODELS for the menus: each dinosaur and each hatchling
 * rendered once, on demand, through the game's own renderer into a small
 * offscreen target and kept as an image URL. The menus show exactly what walks
 * around the world, with no image files shipped for any of it.
 */
export class ModelPortraits {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(28, 1, 0.1, 200);
  private readonly target = new WebGLRenderTarget(SIZE, SIZE);
  private readonly cache = new Map<string, string>();
  private readonly holder = new Group();

  constructor(private readonly renderer: WebGLRenderer) {
    this.target.texture.colorSpace = SRGBColorSpace;
    this.scene.add(new HemisphereLight(0xfff4e0, 0x6a5a40, 1.3));
    this.scene.add(new AmbientLight(0xffffff, 0.5));
    const key = new DirectionalLight(0xffffff, 2.0);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const rim = new DirectionalLight(0xffe0b0, 1.0);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);
    this.scene.add(this.holder);
  }

  /** A rideable dinosaur, by slot. */
  dino(slot: number): string {
    const look = dinoBySlot(slot)?.look ?? 'compy';
    return this.look(look);
  }

  /** A pet, by id. */
  pet(petId: number): string {
    const look = petById(petId)?.look ?? 'pet-compy';
    return this.look(look);
  }

  /** Any look: framed three-quarter from the front, standing at ease. */
  look(lookId: string): string {
    const cached = this.cache.get(lookId);
    if (cached !== undefined) return cached;
    let url = '';
    try {
      const dino = createDino(lookId, 'medium');
      if (dino.saddle) dino.saddle.visible = false;
      const animator = new DinoAnimator(dino);
      const motion = createMotion();
      for (let i = 0; i < 6; i += 1) animator.update(0.05, motion);
      dino.root.rotation.y = -0.85;
      this.holder.add(dino.root);
      const length = Math.max(0.6, dino.asset.length);
      const height = Math.max(0.5, dino.asset.height);
      const span = Math.max(length * 0.78, height * 1.25);
      const distance = span / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * 1.08;
      this.camera.position.set(distance * 0.18, height * 0.62 + distance * 0.12, distance);
      this.camera.lookAt(0, height * 0.45, 0);
      this.camera.aspect = 1;
      this.camera.updateProjectionMatrix();

      const previousTarget = this.renderer.getRenderTarget();
      const previousColor = new Color();
      this.renderer.getClearColor(previousColor);
      const previousAlpha = this.renderer.getClearAlpha();
      this.renderer.setRenderTarget(this.target);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);
      const pixels = new Uint8Array(SIZE * SIZE * 4);
      this.renderer.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, pixels);
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setClearColor(previousColor, previousAlpha);
      this.holder.remove(dino.root);
      dino.dispose();

      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const image = ctx.createImageData(SIZE, SIZE);
      // The target is bottom-up; the canvas is top-down.
      for (let y = 0; y < SIZE; y += 1) {
        image.data.set(pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
      }
      ctx.putImageData(image, 0, 0);
      url = canvas.toDataURL('image/png');
    } catch {
      url = '';
    }
    this.cache.set(lookId, url);
    return url;
  }

  dispose(): void {
    this.target.dispose();
    this.cache.clear();
  }
}
