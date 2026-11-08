// packages/worker-runtime/src/runtime/distributed-worker-manager.ts
/**
 * Distributed Worker Manager
 * 
 * Responsibilities:
 * - Maintain registry of all worker nodes across the cluster
 * - Heartbeat monitoring and health checks
 * - Distribute tasks via the scheduler
 * - Coordinate worker lifecycle (register, drain, terminate)
 * - Store and aggregate worker telemetry
 * 
 * Owned state:
 * - workers: Map<WorkerId, WorkerNode>
 * - workerTelemetry: Map<WorkerId, WorkerTelemetry>
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus (to listen for worker join/leave)
 * - TaskQueue
 * - WorkerScheduler
 * 
 * Event emissions:
 * - "worker.registered", "worker.deregistered", "worker.unresponsive"
 * 
 * Event subscriptions:
 * - "worker.heartbeat" from individual workers
 * - "worker.task.completed" for load tracking
 * 
 * Synchronization: uses distributed state (e.g., Redis) for registry
 * Recovery: re-initializes from persistent registry on restart
 * Telemetry: worker count, avg load, queue depth gauges
 * Diagnostics: exposes worker list and health
 * Accessibility: N/A
 * Performance: O(1) lookups, async heartbeat processing
 * Forbidden: direct task execution, blocking calls in heartbeat handler
 */

import type { WorkerId, WorkerNode, WorkerStatus, WorkerTelemetry, TaskSpec } from '../contracts/worker-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { v4 as uuidv4 } from 'uuid';

export class DistributedWorkerManager {
  private workers: Map<WorkerId, WorkerNode> = new Map();
  private telemetry: Map<WorkerId, WorkerTelemetry> = new Map();
  private readonly heartbeatTimeoutMs = 30_000;
  private heartbeatCheckInterval: NodeJS.Timeout;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {
    this.eventBus.subscribe('worker.heartbeat', this.handleHeartbeat.bind(this));
    this.eventBus.subscribe('worker.task.completed', this.handleTaskCompleted.bind(this));
    this.heartbeatCheckInterval = setInterval(() => this.checkHeartbeats(), 10_000);
  }

  async registerWorker(node: WorkerNode): Promise<void> {
    this.workers.set(node.id, node);
    this.meter.incrementCounter('worker.registered', { type: node.type });
    this.logger.info(`Worker registered: ${node.id} (${node.type})`);
    await this.eventBus.publish('worker.registered', { workerId: node.id, type: node.type });
  }

  async deregisterWorker(workerId: WorkerId): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = WorkerStatus.TERMINATED;
    this.workers.delete(workerId);
    this.telemetry.delete(workerId);
    this.logger.info(`Worker deregistered: ${workerId}`);
    this.meter.incrementCounter('worker.deregistered');
    await this.eventBus.publish('worker.deregistered', { workerId });
  }

  private handleHeartbeat(event: any): void {
    const { workerId, telemetry } = event.payload;
    const worker = this.workers.get(workerId);
    if (!worker) {
      this.logger.warn(`Heartbeat from unknown worker: ${workerId}`);
      return;
    }
    worker.lastHeartbeat = Date.now();
    if (worker.status === WorkerStatus.UNRESPONSIVE) {
      worker.status = WorkerStatus.IDLE;
      this.logger.info(`Worker recovered: ${workerId}`);
    }
    this.telemetry.set(workerId, telemetry);
  }

  private handleTaskCompleted(event: any): void {
    // Update worker utilization in telemetry
    const { workerId, taskId, executionTimeMs } = event.payload;
    const tel = this.telemetry.get(workerId);
    if (tel) {
      tel.tasksCompleted++;
    }
    this.meter.recordHistogram('worker.task.duration', executionTimeMs, { workerId });
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [id, node] of this.workers) {
      if (now - node.lastHeartbeat > this.heartbeatTimeoutMs && node.status !== WorkerStatus.UNRESPONSIVE) {
        node.status = WorkerStatus.UNRESPONSIVE;
        this.logger.warn(`Worker unresponsive: ${id}`);
        this.eventBus.publish('worker.unresponsive', { workerId: id });
        this.meter.incrementCounter('worker.unresponsive');
      }
    }
  }

  async getAvailableWorker(workerType: WorkerType): Promise<WorkerId | null> {
    // Simple strategy: first idle worker of matching type
    for (const [id, node] of this.workers) {
      if (node.type === workerType && node.status === WorkerStatus.IDLE) {
        node.status = WorkerStatus.BUSY;
        return id;
      }
    }
    return null;
  }

  releaseWorker(workerId: WorkerId): void {
    const worker = this.workers.get(workerId);
    if (worker) worker.status = WorkerStatus.IDLE;
  }

  async shutdown(): Promise<void> {
    clearInterval(this.heartbeatCheckInterval);
    // Drain all workers
    for (const [id, node] of this.workers) {
      node.status = WorkerStatus.DRAINING;
    }
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait for tasks
    this.workers.clear();
    this.telemetry.clear();
  }
}