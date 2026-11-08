// apps/web/src/rendering/runtime/render-frame-scheduler.ts
/**
 * Frontend Render Frame Scheduler
 * 
 * Responsibilities:
 * - Schedule the render loop using requestAnimationFrame
 * - Manage frame skipping when the main thread is overwhelmed
 * - Enforce target FPS (configurable per quality tier)
 * - Track frame time deltas for physics/motion interpolation
 * 
 * Owned state:
 * - rafId: number | null
 * - lastFrameTime: number
 * - frameCount: number
 * - targetFrameIntervalMs: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - ViewportFrameDiffer (to detect changes)
 * - AdaptiveRenderPipeline (quality changes)
 * 
 * Event emissions: "render.frame.scheduled", "render.frame.skipped"
 * Event subscriptions: none
 * Synchronization: single-threaded
 * Recovery: restart loop on context restoration
 * Telemetry: frame rate, frame time, skip count
 * Diagnostics: current frame time
 * Accessibility: N/A
 * Performance: minimal overhead; no heavy computation in loop
 * Forbidden: blocking rAF callback; missing frame callbacks
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class RenderFrameScheduler {
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private targetInterval = 1000 / 60; // 60 FPS
  private running = false;
  private onFrame: ((deltaMs: number) => void) | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
    this.logger.info('Render frame scheduler started');
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setOnFrame(callback: (deltaMs: number) => void): void {
    this.onFrame = callback;
  }

  setTargetFPS(fps: number): void {
    this.targetInterval = 1000 / fps;
  }

  private loop = (timestamp: number): void => {
    if (!this.running) return;
    const delta = timestamp - this.lastFrameTime;
    if (delta >= this.targetInterval) {
      this.lastFrameTime = timestamp;
      this.frameCount++;
      this.onFrame?.(delta);
      this.meter.recordHistogram('render.frame.delta', delta);
    } else {
      this.meter.incrementCounter('render.frame.skipped');
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}