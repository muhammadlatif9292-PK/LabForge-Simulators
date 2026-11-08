// instrumentation-core/runtime/instrument-runtime.ts
/**
 * Instrument Runtime (Base)
 * 
 * Responsibilities:
 * - Manage the lifecycle of a single scientific instrument instance
 * - Process user interactions and route to appropriate handlers
 * - Coordinate with simulation, rendering, and synchronization layers
 * - Enforce calibration schedules and measurement limits
 * - Emit measurement events for AI tutoring and analytics
 * 
 * Owned state:
 * - descriptor: InstrumentDescriptor
 * - state: InstrumentState
 * - measurements: InstrumentMeasurement[]
 * - calibration: InstrumentCalibration | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - InstrumentOrchestrator (parent)
 * - InstrumentRenderer (for visual updates)
 * - InstrumentSimulation (for physics/simulation coupling)
 * - InstrumentSync (for multiplayer collaboration)
 * - InstrumentRecovery (for crash recovery)
 * - InstrumentDiagnostics, InstrumentTelemetry
 * 
 * Event emissions:
 * - "instrument.state.changed"
 * - "instrument.measurement.recorded"
 * - "instrument.calibration.completed"
 * - "instrument.interaction.processed"
 * 
 * Event subscriptions:
 * - "instrument.interaction" (from user input)
 * - "world.entity.updated" (if instrument attached to entity)
 * 
 * Synchronization: interaction queue serialized per instrument; multiplayer via sync layer
 * Recovery: state and measurements persisted; restored from snapshot after crash
 * Telemetry: measurement rate, state transitions, error frequency
 * Diagnostics: current state, last calibration, measurement history
 * Accessibility: measurement values are screen-readable via overlay system
 * Performance: bounded measurement history; interactions processed async
 * Forbidden: direct manipulation of world state; bypassing calibration; blocking interaction loop
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  InstrumentId,
  InstrumentType,
  InstrumentState,
  InstrumentDescriptor,
  InstrumentMeasurement,
  InstrumentCalibration,
  InstrumentInteraction,
  MeasurementId,
} from '../contracts/instrument-contracts';
import { InstrumentState as IS } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { InstrumentRenderer } from './instrument-renderer';
import type { InstrumentSimulation } from './instrument-simulation';
import type { InstrumentSync } from './instrument-sync';
import type { InstrumentRecovery } from './instrument-recovery';

export abstract class InstrumentRuntime {
  protected state: InstrumentState = IS.UNLOADED;
  protected measurements: InstrumentMeasurement[] = [];
  protected calibration: InstrumentCalibration | null = null;
  protected readonly maxMeasurements = 10_000;

  constructor(
    public readonly descriptor: InstrumentDescriptor,
    protected logger: ILogger,
    protected meter: IMeter,
    protected eventBus: DistributedEventBus,
    protected renderer: InstrumentRenderer,
    protected simulation: InstrumentSimulation,
    protected sync: InstrumentSync,
    protected recovery: InstrumentRecovery,
  ) {}

  async bootstrap(): Promise<void> {
    if (this.state !== IS.UNLOADED) throw new Error('Instrument already loaded');
    this.setState(IS.LOADING);
    await this.renderer.initialize(this.descriptor);
    const restored = await this.recovery.restoreState(this.descriptor.id);
    if (restored) {
      this.measurements = restored.measurements ?? [];
      this.calibration = restored.calibration ?? null;
    }
    this.setState(IS.IDLE);
    this.logger.info(`Instrument ${this.descriptor.id} (${this.descriptor.type}) bootstrapped`);
    this.meter.incrementCounter('instrument.bootstrapped', { type: this.descriptor.type });
  }

  async handleInteraction(interaction: InstrumentInteraction): Promise<void> {
    this.logger.debug(`Instrument interaction: ${interaction.type} on ${this.descriptor.id}`);
    this.meter.incrementCounter('instrument.interaction', { type: interaction.type });
    switch (interaction.type) {
      case 'activate':
        await this.activate(interaction.payload);
        break;
      case 'deactivate':
        await this.deactivate();
        break;
      case 'configure':
        await this.configure(interaction.payload as Record<string, unknown>);
        break;
      case 'grab':
      case 'release':
      case 'rotate':
        // Delegate to renderer for 3D manipulation
        await this.renderer.handleInteraction(interaction);
        break;
    }
    await this.sync.broadcastInteraction(interaction);
    await this.eventBus.publish('instrument.interaction.processed', interaction);
  }

  async recordMeasurement(value: number | number[] | Record<string, number>, unit: string, uncertainty: number = 0): Promise<MeasurementId> {
    if (this.state !== IS.ACTIVE && this.state !== IS.MEASURING) {
      throw new Error('Instrument not active');
    }
    if (!this.isCalibrated()) {
      this.logger.warn(`Measurement attempted on uncalibrated instrument ${this.descriptor.id}`);
      this.meter.incrementCounter('instrument.measurement.uncalibrated');
    }
    const measurement: InstrumentMeasurement = {
      id: uuidv4() as MeasurementId,
      instrumentId: this.descriptor.id,
      timestamp: Date.now(),
      value,
      unit,
      uncertainty,
      metadata: { calibrationId: this.calibration?.id },
    };
    this.measurements.push(measurement);
    if (this.measurements.length > this.maxMeasurements) this.measurements.shift();
    await this.eventBus.publish('instrument.measurement.recorded', measurement);
    this.meter.incrementCounter('instrument.measurement.recorded');
    return measurement.id;
  }

  async performCalibration(referenceValue: number): Promise<void> {
    this.setState(IS.CALIBRATING);
    // Abstract calibration procedure – subclasses implement domain-specific logic
    const result = await this.runCalibrationProcedure(referenceValue);
    this.calibration = {
      id: uuidv4() as any,
      instrumentId: this.descriptor.id,
      performedAt: Date.now(),
      validUntil: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      offset: result.offset,
      scale: result.scale,
      referenceValue,
      metadata: {},
    };
    await this.recovery.persistCalibration(this.descriptor.id, this.calibration);
    this.setState(IS.IDLE);
    this.eventBus.publish('instrument.calibration.completed', this.calibration);
    this.meter.incrementCounter('instrument.calibration.completed');
  }

  async shutdown(): Promise<void> {
    this.setState(IS.DISPOSED);
    await this.recovery.persistState(this.descriptor.id, {
      measurements: this.measurements.slice(-500),
      calibration: this.calibration,
    });
    await this.renderer.dispose();
    this.measurements = [];
    this.logger.info(`Instrument ${this.descriptor.id} shut down`);
  }

  // Subclass hooks
  protected abstract activate(payload: unknown): Promise<void>;
  protected abstract deactivate(): Promise<void>;
  protected abstract configure(config: Record<string, unknown>): Promise<void>;
  protected abstract runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }>;
  protected abstract getInstrumentType(): InstrumentType;

  protected isCalibrated(): boolean {
    return this.calibration !== null && this.calibration.validUntil > Date.now();
  }

  protected setState(newState: InstrumentState): void {
    const oldState = this.state;
    this.state = newState;
    this.renderer.updateState(newState);
    this.eventBus.publish('instrument.state.changed', {
      instrumentId: this.descriptor.id,
      oldState,
      newState,
    });
  }

  getState(): InstrumentState { return this.state; }
  getMeasurements(): InstrumentMeasurement[] { return [...this.measurements]; }
  getCalibration(): InstrumentCalibration | null { return this.calibration; }
}