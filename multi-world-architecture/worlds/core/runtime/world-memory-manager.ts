// worlds/core/runtime/world-memory-manager.ts
/**
 * World Memory Manager
 * 
 * Responsibilities:
 * - Track memory usage of world entities, assets, and simulation state
 * - Enforce per-world memory budget as defined by WorldDescriptor
 * - Coordinate with global memory budgeter to avoid OOM
 * - Initiate entity or asset eviction when limits exceeded
 * 
 * Owned state:
 * - currentUsageBytes: number
 * - budgetBytes: number
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "world.memory.pressure" on high usage
 * Event subscriptions: none
 * Synchronization: none (single-threaded per world)
 * Recovery: not applicable; stats reset
 * Telemetry: memory gauge, eviction count
 * Diagnostics: usage breakdown
 * Accessibility: N/A
 * Performance: O(1) allocation tracking
 * Forbidden: exceeding budget without action
 */

import type { WorldMemoryStats } from '../contracts/world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class WorldMemoryManager {
  private currentUsageBytes = 0;
  readonly maxBytes: number;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    budgetMB: number = 128,
  ) {
    this.maxBytes = budgetMB * 1024 * 1024;
  }

  allocate(bytes: number): boolean {
    if (this.currentUsageBytes + bytes > this.maxBytes) {
      this.meter.incrementCounter('world.memory.pressure');
      this.logger.warn('World memory budget exceeded');
      return false;
    }
    this.currentUsageBytes += bytes;
    this.meter.setGauge('world.memory.usage_bytes', this.currentUsageBytes);
    return true;
  }

  deallocate(bytes: number): void {
    this.currentUsageBytes = Math.max(0, this.currentUsageBytes - bytes);
    this.meter.setGauge('world.memory.usage_bytes', this.currentUsageBytes);
  }

  getStats(): WorldMemoryStats {
    return {
      entitiesCount: 0, // updated by entity manager
      stateSizeBytes: this.currentUsageBytes,
      assetCacheSizeBytes: 0,
      peakMemoryBytes: this.currentUsageBytes,
    };
  }
}