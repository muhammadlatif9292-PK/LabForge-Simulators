// packages/module-registry/contracts/registry-contracts.ts
/**
 * Module Registry Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for dynamic module registration, discovery,
 *   dependency resolution, lazy loading, and capability management
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type ModuleId = string & { readonly __brand: 'ModuleId' };
export type CapabilityId = string & { readonly __brand: 'CapabilityId' };
export type DependencyId = ModuleId | CapabilityId;
export type RegistryVersion = string & { readonly __brand: 'RegistryVersion' };

export enum ModuleType {
  CORE = 'core',
  WORLD = 'world',
  INSTRUMENT = 'instrument',
  SIMULATION = 'simulation',
  PLUGIN = 'plugin',
  AI_AGENT = 'ai-agent',
  RENDERING = 'rendering',
  RUNTIME = 'runtime',
  UI = 'ui',
  UTILITY = 'utility',
}

export enum ModuleStatus {
  REGISTERED = 'registered',
  LOADING = 'loading',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UNLOADED = 'unloaded',
}

export interface ModuleDescriptor {
  id: ModuleId;
  type: ModuleType;
  version: string;
  capabilities: CapabilityId[];
  dependencies: ModuleDependency[];
  provider: ModuleProvider;
  metadata: Record<string, unknown>;
}

export interface ModuleDependency {
  moduleId: ModuleId;
  versionRange: string;   // semver range, e.g., "^1.2.0"
  optional: boolean;
  reason: string;
}

export interface ModuleProvider {
  loader: () => Promise<any>;          // dynamic import
  unloader?: () => Promise<void>;      // cleanup
  timeoutMs: number;
  retryCount: number;
}

export interface ModuleInstance {
  descriptor: ModuleDescriptor;
  status: ModuleStatus;
  loadedAt?: number;
  error?: string;
  exports: unknown;
}

export interface CapabilityDescriptor {
  id: CapabilityId;
  name: string;
  description: string;
  permissions: string[];
  parentCapabilities: CapabilityId[];
}

export interface DependencyGraphNode {
  module: ModuleDescriptor;
  dependents: Set<ModuleId>;
  dependencies: Set<ModuleId>;
  depth: number;
  circular: boolean;
}

export interface DiscoveryQuery {
  type?: ModuleType;
  capability?: CapabilityId;
  status?: ModuleStatus;
  tag?: string;
}

export interface RegistryHealth {
  totalModules: number;
  activeModules: number;
  errorModules: number;
  capabilitiesRegistered: number;
  dependencyCycles: ModuleId[];
  lastRecoveryTimestamp?: number;
}

export interface LazyLoadOptions {
  timeoutMs: number;
  retryCount: number;
  loadDependencies: boolean;
  onProgress?: (moduleId: ModuleId, status: ModuleStatus) => void;
}

export interface RegistrySnapshot {
  version: RegistryVersion;
  modules: ModuleDescriptor[];
  capabilities: CapabilityDescriptor[];
  timestamp: number;
  checksum: string;
}