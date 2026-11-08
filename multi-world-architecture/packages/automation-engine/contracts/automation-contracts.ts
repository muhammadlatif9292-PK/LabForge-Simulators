// packages/automation-engine/contracts/automation-contracts.ts
/**
 * Automation Engine Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for workflows, scheduled tasks, AI-driven automation,
 *   and automation recovery
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

export type WorkflowId = string & { readonly __brand: 'WorkflowId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type AutomationRunId = string & { readonly __brand: 'AutomationRunId' };
export type ScheduleId = string & { readonly __brand: 'ScheduleId' };

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  RETRYING = 'retrying',
}

export enum StepType {
  COMMAND = 'command',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  DELAY = 'delay',
  SUB_WORKFLOW = 'sub_workflow',
  AI_DECISION = 'ai_decision',
  NOTIFICATION = 'notification',
  INSTRUMENT_ACTION = 'instrument_action',
  MEASUREMENT = 'measurement',
  DATA_PROCESSING = 'data_processing',
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  variables: Record<string, unknown>;
  triggers: WorkflowTrigger[];
  timeoutMs: number;
  maxRetries: number;
  onFailure: 'pause' | 'rollback' | 'continue' | 'escalate';
  metadata: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
  nextStepId?: string;
  onError?: string;       // step ID to jump to on error
  timeoutMs: number;
  retryCount: number;
}

export interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'event' | 'condition';
  config: Record<string, unknown>;
}

export interface WorkflowInstance {
  runId: AutomationRunId;
  workflowId: WorkflowId;
  status: WorkflowStatus;
  currentStepId: string;
  startedAt: number;
  completedAt?: number;
  variables: Record<string, unknown>;
  stepResults: Map<string, StepResult>;
  error?: string;
  progress: number; // 0-1
}

export interface StepResult {
  stepId: string;
  status: TaskStatus;
  output?: unknown;
  error?: string;
  startedAt: number;
  completedAt?: number;
  retryCount: number;
}

export interface ScheduledTask {
  id: ScheduleId;
  workflowId: WorkflowId;
  cronExpression: string; // or ISO interval
  nextRunAt: number;
  lastRunAt?: number;
  enabled: boolean;
  timezone: string;
  variables: Record<string, unknown>;
}

export interface AIWorkflowDecision {
  decision: string;
  confidence: number;
  reasoning: string;
  suggestedActions: WorkflowStep[];
}

export interface AutomationHealth {
  activeWorkflows: number;
  scheduledTasks: number;
  runningInstances: number;
  failedInstances24h: number;
  averageExecutionTimeMs: number;
  status: 'healthy' | 'degraded' | 'stalled';
}

export interface AutomationSnapshot {
  workflows: WorkflowDefinition[];
  activeInstances: WorkflowInstance[];
  scheduledTasks: ScheduledTask[];
  timestamp: number;
  checksum: string;
}