// packages/synchronization-runtime/src/contracts/sync-contracts.ts
/**
 * Synchronization Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for distributed synchronization, conflict resolution,
 *   operation ordering, and offline reconciliation
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a (this file defines the contracts for sync itself)
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type SyncSessionId = string & { readonly __brand: 'SyncSessionId' };
export type OperationSequence = number & { readonly __brand: 'OperationSequence' };
export type StateHash = string & { readonly __brand: 'StateHash' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type ReplicaId = string & { readonly __brand: 'ReplicaId' };

export enum ConflictStrategy {
  LAST_WRITER_WINS = 'lww',
  OPERATIONAL_TRANSFORM = 'ot',
  CRDT = 'crdt',
  THREE_WAY_MERGE = 'three-way-merge',
  CUSTOM = 'custom',
}

export interface SyncOperation {
  id: string;
  type: string;
  payload: unknown;
  userId: string;
  timestamp: number;
  sequenceNumber: OperationSequence;
  stateHashBefore?: StateHash;
  retryCount: number;
  status: 'pending' | 'applied' | 'conflicted' | 'failed';
}

export interface ConflictRecord {
  operationId: string;
  conflictingOperations: string[];
  resolvedBy: ConflictStrategy;
  resolvedAt: number;
  resolution: unknown; // merged state
  originalPayloads: unknown[];
}

export interface SyncState {
  nodeId: NodeId;
  lastSequence: OperationSequence;
  stateHash: StateHash;
  historySize: number;
  uptimeMs: number;
}

export interface OfflineOperationQueue {
  operations: SyncOperation[];
  oldestTimestamp: number;
  newestTimestamp: number;
}

export interface ReconciliationResult {
  consistent: boolean;
  divergenceCount: number;
  mergedOperations: SyncOperation[];
  conflicts: ConflictRecord[];
  newStateHash: StateHash;
}

export interface OperationOrder {
  operationId: string;
  globalOrder: number;
  causalDependencies: string[];
  timestamp: number;
  vectorClock: Record<NodeId, number>;
}

export interface VectorClock {
  clock: Record<NodeId, number>;
}

export interface SyncHealth {
  status: 'synced' | 'reconciling' | 'diverged' | 'degraded';
  pendingOperations: number;
  conflictCount: number;
  lastSyncTimestamp: number;
  replicasInSync: number;
  totalReplicas: number;
}