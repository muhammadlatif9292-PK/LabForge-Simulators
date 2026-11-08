// packages/storage-runtime/cache/predictive-cache-loader.ts
/**
 * Predictive Cache Loader
 * 
 * Responsibilities:
 * - Predict which data will be needed based on access patterns
 * - Preload data into cache when idle or when bandwidth allows
 * - Track access history to build predictive models
 * - Support multiple prediction strategies: frequent, periodic, burst, rare
 * - Coordinate with distributed cache and offline storage for seamless experience
 * 
 * Owned state:
 * - accessHistory: Map<StorageKey, AccessRecord[]>
 * - predictions: Map<StorageKey, PredictiveLoadModel>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedCacheRuntime (to preload into)
 * - OfflineStorageRuntime (to fetch from)
 * - DistributedEventBus (to coordinate)
 * 
 * Event emissions: "storage.preload.predicted", "storage.preload.completed"
 * Event subscriptions: "cache.get" (to track access)
 * Synchronization: none
 * Recovery: prediction models rebuilt on restart
 * Telemetry: prediction accuracy, preload hit rate
 * Diagnostics: prediction models
 * Accessibility: N/A
 * Performance: lightweight prediction; idle-time execution
 * Forbidden: preloading during critical operations; blocking user interaction
 */

import type { StorageKey, PredictiveLoadModel } from '../contracts/storage-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface AccessRecord {
  timestamp: number;
  duration?: number;
}

export class PredictiveCacheLoader {
  private accessHistory: Map<StorageKey, AccessRecord[]> = new Map();
  private predictions: Map<StorageKey, PredictiveLoadModel> = new Map();
  private readonly MAX_HISTORY_PER_KEY = 100;
  private preloadQueue: StorageKey[] = [];
  private preloadInProgress = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private cache: any,     // DistributedCacheRuntime
    private storage: any,   // OfflineStorageRuntime
  ) {
    this.eventBus.subscribe('cache.get.hit', this.recordAccess.bind(this));
    // Attempt periodic preload
    if (typeof requestIdleCallback !== 'undefined') {
      setInterval(() => requestIdleCallback(() => this.processPreloadQueue()), 10000);
    } else {
      setInterval(() => this.processPreloadQueue(), 10000);
    }
  }

  recordAccess(event: any): void {
    const key = event.payload?.key as StorageKey;
    if (!key) return;
    let records = this.accessHistory.get(key);
    if (!records) {
      records = [];
      this.accessHistory.set(key, records);
    }
    records.push({ timestamp: Date.now() });
    if (records.length > this.MAX_HISTORY_PER_KEY) {
      records.shift();
    }
    // Update prediction model
    this.updatePrediction(key, records);
  }

  private updatePrediction(key: StorageKey, records: AccessRecord[]): void {
    const now = Date.now();
    let accessCount = records.length;
    // Determine access pattern
    let pattern: 'frequent' | 'periodic' | 'burst' | 'rare' = 'rare';
    if (records.length >= 5) {
      const intervals: number[] = [];
      for (let i = 1; i < records.length; i++) {
        intervals.push(records[i].timestamp - records[i - 1].timestamp);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((s, i) => s + (i - avgInterval) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      if (avgInterval < 60000 && stdDev < avgInterval * 0.5) pattern = 'frequent';
      else if (stdDev < avgInterval * 0.3 && avgInterval > 60000) pattern = 'periodic';
      else if (accessCount > 10) pattern = 'burst';
    }
    // Predict next access
    const lastAccess = records[records.length - 1]?.timestamp ?? now;
    let predictedNext = now + 60000; // default 1 min
    if (pattern === 'frequent') predictedNext = lastAccess + 30000;
    else if (pattern === 'periodic' && records.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < records.length; i++) {
        intervals.push(records[i].timestamp - records[i - 1].timestamp);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      predictedNext = lastAccess + avgInterval;
    }
    // Probability decreases with time since last access
    const timeSinceLastMs = now - lastAccess;
    const accessProbability = Math.max(0.05, Math.exp(-timeSinceLastMs / 300000)); // decay over 5 min
    this.predictions.set(key, {
      key,
      accessProbability,
      lastAccessedAt: lastAccess,
      accessPattern: pattern,
      predictedNextAccess: predictedNext,
    });
  }

  predictNextKeys(count: number = 5): StorageKey[] {
    const candidates = Array.from(this.predictions.values())
      .filter(p => p.accessProbability > 0.3 && p.predictedNextAccess > Date.now())
      .sort((a, b) => b.accessProbability - a.accessProbability);
    return candidates.slice(0, count).map(p => p.key);
  }

  schedulePreload(keys: StorageKey[]): void {
    for (const key of keys) {
      if (!this.preloadQueue.includes(key) && !this.cache.get(key)) {
        this.preloadQueue.push(key);
      }
    }
    this.meter.setGauge('storage.preload.queue_depth', this.preloadQueue.length);
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.preloadInProgress || this.preloadQueue.length === 0) return;
    this.preloadInProgress = true;
    const toLoad = this.preloadQueue.splice(0, 3); // batch size
    for (const key of toLoad) {
      try {
        const value = await this.storage.get(key);
        if (value !== null) {
          this.cache.set(key, value);
          this.meter.incrementCounter('storage.preload.completed');
          await this.eventBus.publish('storage.preload.completed', { key });
        }
      } catch (err) {
        this.logger.warn(`Preload failed for key: ${key}`, { error: err });
      }
    }
    this.preloadInProgress = false;
    this.meter.setGauge('storage.preload.queue_depth', this.preloadQueue.length);
  }

  getPrediction(key: StorageKey): PredictiveLoadModel | undefined {
    return this.predictions.get(key);
  }

  getTopPredictions(limit: number = 10): PredictiveLoadModel[] {
    return Array.from(this.predictions.values())
      .sort((a, b) => b.accessProbability - a.accessProbability)
      .slice(0, limit);
  }
}