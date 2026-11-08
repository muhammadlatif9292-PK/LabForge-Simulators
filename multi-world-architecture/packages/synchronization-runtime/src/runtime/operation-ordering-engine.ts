// packages/synchronization-runtime/src/runtime/operation-ordering-engine.ts
/**
 * Operation Ordering Engine
 * 
 * Responsibilities:
 * - Establish a global total order for all operations in the distributed system
 * - Maintain vector clocks per node for causal ordering
 * - Assign Lamport timestamps or hybrid logical clocks
 * - Detect and report causal violations
 * - Support partial ordering for operations that commute
 * 
 * Owned state:
 * - vectorClock: VectorClock
 * - lamportClock: number
 * - operationOrders: Map<string, OperationOrder> (recent)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - NodeId assignment (from DistributedSyncEngine)
 * 
 * Event emissions:
 * - "sync.ordering.violation" when causal order broken
 * 
 * Event subscriptions: none
 * Synchronization: vector clocks enable causally consistent ordering
 * Recovery: clock state persisted; restored on restart with increment
 * Telemetry: ordering latency, violation count
 * Diagnostics: current vector clock state, recent orders
 * Accessibility: N/A
 * Performance: O(1) per operation; vector clock size is O(nodes)
 * Forbidden: violating causal ordering (happens-before); using wall clock alone
 */

import { v4 as uuidv4 } from 'uuid';
import type { NodeId, OperationOrder, VectorClock, SyncOperation } from '../contracts/sync-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class OperationOrderingEngine {
  private vectorClock: VectorClock = { clock: {} };
  private lamportClock = 0;
  private recentOrders: Map<string, OperationOrder> = new Map();
  private maxRecent = 10_000;

  constructor(
    private nodeId: NodeId,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.vectorClock.clock[this.nodeId] = 0;
  }

  async assignOrder(operation: SyncOperation, causalDependencies?: string[]): Promise<OperationOrder> {
    // Increment Lamport clock
    this.lamportClock++;
    // Increment this node's entry in vector clock
    const currentEntry = this.vectorClock.clock[this.nodeId] ?? 0;
    this.vectorClock.clock[this.nodeId] = currentEntry + 1;

    const order: OperationOrder = {
      operationId: operation.id,
      globalOrder: this.lamportClock,
      causalDependencies: causalDependencies ?? [],
      timestamp: Date.now(),
      vectorClock: { ...this.vectorClock.clock },
    };
    this.recentOrders.set(operation.id, order);
    this.evictIfNeeded();
    this.meter.incrementCounter('sync.ordering.assigned');
    return order;
  }

  async mergeRemoteClock(remoteClock: Record<string, number>): Promise<void> {
    for (const [nodeId, count] of Object.entries(remoteClock)) {
      const local = this.vectorClock.clock[nodeId] ?? 0;
      this.vectorClock.clock[nodeId] = Math.max(local, count);
    }
    // Update Lamport to max of all known
    const maxKnown = Math.max(...Object.values(this.vectorClock.clock));
    this.lamportClock = Math.max(this.lamportClock, maxKnown);
  }

  checkCausalOrder(operation: SyncOperation, order: OperationOrder): boolean {
    // Verify that all causal dependencies have been applied
    for (const depId of order.causalDependencies) {
      if (!this.recentOrders.has(depId)) {
        this.meter.incrementCounter('sync.ordering.causal_violation');
        this.logger.warn(`Causal ordering violation: missing dependency ${depId} for operation ${operation.id}`);
        return false;
      }
    }
    return true;
  }

  getCurrentVectorClock(): VectorClock {
    return { clock: { ...this.vectorClock.clock } };
  }

  getGlobalOrder(operationId: string): number | null {
    const order = this.recentOrders.get(operationId);
    return order?.globalOrder ?? null;
  }

  private evictIfNeeded(): void {
    if (this.recentOrders.size > this.maxRecent) {
      const iterator = this.recentOrders.keys();
      const firstKey = iterator.next().value;
      if (firstKey) this.recentOrders.delete(firstKey);
    }
  }
}