// packages/state-runtime/contracts/state-contracts.ts
/**
 * Advanced State Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for transactional state, domain state, replay,
 *   offline reconciliation, distributed hydration, and state recovery
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

export type StateEntityId = string & { readonly __brand: 'StateEntityId' };
export type TransactionId = string & { readonly __brand: 'TransactionId' };
export type DomainId = string & { readonly __brand: 'DomainId' };
export type StateVersion = number;

export enum TransactionIsolation {
  READ_COMMITTED = 'read_committed',
  READ_UNCOMMITTED = 'read_uncommitted',
  REPEATABLE_READ = 'repeatable_read',
  SERIALIZABLE = 'serializable',
}

export interface Transaction {
  id: TransactionId;
  operations: StateOperation[];
  isolation: TransactionIsolation;
  startedAt: number;
  status: 'pending' | 'committed' | 'rolled_back';
}

export interface StateOperation {
  type: 'set' | 'delete' | 'merge' | 'patch';
  entityId: StateEntityId;
  payload: unknown;
  previousValue?: unknown;
}

export interface DomainState {
  domainId: DomainId;
  entities: Map<StateEntityId, unknown>;
  version: StateVersion;
  lastModified: number;
  checksum: string;
}

export interface StateSnapshot {
  id: string;
  domainId: DomainId;
  state: DomainState;
  version: StateVersion;
  timestamp: number;
  checksum: string;
}

export interface ReplayFrame {
  version: StateVersion;
  operation: StateOperation;
  appliedAt: number;
  stateChecksum: string;
}

export interface OfflineOperation {
  id: string;
  domainId: DomainId;
  operation: StateOperation;
  timestamp: number;
  sequenceNumber: number;
  retryCount: number;
  status: 'pending' | 'synced' | 'conflicted';
}

export interface HydrationRequest {
  domainId: DomainId;
  fromVersion: StateVersion;
  requestingNode: string;
}

export interface HydrationResponse {
  domainId: DomainId;
  currentVersion: StateVersion;
  snapshot?: StateSnapshot;
  incrementalOps?: StateOperation[];
}

export interface StateHealth {
  domainCount: number;
  totalEntities: number;
  pendingOfflineOps: number;
  lastSnapshotVersion: StateVersion;
  recoveryReady: boolean;
}