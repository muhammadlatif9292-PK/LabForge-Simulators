// packages/contracts/src/schemas/render-pipeline.schema.ts
/**
 * Render Pipeline Schema
 * 
 * Responsibilities:
 * - Validate render pass descriptors, GPU resource requests
 * - Ensure correct texture format enums
 */

import { z } from 'zod';

export const RenderPassDescriptorSchema = z.object({
  passId: z.string(),
  type: z.enum(['opaque', 'transparent', 'overlay', 'postprocess', 'debug']),
  shaders: z.array(z.object({
    shaderId: z.string(),
    vertexEntry: z.string(),
    fragmentEntry: z.string(),
  })),
  inputs: z.array(z.object({
    textureId: z.string(),
    format: z.enum(['rgba8', 'depth24', 'rgba16f', 'r8']),
  })),
  outputs: z.array(z.object({
    textureId: z.string(),
    format: z.enum(['rgba8', 'depth24', 'rgba16f', 'r8']),
  })),
  clearColor: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  viewport: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
});

export const RenderFrameSchema = z.object({
  frameId: z.string(),
  passes: z.array(RenderPassDescriptorSchema),
  targetFPS: z.number().min(1).max(144),
});

export type RenderPassDescriptor = z.infer<typeof RenderPassDescriptorSchema>;