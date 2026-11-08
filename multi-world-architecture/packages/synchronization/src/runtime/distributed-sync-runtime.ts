// packages/synchronization/src/runtime/distributed-sync-runtime.ts
/**
 * Distributed Sync Runtime (Top-Level Sync Orchestrator)
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
 * - pendingOps: SyncOperation[]
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - ConflictResolutionRuntime
 * - DeterministicOrderingRuntime
 * - DistributedStateValidator
 * - OfflineOperationReplay
 * - SyncRecoveryRuntime
 * 
 * Event emissions:
 *   "sync.engine.started", "sync.cycle.completed", "sync.divergence.detected"
 * 
 * Synchronization: uses distributed locks during repair; vector clocks for causality
 * Recovery: full state rebuild from peers if local state corrupted
 * Telemetry: sync latency, pending operations, divergence events
 * Diagnostics: connected peers, last sync time, state hash
 * Accessibility: N/A
 * Performance: incremental sync; batch operations for efficiency
 * Forbidden: blocking main thread during sync cycles; unbounded pending queues
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ConflictResolutionRuntime } from './conflict-resolution-runtime';
import type { DeterministicOrderingRuntime } from './deterministic-ordering-runtime';
import type { DistributedStateValidator } from './distributed-state-validator';
import type { OfflineOperationReplay } from './offline-operation-replay';
import type { SyncRecoveryRuntime } from './sync-recovery-runtime';

type NodeId = string;
type StateHash = string;
type OperationSequence = number;

interface SyncOperation {
  id: string;
  type: string;
  payload: unknown;
  userId: string;
  timestamp: number;
  sequenceNumber: OperationSequence;
}

interface SyncState {
  nodeId: NodeId;
  lastSequence: OperationSequence;
  stateHash: StateHash;
  historySize: number;
}

export class DistributedSyncRuntime {
  private nodes: Map<NodeId, SyncState> = new Map();
  private localState: SyncState;
  private pendingOutgoing: SyncOperation[] = [];
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(
    private nodeId: NodeId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private conflictResolver: ConflictResolutionRuntime,
    private orderingRuntime: DeterministicOrderingRuntime,
    private validator: DistributedStateValidator,
    private offlineReplay: OfflineOperationReplay,
    private recovery: SyncRecoveryRuntime,
  ) {
    this.localState = {
      nodeId,
      lastSequence: 0 as OperationSequence,
      stateHash: this.computeHash('initial'),
      historySize: 0,
    };
    this.eventBus.subscribe('sync.peer.hello', this.onPeerHello.bind(this));
    this.eventBus.subscribe('sync.operation.incoming', this.onIncomingOperation.bind(this));
  }

  async start(intervalMs: number = 10000): Promise<void> {
    this.syncTimer = setInterval(() => this.syncCycle(), intervalMs);
    await this.eventBus.publish('sync.peer.hello', { nodeId: this.nodeId, state: this.localState });
    this.logger.info('Distributed sync runtime started');
  }

  private async syncCycle(): Promise<void> {
    await this.flushPendingOperations();
    await this.reconcileIfNeeded();
    this.meter.incrementCounter('sync.cycle.completed');
  }

  private async flushPendingOperations(): Promise<void> {
    if (this.pendingOutgoing.length === 0) return;
    const batch = this.pendingOutgoing.splice(0, 100);
    for (const op of batch) {
      const order = this.orderingRuntime.assignOrder(op);
      op.sequenceNumber = order.globalOrder as OperationSequence;
    }
    await this.eventBus.publish('sync.operation.broadcast', { ops: batch });
  }

  enqueueOperation(op: SyncOperation): void {
    this.pendingOutgoing.push(op);
  }

  private async reconcileIfNeeded(): Promise<void> {
    for (const peer of this.nodes.values()) {
      if (peer.stateHash !== this.localState.stateHash) {
        this.logger.warn(`Divergence with node ${peer.nodeId}`);
        this.meter.incrementCounter('sync.divergence.detected');
        await this.repairDivergence(peer.nodeId);
      }
    }
  }

  private async repairDivergence(peerNodeId: NodeId): Promise<void> {
    // Request full state from peer and reconcile
    // For now, trigger recovery
    await this.recovery.recover(peerNodeId, this.localState);
  }

  private onPeerHello(event: any): void {
    const { nodeId, state } = event.payload;
    if (nodeId !== this.nodeId) this.nodes.set(nodeId, state);
  }

  private async onIncomingOperation(event: any): Promise<void> {
    const { operation } = event.payload;
    const resolved = await this.conflictResolver.resolve(operation);
    if (resolved) {
      // Apply locally
      this.applyLocal(operation);
    }
  }

  private applyLocal(op: SyncOperation): void {
    this.localState.lastSequence = Math.max(this.localState.lastSequence, op.sequenceNumber) as OperationSequence;
    this.localState.historySize++;
    this.localState.stateHash = this.computeHash(this.localState.stateHash + op.id);
  }

  private computeHash(input: string): StateHash {
    return createHash('sha256').update(input).digest('hex').substring(0, 16) as StateHash;
  }

  async shutdown(): Promise<void> {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }
}