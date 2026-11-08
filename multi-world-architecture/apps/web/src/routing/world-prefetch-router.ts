// apps/web/src/routing/world-prefetch-router.ts
/**
 * World Prefetch Router
 * 
 * Responsibilities:
 * - Prefetch world-related data and assets when navigating near a world route
 * - Predict likely next worlds based on user history and curriculum sequence
 * - Load world manifests and instrument definitions before route activation
 * - Coordinate with asset streaming runtime for background downloads
 * 
 * Owned state:
 * - prefetchCache: Map<RouteId, PrefetchEntry>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AssetStreamingRuntime
 * - WorldOrchestrator
 * - PredictiveLoadingRuntime
 * 
 * Event emissions: "routing.prefetch.started", "routing.prefetch.completed"
 * Event subscriptions: none
 * Synchronization: none (background)
 * Recovery: failed prefetches do not block navigation
 * Telemetry: prefetch hit rate, prefetch duration
 * Diagnostics: prefetched worlds
 * Accessibility: N/A
 * Performance: low-priority background fetches
 * Forbidden: blocking navigation on prefetch completion
 */

import type { RouteMatch, RouteId } from './contracts/routing-contracts';
import type { RouteContext } from './contracts/routing-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface PrefetchEntry {
  routeId: RouteId;
  worldId: string;
  prefetchedAt: number;
  status: 'pending' | 'completed' | 'failed';
}

export class WorldPrefetchRouter {
  private prefetched: Map<RouteId, PrefetchEntry> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private assetStreaming: any, // AssetStreamingRuntime
    private worldOrchestrator: any, // WorldOrchestrator
  ) {}

  async prefetchWorldRoutes(match: RouteMatch, context: RouteContext): Promise<void> {
    const routeId = match.routeId;
    if (this.prefetched.has(routeId)) return;
    // Determine if this is a world-related route
    const worldId = match.params['worldId'] ?? context.worldId;
    if (!worldId) return;
    const entry: PrefetchEntry = { routeId, worldId, prefetchedAt: Date.now(), status: 'pending' };
    this.prefetched.set(routeId, entry);
    try {
      this.meter.incrementCounter('routing.prefetch.started');
      await this.eventBus.publish('routing.prefetch.started', { routeId, worldId });
      // Preload world manifest and essential assets
      if (this.assetStreaming) {
        await this.assetStreaming.preloadWorldAssets(worldId);
      }
      if (this.worldOrchestrator) {
        await this.worldOrchestrator.warmupWorld(worldId);
      }
      entry.status = 'completed';
      this.meter.incrementCounter('routing.prefetch.completed');
      this.logger.debug(`World prefetch completed for ${worldId} (route ${routeId})`);
    } catch (err) {
      entry.status = 'failed';
      this.logger.warn(`World prefetch failed for ${worldId}`, { error: err });
    }
  }

  getPrefetchStatus(worldId: string): PrefetchEntry | undefined {
    for (const entry of this.prefetched.values()) {
      if (entry.worldId === worldId) return entry;
    }
    return undefined;
  }
}