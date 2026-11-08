// instrumentation-core/thermometer/thermometer-runtime.ts
/**
 * Thermometer Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a digital thermometer with configurable unit (Celsius, Kelvin, Fahrenheit)
 * - Measure temperature via probe placement in a substance or environment
 * - Track temperature history for trend analysis
 * - Support calibration with ice point and boiling point references
 * 
 * Owned state:
 * - currentTemperature: number (Kelvin internally)
 * - displayUnit: 'celsius' | 'kelvin' | 'fahrenheit'
 * - probeInserted: boolean
 * - temperatureHistory: Array<{ temp: number; timestamp: number }>
 * 
 * Dependencies:
 * - Instrument base class
 * - ChemistrySimulationRuntime (substance temperature)
 * - UnitConversionEngine (temperature unit conversion)
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class ThermometerRuntime extends InstrumentRuntime {
  private currentTemperature = 298.15; // Kelvin (25°C)
  private displayUnit: 'celsius' | 'kelvin' | 'fahrenheit' = 'celsius';
  private probeInserted = false;
  private temperatureHistory: Array<{ temp: number; timestamp: number }> = [];
  private readonly MAX_HISTORY = 600; // 10 minutes at 1 sample/sec

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.THERMOMETER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.unit === 'string') {
      this.setDisplayUnit(config.unit as 'celsius' | 'kelvin' | 'fahrenheit');
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    // Ice-point (273.15K) or boiling-point (373.15K at 1 atm) calibration
    const offset = reference - this.currentTemperature;
    return { offset, scale: 1 };
  }

  setDisplayUnit(unit: 'celsius' | 'kelvin' | 'fahrenheit'): void {
    this.displayUnit = unit;
  }

  insertProbe(): void {
    this.probeInserted = true;
    this.logger.info('Thermometer probe inserted');
  }

  removeProbe(): void {
    this.probeInserted = false;
  }

  updateTemperature(kelvin: number): void {
    this.currentTemperature = kelvin;
    // Apply calibration if available
    if (this.isCalibrated()) {
      const cal = this.getCalibration()!;
      this.currentTemperature = kelvin * cal.scale + cal.offset;
    }
    // Record history
    this.temperatureHistory.push({ temp: this.currentTemperature, timestamp: Date.now() });
    if (this.temperatureHistory.length > this.MAX_HISTORY) {
      this.temperatureHistory.shift();
    }
    // Emit measurement
    this.eventBus.publish('instrument.measurement.recorded', {
      instrumentId: this.descriptor.id,
      value: this.getDisplayTemperature(),
      unit: this.displayUnit === 'kelvin' ? 'K' : this.displayUnit === 'celsius' ? '°C' : '°F',
      timestamp: Date.now(),
    });
  }

  getDisplayTemperature(): number {
    switch (this.displayUnit) {
      case 'celsius':
        return parseFloat((this.currentTemperature - 273.15).toFixed(2));
      case 'fahrenheit':
        return parseFloat(((this.currentTemperature - 273.15) * 9 / 5 + 32).toFixed(2));
      case 'kelvin':
      default:
        return parseFloat(this.currentTemperature.toFixed(2));
    }
  }

  getTemperatureKelvin(): number {
    return this.currentTemperature;
  }

  getTemperatureHistory(): Array<{ temp: number; timestamp: number }> {
    return [...this.temperatureHistory];
  }

  getTemperatureTrend(): 'rising' | 'falling' | 'stable' {
    if (this.temperatureHistory.length < 5) return 'stable';
    const recent = this.temperatureHistory.slice(-5);
    const first = recent[0].temp;
    const last = recent[recent.length - 1].temp;
    if (last - first > 0.1) return 'rising';
    if (first - last > 0.1) return 'falling';
    return 'stable';
  }

  isProbeInserted(): boolean {
    return this.probeInserted;
  }
}