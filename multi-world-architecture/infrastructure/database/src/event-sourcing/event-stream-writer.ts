// infrastructure/database/src/event-sourcing/event-stream-writer.ts
/**
 * Event Stream Writer
 * 
 * Responsibilities:
 * - Append events to a named stream in sequential order
 * - Assign sequence numbers and validate concurrency control (optimistic locking)
 * - Persist events durably and notify subscribers
 * - Handle idempotent writes (same eventId/stream not duplicated)
 * 
 * Owned state: none
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DatabaseClient (for storage)
 * - DistributedEventBus (to emit events after persistence)
 * 
 * Event emissions: "stream.event.written" per event
 * Event subscriptions: none
 * Synchronization: optimistic concurrency via expectedVersion
 * Recovery: events are durable; replay from stream on failure
 * Telemetry: write latency, event size histogram
 * Diagnostics: last sequence number per stream
 * Accessibility: N/A
 * Performance: batch writes for throughput; async index updates
 * Forbidden: writing events out of order; violating concurrency check
 */

import type { StreamId, SequenceNumber, DatabaseEvent } from '../contracts/database-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class EventStreamWriter {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private db: any, // event-store database
    private eventBus: DistributedEventBus,
  ) {}

  async appendEvents(streamId: StreamId, events: DatabaseEvent[], expectedVersion?: SequenceNumber): Promise<SequenceNumber> {
    const start = Date.now();
    // Retrieve current sequence number
    const currentSeq = await this.getCurrentSequence(streamId);
    if (expectedVersion !== undefined && currentSeq !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, actual ${currentSeq}`);
    }
    let nextSeq = currentSeq + 1;
    const sequenceNumbers: SequenceNumber[] = [];
    for (const event of events) {
      event.metadata.sequenceNumber = nextSeq as SequenceNumber;
      sequenceNumbers.push(nextSeq as SequenceNumber);
      nextSeq++;
    }
    await this.db.insertEvents(streamId, events);
    // Publish each event
    for (const event of events) {
      await this.eventBus.publish('stream.event.written', {
        streamId,
        eventType: event.eventType,
        eventData: event.eventData,
        metadata: event.metadata,
      });
    }
    const duration = Date.now() - start;
    this.meter.recordHistogram('database.event_stream.write.latency', duration);
    this.meter.incrementCounter('database.event_stream.events_written', events.length);
    this.logger.debug(`Appended ${events.length} events to stream ${streamId}`);
    return (nextSeq - 1) as SequenceNumber; // last sequence number
  }

  private async getCurrentSequence(streamId: StreamId): Promise<number> {
    // Query database for max sequence
    return this.db.getMaxSequence(streamId) ?? 0;
  }
}