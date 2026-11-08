// worlds/core/runtime/world-telemetry.ts
/**
 * World Telemetry
 * 
 * Responsibilities:
 * - Collect telemetry from all active world instances (entity counts, tick times, memory)
 * - Aggregate and report to observability runtime
 * - Support configurable sampling
 * 
 * Owned state: none
 * Dependencies: ILogger, IMeter, WorldOrchestrator
 * 
 * Event emissions: "world.telemetry.batch"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: none
 * Telemetry: metric write
 * Diagnostics: none
 * Accessibility: N/A
 * Performance: periodic aggregation
 * Forbidden: blocking world ticks for telemetry
 */

import type { WorldOrchestrator } from './world-orchestrator';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class WorldTelemetry {
  constructor(
    private orchestrator: WorldOrchestrator,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    setInterval(() => this.collect(), 10000);
  }

  private collect(): void {
    // Iterate worlds and gather metrics
    const worlds = this.orchestrator['worlds'] as Map<string, any>;
    worlds.forEach((world, key) => {
      // Emit telemetry per world
      this.meter.setGauge('world.entities', world.getEntities().size, { worldId: world.descriptor.id });
    });
  }
}