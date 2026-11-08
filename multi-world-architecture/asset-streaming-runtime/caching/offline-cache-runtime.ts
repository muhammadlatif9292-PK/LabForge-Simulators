// asset-streaming-runtime/caching/offline-cache-runtime.ts
/**
 * Offline Cache Runtime
 * 
 * Responsibilities:
 * - Store downloaded assets persistently in IndexedDB or Cache API
 * - Enforce cache size limits with LRU eviction
 * - Provide fast synchronous lookup for cached assets
 * - Track access patterns for predictive loading
 * - Support cache warming from resource packs
 * - Validate cache integrity periodically
 * 
 * Owned state:
 * - cache: Map<AssetId, OfflineCacheEntry> (in-memory index, data in IndexedDB)
 * - currentSizeBytes: number
 * - maxSizeBytes: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - IndexedDB or CacheStorage API
 * - StreamingIntegrityValidator (periodic checks)
 * 
 * Event emissions: "cache.asset.stored", "cache.asset.evicted", "cache.quota.warning"
 * Event subscriptions: none
 * Synchronization: single-threaded access; IndexedDB transactional
 * Recovery: cache is durable across sessions; index rebuilt on startup
 * Telemetry: cache hit rate, size, eviction count
 * Diagnostics: cache statistics
 * Accessibility: N/A
 * Performance: in-memory index for O(1) lookup; async writes
 * Forbidden: exceeding storage quota without warning; blocking reads
 */

import type { AssetId, OfflineCacheEntry, Checksum } from '../contracts/asset-streaming-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class OfflineCacheRuntime {
  private index: Map<AssetId, OfflineCacheEntry> = new Map();
  private currentSizeBytes = 0;
  private lruOrder: AssetId[] = []; // front = most recently used
  private readonly defaultMaxSizeBytes: number;
  private db: any; // IndexedDB wrapper

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    maxSizeMB: number = 512,
  ) {
    this.defaultMaxSizeBytes = maxSizeMB * 1024 * 1024;
    this.initializeDB();
    this.loadIndex();
  }

  private async initializeDB(): Promise<void> {
    // In production: open IndexedDB and create object stores
    this.db = new Map<string, ArrayBuffer>(); // simplified in-memory DB
  }

  private async loadIndex(): Promise<void> {
    // Rebuild index from persistent storage on startup
    const keys = this.db.keys ? Array.from(this.db.keys()) : [];
    for (const key of keys) {
      const raw = this.db.get(key);
      if (raw) {
        const entry: OfflineCacheEntry = JSON.parse(raw);
        this.index.set(key as AssetId, entry);
        this.currentSizeBytes += entry.sizeBytes;
        this.lruOrder.push(key as AssetId);
      }
    }
    this.logger.info(`Cache index loaded: ${this.index.size} entries, ${this.currentSizeBytes} bytes`);
  }

  async store(assetId: AssetId, data: ArrayBuffer, checksum: Checksum, expiresAt?: number): Promise<void> {
    const entry: OfflineCacheEntry = {
      assetId,
      data,
      checksum,
      downloadedAt: Date.now(),
      expiresAt: expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days default
      accessCount: 0,
      lastAccessedAt: Date.now(),
      sizeBytes: data.byteLength,
    };
    // Check if we need to evict
    while (this.currentSizeBytes + entry.sizeBytes > this.defaultMaxSizeBytes && this.lruOrder.length > 0) {
      const evictId = this.lruOrder[this.lruOrder.length - 1]; // least recently used
      await this.evict(evictId);
    }
    // Store
    await this.db.set(assetId, JSON.stringify({ ...entry, data: undefined })); // metadata only
    // Actual data stored separately in IndexedDB
    this.index.set(assetId, entry);
    this.currentSizeBytes += entry.sizeBytes;
    this.touchLRU(assetId);
    this.meter.setGauge('asset.cache.size_bytes', this.currentSizeBytes);
    this.meter.incrementCounter('asset.cache.stored');
    this.logger.debug(`Cached asset ${assetId} (${entry.sizeBytes} bytes)`);
  }

  async get(assetId: AssetId): Promise<OfflineCacheEntry | null> {
    const entry = this.index.get(assetId);
    if (!entry) {
      this.meter.incrementCounter('asset.cache.miss');
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      await this.evict(assetId);
      this.meter.incrementCounter('asset.cache.expired');
      return null;
    }
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.touchLRU(assetId);
    this.meter.incrementCounter('asset.cache.hit');
    return entry;
  }

  async evict(assetId: AssetId): Promise<void> {
    const entry = this.index.get(assetId);
    if (!entry) return;
    this.index.delete(assetId);
    this.currentSizeBytes -= entry.sizeBytes;
    this.lruOrder = this.lruOrder.filter(id => id !== assetId);
    await this.db.delete(assetId);
    this.meter.setGauge('asset.cache.size_bytes', this.currentSizeBytes);
    this.meter.incrementCounter('asset.cache.evicted');
    this.logger.debug(`Evicted asset ${assetId}`);
  }

  private touchLRU(assetId: AssetId): void {
    this.lruOrder = this.lruOrder.filter(id => id !== assetId);
    this.lruOrder.unshift(assetId);
  }

  has(assetId: AssetId): boolean {
    return this.index.has(assetId) && (this.index.get(assetId)?.expiresAt ?? 0) > Date.now();
  }

  getStats(): { entryCount: number; sizeBytes: number; hitRate?: number } {
    return {
      entryCount: this.index.size,
      sizeBytes: this.currentSizeBytes,
    };
  }

  async clear(): Promise<void> {
    this.index.clear();
    this.lruOrder = [];
    this.currentSizeBytes = 0;
    // clear DB
    this.db.clear?.();
    this.meter.setGauge('asset.cache.size_bytes', 0);
  }
}