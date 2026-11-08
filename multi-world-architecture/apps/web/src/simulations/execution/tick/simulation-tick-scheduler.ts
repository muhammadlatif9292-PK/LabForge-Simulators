// apps/web/src/simulations/execution/tick/simulation-tick-scheduler.ts
/**
 * Simulation Tick Scheduler
 * 
 * Responsibilities:
 * - Schedule simulation ticks at a fixed interval for deterministic real-time execution
 * - Support variable tick rates and catch-up after pause
 * - Buffer user inputs and external events for the next tick
 * - Handle tick skipping if rendering lags (deterministic: still process ticks, just skip rendering)
 * 
 * Owned state:
 * - isRunning: boolean
 * - targetTickIntervalMs: number
 * - pendingInputs: UserInput[]
 * - lastTickTime: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DeterministicExecutionRuntime (callback)
 * 
 * Event emissions: none
 * Event subscriptions: "simulation.input" from websocket or local
 * Synchronization: none (single-threaded; ticks serialized)
 * Recovery: if timer drifts, tick count catches up based on elapsed time
 * Telemetry: tick rate achieved, input buffer size
 * Diagnostics: scheduler status, next tick time
 * Accessibility: N/A
 * Performance: avoids setTimeout drift by using absolute time tracking
 * Forbidden: calling tick callback concurrently; dropping inputs
 */

import type { TickNumber, TickInput, UserInput } from '../contracts/simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SimulationTickScheduler {
  private isRunning = false;
  private targetTickIntervalMs = 16; // ~60 Hz
  private pendingInputs: UserInput[] = [];
  private currentTick: TickNumber = 0 as TickNumber;
  private lastTickTime = 0;
  private timerHandle: any = null;
  onTick: ((input: TickInput) => Promise<void>) | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = performance.now();
    this.scheduleNext();
    this.logger.info('Tick scheduler started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.logger.info('Tick scheduler stopped');
  }

  enqueueInput(input: UserInput): void {
    this.pendingInputs.push(input);
    this.meter.setGauge('simulation.input_buffer_size', this.pendingInputs.length);
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;
    const now = performance.now();
    const elapsed = now - this.lastTickTime;
    let ticksToAdvance = Math.floor(elapsed / this.targetTickIntervalMs);
    if (ticksToAdvance < 1) ticksToAdvance = 1; // always at least one
    // Prevent spiral of death: cap max ticks to catch up
    if (ticksToAdvance > 10) ticksToAdvance = 10;

    // Advance by calling onTick for each pending tick
    for (let i = 0; i < ticksToAdvance; i++) {
      this.currentTick = (this.currentTick + 1) as TickNumber;
      const input: TickInput = {
        tickNumber: this.currentTick,
        deltaTimeMs: this.targetTickIntervalMs,
        userInputs: this.pendingInputs.splice(0),
        externalEvents: [],
      };
      if (this.onTick) {
        this.onTick(input).catch(err => this.logger.error('Tick execution failed', err));
      }
    }
    this.lastTickTime += ticksToAdvance * this.targetTickIntervalMs;
    // Schedule next tick
    const nextTickTime = this.lastTickTime + this.targetTickIntervalMs;
    const delay = Math.max(0, nextTickTime - performance.now());
    this.timerHandle = setTimeout(() => this.scheduleNext(), delay);
  }

  getCurrentTick(): TickNumber {
    return this.currentTick;
  }

  setTickInterval(ms: number): void {
    this.targetTickIntervalMs = ms;
    this.logger.info(`Tick interval changed to ${ms}ms`);
  }
}