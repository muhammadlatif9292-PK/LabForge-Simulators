// infrastructure/database/src/runtime/snapshot-compaction-runtime.ts
/**
 * Snapshot Compaction Runtime
 * 
 * Responsibilities:
 * - Expose snapshot compaction functionality via a simple runtime API
 * - Schedule periodic compaction for event streams
 * - Generate progress telemetry
 * 
 * Dependencies:
 * - SnapshotCompactionEngine (from snapshots/)
 * - EventStreamReader / Writer
 * - ILogger, IMeter
 */

import { SnapshotCompactionEngine } from '../snapshots/snapshot-compaction-engine';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SnapshotCompactionRuntime {
  private engine: SnapshotCompactionEngine;

  constructor(
    logger: ILogger,
    meter: IMeter,
    db: any,
    eventStreamReader: any,
    eventStreamWriter: any,
  ) {
    this.engine = new SnapshotCompactionEngine(logger, meter, db, eventStreamReader, eventStreamWriter);
  }

  async compactStream(streamId: string, olderThanSequence: number, stateBuilder: (events: any[]) => any) {
    return this.engine.compactStream(streamId as any, olderThanSequence as any, stateBuilder);
  }

  async getLatestSnapshot(streamId: string) {
    return this.engine.getLatestSnapshot(streamId as any);
  }
}