// packages/automation-engine/recovery/automation-recovery-engine.ts
/**
 * Automation Recovery Engine
 * 
 * Responsibilities:
 * - Persist workflow definitions, active instances, and scheduled tasks
 * - Restore automation state on restart
 * - Detect and recover from interrupted workflow executions
 * - Validate recovered state integrity
 * - Support snapshot-based recovery for fast restoration
 * 
 * Owned state: none (uses external storage)
 * 
 * Dependencies: ILogger, IMeter, persistent storage adapter
 * 
 * Event emissions: "automation.recovery.saved", "automation.recovery.restored"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: this IS the recovery mechanism
 * Telemetry: save/restore duration, snapshot size
 * Diagnostics: last saved timestamp
 * Accessibility: N/A
 * Performance: async writes; batch saves
 * Forbidden: losing running instance state; restoring corrupted snapshots
 */

import type { WorkflowInstance, ScheduledTask, AutomationSnapshot } from '../contracts/automation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { createHash } from 'crypto';

export class AutomationRecoveryEngine {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any,
  ) {}

  async saveRunningInstances(instances: WorkflowInstance[]): Promise<void> {
    const start = Date.now();
    const serializable = instances.map(i => ({
      ...i,
      stepResults: Array.from(i.stepResults.entries()),
    }));
    await this.storage.set('automation_instances', JSON.stringify(serializable));
    this.meter.recordHistogram('automation.recovery.save.duration', Date.now() - start);
    this.meter.incrementCounter('automation.recovery.saved');
  }

  async loadRunningInstances(): Promise<WorkflowInstance[]> {
    const raw = await this.storage.get('automation_instances');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const instances: WorkflowInstance[] = parsed.map((i: any) => ({
        ...i,
        stepResults: new Map(i.stepResults),
      }));
      this.meter.incrementCounter('automation.recovery.restored');
      this.logger.info(`Restored ${instances.length} workflow instances`);
      return instances;
    } catch (err) {
      this.logger.error('Failed to load automation instances', { error: err });
      return [];
    }
  }

  async saveScheduledTasks(tasks: ScheduledTask[]): Promise<void> {
    await this.storage.set('automation_schedules', JSON.stringify(tasks));
    this.logger.debug(`${tasks.length} scheduled tasks saved`);
  }

  async loadScheduledTasks(): Promise<ScheduledTask[]> {
    const raw = await this.storage.get('automation_schedules');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (err) {
      this.logger.error('Failed to load scheduled tasks', { error: err });
      return [];
    }
  }

  async saveSnapshot(snapshot: AutomationSnapshot): Promise<void> {
    const json = JSON.stringify(snapshot);
    const hash = createHash('sha256').update(json).digest('hex');
    snapshot.checksum = hash;
    await this.storage.set('automation_snapshot', JSON.stringify(snapshot));
    this.logger.info('Automation snapshot saved');
  }

  async loadSnapshot(): Promise<AutomationSnapshot | null> {
    const raw = await this.storage.get('automation_snapshot');
    if (!raw) return null;
    try {
      const snapshot = JSON.parse(raw);
      const json = JSON.stringify({ ...snapshot, checksum: '' });
      const hash = createHash('sha256').update(json).digest('hex');
      if (hash !== snapshot.checksum) {
        this.logger.error('Automation snapshot checksum mismatch');
        return null;
      }
      return snapshot;
    } catch (err) {
      this.logger.error('Failed to load automation snapshot', { error: err });
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.storage.delete('automation_instances');
    await this.storage.delete('automation_schedules');
    await this.storage.delete('automation_snapshot');
  }
}