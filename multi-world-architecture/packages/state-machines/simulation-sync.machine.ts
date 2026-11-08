// packages/state-machines/simulation-sync.machine.ts
/**
 * Simulation Sync State Machine
 * 
 * Responsibilities:
 * - Formalise the distributed simulation synchronisation lifecycle
 * - States: local → syncing → synced → diverged → reconciling → synced
 * - Detect state divergence and trigger reconciliation automatically
 * - Coordinate with the sync recovery runtime for rollback
 * 
 * Owned state: currentState, lastSyncTick
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum SyncState {
  LOCAL = 'local',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  DIVERGED = 'diverged',
  RECONCILING = 'reconciling',
  DEGRADED = 'degraded',
}

export enum SyncEvent {
  PEER_DISCOVERED = 'peer_discovered',
  SYNC_COMPLETE = 'sync_complete',
  HASH_MISMATCH = 'hash_mismatch',
  RECONCILIATION_COMPLETE = 'reconciliation_complete',
  PEER_LOST = 'peer_lost',
  SYNC_TIMEOUT = 'sync_timeout',
  RECOVERY_COMPLETE = 'recovery_complete',
}

export class SimulationSyncMachine {
  private state: SyncState = SyncState.LOCAL;
  private lastSyncTick = 0;

  private static readonly TRANSITIONS: Array<{ from: SyncState; to: SyncState; event: SyncEvent }> = [
    { from: SyncState.LOCAL, to: SyncState.SYNCING, event: SyncEvent.PEER_DISCOVERED },
    { from: SyncState.SYNCING, to: SyncState.SYNCED, event: SyncEvent.SYNC_COMPLETE },
    { from: SyncState.SYNCED, to: SyncState.DIVERGED, event: SyncEvent.HASH_MISMATCH },
    { from: SyncState.DIVERGED, to: SyncState.RECONCILING, event: SyncEvent.PEER_DISCOVERED },
    { from: SyncState.RECONCILING, to: SyncState.SYNCED, event: SyncEvent.RECONCILIATION_COMPLETE },
    { from: SyncState.SYNCED, to: SyncState.DEGRADED, event: SyncEvent.PEER_LOST },
    { from: SyncState.DEGRADED, to: SyncState.SYNCING, event: SyncEvent.PEER_DISCOVERED },
    { from: SyncState.SYNCING, to: SyncState.DEGRADED, event: SyncEvent.SYNC_TIMEOUT },
    { from: SyncState.RECONCILING, to: SyncState.SYNCED, event: SyncEvent.RECOVERY_COMPLETE },
  ];

  constructor(
    private simulationId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): SyncState { return this.state; }

  async send(event: SyncEvent): Promise<boolean> {
    const transition = SimulationSyncMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`Sync transition rejected: ${this.state} + ${event}`, { simulationId: this.simulationId });
      return false;
    }
    const oldState = this.state;
    this.state = transition.to;
    this.meter.incrementCounter('simulation.sync.state.changed', { from: oldState, to: this.state });
    this.logger.info(`Simulation sync: ${oldState} → ${this.state} (${event})`, { simulationId: this.simulationId });
    await this.eventBus.publish('simulation.sync.state.changed', {
      simulationId: this.simulationId,
      from: oldState,
      to: this.state,
      event,
    });
    return true;
  }

  isInSync(): boolean { return this.state === SyncState.SYNCED; }
}