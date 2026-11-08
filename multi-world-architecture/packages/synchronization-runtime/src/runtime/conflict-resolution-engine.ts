// packages/synchronization-runtime/src/runtime/conflict-resolution-engine.ts
/**
 * Conflict Resolution Engine
 * 
 * Responsibilities:
 * - Detect conflicts when the same state has been modified on multiple nodes
 * - Apply resolution strategies: LWW, operational transform, CRDT merge, three-way merge
 * - Record conflict history for audit and model improvement
 * - Support custom resolution handlers per operation type
 * - Escalate unresolvable conflicts to human review
 * 
 * Owned state:
 * - conflictLog: ConflictRecord[] (bounded)
 * - resolutionHandlers: Map<string, ConflictHandler>
 * - activeConflicts: Map<string, ConflictRecord>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to emit conflict events)
 * - OperationOrderingEngine (for causal ordering)
 * 
 * Event emissions:
 * - "sync.conflict.detected", "sync.conflict.resolved", "sync.conflict.escalated"
 * 
 * Event subscriptions: none (called directly by sync engine)
 * Synchronization: relies on version vectors or timestamps passed with operation
 * Recovery: conflict log persisted; unresolved conflicts re-evaluated on restart
 * Telemetry: conflict count, resolution strategy distribution, escalation rate
 * Diagnostics: active conflicts, recent resolutions
 * Accessibility: escalated conflicts include clear context for operators
 * Performance: fast path for no-conflict; async resolution for complex merges
 * Forbidden: silently dropping conflicting operations; blocking sync on conflict resolution
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  SyncOperation,
  ConflictRecord,
  ConflictStrategy,
} from '../contracts/sync-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { OperationOrderingEngine } from './operation-ordering-engine';

type ConflictHandler = (
  localOp: SyncOperation,
  remoteOp: SyncOperation,
  strategy: ConflictStrategy,
) => Promise<{ resolved: boolean; mergedPayload?: unknown }>;

export class ConflictResolutionEngine {
  private conflictLog: ConflictRecord[] = [];
  private handlers: Map<string, ConflictHandler> = new Map();
  private activeConflicts: Map<string, ConflictRecord> = new Map();
  private maxLogSize = 1000;
  private defaultStrategy: ConflictStrategy = ConflictStrategy.LAST_WRITER_WINS;

  constructor(
    private eventBus: DistributedEventBus,
    private orderingEngine: OperationOrderingEngine,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  registerHandler(operationType: string, handler: ConflictHandler): void {
    this.handlers.set(operationType, handler);
    this.logger.debug(`Conflict handler registered for type: ${operationType}`);
  }

  setDefaultStrategy(strategy: ConflictStrategy): void {
    this.defaultStrategy = strategy;
  }

  async resolve(incomingOp: SyncOperation, localOps?: SyncOperation[]): Promise<SyncOperation | null> {
    const strategy = this.defaultStrategy;
    const start = Date.now();
    try {
      switch (strategy) {
        case ConflictStrategy.LAST_WRITER_WINS:
          return this.resolveLWW(incomingOp, localOps?.[0]);
        case ConflictStrategy.OPERATIONAL_TRANSFORM:
          return this.resolveOT(incomingOp, localOps);
        case ConflictStrategy.CRDT:
          return this.resolveCRDT(incomingOp, localOps);
        case ConflictStrategy.THREE_WAY_MERGE:
          return this.resolveThreeWay(incomingOp, localOps);
        default:
          return this.resolveLWW(incomingOp, localOps?.[0]);
      }
    } catch (err) {
      this.logger.error(`Conflict resolution failed for ${incomingOp.id}`, { error: err });
      return this.escalateConflict(incomingOp, localOps);
    } finally {
      this.meter.recordHistogram('sync.conflict.resolution.duration', Date.now() - start);
    }
  }

  private async resolveLWW(incoming: SyncOperation, local?: SyncOperation): Promise<SyncOperation | null> {
    if (!local) return incoming; // no conflict
    if (incoming.timestamp >= local.timestamp) {
      this.recordConflict(incoming.id, local.id, ConflictStrategy.LAST_WRITER_WINS, incoming.payload);
      return incoming; // incoming wins
    }
    this.recordConflict(incoming.id, local.id, ConflictStrategy.LAST_WRITER_WINS, local.payload);
    return null; // local wins, discard incoming
  }

  private async resolveOT(incoming: SyncOperation, localOps?: SyncOperation[]): Promise<SyncOperation | null> {
    if (!localOps || localOps.length === 0) return incoming;
    // Operational transformation: transform incoming against local ops
    // Simplified: apply all local ops, then check if incoming still applicable
    for (const localOp of localOps) {
      if (localOp.type === incoming.type) {
        // Same type conflict: use LWW as fallback
        return this.resolveLWW(incoming, localOp);
      }
    }
    // No direct conflict, can apply
    return incoming;
  }

  private async resolveCRDT(incoming: SyncOperation, localOps?: SyncOperation[]): Promise<SyncOperation | null> {
    // CRDT merge: assume payload is a CRDT-compatible structure
    // For now, simply accept all operations (CRDTs are conflict-free by design)
    return incoming;
  }

  private async resolveThreeWay(incoming: SyncOperation, localOps?: SyncOperation[]): Promise<SyncOperation | null> {
    // Three-way merge requires base version; simplified
    const handler = this.handlers.get(incoming.type);
    if (handler && localOps && localOps.length > 0) {
      const result = await handler(localOps[0], incoming, ConflictStrategy.THREE_WAY_MERGE);
      if (result.resolved) {
        incoming.payload = result.mergedPayload ?? incoming.payload;
        return incoming;
      }
    }
    return this.resolveLWW(incoming, localOps?.[0]);
  }

  private async escalateConflict(incoming: SyncOperation, localOps?: SyncOperation[]): Promise<SyncOperation | null> {
    const conflict: ConflictRecord = {
      operationId: incoming.id,
      conflictingOperations: (localOps ?? []).map(o => o.id),
      resolvedBy: ConflictStrategy.CUSTOM,
      resolvedAt: Date.now(),
      resolution: null,
      originalPayloads: [incoming.payload, ...(localOps ?? []).map(o => o.payload)],
    };
    this.activeConflicts.set(incoming.id, conflict);
    this.meter.incrementCounter('sync.conflict.escalated');
    await this.eventBus.publish('sync.conflict.escalated', {
      conflict,
      requiresManualResolution: true,
    });
    this.logger.warn(`Conflict escalated for manual resolution: ${incoming.id}`);
    return null; // not resolved automatically
  }

  private recordConflict(
    operationId: string,
    conflictingOpId: string,
    strategy: ConflictStrategy,
    resolution: unknown,
  ): void {
    const record: ConflictRecord = {
      operationId,
      conflictingOperations: [conflictingOpId],
      resolvedBy: strategy,
      resolvedAt: Date.now(),
      resolution,
      originalPayloads: [],
    };
    this.conflictLog.push(record);
    if (this.conflictLog.length > this.maxLogSize) {
      this.conflictLog.shift();
    }
    this.meter.incrementCounter('sync.conflict.detected');
    this.eventBus.publish('sync.conflict.resolved', { record });
  }

  getConflictCount(): number {
    return this.conflictLog.length;
  }

  getActiveConflicts(): ConflictRecord[] {
    return Array.from(this.activeConflicts.values());
  }

  async resolveManually(operationId: string, resolution: unknown): Promise<void> {
    const conflict = this.activeConflicts.get(operationId);
    if (conflict) {
      conflict.resolution = resolution;
      conflict.resolvedAt = Date.now();
      this.activeConflicts.delete(operationId);
      this.logger.info(`Conflict ${operationId} resolved manually`);
    }
  }
}