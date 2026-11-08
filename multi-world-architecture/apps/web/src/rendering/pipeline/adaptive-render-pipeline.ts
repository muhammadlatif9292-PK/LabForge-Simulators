// apps/web/src/rendering/pipeline/adaptive-render-pipeline.ts
/**
 * Adaptive Render Pipeline
 * 
 * Responsibilities:
 * - Dynamically adjust rendering quality based on device capabilities and current load
 * - Switch between full, medium, and low profiles seamlessly
 * - Manage frame rate throttling (adaptive FPS)
 * - Enable/disable features like shadows, post-processing, antialiasing
 * - Coordinate with memory budgeter and GPU diagnostics
 * 
 * Owned state:
 * - currentProfile: 'low' | 'medium' | 'high'
 * - targetFPS: number
 * - frameTimeSamples: number[]
 * - featureFlags: Set<string>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - FrameGraphRuntime (to modify passes)
 * - RenderMemoryBudgeter
 * - GPUResourceScheduler
 * 
 * Event emissions: "rendering.quality.changed", "rendering.fps.degraded"
 * Event subscriptions: "device.capability" for initial setup
 * Synchronization: none (changes only at frame boundaries)
 * Recovery: auto-rescale to lower quality on repeated missed frames
 * Telemetry: current FPS, quality profile, feature usage
 * Diagnostics: profile history, frame time variance
 * Accessibility: ensure minimum quality even on low-end
 * Performance: lightweight decisions; no per-frame overhead
 * Forbidden: jittery quality switches within a single frame
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { FrameGraphRuntime } from './frame/frame-graph-runtime';
import type { RenderMemoryBudgeter } from './memory/render-memory-budgeter';

type QualityProfile = 'low' | 'medium' | 'high';

export class AdaptiveRenderPipeline {
  private currentProfile: QualityProfile = 'high';
  private targetFPS = 60;
  private frameTimes: number[] = [];
  private readonly frameWindow = 30;
  private features: Set<string> = new Set(['shadows', 'antialiasing', 'postprocess']);

  constructor(
    private frameGraph: FrameGraphRuntime,
    private memoryBudgeter: RenderMemoryBudgeter,
    private logger: ILogger,
    private meter: IMeter,
    private initialProfile?: QualityProfile,
  ) {
    if (initialProfile) this.currentProfile = initialProfile;
  }

  recordFrameTime(deltaMs: number): void {
    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > this.frameWindow) this.frameTimes.shift();
    this.adaptIfNeeded();
  }

  private adaptIfNeeded(): void {
    const avg = this.calculateAverageFrameTime();
    const budgetMs = 1000 / this.targetFPS;
    if (avg > budgetMs * 1.5 && this.currentProfile !== 'low') {
      // Degrade
      if (this.currentProfile === 'high') {
        this.setProfile('medium');
      } else if (this.currentProfile === 'medium') {
        this.setProfile('low');
      }
      this.meter.incrementCounter('rendering.quality.degraded');
      this.logger.warn(`Quality degraded to ${this.currentProfile} due to high frame time (${avg.toFixed(1)}ms)`);
    } else if (avg < budgetMs * 0.8 && this.currentProfile !== 'high' && this.frameTimes.length >= this.frameWindow) {
      // Upgrade
      if (this.currentProfile === 'low') {
        this.setProfile('medium');
      } else if (this.currentProfile === 'medium') {
        this.setProfile('high');
      }
      this.meter.incrementCounter('rendering.quality.upgraded');
      this.logger.info(`Quality upgraded to ${this.currentProfile}`);
    }
  }

  setProfile(profile: QualityProfile): void {
    this.currentProfile = profile;
    // Adjust features based on profile
    this.features.clear();
    if (profile === 'high') {
      this.features.add('shadows').add('antialiasing').add('postprocess');
    } else if (profile === 'medium') {
      this.features.add('antialiasing');
    }
    // low: no features
    this.updateFrameGraph();
    this.meter.setGauge('rendering.quality_profile', profile === 'high' ? 3 : profile === 'medium' ? 2 : 1);
  }

  private updateFrameGraph(): void {
    // Modify pass list based on features; example: remove shadows pass if not enabled
    // This would interact with FrameGraphRuntime to add/remove passes.
  }

  isFeatureEnabled(feature: string): boolean {
    return this.features.has(feature);
  }

  getCurrentProfile(): QualityProfile {
    return this.currentProfile;
  }

  getTargetFPS(): number {
    return this.targetFPS;
  }

  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
  }

  private calculateAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }
}