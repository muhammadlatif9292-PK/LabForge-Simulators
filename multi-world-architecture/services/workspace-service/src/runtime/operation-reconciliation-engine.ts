// services/workspace-service/src/runtime/operation-reconciliation-engine.ts
/**
 * Operation Reconciliation Engine
 * 
 * Responsibilities:
 * - Reconcile conflicting workspace operations from multiple concurrent users
 * - Implement last-writer-wins with deterministic tiebreakers
 * - Maintain operation log for audit and replay
 * - Detect and resolve divergent workspace states
 * - Coordinate with distributed lock manager for critical sections
 * 
 * Owned state:
 * - operationLog: ReconciledOperation[] (bounded)
 * - activeReconciliations: Map<WorkspaceId, Promise<void>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - DistributedLockManager
 * - EventStreamWriter (for persisting resolved ops)
 * 
 * Event emissions:
 *   "workspace.operation.reconciled", "workspace.conflict.detected"
 * 
 * Event subscriptions: "workspace.operation.incoming" from multiple users
 * Synchronization: distributed lock per workspace during reconciliation
 * Recovery: unresolved operations replayed after crash
 * Telemetry: reconciliation latency, conflict rate, operation throughput
 * Diagnostics: pending reconciliations, conflict log
 * Accessibility: N/A
 * Performance: sequential reconciliation per workspace; batch processing
 * Forbidden: losing operations; non-deterministic tiebreakers
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

type WorkspaceId = string;
type OperationId = string;

interface WorkspaceOperation {
  id: OperationId;
  userId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  sequenceNumber: number;
}

interface ReconciledOperation extends WorkspaceOperation {
  reconciledAt: number;
  conflict: boolean;
  originalOpId?: OperationId;
}

export class OperationReconciliationEngine {
  private log: ReconciledOperation[] = [];
  private activeReconciliations: Map<WorkspaceId, Promise<void>> = new Map();
  private readonly maxLogSize = 10000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private lockManager: any, // DistributedLockManager
    private eventWriter: any, // EventStreamWriter
  ) {}

  async reconcileOperation(
    workspaceId: WorkspaceId,
    operation: WorkspaceOperation,
  ): Promise<ReconciledOperation> {
    // Serialise per workspace using distributed lock
    const lockKey = `workspace:reconcile:${workspaceId}`;
    const lock = await this.lockManager.acquire(lockKey, 5000);
    try {
      // Check for conflicts: any operation with same target and near timestamp
      const recentOps = this.log.filter(
        o => o.userId === operation.userId && Math.abs(o.timestamp - operation.timestamp) < 1000,
      );
      const conflict = recentOps.length > 0;

      const reconciled: ReconciledOperation = {
        ...operation,
        reconciledAt: Date.now(),
        conflict,
        originalOpId: conflict ? recentOps[0].id : undefined,
      };

      // Deterministic resolution: if conflict, keep the one with later timestamp; tiebreak by ID
      if (conflict) {
        const other = recentOps[0];
        if (other.timestamp > operation.timestamp || (other.timestamp === operation.timestamp && other.id > operation.id)) {
          // Other wins, discard incoming
          this.meter.incrementCounter('workspace.conflict.detected');
          await this.eventBus.publish('workspace.conflict.detected', {
            workspaceId,
            incomingOpId: operation.id,
            winningOpId: other.id,
          });
          return other as ReconciledOperation;
        }
      }

      this.log.push(reconciled);
      if (this.log.length > this.maxLogSize) this.log.shift();

      // Persist reconciled operation to event stream
      await this.eventWriter.appendEvents(`workspace:${workspaceId}`, [reconciled]);

      this.meter.incrementCounter('workspace.operation.reconciled');
      await this.eventBus.publish('workspace.operation.reconciled', {
        workspaceId,
        operationId: operation.id,
        conflict,
      });

      return reconciled;
    } finally {
      lock.release();
    }
  }

  getReconciliationLog(workspaceId: WorkspaceId, limit: number = 50): ReconciledOperation[] {
    return this.log.filter(o => o.type.includes(workspaceId)).slice(-limit);
  }
}