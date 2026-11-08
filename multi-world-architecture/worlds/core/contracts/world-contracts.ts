// worlds/core/contracts/world-contracts.ts
/**
 * World Runtime Contracts
 * 
 * Responsibilities:
 * - Define interfaces for world lifecycle, streaming, memory, recovery, and events
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

export type WorldId = string & { readonly __brand: 'WorldId' };
export type WorldVersion = string;
export type AssetBundleId = string;

export enum WorldState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  ACTIVE = 'active',
  PAUSED = 'paused',
  SUSPENDED = 'suspended',
  UNLOADING = 'unloading',
  ERROR = 'error',
}

export interface WorldDescriptor {
  id: WorldId;
  version: WorldVersion;
  domain: 'chemistry' | 'physics' | 'biology' | 'electronics' | 'mathematics';
  name: string;
  requiredAssets: string[];
  instruments: string[];
  maxEntities: number;
  persistent: boolean;
}

export interface WorldSession {
  sessionId: string;
  worldId: WorldId;
  userId: string;
  state: WorldState;
  startedAt: number;
  lastActivity: number;
  checkpointTick: number;
  metadata: Record<string, unknown>;
}

export interface WorldEvent {
  eventId: string;
  worldId: WorldId;
  type: string;
  payload: unknown;
  timestamp: number;
  causationId?: string;
}

export interface WorldMemoryStats {
  entitiesCount: number;
  stateSizeBytes: number;
  assetCacheSizeBytes: number;
  peakMemoryBytes: number;
}

export interface WorldHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeSessions: number;
  uptime: number;
  lastError?: string;
}

export interface AssetStreamToken {
  assetId: string;
  url: string;
  checksum: string;
  expiresAt: number;
}