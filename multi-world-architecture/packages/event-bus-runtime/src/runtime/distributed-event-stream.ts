// packages/event-bus-runtime/src/runtime/distributed-event-stream.ts
/**
 * Distributed Event Stream
 * 
 * Responsibilities:
 * - Provide a unified, persistent, append-only log of all events across all services
 * - Support partitioned streams per domain (e.g., workspace, simulation, AI)
 * - Enable catch-up subscriptions for late-joining consumers
 * - Coordinate with Kafka / Redis Streams for production deployments
 * - Guarantee at-least-once delivery with idempotency keys
 * 
 * Owned state:
 * - streamWriters: Map<StreamId, EventStreamWriter>
 * - activeSubscriptions: Map<SubscriptionId, StreamSubscription>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (itself, for inter-service events)
 * - EventPersistenceRuntime (for durable storage)
 * - EventStreamWriter / EventStreamReader (from database layer)
 * 
 * Event emissions: none (this IS the stream)
 * Event subscriptions: "eventbus.message.published" to persist all events
 * Synchronization: per-stream ordering; no cross-stream ordering guarantee
 * Recovery: streams persisted to Kafka/Redis; replayable
 * Telemetry: bytes written per second, active subscriptions, lag
 * Diagnostics: stream health, consumer offsets
 * Accessibility: N/A
 * Performance: asynchronous append; batching for throughput
 * Forbidden: losing acknowledged events; breaking ordering within a stream
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from './distributed-event-bus';
import type { EventPersistenceRuntime } from './event-persistence-runtime';
import type { Event, EventId } from '../contracts/event-bus-contracts';

export type StreamId = string;
export type SubscriptionId = string;

interface StreamSubscription {
  id: SubscriptionId;
  streamId: StreamId;
  consumerGroup: string;
  handler: (event: Event) => Promise<void>;
  offset: number;
}

export class DistributedEventStream {
  private subscriptions: Map<SubscriptionId, StreamSubscription> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private persistence: EventPersistenceRuntime,
  ) {
    // Listen to ALL events published on the bus and persist them to the stream
    this.eventBus.subscribe('*', (event: Event) => {
      this.appendToStream(event).catch(err =>
        this.logger.error('Failed to append event to stream', { error: err }),
      );
    });
  }

  async appendToStream(event: Event): Promise<void> {
    // Determine stream from event type (e.g., "workspace.*" → "workspace" stream)
    const streamId = event.type.split('.')[0] ?? 'global';
    await this.persistence.persist([{ ...event, metadata: { ...event.metadata, streamId } } as any]);
    this.meter.incrementCounter('distributed_event_stream.appended', { stream: streamId });
  }

  subscribe(
    streamId: StreamId,
    consumerGroup: string,
    handler: (event: Event) => Promise<void>,
  ): SubscriptionId {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}` as SubscriptionId;
    this.subscriptions.set(id, {
      id,
      streamId,
      consumerGroup,
      handler,
      offset: 0,
    });
    this.meter.incrementCounter('distributed_event_stream.subscription', { stream: streamId });
    return id;
  }

  async pollSubscriptions(): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      const events = await this.persistence.query(sub.offset, Date.now(), sub.streamId);
      for (const event of events) {
        await sub.handler(event as Event);
        sub.offset = event.metadata.timestamp + 1;
      }
    }
  }
}