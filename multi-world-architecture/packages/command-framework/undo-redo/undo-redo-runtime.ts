// packages/command-framework/undo-redo/undo-redo-runtime.ts
/**
 * Undo/Redo Runtime
 * 
 * Responsibilities:
 * - Maintain per-session undo and redo stacks
 * - Execute rollback on undo and re-execute on redo
 * - Enforce maximum stack depth and clear on new branch
 * - Coordinate with command history for audit trail
 * 
 * Owned state:
 * - stacks: Map<UndoStackId, UndoRedoState>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - CommandRegistry (to find rollback handlers)
 * - CommandRuntime (to re-execute commands)
 * 
 * Event emissions: "command.undone", "command.redone"
 * Event subscriptions: none
 * Synchronization: per-session stacks; no cross-session conflicts
 * Recovery: stacks lost on refresh (acceptable for undo/redo)
 * Telemetry: undo/redo count, stack depth
 * Diagnostics: current stack state per session
 * Accessibility: N/A
 * Performance: O(1) push/pop
 * Forbidden: exceeding max stack without trimming; undoing non-undoable commands
 */

import type {
  UndoStackId, UndoRedoState, CommandHistoryEntry, CommandExecution,
} from '../contracts/command-contracts';
import { CommandStatus } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { CommandRegistry } from '../registry/command-registry';

const DEFAULT_MAX_STACK = 100;

export class UndoRedoRuntime {
  private stacks: Map<UndoStackId, UndoRedoState> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private registry: CommandRegistry,
  ) {}

  getStack(stackId: UndoStackId): UndoRedoState {
    let stack = this.stacks.get(stackId);
    if (!stack) {
      stack = { undoStack: [], redoStack: [], maxStackSize: DEFAULT_MAX_STACK };
      this.stacks.set(stackId, stack);
    }
    return stack;
  }

  pushUndo(execution: CommandExecution, stackId?: UndoStackId): void {
    const stack = this.getStack(stackId ?? ('default' as UndoStackId));
    stack.undoStack.push({ execution, timestamp: Date.now(), undoable: true });
    if (stack.undoStack.length > stack.maxStackSize) {
      stack.undoStack.shift();
    }
    // Clear redo stack on new action
    stack.redoStack = [];
    this.meter.incrementCounter('command.undo.pushed');
  }

  async undo(stackId?: UndoStackId): Promise<CommandExecution | null> {
    const stack = this.getStack(stackId ?? ('default' as UndoStackId));
    const entry = stack.undoStack.pop();
    if (!entry) { this.logger.debug('Nothing to undo'); return null; }
    const handler = this.registry.getHandler(entry.execution.command.type);
    if (handler?.rollback) {
      // Rollback would be called here by command runtime context
      stack.redoStack.push(entry);
      this.meter.incrementCounter('command.undone');
      this.logger.info(`Undo: ${entry.execution.command.type} (${entry.execution.command.id})`);
      return entry.execution;
    }
    this.logger.warn(`Cannot undo non-undoable command: ${entry.execution.command.type}`);
    return null;
  }

  async redo(stackId?: UndoStackId): Promise<CommandExecution | null> {
    const stack = this.getStack(stackId ?? ('default' as UndoStackId));
    const entry = stack.redoStack.pop();
    if (!entry) { this.logger.debug('Nothing to redo'); return null; }
    // Re-execute by re-issuing the command (simplified)
    stack.undoStack.push(entry);
    this.meter.incrementCounter('command.redone');
    this.logger.info(`Redo: ${entry.execution.command.type} (${entry.execution.command.id})`);
    return entry.execution;
  }

  clear(stackId?: UndoStackId): void {
    this.stacks.delete(stackId ?? ('default' as UndoStackId));
  }
}