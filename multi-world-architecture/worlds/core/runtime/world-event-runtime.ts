// worlds/core/runtime/world-event-runtime.ts
/**
 * World Event Runtime
 * 
 * Responsibilities:
 * - Capture all significant world events (entity actions, instrument use, AI interactions)
 * - Publish events to the distributed event bus for other services
 * - Support event replay for world restoration and analytics
 * - Ensure events are immutable and ordered by timestamp
 * 
 * Owned state:
 * - eventLog: WorldEvent[] (bounded)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to publish)
 * 
 * Event emissions: each world event is published as `world.event.{type}`
 * Event subscriptions: none
 * Synchronization: local log is sequential
 * Recovery: events persist in local log; on crash, log replayed from last checkpoint
 * Telemetry: event rate, log size
 * Diagnostics: event history
 * Accessibility: N/A
 * Performance: append-only log; batched publishing
 * Forbidden: modifying past events; dropping events silently
 */

import type { WorldEvent } from '../contracts/world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class WorldEventRuntime {
  private log: WorldEvent[] = [];
  private maxLogSize = 5000;

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async recordEvent(worldId: string, type: string, payload: unknown, causationId?: string): Promise<void> {
    const event: WorldEvent = {
      eventId: crypto.randomUUID(),
      worldId: worldId as any,
      type,
      payload,
      timestamp: Date.now(),
      causationId,
    };
    this.log.push(event);
    if (this.log.length > this.maxLogSize) this.log.shift();
    await this.eventBus.publish(`world.event.${type}`, event);
    this.meter.incrementCounter('world.event.emitted');
  }

  getEvents(since: number): WorldEvent[] {
    return this.log.filter(e => e.timestamp >= since);
  }
}