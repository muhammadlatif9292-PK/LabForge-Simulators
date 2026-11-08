// infrastructure/database/src/runtime/replay-restoration-runtime.ts
/**
 * Replay Restoration Runtime
 * 
 * Responsibilities:
 * - Coordinate the restoration of state from snapshots and subsequent events
 * - Provide a simple API for applying replay to a projector function
 * - Validate restored state integrity
 * 
 * Dependencies:
 * - ReplayRestorationEngine (from replay/)
 * - ILogger, IMeter
 */

import { ReplayRestorationEngine } from '../replay/replay-restoration-engine';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class ReplayRestorationRuntime {
  private engine: ReplayRestorationEngine;

  constructor(
    logger: ILogger,
    meter: IMeter,
    snapshotEngine: any,
    streamReader: any,
  ) {
    this.engine = new ReplayRestorationEngine(logger, meter, snapshotEngine, streamReader);
  }

  async restoreStream(streamId: string, projector: (snapshot: any, events: any[]) => any) {
    return this.engine.restoreStream(streamId as any, projector);
  }
}