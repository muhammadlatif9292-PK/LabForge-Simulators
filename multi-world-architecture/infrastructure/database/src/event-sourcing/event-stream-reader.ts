// infrastructure/database/src/event-sourcing/event-stream-reader.ts
/**
 * Event Stream Reader
 * 
 * Responsibilities:
 * - Retrieve events from a stream by sequence range or timestamp
 * - Support forward and backward iteration
 * - Provide streaming subscription for real-time tailing
 * - Handle large result sets with pagination/cursors
 * 
 * Owned state:
 * - activeSubscriptions: Map<StreamId, Cursor>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DatabaseClient
 * 
 * Event emissions: none (but can be used to feed replay engines)
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: stream position restored from last checkpoint
 * Telemetry: read latency, events throughput
 * Diagnostics: current read position per subscription
 * Accessibility: N/A
 * Performance: index scans; use LIMIT/OFFSET cursors
 * Forbidden: loading entire stream into memory; blocking reads
 */

import type { StreamId, SequenceNumber, DatabaseEvent } from '../contracts/database-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class EventStreamReader {
  private cursors: Map<StreamId, SequenceNumber> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private db: any,
  ) {}

  async readEvents(
    streamId: StreamId,
    fromSequence: SequenceNumber,
    maxCount: number = 1000,
  ): Promise<DatabaseEvent[]> {
    const start = Date.now();
    const events = await this.db.queryEvents(streamId, fromSequence, maxCount);
    this.meter.recordHistogram('database.event_stream.read.latency', Date.now() - start);
    this.meter.incrementCounter('database.event_stream.events_read', events.length);
    return events;
  }

  async subscribeToStream(streamId: StreamId, callback: (event: DatabaseEvent) => void): Promise<void> {
    const lastSeq = this.cursors.get(streamId) ?? 0 as SequenceNumber;
    // Simulate polling or use change stream from DB
    setInterval(async () => {
      const newEvents = await this.readEvents(streamId, lastSeq, 100);
      for (const e of newEvents) {
        callback(e);
        this.cursors.set(streamId, e.metadata.sequenceNumber);
      }
    }, 1000);
  }

  async getStreamSize(streamId: StreamId): Promise<number> {
    return this.db.getMaxSequence(streamId);
  }
}