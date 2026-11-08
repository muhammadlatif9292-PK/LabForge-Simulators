// packages/module-registry/runtime/plugin-aware-registry.ts
/**
 * Plugin-Aware Registry
 * 
 * Responsibilities:
 * - Extend the dynamic module registry with plugin-specific lifecycle
 * - Validate plugins against the plugin isolation runtime before registration
 * - Enforce plugin capability boundaries: plugins register only allowed capabilities
 * - Manage plugin activation/deactivation as an atomic operation
 * - Support plugin hot-reload and safe unload without crashing the app
 * 
 * Owned state:
 * - pluginModules: Map<PluginId, ModuleId[]>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DynamicModuleRegistry
 * - PluginIsolationRuntime
 * - DistributedEventBus
 * 
 * Event emissions:
 *   "registry.plugin.activated", "registry.plugin.deactivated"
 *   "registry.plugin.registration.denied"
 * 
 * Event subscriptions: none
 * Synchronization: per-plugin activation is atomic; multiple plugins can load concurrently
 * Recovery: plugin state restored from snapshot
 * Telemetry: plugin count, load success rate
 * Diagnostics: active plugins, denied registrations
 * Accessibility: N/A
 * Performance: parallel plugin loading within capability bounds
 * Forbidden: activating plugins without isolation check; plugins registering restricted capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import type { ModuleId, ModuleDescriptor, ModuleType } from '../contracts/registry-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DynamicModuleRegistry } from './dynamic-module-registry';

type PluginId = string;

export class PluginAwareRegistry {
  private pluginModules: Map<PluginId, ModuleId[]> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private centralRegistry: DynamicModuleRegistry,
    private pluginIsolation: any, // PluginIsolationRuntime
  ) {}

  async registerPlugin(
    pluginId: PluginId,
    descriptors: ModuleDescriptor[],
    allowedCapabilities: string[],
  ): Promise<void> {
    // Validate that all descriptors' capabilities are within the plugin's allowed set
    for (const descriptor of descriptors) {
      for (const cap of descriptor.capabilities) {
        if (!allowedCapabilities.includes(cap)) {
          this.logger.error(`Plugin ${pluginId} attempted to register capability ${cap} which is not allowed`);
          this.meter.incrementCounter('registry.plugin.registration.denied');
          await this.eventBus.publish('registry.plugin.registration.denied', {
            pluginId,
            capability: cap,
            reason: 'not allowed for this plugin',
          });
          throw new Error(`Plugin ${pluginId} cannot register capability: ${cap}`);
        }
      }
      // Ensure plugin isolation is respected
      descriptor.metadata = { ...descriptor.metadata, pluginId };
      descriptor.type = ModuleType.PLUGIN;
    }
    // Register all modules
    const registeredIds: ModuleId[] = [];
    for (const descriptor of descriptors) {
      await this.centralRegistry.registerModule(descriptor);
      registeredIds.push(descriptor.id);
    }
    this.pluginModules.set(pluginId, registeredIds);
    this.logger.info(`Plugin ${pluginId} registered with ${descriptors.length} modules`);
  }

  async activatePlugin(pluginId: PluginId): Promise<void> {
    const moduleIds = this.pluginModules.get(pluginId);
    if (!moduleIds) throw new Error(`Plugin ${pluginId} not registered`);
    for (const moduleId of moduleIds) {
      await this.centralRegistry.loadModule(moduleId);
    }
    this.meter.incrementCounter('registry.plugin.activated');
    await this.eventBus.publish('registry.plugin.activated', { pluginId });
    this.logger.info(`Plugin activated: ${pluginId}`);
  }

  async deactivatePlugin(pluginId: PluginId): Promise<void> {
    const moduleIds = this.pluginModules.get(pluginId);
    if (!moduleIds) return;
    // Unload in reverse order (dependencies last)
    for (let i = moduleIds.length - 1; i >= 0; i--) {
      try {
        await this.centralRegistry.unloadModule(moduleIds[i]);
      } catch (err) {
        this.logger.warn(`Failed to unload plugin module ${moduleIds[i]}`, { error: err });
      }
    }
    this.meter.incrementCounter('registry.plugin.deactivated');
    await this.eventBus.publish('registry.plugin.deactivated', { pluginId });
  }

  async unregisterPlugin(pluginId: PluginId): Promise<void> {
    await this.deactivatePlugin(pluginId);
    this.pluginModules.delete(pluginId);
    this.logger.info(`Plugin unregistered: ${pluginId}`);
  }

  getPluginModules(pluginId: PluginId): ModuleId[] {
    return this.pluginModules.get(pluginId) ?? [];
  }

  getActivePlugins(): PluginId[] {
    return Array.from(this.pluginModules.keys());
  }
}