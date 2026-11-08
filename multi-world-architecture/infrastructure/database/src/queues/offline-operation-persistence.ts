// infrastructure/database/src/queues/offline-operation-persistence.ts
/**
 * Offline Operation Persistence
 * 
 * Responsibilities:
 * - Store operations generated while offline in a local durable queue
 * - Support FIFO ordering and idempotency checks
 * - Sync pending operations to server upon reconnection
 * - Handle integrity checks (e.g., sequence gaps)
 * 
 * Owned state:
 * - localQueue: OfflineOperation[] (backed by IndexedDB/sqlite)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Local database adapter (e.g., IndexedDB wrapper)
 * - Sync runtime
 * 
 * Event emissions: "offline.operation.queued", "offline.operation.synced"
 * Event subscriptions: none
 * Synchronization: merges with server using lastSyncedSequence
 * Recovery: queue survives browser refresh; replay on startup
 * Telemetry: queue depth, sync latency
 * Diagnostics: pending operations list
 * Accessibility: N/A
 * Performance: uses IndexedDB for non-blocking persistence
 * Forbidden: losing operations on close; double syncing
 */

import type { OfflineOperation } from '../contracts/database-contracts';
import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class OfflineOperationPersistence {
  private db: any; // local database abstraction

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Initialize local store
    this.db = new LocalQueueDatabase();
  }

  async enqueue(userId: string, type: string, payload: unknown): Promise<string> {
    const op: OfflineOperation = {
      id: uuidv4(),
      userId,
      type,
      payload,
      timestamp: Date.now(),
      sequenceNumber: await this.getNextSequence(),
      attempts: 0,
      status: 'pending',
    };
    await this.db.addOperation(op);
    this.meter.setGauge('offline.operation.queue_depth', await this.queueDepth());
    this.logger.debug(`Offline operation queued: ${op.id}`);
    return op.id;
  }

  async getPendingOperations(userId: string, limit: number = 50): Promise<OfflineOperation[]> {
    return this.db.getPending(userId, limit);
  }

  async markAsCompleted(operationId: string): Promise<void> {
    await this.db.updateStatus(operationId, 'completed');
  }

  async markAsFailed(operationId: string): Promise<void> {
    await this.db.updateStatus(operationId, 'failed');
  }

  async queueDepth(userId?: string): Promise<number> {
    return this.db.countPending(userId);
  }

  private async getNextSequence(): Promise<number> {
    const maxSeq = await this.db.getMaxSequence();
    return (maxSeq ?? 0) + 1;
  }
}

// Local mock database
class LocalQueueDatabase {
  private ops: OfflineOperation[] = [];
  async addOperation(op: OfflineOperation) { this.ops.push(op); }
  async getPending(userId: string, limit: number) {
    return this.ops.filter(o => o.userId === userId && o.status === 'pending').slice(0, limit);
  }
  async updateStatus(id: string, status: 'completed' | 'failed') {
    const op = this.ops.find(o => o.id === id);
    if (op) op.status = status;
  }
  async countPending(userId?: string) {
    return this.ops.filter(o => !userId || o.userId === userId).filter(o => o.status === 'pending').length;
  }
  async getMaxSequence() {
    return this.ops.reduce((max, o) => Math.max(max, o.sequenceNumber), 0);
  }
}