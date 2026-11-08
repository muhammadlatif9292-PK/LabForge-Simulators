// packages/state-machines/crash-recovery.machine.ts
/**
 * Crash Recovery State Machine
 * 
 * Responsibilities:
 * - Formalise the application crash detection and recovery lifecycle
 * - States: healthy → degraded → crashed → recovering → healthy
 * - Coordinate with recovery runtimes for checkpoint restoration
 * - Track successive crash count to detect unrecoverable states
 * 
 * Owned state: currentState, successiveCrashes, lastRecoveryTimestamp
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum CrashRecoveryState {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRASHED = 'crashed',
  RECOVERING = 'recovering',
  RECOVERED = 'recovered',
  UNRECOVERABLE = 'unrecoverable',
}

export enum CrashRecoveryEvent {
  ANOMALY_DETECTED = 'anomaly_detected',
  CRASH_DETECTED = 'crash_detected',
  RECOVERY_STARTED = 'recovery_started',
  CHECKPOINT_LOADED = 'checkpoint_loaded',
  STATE_RESTORED = 'state_restored',
  RECOVERY_FAILED = 'recovery_failed',
  ALL_CLEAR = 'all_clear',
  MAX_CRASHES_EXCEEDED = 'max_crashes_exceeded',
}

export class CrashRecoveryMachine {
  private state: CrashRecoveryState = CrashRecoveryState.HEALTHY;
  private successiveCrashes = 0;
  private lastRecoveryTimestamp = 0;
  private readonly maxSuccessiveCrashes = 3;

  private static readonly TRANSITIONS: Array<{ from: CrashRecoveryState; to: CrashRecoveryState; event: CrashRecoveryEvent }> = [
    { from: CrashRecoveryState.HEALTHY, to: CrashRecoveryState.DEGRADED, event: CrashRecoveryEvent.ANOMALY_DETECTED },
    { from: CrashRecoveryState.DEGRADED, to: CrashRecoveryState.HEALTHY, event: CrashRecoveryEvent.ALL_CLEAR },
    { from: CrashRecoveryState.DEGRADED, to: CrashRecoveryState.CRASHED, event: CrashRecoveryEvent.CRASH_DETECTED },
    { from: CrashRecoveryState.HEALTHY, to: CrashRecoveryState.CRASHED, event: CrashRecoveryEvent.CRASH_DETECTED },
    { from: CrashRecoveryState.CRASHED, to: CrashRecoveryState.RECOVERING, event: CrashRecoveryEvent.RECOVERY_STARTED },
    { from: CrashRecoveryState.RECOVERING, to: CrashRecoveryState.RECOVERED, event: CrashRecoveryEvent.STATE_RESTORED },
    { from: CrashRecoveryState.RECOVERED, to: CrashRecoveryState.HEALTHY, event: CrashRecoveryEvent.ALL_CLEAR },
    { from: CrashRecoveryState.RECOVERING, to: CrashRecoveryState.CRASHED, event: CrashRecoveryEvent.RECOVERY_FAILED },
    { from: CrashRecoveryState.CRASHED, to: CrashRecoveryState.UNRECOVERABLE, event: CrashRecoveryEvent.MAX_CRASHES_EXCEEDED },
    { from: CrashRecoveryState.RECOVERING, to: CrashRecoveryState.UNRECOVERABLE, event: CrashRecoveryEvent.MAX_CRASHES_EXCEEDED },
  ];

  constructor(
    private serviceId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): CrashRecoveryState { return this.state; }
  getSuccessiveCrashes(): number { return this.successiveCrashes; }

  async send(event: CrashRecoveryEvent): Promise<boolean> {
    const transition = CrashRecoveryMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`Crash recovery transition rejected: ${this.state} + ${event}`, { serviceId: this.serviceId });
      return false;
    }

    const oldState = this.state;
    this.state = transition.to;

    if (event === CrashRecoveryEvent.CRASH_DETECTED) {
      this.successiveCrashes++;
    }
    if (event === CrashRecoveryEvent.ALL_CLEAR && this.state === CrashRecoveryState.HEALTHY) {
      this.successiveCrashes = 0;
    }
    if (this.successiveCrashes >= this.maxSuccessiveCrashes && this.state !== CrashRecoveryState.UNRECOVERABLE) {
      await this.send(CrashRecoveryEvent.MAX_CRASHES_EXCEEDED);
      return true;
    }

    this.lastRecoveryTimestamp = Date.now();
    this.meter.incrementCounter('crash.recovery.state.changed', { from: oldState, to: this.state });
    this.logger.info(`Crash recovery: ${oldState} → ${this.state} (crashes: ${this.successiveCrashes})`, { serviceId: this.serviceId });
    await this.eventBus.publish('crash.recovery.state.changed', {
      serviceId: this.serviceId,
      from: oldState,
      to: this.state,
      successiveCrashes: this.successiveCrashes,
    });

    return true;
  }
}