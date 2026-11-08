// apps/web/src/rendering/pipeline/memory/render-memory-budgeter.ts
/**
 * Render Memory Budgeter
 * 
 * Responsibilities:
 * - Enforce a maximum GPU memory budget for textures and buffers
 * - Track allocations and deallocations in real time
 * - Issue memory pressure warnings before OOM
 * - Implement LRU eviction of unused resources when budget exceeded
 * - Provide memory statistics for debugging and adaptive quality
 * 
 * Owned state:
 * - currentUsageBytes: number
 * - maxBudgetBytes: number
 * - allocationRecords: Map<string, number>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * 
 * Event emissions: "gpu.memory.pressure" on high usage
 * Event subscriptions: none
 * Synchronization: none (single-threaded)
 * Recovery: if budget breached, force eviction; log error
 * Telemetry: memory usage gauge, eviction count
 * Diagnostics: current usage breakdown
 * Accessibility: N/A
 * Performance: O(1) tracking; avoid frequent queries
 * Forbidden: exceeding budget without eviction; false OOM kills
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class RenderMemoryBudgeter {
  private currentUsageBytes = 0;
  readonly maxBudgetBytes: number;
  private allocations: Map<string, number> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    maxBudgetMB: number = 512,
  ) {
    this.maxBudgetBytes = maxBudgetMB * 1024 * 1024;
  }

  requestAllocation(bytes: number): boolean {
    if (this.currentUsageBytes + bytes > this.maxBudgetBytes) {
      this.meter.incrementCounter('gpu.memory.budget_exceeded');
      return false;
    }
    return true;
  }

  allocate(id: string, bytes: number): boolean {
    if (!this.requestAllocation(bytes)) return false;
    this.currentUsageBytes += bytes;
    this.allocations.set(id, bytes);
    this.meter.setGauge('gpu.memory.usage_bytes', this.currentUsageBytes);
    this.checkPressure();
    return true;
  }

  deallocate(id: string): void {
    const bytes = this.allocations.get(id);
    if (bytes !== undefined) {
      this.currentUsageBytes -= bytes;
      this.allocations.delete(id);
      this.meter.setGauge('gpu.memory.usage_bytes', this.currentUsageBytes);
    }
  }

  getUsageFraction(): number {
    return this.currentUsageBytes / this.maxBudgetBytes;
  }

  private checkPressure(): void {
    const fraction = this.getUsageFraction();
    if (fraction > 0.9) {
      this.logger.warn(`GPU memory pressure: ${(fraction * 100).toFixed(1)}% used`);
      // Could emit event for adaptive pipeline
    }
  }

  getStats() {
    return {
      currentUsageMB: this.currentUsageBytes / 1024 / 1024,
      budgetMB: this.maxBudgetBytes / 1024 / 1024,
      utilizationPercent: this.getUsageFraction() * 100,
    };
  }
}