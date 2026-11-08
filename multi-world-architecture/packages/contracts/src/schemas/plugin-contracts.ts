// packages/contracts/src/schemas/plugin-contracts.ts
/**
 * Plugin Contract Schemas (Zod)
 * 
 * Responsibilities:
 * - Validate plugin manifest structure at registration time
 * - Define sandbox policy constraints
 * - Version compatibility checking
 */

import { z } from 'zod';

export const SandboxPolicySchema = z.object({
  maxMemoryMB: z.number().int().min(16).max(1024),
  maxCpuPercent: z.number().int().min(10).max(100),
  networkAccess: z.boolean().default(false),
  allowedModules: z.array(z.string()).default([]),
  timeoutMs: z.number().int().min(1000).max(60000).default(30000),
});

export const ModuleDescriptorSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['core', 'world', 'instrument', 'simulation', 'plugin', 'ai-agent', 'rendering', 'runtime', 'ui', 'utility']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver (x.y.z)'),
  capabilities: z.array(z.string()).default([]),
  dependencies: z.array(z.object({
    moduleId: z.string().min(1),
    versionRange: z.string().min(1),
    optional: z.boolean().default(false),
    reason: z.string(),
  })).default([]),
  provider: z.object({
    loader: z.string().min(1),
    timeoutMs: z.number().int().positive().default(10000),
    retryCount: z.number().int().min(0).default(2),
  }),
  metadata: z.record(z.unknown()).default({}),
});

export const PluginManifestSchema = z.object({
  id: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/, 'Plugin ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver'),
  description: z.string().min(10).max(500),
  author: z.string().min(1),
  capabilities: z.array(z.string()).min(1, 'At least one capability required'),
  modules: z.array(ModuleDescriptorSchema).min(1, 'At least one module required'),
  permissions: z.array(z.string()).default([]),
  sandboxPolicy: SandboxPolicySchema,
  icon: z.string().optional(),
  homepage: z.string().url().optional(),
  minLabforgeVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});

export const PluginActivationRequestSchema = z.object({
  pluginId: z.string().min(1),
  activationToken: z.string().optional(),
});

export const PluginDeactivationRequestSchema = z.object({
  pluginId: z.string().min(1),
  force: z.boolean().default(false),
});

export const PluginHealthReportSchema = z.object({
  pluginId: z.string(),
  status: z.enum(['registered', 'loading', 'active', 'inactive', 'error', 'unloaded']),
  moduleStatuses: z.record(z.string(), z.enum(['registered', 'loading', 'active', 'error', 'unloaded'])),
  memoryUsageBytes: z.number().int().min(0),
  uptimeSeconds: z.number().int().min(0),
  lastError: z.string().optional(),
});

export type SandboxPolicy = z.infer<typeof SandboxPolicySchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginHealthReport = z.infer<typeof PluginHealthReportSchema>;