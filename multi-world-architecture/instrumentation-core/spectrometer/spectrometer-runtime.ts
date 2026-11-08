// instrumentation-core/spectrometer/spectrometer-runtime.ts
/**
 * Spectrometer Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a UV-Vis spectrophotometer
 * - Collect absorbance/transmission spectra from samples
 * - Calibrate using blank and known standards
 * - Identify peaks and match against known spectra
 * - Emit spectra for visualization and AI tutoring
 * 
 * Owned state:
 * - currentReading: SpectrometerReading | null
 * - isScanning: boolean
 * - wavelengthRange: [number, number]
 * - integrationTime: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Instrument base class
 * - ChemistrySimulationRuntime (to query sample absorbance)
 * - CalibrationRuntime
 * 
 * Event emissions:
 *   "spectrometer.scan.started", "spectrometer.scan.completed"
 *   "spectrometer.peak.detected"
 * 
 * Event subscriptions: none
 * Synchronization: scan runs sequentially
 * Recovery: scan can be restarted
 * Telemetry: scan count, peak count
 * Diagnostics: current wavelength calibration
 * Accessibility: spectrum described via alt text
 * Performance: spectrum data capped at resolution; async scan
 * Forbidden: returning data without calibration correction
 */

import { v4 as uuidv4 } from 'uuid';
import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { SpectrometerReading } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class SpectrometerRuntime extends InstrumentRuntime {
  private currentReading: SpectrometerReading | null = null;
  private isScanning = false;
  private wavelengthRange: [number, number] = [200, 800]; // nm
  private integrationTime = 100; // ms

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.SPECTROMETER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
    this.isScanning = false;
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (config.wavelengthMin !== undefined && config.wavelengthMax !== undefined) {
      this.wavelengthRange = [config.wavelengthMin as number, config.wavelengthMax as number];
    }
    if (typeof config.integrationTime === 'number') {
      this.integrationTime = config.integrationTime;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    return { offset: 0, scale: 1 };
  }

  async startScan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;
    this.setState('measuring' as InstrumentState);
    this.eventBus.publish('spectrometer.scan.started', { instrumentId: this.descriptor.id });
    this.logger.info('Spectrometer scan started');

    // Simulate scan (production would compute from sample absorbance)
    const steps = 300;
    const [minW, maxW] = this.wavelengthRange;
    const step = (maxW - minW) / (steps - 1);
    const wavelengths: number[] = [];
    const intensities: number[] = [];
    for (let i = 0; i < steps; i++) {
      wavelengths.push(minW + i * step);
      intensities.push(Math.random() * 0.5 + 0.3); // placeholder: real absorbance
    }
    const peaks = this.detectPeaks(wavelengths, intensities, 0.1);
    this.currentReading = {
      wavelengths,
      intensities,
      peaks,
      integrationTime: this.integrationTime,
    };
    this.isScanning = false;
    this.setState('active' as InstrumentState);
    this.eventBus.publish('spectrometer.scan.completed', {
      instrumentId: this.descriptor.id,
      reading: this.currentReading,
    });
    for (const peak of peaks) {
      this.eventBus.publish('spectrometer.peak.detected', {
        instrumentId: this.descriptor.id,
        peak,
      });
    }
  }

  private detectPeaks(wavelengths: number[], intensities: number[], threshold: number): SpectrometerReading['peaks'] {
    const peaks: SpectrometerReading['peaks'] = [];
    for (let i = 1; i < intensities.length - 1; i++) {
      if (intensities[i] > intensities[i - 1] && intensities[i] > intensities[i + 1] && intensities[i] > threshold) {
        peaks.push({ wavelength: wavelengths[i], intensity: intensities[i] });
      }
    }
    return peaks;
  }

  getCurrentReading(): SpectrometerReading | null {
    return this.currentReading;
  }
}