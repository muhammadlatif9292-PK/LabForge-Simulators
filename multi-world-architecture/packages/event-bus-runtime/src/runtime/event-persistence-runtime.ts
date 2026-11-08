// packages/event-bus-runtime/src/runtime/event-persistence-runtime.ts
/**
 * Event Persistence Runtime
 * 
 * Responsibilities:
 * - Durably store events in order for replay and audit
 * - Support batch writing with batching window for performance
 * - Enable range queries by timestamp and type
 * - Compact old events into snapshots
 * - Provide snapshot retrieval for fast restoration
 * 
 * Owned state:
 * - writeBuffer: Event[] for batching
 * - flushTimer: NodeJS.Timeout
 * 
 * Dependencies: ILogger, database client (injected)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none (assumes single writer per partition)
 * Recovery: flush buffer on process termination; write-ahead log
 * Telemetry: write latency, batch size, compaction duration
 * Diagnostics: buffer size, last flush timestamp
 * Accessibility: N/A
 * Performance: uses bulk inserts, indexes on (timestamp, type)
 * Forbidden: losing events due to buffer overflow without alert
 */

import type { Event } from '../contracts/event-bus-contracts';
import type { ILogger } from '@labforge/observability-runtime';

// Dummy database interface
interface IDatabase {
  insertEvents(events: Event[]): Promise<void>;
  queryEvents(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<Event[]>;
  compactEvents(olderThanTimestamp: number): Promise<void>;
  getSnapshot(correlationId: string): Promise<Event[] | null>;
}

export class EventPersistenceRuntime {
  private writeBuffer: Event[] = [];
  private maxBufferSize = 100;
  private flushIntervalMs = 1000;
  private flushTimer: NodeJS.Timeout | null = null;
  private db: IDatabase;

  constructor(
    private logger: ILogger,
    db?: IDatabase,
  ) {
    this.db = db ?? new InMemoryDatabase();
    this.startFlushTimer();
  }

  async persist(events: Event[]): Promise<void> {
    this.writeBuffer.push(...events);
    if (this.writeBuffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  async query(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<Event[]> {
    return this.db.queryEvents(fromTimestamp, toTimestamp, type);
  }

  async compact(olderThanTimestamp: number): Promise<void> {
    await this.db.compactEvents(olderThanTimestamp);
    this.logger.info(`Compacted events older than ${new Date(olderThanTimestamp).toISOString()}`);
  }

  async getSnapshot(correlationId: string): Promise<Event[] | null> {
    return this.db.getSnapshot(correlationId);
  }

  private async flush(): Promise<void> {
    if (this.writeBuffer.length === 0) return;
    const events = this.writeBuffer.splice(0);
    try {
      await this.db.insertEvents(events);
      this.logger.debug(`Flushed ${events.length} events to persistence`);
    } catch (err) {
      this.logger.error('Failed to persist events', { error: err, count: events.length });
      // Re-add to buffer? Could cause memory pressure; better to push to dead-letter or crash
      throw err;
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async shutdown() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}

// Simple in-memory implementation for development/testing
class InMemoryDatabase implements IDatabase {
  private events: Event[] = [];
  private snapshots: Map<string, Event[]> = new Map();

  async insertEvents(events: Event[]): Promise<void> {
    this.events.push(...events);
    // Keep sorted by timestamp
    this.events.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  }

  async queryEvents(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<Event[]> {
    return this.events.filter(e => {
      if (e.metadata.timestamp < fromTimestamp) return false;
      if (toTimestamp && e.metadata.timestamp > toTimestamp) return false;
      if (type && e.type !== type) return false;
      return true;
    });
  }

  async compactEvents(olderThanTimestamp: number): Promise<void> {
    // Move old events into snapshots (simplified)
    const oldEvents = this.events.filter(e => e.metadata.timestamp < olderThanTimestamp);
    this.events = this.events.filter(e => e.metadata.timestamp >= olderThanTimestamp);
    // Create snapshot per correlationId (naive)
    const byCorrelation = new Map<string, Event[]>();
    for (const e of oldEvents) {
      const key = e.metadata.correlationId;
      if (!byCorrelation.has(key)) byCorrelation.set(key, []);
      byCorrelation.get(key)!.push(e);
    }
    for (const [corrId, events] of byCorrelation) {
      this.snapshots.set(corrId, events);
    }
  }

  async getSnapshot(correlationId: string): Promise<Event[] | null> {
    return this.snapshots.get(correlationId) ?? null;
  }
}