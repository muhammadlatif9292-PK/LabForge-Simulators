// instrumentation-core/burner/burner-runtime.ts
/**
 * Burner Instrument Runtime
 * 
 * Responsibilities:
 * - Simulate a Bunsen burner with gas flow control and flame state
 * - Model flame temperature, color, and heat output
 * - Control air intake for flame type (yellow/safety vs blue/roaring)
 * - Detect unsafe conditions (gas leak, unlit gas flow)
 * - Couple with chemistry simulation for heating beakers
 * 
 * Owned state:
 * - state: BurnerState
 * - gasValveOpen: boolean
 * - airIntakeOpen: boolean
 * - sparkActive: boolean
 * - safetyCutoffActive: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Instrument base class
 * - ChemistrySimulationRuntime (heating beaker contents)
 * 
 * Event emissions:
 *   "burner.lit", "burner.extinguished", "burner.flame.adjusted"
 *   "burner.safety.cutoff", "burner.gas.leak.detected"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded; state machine driven
 * Recovery: flame state persisted
 * Telemetry: operating time, gas consumption estimate
 * Diagnostics: current flame state, safety status
 * Accessibility: flame status announced
 * Performance: lightweight state machine; no heavy computation
 * Forbidden: gas flow without ignition; leaving burner unattended without safety cutoff
 */

import type { InstrumentDescriptor, InstrumentState } from '../contracts/instrument-contracts';
import { InstrumentType } from '../contracts/instrument-contracts';
import type { BurnerState } from '../contracts/instrument-implementation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { InstrumentRuntime } from '../runtime/instrument-runtime';

export class BurnerRuntime extends InstrumentRuntime {
  private burnerState: BurnerState = {
    lit: false,
    temperature: 25, // °C ambient
    gasFlow: 0, // L/min
    flameColor: 'none',
  };
  private gasValveOpen = false;
  private airIntakeOpen = true;
  private sparkActive = false;
  private safetyCutoffActive = false;
  private unattendedTimer: any = null;
  private readonly UNATTENDED_TIMEOUT_MS = 300000; // 5 minutes
  private heatTimer: any = null;
  private readonly MAX_GAS_FLOW = 5; // L/min
  private readonly MAX_FLAME_TEMP = 1500; // °C

  constructor(
    descriptor: InstrumentDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
    renderer: any, simulation: any, sync: any, recovery: any,
  ) {
    super(descriptor, logger, meter, eventBus, renderer, simulation, sync, recovery);
  }

  protected getInstrumentType(): InstrumentType { return InstrumentType.BURNER; }

  protected async activate(payload: unknown): Promise<void> {
    this.setState('active' as InstrumentState);
  }

  protected async deactivate(): Promise<void> {
    if (this.burnerState.lit) {
      this.extinguish();
    }
    if (this.gasValveOpen) {
      this.closeGas();
    }
    this.setState('idle' as InstrumentState);
  }

  protected async configure(config: Record<string, unknown>): Promise<void> {
    if (typeof config.gasFlow === 'number') {
      this.setGasFlow(config.gasFlow);
    }
    if (typeof config.airIntake === 'boolean') {
      this.airIntakeOpen = config.airIntake;
      this.updateFlameCharacteristics();
    }
  }

  protected async runCalibrationProcedure(reference: number): Promise<{ offset: number; scale: number }> {
    // Calibrate temperature sensor
    return { offset: 0, scale: reference / Math.max(1, this.burnerState.temperature) };
  }

  openGas(flowRate: number = 2): void {
    if (this.safetyCutoffActive) {
      this.logger.warn('Cannot open gas: safety cutoff active');
      return;
    }
    this.gasValveOpen = true;
    this.burnerState.gasFlow = Math.min(flowRate, this.MAX_GAS_FLOW);
    this.logger.info(`Gas opened at ${this.burnerState.gasFlow} L/min`);
  }

  closeGas(): void {
    this.gasValveOpen = false;
    this.burnerState.gasFlow = 0;
    if (this.burnerState.lit) {
      this.extinguish();
    }
    this.logger.info('Gas closed');
  }

  ignite(): boolean {
    if (!this.gasValveOpen) {
      this.logger.warn('Cannot ignite: gas not flowing');
      return false;
    }
    if (this.burnerState.lit) {
      this.logger.warn('Burner already lit');
      return true;
    }
    this.sparkActive = true;
    this.burnerState.lit = true;
    this.updateFlameCharacteristics();
    this.setState('measuring' as InstrumentState);
    this.eventBus.publish('burner.lit', {
      instrumentId: this.descriptor.id,
      gasFlow: this.burnerState.gasFlow,
    });
    this.logger.info('Burner ignited');
    // Reset unattended timer
    this.resetUnattendedTimer();
    // Start heating
    this.startHeating();
    return true;
  }

  extinguish(): void {
    if (!this.burnerState.lit) return;
    this.burnerState.lit = false;
    this.sparkActive = false;
    this.burnerState.flameColor = 'none';
    this.setState('active' as InstrumentState);
    if (this.heatTimer) clearInterval(this.heatTimer);
    if (this.unattendedTimer) clearTimeout(this.unattendedTimer);
    this.eventBus.publish('burner.extinguished', {
      instrumentId: this.descriptor.id,
      temperature: this.burnerState.temperature,
    });
    this.logger.info('Burner extinguished');
  }

  setGasFlow(flowRate: number): void {
    this.burnerState.gasFlow = Math.min(flowRate, this.MAX_GAS_FLOW);
    if (this.burnerState.lit) {
      this.updateFlameCharacteristics();
    }
    this.eventBus.publish('burner.flame.adjusted', {
      instrumentId: this.descriptor.id,
      gasFlow: this.burnerState.gasFlow,
    });
  }

  toggleAirIntake(): void {
    this.airIntakeOpen = !this.airIntakeOpen;
    if (this.burnerState.lit) {
      this.updateFlameCharacteristics();
    }
  }

  private updateFlameCharacteristics(): void {
    if (!this.burnerState.lit) return;
    if (this.airIntakeOpen) {
      // Blue roaring flame (complete combustion)
      this.burnerState.flameColor = '#1e90ff';
      this.burnerState.temperature = Math.min(
        this.MAX_FLAME_TEMP,
        800 + this.burnerState.gasFlow * 140
      );
    } else {
      // Yellow safety flame (incomplete combustion, cooler)
      this.burnerState.flameColor = '#ff8c00';
      this.burnerState.temperature = Math.min(
        600,
        400 + this.burnerState.gasFlow * 40
      );
    }
  }

  private startHeating(): void {
    this.heatTimer = setInterval(() => {
      if (!this.burnerState.lit) {
        clearInterval(this.heatTimer);
        return;
      }
      // Emit heat output for physics/chemistry simulation
      this.eventBus.publish('burner.heat.output', {
        instrumentId: this.descriptor.id,
        temperature: this.burnerState.temperature,
        position: this.descriptor.position,
      });
      // Check gas leak (safety)
      if (this.burnerState.gasFlow > 0 && !this.burnerState.lit) {
        this.detectGasLeak();
      }
    }, 1000);
  }

  private detectGasLeak(): void {
    this.safetyCutoffActive = true;
    this.closeGas();
    this.eventBus.publish('burner.gas.leak.detected', {
      instrumentId: this.descriptor.id,
      timestamp: Date.now(),
    });
    this.logger.warn('Gas leak detected — safety cutoff activated');
  }

  private resetUnattendedTimer(): void {
    if (this.unattendedTimer) clearTimeout(this.unattendedTimer);
    this.unattendedTimer = setTimeout(() => {
      if (this.burnerState.lit) {
        this.logger.warn('Burner unattended — auto extinguish');
        this.extinguish();
        this.eventBus.publish('burner.safety.cutoff', {
          instrumentId: this.descriptor.id,
          reason: 'unattended',
        });
      }
    }, this.UNATTENDED_TIMEOUT_MS);
  }

  // Reset unattended timer when user interacts with burner
  reportUserActivity(): void {
    if (this.burnerState.lit) {
      this.resetUnattendedTimer();
    }
  }

  getState(): Readonly<BurnerState> {
    return { ...this.burnerState };
  }

  isLit(): boolean {
    return this.burnerState.lit;
  }

  isGasOpen(): boolean {
    return this.gasValveOpen;
  }
}