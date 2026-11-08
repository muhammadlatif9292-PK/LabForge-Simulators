// infrastructure/database/src/contracts/database-contracts.ts
/**
 * Database Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for persistence layer components
 * - Ensure typed streams, transactions, and replication primitives
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

export type TransactionId = string & { readonly __brand: 'TransactionId' };
export type StreamId = string & { readonly __brand: 'StreamId' };
export type EventVersion = number;
export type SequenceNumber = number & { readonly __brand: 'SequenceNumber' };

export interface DatabaseEvent {
  streamId: StreamId;
  eventType: string;
  eventData: unknown;
  metadata: DatabaseEventMetadata;
}

export interface DatabaseEventMetadata {
  eventId: string;
  correlationId: string;
  causationId?: string;
  timestamp: number;
  version: EventVersion;
  sequenceNumber: SequenceNumber;
}

export interface TransactionContext {
  id: TransactionId;
  startedAt: number;
  isolationLevel: 'read_committed' | 'repeatable_read' | 'serializable';
  operations: DatabaseOperation[];
}

export type DatabaseOperation = InsertOperation | UpdateOperation | DeleteOperation;

export interface InsertOperation {
  type: 'insert';
  collection: string;
  document: unknown;
}

export interface UpdateOperation {
  type: 'update';
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
}

export interface DeleteOperation {
  type: 'delete';
  collection: string;
  filter: Record<string, unknown>;
}

export interface Snapshot {
  id: string;
  streamId: StreamId;
  data: unknown;
  sequenceNumber: SequenceNumber;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface OfflineOperation {
  id: string;
  userId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  sequenceNumber: number;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ReplicationStatus {
  nodeId: string;
  role: 'primary' | 'secondary' | 'arbiter';
  lastAppliedSequence: SequenceNumber;
  lagMs: number;
  healthy: boolean;
}