// packages/module-registry/runtime/dynamic-module-registry.ts
/**
 * Dynamic Module Registry
 * 
 * Responsibilities:
 * - Register, load, unload, and query modules at runtime
 * - Enforce load order respecting dependency constraints
 * - Track module lifecycle states and emit state-change events
 * - Support hot-reloading by replacing active modules
 * - Validate module descriptors against capability requirements
 * 
 * Owned state:
 * - modules: Map<ModuleId, ModuleInstance>
 * - loading: Set<ModuleId> (in-progress loads)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - DependencyGraphEngine (to resolve load order)
 * - LazyModuleLoader (to execute async imports)
 * - CapabilityRegistry (to validate capabilities)
 * - RegistryRecoveryEngine
 * 
 * Event emissions:
 *   "registry.module.registered", "registry.module.loaded"
 *   "registry.module.unloaded", "registry.module.error"
 * 
 * Event subscriptions: none
 * Synchronization: loading serialised per module; concurrent loads for independent modules
 * Recovery: restore registry state from snapshot after crash
 * Telemetry: module count per type, load latency, error rate
 * Diagnostics: module status list, dependency graph visualization
 * Accessibility: N/A
 * Performance: lazy loading minimises startup cost; parallel loads for independent modules
 * Forbidden: loading modules with unresolved circular dependencies; blocking app startup
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ModuleId, ModuleType, ModuleDescriptor, ModuleInstance,
  ModuleStatus, ModuleDependency, DiscoveryQuery, RegistryHealth,
} from '../contracts/registry-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DependencyGraphEngine } from './dependency-graph-engine';
import type { LazyModuleLoader } from './lazy-module-loader';
import type { CapabilityRegistry } from './capability-registry';
import type { RegistryRecoveryEngine } from './registry-recovery-engine';

export class DynamicModuleRegistry {
  private modules: Map<ModuleId, ModuleInstance> = new Map();
  private loading: Set<ModuleId> = new Set();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private graphEngine: DependencyGraphEngine,
    private lazyLoader: LazyModuleLoader,
    private capabilityRegistry: CapabilityRegistry,
    private recovery: RegistryRecoveryEngine,
  ) {}

  async registerModule(descriptor: ModuleDescriptor): Promise<void> {
    if (this.modules.has(descriptor.id)) {
      this.logger.warn(`Module already registered: ${descriptor.id}, replacing`);
    }
    const instance: ModuleInstance = {
      descriptor,
      status: ModuleStatus.REGISTERED,
      exports: null,
    };
    this.modules.set(descriptor.id, instance);
    this.graphEngine.addNode(descriptor);
    // Register capabilities
    for (const capId of descriptor.capabilities) {
      this.capabilityRegistry.registerCapabilityProvider(capId, descriptor.id);
    }
    this.meter.incrementCounter('registry.module.registered', { type: descriptor.type });
    this.logger.debug(`Module registered: ${descriptor.id} (v${descriptor.version})`);
    await this.eventBus.publish('registry.module.registered', {
      moduleId: descriptor.id,
      type: descriptor.type,
      version: descriptor.version,
    });
    // Auto-save for recovery
    this.recovery.saveRegistrySnapshot(this.getAllDescriptors(), this.capabilityRegistry.getAllCapabilities());
  }

  async loadModule(moduleId: ModuleId, options?: { loadDependencies?: boolean }): Promise<unknown> {
    const instance = this.modules.get(moduleId);
    if (!instance) throw new Error(`Module not registered: ${moduleId}`);
    if (instance.status === ModuleStatus.ACTIVE) return instance.exports;
    if (this.loading.has(moduleId)) {
      // Wait for concurrent load to complete
      return this.waitForLoad(moduleId);
    }
    this.loading.add(moduleId);
    try {
      // Load dependencies first if requested
      if (options?.loadDependencies !== false) {
        await this.loadDependencies(instance.descriptor);
      }
      // Update status
      instance.status = ModuleStatus.LOADING;
      this.meter.incrementCounter('registry.module.loading');
      await this.eventBus.publish('registry.module.loading', { moduleId });
      // Execute loader
      const exports = await this.lazyLoader.load(instance.descriptor);
      instance.exports = exports;
      instance.status = ModuleStatus.ACTIVE;
      instance.loadedAt = Date.now();
      instance.error = undefined;
      this.meter.incrementCounter('registry.module.loaded', { type: instance.descriptor.type });
      this.meter.recordHistogram('registry.module.load.latency', Date.now() - (instance.loadedAt ?? Date.now()));
      await this.eventBus.publish('registry.module.loaded', {
        moduleId,
        type: instance.descriptor.type,
        version: instance.descriptor.version,
      });
      this.logger.info(`Module loaded: ${moduleId}`);
      return exports;
    } catch (err) {
      instance.status = ModuleStatus.ERROR;
      instance.error = (err as Error).message;
      this.meter.incrementCounter('registry.module.error');
      this.logger.error(`Module load failed: ${moduleId}`, { error: err });
      await this.eventBus.publish('registry.module.error', {
        moduleId,
        error: (err as Error).message,
      });
      throw err;
    } finally {
      this.loading.delete(moduleId);
    }
  }

  async unloadModule(moduleId: ModuleId): Promise<void> {
    const instance = this.modules.get(moduleId);
    if (!instance) return;
    // Check that no active modules depend on this one
    const dependents = this.graphEngine.getDirectDependents(moduleId);
    const activeDependents = dependents.filter(id => {
      const dep = this.modules.get(id);
      return dep && dep.status === ModuleStatus.ACTIVE;
    });
    if (activeDependents.length > 0) {
      throw new Error(`Cannot unload ${moduleId}: active dependents [${activeDependents.join(', ')}]`);
    }
    if (instance.descriptor.provider.unloader) {
      try {
        await instance.descriptor.provider.unloader();
      } catch (err) {
        this.logger.warn(`Module unloader threw: ${moduleId}`, { error: err });
      }
    }
    instance.status = ModuleStatus.UNLOADED;
    instance.exports = null;
    this.meter.incrementCounter('registry.module.unloaded');
    await this.eventBus.publish('registry.module.unloaded', { moduleId });
    this.logger.info(`Module unloaded: ${moduleId}`);
  }

  async reloadModule(moduleId: ModuleId): Promise<unknown> {
    await this.unloadModule(moduleId);
    return this.loadModule(moduleId);
  }

  private async loadDependencies(descriptor: ModuleDescriptor): Promise<void> {
    const deps = this.graphEngine.getTopologicalOrder(descriptor.id);
    for (const depId of deps) {
      if (depId === descriptor.id) continue;
      const depInstance = this.modules.get(depId);
      if (depInstance && depInstance.status !== ModuleStatus.ACTIVE) {
        await this.loadModule(depId);
      }
    }
  }

  private async waitForLoad(moduleId: ModuleId): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        const instance = this.modules.get(moduleId);
        if (!instance) { clearInterval(check); reject(new Error('Module removed during load')); return; }
        if (instance.status === ModuleStatus.ACTIVE) { clearInterval(check); resolve(instance.exports); return; }
        if (instance.status === ModuleStatus.ERROR) { clearInterval(check); reject(new Error(instance.error)); return; }
      }, 50);
    });
  }

  getModule(moduleId: ModuleId): ModuleInstance | undefined {
    return this.modules.get(moduleId);
  }

  getExports<T = unknown>(moduleId: ModuleId): T | undefined {
    return this.modules.get(moduleId)?.exports as T | undefined;
  }

  queryModules(query: DiscoveryQuery): ModuleInstance[] {
    let results = Array.from(this.modules.values());
    if (query.type) results = results.filter(m => m.descriptor.type === query.type);
    if (query.capability) results = results.filter(m => m.descriptor.capabilities.includes(query.capability!));
    if (query.status) results = results.filter(m => m.status === query.status);
    return results;
  }

  getAllDescriptors(): ModuleDescriptor[] {
    return Array.from(this.modules.values()).map(m => ({ ...m.descriptor }));
  }

  getAllCapabilityDescriptors() {
    return this.capabilityRegistry.getAllCapabilities();
  }

  getHealth(): RegistryHealth {
    const all = Array.from(this.modules.values());
    const cycles = this.graphEngine.detectCycles();
    return {
      totalModules: all.length,
      activeModules: all.filter(m => m.status === ModuleStatus.ACTIVE).length,
      errorModules: all.filter(m => m.status === ModuleStatus.ERROR).length,
      capabilitiesRegistered: this.capabilityRegistry.getCount(),
      dependencyCycles: cycles,
      lastRecoveryTimestamp: this.recovery.getLastSnapshotTimestamp(),
    };
  }

  async shutdown(): Promise<void> {
    // Unload in reverse dependency order
    const leaves = this.graphEngine.getLeaves();
    for (const id of leaves) {
      await this.unloadModule(id).catch(err => this.logger.error(`Shutdown unload failed: ${id}`, err));
    }
    this.modules.clear();
  }
}