// mobile-runtime/memory/thermal-regulation-runtime.ts
/**
 * Thermal Regulation Runtime
 * 
 * Responsibilities:
 * - Monitor device thermal state via platform APIs or heuristic inference
 * - Throttle rendering, simulation, and AI when device overheats
 * - Reduce frame rate, disable effects, and lower simulation tick rate
 * - Notify user via HUD when thermal throttling is active
 * - Recover performance when thermal state returns to nominal
 * 
 * Owned state:
 * - thermalState: ThermalState
 * - throttlingActive: boolean
 * - preThrottleProfile: RenderingProfile | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - AdaptiveRenderPipeline (to adjust quality)
 * - SimulationTickScheduler (to reduce tick rate)
 * 
 * Event emissions:
 * - "mobile.thermal.changed", "mobile.thermal.throttling.applied"
 * - "mobile.thermal.recovered"
 * 
 * Event subscriptions:
 * - "device.thermal.state" (from platform API, if available)
 * 
 * Synchronization: single-threaded; throttle decisions are instantaneous
 * Recovery: automatically restore performance when thermal state improves
 * Telemetry: thermal state gauge, throttling duration
 * Diagnostics: current thermal state, throttling status
 * Accessibility: thermal warning messages in HUD must be screen-readable
 * Performance: lightweight polling if platform API unavailable
 * Forbidden: ignoring thermal warnings; overheating the device
 */

import type { ThermalState, RenderingProfile } from '../contracts/mobile-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { AdaptiveRenderPipeline } from '@labforge/rendering-pipeline';
import type { SimulationTickScheduler } from '@labforge/simulation-execution';

export class ThermalRegulationRuntime {
  private state: ThermalState = 'nominal';
  private throttlingActive = false;
  private preThrottleProfile: RenderingProfile | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private renderPipeline: AdaptiveRenderPipeline,
    private simulationScheduler: SimulationTickScheduler | null,
  ) {
    this.eventBus.subscribe('device.thermal.state', this.onThermalEvent.bind(this));
    this.checkInterval = setInterval(() => this.pollThermalState(), 10000);
  }

  private onThermalEvent(event: any): void {
    const newState = event.payload.state as ThermalState;
    this.updateThermalState(newState);
  }

  private pollThermalState(): void {
    // Heuristic: if device is low-end, assume higher thermal risk
    // In production, use platform API (navigator.thermal on some devices)
    if (typeof navigator !== 'undefined' && 'thermal' in navigator) {
      // (navigator as any).thermal.addEventListener('change', ...)
    }
  }

  private updateThermalState(newState: ThermalState): void {
    if (newState === this.state) return;
    const oldState = this.state;
    this.state = newState;
    this.meter.setGauge('mobile.thermal.state', this.stateToNumber(newState));
    this.eventBus.publish('mobile.thermal.changed', { oldState, newState });

    if (newState === 'serious' || newState === 'critical') {
      if (!this.throttlingActive) {
        this.applyThrottling();
      }
    } else if (oldState === 'serious' || oldState === 'critical') {
      this.removeThrottling();
    }
  }

  private applyThrottling(): void {
    this.throttlingActive = true;
    this.preThrottleProfile = this.renderPipeline.getCurrentProfile() as RenderingProfile;
    // Reduce rendering quality
    if (this.state === 'critical') {
      this.renderPipeline.setProfile('low');
    } else {
      this.renderPipeline.setProfile('medium');
    }
    // Reduce simulation tick rate
    if (this.simulationScheduler) {
      this.simulationScheduler.setTickInterval(32); // ~30 Hz
    }
    this.meter.incrementCounter('mobile.thermal.throttling.applied');
    this.logger.warn(`Thermal throttling applied: ${this.state}`);
    this.eventBus.publish('mobile.thermal.throttling.applied', { state: this.state });
  }

  private removeThrottling(): void {
    this.throttlingActive = false;
    // Restore previous profile
    if (this.preThrottleProfile) {
      this.renderPipeline.setProfile(this.preThrottleProfile);
      this.preThrottleProfile = null;
    }
    if (this.simulationScheduler) {
      this.simulationScheduler.setTickInterval(16); // ~60 Hz
    }
    this.meter.incrementCounter('mobile.thermal.recovered');
    this.logger.info('Thermal throttling removed');
    this.eventBus.publish('mobile.thermal.recovered', {});
  }

  private stateToNumber(state: ThermalState): number {
    const map: Record<ThermalState, number> = { nominal: 0, fair: 1, serious: 2, critical: 3 };
    return map[state] ?? 0;
  }

  getState(): ThermalState { return this.state; }
  isThrottling(): boolean { return this.throttlingActive; }

  shutdown(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.throttlingActive) this.removeThrottling();
  }
}