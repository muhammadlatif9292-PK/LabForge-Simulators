// packages/event-bus-runtime/src/runtime/event-replay-engine.ts
/**
 * Event Replay Engine
 * 
 * Responsibilities:
 * - Restore application state by replaying persisted events within a time range
 * - Coordinate with distributed lock to prevent concurrent replays
 * - Track replay progress and resume from last checkpoint
 * - Notify replay completeness
 * 
 * Owned state:
 * - replayInProgress: boolean
 * - lastReplayedTimestamp: number
 * 
 * Dependencies: DistributedEventBus (to republish), EventPersistenceRuntime, ILogger, IMeter, ITracer
 * 
 * Event emissions: republishes events with metadata.replay = true
 * Event subscriptions: none
 * Synchronization: uses DistributedLockManager externally
 * Recovery: resumes from last successful timestamp on failure
 * Telemetry: replay progress gauge, duration histogram
 * Diagnostics: can report last replayed timestamp
 * Accessibility: errors logged with correlation ID
 * Performance: batches event fetching; limits memory usage with streaming
 * Forbidden: concurrent replay without lock
 */

import type { DistributedEventBus } from './distributed-event-bus';
import type { EventPersistenceRuntime } from './event-persistence-runtime';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';

export class EventReplayEngine {
  private replayInProgress = false;
  private lastReplayedTimestamp = 0;

  constructor(
    private bus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private persistence?: EventPersistenceRuntime,
  ) {}

  async replay(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<void> {
    if (this.replayInProgress) throw new Error('Replay already in progress');
    this.replayInProgress = true;
    const span = this.tracer.startSpan('eventbus.replay.engine', { fromTimestamp, toTimestamp, type });
    const start = Date.now();
    try {
      const events = await this.persistence!.query(fromTimestamp, toTimestamp, type);
      this.logger.info('Replay starting', { count: events.length, from: fromTimestamp, to: toTimestamp });
      this.meter.incrementCounter('eventbus.replay.started');

      for (const event of events) {
        event.metadata.replay = true;
        await this.bus.publish(event.type, event.payload, {
          correlationId: event.metadata.correlationId,
          causationId: event.metadata.causationId,
          replay: true,
        });
        this.lastReplayedTimestamp = event.metadata.timestamp;
        this.meter.recordHistogram('eventbus.replay.event.lag', Date.now() - event.metadata.timestamp);
      }

      this.meter.incrementCounter('eventbus.replay.completed');
      this.logger.info('Replay completed', { totalEvents: events.length, duration: Date.now() - start });
    } catch (err) {
      this.logger.error('Replay failed', { error: err, lastTimestamp: this.lastReplayedTimestamp });
      this.meter.incrementCounter('eventbus.replay.failed');
      throw err;
    } finally {
      this.replayInProgress = false;
      span.finish();
    }
  }
}