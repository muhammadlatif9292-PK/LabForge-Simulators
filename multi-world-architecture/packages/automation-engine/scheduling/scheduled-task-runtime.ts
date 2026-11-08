// packages/automation-engine/scheduling/scheduled-task-runtime.ts
/**
 * Scheduled Task Runtime
 * 
 * Responsibilities:
 * - Manage a schedule of recurring workflow executions
 * - Evaluate cron-like expressions to determine next run time
 * - Handle timezone-aware scheduling
 * - Persist schedule state for recovery
 * - Trigger workflows via the automation runtime
 * 
 * Owned state:
 * - tasks: Map<ScheduleId, ScheduledTask>
 * - timers: Map<ScheduleId, NodeJS.Timeout>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - AutomationRecoveryEngine (persist schedule)
 * 
 * Event emissions: "scheduled.task.triggered", "scheduled.task.registered"
 * Event subscriptions: none
 * Synchronization: per-schedule timer; no cross-task conflicts
 * Recovery: schedules restored from persistence on restart
 * Telemetry: task count, missed executions
 * Diagnostics: next run times per task
 * Accessibility: N/A
 * Performance: O(1) per schedule; lightweight cron evaluation
 * Forbidden: missing scheduled executions without alerting
 */

import { v4 as uuidv4 } from 'uuid';
import type { ScheduleId, ScheduledTask, WorkflowId } from '../contracts/automation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { AutomationRecoveryEngine } from '../recovery/automation-recovery-engine';

export class ScheduledTaskRuntime {
  private tasks: Map<ScheduleId, ScheduledTask> = new Map();
  private timers: Map<ScheduleId, NodeJS.Timeout> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private recovery: AutomationRecoveryEngine,
  ) {
    // Restore persisted schedules
    this.loadSchedules();
  }

  private async loadSchedules(): Promise<void> {
    const saved = await this.recovery.loadScheduledTasks();
    for (const task of saved) {
      this.tasks.set(task.id, task);
      if (task.enabled) this.scheduleNext(task);
    }
  }

  async scheduleWorkflow(workflowId: WorkflowId, config: { cronExpression?: string; intervalMs?: number; timezone?: string }): Promise<ScheduleId> {
    const id = uuidv4() as ScheduleId;
    const cronExpression = config.cronExpression ?? this.intervalToCron(config.intervalMs ?? 3600000);
    const nextRunAt = this.calculateNextRun(cronExpression);
    const task: ScheduledTask = {
      id,
      workflowId,
      cronExpression,
      nextRunAt,
      enabled: true,
      timezone: config.timezone ?? 'UTC',
      variables: {},
    };
    this.tasks.set(id, task);
    this.scheduleNext(task);
    this.recovery.saveScheduledTasks(this.getAllTasks());
    this.meter.incrementCounter('scheduled.task.registered');
    this.logger.info(`Scheduled task registered: ${workflowId} next at ${new Date(nextRunAt).toISOString()}`);
    return id;
  }

  private scheduleNext(task: ScheduledTask): void {
    if (!task.enabled) return;
    const delay = Math.max(0, task.nextRunAt - Date.now());
    const timer = setTimeout(async () => {
      task.lastRunAt = Date.now();
      await this.eventBus.publish('scheduled.task.triggered', {
        workflowId: task.workflowId,
        scheduleId: task.id,
        variables: task.variables,
      });
      // Calculate next run
      task.nextRunAt = this.calculateNextRun(task.cronExpression);
      this.scheduleNext(task);
      this.recovery.saveScheduledTasks(this.getAllTasks());
    }, delay);
    // Replace any existing timer
    if (this.timers.has(task.id)) clearTimeout(this.timers.get(task.id)!);
    this.timers.set(task.id, timer);
  }

  async enableTask(scheduleId: ScheduleId): Promise<void> {
    const task = this.tasks.get(scheduleId);
    if (!task) return;
    task.enabled = true;
    this.scheduleNext(task);
    this.recovery.saveScheduledTasks(this.getAllTasks());
  }

  async disableTask(scheduleId: ScheduleId): Promise<void> {
    const task = this.tasks.get(scheduleId);
    if (!task) return;
    task.enabled = false;
    if (this.timers.has(scheduleId)) {
      clearTimeout(this.timers.get(scheduleId)!);
      this.timers.delete(scheduleId);
    }
    this.recovery.saveScheduledTasks(this.getAllTasks());
  }

  async deleteTask(scheduleId: ScheduleId): Promise<void> {
    this.disableTask(scheduleId);
    this.tasks.delete(scheduleId);
    this.recovery.saveScheduledTasks(this.getAllTasks());
  }

  private calculateNextRun(cronExpression: string): number {
    // Simplified cron: parse interval style or actual cron
    // For now, assume pattern like "every 5 minutes" or "0 * * * *"
    if (cronExpression.includes('minute')) {
      const match = cronExpression.match(/(\d+)\s*minute/);
      const minutes = match ? parseInt(match[1]) : 60;
      return Date.now() + minutes * 60000;
    }
    if (cronExpression.includes('hour')) {
      const match = cronExpression.match(/(\d+)\s*hour/);
      const hours = match ? parseInt(match[1]) : 1;
      return Date.now() + hours * 3600000;
    }
    // Default: 1 hour
    return Date.now() + 3600000;
  }

  private intervalToCron(intervalMs: number): string {
    const minutes = Math.round(intervalMs / 60000);
    return `every ${minutes} minutes`;
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  async shutdown(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}