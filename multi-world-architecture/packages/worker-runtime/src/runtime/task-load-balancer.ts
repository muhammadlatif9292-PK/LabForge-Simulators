// packages/worker-runtime/src/runtime/task-load-balancer.ts
/**
 * Task Load Balancer
 * 
 * Responsibilities:
 * - Distribute tasks across workers based on current load and type affinity
 * - Implement least-loaded, round-robin, or priority-based strategies
 * - Rebalance when new workers join or leave
 * - Integrate with worker telemetry for informed decisions
 * 
 * Owned state:
 * - strategy: LoadBalancingStrategy
 * - workerLoads: Map<WorkerId, number>
 * 
 * Dependencies:
 * - DistributedWorkerManager (to query worker info)
 * - ILogger, IMeter
 * 
 * Event emissions: none directly
 * Event subscriptions:
 * - "worker.task.completed" to update load
 * - "worker.registered", "worker.deregistered"
 * 
 * Synchronization: none; operates on in-memory snapshot
 * Recovery: recalculates load distribution on worker change
 * Telemetry: load distribution variance, task wait time
 * Diagnostics: per-worker load, strategy in use
 * Accessibility: N/A
 * Performance: O(1) decision making; cache worker states
 * Forbidden: making decisions without current load data
 */

import type { WorkerId, TaskSpec, WorkerType } from '../contracts/worker-contracts';
import type { DistributedWorkerManager } from './distributed-worker-manager';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export enum LoadBalancingStrategy {
  LeastLoaded,
  RoundRobin,
  PriorityAware,
}

export class TaskLoadBalancer {
  private strategy: LoadBalancingStrategy = LoadBalancingStrategy.LeastLoaded;
  private workerLoads: Map<WorkerId, number> = new Map();

  constructor(
    private workerManager: DistributedWorkerManager,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async getTargetWorker(task: TaskSpec<any>): Promise<WorkerId | null> {
    const available = Array.from(this.workerManager.workers.values())
      .filter(w => w.status === 'idle' && w.type === (task.workerHint || WorkerType.GENERAL));

    if (available.length === 0) return null;

    switch (this.strategy) {
      case LoadBalancingStrategy.LeastLoaded:
        return this.leastLoaded(available);
      case LoadBalancingStrategy.RoundRobin:
        return this.roundRobin(available);
      default:
        return this.leastLoaded(available);
    }
  }

  private leastLoaded(candidates: any[]): WorkerId | null {
    let minLoad = Infinity;
    let best: WorkerId | null = null;
    for (const w of candidates) {
      const load = this.workerLoads.get(w.id) ?? 0;
      if (load < minLoad) {
        minLoad = load;
        best = w.id;
      }
    }
    return best;
  }

  private roundRobin(candidates: any[]): WorkerId {
    // Simplified: pick first; real RR needs state
    return candidates[0]?.id ?? null;
  }

  updateLoad(workerId: WorkerId, loadDelta: number): void {
    const current = this.workerLoads.get(workerId) ?? 0;
    this.workerLoads.set(workerId, Math.max(0, current + loadDelta));
  }

  setStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
    this.logger.info(`Load balancer strategy changed to ${strategy}`);
  }
}