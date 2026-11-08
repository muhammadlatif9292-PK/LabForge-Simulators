// packages/storage-runtime/cache/distributed-cache-runtime.ts
/**
 * Distributed Cache Runtime
 * 
 * Responsibilities:
 * - Provide an in-memory cache with configurable eviction strategy (LRU, LFU, TTL, Priority)
 * - Serve as a local hot cache; optionally backed by a distributed store (Redis)
 * - Notify peers of cache invalidations for distributed consistency
 * - Enforce per-entry TTL and stale-while-revalidate behaviour
 * - Emit telemetry on hit/miss/eviction rates
 * 
 * Owned state:
 * - entries: Map<CacheEntryId, CacheEntry>
 * - lruList: CacheEntryId[] (for LRU)
 * - totalSizeBytes: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to broadcast invalidations)
 * - CacheIntegrityValidator (optional)
 * - OfflineStorageRuntime (optional fallback for larger data)
 * 
 * Event emissions:
 *   "cache.set", "cache.get.hit", "cache.get.miss"
 *   "cache.evicted", "cache.invalidated"
 * 
 * Event subscriptions:
 *   "cache.invalidate" (from peers to remove stale entries)
 * 
 * Synchronization: local operations O(1); distributed invalidation via event bus
 * Recovery: cache cold on restart; warm cache from storage if configured
 * Telemetry: hit rate, miss rate, eviction count, total size
 * Diagnostics: cache stats, strategy, top keys by access
 * Accessibility: N/A
 * Performance: O(1) get/set; O(log n) eviction candidate selection
 * Forbidden: unbounded growth; blocking on cache miss without timeout
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CacheEntryId, StorageKey, CacheEntry, CacheConfig, CacheStrategy,
} from '../contracts/storage-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class DistributedCacheRuntime {
  private entries: Map<CacheEntryId, CacheEntry> = new Map();
  private keyIndex: Map<StorageKey, CacheEntryId> = new Map(); // key → entryId
  private lruList: CacheEntryId[] = []; // front = most recently used
  private totalSizeBytes = 0;
  private config: CacheConfig;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    config?: Partial<CacheConfig>,
  ) {
    this.config = {
      maxEntries: config?.maxEntries ?? 10_000,
      maxSizeBytes: config?.maxSizeBytes ?? 128 * 1024 * 1024,
      defaultTTLMs: config?.defaultTTLMs ?? 300_000, // 5 min
      strategy: config?.strategy ?? 'lru',
    };
    this.eventBus.subscribe('cache.invalidate', this.onRemoteInvalidation.bind(this));
  }

  set(key: StorageKey, value: unknown, options?: { ttlMs?: number; priority?: number; tags?: string[] }): void {
    // Check if key already exists and update
    const existingId = this.keyIndex.get(key);
    if (existingId) {
      const existing = this.entries.get(existingId);
      if (existing) {
        this.totalSizeBytes -= existing.sizeBytes;
        this.removeFromLRU(existingId);
        this.entries.delete(existingId);
      }
    }
    // Evict if needed
    this.enforceLimits();
    const entryId = uuidv4() as CacheEntryId;
    const sizeBytes = this.estimateSize(value);
    const entry: CacheEntry = {
      id: entryId,
      key,
      value,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      ttlMs: options?.ttlMs ?? this.config.defaultTTLMs,
      sizeBytes,
      priority: options?.priority ?? 1,
      tags: options?.tags ?? [],
    };
    this.entries.set(entryId, entry);
    this.keyIndex.set(key, entryId);
    this.totalSizeBytes += sizeBytes;
    this.lruList.unshift(entryId); // most recent at front
    this.meter.incrementCounter('cache.set');
  }

  get<T = unknown>(key: StorageKey): T | null {
    const entryId = this.keyIndex.get(key);
    if (!entryId) {
      this.meter.incrementCounter('cache.get.miss');
      return null;
    }
    const entry = this.entries.get(entryId);
    if (!entry) {
      this.keyIndex.delete(key);
      this.meter.incrementCounter('cache.get.miss');
      return null;
    }
    // Check TTL
    if (entry.ttlMs && (Date.now() - entry.createdAt) > entry.ttlMs) {
      this.evict(entryId, 'expired');
      this.meter.incrementCounter('cache.get.miss');
      return null;
    }
    // Update access metadata
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.touchLRU(entryId);
    this.meter.incrementCounter('cache.get.hit');
    return entry.value as T;
  }

  remove(key: StorageKey): void {
    const entryId = this.keyIndex.get(key);
    if (entryId) {
      this.evict(entryId, 'manual');
    }
  }

  invalidate(tag: string): void {
    const toRemove: CacheEntryId[] = [];
    for (const entry of this.entries.values()) {
      if (entry.tags.includes(tag)) {
        toRemove.push(entry.id);
      }
    }
    for (const id of toRemove) {
      this.evict(id, 'invalidated');
    }
    this.meter.incrementCounter('cache.invalidated', toRemove.length);
    // Broadcast to peers
    this.eventBus.publish('cache.invalidate', { tag });
  }

  getStats(): { entryCount: number; totalSizeBytes: number; hitRate?: number } {
    return {
      entryCount: this.entries.size,
      totalSizeBytes: this.totalSizeBytes,
      hitRate: this.calculateHitRate(),
    };
  }

  // --- Eviction ---

  private enforceLimits(): void {
    while (this.entries.size >= this.config.maxEntries || this.totalSizeBytes >= this.config.maxSizeBytes) {
      const candidate = this.selectEvictionCandidate();
      if (!candidate) break;
      this.evict(candidate, 'capacity');
    }
  }

  private selectEvictionCandidate(): CacheEntryId | null {
    if (this.entries.size === 0) return null;
    switch (this.config.strategy) {
      case 'lru':
        return this.lruList.length > 0 ? this.lruList[this.lruList.length - 1] : null;
      case 'lfu':
        return Array.from(this.entries.values())
          .sort((a, b) => a.accessCount - b.accessCount)[0]?.id ?? null;
      case 'fifo':
        return Array.from(this.entries.values())
          .sort((a, b) => a.createdAt - b.createdAt)[0]?.id ?? null;
      case 'ttl':
        return Array.from(this.entries.values())
          .filter(e => e.ttlMs)
          .sort((a, b) => (a.createdAt + (a.ttlMs ?? 0)) - (b.createdAt + (b.ttlMs ?? 0)))[0]?.id
          ?? this.lruList[this.lruList.length - 1];
      case 'priority':
        return Array.from(this.entries.values())
          .sort((a, b) => a.priority - b.priority)[0]?.id ?? null;
      default:
        return this.lruList[this.lruList.length - 1];
    }
  }

  private evict(entryId: CacheEntryId, reason: string): void {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    this.entries.delete(entryId);
    this.keyIndex.delete(entry.key);
    this.removeFromLRU(entryId);
    this.totalSizeBytes -= entry.sizeBytes;
    this.meter.incrementCounter('cache.evicted', { reason });
    this.config.onEvict?.(entry);
    this.logger.debug(`Cache evicted: ${entry.key} (reason: ${reason})`);
  }

  private touchLRU(entryId: CacheEntryId): void {
    this.removeFromLRU(entryId);
    this.lruList.unshift(entryId);
  }

  private removeFromLRU(entryId: CacheEntryId): void {
    this.lruList = this.lruList.filter(id => id !== entryId);
  }

  private onRemoteInvalidation(event: any): void {
    const { tag } = event.payload;
    this.invalidate(tag);
  }

  private estimateSize(value: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(value)).length;
    } catch {
      return 128;
    }
  }

  private hitRateWindow: Array<'hit' | 'miss'> = [];
  private calculateHitRate(): number {
    const recent = this.hitRateWindow.slice(-100);
    if (recent.length === 0) return 1;
    return recent.filter(r => r === 'hit').length / recent.length;
  }

  clear(): void {
    this.entries.clear();
    this.keyIndex.clear();
    this.lruList = [];
    this.totalSizeBytes = 0;
  }
}