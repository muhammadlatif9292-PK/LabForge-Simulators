// packages/command-framework/contracts/command-contracts.ts
/**
 * Command Framework Contracts
 * 
 * Responsibilities:
 * - Define strict types for commands, execution context, history, undo/redo, and replay
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type CommandId = string & { readonly __brand: 'CommandId' };
export type CommandType = string & { readonly __brand: 'CommandType' };
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };
export type UndoStackId = string & { readonly __brand: 'UndoStackId' };

export enum CommandPhase {
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  COMMIT = 'commit',
  ROLLBACK = 'rollback',
}

export enum CommandStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  EXECUTING = 'executing',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export interface Command<TPayload = unknown> {
  id: CommandId;
  type: CommandType;
  payload: TPayload;
  metadata: CommandMetadata;
}

export interface CommandMetadata {
  userId: string;
  sessionId: string;
  timestamp: number;
  causationId?: string;
  correlationId?: string;
  priority: number;
  ttl?: number;
  tags?: Record<string, string>;
}

export interface CommandExecution<TPayload = unknown, TResult = unknown> {
  executionId: ExecutionId;
  command: Command<TPayload>;
  phase: CommandPhase;
  status: CommandStatus;
  startedAt: number;
  completedAt?: number;
  result?: TResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface CommandHandler<TPayload = unknown, TResult = unknown> {
  commandType: CommandType;
  validate?: (payload: TPayload, context: ExecutionContext) => Promise<boolean>;
  execute: (payload: TPayload, context: ExecutionContext) => Promise<TResult>;
  rollback?: (payload: TPayload, result: TResult, context: ExecutionContext) => Promise<void>;
  permissions?: string[];
}

export interface ExecutionContext {
  userId: string;
  sessionId: string;
  worldId?: string;
  instrumentId?: string;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface CommandHistoryEntry<TPayload = unknown, TResult = unknown> {
  execution: CommandExecution<TPayload, TResult>;
  timestamp: number;
  undoable: boolean;
}

export interface UndoRedoState {
  undoStack: CommandHistoryEntry[];
  redoStack: CommandHistoryEntry[];
  maxStackSize: number;
}

export interface CommandReplayFrame {
  sequenceNumber: number;
  execution: CommandExecution;
  timestamp: number;
}

export interface CommandRegistryEntry {
  handler: CommandHandler;
  schema?: any; // Zod schema
  permissions: string[];
  undoable: boolean;
  maxRetries: number;
  timeoutMs: number;
}