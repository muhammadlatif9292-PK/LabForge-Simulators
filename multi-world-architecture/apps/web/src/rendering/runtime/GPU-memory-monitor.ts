// apps/web/src/rendering/runtime/GPU-memory-monitor.ts
/**
 * Frontend GPU Memory Monitor
 * 
 * Responsibilities:
 * - Periodically query WebGL/WebGPU for GPU memory usage
 * - Emit pressure events when approaching limits
 * - Coordinate with render memory budgeter for eviction
 * 
 * Owned state:
 * - currentUsageMB: number
 * - lastCheck: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - GPUDevice (WebGL or WebGPU)
 * 
 * Event emissions: "gpu.memory.updated", "gpu.memory.pressure"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: restart monitoring on context restore
 * Telemetry: memory usage gauge
 * Diagnostics: usage snapshot
 * Accessibility: N/A
 * Performance: lightweight polling every 5 seconds
 * Forbidden: causing GPU pipeline stalls
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class GPUMemoryMonitor {
  private intervalId: any = null;
  private currentMB = 0;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  start(): void {
    this.intervalId = setInterval(() => this.check(), 5000);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private check(): void {
    // In production: use performance.memory or WebGL extension
    // Placeholder
    this.meter.setGauge('gpu.memory.usage_mb', this.currentMB);
  }

  reportUsageMB(mb: number): void {
    this.currentMB = mb;
    this.meter.setGauge('gpu.memory.usage_mb', mb);
    if (mb > 400) { // threshold for warning
      this.meter.incrementCounter('gpu.memory.pressure');
    }
  }
}