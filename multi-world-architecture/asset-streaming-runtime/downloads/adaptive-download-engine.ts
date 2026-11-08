// asset-streaming-runtime/downloads/adaptive-download-engine.ts
/**
 * Adaptive Download Engine
 * 
 * Responsibilities:
 * - Manage the download queue with priority ordering and bandwidth adaptation
 * - Support resumable downloads via Range headers and download tokens
 * - Adjust concurrency and chunk size based on network conditions
 * - Handle retry with exponential backoff and circuit breaker
 * - Emit progress events for HUD and telemetry
 * 
 * Owned state:
 * - downloadQueue: PriorityQueue<AssetDescriptor>
 * - activeDownloads: Map<AssetId, AssetDownloadState>
 * - bandwidthEstimates: StreamingBandwidthEstimate[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to emit download events)
 * - OfflineCacheRuntime (to check existing cache)
 * - StreamingIntegrityValidator (post-download verification)
 * 
 * Event emissions:
 * - "asset.download.queued", "asset.download.started", "asset.download.progress"
 * - "asset.download.completed", "asset.download.failed", "asset.download.corrupt"
 * 
 * Event subscriptions:
 * - "network.bandwidth.changed" (from network monitor)
 * - "world.streaming.request" (from world runtime)
 * 
 * Synchronization: single queue consumed sequentially; downloads concurrent
 * Recovery: resume incomplete downloads using stored tokens; retry on failure
 * Telemetry: throughput, success rate, retry count
 * Diagnostics: queue depth, active downloads, bandwidth estimate
 * Accessibility: N/A
 * Performance: adaptive concurrency; chunked downloads; shared fetch pool
 * Forbidden: saturating bandwidth for low-priority assets; retrying without backoff
 */

import type {
  AssetId, AssetDescriptor, AssetDownloadState, DownloadState,
  DownloadToken, StreamingBandwidthEstimate, Checksum,
} from '../contracts/asset-streaming-contracts';
import { AssetPriority } from '../contracts/asset-streaming-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { OfflineCacheRuntime } from '../caching/offline-cache-runtime';
import type { StreamingIntegrityValidator } from '../integrity/streaming-integrity-validator';

export class AdaptiveDownloadEngine {
  private queue: AssetDescriptor[] = [];
  private active: Map<AssetId, AssetDownloadState> = new Map();
  private maxConcurrent = 4;
  private bandwidth: StreamingBandwidthEstimate = {
    bytesPerSecond: 1_000_000,
    latencyMs: 50,
    sampleCount: 1,
    lastUpdated: Date.now(),
  };
  private abortControllers: Map<AssetId, AbortController> = new Map();
  private processing = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private cache: OfflineCacheRuntime,
    private integrityValidator: StreamingIntegrityValidator,
  ) {}

  async enqueue(asset: AssetDescriptor): Promise<void> {
    // Check cache first
    const cached = await this.cache.get(asset.id);
    if (cached && cached.checksum === asset.checksum) {
      this.logger.debug(`Asset ${asset.id} already cached`);
      return;
    }
    // Insert by priority (lower number = higher priority)
    const insertIdx = this.queue.findIndex(a => a.priority > asset.priority);
    if (insertIdx >= 0) {
      this.queue.splice(insertIdx, 0, asset);
    } else {
      this.queue.push(asset);
    }
    this.meter.incrementCounter('asset.download.queued');
    this.meter.setGauge('asset.download.queue_depth', this.queue.length);
    await this.eventBus.publish('asset.download.queued', { assetId: asset.id, priority: asset.priority });
    this.processQueue();
  }

  enqueueBatch(assets: AssetDescriptor[]): void {
    for (const asset of assets) {
      this.enqueue(asset);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.active.size < this.maxConcurrent && this.queue.length > 0) {
        const asset = this.queue.shift()!;
        this.downloadAsset(asset);
      }
    } finally {
      this.processing = false;
    }
  }

  private async downloadAsset(asset: AssetDescriptor): Promise<void> {
    const state: AssetDownloadState = {
      id: asset.id,
      state: 'queued',
      bytesDownloaded: 0,
      totalBytes: asset.sizeBytes,
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };
    this.active.set(asset.id, state);
    const controller = new AbortController();
    this.abortControllers.set(asset.id, controller);

    await this.performDownload(asset, state, controller.signal);
  }

  private async performDownload(asset: AssetDescriptor, state: AssetDownloadState, signal: AbortSignal): Promise<void> {
    while (state.retryCount <= state.maxRetries) {
      try {
        state.state = 'downloading';
        const startByte = state.bytesDownloaded;
        const headers: Record<string, string> = {};
        if (startByte > 0) {
          headers['Range'] = `bytes=${startByte}-`;
        }

        const response = await fetch(asset.url, {
          headers,
          signal,
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const chunks: Uint8Array[] = [];
        let downloaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          downloaded += value.byteLength;
          state.bytesDownloaded = startByte + downloaded;
          state.lastProgressTime = Date.now();
          await this.eventBus.publish('asset.download.progress', {
            assetId: asset.id,
            bytesDownloaded: state.bytesDownloaded,
            totalBytes: state.totalBytes,
          });
          this.meter.recordHistogram('asset.download.progress_bytes', value.byteLength);
        }

        // Assemble full data
        const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const data = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.byteLength;
        }

        // Validate integrity
        const integrity = await this.integrityValidator.validate(asset.id, data.buffer, asset.checksum);
        if (!integrity.valid) {
          state.state = 'corrupt';
          this.meter.incrementCounter('asset.download.corrupt');
          await this.eventBus.publish('asset.download.corrupt', { assetId: asset.id, report: integrity });
          state.retryCount++;
          state.bytesDownloaded = 0; // restart
          continue;
        }

        // Cache it
        await this.cache.store(asset.id, data.buffer, asset.checksum, asset.expiresAt);

        state.state = 'completed';
        this.meter.incrementCounter('asset.download.completed');
        this.meter.recordHistogram('asset.download.duration', Date.now() - state.startTime);
        await this.eventBus.publish('asset.download.completed', {
          assetId: asset.id,
          sizeBytes: asset.sizeBytes,
          durationMs: Date.now() - state.startTime,
        });
        break;

      } catch (err: any) {
        if (err.name === 'AbortError') {
          state.state = 'paused';
          break;
        }
        state.retryCount++;
        const backoff = Math.min(30000, Math.pow(2, state.retryCount) * 1000);
        this.logger.warn(`Download failed for ${asset.id}, retry ${state.retryCount}/${state.maxRetries} in ${backoff}ms`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    if (state.state === 'downloading' || state.state === 'queued') {
      state.state = 'failed';
      this.meter.incrementCounter('asset.download.failed');
      await this.eventBus.publish('asset.download.failed', {
        assetId: asset.id,
        retries: state.retryCount,
      });
    }

    this.active.delete(asset.id);
    this.abortControllers.delete(asset.id);
    this.processQueue();
  }

  cancel(assetId: AssetId): void {
    const controller = this.abortControllers.get(assetId);
    if (controller) controller.abort();
    // Remove from queue if pending
    this.queue = this.queue.filter(a => a.id !== assetId);
  }

  updateBandwidth(estimate: StreamingBandwidthEstimate): void {
    this.bandwidth = estimate;
    // Adjust concurrency based on bandwidth: 1 per 250KB/s roughly
    this.maxConcurrent = Math.max(1, Math.min(8, Math.floor(estimate.bytesPerSecond / 250_000)));
  }

  getActiveDownloads(): AssetDownloadState[] {
    return Array.from(this.active.values());
  }

  getQueueDepth(): number {
    return this.queue.length;
  }

  async shutdown(): Promise<void> {
    for (const [id, controller] of this.abortControllers) {
      controller.abort();
    }
    this.active.clear();
    this.queue = [];
  }
}