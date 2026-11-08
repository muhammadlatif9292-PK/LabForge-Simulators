// packages/contracts/src/schemas/AI-stream.schema.ts
/**
 * AI Stream Schema
 * 
 * Responsibilities:
 * - Validate streaming AI response chunks
 * - Detect malformed or incomplete streams
 */

import { z } from 'zod';

export const AIStreamChunkSchema = z.object({
  streamId: z.string(),
  sequenceNumber: z.number().int().min(0),
  chunk: z.string(),
  isFinal: z.boolean(),
  reasoningSteps: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.number(),
});

export const AIStreamStartSchema = z.object({
  streamId: z.string(),
  context: z.record(z.unknown()),
});

export const AIStreamCancelSchema = z.object({
  streamId: z.string(),
  reason: z.string().optional(),
});

export type AIStreamChunk = z.infer<typeof AIStreamChunkSchema>;