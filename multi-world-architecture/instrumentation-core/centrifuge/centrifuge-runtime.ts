// instrumentation-core/centrifuge/centrifuge-runtime.ts
/**
 * Centrifuge Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a laboratory centrifuge with configurable RPM, radius, and duration
 * - Compute relative centrifugal force (RCF) from RPM and rotor radius
 * - Spin up/down with realistic acceleration profiles
 * - Emit state changes (spinning, complete, error) for UI and safety
 * - Enforce safety limits: max RPM, imbalance detection, lid lock
 * 
 * Owned state:
 * - parameters: CentrifugeParameters
 * - spinning: boolean
 * - currentRPM: number
 * - elapsedTime: number
 * - lidLocked: boolean
 * - imbalanceDetected: boolean
 * - spinInterval: NodeJS.Timeout | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Instrument base class
 * - ScientificConstantsRegistry (g for RCF)
 * 
 * Event emissions:
 *   "centrifuge.spin.started", "centrifuge.spin.completed"
 *   "centrifuge.spin.stopped", "centrifuge.imbalance.warning"
 *   "centrifuge.lid.locked", "centrifuge.lid.unlocked"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded spin simulation
 * Recovery: spin state persisted; retry on crash
 * Telemetry: spin count, total runtime, max RPM reached
 * Diagnostics: current RPM, elapsed time, safety status
 * Accessibility: spin status announced for screen readers
 * Performance: lightweight timer-based simulation
 * Forbidden: operating with lid unlocked; exceeding max safe RPM without override
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { CentrifugeParameters } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class CentrifugeRuntime extends InstrumentRuntime {
  private parameters: CentrifugeParameters = {
    rpm: 0,
    radius: 10, // cm, typical benchtop
    rcf: 0,
    duration: 300, // seconds (5 min default)
    temperature: 25,
  };
  private spinning = false;
  private currentRPM = 0;
  private elapsedTime = 0;
  private lidLocked = false;
  private imbalanceDetected = false;
  private spinInterval: any = null;
  private readonly MAX_RPM = 15000;
  private readonly RAMP_UP_RATE = 500; // RPM per second
  private readonly RAMP_DOWN_RATE = 800;

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.CENTRIFUGE; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
    if (this.spinning) {
      this.emergencyStop();
    }
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.rpm === 'number') {
      this.parameters.rpm = Math.min(config.rpm, this.MAX_RPM);
      this.recalculateRCF();
    }
    if (typeof config.radius === 'number') {
      this.parameters.radius = config.radius;
      this.recalculateRCF();
    }
    if (typeof config.duration === 'number') {
      this.parameters.duration = config.duration;
    }
    if (typeof config.temperature === 'number') {
      this.parameters.temperature = config.temperature;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    // Centrifuge calibration: verify RPM sensor accuracy
    const measuredRPM = this.currentRPM;
    const scale = reference / Math.max(1, measuredRPM);
    return { offset: 0, scale };
  }

  lockLid(): void {
    this.lidLocked = true;
    this.eventBus.publish('centrifuge.lid.locked', { instrumentId: this.descriptor.id });
    this.logger.info('Centrifuge lid locked');
  }

  unlockLid(): void {
    if (this.spinning) {
      this.logger.warn('Cannot unlock lid while spinning');
      return;
    }
    this.lidLocked = false;
    this.eventBus.publish('centrifuge.lid.unlocked', { instrumentId: this.descriptor.id });
  }

  async startSpin(): Promise<void> {
    if (this.spinning) return;
    if (!this.lidLocked) {
      this.logger.warn('Cannot start spin: lid not locked');
      return;
    }
    if (this.imbalanceDetected) {
      this.logger.warn('Cannot start spin: imbalance detected');
      return;
    }
    if (this.parameters.rpm <= 0) {
      this.logger.warn('Cannot start spin: RPM not set');
      return;
    }
    this.spinning = true;
    this.elapsedTime = 0;
    this.currentRPM = 0;
    this.setState('measuring' as InstrumentState);
    this.eventBus.publish('centrifuge.spin.started', {
      instrumentId: this.descriptor.id,
      parameters: { ...this.parameters },
    });
    this.logger.info(`Centrifuge spin started: ${this.parameters.rpm} RPM, ${this.parameters.duration}s`);
    this.spinLoop();
  }

  stopSpin(): void {
    if (!this.spinning) return;
    this.spinning = false;
    if (this.spinInterval) clearInterval(this.spinInterval);
    // Ramp down to 0
    const rampDown = () => {
      if (this.currentRPM <= 0) {
        this.currentRPM = 0;
        this.setState('active' as InstrumentState);
        this.eventBus.publish('centrifuge.spin.stopped', {
          instrumentId: this.descriptor.id,
          elapsedTime: this.elapsedTime,
        });
        return;
      }
      this.currentRPM = Math.max(0, this.currentRPM - this.RAMP_DOWN_RATE * 0.1);
      setTimeout(rampDown, 100);
    };
    rampDown();
  }

  emergencyStop(): void {
    this.spinning = false;
    if (this.spinInterval) clearInterval(this.spinInterval);
    this.currentRPM = Math.max(0, this.currentRPM - 5000); // rapid deceleration
    this.setState('error' as InstrumentState);
    this.eventBus.publish('centrifuge.spin.stopped', {
      instrumentId: this.descriptor.id,
      emergency: true,
      elapsedTime: this.elapsedTime,
    });
    this.logger.warn('Centrifuge emergency stop');
  }

  private spinLoop(): void {
    if (!this.spinning) return;
    this.spinInterval = setInterval(() => {
      if (!this.spinning) {
        clearInterval(this.spinInterval);
        return;
      }
      // Ramp up
      if (this.currentRPM < this.parameters.rpm) {
        this.currentRPM = Math.min(this.parameters.rpm, this.currentRPM + this.RAMP_UP_RATE * 0.1);
      }
      // Elapsed time
      this.elapsedTime += 0.1;
      // Check for completion
      if (this.elapsedTime >= this.parameters.duration && this.currentRPM >= this.parameters.rpm * 0.95) {
        this.spinning = false;
        clearInterval(this.spinInterval);
        this.setState('active' as InstrumentState);
        this.logger.info('Centrifuge spin completed');
        this.eventBus.publish('centrifuge.spin.completed', {
          instrumentId: this.descriptor.id,
          totalTime: this.elapsedTime,
          maxRPM: this.currentRPM,
        });
        return;
      }
      // Update RCF
      this.recalculateRCF();
    }, 100);
  }

  private recalculateRCF(): void {
    // RCF = (1.118 × 10⁻⁵) × r (cm) × RPM²
    this.parameters.rcf = 1.118e-5 * this.parameters.radius * Math.pow(this.currentRPM, 2);
  }

  detectImbalance(): void {
    this.imbalanceDetected = true;
    this.eventBus.publish('centrifuge.imbalance.warning', {
      instrumentId: this.descriptor.id,
      rpm: this.currentRPM,
    });
    if (this.spinning) {
      this.emergencyStop();
    }
  }

  resolveImbalance(): void {
    this.imbalanceDetected = false;
  }

  getParameters(): Readonly<CentrifugeParameters> {
    return { ...this.parameters, rcf: this.parameters.rcf };
  }

  getCurrentRPM(): number {
    return this.currentRPM;
  }

  isSpinning(): boolean {
    return this.spinning;
  }
}