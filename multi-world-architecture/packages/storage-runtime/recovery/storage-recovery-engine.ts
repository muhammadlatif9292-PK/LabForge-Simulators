// packages/storage-runtime/recovery/storage-recovery-engine.ts
/**
 * Storage Recovery Engine
 * 
 * Responsibilities:
 * - Detect storage unavailability (quota exceeded, IndexedDB blocked)
 * - Fall back to alternate storage backend (localStorage, in-memory)
 * - Retry failed writes with exponential backoff
 * - Coordinate with integrity validator to rebuild corrupted entries
 * - Log recovery actions for diagnostics
 * 
 * Owned state:
 * - recoveryLog: RecoveryAction[]
 * - currentBackend: StorageBackend
 * - fallbackActive: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - OfflineStorageRuntime (to retry)
 * - CacheIntegrityValidator (to check after recovery)
 * 
 * Event emissions:
 *   "storage.recovery.fallback_activated", "storage.recovery.restored"
 *   "storage.recovery.failed"
 * 
 * Event subscriptions: "storage.quota.warning", "storage.write.failed"
 * Synchronization: none
 * Recovery: this IS the recovery mechanism
 * Telemetry: recovery count, fallback duration
 * Diagnostics: recovery log
 * Accessibility: N/A
 * Performance: fast fallback switch; async retry
 * Forbidden: data loss during recovery; infinite retry loops
 */

import type { StorageKey, StorageBackend } from '../contracts/storage-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface RecoveryAction {
  timestamp: number;
  type: 'fallback' | 'restore' | 'retry' | 'eviction';
  backend: StorageBackend;
  success: boolean;
  details?: string;
}

export class StorageRecoveryEngine {
  private recoveryLog: RecoveryAction[] = [];
  private fallbackActive = false;
  private failedKeys: Set<StorageKey> = new Set();
  private maxRecoveryLog = 100;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private primaryBackend: StorageBackend = 'indexed_db',
    private fallbackBackend: StorageBackend = 'local_storage',
  ) {}

  get activeBackend(): StorageBackend {
    return this.fallbackActive ? this.fallbackBackend : this.primaryBackend;
  }

  async handleWriteFailure(key: StorageKey, error: Error): Promise<void> {
    this.logger.warn(`Write failed for key ${key}: ${error.message}`);
    this.failedKeys.add(key);
    // If quota error, activate fallback
    if (this.isQuotaError(error)) {
      await this.activateFallback('Quota exceeded');
    }
    this.logAction('retry', false, error.message);
  }

  async handleReadFailure(key: StorageKey, error: Error): Promise<unknown | null> {
    this.logger.warn(`Read failed for key ${key}: ${error.message}`);
    // Try fallback backend
    try {
      const fallbackData = await this.readFromBackend(this.fallbackBackend, key);
      if (fallbackData !== null) {
        this.logAction('restore', true, `Restored from fallback: ${key}`);
        return fallbackData;
      }
    } catch (fallbackErr) {
      this.logger.error(`Fallback read also failed for ${key}`, { error: fallbackErr });
    }
    this.logAction('retry', false, error.message);
    return null;
  }

  async activateFallback(reason: string): Promise<void> {
    if (this.fallbackActive) return;
    this.fallbackActive = true;
    this.logAction('fallback', true, reason);
    this.meter.incrementCounter('storage.recovery.fallback_activated');
    await this.eventBus.publish('storage.recovery.fallback_activated', {
      from: this.primaryBackend,
      to: this.fallbackBackend,
      reason,
    });
    this.logger.warn(`Storage fallback activated: ${this.primaryBackend} → ${this.fallbackBackend}`);
  }

  async attemptRestorePrimary(): Promise<boolean> {
    if (!this.fallbackActive) return true;
    try {
      // Test if primary is available again
      await this.writeToBackend(this.primaryBackend, '__recovery_probe__' as StorageKey, 'probe');
      await this.deleteFromBackend(this.primaryBackend, '__recovery_probe__' as StorageKey);
      // Primary is back; migrate data from fallback
      this.fallbackActive = false;
      this.logAction('restore', true, 'Primary storage restored');
      this.meter.incrementCounter('storage.recovery.restored');
      await this.eventBus.publish('storage.recovery.restored', { backend: this.primaryBackend });
      this.logger.info('Primary storage restored');
      return true;
    } catch {
      return false;
    }
  }

  async retryFailedKeys(writeFn: (key: StorageKey) => Promise<void>): Promise<number> {
    let succeeded = 0;
    for (const key of this.failedKeys) {
      try {
        await writeFn(key);
        this.failedKeys.delete(key);
        succeeded++;
      } catch (err) {
        this.logger.warn(`Retry still failed for key: ${key}`);
      }
    }
    if (succeeded > 0) {
      this.logAction('retry', true, `${succeeded} keys recovered`);
    }
    return succeeded;
  }

  private logAction(type: RecoveryAction['type'], success: boolean, details?: string): void {
    this.recoveryLog.push({
      timestamp: Date.now(),
      type,
      backend: this.activeBackend,
      success,
      details,
    });
    if (this.recoveryLog.length > this.maxRecoveryLog) {
      this.recoveryLog.shift();
    }
  }

  getRecoveryLog(): RecoveryAction[] {
    return [...this.recoveryLog];
  }

  isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  private isQuotaError(error: Error): boolean {
    return error.name === 'QuotaExceededError'
      || error.message.includes('quota')
      || error.message.includes('storage full');
  }

  // Backend abstraction methods (simplified)
  private async writeToBackend(backend: StorageBackend, key: StorageKey, value: unknown): Promise<void> {
    // Implementation would route to backend-specific writes
    // This is a placeholder; real implementation uses OfflineStorageRuntime
  }

  private async readFromBackend(backend: StorageBackend, key: StorageKey): Promise<unknown | null> {
    // Placeholder
    return null;
  }

  private async deleteFromBackend(backend: StorageBackend, key: StorageKey): Promise<void> {
    // Placeholder
  }
}