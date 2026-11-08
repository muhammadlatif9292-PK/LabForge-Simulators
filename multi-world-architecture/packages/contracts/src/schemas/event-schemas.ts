// packages/contracts/src/schemas/event-schemas.ts
/**
 * Event Schema Validators (Zod)
 * 
 * Responsibilities:
 * - Define runtime-validatable schemas for all event bus payloads
 * - Guarantee shape, type, and metadata consistency across services
 * - Enable automatic OpenAPI/Swagger generation from schemas
 * - Provide safe parsing functions with structured error reporting
 * 
 * Owned state: none (pure validators)
 * Dependencies: zod
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: validation errors logged via observability
 * Diagnostics: schema mismatch reports
 * Accessibility: N/A
 * Performance: schema compilation cached; validation is O(n) on payload size
 * Forbidden: accepting data that fails schema validation
 */

import { z } from 'zod';

// --- Core Event Metadata ---
export const EventMetadataSchema = z.object({
  eventId: z.string().min(1, 'EventId is required'),
  correlationId: z.string().min(1, 'CorrelationId is required'),
  causationId: z.string().optional(),
  timestamp: z.number().int().positive('Timestamp must be positive'),
  schemaVersion: z.number().int().min(1),
  priority: z.number().int().min(0).max(4).default(2),
  source: z.string().min(1),
  replay: z.boolean().default(false),
  ttl: z.number().int().positive().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

// --- Generic Event ---
export const EventSchema = <TPayload extends z.ZodTypeAny>(payloadSchema: TPayload) =>
  z.object({
    type: z.string().min(1),
    payload: payloadSchema,
    metadata: EventMetadataSchema,
  });

// --- Common Payloads ---
export const InstrumentMeasurementPayloadSchema = z.object({
  instrumentId: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  standardUncertainty: z.number().min(0).default(0),
  timestamp: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const WorldEntityPayloadSchema = z.object({
  entityId: z.string().min(1),
  type: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  properties: z.record(z.unknown()).optional(),
});

export const CommandExecutedPayloadSchema = z.object({
  commandId: z.string().min(1),
  commandType: z.string(),
  userId: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number(),
});

export const SimulationTickPayloadSchema = z.object({
  simulationId: z.string().min(1),
  tick: z.number().int().min(0),
  entityCount: z.number().int().min(0),
  stateHash: z.string().min(1),
});

export const CollaborationPresencePayloadSchema = z.object({
  sessionId: z.string().min(1),
  participants: z.array(z.object({
    id: z.string(),
    displayName: z.string(),
    status: z.enum(['online', 'away', 'busy', 'offline']),
    instrumentFocus: z.string().optional(),
    handRaised: z.boolean(),
    muted: z.boolean(),
  })),
});

export const AssetDownloadPayloadSchema = z.object({
  assetId: z.string().min(1),
  bytesDownloaded: z.number().int().min(0),
  totalBytes: z.number().int().positive(),
  state: z.enum(['queued', 'downloading', 'paused', 'completed', 'failed', 'corrupt']),
});

export const AIStreamChunkPayloadSchema = z.object({
  streamId: z.string().min(1),
  chunk: z.string(),
  isFinal: z.boolean(),
  reasoningTrace: z.array(z.string()).optional(),
});

// --- TypeScript type inference helpers ---
export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type InstrumentMeasurementPayload = z.infer<typeof InstrumentMeasurementPayloadSchema>;
export type WorldEntityPayload = z.infer<typeof WorldEntityPayloadSchema>;
export type CommandExecutedPayload = z.infer<typeof CommandExecutedPayloadSchema>;
export type SimulationTickPayload = z.infer<typeof SimulationTickPayloadSchema>;
export type CollaborationPresencePayload = z.infer<typeof CollaborationPresencePayloadSchema>;
export type AssetDownloadPayload = z.infer<typeof AssetDownloadPayloadSchema>;
export type AIStreamChunkPayload = z.infer<typeof AIStreamChunkPayloadSchema>;

// --- Validation Function ---
export function validateEventPayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  eventType: string,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: result.error };
  }
  return { success: true, data: result.data };
}