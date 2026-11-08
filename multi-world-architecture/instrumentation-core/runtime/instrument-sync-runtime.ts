// instrumentation-core/runtime/instrument-sync-runtime.ts
/**
 * Instrument Sync Runtime
 * 
 * Responsibilities:
 * - Synchronize instrument state across collaboration participants
 * - Broadcast instrument interactions and state updates in real-time
 * - Apply conflict resolution for simultaneous instrument manipulation
 * - Queue offline interactions for replay on reconnect
 * - Support ownership model: only one participant can actively manipulate at a time
 * 
 * Owned state:
 * - ownershipMap: Map<InstrumentId, { ownerId: string; acquiredAt: number }>
 * - pendingOfflineOps: InstrumentInteraction[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - SynchronizationRuntime (for conflict resolution)
 * - ConflictResolutionEngine
 * 
 * Event emissions:
 *   "instrument.sync.ownership.acquired", "instrument.sync.ownership.released"
 *   "instrument.sync.remote_interaction"
 * 
 * Event subscriptions:
 *   "instrument.interaction" (from local user)
 *   "instrument.sync.remote_interaction" (from peers)
 * 
 * Synchronization: real-time broadcast; offline queue
 * Recovery: ownership released on disconnect; offline queue replayed
 * Telemetry: sync latency, conflict count, ownership transfers
 * Diagnostics: current ownership, pending operations
 * Accessibility: N/A
 * Performance: lightweight broadcast; no full state sync every frame
 * Forbidden: allowing simultaneous exclusive manipulation without conflict
 */

import type { InstrumentId, InstrumentInteraction } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface OwnershipRecord {
  ownerId: string;
  acquiredAt: number;
  timeoutMs: number;
}

export class InstrumentSyncRuntime {
  private ownership: Map<InstrumentId, OwnershipRecord> = new Map();
  private pendingOffline: InstrumentInteraction[] = [];
  private offlinesEnabled = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {
    this.eventBus.subscribe('instrument.interaction', this.onLocalInteraction.bind(this));
    this.eventBus.subscribe('instrument.sync.remote_interaction', this.onRemoteInteraction.bind(this));
    this.eventBus.subscribe('connection.offline', () => { this.offlinesEnabled = true; });
    this.eventBus.subscribe('connection.online', () => this.flushOfflineQueue());
  }

  private async onLocalInteraction(event: any): Promise<void> {
    const interaction: InstrumentInteraction = event.payload;
    if (this.offlinesEnabled) {
      this.pendingOffline.push(interaction);
      this.meter.setGauge('instrument.sync.offline_queue', this.pendingOffline.length);
      return;
    }
    // Check ownership for grab interactions
    if (interaction.type === 'grab') {
      const currentOwner = this.ownership.get(interaction.instrumentId);
      if (currentOwner && currentOwner.ownerId !== interaction.userId) {
        // Conflict: someone else is holding it
        this.logger.warn(`Instrument ${interaction.instrumentId} already held by ${currentOwner.ownerId}`);
        return;
      }
      this.ownership.set(interaction.instrumentId, {
        ownerId: interaction.userId,
        acquiredAt: Date.now(),
        timeoutMs: 30000,
      });
      this.eventBus.publish('instrument.sync.ownership.acquired', {
        instrumentId: interaction.instrumentId,
        ownerId: interaction.userId,
      });
    }
    if (interaction.type === 'release') {
      this.ownership.delete(interaction.instrumentId);
      this.eventBus.publish('instrument.sync.ownership.released', {
        instrumentId: interaction.instrumentId,
        ownerId: interaction.userId,
      });
    }
    // Broadcast to peers
    await this.eventBus.publish('instrument.sync.remote_interaction', interaction);
  }

  private onRemoteInteraction(event: any): void {
    const interaction: InstrumentInteraction = event.payload;
    // Apply remote interaction locally (instrument orchestrator handles this)
    // This is just for tracking purposes; the actual application is done by the orchestrator
    this.meter.incrementCounter('instrument.sync.remote_received');
  }

  private async flushOfflineQueue(): Promise<void> {
    if (this.pendingOffline.length === 0) return;
    this.offlinesEnabled = false;
    const ops = this.pendingOffline.splice(0);
    this.logger.info(`Flushing ${ops.length} offline instrument interactions`);
    for (const interaction of ops) {
      await this.eventBus.publish('instrument.interaction', interaction);
    }
    this.meter.setGauge('instrument.sync.offline_queue', 0);
  }

  isOwned(instrumentId: InstrumentId): boolean {
    const record = this.ownership.get(instrumentId);
    if (!record) return false;
    if (Date.now() - record.acquiredAt > record.timeoutMs) {
      this.ownership.delete(instrumentId);
      return false;
    }
    return true;
  }

  getOwner(instrumentId: InstrumentId): string | null {
    return this.ownership.get(instrumentId)?.ownerId ?? null;
  }

  releaseAllForUser(userId: string): void {
    for (const [id, record] of this.ownership) {
      if (record.ownerId === userId) {
        this.ownership.delete(id);
      }
    }
  }
}