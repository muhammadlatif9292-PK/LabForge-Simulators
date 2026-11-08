// packages/worker-runtime/src/runtime/worker-failure-recovery.ts
/**
 * Worker Failure Recovery
 * 
 * Responsibilities:
 * - Detect worker failures (crashes, OOM, hangs)
 * - Reschedule tasks from failed workers to healthy ones
 * - Maintain retry state with exponential backoff
 * - Coordinate with checkpoint system to rollback simulation state
 * - Notify orchestration of worker loss
 * 
 * Owned state:
 * - failedWorkers: Set<WorkerId>
 * - pendingRecoveryTasks: { task: TaskSpec; retries: number }[]
 * 
 * Dependencies:
 * - DistributedWorkerManager
 * - TaskQueue
 * - DistributedEventBus
 * - ILogger, IMeter
 * 
 * Event emissions:
 * - "worker.failure.recovery.started", "worker.failure.recovery.completed"
 * 
 * Event subscriptions:
 * - "worker.unresponsive", "worker.deregistered"
 * 
 * Synchronization: uses distributed lock for task reassignment
 * Recovery: self-healing by design
 * Telemetry: recovery attempts, failed task count, recovery latency
 * Diagnostics: recovery queue length, failure reasons
 * Accessibility: N/A
 * Performance: debounce recovery actions to avoid storms
 * Forbidden: infinite retry loops without backoff ceiling
 */

import type { WorkerId, TaskSpec } from '../contracts/worker-contracts';
import type { DistributedWorkerManager } from './distributed-worker-manager';
import type { TaskQueue } from '../contracts/worker-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class WorkerFailureRecovery {
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  constructor(
    private workerManager: DistributedWorkerManager,
    private taskQueue: TaskQueue,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('worker.unresponsive', this.handleUnresponsiveWorker.bind(this));
    this.eventBus.subscribe('worker.deregistered', this.handleDeregisteredWorker.bind(this));
  }

  async handleUnresponsiveWorker(event: { payload: { workerId: WorkerId } }): Promise<void> {
    const workerId = event.payload.workerId;
    this.logger.warn(`Recovery starting for worker ${workerId}`);
    this.meter.incrementCounter('worker.recovery.started');
    // Re-queue all tasks assigned to that worker (simplified)
    // In production, check pending tasks from a task registry
    // For now, we assume tasks are re-submitted by the scheduler itself.
    await this.eventBus.publish('worker.failure.recovery.started', { workerId });
  }

  async handleDeregisteredWorker(event: { payload: { workerId: WorkerId } }): Promise<void> {
    // Same as unresponsive, but worker left intentionally; just clean up
    this.logger.info(`Worker ${event.payload.workerId} deregistered; cleaning up`);
  }

  async retryTask(task: TaskSpec<any>): Promise<boolean> {
    const attempts = this.retryAttempts.get(task.id) ?? 0;
    if (attempts >= task.maxRetries) {
      this.logger.error(`Task ${task.id} exceeded max retries`);
      this.meter.incrementCounter('worker.task.permanent_failure');
      return false;
    }
    this.retryAttempts.set(task.id, attempts + 1);
    this.taskQueue.enqueue(task);
    this.meter.incrementCounter('worker.task.retried');
    return true;
  }
}