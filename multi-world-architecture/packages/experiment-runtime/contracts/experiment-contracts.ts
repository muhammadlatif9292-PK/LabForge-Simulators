// packages/experiment-runtime/contracts/experiment-contracts.ts
/**
 * Experiment Runtime Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for experiment lifecycle, timeline, branching,
 *   serialization, autosave, replay, and recovery
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

export type ExperimentId = string & { readonly __brand: 'ExperimentId' };
export type BranchId = string & { readonly __brand: 'BranchId' };
export type TimelineEventId = string & { readonly __brand: 'TimelineEventId' };
export type SnapshotId = string & { readonly __brand: 'SnapshotId' };
export type ReplaySessionId = string & { readonly __brand: 'ReplaySessionId' };

export enum ExperimentStatus {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

export enum TimelineEventType {
  MEASUREMENT = 'measurement',
  INSTRUMENT_ACTION = 'instrument_action',
  OBSERVATION = 'observation',
  HYPOTHESIS = 'hypothesis',
  CONCLUSION = 'conclusion',
  BRANCH_CREATED = 'branch_created',
  BRANCH_MERGED = 'branch_merged',
  SNAPSHOT = 'snapshot',
  ERROR = 'error',
  USER_NOTE = 'user_note',
  AI_SUGGESTION = 'ai_suggestion',
}

export interface ExperimentDescriptor {
  id: ExperimentId;
  title: string;
  description: string;
  worldId: string;
  instrumentIds: string[];
  hypothesis?: string;
  tags: string[];
  createdAt: number;
  lastModifiedAt: number;
  status: ExperimentStatus;
  currentBranchId: BranchId;
}

export interface TimelineEvent {
  id: TimelineEventId;
  experimentId: ExperimentId;
  branchId: BranchId;
  type: TimelineEventType;
  timestamp: number;
  sequenceNumber: number;
  actor: 'user' | 'ai' | 'system';
  payload: unknown;
  metadata: Record<string, unknown>;
  parentEventId?: TimelineEventId;
}

export interface ExperimentBranch {
  id: BranchId;
  experimentId: ExperimentId;
  name: string;
  description: string;
  parentBranchId?: BranchId;
  forkedFromEventId?: TimelineEventId;
  createdAt: number;
  lastEventSequence: number;
  status: 'active' | 'merged' | 'abandoned';
}

export interface ExperimentSnapshot {
  id: SnapshotId;
  experimentId: ExperimentId;
  branchId: BranchId;
  sequenceNumber: number;
  state: ExperimentStateData;
  createdAt: number;
  checksum: string;
  compressed: boolean;
  sizeBytes: number;
}

export interface ExperimentStateData {
  measurements: any[];
  instrumentStates: Record<string, any>;
  variables: Record<string, unknown>;
  simulationTick: number;
  notes: string;
}

export interface ExperimentSession {
  descriptor: ExperimentDescriptor;
  branches: Branch[];
  activeBranchId: BranchId;
  timeline: TimelineEvent[];
  autoSaveInterval: number;
  dirty: boolean;
}

export interface AutosaveConfig {
  intervalMs: number;
  maxSnapshots: number;
  compress: boolean;
  onSaved?: (snapshot: ExperimentSnapshot) => void;
  onError?: (error: Error) => void;
}

export interface ReplayConfig {
  speedMultiplier: number;
  stopOnError: boolean;
  loop: boolean;
  fromSequence: number;
  toSequence?: number;
}

export interface ExperimentHealth {
  experimentId: ExperimentId;
  status: ExperimentStatus;
  totalEvents: number;
  branches: number;
  lastSnapshotTimestamp?: number;
  unsavedEvents: number;
  recoveryState: 'healthy' | 'recovering' | 'corrupted';
}