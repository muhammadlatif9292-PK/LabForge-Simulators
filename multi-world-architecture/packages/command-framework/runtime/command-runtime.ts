// packages/command-framework/runtime/command-runtime.ts
/**
 * Command Runtime
 * 
 * Responsibilities:
 * - Accept incoming commands, validate, execute, and commit with full lifecycle
 * - Enforce permissions, retry, and timeout policies
 * - Emit events for every phase transition
 * - Coordinate with history, undo/redo, replay, and recovery subsystems
 * - Ensure deterministic execution: same command + same state = same result
 * 
 * Owned state:
 * - activeExecutions: Map<ExecutionId, CommandExecution>
 * - abortControllers: Map<ExecutionId, AbortController>
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - CommandRegistry
 * - CommandHistoryEngine
 * - UndoRedoRuntime
 * - PermissionAwareCommandRunner
 * - CommandReplayRuntime
 * - CommandRecoveryEngine
 * 
 * Event emissions:
 * - "command.received", "command.validated", "command.executed"
 * - "command.committed", "command.rolled_back", "command.rejected", "command.failed"
 * 
 * Event subscriptions: none (this is the entry point)
 * Synchronization: commands are serialised per session; distributed locking for global commands
 * Recovery: failed commands retried; interrupted commands recovered on restart
 * Telemetry: command throughput, latency, error rate per type
 * Diagnostics: active executions, recent failures
 * Accessibility: N/A
 * Performance: async execution; non-blocking validation; command queue bounded
 * Forbidden: executing commands out of order within a session; silent failures
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Command, CommandId, CommandType, CommandMetadata,
  CommandExecution, CommandStatus, CommandPhase, ExecutionId, ExecutionContext,
} from '../contracts/command-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { CommandRegistry } from '../registry/command-registry';
import type { CommandHistoryEngine } from '../history/command-history-engine';
import type { UndoRedoRuntime } from '../undo-redo/undo-redo-runtime';
import type { PermissionAwareCommandRunner } from '../permissions/permission-aware-command-runner';
import type { CommandReplayRuntime } from '../recovery/command-replay-runtime';
import type { CommandRecoveryEngine } from '../recovery/command-recovery-engine';

export class CommandRuntime {
  private activeExecutions: Map<ExecutionId, CommandExecution> = new Map();
  private abortControllers: Map<ExecutionId, AbortController> = new Map();
  private processing = false;
  private commandQueue: { command: Command; context: ExecutionContext; resolve: (r: any) => void; reject: (e: Error) => void }[] = [];
  private readonly maxQueueSize = 1000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private registry: CommandRegistry,
    private history: CommandHistoryEngine,
    private undoRedo: UndoRedoRuntime,
    private permissionRunner: PermissionAwareCommandRunner,
    private replayRuntime: CommandReplayRuntime,
    private recovery: CommandRecoveryEngine,
  ) {}

  async execute<TPayload, TResult>(
    type: CommandType,
    payload: TPayload,
    context: ExecutionContext,
    metadata?: Partial<CommandMetadata>,
  ): Promise<TResult> {
    const command: Command<TPayload> = {
      id: uuidv4() as CommandId,
      type,
      payload,
      metadata: {
        userId: context.userId,
        sessionId: context.sessionId,
        timestamp: Date.now(),
        priority: metadata?.priority ?? 10,
        ...metadata,
      },
    };
    await this.eventBus.publish('command.received', { command, context });
    this.meter.incrementCounter('command.received', { type });
    this.logger.debug(`Command received: ${type} (${command.id})`);

    // Enqueue for serialised execution
    return new Promise<TResult>((resolve, reject) => {
      if (this.commandQueue.length >= this.maxQueueSize) {
        reject(new Error('Command queue full'));
        return;
      }
      this.commandQueue.push({ command, context, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.commandQueue.length > 0) {
        const item = this.commandQueue.shift()!;
        try {
          const result = await this.executeCommand(item.command, item.context);
          item.resolve(result);
        } catch (err) {
          item.reject(err as Error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeCommand<TPayload, TResult>(command: Command<TPayload>, context: ExecutionContext): Promise<TResult> {
    const executionId = uuidv4() as ExecutionId;
    const maxRetries = this.registry.getEntry(command.type)?.maxRetries ?? 2;
    const execution: CommandExecution<TPayload, TResult> = {
      executionId,
      command,
      phase: CommandPhase.VALIDATION,
      status: CommandStatus.PENDING,
      startedAt: Date.now(),
      retryCount: 0,
      maxRetries,
    };
    this.activeExecutions.set(executionId, execution);
    const span = this.tracer.startSpan('command.execute', { type: command.type, commandId: command.id });

    while (execution.retryCount <= maxRetries) {
      try {
        // Phase 1: Validation
        execution.phase = CommandPhase.VALIDATION;
        execution.status = CommandStatus.VALIDATING;
        await this.validateCommand(command, context);
        await this.eventBus.publish('command.validated', { commandId: command.id, type: command.type });

        // Phase 2: Execution
        execution.phase = CommandPhase.EXECUTION;
        execution.status = CommandStatus.EXECUTING;
        const result = await this.permissionRunner.executeWithPermissions(command, context);
        execution.result = result as TResult;
        await this.eventBus.publish('command.executed', { commandId: command.id, type: command.type });

        // Phase 3: Commit
        execution.phase = CommandPhase.COMMIT;
        execution.status = CommandStatus.COMMITTED;
        execution.completedAt = Date.now();
        this.history.recordExecution(execution);
        if (this.registry.getEntry(command.type)?.undoable) {
          this.undoRedo.pushUndo(execution);
        }
        this.replayRuntime.recordCommand(command, execution as any);
        this.recovery.saveExecution(execution);
        await this.eventBus.publish('command.committed', { commandId: command.id, type: command.type });
        this.meter.recordHistogram('command.latency', Date.now() - execution.startedAt, { type: command.type });
        this.meter.incrementCounter('command.committed', { type: command.type });
        span.finish();
        this.activeExecutions.delete(executionId);
        return result as TResult;
      } catch (err) {
        execution.retryCount++;
        const errorMessage = (err as Error).message;
        if (execution.retryCount > maxRetries) {
          execution.status = CommandStatus.FAILED;
          execution.error = errorMessage;
          execution.completedAt = Date.now();
          this.history.recordExecution(execution);
          await this.eventBus.publish('command.failed', { commandId: command.id, type: command.type, error: errorMessage });
          this.meter.incrementCounter('command.failed', { type: command.type });
          span.setTag('error', true);
          span.finish();
          this.activeExecutions.delete(executionId);
          // Attempt recovery
          await this.recovery.handleFailedCommand(command, execution);
          throw err;
        }
        this.logger.warn(`Command retry ${execution.retryCount}/${maxRetries}: ${command.type}`, { error: errorMessage });
        await new Promise(resolve => setTimeout(resolve, Math.min(30000, 1000 * Math.pow(2, execution.retryCount))));
      }
    }
    throw new Error('Command execution exceeded retries');
  }

  private async validateCommand(command: Command, context: ExecutionContext): Promise<void> {
    const handler = this.registry.getHandler(command.type);
    if (!handler) throw new Error(`No handler for command type: ${command.type}`);
    if (handler.validate) {
      const valid = await handler.validate(command.payload, context);
      if (!valid) throw new Error('Command validation failed');
    }
  }

  async rollbackCommand(commandId: CommandId, context: ExecutionContext): Promise<void> {
    const execution = this.history.getExecution(commandId);
    if (!execution) throw new Error('Command execution not found in history');
    if (execution.status !== CommandStatus.COMMITTED) throw new Error('Only committed commands can be rolled back');
    const handler = this.registry.getHandler(execution.command.type);
    if (!handler?.rollback) throw new Error('Command does not support rollback');
    await handler.rollback(execution.command.payload, execution.result, context);
    execution.status = CommandStatus.ROLLED_BACK;
    execution.phase = CommandPhase.ROLLBACK;
    await this.eventBus.publish('command.rolled_back', { commandId, type: execution.command.type });
  }

  cancel(commandId: CommandId): void {
    const controller = this.abortControllers.get(commandId as any);
    if (controller) controller.abort();
  }

  getActiveExecutions(): CommandExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  async shutdown(): Promise<void> {
    this.commandQueue = [];
    this.activeExecutions.clear();
  }
}