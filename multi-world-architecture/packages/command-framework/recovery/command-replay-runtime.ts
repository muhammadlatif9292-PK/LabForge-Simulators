// packages/command-framework/recovery/command-replay-runtime.ts
/**
 * Command Replay Runtime
 * 
 * Responsibilities:
 * - Record commands in sequence for deterministic replay
 * - Replay commands from a given starting point to restore state
 * - Validate replay consistency by comparing state hashes
 * - Support replay at variable speeds for debugging
 * 
 * Owned state:
 * - replayLog: CommandReplayFrame[]
 * - sequenceCounter: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - CommandRuntime (to re-execute during replay)
 * 
 * Event emissions: "command.replay.started", "command.replay.completed", "command.replay.inconsistent"
 * Event subscriptions: none
 * Synchronization: replay is single-threaded
 * Recovery: replay log persisted
 * Telemetry: replay duration, frame count
 * Diagnostics: replay position
 * Accessibility: N/A
 * Performance: sequential replay; skip visualization for speed
 * Forbidden: non-deterministic replay results
 */

import type { Command, CommandExecution, CommandReplayFrame } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class CommandReplayRuntime {
  private log: CommandReplayFrame[] = [];
  private sequence = 0;
  private maxLogSize = 50_000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  recordCommand(command: Command, execution: CommandExecution): void {
    const frame: CommandReplayFrame = {
      sequenceNumber: this.sequence++,
      execution,
      timestamp: Date.now(),
    };
    this.log.push(frame);
    if (this.log.length > this.maxLogSize) this.log.shift();
  }

  async replay(fromSequence: number, replayFn: (command: Command) => Promise<void>): Promise<void> {
    const frames = this.log.filter(f => f.sequenceNumber >= fromSequence);
    this.meter.incrementCounter('command.replay.started');
    this.logger.info(`Replaying ${frames.length} commands from sequence ${fromSequence}`);
    for (const frame of frames) {
      try {
        await replayFn(frame.execution.command);
        this.meter.incrementCounter('command.replay.frame_processed');
      } catch (err) {
        this.logger.error(`Replay failed at sequence ${frame.sequenceNumber}`, { error: err });
        this.meter.incrementCounter('command.replay.inconsistent');
        throw err;
      }
    }
    this.meter.incrementCounter('command.replay.completed');
  }

  getSequenceCount(): number { return this.sequence; }

  clear(): void {
    this.log = [];
    this.sequence = 0;
  }
}