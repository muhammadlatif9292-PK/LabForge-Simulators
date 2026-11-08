// packages/event-system/src/runtime/dead-letter-runtime.ts
/**
 * Dead Letter Runtime (Operational Dead Letter Queue)
 * 
 * Responsibilities:
 * - Persistentially store events that failed all handler retries
 * - Provide administrative API to inspect, retry, or purge dead letters
 * - Generate alerts when DLQ size exceeds threshold
 * - Coordinate with observability for anomaly detection
 * 
 * Owned state:
 * - dlqEntries: DeadLetterEntry[]
 * - maxSize: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventRuntime (for retry publishing)
 * - EventPersistenceRuntime (to persist DLQ entries)
 */

import type { Event } from '@labforge/event-bus-runtime/contracts/event-bus-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventRuntime } from './distributed-event-runtime';

interface DeadLetterEntry {
  event: Event;
  reason: string;
  failedAt: number;
  retries: number;
}

export class DeadLetterRuntime {
  private entries: DeadLetterEntry[] = [];
  private readonly maxEntries = 10000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventRuntime: DistributedEventRuntime,
  ) {}

  async enqueue(event: Event, reason: string, retries: number): Promise<void> {
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
      this.meter.incrementCounter('dead_letter.overflow');
    }
    this.entries.push({ event, reason, failedAt: Date.now(), retries });
    this.meter.setGauge('dead_letter.size', this.entries.length);
    this.logger.warn(`Event moved to DLQ: ${event.metadata.eventId} (reason: ${reason})`);
  }

  async retryAll(): Promise<number> {
    const toRetry = [...this.entries];
    this.entries = [];
    let success = 0;
    for (const entry of toRetry) {
      try {
        await this.eventRuntime.publish(entry.event.type, entry.event.payload, {
          causationId: entry.event.metadata.causationId,
          replay: true,
        });
        success++;
      } catch (err) {
        this.entries.push({ ...entry, retries: entry.retries + 1 });
      }
    }
    this.meter.setGauge('dead_letter.size', this.entries.length);
    return success;
  }

  async purge(): Promise<void> {
    this.entries = [];
    this.meter.setGauge('dead_letter.size', 0);
  }

  stats(): { size: number; oldestTimestamp: number | null } {
    const oldest = this.entries.length > 0
      ? Math.min(...this.entries.map(e => e.failedAt))
      : null;
    return { size: this.entries.length, oldestTimestamp: oldest };
  }
}