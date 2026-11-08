// packages/contracts/src/schemas/command-schemas.ts
/**
 * Command Schema Validators (Zod)
 * 
 * Responsibilities:
 * - Define schemas for all command types in the command framework
 * - Validate command payloads before execution
 * - Provide command type registry for runtime dispatch
 * 
 * Owned state: none
 * Dependencies: zod
 */

import { z } from 'zod';

// --- Core Command Metadata ---
export const CommandMetadataSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().int().positive(),
  causationId: z.string().optional(),
  correlationId: z.string().optional(),
  priority: z.number().int().min(0).max(10).default(5),
  ttl: z.number().int().positive().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

// --- Generic Command ---
export const CommandSchema = <TPayload extends z.ZodTypeAny>(type: string, payloadSchema: TPayload) =>
  z.object({
    id: z.string().min(1),
    type: z.literal(type),
    payload: payloadSchema,
    metadata: CommandMetadataSchema,
  });

// --- Instrument Commands ---
export const InstrumentGrabCommandSchema = z.object({
  instrumentId: z.string().min(1),
  pointerId: z.number().int(),
  position: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

export const InstrumentReleaseCommandSchema = z.object({
  instrumentId: z.string().min(1),
});

export const InstrumentConfigureCommandSchema = z.object({
  instrumentId: z.string().min(1),
  config: z.record(z.unknown()),
});

// --- World Commands ---
export const WorldLoadCommandSchema = z.object({
  worldId: z.string().min(1),
  restoreFromCheckpoint: z.boolean().default(false),
});

export const WorldUnloadCommandSchema = z.object({
  worldId: z.string().min(1),
});

export const EntityCreateCommandSchema = z.object({
  worldId: z.string().min(1),
  type: z.string().min(1),
  position: z.tuple([z.number(), z.number(), z.number()]),
  properties: z.record(z.unknown()).optional(),
});

// --- Simulation Commands ---
export const SimulationStartCommandSchema = z.object({
  simulationId: z.string().min(1),
  tickRateHz: z.number().int().min(1).max(120),
});

export const SimulationStopCommandSchema = z.object({
  simulationId: z.string().min(1),
});

// --- AI Commands ---
export const AIAskCommandSchema = z.object({
  question: z.string().min(1).max(2000),
  context: z.record(z.unknown()).optional(),
});

export const AISuggestionCommandSchema = z.object({
  target: z.string(),
  suggestion: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

// --- Collaboration Commands ---
export const CollaborationJoinCommandSchema = z.object({
  sessionId: z.string().min(1),
  displayName: z.string().min(1).max(50),
});

export const CollaborationLeaveCommandSchema = z.object({
  sessionId: z.string().min(1),
});

// --- Experiment Commands ---
export const ExperimentStartCommandSchema = z.object({
  experimentId: z.string().min(1),
  hypothesis: z.string().optional(),
});

export const ExperimentRecordMeasurementCommandSchema = z.object({
  experimentId: z.string().min(1),
  instrumentId: z.string().min(1),
  value: z.number(),
  unit: z.string(),
});

// --- Command Registry ---
export const CommandSchemas = {
  'instrument.grab': InstrumentGrabCommandSchema,
  'instrument.release': InstrumentReleaseCommandSchema,
  'instrument.configure': InstrumentConfigureCommandSchema,
  'world.load': WorldLoadCommandSchema,
  'world.unload': WorldUnloadCommandSchema,
  'entity.create': EntityCreateCommandSchema,
  'simulation.start': SimulationStartCommandSchema,
  'simulation.stop': SimulationStopCommandSchema,
  'ai.ask': AIAskCommandSchema,
  'ai.suggestion': AISuggestionCommandSchema,
  'collaboration.join': CollaborationJoinCommandSchema,
  'collaboration.leave': CollaborationLeaveCommandSchema,
  'experiment.start': ExperimentStartCommandSchema,
  'experiment.record_measurement': ExperimentRecordMeasurementCommandSchema,
} as const;

export type CommandType = keyof typeof CommandSchemas;
export type CommandPayload<T extends CommandType> = z.infer<(typeof CommandSchemas)[T]>;