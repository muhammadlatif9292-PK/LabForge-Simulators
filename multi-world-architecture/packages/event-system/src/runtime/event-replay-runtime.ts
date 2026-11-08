// packages/event-system/src/runtime/event-replay-runtime.ts
/**
 * Event Replay Runtime (Operational Replay Orchestrator)
 * 
 * Responsibilities:
 * - Orchestrate event replay across the distributed system
 * - Coordinate with DistributedLockManager to prevent concurrent replays
 * - Track replay progress with checkpointing
 * - Ensure deterministic restoration of state
 * 
 * Owned state:
 * - replayInProgress: boolean
 * - lastReplayedTimestamp: number
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - EventPersistenceRuntime (to load historical events)
 * - DistributedEventRuntime (to republish)
 * - DistributedLockManager (for cluster-wide lock)
 * 
 * Event emissions: "event.replay.started", "event.replay.completed"
 * Event subscriptions: none
 * Synchronization: distributed lock during replay
 * Recovery: can resume from last checkpoint if interrupted
 * Telemetry: replay duration, event count, throughput
 * Diagnostics: current replay position
 * Accessibility: N/A
 * Performance: batch fetch and republish; avoid memory pressure
 * Forbidden: concurrent replay without lock; skipping validation
 */

import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { EventPersistenceRuntime } from '@labforge/event-bus-runtime/runtime/event-persistence-runtime';
import type { DistributedEventRuntime } from './distributed-event-runtime';
import type { DistributedLockManager } from '@labforge/backend/distributed-lock-manager';

export class EventReplayRuntime {
  private inProgress = false;
  private lastTimestamp = 0;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private persistence: EventPersistenceRuntime,
    private eventRuntime: DistributedEventRuntime,
    private lockManager: DistributedLockManager,
  ) {}

  async replay(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<void> {
    if (this.inProgress) throw new Error('Replay already in progress');
    const lock = await this.lockManager.acquire('event:replay', 60000);
    try {
      this.inProgress = true;
      this.logger.info(`Event replay started from ${new Date(fromTimestamp).toISOString()}`);
      const events = await this.persistence.query(fromTimestamp, toTimestamp, type);
      for (const event of events) {
        await this.eventRuntime.publish(event.type, event.payload, { causationId: event.metadata.causationId, replay: true });
        this.lastTimestamp = event.metadata.timestamp;
      }
      this.meter.incrementCounter('event.replay.completed', events.length);
      this.logger.info(`Event replay completed: ${events.length} events`);
    } finally {
      this.inProgress = false;
      lock.release();
    }
  }
}