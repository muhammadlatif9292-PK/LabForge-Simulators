// apps/web/src/app-shell/worlds/world-bootstrap-runtime.ts
/**
 * World Bootstrap Runtime
 * 
 * Responsibilities:
 * - Bootstrap a scientific world within the app shell
 * - Load world manifest, validate asset availability, start streaming
 * - Initialize the world runtime and coordinate with HUD & routing
 * - Support restoring world state from a checkpoint (for crash recovery)
 * - Manage world lifecycle transitions (load → active → suspend → unload)
 * 
 * Owned state:
 * - activeWorldId: string | null
 * - worldInstance: any (WorldRuntime)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - WorldOrchestrator (to create/load worlds)
 * - AssetStreamingRuntime (asset preloading)
 * - WorldRecoveryEngine (checkpointing)
 * 
 * Event emissions:
 *   "app.world.bootstrapped", "app.world.failed"
 * 
 * Event subscriptions: none
 * Synchronization: per-world; no concurrent world boots
 * Recovery: world can be reloaded from last checkpoint
 * Telemetry: world load time, asset preload progress
 * Diagnostics: world status, asset cache state
 * Accessibility: announce world name on load
 * Performance: Lazy-load world-specific modules; preload critical assets
 * Forbidden: loading multiple worlds in same viewport simultaneously
 */

import type { WorldBootstrapContext } from '../contracts/app-shell-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorldOrchestrator } from '@labforge/worlds-core';

export class WorldBootstrapRuntime {
  private activeWorldId: string | null = null;
  private worldInstance: any = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private worldOrchestrator: WorldOrchestrator,
    private assetStreaming: any,
    private worldRecovery: any,
  ) {}

  async bootstrapWorld(context: WorldBootstrapContext): Promise<any> {
    const start = performance.now();
    const { worldId, userId, sessionId, restoreFromCheckpoint } = context;
    this.logger.info(`Bootstrapping world: ${worldId}`);
    this.meter.incrementCounter('app.world.boot.started');

    // 1. Load world manifest
    const manifest = await this.worldOrchestrator.loadWorldManifest(worldId);
    if (!manifest) throw new Error(`World manifest not found: ${worldId}`);

    // 2. Preload critical assets
    await this.assetStreaming.loadRequiredAssets(manifest.requiredAssets ?? []);

    // 3. Create world runtime
    this.worldInstance = await this.worldOrchestrator.createWorld(manifest, userId, sessionId);

    // 4. Restore from checkpoint if requested
    if (restoreFromCheckpoint) {
      const restored = await this.worldRecovery.loadLatestCheckpoint(worldId, userId);
      if (restored) {
        this.worldInstance.restoreState(restored);
        this.logger.info(`World ${worldId} restored from checkpoint`);
      }
    }

    this.activeWorldId = worldId;
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('app.world.boot.duration', elapsed);
    this.meter.incrementCounter('app.world.bootstrapped');
    this.logger.info(`World ${worldId} bootstrapped in ${elapsed.toFixed(0)}ms`);
    await this.eventBus.publish('app.world.bootstrapped', {
      worldId,
      durationMs: elapsed,
      restored: restoreFromCheckpoint,
    });
    return this.worldInstance;
  }

  async suspendWorld(): Promise<void> {
    if (!this.activeWorldId || !this.worldInstance) return;
    await this.worldInstance.suspend?.();
    this.logger.info(`World suspended: ${this.activeWorldId}`);
  }

  async resumeWorld(): Promise<void> {
    if (!this.activeWorldId || !this.worldInstance) return;
    await this.worldInstance.resume?.();
    this.logger.info(`World resumed: ${this.activeWorldId}`);
  }

  async unloadWorld(): Promise<void> {
    if (!this.activeWorldId || !this.worldInstance) return;
    await this.worldInstance.shutdown?.();
    this.activeWorldId = null;
    this.worldInstance = null;
    this.logger.info('World unloaded');
  }

  getActiveWorldId(): string | null {
    return this.activeWorldId;
  }

  getWorldInstance(): any {
    return this.worldInstance;
  }
}