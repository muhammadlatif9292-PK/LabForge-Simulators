// instrumentation-core/multimeter/multimeter-runtime.ts
/**
 * Multimeter Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a digital multimeter measuring voltage, current, resistance, continuity
 * - Switch between measurement modes
 * - Apply auto-ranging or manual range selection
 * - Display measured value with uncertainty
 * - Emit measurements for logging and AI analysis
 * 
 * Owned state:
 * - currentReading: MultimeterReading | null
 * - mode: 'voltage_dc' | 'voltage_ac' | 'current_dc' | 'current_ac' | 'resistance' | 'continuity'
 * - manualRange: number | null
 * - holdActive: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Instrument base class
 * - ElectronicsSimulationRuntime (query circuit node voltages, branch currents)
 * - UnitConversionEngine
 * - ScientificMeasurementRuntime
 * 
 * Event emissions:
 *   "multimeter.mode.changed", "multimeter.reading.updated"
 *   "multimeter.continuity.detected"
 * 
 * Event subscriptions:
 *   "electronics.circuit.solved" (update reading)
 * 
 * Synchronization: readings updated per circuit solve
 * Recovery: last reading persisted
 * Telemetry: mode usage, reading frequency
 * Diagnostics: current mode, range
 * Accessibility: reading announced for screen readers
 * Performance: lightweight value extraction from simulation state
 * Forbidden: measuring across incompatible connections without warning
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { MultimeterReading } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class MultimeterRuntime extends InstrumentRuntime {
  private currentReading: MultimeterReading | null = null;
  private mode: MultimeterReading['mode'] = 'voltage_dc';
  private manualRange: number | null = null;
  private holdActive = false;

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.MULTIMETER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.mode === 'string') {
      this.setMode(config.mode as MultimeterReading['mode']);
    }
    if (typeof config.range === 'number') {
      this.manualRange = config.range;
    }
    if (typeof config.hold === 'boolean') {
      this.holdActive = config.hold;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    return { offset: 0, scale: 1 };
  }

  setMode(mode: MultimeterReading['mode']): void {
    this.mode = mode;
    this.eventBus.publish('multimeter.mode.changed', { instrumentId: this.descriptor.id, mode });
    // Auto-range reset on mode change
    this.manualRange = null;
  }

  updateReading(value: number, unit: string): void {
    if (this.holdActive) return;
    const reading: MultimeterReading = {
      mode: this.mode,
      value,
      unit,
      range: this.manualRange ?? this.autoRange(value),
    };
    this.currentReading = reading;
    this.eventBus.publish('multimeter.reading.updated', {
      instrumentId: this.descriptor.id,
      reading,
    });
  }

  detectContinuity(resistance: number): boolean {
    const isContinuous = resistance < 50; // ohms threshold
    if (isContinuous) {
      this.eventBus.publish('multimeter.continuity.detected', {
        instrumentId: this.descriptor.id,
        resistance,
      });
    }
    return isContinuous;
  }

  getCurrentReading(): MultimeterReading | null {
    return this.currentReading;
  }

  getMode(): string {
    return this.mode;
  }

  private autoRange(value: number): number {
    // Auto-range to nearest decade
    const absValue = Math.abs(value);
    if (absValue === 0) return 1;
    const exponent = Math.floor(Math.log10(absValue));
    return Math.pow(10, exponent + 1);
  }
}