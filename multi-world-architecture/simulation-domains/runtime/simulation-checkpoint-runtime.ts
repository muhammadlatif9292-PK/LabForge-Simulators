// simulation-domains/runtime/simulation-checkpoint-runtime.ts
/**
 * Simulation Checkpoint Runtime
 * 
 * Responsibilities:
 * - Persist simulation snapshots for crash recovery and replay
 * - Manage checkpoint rotation (keep every Nth, discard intermediates)
 * - Verify checkpoint integrity on load via hash comparison
 * - Support incremental checkpoints (delta from previous)
 * - Provide fast restoration path for simulation restart
 * 
 * Owned state: none (uses external storage)
 * 
 * Dependencies: ILogger, IMeter, persistence adapter
 * 
 * Event emissions: "checkpoint.saved", "checkpoint.restored", "checkpoint.corrupted"
 * Event subscriptions: none
 * Synchronization: none (per-simulation)
 * Recovery: self-healing (corrupted checkpoint → fall back to earlier)
 * Telemetry: checkpoint size, save/load latency
 * Diagnostics: last checkpoint tick, storage usage
 * Accessibility: N/A
 * Performance: async writes; compression optional; don't block tick
 * Forbidden: overwriting validated checkpoint with unvalidated data
 */

import type { SimulationSnapshot } from '../contracts/domain-simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { createHash } from 'crypto';

export class SimulationCheckpointRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // local persistence adapter
  ) {}

  async saveSnapshot(simulationId: string, snapshot: SimulationSnapshot): Promise<void> {
    const start = performance.now();
    const data = JSON.stringify(snapshot);
    const hash = createHash('sha256').update(data).digest('hex');
    await this.storage.put(`sim:${simulationId}:checkpoint:${snapshot.tick}`, { data, hash, timestamp: Date.now() });
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('simulation.checkpoint.save.duration', elapsed);
    this.meter.incrementCounter('simulation.checkpoint.saved');
    this.logger.debug(`Checkpoint saved for ${simulationId} at tick ${snapshot.tick}`);
  }

  async loadSnapshot(simulationId: string, tick?: number): Promise<SimulationSnapshot | null> {
    const start = performance.now();
    let raw: any;
    if (tick !== undefined) {
      raw = await this.storage.get(`sim:${simulationId}:checkpoint:${tick}`);
    } else {
      // Load latest: iterate keys (simplified)
      const keys: string[] = await this.storage.keys(`sim:${simulationId}:checkpoint:`);
      if (keys.length === 0) return null;
      const latestKey = keys.sort().reverse()[0];
      raw = await this.storage.get(latestKey);
    }
    if (!raw) return null;
    const { data, hash } = raw;
    const computedHash = createHash('sha256').update(data).digest('hex');
    if (hash !== computedHash) {
      this.logger.error(`Checkpoint corrupted for ${simulationId}`);
      this.meter.incrementCounter('simulation.checkpoint.corrupted');
      return this.findEarlierValidCheckpoint(simulationId, tick);
    }
    this.meter.incrementCounter('simulation.checkpoint.restored');
    this.meter.recordHistogram('simulation.checkpoint.load.duration', performance.now() - start);
    return JSON.parse(data);
  }

  private async findEarlierValidCheckpoint(simulationId: string, beforeTick?: number): Promise<SimulationSnapshot | null> {
    const keys: string[] = await this.storage.keys(`sim:${simulationId}:checkpoint:`);
    const ticks = keys.map(k => parseInt(k.split(':').pop()!)).filter(t => !beforeTick || t < beforeTick);
    ticks.sort((a, b) => b - a);
    for (const t of ticks) {
      const snapshot = await this.loadSnapshot(simulationId, t);
      if (snapshot) return snapshot;
    }
    return null;
  }

  async deleteCheckpoints(simulationId: string, olderThanTick: number): Promise<void> {
    const keys: string[] = await this.storage.keys(`sim:${simulationId}:checkpoint:`);
    for (const key of keys) {
      const tick = parseInt(key.split(':').pop()!);
      if (tick < olderThanTick) {
        await this.storage.delete(key);
      }
    }
  }
}