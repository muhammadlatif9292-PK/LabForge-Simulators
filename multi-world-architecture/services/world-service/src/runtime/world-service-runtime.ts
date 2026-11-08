// services/world-service/src/runtime/world-service-runtime.ts
/**
 * World Service Runtime
 * 
 * Responsibilities:
 * - Manage world instances across the cluster: create, load, suspend, unload.
 * - Coordinate world streaming and memory limits.
 * - Serve world manifest and entity state to connected clients.
 * 
 * Owned state:
 * - activeWorlds: Map<WorldId, WorldRuntime>
 * 
 * Dependencies:
 * - WorldOrchestrator, WorldStreamingRuntime, WorldMemoryManager,
 *   WorldRecoveryEngine, WorldSessionRestoration
 * 
 * Event emissions: "world.loaded", "world.unloaded"
 * Event subscriptions: "gateway.session.created" (load world for user)
 * Synchronization: per-world lock
 * Recovery: world instances rebuilt from storage on crash
 * Telemetry: world count, memory usage, active sessions
 * Diagnostics: loaded worlds, entity count per world
 * Accessibility: N/A
 * Performance: lazy world loading; suspend idle worlds
 * Forbidden: loading too many worlds without limits
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorldOrchestrator } from '@labforge/worlds-core';

export class WorldServiceRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private orchestrator: WorldOrchestrator,
  ) {}

  async start(): Promise<void> {
    this.logger.info('World service runtime started');
    this.meter.incrementCounter('world_service.started');
  }

  async shutdown(): Promise<void> {
    await this.orchestrator.shutdownAll();
    this.logger.info('World service runtime stopped');
  }
}