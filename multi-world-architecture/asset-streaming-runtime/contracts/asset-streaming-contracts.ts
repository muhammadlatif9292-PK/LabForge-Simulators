// asset-streaming-runtime/contracts/asset-streaming-contracts.ts
/**
 * Asset Streaming Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for resumable downloads, predictive loading,
 *   offline persistence, integrity validation, and cache management
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

export type AssetId = string & { readonly __brand: 'AssetId' };
export type DownloadToken = string & { readonly __brand: 'DownloadToken' };
export type ResourcePackId = string & { readonly __brand: 'ResourcePackId' };
export type Checksum = string & { readonly __brand: 'Checksum' };

export enum AssetType {
  MODEL_3D = 'model_3d',
  TEXTURE = 'texture',
  SHADER = 'shader',
  AUDIO = 'audio',
  SIMULATION_DATA = 'simulation_data',
  INSTRUMENT_DEFINITION = 'instrument_definition',
  WORLD_MANIFEST = 'world_manifest',
  LOCALIZATION = 'localization',
}

export enum AssetPriority {
  CRITICAL = 0,   // required for current view
  HIGH = 1,        // needed within next 30s
  MEDIUM = 2,      // needed within next 5min
  LOW = 3,         // nice to have
  PRELOAD = 4,     // speculative background fetch
}

export enum DownloadState {
  QUEUED = 'queued',
  DOWNLOADING = 'downloading',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CORRUPT = 'corrupt',
}

export interface AssetDescriptor {
  id: AssetId;
  type: AssetType;
  url: string;
  fallbackUrl?: string;
  sizeBytes: number;
  checksum: Checksum;
  priority: AssetPriority;
  compression: 'none' | 'gzip' | 'brotli';
  expiresAt?: number;
  dependencies: AssetId[];
  metadata: Record<string, unknown>;
}

export interface AssetDownloadState {
  id: AssetId;
  state: DownloadState;
  bytesDownloaded: number;
  totalBytes: number;
  startTime: number;
  lastProgressTime: number;
  retryCount: number;
  maxRetries: number;
  resumeToken?: DownloadToken;
}

export interface ResourcePack {
  id: ResourcePackId;
  name: string;
  assets: AssetDescriptor[];
  version: string;
  totalSizeBytes: number;
  priority: AssetPriority;
  worldIds: string[];
  instrumentTypes: string[];
}

export interface OfflineCacheEntry {
  assetId: AssetId;
  data: ArrayBuffer;
  checksum: Checksum;
  downloadedAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
  sizeBytes: number;
}

export interface StreamingBandwidthEstimate {
  bytesPerSecond: number;
  latencyMs: number;
  sampleCount: number;
  lastUpdated: number;
}

export interface IntegrityReport {
  assetId: AssetId;
  valid: boolean;
  expectedChecksum: Checksum;
  actualChecksum: Checksum;
  sizeMismatch: boolean;
  recommendation: 'keep' | 'redownload' | 'purge';
}

export interface PredictiveLoadRequest {
  worldId: string;
  currentInstrumentIds: string[];
  nearbyInstrumentIds: string[];
  availableBandwidthBps: number;
  cacheSizeBytes: number;
}