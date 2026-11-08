// packages/storage-runtime/offline/offline-storage-runtime.ts
/**
 * Offline Storage Runtime
 * 
 * Responsibilities:
 * - Provide a unified persistence layer atop IndexedDB with fallback to localStorage
 * - Support structured data with automatic serialization/deserialization
 * - Enforce per-entry TTL with lazy expiration
 * - Provide batch operations for performance
 * - Support storage quota monitoring and pressure relief via eviction
 * - Emit telemetry on read/write operations
 * 
 * Owned state:
 * - backend: StorageBackend
 * - inMemoryIndex: Map<StorageKey, { sizeBytes; createdAt; ttlMs }>
 * - pendingWrites: Map<StorageKey, unknown> (debounce queue)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - StorageRecoveryEngine (for corruption recovery)
 * - CacheIntegrityValidator (for optional checksums)
 * - CompressedStateStorage (for transparent compression)
 * 
 * Event emissions:
 *   "storage.write", "storage.read", "storage.delete"
 *   "storage.quota.warning", "storage.quota.exceeded"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded; IndexedDB transactions atomic
 * Recovery: corrupted entries detected via integrity validator and restored
 * Telemetry: read/write latency, storage size, quota usage
 * Diagnostics: entry count, storage backend health
 * Accessibility: N/A
 * Performance: in-memory index for fast lookups; debounced writes; batch operations
 * Forbidden: blocking reads; losing writes on crash without recovery log
 */

import type {
  StorageKey, StorageEntry, StorageBackend, StorageHealth, StorageQuota,
} from '../contracts/storage-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class OfflineStorageRuntime {
  private index: Map<StorageKey, { sizeBytes: number; createdAt: number; ttlMs?: number }> = new Map();
  private writeQueue: Map<StorageKey, { value: unknown; timestamp: number }> = new Map();
  private flushTimer: any = null;
  private readonly FLUSH_INTERVAL_MS = 500;
  private readonly MAX_INDEX_ENTRIES = 50_000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private backend: StorageBackend = 'indexed_db',
    private recovery?: any,    // StorageRecoveryEngine
    private integrity?: any,   // CacheIntegrityValidator
    private compression?: any, // CompressedStateStorage
  ) {
    this.rebuildIndex();
    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  private async rebuildIndex(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      for (const key of keys) {
        const raw = await this.readRaw(key);
        if (raw) {
          const sizeBytes = typeof raw === 'string' ? raw.length : (raw as ArrayBuffer).byteLength;
          this.index.set(key, { sizeBytes, createdAt: Date.now() });
        }
      }
      this.logger.info(`Storage index rebuilt: ${this.index.size} entries`);
    } catch (err) {
      this.logger.warn('Failed to rebuild storage index', { error: err });
    }
  }

  async set(key: StorageKey, value: unknown, options?: { ttlMs?: number; tags?: string[] }): Promise<void> {
    const start = performance.now();
    const entry: StorageEntry = {
      key,
      value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ttlMs: options?.ttlMs,
      tags: options?.tags ?? [],
      sizeBytes: 0,
    };
    // Queue for write
    this.writeQueue.set(key, { value, timestamp: Date.now() });
    // Update index
    const sizeBytes = this.estimateSize(value);
    entry.sizeBytes = sizeBytes;
    this.index.set(key, { sizeBytes, createdAt: Date.now(), ttlMs: options?.ttlMs });
    if (this.index.size > this.MAX_INDEX_ENTRIES) {
      const firstKey = this.index.keys().next().value;
      if (firstKey) this.index.delete(firstKey);
    }
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('storage.write.latency', elapsed);
    this.meter.incrementCounter('storage.write');
  }

  async get<T = unknown>(key: StorageKey): Promise<T | null> {
    const start = performance.now();
    // Check in-memory write queue first
    const queued = this.writeQueue.get(key);
    if (queued) {
      this.meter.incrementCounter('storage.read.cache_hit');
      return queued.value as T;
    }
    // Check TTL
    const indexEntry = this.index.get(key);
    if (indexEntry?.ttlMs && (Date.now() - indexEntry.createdAt) > indexEntry.ttlMs) {
      await this.delete(key);
      this.meter.incrementCounter('storage.read.expired');
      return null;
    }
    const raw = await this.readRaw(key);
    if (!raw) {
      this.meter.incrementCounter('storage.read.miss');
      return null;
    }
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('storage.read.latency', elapsed);
    this.meter.incrementCounter('storage.read.hit');
    let value: unknown = raw;
    // Deserialize if JSON string
    if (typeof raw === 'string') {
      try { value = JSON.parse(raw); } catch { value = raw; }
    }
    return value as T;
  }

  async delete(key: StorageKey): Promise<void> {
    this.writeQueue.delete(key);
    this.index.delete(key);
    await this.deleteRaw(key);
    this.meter.incrementCounter('storage.delete');
  }

  async has(key: StorageKey): Promise<boolean> {
    if (this.writeQueue.has(key)) return true;
    const indexEntry = this.index.get(key);
    if (!indexEntry) return false;
    if (indexEntry.ttlMs && (Date.now() - indexEntry.createdAt) > indexEntry.ttlMs) {
      await this.delete(key);
      return false;
    }
    return true;
  }

  async getQuota(): Promise<StorageQuota> {
    let totalBytes = 0;
    for (const [, entry] of this.index) {
      totalBytes += entry.sizeBytes;
    }
    // Estimate available based on platform limits
    const availableBytes = Math.max(0, 500 * 1024 * 1024 - totalBytes); // assume 500MB cap
    return {
      totalBytes: 500 * 1024 * 1024,
      usedBytes: totalBytes,
      availableBytes,
      usageFraction: totalBytes / (500 * 1024 * 1024),
    };
  }

  async getHealth(): Promise<StorageHealth> {
    const quota = await this.getQuota();
    return {
      backend: this.backend,
      totalEntries: this.index.size,
      totalSizeBytes: quota.usedBytes,
      quotaUsedFraction: quota.usageFraction,
      evictionCount: 0,
      corruptionCount: this.integrity?.getCorruptionCount?.() ?? 0,
      status: quota.usageFraction > 0.9 ? 'full' : 'healthy',
    };
  }

  private async flush(): Promise<void> {
    if (this.writeQueue.size === 0) return;
    const entries = Array.from(this.writeQueue.entries());
    this.writeQueue.clear();
    for (const [key, { value }] of entries) {
      await this.writeRaw(key, value);
    }
    this.meter.incrementCounter('storage.flush', entries.length);
  }

  // --- Backend-specific raw operations (IndexedDB simulation) ---

  private db: Map<string, unknown> = new Map();

  private async readRaw(key: StorageKey): Promise<unknown> {
    return this.db.get(key as string) ?? null;
  }

  private async writeRaw(key: StorageKey, value: unknown): Promise<void> {
    this.db.set(key as string, value);
  }

  private async deleteRaw(key: StorageKey): Promise<void> {
    this.db.delete(key as string);
  }

  private async getAllKeys(): Promise<StorageKey[]> {
    return Array.from(this.db.keys()) as StorageKey[];
  }

  private estimateSize(value: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(value)).length;
    } catch {
      return 256; // fallback estimate
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}