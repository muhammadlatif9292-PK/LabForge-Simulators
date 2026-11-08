// packages/storage-runtime/contracts/storage-contracts.ts
/**
 * Storage Runtime Contracts
 * 
 * Responsibilities:
 * - Define strict types for offline storage, distributed cache, compression,
 *   integrity validation, and predictive loading
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

export type StorageKey = string & { readonly __brand: 'StorageKey' };
export type CacheEntryId = string & { readonly __brand: 'CacheEntryId' };
export type CompressionId = 'gzip' | 'brotli' | 'deflate' | 'none';
export type Checksum = string & { readonly __brand: 'Checksum' };

export enum StorageBackend {
  INDEXED_DB = 'indexed_db',
  LOCAL_STORAGE = 'local_storage',
  SESSION_STORAGE = 'session_storage',
  CACHE_API = 'cache_api',
  FILE_SYSTEM = 'file_system',
  MEMORY = 'memory',
}

export enum CacheStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  TTL = 'ttl',
  PRIORITY = 'priority',
}

export interface StorageEntry {
  key: StorageKey;
  value: unknown;
  createdAt: number;
  updatedAt: number;
  ttlMs?: number;
  tags: string[];
  sizeBytes: number;
}

export interface CacheEntry {
  id: CacheEntryId;
  key: StorageKey;
  value: unknown;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  ttlMs?: number;
  sizeBytes: number;
  priority: number;
  tags: string[];
}

export interface CacheConfig {
  maxEntries: number;
  maxSizeBytes: number;
  defaultTTLMs: number;
  strategy: CacheStrategy;
  onEvict?: (entry: CacheEntry) => void;
}

export interface CompressedBlock {
  originalSizeBytes: number;
  compressedSizeBytes: number;
  algorithm: CompressionId;
  data: ArrayBuffer;
  checksum: Checksum;
}

export interface IntegrityReport {
  valid: boolean;
  key: StorageKey;
  expectedChecksum: Checksum;
  actualChecksum: Checksum;
  timestamp: number;
  recommendation: 'keep' | 'repair' | 'evict';
}

export interface StorageQuota {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usageFraction: number;
}

export interface PredictiveLoadModel {
  key: StorageKey;
  accessProbability: number;
  lastAccessedAt: number;
  accessPattern: 'frequent' | 'periodic' | 'burst' | 'rare';
  predictedNextAccess: number;
}

export interface StorageHealth {
  backend: StorageBackend;
  totalEntries: number;
  totalSizeBytes: number;
  quotaUsedFraction: number;
  evictionCount: number;
  corruptionCount: number;
  status: 'healthy' | 'degraded' | 'full' | 'corrupted';
}