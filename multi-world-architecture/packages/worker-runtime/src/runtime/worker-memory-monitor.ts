// packages/worker-runtime/src/runtime/worker-memory-monitor.ts
/**
 * Worker Memory Monitor
 * 
 * Responsibilities:
 * - Track memory (RAM and GPU) usage of each worker process
 * - Generate warnings and alerts on high memory pressure
 * - Initiate GC or worker restart when thresholds exceeded
 * - Provide memory trend data for predictive scaling
 * 
 * Owned state:
 * - memorySnapshots: Map<WorkerId, MemorySnapshot[]>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedWorkerManager (to communicate with workers)
 * 
 * Event emissions:
 * - "worker.memory.warning", "worker.memory.critical"
 * 
 * Event subscriptions:
 * - "worker.telemetry" to extract memory metrics
 * 
 * Synchronization: none
 * Recovery: log memory events for post-crash diagnosis
 * Telemetry: memory usage gauge, allocation rate histograms
 * Diagnostics: per-worker memory timeline
 * Accessibility: alerts include actionable recommendations
 * Performance: sampling interval adjustable, no hot path overhead
 * Forbidden: forcing GC on worker without graceful drain
 */

import type { WorkerId, WorkerTelemetry } from '../contracts/worker-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface MemorySnapshot {
  timestamp: number;
  ramUsedMB: number;
  gpuMemoryMB?: number;
}

export class WorkerMemoryMonitor {
  private snapshots: Map<WorkerId, MemorySnapshot[]> = new Map();
  private readonly WARNING_THRESHOLD_MB = 4096; // 4GB
  private readonly CRITICAL_THRESHOLD_MB = 6144; // 6GB

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('worker.telemetry', this.handleTelemetry.bind(this));
  }

  handleTelemetry(event: any): void {
    const { workerId, telemetry } = event.payload as { workerId: WorkerId; telemetry: WorkerTelemetry };
    const snap: MemorySnapshot = {
      timestamp: Date.now(),
      ramUsedMB: telemetry.memoryUsageMB,
      gpuMemoryMB: telemetry.gpuMemoryUsageMB,
    };
    const list = this.snapshots.get(workerId) ?? [];
    list.push(snap);
    // Keep last 100 snapshots
    if (list.length > 100) list.shift();
    this.snapshots.set(workerId, list);

    this.meter.setGauge('worker.memory.ram_mb', telemetry.memoryUsageMB, { workerId });
    if (telemetry.gpuMemoryUsageMB !== undefined) {
      this.meter.setGauge('worker.memory.gpu_mb', telemetry.gpuMemoryUsageMB, { workerId });
    }

    if (telemetry.memoryUsageMB > this.CRITICAL_THRESHOLD_MB) {
      this.logger.error(`Critical memory usage on worker ${workerId}: ${telemetry.memoryUsageMB}MB`);
      this.eventBus.publish('worker.memory.critical', { workerId, usage: telemetry.memoryUsageMB });
    } else if (telemetry.memoryUsageMB > this.WARNING_THRESHOLD_MB) {
      this.logger.warn(`High memory usage on worker ${workerId}: ${telemetry.memoryUsageMB}MB`);
      this.eventBus.publish('worker.memory.warning', { workerId, usage: telemetry.memoryUsageMB });
    }
  }

  getMemoryTrend(workerId: WorkerId): MemorySnapshot[] {
    return this.snapshots.get(workerId) ?? [];
  }
}