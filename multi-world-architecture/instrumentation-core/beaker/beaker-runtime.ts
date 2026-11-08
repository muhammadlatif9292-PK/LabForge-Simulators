// instrumentation-core/beaker/beaker-runtime.ts
/**
 * Beaker Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a chemistry beaker with contents (substances, volume, temperature)
 * - Handle interactions: add/remove substance, heat, stir, pour
 * - Couple with the chemistry simulation to react contents
 * - Emit beaker state changes for rendering and AI tutor
 * - Persist beaker state for offline recovery
 * 
 * Owned state:
 * - contents: BeakerContents
 * - isHeating: boolean
 * - heatSourceTemperature: number
 * - stirring: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - InstrumentRenderer (beaker visual)
 * - InstrumentSimulation (chemistry coupling)
 * - ChemistryODESolver (for contents reaction)
 * - CalibrationRuntime
 * - InstrumentRecovery
 * 
 * Event emissions:
 *   "beaker.contents.changed", "beaker.heating.started", "beaker.heating.stopped"
 *   "beaker.reaction.observed"
 * 
 * Event subscriptions:
 *   "chemistry.substance.added" (from simulation)
 * 
 * Synchronization: single-threaded; interactions serialized
 * Recovery: contents state persisted; restored on reconnect
 * Telemetry: temperature history, substance count
 * Diagnostics: current contents snapshot
 * Accessibility: beaker contents described in structured data
 * Performance: lightweight numerical integration for heating
 * Forbidden: simulating reactions without proper stoichiometry
 */

import { v4 as uuidv4 } from 'uuid';
import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { BeakerContents } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class BeakerRuntime extends InstrumentRuntime {
  private contents: BeakerContents = {
    substances: [],
    totalVolume: 0.5, // L
    pH: 7,
  };
  private isHeating = false;
  private heatSourceTemperature = 298; // K (room temp)
  private stirring = false;

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any,
    simulation: any,
    sync: any,
    recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.BEAKER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
    this.logger.info('Beaker activated');
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
    this.logger.info('Beaker deactivated');
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.heat === 'boolean') {
      if (config.heat) this.startHeating(config.heatTemperature as number ?? 373);
      else this.stopHeating();
    }
    if (typeof config.stir === 'boolean') {
      this.stirring = config.stir;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    return { offset: 0, scale: 1 };
  }

  // --- Beaker-specific methods ---

  addSubstance(substanceId: string, name: string, amountMoles: number, temperature?: number): void {
    const existing = this.contents.substances.find(s => s.substanceId === substanceId);
    if (existing) {
      existing.amount += amountMoles;
      existing.temperature = (existing.temperature + (temperature ?? 298)) / 2; // simple mixing temp
    } else {
      this.contents.substances.push({
        substanceId,
        name,
        amount: amountMoles,
        concentration: amountMoles / this.contents.totalVolume,
        temperature: temperature ?? 298,
      });
    }
    this.recalculateConcentrations();
    this.emitContentsChanged('substance_added');
  }

  removeSubstance(substanceId: string, amountMoles: number): void {
    const idx = this.contents.substances.findIndex(s => s.substanceId === substanceId);
    if (idx < 0) return;
    this.contents.substances[idx].amount -= amountMoles;
    if (this.contents.substances[idx].amount <= 0) {
      this.contents.substances.splice(idx, 1);
    }
    this.recalculateConcentrations();
    this.emitContentsChanged('substance_removed');
  }

  startHeating(targetTemperature: number = 373): void {
    this.isHeating = true;
    this.heatSourceTemperature = targetTemperature;
    this.eventBus.publish('beaker.heating.started', { instrumentId: this.descriptor.id, targetTemperature });
  }

  stopHeating(): void {
    this.isHeating = false;
    this.eventBus.publish('beaker.heating.stopped', { instrumentId: this.descriptor.id });
  }

  getContents(): BeakerContents {
    return { ...this.contents, substances: this.contents.substances.map(s => ({ ...s })) };
  }

  private recalculateConcentrations(): void {
    const volume = Math.max(0.001, this.contents.totalVolume);
    for (const sub of this.contents.substances) {
      sub.concentration = sub.amount / volume;
    }
  }

  private emitContentsChanged(reason: string): void {
    this.eventBus.publish('beaker.contents.changed', {
      instrumentId: this.descriptor.id,
      reason,
      contents: this.getContents(),
    });
  }
}