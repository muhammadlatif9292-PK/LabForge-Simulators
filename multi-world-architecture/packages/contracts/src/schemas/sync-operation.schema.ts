// packages/contracts/src/schemas/sync-operation.schema.ts
/**
 * Sync Operation Schema
 * 
 * Responsibilities:
 * - Validate operations exchanged during state synchronization
 * - Capture causal dependencies and version vectors
 */

import { z } from 'zod';

export const SyncOperationSchema = z.object({
  operationId: z.string(),
  entityId: z.string(),
  type: z.enum(['set', 'delete', 'merge']),
  payload: z.unknown(),
  timestamp: z.number(),
  causalDependencies: z.array(z.string()).optional(),
  vectorClock: z.record(z.string(), z.number()).optional(),
  nodeId: z.string(),
});

export const SyncStateHashSchema = z.object({
  nodeId: z.string(),
  stateHash: z.string(),
  tick: z.number(),
});

export type SyncOperation = z.infer<typeof SyncOperationSchema>;