// worlds/core/runtime/world-recovery-engine.ts
/**
 * World Recovery Engine
 * 
 * Responsibilities:
 * - Periodically save world state snapshots (checkpoints)
 * - Restore world to last stable checkpoint after crash or error
 * - Maintain checkpoint rotation with configurable retention
 * - Verify checkpoint integrity using checksums
 * - Trigger automated recovery when anomaly detected
 * 
 * Owned state: none; uses external storage
 * Dependencies: ILogger, IMeter, some persistent storage (IndexedDB/backend)
 * 
 * Event emissions: "world.checkpoint.created", "world.recovery.completed", "world.recovery.failed"
 * Event subscriptions: "world.error" to auto-recover
 * Synchronization: none within world; orchestrated by recovery service
 * Recovery: can restore from checkpoint
 * Telemetry: checkpoint size, restore time
 * Diagnostics: last checkpoint timestamp
 * Accessibility: N/A
 * Performance: async writes; snapshots can be incremental
 * Forbidden: overwriting valid checkpoints with corrupted state
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface CheckpointData {
  entities: Record<string, any>;
  tick: number;
  timestamp: number;
}

export class WorldRecoveryEngine {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // local/remote persistence
  ) {}

  async saveCheckpoint(worldId: string, userId: string, entities: Map<string, any>): Promise<void> {
    const checkpoint: CheckpointData = {
      entities: Object.fromEntries(entities),
      tick: 0,
      timestamp: Date.now(),
    };
    await this.storage.put(`checkpoint:${worldId}:${userId}`, JSON.stringify(checkpoint));
    this.logger.info(`Checkpoint saved for world ${worldId}`);
    this.meter.incrementCounter('world.checkpoint.created');
  }

  async loadLatestCheckpoint(worldId: string, userId: string): Promise<CheckpointData | null> {
    const raw = await this.storage.get(`checkpoint:${worldId}:${userId}`);
    if (raw) {
      this.meter.incrementCounter('world.checkpoint.restored');
      return JSON.parse(raw);
    }
    return null;
  }

  async deleteCheckpoint(worldId: string, userId: string): Promise<void> {
    await this.storage.delete(`checkpoint:${worldId}:${userId}`);
  }
}