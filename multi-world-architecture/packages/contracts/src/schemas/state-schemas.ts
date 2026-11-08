// packages/contracts/src/schemas/state-schemas.ts
/**
 * State Schema Validators (Zod)
 * 
 * Responsibilities:
 * - Define schemas for application state snapshots, domain state, and replay frames
 * - Enforce serialization rules for offline storage and network transfer
 * - Validate state integrity after deserialization
 */

import { z } from 'zod';

// --- Domain State ---
export const DomainStateSchema = z.object({
  domainId: z.string().min(1),
  version: z.number().int().min(0),
  lastModified: z.number().int().positive(),
  checksum: z.string().min(1),
});

// --- Entity State (generic) ---
export const EntityStateSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 1]),
  properties: z.record(z.unknown()).default({}),
  instrumentBindings: z.array(z.string()).default([]),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

// --- Simulation Snapshot ---
export const SimulationSnapshotSchema = z.object({
  simulationId: z.string().min(1),
  tick: z.number().int().min(0),
  timestamp: z.number().int().positive(),
  substances: z.array(z.object({
    id: z.string(),
    name: z.string(),
    formula: z.string(),
    amount: z.number(),
    temperature: z.number(),
  })).optional(),
  entities: z.array(EntityStateSchema).optional(),
  stateHash: z.string().min(1),
});

// --- Experiment State ---
export const ExperimentStateSchema = z.object({
  experimentId: z.string().min(1),
  status: z.enum(['created', 'running', 'paused', 'completed', 'failed', 'archived']),
  currentBranchId: z.string(),
  variables: z.record(z.unknown()).default({}),
  timelineEventCount: z.number().int().min(0),
});

// --- User Session State ---
export const UserSessionStateSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  permissions: z.array(z.string()),
  lastWorldId: z.string().optional(),
  lastExperimentId: z.string().optional(),
  preferences: z.record(z.unknown()).default({}),
  validUntil: z.number().int().positive(),
});

// --- Replay Frame ---
export const ReplayFrameSchema = z.object({
  version: z.number().int().min(0),
  operation: z.object({
    type: z.enum(['set', 'delete', 'merge', 'patch']),
    entityId: z.string(),
    payload: z.unknown(),
  }),
  appliedAt: z.number().int().positive(),
  stateChecksum: z.string().min(1),
});

// --- Transaction ---
export const TransactionSchema = z.object({
  id: z.string().min(1),
  operations: z.array(z.object({
    type: z.enum(['set', 'delete', 'merge', 'patch']),
    entityId: z.string(),
    payload: z.unknown(),
    previousValue: z.unknown().optional(),
  })),
  isolation: z.enum(['read_committed', 'read_uncommitted', 'repeatable_read', 'serializable']),
  startedAt: z.number().int().positive(),
  status: z.enum(['pending', 'committed', 'rolled_back']),
});

// --- Offline Operation ---
export const OfflineOperationSchema = z.object({
  id: z.string().min(1),
  domainId: z.string().min(1),
  operation: z.object({
    type: z.enum(['set', 'delete', 'merge', 'patch']),
    entityId: z.string(),
    payload: z.unknown(),
  }),
  timestamp: z.number().int().positive(),
  sequenceNumber: z.number().int().min(0),
  retryCount: z.number().int().min(0),
  status: z.enum(['pending', 'synced', 'conflicted']),
});

// --- Type Exports ---
export type DomainState = z.infer<typeof DomainStateSchema>;
export type EntityState = z.infer<typeof EntityStateSchema>;
export type SimulationSnapshot = z.infer<typeof SimulationSnapshotSchema>;
export type ExperimentState = z.infer<typeof ExperimentStateSchema>;
export type UserSessionState = z.infer<typeof UserSessionStateSchema>;
export type ReplayFrame = z.infer<typeof ReplayFrameSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type OfflineOperation = z.infer<typeof OfflineOperationSchema>;