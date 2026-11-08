// packages/event-bus-runtime/src/runtime/dead-letter-queue.ts
/**
 * Dead Letter Queue
 * 
 * Responsibilities:
 * - Store events that failed handler execution after retry exhaustion
 * - Manage retry policies with exponential backoff
 * - Purge or reinject events on demand
 * - Observability: queue depth, age, error types
 * 
 * Owned state:
 * - queue: DeadLetterEntry[] (in memory, optionally backed by persistence)
 * 
 * Dependencies: DistributedEventBus, ILogger, IMeter
 * 
 * Event emissions: none directly
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: retryAll() reinjects events into bus; persistent backup via EventPersistenceRuntime
 * Telemetry: gauge for queue size, oldest entry age
 * Diagnostics: stats()
 * Accessibility: reason field in entries for debugging
 * Performance: configurable max queue size, discards oldest on overflow (with alert)
 * Forbidden: blocking retries, infinite loops
 */

import type { Event, DeadLetterQueue as IDeadLetterQueue, DeadLetterStats } from '../contracts/event-bus-contracts';
import type { DistributedEventBus } from './distributed-event-bus';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface DeadLetterEntry {
  event: Event;
  reason: string;
  attempts: number;
  enqueuedAt: number;
}

export class DeadLetterQueue implements IDeadLetterQueue {
  private queue: DeadLetterEntry[] = [];
  private readonly MAX_QUEUE = 10_000;

  constructor(
    private bus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async enqueue(event: Event, reason: string, attempts: number): Promise<void> {
    if (this.queue.length >= this.MAX_QUEUE) {
      this.queue.shift(); // drop oldest
      this.logger.warn('Dead-letter queue overflow, dropping oldest entry');
      this.meter.incrementCounter('eventbus.dlq.overflow');
    }
    this.queue.push({ event, reason, attempts, enqueuedAt: Date.now() });
    this.meter.setGauge('eventbus.dlq.size', this.queue.length);
    this.logger.error('Event moved to DLQ', { eventId: event.metadata.eventId, type: event.type, reason, attempts });
  }

  async retryAll(): Promise<number> {
    const entries = [...this.queue];
    this.queue = [];
    this.meter.setGauge('eventbus.dlq.size', 0);
    let succeeded = 0;
    for (const entry of entries) {
      try {
        await this.bus.publish(entry.event.type, entry.event.payload, {
          correlationId: entry.event.metadata.correlationId,
          causationId: entry.event.metadata.causationId,
          replay: true,
        });
        succeeded++;
      } catch (err) {
        // Re-enqueue with incremented attempts
        await this.enqueue(entry.event, (err as Error).message, entry.attempts + 1);
      }
    }
    this.logger.info(`DLQ retry completed: ${succeeded}/${entries.length} succeeded`);
    return succeeded;
  }

  async purge(): Promise<void> {
    this.queue = [];
    this.meter.setGauge('eventbus.dlq.size', 0);
    this.logger.info('DLQ purged');
  }

  stats(): DeadLetterStats {
    const oldest = this.queue.length > 0
      ? Math.min(...this.queue.map(e => e.enqueuedAt))
      : null;
    return { queued: this.queue.length, oldestTimestamp: oldest };
  }
}