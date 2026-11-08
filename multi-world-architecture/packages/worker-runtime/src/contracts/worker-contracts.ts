// packages/worker-runtime/src/contracts/worker-contracts.ts
/**
 * Worker Runtime Contracts
 * 
 * Responsibilities: define strict interfaces for task execution, worker lifecycle,
 * scheduling, and telemetry.
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

export type WorkerId = string & { readonly __brand: 'WorkerId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type WorkerPoolId = string & { readonly __brand: 'WorkerPoolId' };

export enum WorkerType {
  CPU = 'cpu',
  GPU = 'gpu',
  SIMULATION = 'simulation',
  AI_INFERENCE = 'ai-inference',
  GENERAL = 'general',
}

export enum TaskPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  BACKGROUND = 5,
}

export interface WorkerCapability {
  type: WorkerType;
  maxConcurrency: number;
  gpuMemoryMB?: number;       // only for GPU workers
  simulationEngine?: string;  // e.g., "physx", "deterministic"
}

export interface WorkerNode {
  id: WorkerId;
  hostname: string;
  type: WorkerType;
  status: WorkerStatus;
  capabilities: WorkerCapability;
  registeredAt: number; // timestamp
  lastHeartbeat: number;
}

export enum WorkerStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  BUSY = 'busy',
  DRAINING = 'draining',
  UNRESPONSIVE = 'unresponsive',
  TERMINATED = 'terminated',
}

export interface TaskSpec<TA> {
  id: TaskId;
  type: string;                // task category (e.g., "simulation-step", "ai-inference")
  priority: TaskPriority;
  workerHint?: WorkerType;     // preferred worker type
  payload: TA;
  maxRetries: number;
  timeoutMs: number;
  dependencies?: TaskId[];     // tasks that must complete before this one
}

export interface TaskResult<TR> {
  taskId: TaskId;
  workerId: WorkerId;
  success: boolean;
  result?: TR;
  error?: string;
  executionTimeMs: number;
  retryCount: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  queueDepth: number;
  averageTaskTimeMs: number;
}

export interface WorkerTelemetry {
  workerId: WorkerId;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  gpuMemoryUsageMB?: number;
  uptimeSeconds: number;
  tasksCompleted: number;
  tasksFailed: number;
  lastError?: string;
}

export interface TaskQueue {
  enqueue(task: TaskSpec<any>): void;
  dequeue(workerType?: WorkerType): TaskSpec<any> | undefined;
  size(): number;
}

export interface WorkerScheduler {
  scheduleTask(task: TaskSpec<any>): Promise<TaskResult<any>>;
  getWorkerStats(): Promise<WorkerPoolStats>;
}