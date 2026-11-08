// instrumentation-core/voltmeter/voltmeter-runtime.ts
/**
 * Voltmeter Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a voltmeter measuring voltage between two circuit nodes
 * - Support AC and DC voltage modes with auto-ranging
 * - Couple with the electronics simulation for node voltage values
 * - Display measured voltage with uncertainty
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class VoltmeterRuntime extends InstrumentRuntime {
  private currentReading: { value: number; unit: string; mode: 'ac' | 'dc' } = { value: 0, unit: 'V', mode: 'dc' };
  private connectedNodes: { positive: string | null; negative: string | null } = { positive: null, negative: null };

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.VOLTMETER; }

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
    if (typeof config.positiveNode === 'string') {
      this.connectedNodes.positive = config.positiveNode;
    }
    if (typeof config.negativeNode === 'string') {
      this.connectedNodes.negative = config.negativeNode;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    return { offset: 0, scale: reference / Math.max(0.001, this.currentReading.value) };
  }

  updateReading(voltage: number): void {
    this.currentReading.value = voltage;
    this.eventBus.publish('instrument.measurement.recorded', {
      instrumentId: this.descriptor.id,
      value: voltage,
      unit: 'V',
      timestamp: Date.now(),
    });
  }

  connectNodes(positiveNodeId: string, negativeNodeId: string): void {
    this.connectedNodes = { positive: positiveNodeId, negative: negativeNodeId };
  }

  disconnect(): void {
    this.connectedNodes = { positive: null, negative: null };
    this.currentReading.value = 0;
  }

  getReading(): { value: number; unit: string; mode: string } {
    return { ...this.currentReading };
  }
}