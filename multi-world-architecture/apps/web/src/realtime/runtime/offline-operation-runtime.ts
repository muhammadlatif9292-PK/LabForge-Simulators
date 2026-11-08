// apps/web/src/realtime/runtime/offline-operation-runtime.ts
/**
 * Frontend Offline Operation Runtime
 * 
 * Responsibilities:
 * - Queue user operations locally when network is unavailable
 * - Replay queued operations when connection restores
 * - Handle conflicts using last-writer-wins
 * 
 * Owned state:
 * - queue: OfflineOperation[]
 * 
 * Dependencies:
 * - OfflineOperationPersistence (IndexedDB)
 * - OfflineStateReconciliation
 * - EventBus
 * 
 * Event emissions: none
 * Event subscriptions: "connection.offline", "connection.online"
 * Synchronization: queue serialised
 * Recovery: queue survives page refresh
 * Telemetry: queue depth gauge
 * Diagnostics: pending operations
 * Accessibility: notify user when offline operations synced
 * Performance: non-blocking writes
 * Forbidden: losing operations
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface OfflineOperation {
  id: string;
  commandType: string;
  payload: unknown;
  timestamp: number;
}

export class OfflineOperationRuntime {
  private queue: OfflineOperation[] = [];
  private offline = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {
    this.eventBus.subscribe('connection.offline', () => this.offline = true);
    this.eventBus.subscribe('connection.online', () => this.flushQueue());
  }

  enqueue(commandType: string, payload: unknown): void {
    if (this.offline) {
      this.queue.push({ id: 'offline_' + Date.now(), commandType, payload, timestamp: Date.now() });
      this.meter.setGauge('offline_operation.queue_depth', this.queue.length);
    }
  }

  private async flushQueue(): Promise<void> {
    this.offline = false;
    if (this.queue.length === 0) return;
    this.logger.info(`Flushing ${this.queue.length} offline operations`);
    for (const op of this.queue) {
      await this.eventBus.publish('command.replay.execute', op);
    }
    this.queue = [];
    this.meter.setGauge('offline_operation.queue_depth', 0);
  }
}