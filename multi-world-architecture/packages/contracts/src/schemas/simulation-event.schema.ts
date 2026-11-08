// packages/contracts/src/schemas/simulation-event.schema.ts
/**
 * Simulation Event Schema
 * 
 * Responsibilities:
 * - Validate all simulation lifecycle and tick events
 * - Ensure replay packets have all required fields
 */

import { z } from 'zod';

export const SimulationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('simulation.tick'),
    payload: z.object({
      simulationId: z.string(),
      tick: z.number().int().min(0),
      stateHash: z.string(),
      entityCount: z.number().int().min(0),
      durationMs: z.number(),
    }),
  }),
  z.object({
    type: z.literal('simulation.entity.created'),
    payload: z.object({
      simulationId: z.string(),
      entityId: z.string(),
      type: z.string(),
      position: z.tuple([z.number(), z.number(), z.number()]),
    }),
  }),
  z.object({
    type: z.literal('simulation.entity.destroyed'),
    payload: z.object({
      simulationId: z.string(),
      entityId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('simulation.collision'),
    payload: z.object({
      simulationId: z.string(),
      entityA: z.string(),
      entityB: z.string(),
      impulse: z.number(),
    }),
  }),
  z.object({
    type: z.literal('simulation.checkpoint.created'),
    payload: z.object({
      simulationId: z.string(),
      tick: z.number(),
      checksum: z.string(),
    }),
  }),
]);

export type SimulationEvent = z.infer<typeof SimulationEventSchema>;