// testing/contracts/testing-contracts.ts
/**
 * Testing System Contracts
 * 
 * Responsibilities:
 * - Define shared types for test harnesses, fixtures, mocks, and assertions
 * - Provide deterministic seeding and snapshot comparison utilities
 * - Define simulation consistency check types
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
 * Forbidden: any runtime logic in production code
 */

export type TestSuiteId = string;
export type TestCaseId = string;
export type SnapshotId = string;

export enum TestCategory {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  PERFORMANCE = 'performance',
  GPU = 'gpu',
  AI = 'ai',
  RECOVERY = 'recovery',
  OFFLINE = 'offline',
  MULTIPLAYER = 'multiplayer',
}

export interface TestCase {
  id: TestCaseId;
  suiteId: TestSuiteId;
  name: string;
  category: TestCategory;
  timeoutMs: number;
  tags: string[];
  skip: boolean;
  only: boolean;
}

export interface DeterminismTestHarness<TState> {
  /** Seed for the deterministic PRNG */
  seed: number;
  /** Initial state factory */
  createInitialState: () => TState;
  /** Step function: given a state and a deterministic input, produce a new state */
  step: (state: TState, input: unknown, rng: DeterministicRNG) => TState;
  /** State serializer for checksum comparison */
  serialize: (state: TState) => string;
  /** Number of steps to run */
  stepCount: number;
  /** Generate the nth deterministic input */
  inputGenerator: (stepIndex: number, rng: DeterministicRNG) => unknown;
}

export interface DeterministicRNG {
  next(): number;
  seed: number;
}

export interface DeterminismResult {
  passed: boolean;
  /** Checksum of the final state */
  finalChecksum: string;
  /** Number of steps executed */
  stepsExecuted: number;
  /** Duration in ms */
  durationMs: number;
  /** Per-step state hashes (sampled every N steps) */
  sampleHashes: Array<{ step: number; hash: string }>;
}

export interface OfflineRecoveryHarness {
  /** Name of the subsystem under test */
  subsystem: string;
  /** Execute an operation that mutates state while online */
  onlineOperation: () => Promise<void>;
  /** Simulate going offline */
  goOffline: () => Promise<void>;
  /** Execute an operation while offline (should be queued) */
  offlineOperation: () => Promise<void>;
  /** Simulate coming back online */
  goOnline: () => Promise<void>;
  /** Verify queued operations were replayed and state is consistent */
  verifyRecovery: () => Promise<boolean>;
  /** Cleanup after test */
  cleanup: () => Promise<void>;
}

export interface PerformanceBenchmark {
  name: string;
  category: TestCategory;
  /** Run the benchmark and return metrics */
  run: () => Promise<BenchmarkResult>;
  /** Maximum acceptable values */
  thresholds: BenchmarkThresholds;
}

export interface BenchmarkResult {
  name: string;
  durationMs: number;
  operationsPerSecond?: number;
  memoryDeltaBytes?: number;
  fps?: number;
  p50Ms?: number;
  p99Ms?: number;
  passed: boolean;
}

export interface BenchmarkThresholds {
  maxDurationMs?: number;
  minOpsPerSecond?: number;
  maxMemoryDeltaBytes?: number;
  minFps?: number;
  maxP50Ms?: number;
  maxP99Ms?: number;
}

export interface MultiplayerSyncHarness {
  nodeCount: number;
  /** Create a node instance */
  createNode: (nodeId: string) => Promise<MultiplayerNode>;
  /** Run a test scenario */
  scenario: (nodes: MultiplayerNode[]) => Promise<void>;
  /** Verify all nodes reached the same state */
  verifyConsistency: () => Promise<boolean>;
}

export interface MultiplayerNode {
  nodeId: string;
  executeOperation: (op: unknown) => Promise<void>;
  getStateChecksum: () => Promise<string>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
}

export interface GPUComputeHarness {
  /** Verify GPU is available */
  isGPUAvailable: () => Promise<boolean>;
  /** Run a compute shader and verify CPU vs GPU results match */
  verifyCPUvsGPU: (input: Float32Array, tolerance: number) => Promise<boolean>;
  /** Benchmark GPU vs CPU */
  benchmark: (inputSize: number) => Promise<{ gpuTimeMs: number; cpuTimeMs: number; speedup: number }>;
}

export interface AIStreamingHarness {
  /** Simulate an AI streaming response */
  simulateStream: (prompt: string) => AsyncGenerator<string>;
  /** Validate that hallucinations are caught */
  verifyHallucinationDetection: (response: string) => boolean;
  /** Verify streaming token order is preserved */
  verifyTokenOrdering: (tokens: string[]) => boolean;
}