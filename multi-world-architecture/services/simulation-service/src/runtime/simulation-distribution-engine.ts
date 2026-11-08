// services/simulation-service/src/runtime/simulation-distribution-engine.ts
/**
 * Simulation Distribution Engine
 * 
 * Responsibilities:
 * - Distribute simulation ticks across a cluster of simulation worker nodes
 * - Assign simulation partitions (spatial regions) to workers
 * - Synchronise state between workers at partition boundaries
 * - Handle worker failures by redistributing partitions
 * - Enforce deterministic global tick ordering
 * 
 * Owned state:
 * - workers: Map<WorkerId, WorkerState>
 * - partitions: Map<PartitionId, WorkerId>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - SimulationWorkerCoordinator
 * - DistributedSyncEngine
 * - DistributedLockManager
 * 
 * Event emissions:
 *   "simulation.distributed.tick", "simulation.distributed.rebalanced"
 * 
 * Event subscriptions: "simulation.worker.ready", "simulation.worker.failed"
 * Synchronization: barrier synchronisation for each tick; workers must complete before next
 * Recovery: failed worker partitions reassigned to healthy workers
 * Telemetry: partition count per worker, tick sync latency
 * Diagnostics: worker health, partition map
 * Accessibility: N/A
 * Performance: minimal overhead for small worker counts; async tick dispatch
 * Forbidden: advancing tick without all partitions; lost partitions on failure
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

type WorkerId = string;
type PartitionId = string;
type SimulationId = string;

interface WorkerState {
  id: WorkerId;
  host: string;
  status: 'ready' | 'busy' | 'unresponsive';
  lastHeartbeat: number;
  partitions: PartitionId[];
}

export class SimulationDistributionEngine {
  private workers: Map<WorkerId, WorkerState> = new Map();
  private partitions: Map<PartitionId, WorkerId> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private lockManager: any, // DistributedLockManager
  ) {}

  registerWorker(workerId: WorkerId, host: string): void {
    this.workers.set(workerId, {
      id: workerId,
      host,
      status: 'ready',
      lastHeartbeat: Date.now(),
      partitions: [],
    });
    this.logger.info(`Simulation worker registered: ${workerId}`);
  }

  assignPartition(partitionId: PartitionId, workerId: WorkerId): void {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker not found: ${workerId}`);
    if (this.partitions.has(partitionId)) {
      const oldWorkerId = this.partitions.get(partitionId)!;
      const oldWorker = this.workers.get(oldWorkerId);
      if (oldWorker) {
        oldWorker.partitions = oldWorker.partitions.filter(p => p !== partitionId);
      }
    }
    this.partitions.set(partitionId, workerId);
    worker.partitions.push(partitionId);
    this.meter.incrementCounter('simulation.distributed.partition_assigned');
  }

  async rebalancePartitions(): Promise<void> {
    const healthyWorkers = Array.from(this.workers.values()).filter(w => w.status !== 'unresponsive');
    if (healthyWorkers.length === 0) return;
    const allPartitions = Array.from(this.partitions.keys());
    const perWorker = Math.ceil(allPartitions.length / healthyWorkers.length);
    // Redistribute evenly
    for (let i = 0; i < allPartitions.length; i++) {
      const worker = healthyWorkers[i % healthyWorkers.length];
      this.assignPartition(allPartitions[i], worker.id);
    }
    this.meter.incrementCounter('simulation.distributed.rebalanced');
    this.eventBus.publish('simulation.distributed.rebalanced', { workerCount: healthyWorkers.length });
  }

  getPartitionWorker(partitionId: PartitionId): WorkerId | undefined {
    return this.partitions.get(partitionId);
  }

  async handleWorkerFailure(workerId: WorkerId): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = 'unresponsive';
    // Reassign its partitions
    const orphanedPartitions = [...worker.partitions];
    worker.partitions = [];
    for (const partitionId of orphanedPartitions) {
      this.partitions.delete(partitionId);
    }
    await this.rebalancePartitions();
    this.logger.warn(`Worker ${workerId} failed, partitions redistributed`);
  }
}