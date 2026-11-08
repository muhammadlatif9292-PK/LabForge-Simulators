// asset-streaming-runtime/downloads/predictive-loading-runtime.ts
/**
 * Predictive Loading Runtime
 * 
 * Responsibilities:
 * - Predict which assets will be needed soon based on user behavior and world context
 * - Preload assets in background when bandwidth and cache allow
 * - Coordinate with world session to understand instrument proximity
 * - Use machine learning or heuristic models for prediction
 * - Evict incorrectly predicted assets to free cache
 * 
 * Owned state:
 * - predictionModel: Map<string, number> (assetId → probability score)
 * - preloadQueue: AssetDescriptor[]
 * - history: UserNavigationEvent[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AdaptiveDownloadEngine (to enqueue preloads)
 * - OfflineCacheRuntime (to check cache state)
 * - DistributedEventBus
 * 
 * Event emissions: "asset.preload.predicted", "asset.preload.evicted"
 * Event subscriptions:
 * - "world.instrument.focused" (to predict next assets)
 * - "instrument.interaction.processed"
 * 
 * Synchronization: none (predictions are local)
 * Recovery: prediction model rebuilt from history on restart
 * Telemetry: prediction accuracy, preload hit rate
 * Diagnostics: prediction scores, preload queue
 * Accessibility: N/A
 * Performance: lightweight prediction; async enqueue
 * Forbidden: preloading while on metered connection (respects user preference)
 */

import type { AssetDescriptor, AssetId } from '../contracts/asset-streaming-contracts';
import { AssetPriority } from '../contracts/asset-streaming-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { AdaptiveDownloadEngine } from './adaptive-download-engine';
import type { OfflineCacheRuntime } from '../caching/offline-cache-runtime';

interface UserNavigationEvent {
  fromInstrumentId?: string;
  toInstrumentId: string;
  timestamp: number;
}

export class PredictiveLoadingRuntime {
  private transitionMatrix: Map<string, Map<string, number>> = new Map(); // from → to → count
  private navigationHistory: UserNavigationEvent[] = [];
  private maxHistory = 200;
  private preloadBudget = 3; // max concurrent preloads

  constructor(
    private downloadEngine: AdaptiveDownloadEngine,
    private cache: OfflineCacheRuntime,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('world.instrument.focused', this.onInstrumentFocus.bind(this));
  }

  private onInstrumentFocus(event: any): void {
    const { instrumentId, previousInstrumentId } = event.payload;
    // Record navigation
    const nav: UserNavigationEvent = {
      fromInstrumentId: previousInstrumentId,
      toInstrumentId: instrumentId,
      timestamp: Date.now(),
    };
    this.navigationHistory.push(nav);
    if (this.navigationHistory.length > this.maxHistory) {
      this.navigationHistory.shift();
    }
    // Update transition matrix
    if (previousInstrumentId) {
      if (!this.transitionMatrix.has(previousInstrumentId)) {
        this.transitionMatrix.set(previousInstrumentId, new Map());
      }
      const counts = this.transitionMatrix.get(previousInstrumentId)!;
      counts.set(instrumentId, (counts.get(instrumentId) ?? 0) + 1);
    }
    // Predict and preload
    this.predictAndPreload(instrumentId);
  }

  private predictAndPreload(currentInstrumentId: string): void {
    const transitions = this.transitionMatrix.get(currentInstrumentId);
    if (!transitions || transitions.size === 0) return;

    // Sort by probability
    const total = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
    const predictions = Array.from(transitions.entries())
      .map(([id, count]) => ({ instrumentId: id, probability: count / total }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, this.preloadBudget);

    for (const pred of predictions) {
      if (pred.probability > 0.2) {
        // Request assets for this instrument from world manifest
        this.eventBus.publish('asset.preload.predicted', {
          instrumentId: pred.instrumentId,
          probability: pred.probability,
          timestamp: Date.now(),
        });
        this.meter.incrementCounter('asset.preload.predicted');
      }
    }
  }

  async preloadAssets(assets: AssetDescriptor[]): Promise<void> {
    for (const asset of assets) {
      const cached = await this.cache.get(asset.id);
      if (cached) continue; // already cached
      // Clone asset with PRELOAD priority
      const preloadAsset: AssetDescriptor = { ...asset, priority: AssetPriority.PRELOAD };
      await this.downloadEngine.enqueue(preloadAsset);
    }
    this.meter.incrementCounter('asset.preload.enqueued', assets.length);
  }

  getNavigationHistory(): UserNavigationEvent[] {
    return [...this.navigationHistory];
  }
}