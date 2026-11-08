// packages/contracts/src/schemas/websocket-payload.schema.ts
/**
 * WebSocket Payload Schema
 * 
 * Responsibilities:
 * - Validate all messages exchanged over WebSocket
 * - Support presence, operation, and control messages
 */

import { z } from 'zod';

export const WsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('operation'),
    payload: z.object({
      operationId: z.string(),
      userId: z.string(),
      commandType: z.string(),
      commandPayload: z.unknown(),
      timestamp: z.number(),
      sequenceNumber: z.number(),
    }),
  }),
  z.object({
    type: z.literal('presence'),
    payload: z.object({
      userId: z.string(),
      status: z.enum(['online', 'away', 'busy', 'offline']),
      instrumentFocus: z.string().optional(),
      lastSeen: z.number(),
    }),
  }),
  z.object({
    type: z.literal('heartbeat'),
    payload: z.object({
      timestamp: z.number(),
    }),
  }),
  z.object({
    type: z.literal('error'),
    payload: z.object({
      code: z.number(),
      message: z.string(),
    }),
  }),
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;