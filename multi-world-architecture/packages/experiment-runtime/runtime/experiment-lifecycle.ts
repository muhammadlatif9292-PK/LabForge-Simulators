// packages/experiment-runtime/runtime/experiment-lifecycle.ts
/**
 * Experiment Lifecycle Manager
 * 
 * Responsibilities:
 * - Manage the full lifecycle state machine for an experiment
 *   (CREATED → RUNNING ⇄ PAUSED → COMPLETED/FAILED → ARCHIVED)
 * - Validate legal state transitions and reject illegal ones
 * - Emit lifecycle events for observability and recovery
 * - Enforce invariants (e.g., cannot modify an archived experiment)
 * 
 * Owned state:
 * - status: ExperimentStatus
 * - transitionHistory: StatusTransition[] (bounded audit log)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions:
 *   "experiment.lifecycle.transition" on every valid transition
 *   "experiment.lifecycle.illegal_transition" on rejected transitions
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded; transitions are atomic
 * Recovery: transition history can be replayed to verify current state
 * Telemetry: status gauge, transition count per type
 * Diagnostics: transition history, current status
 * Accessibility: N/A
 * Performance: O(1) transition checks using a state transition map
 * Forbidden: skipping lifecycle phases; concurrent transitions
 */

import type { ExperimentStatus } from '../contracts/experiment-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface StatusTransition {
  from: ExperimentStatus;
  to: ExperimentStatus;
  timestamp: number;
  reason?: string;
}

const LEGAL_TRANSITIONS: Map<ExperimentStatus, Set<ExperimentStatus>> = new Map([
  ['created', new Set(['running', 'archived'])],
  ['running', new Set(['paused', 'completed', 'failed', 'archived'])],
  ['paused', new Set(['running', 'completed', 'failed', 'archived'])],
  ['completed', new Set(['archived'])],
  ['failed', new Set(['running', 'archived'])],
  ['archived', new Set()],
]);

export class ExperimentLifecycle {
  private status: ExperimentStatus = 'created';
  private transitions: StatusTransition[] = [];
  private readonly maxTransitionHistory = 200;

  constructor(
    private experimentId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getStatus(): ExperimentStatus {
    return this.status;
  }

  canTransition(to: ExperimentStatus): boolean {
    const allowed = LEGAL_TRANSITIONS.get(this.status);
    return allowed?.has(to) ?? false;
  }

  async transition(to: ExperimentStatus, reason?: string): Promise<void> {
    if (!this.canTransition(to)) {
      const error = `Illegal lifecycle transition: ${this.status} → ${to}`;
      this.logger.error(error, { experimentId: this.experimentId, reason });
      this.meter.incrementCounter('experiment.lifecycle.illegal_transition', { from: this.status, to });
      await this.eventBus.publish('experiment.lifecycle.illegal_transition', {
        experimentId: this.experimentId,
        from: this.status,
        to,
        reason,
      });
      throw new Error(error);
    }
    const transition: StatusTransition = {
      from: this.status,
      to,
      timestamp: Date.now(),
      reason,
    };
    this.status = to;
    this.transitions.push(transition);
    if (this.transitions.length > this.maxTransitionHistory) {
      this.transitions.shift();
    }
    this.meter.setGauge('experiment.status', this.statusToNumber(to), { experimentId: this.experimentId });
    this.meter.incrementCounter('experiment.lifecycle.transition', { from: transition.from, to });
    this.logger.info(`Experiment ${this.experimentId}: ${transition.from} → ${to}${reason ? ` (${reason})` : ''}`);
    await this.eventBus.publish('experiment.lifecycle.transition', {
      experimentId: this.experimentId,
      ...transition,
    });
  }

  getTransitionHistory(): StatusTransition[] {
    return [...this.transitions];
  }

  isActive(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }

  isTerminal(): boolean {
    return this.status === 'completed' || this.status === 'failed' || this.status === 'archived';
  }

  private statusToNumber(status: ExperimentStatus): number {
    const map: Record<ExperimentStatus, number> = {
      created: 0, running: 1, paused: 2, completed: 3, failed: 4, archived: 5,
    };
    return map[status] ?? 0;
  }

  restoreState(status: ExperimentStatus): void {
    this.status = status;
    this.logger.info(`Experiment lifecycle restored to ${status}`);
  }
}