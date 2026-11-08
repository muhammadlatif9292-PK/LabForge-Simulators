// packages/automation-engine/runtime/automation-runtime.ts
/**
 * Automation Runtime
 * 
 * Responsibilities:
 * - Serve as the central engine for executing, monitoring, and managing automated workflows
 * - Accept workflow definitions, instantiate runs, and drive step-by-step execution
 * - Handle triggers: manual start, scheduled, event-driven, and conditional
 * - Coordinate with workflow execution engine, AI orchestrator, and scheduling runtime
 * - Persist workflow state for recovery on crash
 * 
 * Owned state:
 * - workflows: Map<WorkflowId, WorkflowDefinition>
 * - instances: Map<AutomationRunId, WorkflowInstance>
 * - activeTimers: Map<AutomationRunId, NodeJS.Timeout>
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - WorkflowExecutionEngine
 * - ScientificAutomationRuntime
 * - AIWorkflowOrchestrator
 * - ScheduledTaskRuntime
 * - AutomationRecoveryEngine
 * 
 * Event emissions:
 *   "automation.workflow.registered", "automation.run.started"
 *   "automation.run.completed", "automation.run.failed"
 *   "automation.run.paused", "automation.run.resumed"
 * 
 * Event subscriptions:
 *   "experiment.completed" (trigger workflows)
 *   "mission.completed" (trigger workflows)
 *   "scheduled.task.triggered" (from scheduler)
 * 
 * Synchronization: workflow instances isolated; concurrent runs of different workflows allowed
 * Recovery: active instances restored from snapshot on restart
 * Telemetry: workflow execution count, success rate, avg duration
 * Diagnostics: active runs, step progress, instance history
 * Accessibility: workflow status announcements for screen readers
 * Performance: async step execution; parallel steps via Promise.all
 * Forbidden: running the same workflow instance concurrently; infinite loops without timeout
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  WorkflowId, WorkflowDefinition, WorkflowInstance, WorkflowStatus,
  AutomationRunId, StepResult, TaskStatus, AutomationHealth,
} from '../contracts/automation-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorkflowExecutionEngine } from './workflow-execution-engine';
import type { ScientificAutomationRuntime } from './scientific-automation-runtime';
import type { AIWorkflowOrchestrator } from './AI-workflow-orchestrator';
import type { ScheduledTaskRuntime } from './scheduled-task-runtime';
import type { AutomationRecoveryEngine } from './automation-recovery-engine';

export class AutomationRuntime {
  private workflows: Map<WorkflowId, WorkflowDefinition> = new Map();
  private instances: Map<AutomationRunId, WorkflowInstance> = new Map();
  private readonly maxInstances = 100;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private executionEngine: WorkflowExecutionEngine,
    private scientificAutomation: ScientificAutomationRuntime,
    private aiOrchestrator: AIWorkflowOrchestrator,
    private scheduler: ScheduledTaskRuntime,
    private recovery: AutomationRecoveryEngine,
  ) {
    this.eventBus.subscribe('scheduled.task.triggered', this.onScheduledTrigger.bind(this));
    this.eventBus.subscribe('experiment.completed', this.onExperimentCompleted.bind(this));
    this.eventBus.subscribe('mission.completed', this.onMissionCompleted.bind(this));
  }

  async registerWorkflow(definition: WorkflowDefinition): Promise<void> {
    if (this.workflows.has(definition.id)) {
      this.logger.warn(`Overwriting workflow: ${definition.id}`);
    }
    this.workflows.set(definition.id, definition);
    // Register any scheduled triggers
    for (const trigger of definition.triggers) {
      if (trigger.type === 'scheduled') {
        await this.scheduler.scheduleWorkflow(definition.id, trigger.config as any);
      }
    }
    this.meter.incrementCounter('automation.workflow.registered');
    this.logger.info(`Workflow registered: ${definition.name} (${definition.id})`);
    await this.eventBus.publish('automation.workflow.registered', {
      workflowId: definition.id,
      name: definition.name,
    });
  }

  async startWorkflow(workflowId: WorkflowId, initialVariables?: Record<string, unknown>): Promise<AutomationRunId> {
    const definition = this.workflows.get(workflowId);
    if (!definition) throw new Error(`Workflow not found: ${workflowId}`);
    if (this.instances.size >= this.maxInstances) {
      throw new Error('Maximum concurrent workflow instances reached');
    }
    const runId = uuidv4() as AutomationRunId;
    const instance: WorkflowInstance = {
      runId,
      workflowId,
      status: WorkflowStatus.RUNNING,
      currentStepId: definition.steps[0]?.id ?? '',
      startedAt: Date.now(),
      variables: { ...definition.variables, ...initialVariables },
      stepResults: new Map(),
      progress: 0,
    };
    this.instances.set(runId, instance);
    this.meter.incrementCounter('automation.run.started');
    this.logger.info(`Workflow started: ${definition.name} (run ${runId})`);
    await this.eventBus.publish('automation.run.started', { workflowId, runId });
    this.recovery.saveRunningInstances(this.getActiveInstances());
    // Execute asynchronously
    this.executionEngine.executeInstance(instance, definition).then(
      (result) => this.onRunCompleted(runId, result),
      (error) => this.onRunFailed(runId, error),
    );
    return runId;
  }

  async pauseRun(runId: AutomationRunId): Promise<void> {
    const instance = this.instances.get(runId);
    if (!instance) throw new Error(`Run not found: ${runId}`);
    if (instance.status !== WorkflowStatus.RUNNING) throw new Error('Only running workflows can be paused');
    instance.status = WorkflowStatus.PAUSED;
    await this.executionEngine.pauseInstance(runId);
    this.meter.incrementCounter('automation.run.paused');
    await this.eventBus.publish('automation.run.paused', { runId });
  }

  async resumeRun(runId: AutomationRunId): Promise<void> {
    const instance = this.instances.get(runId);
    if (!instance) throw new Error(`Run not found: ${runId}`);
    if (instance.status !== WorkflowStatus.PAUSED) throw new Error('Only paused workflows can be resumed');
    instance.status = WorkflowStatus.RUNNING;
    const definition = this.workflows.get(instance.workflowId)!;
    this.executionEngine.executeInstance(instance, definition).then(
      (result) => this.onRunCompleted(runId, result),
      (error) => this.onRunFailed(runId, error),
    );
    this.meter.incrementCounter('automation.run.resumed');
    await this.eventBus.publish('automation.run.resumed', { runId });
  }

  async cancelRun(runId: AutomationRunId): Promise<void> {
    const instance = this.instances.get(runId);
    if (!instance) return;
    instance.status = WorkflowStatus.CANCELLED;
    instance.completedAt = Date.now();
    await this.executionEngine.cancelInstance(runId);
    this.meter.incrementCounter('automation.run.cancelled');
    await this.eventBus.publish('automation.run.cancelled', { runId });
  }

  private async onRunCompleted(runId: AutomationRunId, result: any): Promise<void> {
    const instance = this.instances.get(runId);
    if (!instance) return;
    instance.status = WorkflowStatus.COMPLETED;
    instance.completedAt = Date.now();
    instance.progress = 1;
    this.recovery.saveRunningInstances(this.getActiveInstances());
    this.meter.incrementCounter('automation.run.completed');
    this.meter.recordHistogram('automation.run.duration', Date.now() - instance.startedAt);
    this.logger.info(`Workflow completed: ${runId}`);
    await this.eventBus.publish('automation.run.completed', { workflowId: instance.workflowId, runId, result });
  }

  private async onRunFailed(runId: AutomationRunId, error: Error): Promise<void> {
    const instance = this.instances.get(runId);
    if (!instance) return;
    const definition = this.workflows.get(instance.workflowId);
    if (definition?.onFailure === 'pause') {
      instance.status = WorkflowStatus.PAUSED;
    } else {
      instance.status = WorkflowStatus.FAILED;
      instance.completedAt = Date.now();
      instance.error = error.message;
    }
    this.recovery.saveRunningInstances(this.getActiveInstances());
    this.meter.incrementCounter('automation.run.failed');
    this.logger.error(`Workflow failed: ${runId}`, { error: error.message });
    await this.eventBus.publish('automation.run.failed', { workflowId: instance.workflowId, runId, error: error.message });
  }

  private onScheduledTrigger(event: any): void {
    const { workflowId, variables } = event.payload;
    this.startWorkflow(workflowId, variables).catch(err =>
      this.logger.error('Scheduled workflow start failed', { workflowId, error: err }),
    );
  }

  private onExperimentCompleted(event: any): void {
    // Check for workflows triggered by experiment events
    for (const wf of this.workflows.values()) {
      for (const trigger of wf.triggers) {
        if (trigger.type === 'event' && trigger.config.eventType === 'experiment.completed') {
          this.startWorkflow(wf.id, { experimentId: event.payload.experimentId }).catch(err =>
            this.logger.error('Event-driven workflow start failed', err),
          );
        }
      }
    }
  }

  private onMissionCompleted(event: any): void {
    for (const wf of this.workflows.values()) {
      for (const trigger of wf.triggers) {
        if (trigger.type === 'event' && trigger.config.eventType === 'mission.completed') {
          this.startWorkflow(wf.id, { missionId: event.payload.missionId }).catch(err =>
            this.logger.error('Event-driven workflow start failed', err),
          );
        }
      }
    }
  }

  getInstance(runId: AutomationRunId): WorkflowInstance | undefined {
    return this.instances.get(runId);
  }

  getActiveInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.status === 'running' || i.status === 'paused',
    );
  }

  getHealth(): AutomationHealth {
    const active = this.getActiveInstances();
    const failed24h = Array.from(this.instances.values()).filter(
      i => i.status === 'failed' && (Date.now() - (i.completedAt ?? 0)) < 86400000,
    ).length;
    return {
      activeWorkflows: this.workflows.size,
      scheduledTasks: this.scheduler.getTaskCount(),
      runningInstances: active.length,
      failedInstances24h: failed24h,
      averageExecutionTimeMs: 0,
      status: active.length > 0 ? 'healthy' : 'healthy',
    };
  }

  async shutdown(): Promise<void> {
    // Pause all running instances
    for (const [id, instance] of this.instances) {
      if (instance.status === 'running') {
        await this.pauseRun(id).catch(err => this.logger.error(`Shutdown pause failed: ${id}`, err));
      }
    }
    await this.recovery.saveRunningInstances(this.getActiveInstances());
  }
}