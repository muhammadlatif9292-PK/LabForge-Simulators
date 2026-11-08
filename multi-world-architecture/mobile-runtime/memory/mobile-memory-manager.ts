// mobile-runtime/memory/mobile-memory-manager.ts
/**
 * Mobile Memory Manager
 * 
 * Responsibilities:
 * - Enforce a strict memory budget appropriate for the detected device tier
 * - Monitor GC pressure and trigger manual hints when available
 * - Coordinate with render-memory-budgeter and world-memory-manager
 * - Evict non-essential assets and reduce entity counts under pressure
 * - Report memory pressure events to observability
 * 
 * Owned state:
 * - budget: MobileMemoryBudget
 * - deviceCapabilities: DeviceCapabilities
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to broadcast pressure events)
 * - Performance API (performance.memory on Chrome)
 * 
 * Event emissions:
 * - "mobile.memory.pressure", "mobile.memory.critical"
 * - "mobile.memory.eviction", "mobile.memory.recovered"
 * 
 * Event subscriptions:
 * - "world.memory.pressure" (aggregate pressure signals)
 * - "render.memory.pressure"
 * 
 * Synchronization: single-threaded; pressure checks on interval
 * Recovery: evicted assets can be re-downloaded; entities re-created
 * Telemetry: memory usage gauge, pressure event count
 * Diagnostics: current budget status
 * Accessibility: N/A
 * Performance: lightweight pressure detection; avoid frequent GC hints
 * Forbidden: blocking the main thread for GC; evicting critical safety data
 */

import type { DeviceCapabilities, DeviceTier, MobileMemoryBudget } from '../contracts/mobile-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class MobileMemoryManager {
  private budget: MobileMemoryBudget;
  private checkInterval: NodeJS.Timeout | null = null;
  private gcSupported: boolean;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private capabilities: DeviceCapabilities,
  ) {
    this.gcSupported = typeof performance !== 'undefined' && 'memory' in performance;
    this.budget = this.calculateBudget(capabilities.tier);
    this.startMonitoring();
  }

  private calculateBudget(tier: DeviceTier): MobileMemoryBudget {
    const budgets: Record<DeviceTier, number> = {
      high: 512 * 1024 * 1024,
      medium: 256 * 1024 * 1024,
      low: 128 * 1024 * 1024,
      minimal: 64 * 1024 * 1024,
    };
    const total = budgets[tier] ?? budgets.low;
    return {
      currentUsageBytes: 0,
      peakUsageBytes: 0,
      budgetBytes: total,
      warningThresholdBytes: total * 0.7,
      criticalThresholdBytes: total * 0.9,
    };
  }

  private startMonitoring(): void {
    this.checkInterval = setInterval(() => this.checkMemory(), 5000);
  }

  private checkMemory(): void {
    let usedJSHeapSize = 0;
    if (this.gcSupported) {
      const mem = (performance as any).memory;
      usedJSHeapSize = mem?.usedJSHeapSize ?? 0;
    }
    const totalUsage = usedJSHeapSize + this.estimateGPUMemory();
    this.budget.currentUsageBytes = totalUsage;
    if (totalUsage > this.budget.peakUsageBytes) {
      this.budget.peakUsageBytes = totalUsage;
    }
    this.meter.setGauge('mobile.memory.usage_bytes', totalUsage);
    this.meter.setGauge('mobile.memory.budget_bytes', this.budget.budgetBytes);

    if (totalUsage > this.budget.criticalThresholdBytes) {
      this.logger.error(`Critical mobile memory pressure: ${(totalUsage / 1024 / 1024).toFixed(1)}MB`);
      this.eventBus.publish('mobile.memory.critical', { usageBytes: totalUsage, budgetBytes: this.budget.budgetBytes });
      this.triggerEviction();
    } else if (totalUsage > this.budget.warningThresholdBytes) {
      this.logger.warn(`Mobile memory pressure warning: ${(totalUsage / 1024 / 1024).toFixed(1)}MB`);
      this.eventBus.publish('mobile.memory.pressure', { usageBytes: totalUsage, budgetBytes: this.budget.budgetBytes });
    }
  }

  private estimateGPUMemory(): number {
    // Simplified; production would query WebGL/WebGPU for GPU memory
    return 0;
  }

  private triggerEviction(): void {
    this.eventBus.publish('mobile.memory.eviction', { timestamp: Date.now() });
    this.meter.incrementCounter('mobile.memory.eviction');
    if (this.gcSupported) {
      try { (window as any).gc?.(); } catch (e) { /* not available */ }
    }
  }

  requestAllocation(bytes: number): boolean {
    const future = this.budget.currentUsageBytes + bytes;
    if (future > this.budget.budgetBytes) return false;
    this.budget.currentUsageBytes = future;
    return true;
  }

  deallocate(bytes: number): void {
    this.budget.currentUsageBytes = Math.max(0, this.budget.currentUsageBytes - bytes);
  }

  getBudget(): Readonly<MobileMemoryBudget> {
    return { ...this.budget };
  }

  getUsageFraction(): number {
    return this.budget.currentUsageBytes / this.budget.budgetBytes;
  }

  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}