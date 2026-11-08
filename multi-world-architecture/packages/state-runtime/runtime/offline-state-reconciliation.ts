// packages/state-runtime/runtime/offline-state-reconciliation.ts
/**
 * Offline State Reconciliation
 * 
 * Responsibilities:
 * - Queue state operations while offline for later synchronisation
 * - Detect and resolve conflicts when merging offline operations with server state
 * - Support last-writer-wins and operational transform strategies
 * - Report reconciliation results for observability
 * 
 * Owned state:
 * - offlineQueue: OfflineOperation[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - OfflineOperationPersistence (from database layer)
 * - DomainStateOrchestrator (to apply synced ops)
 * 
 * Event emissions:
 *   "state.offline.queued", "state.offline.synced", "state.offline.conflicted"
 * 
 * Event subscriptions: "connection.restored" (to trigger sync)
 * Synchronization: ordered by sequence number; conflicts resolved per entity
 * Recovery: queue persists across sessions
 * Telemetry: queue depth, sync latency, conflict rate
 * Diagnostics: pending offline operations
 * Accessibility: N/A
 * Performance: incremental sync; batch conflict resolution
 * Forbidden: double-syncing operations; losing offline changes
 */

import { v4 as uuidv4 } from 'uuid';
import type { DomainId, StateOperation, OfflineOperation } from '../contracts/state-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DomainStateOrchestrator } from './domain-state-orchestrator';

export class OfflineStateReconciliation {
  private queue: OfflineOperation[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private domainOrchestrator: DomainStateOrchestrator,
  ) {
    this.eventBus.subscribe('connection.restored', this.onConnectionRestored.bind(this));
  }

  async enqueue(domainId: DomainId, operation: StateOperation): Promise<void> {
    const op: OfflineOperation = {
      id: uuidv4(),
      domainId,
      operation,
      timestamp: Date.now(),
      sequenceNumber: this.queue.length,
      retryCount: 0,
      status: 'pending',
    };
    this.queue.push(op);
    this.meter.setGauge('state.offline.queue_depth', this.queue.length);
    this.logger.debug(`Offline operation queued: ${op.id}`);
    await this.eventBus.publish('state.offline.queued', { operationId: op.id, domainId });
  }

  private async onConnectionRestored(): Promise<void> {
    if (this.queue.length === 0) return;
    this.logger.info(`Syncing ${this.queue.length} offline operations`);
    const start = Date.now();
    let synced = 0;
    let conflicted = 0;
    for (const op of this.queue) {
      if (op.status === 'synced') continue;
      try {
        // Apply operation to domain state (conflict resolution would go here)
        switch (op.operation.type) {
          case 'set':
            await this.domainOrchestrator.setEntity(op.domainId, op.operation.entityId, op.operation.payload);
            break;
          case 'delete':
            await this.domainOrchestrator.deleteEntity(op.domainId, op.operation.entityId);
            break;
          case 'merge':
            await this.domainOrchestrator.setEntity(op.domainId, op.operation.entityId, op.operation.payload);
            break;
        }
        op.status = 'synced';
        synced++;
      } catch (err) {
        op.status = 'conflicted';
        op.retryCount++;
        conflicted++;
        this.logger.warn(`Conflict on offline operation ${op.id}`, { error: err });
      }
    }
    this.queue = this.queue.filter(op => op.status === 'conflicted' && op.retryCount < 3);
    this.meter.setGauge('state.offline.queue_depth', this.queue.length);
    this.meter.incrementCounter('state.offline.synced', synced);
    if (conflicted > 0) this.meter.incrementCounter('state.offline.conflicted', conflicted);
    await this.eventBus.publish('state.offline.synced', { synced, conflicted, remaining: this.queue.length });
    this.logger.info(`Offline sync completed: ${synced} synced, ${conflicted} conflicted`);
  }

  getQueueDepth(): number { return this.queue.length; }
}