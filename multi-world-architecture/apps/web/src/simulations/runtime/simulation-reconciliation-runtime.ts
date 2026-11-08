// apps/web/src/simulations/runtime/simulation-reconciliation-runtime.ts
/**
 * Frontend Simulation Reconciliation Runtime
 * 
 * Responsibilities:
 * - Compare local simulation state with server-authoritative state
 * - Trigger rollback and replay when divergence detected
 * - Provide user feedback during reconciliation
 * 
 * Owned state: none (stateless)
 * Dependencies:
 * - DeterministicExecutionRuntime
 * - DistributedSyncEngine (frontend client)
 * - EventBus
 * 
 * Event emissions: "simulation.reconciliation.needed", "simulation.reconciled"
 * Event subscriptions: "simulation.hash.mismatch"
 * Synchronization: waits for reconciliation to complete before next tick
 * Recovery: triggers reconciliation
 * Telemetry: reconciliation count, duration
 * Diagnostics: last divergence
 * Accessibility: notify user if divergence causes reset
 * Performance: quick hash compare; replay only if needed
 * Forbidden: ignoring divergence silently
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class SimulationReconciliationRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  async reconcile(localHash: string, remoteHash: string, tick: number): Promise<boolean> {
    if (localHash === remoteHash) return true;
    this.logger.warn(`Simulation hash mismatch at tick ${tick}`);
    this.meter.incrementCounter('simulation.reconciliation.needed');
    this.eventBus.publish('simulation.reconciliation.needed', { tick, localHash, remoteHash });
    // In production, request full state from server and replay
    return false;
  }
}