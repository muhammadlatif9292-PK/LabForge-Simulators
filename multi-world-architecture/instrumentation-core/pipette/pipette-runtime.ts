// instrumentation-core/pipette/pipette-runtime.ts
/**
 * Pipette Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a variable-volume micropipette
 * - Control aspiration and dispensing of liquid volumes
 * - Track tip status (attached/detached/contaminated)
 * - Compute actual dispensed volume with uncertainty
 * - Enforce volume range limits per pipette model
 * 
 * Owned state:
 * - targetVolume: number (µL)
 * - actualVolume: number
 * - uncertainty: number
 * - tipAttached: boolean
 * - tipType: string
 * - liquidInTip: boolean
 * - minVolume: number
 * - maxVolume: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Instrument base class
 * - CalibrationRuntime (volume accuracy)
 * - ScientificMeasurementRuntime (uncertainty)
 * - BeakerRuntime (source/destination for liquid)
 * 
 * Event emissions:
 *   "pipette.volume.set", "pipette.aspirated", "pipette.dispensed"
 *   "pipette.tip.attached", "pipette.tip.ejected"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded; sequential aspirate/dispense
 * Recovery: volume setting persisted
 * Telemetry: pipetting count, volume history
 * Diagnostics: current volume, tip status
 * Accessibility: volume announced
 * Performance: lightweight arithmetic; no heavy computation
 * Forbidden: pipetting without tip; exceeding volume range
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { PipetteVolume } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class PipetteRuntime extends InstrumentRuntime {
  private targetVolume = 100; // µL default
  private actualVolume = 0;
  private uncertainty = 0;
  private tipAttached = false;
  private tipType = 'standard';
  private liquidInTip = false;
  private readonly minVolume = 10;
  private readonly maxVolume = 1000; // P1000 model

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.PIPETTE; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    this.setState('idle' as InstrumentState);
    if (this.liquidInTip) {
      this.logger.warn('Pipette deactivated with liquid in tip');
    }
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.volume === 'number') {
      this.setVolume(config.volume);
    }
    if (typeof config.tipType === 'string') {
      this.tipType = config.tipType;
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    // Gravimetric calibration: dispense water and weigh
    const measured = this.actualVolume;
    const scale = reference / Math.max(1, measured);
    return { offset: 0, scale };
  }

  setVolume(volumeUL: number): void {
    if (volumeUL < this.minVolume || volumeUL > this.maxVolume) {
      this.logger.warn(`Volume ${volumeUL} µL out of range [${this.minVolume}, ${this.maxVolume}]`);
      return;
    }
    this.targetVolume = volumeUL;
    // Compute uncertainty based on pipette specs (±1-2% typical)
    this.uncertainty = this.targetVolume * (this.targetVolume <= 100 ? 0.02 : 0.01);
    if (this.isCalibrated()) {
      const cal = this.getCalibration();
      this.actualVolume = this.targetVolume * (cal?.scale ?? 1) + (cal?.offset ?? 0);
    } else {
      this.actualVolume = this.targetVolume;
    }
    this.eventBus.publish('pipette.volume.set', {
      instrumentId: this.descriptor.id,
      targetVolume: this.targetVolume,
      actualVolume: this.actualVolume,
      uncertainty: this.uncertainty,
    });
  }

  attachTip(tipType: string = 'standard'): void {
    this.tipAttached = true;
    this.tipType = tipType;
    this.eventBus.publish('pipette.tip.attached', {
      instrumentId: this.descriptor.id,
      tipType,
    });
    this.logger.info(`Pipette tip attached: ${tipType}`);
  }

  ejectTip(): void {
    this.tipAttached = false;
    this.liquidInTip = false;
    this.eventBus.publish('pipette.tip.ejected', {
      instrumentId: this.descriptor.id,
    });
    this.logger.info('Pipette tip ejected');
  }

  aspirate(): PipetteVolume {
    if (!this.tipAttached) {
      this.logger.warn('Cannot aspirate: no tip attached');
      throw new Error('No tip attached');
    }
    if (this.liquidInTip) {
      this.logger.warn('Tip already contains liquid');
      throw new Error('Tip already contains liquid');
    }
    this.liquidInTip = true;
    this.setState('measuring' as InstrumentState);
    const volume: PipetteVolume = {
      targetVolume: this.targetVolume,
      actualVolume: this.actualVolume,
      uncertainty: this.uncertainty,
      tipType: this.tipType,
    };
    this.eventBus.publish('pipette.aspirated', {
      instrumentId: this.descriptor.id,
      volume,
    });
    this.setState('active' as InstrumentState);
    this.logger.info(`Pipette aspirated ${this.targetVolume} µL`);
    return volume;
  }

  dispense(): PipetteVolume {
    if (!this.liquidInTip) {
      this.logger.warn('No liquid to dispense');
      throw new Error('No liquid in tip');
    }
    this.liquidInTip = false;
    this.setState('measuring' as InstrumentState);
    const volume: PipetteVolume = {
      targetVolume: this.targetVolume,
      actualVolume: this.actualVolume,
      uncertainty: this.uncertainty,
      tipType: this.tipType,
    };
    this.eventBus.publish('pipette.dispensed', {
      instrumentId: this.descriptor.id,
      volume,
    });
    this.setState('active' as InstrumentState);
    this.logger.info(`Pipette dispensed ${this.targetVolume} µL`);
    return volume;
  }

  getCurrentVolume(): PipetteVolume {
    return {
      targetVolume: this.targetVolume,
      actualVolume: this.actualVolume,
      uncertainty: this.uncertainty,
      tipType: this.tipType,
    };
  }

  hasLiquid(): boolean {
    return this.liquidInTip;
  }

  hasTip(): boolean {
    return this.tipAttached;
  }
}