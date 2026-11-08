// instrumentation-core/ammeter/ammeter-runtime.ts
/**
 * Ammeter Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate an ammeter measuring electric current in a circuit branch
 * - Support AC and DC current modes with auto-ranging
 * - Couple with the electronics simulation for branch current values
 * - Display measured current with uncertainty
 * 
 * Owned state:
 * - currentReading: { value: number; unit: string; mode: 'ac' | 'dc' }
 * - connectedToBranch: string | null
 * 
 * Dependencies:
 * - Instrument base class
 * - ElectronicsSimulationRuntime (circuit solver)
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class AmmeterRuntime extends InstrumentRuntime {
  private currentReading: { value: number; unit: string; mode: 'ac' | 'dc' } = { value: 0, unit: 'A', mode: 'dc' };
  private connectedToBranch: string | null = null;

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.AMMETER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.mode === 'string') {
      this.currentReading.mode = config.mode as 'ac' | 'dc';
    }
    if (typeof config.branchId === 'string') {
      this.connectedToBranch = config.branchId;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    return { offset: 0, scale: reference / Math.max(0.001, this.currentReading.value) };
  }

  updateReading(currentAmps: number): void {
    this.currentReading.value = currentAmps;
    this.eventBus.publish('instrument.measurement.recorded', {
      instrumentId: this.descriptor.id,
      value: currentAmps,
      unit: 'A',
      timestamp: Date.now(),
    });
  }

  connectToBranch(branchId: string): void {
    this.connectedToBranch = branchId;
  }

  disconnect(): void {
    this.connectedToBranch = null;
    this.currentReading.value = 0;
  }

  getReading(): { value: number; unit: string; mode: string } {
    return { ...this.currentReading };
  }
}