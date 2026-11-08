// packages/event-system/src/runtime/event-persistence-runtime.ts
/**
 * Event Persistence Runtime (Top-Level Wrapper)
 * 
 * Responsibilities:
 * - Provide a unified interface for persisting and querying events
 * - Delegate to the lower-level EventPersistenceRuntime from the event-bus-runtime
 * - Support batch writes and range queries with optional type filtering
 * 
 * Dependencies:
 * - EventPersistenceRuntime from @labforge/event-bus-runtime
 * - ILogger, IMeter
 */
import { EventPersistenceRuntime as LowLevelPersistence } from '@labforge/event-bus-runtime/runtime/event-persistence-runtime';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class EventPersistenceRuntime {
  private impl: LowLevelPersistence;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.impl = new LowLevelPersistence(logger);
  }

  async persist(events: any[]) {
    return this.impl.persist(events);
  }

  async query(fromTimestamp: number, toTimestamp?: number, type?: string) {
    return this.impl.query(fromTimestamp, toTimestamp, type);
  }

  async compact(olderThanTimestamp: number) {
    return this.impl.compact(olderThanTimestamp);
  }

  async getSnapshot(correlationId: string) {
    return this.impl.getSnapshot(correlationId);
  }

  async shutdown() {
    return this.impl.shutdown();
  }
}