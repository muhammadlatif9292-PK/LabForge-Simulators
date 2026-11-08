// packages/module-registry/runtime/capability-registry.ts
/**
 * Capability Registry
 * 
 * Responsibilities:
 * - Register and query named capabilities with permission requirements
 * - Support capability inheritance (parent-child)
 * - Track which modules provide which capabilities
 * - Validate that a requesting module has the right to use a capability
 * 
 * Owned state:
 * - capabilities: Map<CapabilityId, CapabilityDescriptor>
 * - providerIndex: Map<CapabilityId, ModuleId> (which module provides it)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "registry.capability.registered", "registry.capability.provider.changed"
 * Event subscriptions: none
 * Synchronization: read-heavy; fine-grained registration locks
 * Recovery: capability map rebuilt on restart from module descriptors
 * Telemetry: capability count, lookup hit rate
 * Diagnostics: capability tree
 * Accessibility: N/A
 * Performance: O(1) lookup
 * Forbidden: duplicate capability registration without conflict resolution
 */

import type { CapabilityId, CapabilityDescriptor, ModuleId } from '../contracts/registry-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class CapabilityRegistry {
  private capabilities: Map<CapabilityId, CapabilityDescriptor> = new Map();
  private providers: Map<CapabilityId, ModuleId> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.registerBuiltInCapabilities();
  }

  private registerBuiltInCapabilities(): void {
    const builtIns: CapabilityDescriptor[] = [
      { id: 'core.render' as CapabilityId, name: 'Render', description: 'Access the rendering pipeline', permissions: ['render:access'], parentCapabilities: [] },
      { id: 'core.simulate' as CapabilityId, name: 'Simulate', description: 'Run scientific simulations', permissions: ['sim:execute'], parentCapabilities: [] },
      { id: 'core.ai' as CapabilityId, name: 'AI', description: 'Access AI tutoring and agents', permissions: ['ai:access'], parentCapabilities: [] },
      { id: 'core.network' as CapabilityId, name: 'Network', description: 'Make network requests', permissions: ['network:access'], parentCapabilities: [] },
      { id: 'core.storage' as CapabilityId, name: 'Storage', description: 'Read and write local storage', permissions: ['storage:access'], parentCapabilities: [] },
    ];
    for (const cap of builtIns) {
      this.registerCapability(cap);
    }
  }

  registerCapability(descriptor: CapabilityDescriptor): void {
    if (this.capabilities.has(descriptor.id)) {
      this.logger.warn(`Capability already registered: ${descriptor.id}`);
    }
    // Validate parent capabilities exist
    for (const parentId of descriptor.parentCapabilities) {
      if (!this.capabilities.has(parentId)) {
        throw new Error(`Parent capability not found: ${parentId}`);
      }
    }
    this.capabilities.set(descriptor.id, descriptor);
    this.logger.debug(`Capability registered: ${descriptor.id}`);
  }

  registerCapabilityProvider(capabilityId: CapabilityId, moduleId: ModuleId): void {
    if (!this.capabilities.has(capabilityId)) {
      this.logger.warn(`Registering provider for unknown capability: ${capabilityId}`);
    }
    this.providers.set(capabilityId, moduleId);
  }

  getCapability(id: CapabilityId): CapabilityDescriptor | undefined {
    return this.capabilities.get(id);
  }

  getProvider(id: CapabilityId): ModuleId | undefined {
    return this.providers.get(id);
  }

  hasCapability(id: CapabilityId): boolean {
    return this.capabilities.has(id);
  }

  inheritsFrom(capabilityId: CapabilityId, potentialParent: CapabilityId): boolean {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) return false;
    if (cap.parentCapabilities.includes(potentialParent)) return true;
    for (const parent of cap.parentCapabilities) {
      if (this.inheritsFrom(parent, potentialParent)) return true;
    }
    return false;
  }

  getAllCapabilities(): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values());
  }

  getCount(): number {
    return this.capabilities.size;
  }
}