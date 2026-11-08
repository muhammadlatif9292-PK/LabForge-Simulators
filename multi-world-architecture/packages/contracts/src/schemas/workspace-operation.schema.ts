// packages/contracts/src/schemas/workspace-operation.schema.ts
/**
 * Workspace Operation Schema
 * 
 * Responsibilities:
 * - Validate workspace mutation operations (entity CRUD, instrument bindings)
 * - Ensure deterministic serialization for replay
 */

import { z } from 'zod';

export const WorkspaceOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create_entity'),
    payload: z.object({
      entityId: z.string(),
      type: z.string(),
      position: z.tuple([z.number(), z.number(), z.number()]),
      properties: z.record(z.unknown()).optional(),
    }),
  }),
  z.object({
    operation: z.literal('update_entity'),
    payload: z.object({
      entityId: z.string(),
      changes: z.record(z.unknown()),
    }),
  }),
  z.object({
    operation: z.literal('delete_entity'),
    payload: z.object({
      entityId: z.string(),
    }),
  }),
  z.object({
    operation: z.literal('bind_instrument'),
    payload: z.object({
      entityId: z.string(),
      instrumentId: z.string(),
      offset: z.tuple([z.number(), z.number(), z.number()]).optional(),
    }),
  }),
  z.object({
    operation: z.literal('unbind_instrument'),
    payload: z.object({
      instrumentId: z.string(),
    }),
  }),
]);

export type WorkspaceOperation = z.infer<typeof WorkspaceOperationSchema>;