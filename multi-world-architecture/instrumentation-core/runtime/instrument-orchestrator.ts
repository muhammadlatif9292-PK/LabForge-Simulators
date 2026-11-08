// instrumentation-core/runtime/instrument-orchestrator.ts
/**
 * Instrument Orchestrator
 * 
 * Responsibilities:
 * - Manage all active instrument instances across worlds
 * - Route user interactions to the correct instrument instance
 * - Coordinate instrument creation, calibration scheduling, and disposal
 * - Enforce per-user and per-world instrument limits
 * - Provide global instrument telemetry aggregation
 * 
 * Owned state:
 * - instruments: Map<InstrumentId, InstrumentRuntime>
 * - userInstrumentIndex: Map<string, Set<InstrumentId>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - InstrumentRenderer (shared factory)
 * - InstrumentSimulation (shared)
 * - InstrumentSync (shared)
 * - InstrumentRecovery (shared)
 * 
 * Event emissions:
 * - "instrument.orchestrator.created"
 * - "instrument.orchestrator.disposed"
 * 
 * Event subscriptions:
 * - "instrument.interaction" (from input system)
 * - "world.shutdown" (to dispose instruments)
 * 
 * Synchronization: ensures only one runtime per instrument ID
 * Recovery: re-instantiate instruments after crash from descriptor registry
 * Telemetry: total instrument count, active measurements
 * Diagnostics: instrument health summary
 * Accessibility: N/A
 * Performance: O(1) lookup; interactions dispatched async
 * Forbidden: leaking instrument instances; double registration
 */

import type { InstrumentId, InstrumentDescriptor, InstrumentInteraction } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { InstrumentRuntime } from './instrument-runtime';
import type { InstrumentRenderer } from './instrument-renderer';
import type { InstrumentSimulation } from './instrument-simulation';
import type { InstrumentSync } from './instrument-sync';
import type { InstrumentRecovery } from './instrument-recovery';

export class InstrumentOrchestrator {
  private instruments: Map<InstrumentId, InstrumentRuntime> = new Map();
  private userInstruments: Map<string, Set<InstrumentId>> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private rendererFactory: InstrumentRenderer,
    private simulation: InstrumentSimulation,
    private sync: InstrumentSync,
    private recovery: InstrumentRecovery,
  ) {
    this.eventBus.subscribe('instrument.interaction', this.onInteraction.bind(this));
  }

  async createInstrument(runtime: InstrumentRuntime, userId: string): Promise<void> {
    if (this.instruments.has(runtime.descriptor.id)) {
      throw new Error(`Instrument ${runtime.descriptor.id} already exists`);
    }
    await runtime.bootstrap();
    this.instruments.set(runtime.descriptor.id, runtime);
    if (!this.userInstruments.has(userId)) this.userInstruments.set(userId, new Set());
    this.userInstruments.get(userId)!.add(runtime.descriptor.id);
    this.eventBus.publish('instrument.orchestrator.created', { instrumentId: runtime.descriptor.id, userId });
    this.meter.setGauge('instrument.count', this.instruments.size);
  }

  async disposeInstrument(instrumentId: InstrumentId, userId: string): Promise<void> {
    const runtime = this.instruments.get(instrumentId);
    if (!runtime) return;
    await runtime.shutdown();
    this.instruments.delete(instrumentId);
    this.userInstruments.get(userId)?.delete(instrumentId);
    this.eventBus.publish('instrument.orchestrator.disposed', { instrumentId, userId });
    this.meter.setGauge('instrument.count', this.instruments.size);
  }

  async disposeAllForUser(userId: string): Promise<void> {
    const ids = this.userInstruments.get(userId);
    if (!ids) return;
    for (const id of ids) {
      await this.disposeInstrument(id, userId);
    }
    this.userInstruments.delete(userId);
  }

  getInstrument(instrumentId: InstrumentId): InstrumentRuntime | undefined {
    return this.instruments.get(instrumentId);
  }

  private async onInteraction(event: any): Promise<void> {
    const interaction: InstrumentInteraction = event.payload;
    const runtime = this.instruments.get(interaction.instrumentId);
    if (!runtime) {
      this.logger.warn(`Interaction for unknown instrument: ${interaction.instrumentId}`);
      return;
    }
    await runtime.handleInteraction(interaction);
  }

  shutdownAll(): void {
    for (const [id, runtime] of this.instruments) {
      runtime.shutdown().catch(err => this.logger.error(`Shutdown failed for ${id}`, err));
    }
    this.instruments.clear();
    this.userInstruments.clear();
  }
}