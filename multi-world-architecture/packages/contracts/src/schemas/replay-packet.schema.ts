// packages/contracts/src/schemas/replay-packet.schema.ts
/**
 * Replay Packet Schema
 * 
 * Responsibilities:
 * - Validate replay data packets for deterministic re-execution
 * - Ensure input and checksum fields are present
 */

import { z } from 'zod';

export const ReplayPacketSchema = z.object({
  replayId: z.string(),
  tick: z.number().int().min(0),
  input: z.unknown().optional(),
  expectedStateHash: z.string(),
  durationMs: z.number().optional(),
  timestamp: z.number(),
});

export const ReplaySessionSchema = z.object({
  replayId: z.string(),
  packets: z.array(ReplayPacketSchema),
  speedMultiplier: z.number().positive().default(1),
  loop: z.boolean().default(false),
});

export type ReplayPacket = z.infer<typeof ReplayPacketSchema>;