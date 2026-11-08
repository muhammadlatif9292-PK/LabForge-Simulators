// packages/experiment-runtime/recovery/experiment-recovery-engine.ts
/**
 * Experiment Recovery Engine
 * 
 * Responsibilities:
 * - Detect and recover from experiment corruption or crash
 * - Load the latest valid snapshot on startup
 * - Validate snapshot integrity before restoration
 * - Track recovery history for diagnostics
 * - Coordinate with autosave runtime for continuous protection
 * 
 * Owned state:
 * - recoveryLog: RecoveryAttempt[]
 * 
 * Dependencies: ILogger, IMeter, storage adapter, ExperimentSerializer
 * 
 * Event emissions:
 *   "experiment.recovery.started", "experiment.recovery.completed",
 *   "experiment.recovery.failed"
 * 
 * Event subscriptions: none
 * Synchronization: per-experiment recovery; no cross-experiment coordination
 * Recovery: this IS the recovery mechanism
 * Telemetry: recovery attempts, success rate, recovery duration
 * Diagnostics: last recovery status, corrupted snapshot IDs
 * Accessibility: N/A
 * Performance: loads latest snapshot only; avoids full history scan
 * Forbidden: restoring corrupted snapshots; overwriting valid data
 */

import type { ExperimentId, ExperimentSession } from '../contracts/experiment-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { ExperimentSerializer } from '../serialization/experiment-serializer';

interface RecoveryAttempt {
  timestamp: number;
  snapshotId: string | null;
  success: boolean;
  error?: string;
}

export class ExperimentRecoveryEngine {
  private recoveryLog: RecoveryAttempt[] = [];
  private readonly maxRecoveryLog = 50;

  constructor(
    private experimentId: ExperimentId,
    private logger: ILogger,
    private meter: IMeter,
    private storage: any,
    private serializer: ExperimentSerializer,
  ) {}

  async restore(): Promise<ExperimentSession | null> {
    const start = Date.now();
    this.meter.incrementCounter('experiment.recovery.started');
    this.logger.info(`Recovery started for experiment ${this.experimentId}`);
    let snapshotId: string | null = null;
    try {
      // Load autosave index
      const indexRaw = await this.storage.get('autosave_index');
      if (!indexRaw) {
        this.logger.warn('No autosave index found');
        this.logAttempt(null, false, 'No autosave index');
        return null;
      }
      const index: { id: string; timestamp: number; branchId: string }[] = JSON.parse(indexRaw);
      if (index.length === 0) {
        this.logAttempt(null, false, 'Empty autosave index');
        return null;
      }
      // Try latest first, then fall back
      const sorted = index.sort((a, b) => b.timestamp - a.timestamp);
      for (const entry of sorted) {
        snapshotId = entry.id;
        const raw = await this.storage.get(`experiment_snapshot:${snapshotId}`);
        if (!raw) continue;
        let json: string;
        if (raw.compressed) {
          json = await this.serializer.decompress(new Uint8Array(raw.data));
        } else {
          json = typeof raw.data === 'string' ? raw.data : new TextDecoder().decode(new Uint8Array(raw.data));
        }
        // Validate checksum
        const checksum = await this.serializer.computeChecksum(json);
        if (raw.checksum && checksum !== raw.checksum) {
          this.logger.warn(`Checksum mismatch for snapshot ${snapshotId}, trying earlier`);
          continue;
        }
        const session = await this.serializer.deserialize(json);
        if (session) {
          const duration = Date.now() - start;
          this.meter.recordHistogram('experiment.recovery.duration', duration);
          this.meter.incrementCounter('experiment.recovery.completed');
          this.logAttempt(snapshotId, true);
          this.logger.info(`Recovery successful from snapshot ${snapshotId} in ${duration}ms`);
          return session;
        }
      }
      this.logAttempt(null, false, 'All snapshots invalid');
      this.meter.incrementCounter('experiment.recovery.failed');
      return null;
    } catch (err) {
      const message = (err as Error).message;
      this.logAttempt(snapshotId, false, message);
      this.meter.incrementCounter('experiment.recovery.failed');
      this.logger.error('Recovery failed', { error: err });
      return null;
    }
  }

  private logAttempt(snapshotId: string | null, success: boolean, error?: string): void {
    this.recoveryLog.push({
      timestamp: Date.now(),
      snapshotId,
      success,
      error,
    });
    if (this.recoveryLog.length > this.maxRecoveryLog) {
      this.recoveryLog.shift();
    }
  }

  getRecoveryLog(): RecoveryAttempt[] {
    return [...this.recoveryLog];
  }

  getLastRecovery(): RecoveryAttempt | undefined {
    return this.recoveryLog.length > 0 ? this.recoveryLog[this.recoveryLog.length - 1] : undefined;
  }
}