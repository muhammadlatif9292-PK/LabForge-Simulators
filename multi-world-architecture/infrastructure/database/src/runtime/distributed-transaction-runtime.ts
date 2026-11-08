// infrastructure/database/src/runtime/distributed-transaction-runtime.ts
/**
 * Distributed Transaction Runtime
 * 
 * Responsibilities:
 * - Top-level orchestrator for coordinating multi-document transactions
 *   across shards using the underlying DistributedTransactionManager
 * - Provide a simplified, promise-based API for begin/commit/rollback
 * - Enforce configurable isolation levels per transaction
 * - Emit telemetry on transaction outcomes
 * 
 * Dependencies:
 * - DistributedTransactionManager (from transactions/)
 * - ILogger, IMeter, ITracer
 * - DistributedLockManager
 * 
 * Event emissions: "database.transaction.started", "database.transaction.committed"
 */

import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import { DistributedTransactionManager } from '../transactions/distributed-transaction-manager';
import type { DistributedLockManager } from '@labforge/backend/distributed-lock-manager';

export class DistributedTransactionRuntime {
  private manager: DistributedTransactionManager;

  constructor(
    logger: ILogger,
    meter: IMeter,
    tracer: ITracer,
    lockManager: DistributedLockManager,
    dbClient: any,
  ) {
    this.manager = new DistributedTransactionManager(logger, meter, tracer, lockManager, dbClient);
  }

  async beginTransaction(isolationLevel: 'read_committed' | 'repeatable_read' | 'serializable' = 'read_committed') {
    return this.manager.beginTransaction(isolationLevel);
  }

  async addOperation(txId: any, operation: any) {
    return this.manager.addOperation(txId, operation);
  }

  async commit(txId: any) {
    return this.manager.commitTransaction(txId);
  }

  async rollback(txId: any) {
    return this.manager.rollbackTransaction(txId);
  }

  health() { return this.manager.health(); }
}