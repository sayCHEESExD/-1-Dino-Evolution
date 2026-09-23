import { dinoBySlot, petById } from '@dino/shared';
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
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
      this.holder.add(dino.root);
      // Turned three-quarters toward the viewer: the head and body read, the tail trails away.
      this.frame(dino.root, -0.5);

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

  /**
   * Fit the camera to the POSED model's real bounds - snout, tail, crest and
   * all - from a three-quarter view a little above. The model's corners are
   * projected and the view is re-centred and pulled in or out until the whole
   * animal fills the frame with a margin, whatever its proportions or offset.
   */
  private frame(root: Object3D, yaw: number): void {
    // Measured square-on (a turned animal's world box is far bigger than the animal), then turned.
    root.rotation.y = 0;
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root, true);
    if (box.isEmpty()) box.set(new Vector3(-1, 0, -1), new Vector3(1, 1.5, 1));
    root.rotation.y = yaw;
    root.updateMatrixWorld(true);
    const axis = new Vector3(0, 1, 0);
    const corners: Vector3[] = [];
    for (let i = 0; i < 8; i += 1) corners.push(new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyAxisAngle(axis, yaw));
    const centre = box.getCenter(new Vector3()).applyAxisAngle(axis, yaw);
    const radius = Math.max(0.3, box.getSize(new Vector3()).length() / 2);
    const view = new Vector3(0.18, 0.28, 1).normalize();
    const halfFov = (this.camera.fov * Math.PI) / 360;
    let distance = radius / Math.sin(halfFov);
    const look = centre.clone();
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    const p = new Vector3();
    for (let pass = 0; pass < 4; pass += 1) {
      this.camera.position.copy(look).addScaledVector(view, distance);
      this.camera.lookAt(look);
      this.camera.updateMatrixWorld(true);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const corner of corners) {
        p.copy(corner).project(this.camera);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      // Re-centre on the projected bounds, then scale so the larger side spans 92% of the frame.
      const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      const reach = distance * Math.tan(halfFov);
      look.addScaledVector(right, ((minX + maxX) / 2) * reach).addScaledVector(up, ((minY + maxY) / 2) * reach);
      const extent = Math.max(maxX - minX, maxY - minY) / 2;
      distance *= extent / 0.92;
    }
    this.camera.position.copy(look).addScaledVector(view, distance);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld(true);
  }

  dispose(): void {
    this.target.dispose();
    this.cache.clear();
  }
}
