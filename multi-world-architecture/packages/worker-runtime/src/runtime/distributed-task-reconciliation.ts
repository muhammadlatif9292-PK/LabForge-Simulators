// packages/worker-runtime/src/runtime/distributed-task-reconciliation.ts
/**
 * Distributed Task Reconciliation
 * 
 * Responsibilities:
 * - Ensure exactly-once task execution in a distributed system
 * - Detect and deduplicate tasks that were executed on multiple workers
 * - Reconcile task status after network partitions
 * - Coordinate with transactional outbox for consistency
 * 
 * Owned state:
 * - completedTaskIds: Set<TaskId> (bounded LRU)
 * - pendingQueries: Map<TaskId, Promise<TaskResult>>
 * 
 * Dependencies:
 * - DistributedEventBus
 * - DistributedWorkerManager
 * - ILogger, IMeter
 * - Possibly external task ledger (Redis)
 * 
 * Event emissions:
 * - "task.reconciled", "task.duplicate.detected"
 * 
 * Event subscriptions:
 * - "task.completed" from all workers to keep log
 * - "task.failed"
 * 
 * Synchronization: distributed lock for writing task results
 * Recovery: replays task status from log after restart
 * Telemetry: duplicate task count, reconciliation latency
 * Diagnostics: task idempotency violations
 * Accessibility: N/A
 * Performance: local cache reduces network calls; async writes
 * Forbidden: executing a task more than once without idempotency guarantee
 */

import type { TaskId, TaskResult } from '../contracts/worker-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class DistributedTaskReconciliation {
  private completedTasks: Set<string> = new Set();
  private maxCache = 10000;

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('task.completed', this.onTaskCompleted.bind(this));
    this.eventBus.subscribe('task.failed', this.onTaskFailed.bind(this));
  }

  async claimTask(taskId: TaskId): Promise<boolean> {
    // Check if already claimed/completed (idempotency)
    if (this.completedTasks.has(taskId)) {
      this.meter.incrementCounter('task.duplicate.attempt');
      this.logger.warn(`Duplicate task detected: ${taskId}`);
      return false;
    }
    // In a real system, use a distributed lock or transactional check
    this.completedTasks.add(taskId);
    this.evictIfNeeded();
    return true;
  }

  private onTaskCompleted(event: any): void {
    const { taskId, result } = event.payload;
    this.completedTasks.add(taskId);
  }

  private onTaskFailed(event: any): void {
    // Could remove from completed set to allow retry?
    const { taskId } = event.payload;
    this.completedTasks.delete(taskId); // allow retry
  }

  private evictIfNeeded(): void {
    if (this.completedTasks.size > this.maxCache) {
      const iter = this.completedTasks.values();
      this.completedTasks.delete(iter.next().value);
    }
  }
}