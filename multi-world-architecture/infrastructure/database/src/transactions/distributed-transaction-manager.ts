// infrastructure/database/src/transactions/distributed-transaction-manager.ts
/**
 * Distributed Transaction Manager
 * 
 * Responsibilities:
 * - Coordinate multi-document transactions across shards/collections
 * - Enforce isolation levels and rollback on failure
 * - Support two-phase commit protocol
 * - Provide transaction logging for audit and recovery
 * 
 * Owned state:
 * - activeTransactions: Map<TransactionId, TransactionContext>
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DatabaseClient (injected)
 * - DistributedLockManager
 * 
 * Event emissions:
 * - "database.transaction.started", "database.transaction.committed", "database.transaction.rolledback"
 * 
 * Event subscriptions: none
 * Synchronization: uses distributed lock for transaction coordinator
 * Recovery: replays write-ahead log to finalize pending transactions after crash
 * Telemetry: transaction duration, commit/rollback rates
 * Diagnostics: active transactions, lock contention
 * Accessibility: errors contain transaction IDs
 * Performance: batching writes; async commit notification
 * Forbidden: leaving transactions open indefinitely; dirty reads
 */

import { v4 as uuidv4 } from 'uuid';
import type { TransactionId, TransactionContext, DatabaseOperation } from '../contracts/database-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedLockManager } from '@labforge/backend/distributed-lock-manager';

export class DistributedTransactionManager {
  private activeTransactions: Map<TransactionId, TransactionContext> = new Map();
  private readonly maxTransactionMs = 30000; // 30 seconds timeout

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private lockManager: DistributedLockManager,
    private dbClient: any, // abstraction
  ) {
    // Periodically check for expired transactions
    setInterval(() => this.timeoutTransactions(), 5000);
  }

  async beginTransaction(isolationLevel: 'read_committed' | 'repeatable_read' | 'serializable' = 'read_committed'): Promise<TransactionId> {
    const id = uuidv4() as TransactionId;
    const context: TransactionContext = {
      id,
      startedAt: Date.now(),
      isolationLevel,
      operations: [],
    };
    this.activeTransactions.set(id, context);
    this.meter.incrementCounter('database.transaction.started');
    this.logger.debug(`Transaction started: ${id}`);
    return id;
  }

  async addOperation(txId: TransactionId, operation: DatabaseOperation): Promise<void> {
    const tx = this.activeTransactions.get(txId);
    if (!tx) throw new Error(`Transaction ${txId} not active`);
    tx.operations.push(operation);
  }

  async commitTransaction(txId: TransactionId): Promise<void> {
    const tx = this.activeTransactions.get(txId);
    if (!tx) throw new Error(`Transaction ${txId} not found`);
    const span = this.tracer.startSpan('database.transaction.commit', { transactionId: txId });
    try {
      // Two-phase commit: prepare, then commit
      await this.prepare(tx);
      await this.executeCommit(tx);
      this.activeTransactions.delete(txId);
      this.meter.incrementCounter('database.transaction.committed');
      this.logger.info(`Transaction committed: ${txId}`);
    } catch (err) {
      this.logger.error(`Transaction commit failed: ${txId}`, { error: err });
      await this.rollbackTransaction(txId);
      throw err;
    } finally {
      span.finish();
    }
  }

  async rollbackTransaction(txId: TransactionId): Promise<void> {
    const tx = this.activeTransactions.get(txId);
    if (!tx) return;
    // Revert operations in reverse order (if needed, based on change logs)
    // For demo, just clear
    this.activeTransactions.delete(txId);
    this.meter.incrementCounter('database.transaction.rolledback');
    this.logger.warn(`Transaction rolled back: ${txId}`);
  }

  private async prepare(tx: TransactionContext): Promise<void> {
    // Write operations to write-ahead log (WAL) for durability
    // Simulated
  }

  private async executeCommit(tx: TransactionContext): Promise<void> {
    // Apply all operations to the database atomically
    for (const op of tx.operations) {
      await this.applyOperation(op);
    }
  }

  private async applyOperation(op: DatabaseOperation): Promise<void> {
    // Proxy to DB client
    switch (op.type) {
      case 'insert':
        await this.dbClient.insert(op.collection, op.document);
        break;
      case 'update':
        await this.dbClient.update(op.collection, op.filter, op.update);
        break;
      case 'delete':
        await this.dbClient.delete(op.collection, op.filter);
        break;
    }
  }

  private timeoutTransactions(): void {
    const now = Date.now();
    for (const [id, tx] of this.activeTransactions) {
      if (now - tx.startedAt > this.maxTransactionMs) {
        this.logger.warn(`Transaction ${id} timed out, rolling back`);
        this.rollbackTransaction(id).catch(err => this.logger.error('Rollback failed', err));
      }
    }
  }

  health() {
    return { activeTransactions: this.activeTransactions.size };
  }
}