// instrumentation-core/runtime/instrument-sync.ts
/**
 * Instrument Sync
 * 
 * Responsibilities:
 * - Synchronize instrument interactions across multiple users in real time
 * - Apply conflict resolution for simultaneous instrument manipulations
 * - Broadcast measurements and state changes to collaborators
 * - Support offline operation queue for instrument interactions
 * 
 * Owned state:
 * - pendingOps: InstrumentInteraction[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (for real-time broadcast)
 * - SynchronizationRuntime (for conflict resolution)
 * 
 * Event emissions: "instrument.sync.broadcast"
 * Event subscriptions: "instrument.interaction.remote"
 * Synchronization: last-writer-wins for instrument configuration;
 *                 operational transform for simultaneous manipulation
 * Recovery: pending operations replayed on reconnect
 * Telemetry: sync latency, conflict count
 * Diagnostics: pending queue depth
 * Accessibility: N/A
 * Performance: lightweight messages; batching under high frequency
 * Forbidden: losing interactions during network interruption
 */

import type { InstrumentInteraction } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class InstrumentSync {
  private pendingOps: InstrumentInteraction[] = [];

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('instrument.interaction.remote', this.onRemoteInteraction.bind(this));
  }

  async broadcastInteraction(interaction: InstrumentInteraction): Promise<void> {
    await this.eventBus.publish('instrument.interaction.remote', interaction);
    this.meter.incrementCounter('instrument.sync.broadcast');
  }

  private async onRemoteInteraction(event: any): Promise<void> {
    // Apply remote interaction locally (handled by orchestrator)
    const interaction: InstrumentInteraction = event.payload;
    this.logger.debug(`Remote instrument interaction: ${interaction.type} on ${interaction.instrumentId}`);
  }

  enqueueOffline(interaction: InstrumentInteraction): void {
    this.pendingOps.push(interaction);
    this.meter.setGauge('instrument.sync.pending', this.pendingOps.length);
  }

  flushPending(): InstrumentInteraction[] {
    const ops = this.pendingOps.splice(0);
    this.meter.setGauge('instrument.sync.pending', 0);
    return ops;
  }
}