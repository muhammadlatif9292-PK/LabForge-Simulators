// infrastructure/database/src/runtime/database-corruption-recovery.ts
/**
 * Database Corruption Recovery
 * 
 * Responsibilities:
 * - Top-level runtime for detecting and repairing database corruption
 * - Utilises the lower-level DatabaseCorruptionRecovery engine
 * - Schedules periodic integrity checks
 * 
 * Dependencies:
 * - DatabaseCorruptionRecovery (from recovery/)
 * - ILogger, IMeter
 */

import { DatabaseCorruptionRecovery as LowLevelRecovery } from '../recovery/database-corruption-recovery';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class DatabaseCorruptionRecovery {
  private engine: LowLevelRecovery;

  constructor(
    logger: ILogger,
    meter: IMeter,
    snapshotEngine: any,
    streamReader: any,
    streamWriter: any,
  ) {
    this.engine = new LowLevelRecovery(logger, meter, snapshotEngine, streamReader, streamWriter);
  }

  async checkIntegrity(streamId: string): Promise<boolean> {
    return this.engine.checkStreamIntegrity(streamId as any);
  }

  async repair(streamId: string): Promise<void> {
    return this.engine.repairCorruptedStream(streamId as any);
  }

  async detectAndRepairAll(): Promise<void> {
    return this.engine.detectAndRepairAll();
  }
}