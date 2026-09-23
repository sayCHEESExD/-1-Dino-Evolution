import { rewardPadOf } from '@dino/shared';
import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  RingGeometry,
  type Material,
} from 'three';

/**
 * THE CLAIM GLOW over a cleared stage's reward pad: a pulsing column of warm
 * light, sparks circling it and a ring rippling out - shared geometry and
 * materials across all thirty stages, animated with one pulse.
 */

/** The animated half, shared by every stage: light column, circling sparks, ripple ring. */
export class WinPlatformFx {
  private readonly column = new CylinderGeometry(3.7, 3.7, 9, 24, 1, true);
  private readonly spark = new OctahedronGeometry(0.22, 0);
  private readonly ripple = new RingGeometry(3.7, 4.3, 36);
  private readonly columnMaterial = new MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  private readonly sparkMaterial = new MeshBasicMaterial({ color: 0xfff1a0, fog: false });
  private readonly rippleMaterial = new MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  private readonly rigs: { group: Group; sparks: Group; ripple: Mesh }[] = [];
  private time = 0;

  /** The animated parts over one stage's pad, hidden until the stage is cleared. */
  create(stage: number): Group {
    const pad = rewardPadOf(stage);
    const group = new Group();
    group.position.set(pad.x, 0, pad.z);
    group.visible = false;
    const column = new Mesh(this.column, this.columnMaterial);
    column.position.y = 4.6;
    const sparks = new Group();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const spark = new Mesh(this.spark, this.sparkMaterial);
      spark.position.set(Math.cos(a) * 3.2, 1.6 + (i % 3) * 0.8, Math.sin(a) * 3.2);
      sparks.add(spark);
    }
    const ripple = new Mesh(this.ripple, this.rippleMaterial);
    ripple.rotation.x = -Math.PI / 2;
    // Clear of the pad slab (top 0.41) and its disc (top 0.51).
    ripple.position.y = 0.58;
    group.add(column, sparks, ripple);
    this.rigs.push({ group, sparks, ripple });
    return group;
  }

  /** Animate every visible rig: one shared pulse, so it costs nothing per stage. */
  update(delta: number): void {
    this.time += delta;
    this.columnMaterial.opacity = 0.14 + Math.sin(this.time * 3) * 0.06;
    const phase = (this.time * 0.7) % 1;
    this.rippleMaterial.opacity = 0.6 * (1 - phase);
    for (const rig of this.rigs) {
      if (!rig.group.visible) continue;
      rig.sparks.rotation.y = this.time * 1.4;
      rig.sparks.position.y = Math.sin(this.time * 2) * 0.2;
      const s = 1 + phase * 0.8;
      rig.ripple.scale.set(s, s, 1);
    }
  }

  get materials(): Material[] {
    return [this.columnMaterial, this.sparkMaterial, this.rippleMaterial];
  }

  dispose(): void {
    this.column.dispose();
    this.spark.dispose();
    this.ripple.dispose();
    for (const material of this.materials) material.dispose();
  }
}
