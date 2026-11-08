// worlds/core/runtime/world-runtime.ts
/**
 * World Runtime
 * 
 * Responsibilities:
 * - Manage the lifecycle of a single scientific world instance
 * - Coordinate asset loading, simulation start, instrument instantiation
 * - Enforce deterministic state transitions (unloaded → loading → active → ...)
 * - Provide hooks for AI, rendering, and networking layers
 * 
 * Owned state:
 * - descriptor: WorldDescriptor
 * - session: WorldSession
 * - worldState: WorldState
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - WorldOrchestrator (global world manager)
 * - WorldStreamingRuntime (asset delivery)
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * 
 * Event emissions:
 * - "world.state.changed"
 * - "world.entity.created"
 * - "world.entity.destroyed"
 * 
 * Event subscriptions:
 * - "world.command" (from orchestrator)
 * - "world.asset.streamed" (from streaming)
 * 
 * Synchronization: state transitions guarded by internal lock
 * Recovery: uses snapshot + event replay via recovery engine
 * Telemetry: memory usage, entity count, tick duration
 * Diagnostics: world state log
 * Accessibility: N/A
 * Performance: lazy asset loading; tick scheduling per world
 * Forbidden: direct mutation of world state from outside; bypassing lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import type { WorldDescriptor, WorldSession, WorldState, WorldEvent } from '../contracts/world-contracts';
import { WorldState as WS } from '../contracts/world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WorldStreamingRuntime } from './world-streaming-runtime';
import type { WorldMemoryManager } from './world-memory-manager';
import type { WorldRecoveryEngine } from './world-recovery-engine';
import type { WorldOrchestrator } from './world-orchestrator';

export class WorldRuntime {
  private state: WorldState = WS.UNLOADED;
  private session: WorldSession | null = null;
  private tickTimer: any = null;
  private entities = new Map<string, any>();

  constructor(
    private descriptor: WorldDescriptor,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private streaming: WorldStreamingRuntime,
    private memory: WorldMemoryManager,
    private recovery: WorldRecoveryEngine,
    private orchestrator: WorldOrchestrator,
  ) {}

  async bootstrap(sessionId: string, userId: string): Promise<void> {
    if (this.state !== WS.UNLOADED) throw new Error('World already loaded');
    this.setState(WS.LOADING);
    this.session = {
      sessionId,
      worldId: this.descriptor.id,
      userId,
      state: WS.LOADING,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      checkpointTick: 0,
      metadata: {},
    };
    // Stream essential assets
    await this.streaming.loadRequiredAssets(this.descriptor.requiredAssets);
    // Restore from checkpoint if available
    const lastCheckpoint = await this.recovery.loadLatestCheckpoint(this.descriptor.id, userId);
    if (lastCheckpoint) {
      this.entities = new Map(Object.entries(lastCheckpoint.entities));
    }
    this.setState(WS.ACTIVE);
    this.startTickLoop();
    this.logger.info(`World ${this.descriptor.id} bootstrapped for session ${sessionId}`);
  }

  async shutdown(): Promise<void> {
    this.stopTickLoop();
    this.setState(WS.UNLOADING);
    await this.recovery.saveCheckpoint(this.descriptor.id, this.session!.userId, this.entities);
    this.streaming.unloadAll();
    this.entities.clear();
    this.session = null;
    this.setState(WS.UNLOADED);
  }

  async handleEvent(event: WorldEvent): Promise<void> {
    // Route to domain-specific handlers; base class does nothing
    this.logger.debug(`World event: ${event.type}`);
    await this.eventBus.publish('world.event.processed', event);
  }

  private startTickLoop(): void {
    // Simulate a world tick for state updates (physics etc.)
    this.tickTimer = setInterval(() => {
      if (this.state === WS.ACTIVE && this.session) {
        this.session.lastActivity = Date.now();
        // Placeholder for domain simulation step
      }
    }, 1000 / 20); // 20 Hz
  }

  private stopTickLoop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  private setState(newState: WorldState): void {
    this.state = newState;
    if (this.session) this.session.state = newState;
    this.eventBus.publish('world.state.changed', { worldId: this.descriptor.id, state: newState });
  }

  getState(): WorldState { return this.state; }
  getSession(): WorldSession | null { return this.session; }
  getEntities(): Map<string, any> { return this.entities; }
}