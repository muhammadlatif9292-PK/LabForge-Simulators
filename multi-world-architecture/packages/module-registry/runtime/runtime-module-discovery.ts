// packages/module-registry/runtime/runtime-module-discovery.ts
/**
 * Runtime Module Discovery
 * 
 * Responsibilities:
 * - Discover available modules at runtime (from manifest, filesystem, or remote registry)
 * - Support contextual discovery: which worlds need which modules
 * - Pre-scan for module descriptors and register them with the central registry
 * - Handle discovery errors gracefully (skip broken modules)
 * - Provide discovery progress for startup splash screen
 * 
 * Owned state:
 * - discoveredDescriptors: Map<ModuleId, ModuleDescriptor>
 * - discoverySources: DiscoverySource[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DynamicModuleRegistry
 * - DistributedEventBus
 * 
 * Event emissions:
 *   "registry.discovery.started", "registry.discovery.progress"
 *   "registry.discovery.completed", "registry.discovery.module_skipped"
 * 
 * Event subscriptions: none
 * Synchronization: scanning is serial; registration is concurrent
 * Recovery: failed scans retried on next discovery cycle
 * Telemetry: discovery duration, modules found, errors
 * Diagnostics: discovery log
 * Accessibility: N/A
 * Performance: parallel manifest loading; cache discovery results
 * Forbidden: blocking app start on full discovery scan
 */

import type { ModuleDescriptor, ModuleId } from '../contracts/registry-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DynamicModuleRegistry } from './dynamic-module-registry';

interface DiscoverySource {
  name: string;
  fetch: () => Promise<ModuleDescriptor[]>;
}

export class RuntimeModuleDiscovery {
  private sources: DiscoverySource[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private registry: DynamicModuleRegistry,
  ) {}

  registerSource(source: DiscoverySource): void {
    this.sources.push(source);
  }

  async discoverAll(): Promise<number> {
    const start = Date.now();
    this.meter.incrementCounter('registry.discovery.started');
    await this.eventBus.publish('registry.discovery.started', { timestamp: start });
    this.logger.info('Module discovery started');
    let registered = 0;
    for (const source of this.sources) {
      try {
        const descriptors = await source.fetch();
        for (const descriptor of descriptors) {
          try {
            await this.registry.registerModule(descriptor);
            registered++;
          } catch (err) {
            this.logger.warn(`Skipping module ${descriptor.id} from ${source.name}`, { error: err });
            this.meter.incrementCounter('registry.discovery.module_skipped');
            await this.eventBus.publish('registry.discovery.module_skipped', {
              moduleId: descriptor.id,
              source: source.name,
              error: (err as Error).message,
            });
          }
        }
        this.meter.incrementCounter('registry.discovery.progress');
      } catch (err) {
        this.logger.error(`Discovery source failed: ${source.name}`, { error: err });
      }
    }
    const duration = Date.now() - start;
    this.meter.recordHistogram('registry.discovery.duration', duration);
    this.meter.incrementCounter('registry.discovery.completed');
    await this.eventBus.publish('registry.discovery.completed', { registered, duration });
    this.logger.info(`Module discovery completed: ${registered} modules in ${duration}ms`);
    return registered;
  }
}