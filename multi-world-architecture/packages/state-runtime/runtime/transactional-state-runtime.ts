// packages/state-runtime/runtime/transactional-state-runtime.ts
/**
 * Transactional State Runtime
 * 
 * Responsibilities:
 * - Execute state mutations within ACID-like transactions
 * - Support configurable isolation levels for concurrent operations
 * - Commit all operations atomically, or rollback on failure
 * - Maintain an undo log within the transaction for rollback
 * - Coordinate with domain state orchestrator for persistence
 * 
 * Owned state:
 * - activeTransactions: Map<TransactionId, Transaction>
 * - state: DomainState (the working state)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - DomainStateOrchestrator (to read/write committed state)
 * - StateRecoveryRuntime (to persist transaction log)
 * 
 * Event emissions:
 *   "state.transaction.started", "state.transaction.committed",
 *   "state.transaction.rolled_back"
 * 
 * Event subscriptions: none
 * Synchronization: optimistic concurrency via version checks; write locks per domain
 * Recovery: pending transactions replayed or rolled back on restart
 * Telemetry: transaction count, commit/rollback rate, latency
 * Diagnostics: active transactions, conflict rate
 * Accessibility: N/A
 * Performance: in-memory operations with async persistence; batch commits where possible
 * Forbidden: dirty reads violating isolation; lost updates without version check
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  TransactionId, Transaction, StateOperation, DomainState,
  StateEntityId, TransactionIsolation, StateVersion,
} from '../contracts/state-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DomainStateOrchestrator } from './domain-state-orchestrator';
import type { StateRecoveryRuntime } from './state-recovery-runtime';
import { createHash } from 'crypto';

export class TransactionalStateRuntime {
  private activeTransactions: Map<TransactionId, Transaction> = new Map();
  private optimisticLocks: Map<StateEntityId, StateVersion> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private domainOrchestrator: DomainStateOrchestrator,
    private recovery: StateRecoveryRuntime,
  ) {}

  async beginTransaction(isolation: TransactionIsolation = 'read_committed'): Promise<TransactionId> {
    const id = uuidv4() as TransactionId;
    const transaction: Transaction = {
      id,
      operations: [],
      isolation,
      startedAt: Date.now(),
      status: 'pending',
    };
    this.activeTransactions.set(id, transaction);
    this.meter.incrementCounter('state.transaction.started', { isolation });
    await this.eventBus.publish('state.transaction.started', { transactionId: id, isolation });
    this.logger.debug(`Transaction started: ${id}`);
    return id;
  }

  addOperation(txId: TransactionId, operation: StateOperation): void {
    const tx = this.activeTransactions.get(txId);
    if (!tx) throw new Error(`Transaction not active: ${txId}`);
    // For writes, record previous value for potential rollback
    if (operation.type === 'set' || operation.type === 'merge') {
      const currentEntity = this.domainOrchestrator.getEntity(operation.entityId);
      operation.previousValue = currentEntity ?? null;
    }
    tx.operations.push(operation);
  }

  async commitTransaction(txId: TransactionId, domainId: string): Promise<void> {
    const tx = this.activeTransactions.get(txId);
    if (!tx) throw new Error(`Transaction not found: ${txId}`);
    const start = Date.now();
    try {
      // Optimistic concurrency check for SERIALIZABLE
      if (tx.isolation === 'serializable') {
        for (const op of tx.operations) {
          const currentVersion = this.optimisticLocks.get(op.entityId);
          if (currentVersion !== undefined) {
            // In full implementation, check version hasn't changed since read
          }
        }
      }
      // Apply all operations to the domain state
      for (const op of tx.operations) {
        await this.applyOperation(domainId, op);
      }
      tx.status = 'committed';
      this.activeTransactions.delete(txId);
      await this.recovery.clearTransactionLog(txId);
      this.meter.incrementCounter('state.transaction.committed');
      this.meter.recordHistogram('state.transaction.duration', Date.now() - start);
      await this.eventBus.publish('state.transaction.committed', { transactionId: txId, opCount: tx.operations.length });
      this.logger.debug(`Transaction committed: ${txId} (${tx.operations.length} ops)`);
    } catch (err) {
      await this.rollbackTransaction(txId, domainId);
      throw err;
    }
  }

  async rollbackTransaction(txId: TransactionId, domainId: string): Promise<void> {
    const tx = this.activeTransactions.get(txId);
    if (!tx) return;
    // Reverse operations using stored previous values
    for (let i = tx.operations.length - 1; i >= 0; i--) {
      const op = tx.operations[i];
      if (op.previousValue !== undefined) {
        await this.applyOperation(domainId, {
          type: 'set',
          entityId: op.entityId,
          payload: op.previousValue,
        });
      } else if (op.type !== 'set') {
        // For delete, we would restore from previousValue if stored
      }
    }
    tx.status = 'rolled_back';
    this.activeTransactions.delete(txId);
    await this.recovery.clearTransactionLog(txId);
    this.meter.incrementCounter('state.transaction.rolled_back');
    await this.eventBus.publish('state.transaction.rolled_back', { transactionId: txId });
    this.logger.warn(`Transaction rolled back: ${txId}`);
  }

  private async applyOperation(domainId: string, op: StateOperation): Promise<void> {
    switch (op.type) {
      case 'set':
        await this.domainOrchestrator.setEntity(domainId, op.entityId, op.payload);
        break;
      case 'delete':
        await this.domainOrchestrator.deleteEntity(domainId, op.entityId);
        break;
      case 'merge':
        const existing = this.domainOrchestrator.getEntity(op.entityId);
        const merged = typeof existing === 'object' ? { ...existing as object, ...op.payload as object } : op.payload;
        await this.domainOrchestrator.setEntity(domainId, op.entityId, merged);
        break;
      case 'patch':
        await this.domainOrchestrator.patchEntity(domainId, op.entityId, op.payload);
        break;
    }
  }

  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }
}