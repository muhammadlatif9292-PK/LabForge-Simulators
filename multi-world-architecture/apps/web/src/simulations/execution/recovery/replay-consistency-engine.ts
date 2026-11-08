// apps/web/src/simulations/execution/recovery/replay-consistency-engine.ts
/**
 * Replay Consistency Engine
 * 
 * Responsibilities:
 * - Replay simulation from a checkpoint to verify correctness or restore state
 * - Compare replay outputs against recorded outputs to detect inconsistencies
 * - Support replay at variable speed (fast-forward, slow-mo)
 * - Produce a detailed consistency report after replay
 * - Ensure replay is fully deterministic (same seed, same inputs)
 * 
 * Owned state:
 * - replayLog: Map<TickNumber, ReplayFrame>
 * - replayState: 'idle' | 'replaying' | 'paused'
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DeterministicExecutionRuntime (to re-execute ticks)
 * - CheckpointCompactionEngine (to load initial state)
 * - SimulationConsistencyValidator
 * 
 * Event emissions: "replay.started", "replay.completed", "replay.inconsistent"
 * Event subscriptions: none
 * Synchronization: no external sync during replay
 * Recovery: if replay fails, can restart from earlier checkpoint
 * Telemetry: replay FPS, consistency check pass rate
 * Diagnostics: replay position, mismatches
 * Accessibility: N/A
 * Performance: replay as fast as possible (no real-time waiting) unless user wants real-time
 * Forbidden: modifying original recorded data; skipping validation
 */

import type { TickNumber, ReplayFrame, ConsistencyReport, Checkpoint, TickInput } from '../contracts/simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DeterministicExecutionRuntime } from '../runtime/deterministic-execution-runtime';
import type { CheckpointCompactionEngine } from './checkpoint-compaction-engine';
import type { SimulationConsistencyValidator } from '../runtime/simulation-consistency-validator';

export class ReplayConsistencyEngine {
  private replayLog: Map<TickNumber, ReplayFrame> = new Map();
  private replayState: 'idle' | 'replaying' | 'paused' = 'idle';
  private reports: ConsistencyReport[] = [];

  constructor(
    private executionRuntime: DeterministicExecutionRuntime,
    private checkpointEngine: CheckpointCompactionEngine,
    private validator: SimulationConsistencyValidator,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async startReplay(fromTick: TickNumber, recordedInputs: Map<TickNumber, TickInput>): Promise<ConsistencyReport[]> {
    this.replayState = 'replaying';
    this.meter.incrementCounter('simulation.replay.started');
    this.logger.info(`Replay starting from tick ${fromTick}`);

    // Restore checkpoint
    const checkpoint = await this.checkpointEngine.restoreCheckpoint(fromTick);
    if (!checkpoint) throw new Error('No checkpoint available for replay');

    // Execute ticks from checkpoint to end of recorded inputs
    let currentTick = fromTick;
    const maxTick = Math.max(...Array.from(recordedInputs.keys()));
    this.reports = [];

    for (let tick = currentTick; tick <= maxTick; tick++) {
      const input = recordedInputs.get(tick as TickNumber);
      if (!input) { tick++; continue; }
      const output = await this.executionRuntime.executeTick(input);
      // Capture replay frame
      const frame: ReplayFrame = {
        tick: tick as TickNumber,
        state: output.newState,
        inputs: input,
        output,
      };
      this.replayLog.set(tick as TickNumber, frame);

      // Validate against expected hash (if available)
      const expectedHash = this.validator.expectedHashes.get(tick as TickNumber);
      if (expectedHash) {
        const report = this.validator.validateState(output.newState, expectedHash);
        this.reports.push(report);
        if (!report.consistent) {
          this.logger.warn(`Replay inconsistency at tick ${tick}: expected ${expectedHash}, actual ${report.actualHash}`);
          this.meter.incrementCounter('simulation.replay.inconsistent');
        }
      }
      tick++;
    }

    this.replayState = 'idle';
    this.meter.incrementCounter('simulation.replay.completed');
    this.logger.info('Replay completed');
    return this.reports;
  }

  pause(): void { this.replayState = 'paused'; }
  resume(): void { if (this.replayState === 'paused') this.replayState = 'replaying'; }
  isReplaying(): boolean { return this.replayState === 'replaying'; }

  getReports(): ConsistencyReport[] {
    return this.reports;
  }
}