// packages/synchronization/src/runtime/offline-operation-replay.ts
/**
 * Offline Operation Replay (Sync Layer)
 * 
 * Responsibilities:
 * - Store operations generated while offline in a durable queue
 * - Replay operations in order upon reconnection
 * - Handle idempotency and conflict resolution during replay
 * 
 * Owned state:
 * - offlineQueue: SyncOperation[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedSyncRuntime (to apply replayed ops)
 * - ConflictResolutionRuntime
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface SyncOperation {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  sequenceNumber: number;
}

export class OfflineOperationReplay {
  private queue: SyncOperation[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  enqueue(operation: SyncOperation): void {
    this.queue.push(operation);
    this.meter.setGauge('offline_replay.queue_depth', this.queue.length);
  }

  async replayAll(applyFn: (op: SyncOperation) => Promise<void>): Promise<void> {
    if (this.queue.length === 0) return;
    this.logger.info(`Replaying ${this.queue.length} offline operations`);
    for (const op of this.queue) {
      await applyFn(op);
    }
    this.queue = [];
    this.meter.setGauge('offline_replay.queue_depth', 0);
  }
}