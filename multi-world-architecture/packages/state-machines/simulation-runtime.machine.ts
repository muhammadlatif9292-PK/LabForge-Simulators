// packages/state-machines/simulation-runtime.machine.ts
/**
 * Simulation Runtime State Machine
 * 
 * Responsibilities:
 * - Formalise the overall simulation execution lifecycle: unloaded → initialising → running → pausing → paused → resuming → error → recovering → running
 * - Guarantee deterministic transitions; no illegal state changes
 * - Emit lifecycle events for observability
 * 
 * Owned state: currentState
 * Dependencies: ILogger, IMeter, DistributedEventBus
 * Event emissions: "simulation.state.changed"
 * Event subscriptions: none
 * Synchronization: single-threaded
 * Recovery: error states transition to recovering
 * Telemetry: state transition count
 * Diagnostics: current state
 * Accessibility: N/A
 * Performance: O(1) transition lookup
 * Forbidden: illegal transitions; skipping recovery
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum SimState {
  UNLOADED = 'unloaded',
  INITIALISING = 'initialising',
  RUNNING = 'running',
  PAUSING = 'pausing',
  PAUSED = 'paused',
  RESUMING = 'resuming',
  ERROR = 'error',
  RECOVERING = 'recovering',
}

export enum SimEvent {
  LOAD = 'load',
  INIT_DONE = 'init_done',
  PAUSE = 'pause',
  PAUSED_DONE = 'paused_done',
  RESUME = 'resume',
  RESUMED_DONE = 'resumed_done',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_START = 'recovery_start',
  RECOVERY_DONE = 'recovery_done',
  UNLOAD = 'unload',
}

export class SimulationRuntimeMachine {
  private state: SimState = SimState.UNLOADED;

  private static readonly TRANSITIONS: Record<string, SimState> = {
    [`${SimState.UNLOADED}.${SimEvent.LOAD}`]: SimState.INITIALISING,
    [`${SimState.INITIALISING}.${SimEvent.INIT_DONE}`]: SimState.RUNNING,
    [`${SimState.RUNNING}.${SimEvent.PAUSE}`]: SimState.PAUSING,
    [`${SimState.PAUSING}.${SimEvent.PAUSED_DONE}`]: SimState.PAUSED,
    [`${SimState.PAUSED}.${SimEvent.RESUME}`]: SimState.RESUMING,
    [`${SimState.RESUMING}.${SimEvent.RESUMED_DONE}`]: SimState.RUNNING,
    [`${SimState.RUNNING}.${SimEvent.ERROR_OCCURRED}`]: SimState.ERROR,
    [`${SimState.PAUSED}.${SimEvent.ERROR_OCCURRED}`]: SimState.ERROR,
    [`${SimState.ERROR}.${SimEvent.RECOVERY_START}`]: SimState.RECOVERING,
    [`${SimState.RECOVERING}.${SimEvent.RECOVERY_DONE}`]: SimState.RUNNING,
    [`${SimState.ERROR}.${SimEvent.UNLOAD}`]: SimState.UNLOADED,
    [`${SimState.PAUSED}.${SimEvent.UNLOAD}`]: SimState.UNLOADED,
    [`${SimState.RUNNING}.${SimEvent.UNLOAD}`]: SimState.UNLOADED,
  };

  constructor(
    private simId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): SimState { return this.state; }

  async send(event: SimEvent): Promise<boolean> {
    const key = `${this.state}.${event}`;
    const target = SimulationRuntimeMachine.TRANSITIONS[key];
    if (!target) {
      this.logger.warn(`Simulation transition rejected: ${this.state} + ${event}`, { simId: this.simId });
      return false;
    }
    const oldState = this.state;
    this.state = target;
    this.meter.incrementCounter('simulation.state.changed', { from: oldState, to: this.state });
    await this.eventBus.publish('simulation.state.changed', { simId: this.simId, from: oldState, to: this.state, event });
    return true;
  }
}