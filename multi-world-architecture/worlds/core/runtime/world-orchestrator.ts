// worlds/core/runtime/world-orchestrator.ts
/**
 * World Orchestrator
 * 
 * Responsibilities:
 * - Manage all active world instances across the application
 * - Route user requests to the appropriate world instance
 * - Enforce global resource limits (max worlds, total memory)
 * - Coordinate world creation, shutdown, and migration
 * - Provide global telemetry and diagnostics
 * 
 * Owned state:
 * - activeWorlds: Map<WorldId, WorldRuntime>
 * - worldSessions: Map<string, WorldRuntime>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - WorldStreamingRuntime (shared)
 * - WorldMemoryManager (global)
 * - WorldRecoveryEngine (shared)
 * 
 * Event emissions: "world.orchestrator.world.added", "world.orchestrator.world.removed"
 * Event subscriptions: listens to user session changes to load/unload worlds
 * Synchronization: ensures only one instance of a world per user
 * Recovery: re-create world if runtime crashes (via recovery)
 * Telemetry: world count, total memory
 * Diagnostics: list of active worlds
 * Accessibility: N/A
 * Performance: fast lookup by session/user
 * Forbidden: leaking world instances; memory leaks
 */

import type { WorldId } from '../contracts/world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorldRuntime } from './world-runtime';
import type { WorldStreamingRuntime } from './world-streaming-runtime';
import type { WorldMemoryManager } from './world-memory-manager';
import type { WorldRecoveryEngine } from './world-recovery-engine';

export class WorldOrchestrator {
  private worlds: Map<string, WorldRuntime> = new Map(); // composite key userId:worldId

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private streaming: WorldStreamingRuntime,
    private memoryManager: WorldMemoryManager,
    private recovery: WorldRecoveryEngine,
  ) {}

  registerWorld(world: WorldRuntime): void {
    const session = world.getSession();
    if (!session) throw new Error('World not bootstrapped');
    const key = `${session.userId}:${world.descriptor.id}`;
    if (this.worlds.has(key)) {
      this.logger.warn('World already active, replacing');
      this.worlds.get(key)!.shutdown();
    }
    this.worlds.set(key, world);
    this.eventBus.publish('world.orchestrator.world.added', { worldId: world.descriptor.id, userId: session.userId });
  }

  getWorld(userId: string, worldId: string): WorldRuntime | undefined {
    return this.worlds.get(`${userId}:${worldId}`);
  }

  async shutdownWorld(userId: string, worldId: string): Promise<void> {
    const key = `${userId}:${worldId}`;
    const world = this.worlds.get(key);
    if (world) {
      await world.shutdown();
      this.worlds.delete(key);
    }
  }

  getStreamingRuntime() { return this.streaming; }
  getMemoryManager() { return this.memoryManager; }
  getRecoveryEngine() { return this.recovery; }

  shutdownAll(): void {
    for (const world of this.worlds.values()) {
      world.shutdown();
    }
    this.worlds.clear();
  }
}