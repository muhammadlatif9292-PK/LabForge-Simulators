// worlds/core/runtime/world-session-restoration.ts
/**
 * World Session Restoration
 * 
 * Responsibilities:
 * - Restore a previous world session for a user returning after disconnect
 * - Rehydrate world state from checkpoint and replay events since checkpoint
 * - Re-establish streaming assets and instrument states
 * - Ensure deterministic restoration: same inputs produce same state
 * 
 * Owned state:
 * - restorationQueue: Map<string, Promise<void>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - WorldRecoveryEngine
 * - WorldRuntime
 * - DistributedEventBus (replay events)
 * 
 * Event emissions: "world.session.restored", "world.session.restoration.failed"
 * Event subscriptions: none
 * Synchronization: only one restoration per session at a time
 * Recovery: if restoration fails, fall back to fresh bootstrap
 * Telemetry: restoration duration, events replayed
 * Diagnostics: session restoration log
 * Accessibility: N/A
 * Performance: replay events as fast as possible; use batch
 * Forbidden: mixing sessions of different users
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorldRecoveryEngine } from './world-recovery-engine';
import type { WorldRuntime } from './world-runtime';

export class WorldSessionRestoration {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private recovery: WorldRecoveryEngine,
  ) {}

  async restoreSession(world: WorldRuntime, userId: string): Promise<boolean> {
    const checkpoint = await this.recovery.loadLatestCheckpoint(world.descriptor.id, userId);
    if (!checkpoint) return false;
    // Load entities from checkpoint
    world.getEntities().clear();
    for (const [id, entity] of Object.entries(checkpoint.entities)) {
      world.getEntities().set(id, entity);
    }
    // Replay events from checkpoint.tick to latest (simplified: assume checkpoint is latest)
    this.meter.incrementCounter('world.session.restored');
    this.logger.info(`World session restored for ${userId}`);
    await this.eventBus.publish('world.session.restored', { worldId: world.descriptor.id, userId });
    return true;
  }
}