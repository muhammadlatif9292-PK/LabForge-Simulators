// apps/web/src/app-shell/recovery/frontend-recovery-runtime.ts
/**
 * Frontend Recovery Runtime
 * 
 * Responsibilities:
 * - Save the current app shell state as a periodic checkpoint
 * - On crash or reload, restore from the last valid checkpoint
 * - Detect corrupted checkpoints (checksum) and fall back to clean boot
 * - Provide error boundary fallback UI
 * - Emit recovery events for observability
 * 
 * Owned state:
 * - lastCheckpoint: RecoveryCheckpoint | null
 * - saveInterval: NodeJS.Timeout | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - OfflineStorageRuntime (for persistence)
 * - DistributedEventBus
 * 
 * Event emissions:
 *   "app.recovery.checkpoint.saved", "app.recovery.restored"
 *   "app.recovery.corrupted"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded save/load
 * Recovery: self-healing
 * Telemetry: checkpoint size, save frequency, restore count
 * Diagnostics: last saved timestamp, checkpoint status
 * Accessibility: recovery UI announces status to screen readers
 * Performance: async save; debounced writes
 * Forbidden: overwriting valid checkpoint with corrupted one; infinite recovery loops
 */

import type { AppShellState, RecoveryCheckpoint } from '../contracts/app-shell-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { OfflineStorageRuntime } from '@labforge/storage-runtime';
import { createHash } from 'crypto';

export class FrontendRecoveryRuntime {
  private lastCheckpoint: RecoveryCheckpoint | null = null;
  private saveInterval: any = null;
  private readonly CHECKPOINT_KEY = 'app_shell_checkpoint' as any;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private storage: OfflineStorageRuntime,
  ) {
    // Periodic autosave every 30 seconds
    this.saveInterval = setInterval(() => {
      if (this.lastCheckpoint) this.saveCheckpoint(this.lastCheckpoint);
    }, 30000);
  }

  async saveCheckpoint(state: AppShellState): Promise<void> {
    const checkpoint: RecoveryCheckpoint = {
      appState: state,
      timestamp: Date.now(),
      checksum: '',
    };
    const json = JSON.stringify(checkpoint);
    const hash = createHash('sha256').update(json).digest('hex');
    checkpoint.checksum = hash;
    await this.storage.set(this.CHECKPOINT_KEY, checkpoint);
    this.lastCheckpoint = checkpoint;
    this.meter.incrementCounter('app.recovery.checkpoint.saved');
    this.logger.debug('App shell checkpoint saved');
  }

  async loadCheckpoint(): Promise<RecoveryCheckpoint | null> {
    const raw = await this.storage.get<RecoveryCheckpoint>(this.CHECKPOINT_KEY);
    if (!raw) return null;
    try {
      const json = JSON.stringify({ ...raw, checksum: '' });
      const hash = createHash('sha256').update(json).digest('hex');
      if (hash !== raw.checksum) {
        this.logger.error('Checkpoint checksum mismatch');
        this.meter.incrementCounter('app.recovery.corrupted');
        await this.eventBus.publish('app.recovery.corrupted', {});
        return null;
      }
      this.lastCheckpoint = raw;
      this.meter.incrementCounter('app.recovery.restored');
      this.logger.info('App shell checkpoint restored');
      return raw;
    } catch (err) {
      this.logger.error('Failed to deserialise checkpoint', { error: err });
      return null;
    }
  }

  async attemptRecovery(state: AppShellState): Promise<void> {
    this.logger.warn('Recovery attempt: reloading from last known good state');
    const checkpoint = await this.loadCheckpoint();
    if (checkpoint) {
      Object.assign(state, checkpoint.appState);
      this.eventBus.publish('app.recovery.restored', {});
    } else {
      // Clean boot fallback
      state.uiState = 'loading';
      this.eventBus.publish('app.recovery.fallback_clean_boot', {});
    }
  }

  async clearCheckpoint(): Promise<void> {
    await this.storage.delete(this.CHECKPOINT_KEY);
    this.lastCheckpoint = null;
  }

  shutdown(): void {
    if (this.saveInterval) clearInterval(this.saveInterval);
  }
}