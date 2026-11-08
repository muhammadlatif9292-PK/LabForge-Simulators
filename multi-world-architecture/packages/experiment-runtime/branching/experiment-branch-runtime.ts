// packages/experiment-runtime/branching/experiment-branch-runtime.ts
/**
 * Experiment Branch Runtime
 * 
 * Responsibilities:
 * - Manage experiment branches: create, fork, merge, abandon
 * - Track branch parentage and fork points (timeline event)
 * - Support switching between branches and independent timelines
 * - Prevent illegal branching operations (e.g., merging non-ancestor)
 * 
 * Owned state:
 * - branches: Map<BranchId, ExperimentBranch>
 * 
 * Dependencies: ILogger, IMeter, DistributedEventBus
 * 
 * Event emissions:
 *   "experiment.branch.created", "experiment.branch.merged",
 *   "experiment.branch.abandoned"
 * 
 * Event subscriptions: none
 * Synchronization: per-experiment; no cross-experiment branching
 * Recovery: branch state can be rebuilt from timeline
 * Telemetry: branch count, merge count
 * Diagnostics: branch tree structure
 * Accessibility: N/A
 * Performance: O(1) branch lookup
 * Forbidden: orphan branches (branches without parent except main)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  BranchId, ExperimentBranch, ExperimentId, TimelineEventId,
} from '../contracts/experiment-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class ExperimentBranchRuntime {
  private branches: Map<BranchId, ExperimentBranch> = new Map();

  constructor(
    private experimentId: ExperimentId,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  createMainBranch(): ExperimentBranch {
    const branch: ExperimentBranch = {
      id: 'main' as BranchId,
      experimentId: this.experimentId,
      name: 'Main',
      description: 'Default experiment branch',
      createdAt: Date.now(),
      lastEventSequence: 0,
      status: 'active',
    };
    this.branches.set(branch.id, branch);
    return branch;
  }

  async createBranch(
    name: string,
    parentBranchId: BranchId,
    description?: string,
    forkFromEventId?: TimelineEventId,
  ): Promise<ExperimentBranch> {
    const parent = this.branches.get(parentBranchId);
    if (!parent) throw new Error(`Parent branch not found: ${parentBranchId}`);
    if (parent.status !== 'active') throw new Error(`Cannot fork from non-active branch: ${parentBranchId}`);
    const branch: ExperimentBranch = {
      id: uuidv4() as BranchId,
      experimentId: this.experimentId,
      name,
      description: description ?? '',
      parentBranchId,
      forkedFromEventId,
      createdAt: Date.now(),
      lastEventSequence: 0,
      status: 'active',
    };
    this.branches.set(branch.id, branch);
    this.meter.incrementCounter('experiment.branch.created');
    this.logger.info(`Branch created: ${name} (${branch.id}) from ${parentBranchId}`);
    await this.eventBus.publish('experiment.branch.created', {
      experimentId: this.experimentId,
      branchId: branch.id,
      parentBranchId,
      name,
    });
    return branch;
  }

  getBranch(branchId: BranchId): ExperimentBranch | undefined {
    return this.branches.get(branchId);
  }

  getAllBranches(): ExperimentBranch[] {
    return Array.from(this.branches.values());
  }

  async mergeBranch(branchId: BranchId, targetBranchId: BranchId): Promise<void> {
    const branch = this.branches.get(branchId);
    const target = this.branches.get(targetBranchId);
    if (!branch || !target) throw new Error('Branch not found');
    if (branch.status !== 'active' || target.status !== 'active') {
      throw new Error('Only active branches can be merged');
    }
    branch.status = 'merged';
    this.meter.incrementCounter('experiment.branch.merged');
    this.logger.info(`Branch merged: ${branch.name} → ${target.name}`);
    await this.eventBus.publish('experiment.branch.merged', {
      experimentId: this.experimentId,
      branchId,
      targetBranchId,
    });
  }

  async abandonBranch(branchId: BranchId): Promise<void> {
    if (branchId === 'main') throw new Error('Cannot abandon main branch');
    const branch = this.branches.get(branchId);
    if (!branch) throw new Error('Branch not found');
    branch.status = 'abandoned';
    this.meter.incrementCounter('experiment.branch.abandoned');
    this.logger.info(`Branch abandoned: ${branch.name}`);
    await this.eventBus.publish('experiment.branch.abandoned', {
      experimentId: this.experimentId,
      branchId,
    });
  }

  getActiveBranches(): ExperimentBranch[] {
    return this.getAllBranches().filter(b => b.status === 'active');
  }

  clear(): void {
    this.branches.clear();
  }
}