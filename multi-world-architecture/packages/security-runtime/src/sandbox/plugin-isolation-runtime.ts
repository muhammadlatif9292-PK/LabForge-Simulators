// packages/security-runtime/src/sandbox/plugin-isolation-runtime.ts
/**
 * Plugin Isolation Runtime
 * 
 * Responsibilities:
 * - Restrict plugin capabilities based on manifest and RBAC
 * - Proxy API calls from plugin to core system with capability validation
 * - Monitor plugin resource usage and enforce limits
 * - Manage plugin lifecycle (load, activate, deactivate, unload)
 * 
 * Owned state:
 * - pluginPermissions: Map<PluginId, Set<CapabilityId>>
 * - activePlugins: Set<PluginId>
 * 
 * Dependencies:
 * - RuntimeSandboxEngine (for execution isolation)
 * - ILogger, IMeter
 * - PermissionReconciliation (to validate capabilities)
 * 
 * Event emissions:
 * - "plugin.activated", "plugin.deactivated", "plugin.capability.denied"
 * 
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: reload plugin if crashed; restore state from checkpoint
 * Telemetry: plugin activity, violations
 * Diagnostics: per-plugin capability usage, memory
 * Accessibility: N/A
 * Performance: capability checks are fast map lookups
 * Forbidden: plugins accessing unrestricted runtime state or bypassing auth
 */

import type { CapabilityId } from '../contracts/security-contracts';
import type { RuntimeSandboxEngine } from './runtime-sandbox-engine';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class PluginIsolationRuntime {
  private pluginCapabilities: Map<string, Set<CapabilityId>> = new Map();
  private activePlugins: Set<string> = new Set();

  constructor(
    private sandboxEngine: RuntimeSandboxEngine,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  registerPlugin(pluginId: string, allowedCapabilities: CapabilityId[]): void {
    this.pluginCapabilities.set(pluginId, new Set(allowedCapabilities));
    this.logger.info(`Plugin registered: ${pluginId} with capabilities ${allowedCapabilities.join(',')}`);
  }

  async activatePlugin(pluginId: string): Promise<void> {
    if (!this.pluginCapabilities.has(pluginId)) throw new Error('Plugin not registered');
    // Create sandbox for plugin execution
    const sandboxId = await this.sandboxEngine.createSandbox({
      maxMemoryMB: 256,
      maxCpuPercent: 50,
      networkAccess: false,
      allowedModules: [],
      timeoutMs: 30000,
    });
    // Store mapping
    this.activePlugins.add(pluginId);
    this.logger.info(`Plugin activated: ${pluginId}`);
    this.meter.incrementCounter('plugin.activated');
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    this.activePlugins.delete(pluginId);
    this.logger.info(`Plugin deactivated: ${pluginId}`);
    this.meter.incrementCounter('plugin.deactivated');
  }

  canUseCapability(pluginId: string, capability: CapabilityId): boolean {
    const allowed = this.pluginCapabilities.get(pluginId);
    if (!allowed) return false;
    const ok = allowed.has(capability);
    if (!ok) this.meter.incrementCounter('plugin.capability.denied');
    return ok;
  }
}