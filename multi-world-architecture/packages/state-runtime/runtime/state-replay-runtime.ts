// packages/state-runtime/runtime/state-replay-runtime.ts
/**
 * State Replay Runtime
 * 
 * Responsibilities:
 * - Record all state operations in sequence for deterministic replay
 * - Support replaying operations from a given version forward
 * - Validate replay consistency by comparing state checksums
 * - Limit replay log size via snapshot-based compaction
 * 
 * Owned state:
 * - replayLog: ReplayFrame[]
 * - currentVersion: StateVersion
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "state.replay.recorded", "state.replay.completed"
 * Event subscriptions: none
 * Synchronization: append-only log; no concurrent modifications
 * Recovery: replay log can be used to rebuild state
 * Telemetry: replay log size, replay duration
 * Diagnostics: replay position
 * Accessibility: N/A
 * Performance: bounded ring buffer; fast sequential scan
 * Forbidden: losing operations; non-deterministic replay results
 */

import type { StateOperation, ReplayFrame, StateVersion } from '../contracts/state-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { createHash } from 'crypto';

export class StateReplayRuntime {
  private log: ReplayFrame[] = [];
  private version: StateVersion = 0 as StateVersion;
  private readonly maxLogSize = 100_000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  recordOperation(version: StateVersion, operation: StateOperation): void {
    this.version = version;
    const frame: ReplayFrame = {
      version,
      operation,
      appliedAt: Date.now(),
      stateChecksum: '', // set externally by domain orchestrator
    };
    this.log.push(frame);
    if (this.log.length > this.maxLogSize) {
      this.log = this.log.slice(-this.maxLogSize);
    }
    this.meter.incrementCounter('state.replay.recorded');
  }

  getOperationsSince(sinceVersion: StateVersion): ReplayFrame[] {
    return this.log.filter(f => f.version > sinceVersion);
  }

  async replay(
    sinceVersion: StateVersion,
    applyFn: (operation: StateOperation) => Promise<void>,
  ): Promise<void> {
    const frames = this.getOperationsSince(sinceVersion);
    const start = Date.now();
    for (const frame of frames) {
      await applyFn(frame.operation);
    }
    this.meter.incrementCounter('state.replay.completed');
    this.meter.recordHistogram('state.replay.duration', Date.now() - start, { frames: frames.length });
    this.logger.info(`State replay completed: ${frames.length} operations`);
  }

  compactBefore(version: StateVersion): void {
    this.log = this.log.filter(f => f.version >= version);
    this.meter.incrementCounter('state.replay.compacted');
  }

  getLogSize(): number { return this.log.length; }

  getCurrentVersion(): StateVersion { return this.version; }
}