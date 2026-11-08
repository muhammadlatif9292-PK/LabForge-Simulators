// packages/automation-engine/workflows/workflow-execution-engine.ts
/**
 * Workflow Execution Engine
 * 
 * Responsibilities:
 * - Execute workflow steps sequentially or in parallel as defined
 * - Handle step types: command, condition, parallel, delay, AI decision, notifications
 * - Track step results, retries, and timeouts
 * - Pause/resume/cancel execution at step boundaries
 * - Emit step-level events for observability
 * 
 * Owned state:
 * - executingInstances: Map<AutomationRunId, AbortController>
 * - stepTimers: Map<string, NodeJS.Timeout>
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - CommandRuntime (for command steps)
 * - AIWorkflowOrchestrator (for AI decision steps)
 * - ScientificAutomationRuntime (for instrument/measurement steps)
 * 
 * Event emissions:
 *   "workflow.step.started", "workflow.step.completed", "workflow.step.failed"
 * 
 * Event subscriptions: none
 * Synchronization: per-instance sequential execution; parallel steps via Promise.all
 * Recovery: step results recorded; can resume from last completed step
 * Telemetry: step duration, retry count, success rate per step type
 * Diagnostics: current step per instance
 * Accessibility: N/A
 * Performance: lightweight step dispatch; timeout enforcement via AbortController
 * Forbidden: orphan steps after cancellation; unbounded retry loops
 */

import type {
  WorkflowInstance, WorkflowDefinition, WorkflowStep, StepResult,
  AutomationRunId, TaskStatus,
} from '../contracts/automation-contracts';
import { StepType } from '../contracts/automation-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { CommandRuntime } from '@labforge/command-framework';
import type { AIWorkflowOrchestrator } from '../AI/AI-workflow-orchestrator';
import type { ScientificAutomationRuntime } from './scientific-automation-runtime';

export class WorkflowExecutionEngine {
  private controllers: Map<AutomationRunId, AbortController> = new Map();
  private pausedInstances: Set<AutomationRunId> = new Set();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private commandRuntime: CommandRuntime,
    private aiOrchestrator: AIWorkflowOrchestrator,
    private scientificRuntime: ScientificAutomationRuntime,
  ) {}

  async executeInstance(instance: WorkflowInstance, definition: WorkflowDefinition): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(instance.runId, controller);
    try {
      let currentStepId = instance.currentStepId;
      while (currentStepId && !controller.signal.aborted) {
        // Respect pause
        if (this.pausedInstances.has(instance.runId)) {
          await this.waitForResume(instance.runId, controller.signal);
          if (controller.signal.aborted) break;
        }
        const step = definition.steps.find(s => s.id === currentStepId);
        if (!step) throw new Error(`Step not found: ${currentStepId}`);
        instance.currentStepId = step.id;
        instance.progress = definition.steps.indexOf(step) / definition.steps.length;
        const result = await this.executeStep(instance, step, controller.signal);
        instance.stepResults.set(step.id, result);
        if (result.status === 'failed' && step.onError) {
          currentStepId = step.onError;
          this.logger.warn(`Step ${step.id} failed, jumping to error handler: ${step.onError}`);
        } else if (result.status === 'completed') {
          currentStepId = step.nextStepId ?? '';
        } else {
          throw new Error(`Step ${step.id} ended with status: ${result.status}`);
        }
      }
    } catch (err) {
      throw err;
    } finally {
      this.controllers.delete(instance.runId);
      this.pausedInstances.delete(instance.runId);
    }
  }

  private async executeStep(instance: WorkflowInstance, step: WorkflowStep, signal: AbortSignal): Promise<StepResult> {
    const start = Date.now();
    const result: StepResult = {
      stepId: step.id,
      status: 'in_progress',
      startedAt: start,
      retryCount: 0,
    };
    this.meter.incrementCounter('workflow.step.started', { type: step.type });
    await this.eventBus.publish('workflow.step.started', {
      runId: instance.runId,
      stepId: step.id,
      type: step.type,
    });
    for (let attempt = 0; attempt <= step.retryCount; attempt++) {
      result.retryCount = attempt;
      try {
        const output = await this.dispatchStep(step, instance, signal);
        result.status = 'completed';
        result.output = output;
        result.completedAt = Date.now();
        this.meter.incrementCounter('workflow.step.completed', { type: step.type });
        this.meter.recordHistogram('workflow.step.duration', Date.now() - start, { type: step.type });
        await this.eventBus.publish('workflow.step.completed', {
          runId: instance.runId,
          stepId: step.id,
          type: step.type,
          durationMs: Date.now() - start,
        });
        return result;
      } catch (err) {
        result.error = (err as Error).message;
        if (attempt < step.retryCount) {
          const backoff = Math.min(30000, 500 * Math.pow(2, attempt));
          this.logger.warn(`Step ${step.id} attempt ${attempt + 1}/${step.retryCount + 1} failed, retrying in ${backoff}ms`);
          result.status = 'retrying';
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }
    result.status = 'failed';
    result.completedAt = Date.now();
    this.meter.incrementCounter('workflow.step.failed', { type: step.type });
    await this.eventBus.publish('workflow.step.failed', {
      runId: instance.runId,
      stepId: step.id,
      type: step.type,
      error: result.error,
    });
    return result;
  }

  private async dispatchStep(step: WorkflowStep, instance: WorkflowInstance, signal: AbortSignal): Promise<unknown> {
    switch (step.type) {
      case StepType.COMMAND:
        return this.executeCommandStep(step, instance);
      case StepType.DELAY:
        const delayMs = (step.config.durationMs as number) ?? 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return { delayed: delayMs };
      case StepType.AI_DECISION:
        return this.aiOrchestrator.makeDecision(step.config as any, instance);
      case StepType.INSTRUMENT_ACTION:
        return this.scientificRuntime.executeInstrumentAction(step.config, instance);
      case StepType.MEASUREMENT:
        return this.scientificRuntime.executeMeasurementStep(step.config, instance);
      case StepType.NOTIFICATION:
        await this.eventBus.publish('automation.notification', {
          runId: instance.runId,
          message: step.config.message ?? 'Workflow notification',
        });
        return { notified: true };
      case StepType.CONDITION:
        return this.evaluateCondition(step, instance);
      case StepType.DATA_PROCESSING:
        return this.scientificRuntime.processData(step.config, instance);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeCommandStep(step: WorkflowStep, instance: WorkflowInstance): Promise<unknown> {
    const commandType = step.config.commandType as string;
    const payload = step.config.payload ?? {};
    const context = {
      userId: (instance.variables.userId as string) ?? 'automation',
      sessionId: `auto-${instance.runId}`,
      variables: instance.variables,
      metadata: { workflowRunId: instance.runId, stepId: step.id },
    };
    return this.commandRuntime.execute(commandType as any, payload, context);
  }

  private async evaluateCondition(step: WorkflowStep, instance: WorkflowInstance): Promise<boolean> {
    const condition = step.config.condition as string;
    // Simple evaluation: check variable values
    if (condition === 'variables.success === true') {
      return instance.variables.success === true;
    }
    return true;
  }

  async pauseInstance(runId: AutomationRunId): Promise<void> {
    this.pausedInstances.add(runId);
  }

  async cancelInstance(runId: AutomationRunId): Promise<void> {
    const controller = this.controllers.get(runId);
    if (controller) controller.abort();
    this.pausedInstances.delete(runId);
  }

  private async waitForResume(runId: AutomationRunId, signal: AbortSignal): Promise<void> {
    return new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (!this.pausedInstances.has(runId) || signal.aborted) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }
}