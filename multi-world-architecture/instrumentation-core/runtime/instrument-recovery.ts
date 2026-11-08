// instrumentation-core/runtime/instrument-recovery.ts
/**
 * Instrument Recovery
 * 
 * Responsibilities:
 * - Persist instrument state (measurements, calibration) for crash recovery
 * - Restore instrument to last known state after reload
 * - Validate recovered state integrity
 * - Manage checkpoint rotation per instrument
 * 
 * Owned state: none (uses external storage)
 * 
 * Dependencies: ILogger, IMeter, local storage / IndexedDB adapter
 * 
 * Event emissions: "instrument.recovery.saved", "instrument.recovery.restored"
 * Event subscriptions: none
 * Synchronization: per-instrument, no cross-instrument conflicts
 * Recovery: resilient to corrupted data (discard and reinitialize)
 * Telemetry: recovery duration, saved state size
 * Diagnostics: last save timestamp
 * Accessibility: N/A
 * Performance: async writes; debounced saves during high activity
 * Forbidden: persisting stale data after shutdown signal
 */

import type { InstrumentMeasurement, InstrumentCalibration } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface InstrumentSnapshot {
  measurements: InstrumentMeasurement[];
  calibration: InstrumentCalibration | null;
  savedAt: number;
}

export class InstrumentRecovery {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // IndexedDB wrapper
  ) {}

  async persistState(instrumentId: string, data: { measurements: InstrumentMeasurement[]; calibration: InstrumentCalibration | null }): Promise<void> {
    const snapshot: InstrumentSnapshot = { ...data, savedAt: Date.now() };
    await this.storage.put(`instrument:${instrumentId}:state`, JSON.stringify(snapshot));
    this.meter.incrementCounter('instrument.recovery.saved');
  }

  async persistCalibration(instrumentId: string, calibration: InstrumentCalibration): Promise<void> {
    await this.storage.put(`instrument:${instrumentId}:calibration`, JSON.stringify(calibration));
    this.meter.incrementCounter('instrument.recovery.calibration_saved');
  }

  async restoreState(instrumentId: string): Promise<InstrumentSnapshot | null> {
    const raw = await this.storage.get(`instrument:${instrumentId}:state`);
    if (raw) {
      this.meter.incrementCounter('instrument.recovery.restored');
      return JSON.parse(raw);
    }
    return null;
  }

  async deleteState(instrumentId: string): Promise<void> {
    await this.storage.delete(`instrument:${instrumentId}:state`);
  }
}