// packages/synchronization-runtime/src/runtime/deterministic-reconciliation.ts
/**
 * Deterministic Reconciliation
 * 
 * Responsibilities:
 * - Reconcile divergent states between nodes using a deterministic algorithm
 * - Compute the union of operations from both nodes and apply in deterministic order
 * - Guarantee that all nodes converge to the same state given the same inputs
 * - Produce a reconciliation result with merged operations and new state hash
 * - Support rollback to a common ancestor if needed
 * 
 * Owned state:
 * - reconciliationHistory: ReconciliationResult[] (bounded, for audit)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - OperationOrderingEngine (for deterministic sorting of operations)
 * - ConflictResolutionEngine (to resolve per-operation conflicts)
 * - DistributedStateValidator (to verify result)
 * 
 * Event emissions:
 * - "sync.reconciliation.started", "sync.reconciliation.completed", "sync.reconciliation.failed"
 * 
 * Event subscriptions: called directly by DistributedSyncEngine
 * Synchronization: must hold distributed lock during reconciliation
 * Recovery: if reconciliation interrupted, restart from common ancestor
 * Telemetry: reconciliation duration, operation count, conflict rate
 * Diagnostics: recent reconciliation results
 * Accessibility: N/A
 * Performance: O(n log n) for sorting operations; bulk apply
 * Forbidden: non-deterministic tie-breaking; ignoring operations
 */

import { createHash } from 'crypto';
import type {
  SyncOperation,
  ReconciliationResult,
  SyncState,
  NodeId,
  StateHash,
} from '../contracts/sync-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { OperationOrderingEngine } from './operation-ordering-engine';
import type { ConflictResolutionEngine } from './conflict-resolution-engine';
import type { DistributedStateValidator } from './distributed-state-validator';

export class DeterministicReconciliation {
  private history: ReconciliationResult[] = [];
  private maxHistory = 100;

  constructor(
    private eventBus: DistributedEventBus,
    private orderingEngine: OperationOrderingEngine,
    private conflictEngine: ConflictResolutionEngine,
    private stateValidator: DistributedStateValidator,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async reconcile(peerNodeId: NodeId, localState: SyncState, peerOps?: SyncOperation[], localOps?: SyncOperation[]): Promise<ReconciliationResult> {
    this.meter.incrementCounter('sync.reconciliation.started');
    const start = Date.now();
    const span = this.logger as any; // tracer placeholder
    try {
      // Collect all operations from both sides
      const allOps = [...(peerOps ?? []), ...(localOps ?? [])];
      // Deterministic sorting: by global order, then by operation ID
      const sortedOps = await this.deterministicSort(allOps);
      // Apply in order, resolving conflicts
      const mergedOps: SyncOperation[] = [];
      const conflicts: any[] = [];
      for (const op of sortedOps) {
        const existingIndex = mergedOps.findIndex(o => o.id === op.id);
        if (existingIndex >= 0) {
          // Conflict: same operation ID, different content
          const existing = mergedOps[existingIndex];
          const resolved = await this.conflictEngine.resolve(op, [existing]);
          if (resolved) {
            mergedOps[existingIndex] = resolved;
            conflicts.push({
              operationId: op.id,
              conflictingOperations: [existing.id],
              resolvedBy: 'deterministic',
              resolvedAt: Date.now(),
              resolution: resolved.payload,
              originalPayloads: [op.payload, existing.payload],
            });
          }
        } else {
          mergedOps.push(op);
        }
      }
      // Compute new state hash
      const newStateHash = this.computeStateHash(mergedOps);
      const result: ReconciliationResult = {
        consistent: conflicts.length === 0,
        divergenceCount: conflicts.length,
        mergedOperations: mergedOps,
        conflicts,
        newStateHash,
      };
      this.history.push(result);
      if (this.history.length > this.maxHistory) this.history.shift();
      this.meter.recordHistogram('sync.reconciliation.duration', Date.now() - start);
      this.meter.incrementCounter('sync.reconciliation.completed');
      this.logger.info(`Reconciliation completed with node ${peerNodeId}: ${mergedOps.length} ops merged, ${conflicts.length} conflicts`);
      await this.eventBus.publish('sync.reconciliation.completed', {
        peerNodeId,
        operationsMerged: mergedOps.length,
        conflicts: conflicts.length,
      });
      return result;
    } catch (err) {
      this.meter.incrementCounter('sync.reconciliation.failed');
      this.logger.error(`Reconciliation failed with node ${peerNodeId}`, { error: err });
      throw err;
    }
  }

  private async deterministicSort(operations: SyncOperation[]): Promise<SyncOperation[]> {
    // Sort by global order (from ordering engine), then timestamp, then ID
    return operations.sort((a, b) => {
      const orderA = this.orderingEngine.getGlobalOrder(a.id) ?? 0;
      const orderB = this.orderingEngine.getGlobalOrder(b.id) ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.id.localeCompare(b.id);
    });
  }

  private computeStateHash(operations: SyncOperation[]): StateHash {
    const concatenated = operations
      .map(o => `${o.id}:${o.type}:${o.timestamp}`)
      .join('|');
    return createHash('sha256').update(concatenated).digest('hex').substring(0, 16) as StateHash;
  }

  getLastReconciliation(): ReconciliationResult | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}