// infrastructure/database/src/runtime/offline-operation-persistence.ts
/**
 * Offline Operation Persistence
 * 
 * Responsibilities:
 * - Wraps OfflineOperationPersistence with a runtime API for enqueuing
 *   and syncing offline database operations
 * 
 * Dependencies:
 * - OfflineOperationPersistence (from queues/)
 * - ILogger, IMeter
 */

import { OfflineOperationPersistence as LowLevelPersistence } from '../queues/offline-operation-persistence';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class OfflineOperationPersistence {
  private persistence: LowLevelPersistence;

  constructor(
    logger: ILogger,
    meter: IMeter,
  ) {
    this.persistence = new LowLevelPersistence(logger, meter);
  }

  async enqueue(userId: string, type: string, payload: unknown) {
    return this.persistence.enqueue(userId, type, payload);
  }

  async getPending(userId: string, limit: number = 50) {
    return this.persistence.getPendingOperations(userId, limit);
  }

  async markCompleted(opId: string) {
    return this.persistence.markAsCompleted(opId);
  }

  async queueDepth(userId?: string) {
    return this.persistence.queueDepth(userId);
  }
}