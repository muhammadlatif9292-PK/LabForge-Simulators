// instrumentation-core/balance/balance-runtime.ts
/**
 * Balance Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a precision analytical balance
 * - Measure mass with configurable precision (decimal places)
 * - Support tare functionality and stability detection
 * - Couple with physics simulation for weight calculation (mass = weight / g)
 * - Emit stable readings for scientific measurement
 * 
 * Owned state:
 * - reading: BalanceReading
 * - panEntityId: string | null (entity placed on balance)
 * - stableReadings: number (consecutive stable readings)
 * 
 * Dependencies:
 * - Instrument base class
 * - PhysicsSimulationRuntime (weight from gravity)
 * - UnitConversionEngine (grams ↔ other mass units)
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { BalanceReading } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class BalanceRuntime extends InstrumentRuntime {
  private reading: BalanceReading = {
    mass: 0,
    tare: 0,
    precision: 4,
    stable: false,
  };
  private panEntityId: string | null = null;
  private stableCount = 0;
  private readonly STABLE_THRESHOLD = 5; // consecutive stable readings

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.BALANCE; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.precision === 'number') {
      this.reading.precision = Math.max(0, Math.min(6, config.precision));
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    // Use reference mass to calibrate
    const scale = reference / Math.max(0.001, this.reading.mass - this.reading.tare);
    return { offset: 0, scale };
  }

  placeEntity(entityId: string): void {
    this.panEntityId = entityId;
  }

  removeEntity(): void {
    this.panEntityId = null;
    this.reading.mass = 0;
    this.reading.stable = false;
    this.stableCount = 0;
    this.emitReading();
  }

  tare(): void {
    this.reading.tare = this.reading.mass;
    this.reading.mass = 0;
    this.emitReading();
    this.logger.info(`Balance tared at ${this.reading.tare.toFixed(this.reading.precision)} g`);
  }

  zero(): void {
    this.reading.tare = 0;
    this.reading.mass = 0;
    this.stableCount = 0;
    this.emitReading();
  }

  updateWeight(rawMass: number): void {
    const correctedMass = rawMass - this.reading.tare;
    const prevMass = this.reading.mass;
    this.reading.mass = parseFloat(correctedMass.toFixed(this.reading.precision));

    // Stability detection: if reading hasn't changed beyond tolerance
    const tolerance = Math.pow(10, -this.reading.precision);
    if (Math.abs(this.reading.mass - prevMass) < tolerance) {
      this.stableCount++;
      if (this.stableCount >= this.STABLE_THRESHOLD && !this.reading.stable) {
        this.reading.stable = true;
        this.logger.info(`Balance reading stable: ${this.reading.mass.toFixed(this.reading.precision)} g`);
      }
    } else {
      this.stableCount = 0;
      this.reading.stable = false;
    }
    this.emitReading();
  }

  private emitReading(): void {
    this.eventBus.publish('instrument.measurement.recorded', {
      instrumentId: this.descriptor.id,
      value: this.reading.mass,
      unit: 'gram',
      metadata: { stable: this.reading.stable, tare: this.reading.tare },
      timestamp: Date.now(),
    });
  }

  getReading(): Readonly<BalanceReading> {
    return { ...this.reading };
  }

  isStable(): boolean {
    return this.reading.stable;
  }
}