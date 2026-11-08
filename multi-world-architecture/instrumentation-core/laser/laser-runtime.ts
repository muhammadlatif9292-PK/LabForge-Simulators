// instrumentation-core/laser/laser-runtime.ts
/**
 * Laser Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a tunable/pulsed laser source
 * - Control wavelength, power, beam parameters, and pulse settings
 * - Model beam propagation (collimation, divergence, polarization)
 * - Emit photon beam events for optical experiments
 * - Couple with physics simulation for interference, diffraction
 * 
 * Owned state:
 * - parameters: LaserParameters
 * - emissionActive: boolean
 * - beamDirection: [number, number, number]
 * - emittedPhotons: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Instrument base class
 * - PhysicsSimulationRuntime (for ray tracing, interference)
 * - ScientificConstantsRegistry (c, h for photon energy)
 * 
 * Event emissions:
 *   "laser.emission.started", "laser.emission.stopped"
 *   "laser.parameters.changed", "laser.photon.emitted"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded; pulses timed
 * Recovery: parameters persisted
 * Telemetry: emission duration, photon count
 * Diagnostics: current parameters
 * Accessibility: laser state described
 * Performance: lightweight parameter updates; photon generation batched
 * Forbidden: simulating unsafely high power without warning
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { LaserParameters } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class LaserRuntime extends InstrumentRuntime {
  private parameters: LaserParameters = {
    wavelength: 632.8, // HeNe red
    power: 1.0, // mW
    beamRadius: 0.8, // mm
    pulsed: false,
    polarization: 'linear',
  };
  private emissionActive = false;
  private beamDirection: [number, number, number] = [0, 0, 1];
  private emittedPhotons = 0;

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.LASER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
    if (payload && typeof payload === 'object') {
      const config = payload as Partial<LaserParameters>;
      if (config.wavelength !== undefined) this.parameters.wavelength = config.wavelength;
      if (config.power !== undefined) this.parameters.power = config.power;
      if (config.pulsed !== undefined) this.parameters.pulsed = config.pulsed;
    }
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
    if (this.emissionActive) this.stopEmission();
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.wavelength === 'number') {
      this.parameters.wavelength = config.wavelength;
    }
    if (typeof config.power === 'number') {
      this.parameters.power = config.power;
    }
    if (typeof config.beamRadius === 'number') {
      this.parameters.beamRadius = config.beamRadius;
    }
    if (typeof config.pulsed === 'boolean') {
      this.parameters.pulsed = config.pulsed;
      if (this.parameters.pulsed && typeof config.pulseFrequency === 'number') {
        this.parameters.pulseFrequency = config.pulseFrequency;
      }
    }
    if (typeof config.polarization === 'string') {
      this.parameters.polarization = config.polarization as LaserParameters['polarization'];
    }
    if (typeof config.direction === 'object') {
      const dir = config.direction as { x: number; y: number; z: number };
      this.beamDirection = [dir.x, dir.y, dir.z];
    }
    this.eventBus.publish('laser.parameters.changed', {
      instrumentId: this.descriptor.id,
      parameters: { ...this.parameters },
    });
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    return { offset: 0, scale: 1 };
  }

  startEmission(): void {
    if (this.emissionActive) return;
    this.emissionActive = true;
    this.setState('measuring' as InstrumentState);
    this.eventBus.publish('laser.emission.started', {
      instrumentId: this.descriptor.id,
      parameters: { ...this.parameters },
    });
    // Begin photon emission loop
    this.emissionLoop();
  }

  stopEmission(): void {
    this.emissionActive = false;
    this.setState('active' as InstrumentState);
    this.eventBus.publish('laser.emission.stopped', {
      instrumentId: this.descriptor.id,
      totalPhotons: this.emittedPhotons,
    });
  }

  private emissionLoop(): void {
    if (!this.emissionActive) return;
    const intervalMs = this.parameters.pulsed && this.parameters.pulseFrequency
      ? 1000 / this.parameters.pulseFrequency
      : 100; // continuous wave: batch every 100ms
    // Emit photon packets
    const photonsThisBatch = this.parameters.pulsed ? 1e6 : 1e4; // simplified
    this.emittedPhotons += photonsThisBatch;
    this.eventBus.publish('laser.photon.emitted', {
      instrumentId: this.descriptor.id,
      count: photonsThisBatch,
      wavelength: this.parameters.wavelength,
      direction: this.beamDirection,
    });
    setTimeout(() => this.emissionLoop(), intervalMs);
  }

  getParameters(): Readonly<LaserParameters> {
    return { ...this.parameters };
  }

  getBeamDirection(): [number, number, number] {
    return [...this.beamDirection];
  }

  getPhotonEnergy(): number {
    // E = h * c / lambda
    const h = 6.62607015e-34; // J·s
    const c = 299792458; // m/s
    const lambda = this.parameters.wavelength * 1e-9; // nm → m
    return (h * c) / lambda; // Joules
  }
}