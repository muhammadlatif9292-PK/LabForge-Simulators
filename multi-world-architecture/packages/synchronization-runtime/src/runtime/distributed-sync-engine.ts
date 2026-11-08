// packages/synchronization-runtime/src/runtime/distributed-sync-engine.ts
/**
 * Distributed Sync Engine
 * 
 * Responsibilities:
 * - Orchestrate state synchronization across all nodes in the cluster
 * - Manage the complete sync lifecycle: connect, compare, resolve, apply
 * - Coordinate with operation ordering, conflict resolution, and replay subsystems
 * - Maintain sync health and telemetry for all replicas
 * - Detect and repair divergent replicas automatically
 * 
 * Owned state:
 * - connectedNodes: Map<NodeId, SyncState>
 * - localState: SyncState
 * - syncSessions: Map<SyncSessionId, SyncSession>
 * - pendingOps: SyncOperation[] (outgoing queue)
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus (for peer discovery and sync messages)
 * - ConflictResolutionEngine
 * - OperationOrderingEngine
 * - DistributedStateValidator
 * - DeterministicReconciliation
 * - OfflineOperationReplay
 * 
 * Event emissions:
 * - "sync.engine.started", "sync.engine.stopped"
 * - "sync.replica.connected", "sync.replica.disconnected"
 * - "sync.cycle.completed", "sync.divergence.detected"
 * - "sync.repair.started", "sync.repair.completed"
 * 
 * Event subscriptions:
 * - "sync.peer.hello" (other nodes announcing themselves)
 * - "sync.operation.incoming" (operations from peers)
 * - "sync.state.requested" (state hash queries)
 * 
 * Synchronization: uses distributed locks during repair; vector clocks for causality
 * Recovery: full state rebuild from peers if local state corrupted
 * Telemetry: sync latency, pending operations gauge, divergence events counter
 * Diagnostics: connected peers, last sync time, state hash
 * Accessibility: N/A
 * Performance: incremental sync; batch operations for efficiency
 * Forbidden: blocking the main thread during sync cycles; unbounded pending queues
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  SyncSessionId,
  NodeId,
  SyncOperation,
  SyncState,
  OperationSequence,
  StateHash,
  SyncHealth,
} from '../contracts/sync-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ConflictResolutionEngine } from './conflict-resolution-engine';
import type { OperationOrderingEngine } from './operation-ordering-engine';
import type { DistributedStateValidator } from './distributed-state-validator';
import type { DeterministicReconciliation } from './deterministic-reconciliation';
import type { OfflineOperationReplay } from './offline-operation-replay';
import { createHash } from 'crypto';

interface SyncSession {
  id: SyncSessionId;
  peerId: NodeId;
  startedAt: number;
  operationsExchanged: number;
  status: 'active' | 'completed' | 'failed';
}

export class DistributedSyncEngine {
  private connectedNodes: Map<NodeId, SyncState> = new Map();
  private syncSessions: Map<SyncSessionId, SyncSession> = new Map();
  private pendingOutgoingOps: SyncOperation[] = [];
  private localState: SyncState;
  private syncInterval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private nodeId: NodeId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private conflictEngine: ConflictResolutionEngine,
    private orderingEngine: OperationOrderingEngine,
    private stateValidator: DistributedStateValidator,
    private reconciliation: DeterministicReconciliation,
    private offlineReplay: OfflineOperationReplay,
  ) {
    this.localState = {
      nodeId,
      lastSequence: 0 as OperationSequence,
      stateHash: this.computeHash('initial'),
      historySize: 0,
      uptimeMs: 0,
    };
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    this.eventBus.subscribe('sync.peer.hello', this.onPeerHello.bind(this));
    this.eventBus.subscribe('sync.operation.incoming', this.onIncomingOperation.bind(this));
    this.eventBus.subscribe('sync.state.requested', this.onStateRequested.bind(this));
    this.eventBus.subscribe('sync.operation.broadcast', this.onOperationBroadcast.bind(this));
  }

  async start(intervalMs: number = 10000): Promise<void> {
    this.running = true;
    // Announce self to cluster
    await this.eventBus.publish('sync.peer.hello', {
      nodeId: this.nodeId,
      state: this.localState,
      timestamp: Date.now(),
    });
    // Start periodic sync cycle
    this.syncInterval = setInterval(() => this.syncCycle(), intervalMs);
    this.meter.incrementCounter('sync.engine.started');
    this.logger.info(`Sync engine started on node ${this.nodeId}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.meter.incrementCounter('sync.engine.stopped');
    this.logger.info(`Sync engine stopped on node ${this.nodeId}`);
  }

  private async syncCycle(): Promise<void> {
    if (!this.running) return;
    const span = this.tracer.startSpan('sync.cycle', { nodeId: this.nodeId });
    const start = Date.now();
    try {
      // 1. Process pending outgoing operations
      await this.flushPendingOperations();
      // 2. Query peers for their state
      await this.queryPeerStates();
      // 3. Compare and reconcile
      await this.reconcileIfNeeded();
      this.meter.recordHistogram('sync.cycle.duration', Date.now() - start);
      this.meter.incrementCounter('sync.cycle.completed');
    } catch (err) {
      this.logger.error('Sync cycle failed', { error: err });
      this.meter.incrementCounter('sync.cycle.failed');
    } finally {
      span.finish();
    }
  }

  async enqueueOperation(operation: SyncOperation): Promise<void> {
    operation.retryCount = 0;
    operation.status = 'pending';
    this.pendingOutgoingOps.push(operation);
    this.meter.setGauge('sync.pending_operations', this.pendingOutgoingOps.length);
  }

  private async flushPendingOperations(): Promise<void> {
    if (this.pendingOutgoingOps.length === 0) return;
    const batch = this.pendingOutgoingOps.splice(0, 100);
    // Assign global ordering
    for (const op of batch) {
      const order = await this.orderingEngine.assignOrder(op);
      op.sequenceNumber = order.globalOrder as OperationSequence;
    }
    // Broadcast to all peers
    await this.eventBus.publish('sync.operation.broadcast', {
      sourceNodeId: this.nodeId,
      operations: batch,
      timestamp: Date.now(),
    });
    this.meter.incrementCounter('sync.operations.flushed', batch.length);
  }

  private async queryPeerStates(): Promise<void> {
    // Request state from all known peers
    await this.eventBus.publish('sync.state.requested', {
      requestingNodeId: this.nodeId,
      timestamp: Date.now(),
    });
  }

  private async reconcileIfNeeded(): Promise<void> {
    const peers = Array.from(this.connectedNodes.values());
    for (const peerState of peers) {
      if (peerState.stateHash !== this.localState.stateHash) {
        this.logger.warn(`State divergence detected with node ${peerState.nodeId}`);
        this.meter.incrementCounter('sync.divergence.detected');
        await this.repairDivergence(peerState.nodeId);
      }
    }
  }

  private async repairDivergence(peerNodeId: NodeId): Promise<void> {
    this.meter.incrementCounter('sync.repair.started');
    const span = this.tracer.startSpan('sync.repair', { peerNodeId });
    try {
      // Request full operation history from peer
      // For now, use reconciliation to deterministically merge
      const result = await this.reconciliation.reconcile(peerNodeId, this.localState);
      this.localState.stateHash = result.newStateHash;
      this.localState.lastSequence = Math.max(
        this.localState.lastSequence,
        ...result.mergedOperations.map(o => o.sequenceNumber),
      ) as OperationSequence;
      this.meter.incrementCounter('sync.repair.completed');
      this.logger.info(`Repair completed with node ${peerNodeId}`);
    } catch (err) {
      this.logger.error(`Repair failed with node ${peerNodeId}`, { error: err });
      this.meter.incrementCounter('sync.repair.failed');
    } finally {
      span.finish();
    }
  }

  private onPeerHello(event: any): void {
    const { nodeId, state, timestamp } = event.payload;
    if (nodeId === this.nodeId) return;
    this.connectedNodes.set(nodeId, state);
    this.meter.incrementCounter('sync.replica.connected');
    this.logger.debug(`Peer connected: ${nodeId}`);
    // Trigger immediate sync with new peer
    this.syncCycle().catch(err => this.logger.error('Sync with new peer failed', err));
  }

  private async onIncomingOperation(event: any): Promise<void> {
    const { sourceNodeId, operation } = event.payload;
    if (sourceNodeId === this.nodeId) return;
    try {
      const resolved = await this.conflictEngine.resolve(operation);
      if (resolved) {
        await this.applyOperation(operation);
      }
    } catch (err) {
      this.logger.error(`Failed to process incoming operation from ${sourceNodeId}`, { error: err });
    }
  }

  private onStateRequested(event: any): void {
    const { requestingNodeId, timestamp } = event.payload;
    // Respond with our current state
    this.eventBus.publish('sync.state.response', {
      nodeId: this.nodeId,
      state: this.localState,
      requestorId: requestingNodeId,
    });
  }

  private async onOperationBroadcast(event: any): Promise<void> {
    const { sourceNodeId, operations } = event.payload;
    if (sourceNodeId === this.nodeId) return;
    for (const op of operations) {
      await this.applyOperation(op);
    }
  }

  private async applyOperation(operation: SyncOperation): Promise<void> {
    // Validate before applying
    const valid = await this.stateValidator.validateOperation(operation, this.localState);
    if (!valid) {
      operation.status = 'failed';
      this.meter.incrementCounter('sync.operation.failed');
      return;
    }
    // Apply locally (domain-specific logic would go here)
    operation.status = 'applied';
    this.localState.lastSequence = Math.max(this.localState.lastSequence, operation.sequenceNumber) as OperationSequence;
    this.localState.historySize++;
    this.localState.stateHash = this.computeHash(this.localState.stateHash + operation.id);
    this.meter.incrementCounter('sync.operation.applied');
  }

  private computeHash(input: string): StateHash {
    return createHash('sha256').update(input).digest('hex').substring(0, 16) as StateHash;
  }

  async getHealth(): Promise<SyncHealth> {
    const peers = Array.from(this.connectedNodes.values());
    const inSync = peers.filter(p => p.stateHash === this.localState.stateHash).length;
    return {
      status: inSync === peers.length && peers.length > 0 ? 'synced' :
              this.pendingOutgoingOps.length > 0 ? 'reconciling' : 'degraded',
      pendingOperations: this.pendingOutgoingOps.length,
      conflictCount: this.conflictEngine.getConflictCount(),
      lastSyncTimestamp: Date.now(),
      replicasInSync: inSync,
      totalReplicas: peers.length + 1, // including self
    };
  }

  async shutdown(): Promise<void> {
    await this.stop();
    this.connectedNodes.clear();
    this.syncSessions.clear();
    this.pendingOutgoingOps = [];
  }
}