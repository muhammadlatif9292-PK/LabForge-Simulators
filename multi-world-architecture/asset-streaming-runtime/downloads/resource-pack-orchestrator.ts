// asset-streaming-runtime/downloads/resource-pack-orchestrator.ts
/**
 * Resource Pack Orchestrator
 * 
 * Responsibilities:
 * - Manage named collections of assets (resource packs) for worlds and instruments
 * - Load resource pack manifests and enqueue all contained assets
 * - Support versioning: detect outdated packs and trigger re-download
 * - Provide pack-level progress reporting
 * - Allow packs to be prioritized by world/instrument activation
 * 
 * Owned state:
 * - registeredPacks: Map<ResourcePackId, ResourcePack>
 * - packProgress: Map<ResourcePackId, PackProgress>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AdaptiveDownloadEngine (to enqueue assets)
 * - OfflineCacheRuntime (to check if pack already cached)
 * - DistributedEventBus
 * 
 * Event emissions: "resource_pack.loading", "resource_pack.completed", "resource_pack.failed"
 * Event subscriptions:
 * - "world.loading" (to load world's required packs)
 * - "instrument.created" (to load instrument-specific packs)
 * 
 * Synchronization: per-pack progress tracking; no cross-pack coordination
 * Recovery: incomplete packs resume on restart via download engine
 * Telemetry: pack load duration, completion rate
 * Diagnostics: pack status, missing assets
 * Accessibility: N/A
 * Performance: asset enqueuing is O(n) where n is assets per pack
 * Forbidden: blocking world load waiting for non-critical packs
 */

import type {
  ResourcePackId, ResourcePack, AssetDescriptor, AssetId,
} from '../contracts/asset-streaming-contracts';
import { AssetPriority } from '../contracts/asset-streaming-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { AdaptiveDownloadEngine } from './adaptive-download-engine';
import type { OfflineCacheRuntime } from '../caching/offline-cache-runtime';

interface PackProgress {
  packId: ResourcePackId;
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  startedAt: number;
  status: 'loading' | 'completed' | 'failed';
}

export class ResourcePackOrchestrator {
  private packs: Map<ResourcePackId, ResourcePack> = new Map();
  private progress: Map<ResourcePackId, PackProgress> = new Map();

  constructor(
    private downloadEngine: AdaptiveDownloadEngine,
    private cache: OfflineCacheRuntime,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('asset.download.completed', this.onAssetCompleted.bind(this));
    this.eventBus.subscribe('asset.download.failed', this.onAssetFailed.bind(this));
  }

  registerPack(pack: ResourcePack): void {
    this.packs.set(pack.id, pack);
    this.logger.debug(`Resource pack registered: ${pack.name} (${pack.totalSizeBytes} bytes)`);
  }

  async loadPack(packId: ResourcePackId): Promise<void> {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Pack ${packId} not registered`);
    const progress: PackProgress = {
      packId,
      totalAssets: pack.assets.length,
      completedAssets: 0,
      failedAssets: 0,
      startedAt: Date.now(),
      status: 'loading',
    };
    this.progress.set(packId, progress);
    this.meter.incrementCounter('resource_pack.loading');
    await this.eventBus.publish('resource_pack.loading', { packId, name: pack.name });

    const uncachedAssets: AssetDescriptor[] = [];
    for (const asset of pack.assets) {
      const cached = await this.cache.get(asset.id);
      if (!cached || cached.checksum !== asset.checksum) {
        uncachedAssets.push(asset);
      } else {
        progress.completedAssets++;
      }
    }
    // Enqueue uncached assets
    if (uncachedAssets.length > 0) {
      this.downloadEngine.enqueueBatch(uncachedAssets);
    } else if (progress.completedAssets >= progress.totalAssets) {
      this.completePack(packId);
    }
  }

  private onAssetCompleted(event: any): void {
    const { assetId } = event.payload;
    for (const [packId, progress] of this.progress) {
      const pack = this.packs.get(packId);
      if (pack && pack.assets.some(a => a.id === assetId)) {
        progress.completedAssets++;
        if (progress.completedAssets >= progress.totalAssets) {
          this.completePack(packId);
        }
        break;
      }
    }
  }

  private onAssetFailed(event: any): void {
    const { assetId } = event.payload;
    for (const [packId, progress] of this.progress) {
      const pack = this.packs.get(packId);
      if (pack && pack.assets.some(a => a.id === assetId)) {
        progress.failedAssets++;
        if (progress.completedAssets + progress.failedAssets >= progress.totalAssets) {
          if (progress.completedAssets >= progress.totalAssets) {
            this.completePack(packId);
          } else {
            progress.status = 'failed';
            this.meter.incrementCounter('resource_pack.failed');
            this.eventBus.publish('resource_pack.failed', { packId });
          }
        }
        break;
      }
    }
  }

  private completePack(packId: ResourcePackId): void {
    const progress = this.progress.get(packId);
    if (!progress || progress.status !== 'loading') return;
    progress.status = 'completed';
    this.meter.incrementCounter('resource_pack.completed');
    this.meter.recordHistogram('resource_pack.load_duration', Date.now() - progress.startedAt);
    this.eventBus.publish('resource_pack.completed', {
      packId,
      durationMs: Date.now() - progress.startedAt,
    });
    this.logger.info(`Resource pack ${packId} loaded`);
  }

  getPackProgress(packId: ResourcePackId): PackProgress | undefined {
    return this.progress.get(packId);
  }

  getAllPacks(): ResourcePack[] {
    return Array.from(this.packs.values());
  }
}