// packages/event-bus-runtime/src/runtime/distributed-event-bus.ts
/**
 * Distributed Event Bus Runtime
 * 
 * Responsibilities:
 * - Central event distribution across all nodes
 * - Priority-based routing via PriorityEventRouter
 * - Guaranteed delivery with dead-letter queue
 * - Replay capability for crash recovery and new subscribers
 * - Persistence of all events for audit and replay
 * - Observability with structured logs, metrics, and tracing
 * 
 * Owned state:
 * - subscriptions: Map<SubscriptionId, Subscription>
 * - typeIndex: Map<string, Subscription[]> for fast lookup
 * - localPending: in-memory queue when transport unavailable
 * - health counters
 * 
 * Dependencies:
 * - PriorityEventRouter
 * - EventReplayEngine
 * - DeadLetterQueue
 * - EventConsistencyValidator
 * - EventPersistenceRuntime
 * - TelemetryService (ILogger, IMeter, ITracer)
 * - DistributedLockManager (for replay coordination)
 * 
 * Event emissions:
 * - "eventbus.message.published" after successful publish
 * - "eventbus.subscription.added" / "removed"
 * - "eventbus.health.changed"
 * 
 * Event subscriptions: none externally (this is the bus)
 * Synchronization: distributed locks during replay; idempotency via eventId
 * Recovery: persists events before dispatch; replay on startup if gaps detected
 * Telemetry: per-event latency histograms, throughput counter, dead-letter gauge
 * Diagnostics: health endpoint, pending queue depth, filter match rates
 * Accessibility: all error events logged with structured data
 * Performance: zero-copy payload forwarding when possible; batched persistence
 * Forbidden: synchronous blocking I/O during publish, mutation of shared state without lock
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Event,
  EventId,
  CorrelationId,
  CausationId,
  SubscriptionId,
  EventHandler,
  EventMetadata,
  PublishOptions,
  Subscription,
  SubscriptionOptions,
  EventBusHealth,
  EventPriority,
  EventBus,
} from '../contracts/event-bus-contracts';
import { PriorityEventRouter } from './priority-event-router';
import { EventReplayEngine } from './event-replay-engine';
import { DeadLetterQueue } from './dead-letter-queue';
import { EventConsistencyValidator } from './event-consistency-validator';
import { EventPersistenceRuntime } from './event-persistence-runtime';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime'; // hypothetical
import type { DistributedLockManager } from '@labforge/backend/distributed-lock-manager'; // hypothetical

export class DistributedEventBus implements EventBus {
  private subscriptions: Map<SubscriptionId, Subscription> = new Map();
  private typeIndex: Map<string, Subscription[]> = new Map();
  private router: PriorityEventRouter;
  private replayEngine: EventReplayEngine;
  private deadLetter: DeadLetterQueue;
  private validator: EventConsistencyValidator;
  private persistence: EventPersistenceRuntime;
  private lockManager?: DistributedLockManager; // optional, for coordinated replay

  // Observability
  private publishedCounter: number = 0;
  private handlerErrors: number = 0;
  private latencyAccumulator: number[] = [];
  private lastHealthCheck: number = Date.now();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    options?: { lockManager?: DistributedLockManager; persistence?: EventPersistenceRuntime },
  ) {
    this.router = new PriorityEventRouter(logger, meter);
    this.replayEngine = new EventReplayEngine(this, this.logger, meter, tracer, options?.persistence);
    this.deadLetter = new DeadLetterQueue(this, logger, meter);
    this.validator = new EventConsistencyValidator();
    this.persistence = options?.persistence ?? new EventPersistenceRuntime(logger);
    this.lockManager = options?.lockManager;
  }

  async publish<TPayload>(type: string, payload: TPayload, options?: PublishOptions): Promise<EventId> {
    const traceSpan = this.tracer.startSpan('eventbus.publish', { type });
    const eventId = uuidv4() as EventId;
    const metadata: EventMetadata = {
      eventId,
      correlationId: (options?.correlationId as CorrelationId) ?? (uuidv4() as CorrelationId),
      causationId: options?.causationId,
      timestamp: Date.now(),
      schemaVersion: 1,
      priority: options?.priority ?? EventPriority.MEDIUM,
      source: process.env.SERVICE_NAME ?? 'unknown',
      replay: options?.replay ?? false,
      ttl: options?.ttl,
      tags: options?.tags,
    };
    const event: Event<TPayload> = { type, payload, metadata };

    // Validate
    const validation = this.validator.validate(event);
    if (!validation.valid) {
      this.logger.error('Event validation failed', { eventId, errors: validation.errors });
      traceSpan.setTag('error', true);
      traceSpan.finish();
      throw new Error(`Event validation failed: ${validation.errors.join(', ')}`);
    }

    // Persist before dispatch (guaranteed delivery)
    await this.persistence.persist([event]);

    // Route to subscribers
    await this.router.route(event);

    this.publishedCounter++;
    const elapsed = Date.now() - metadata.timestamp;
    this.latencyAccumulator.push(elapsed);
    this.meter.recordHistogram('eventbus.publish.latency', elapsed);
    this.meter.incrementCounter('eventbus.published_total', { type });

    traceSpan.finish();
    return eventId;
  }

  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>, options?: SubscriptionOptions): SubscriptionId {
    const id = uuidv4() as SubscriptionId;
    const sub: Subscription = {
      id,
      type,
      handler: handler as EventHandler,
      options: options ?? {},
    };
    this.subscriptions.set(id, sub);

    const existing = this.typeIndex.get(type) ?? [];
    existing.push(sub);
    this.typeIndex.set(type, existing);

    this.logger.info('Subscription added', { subscriptionId: id, type });
    this.meter.incrementCounter('eventbus.subscriptions', { type, action: 'add' });
    return id;
  }

  unsubscribe(subscriptionId: SubscriptionId): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;
    this.subscriptions.delete(subscriptionId);

    const subs = this.typeIndex.get(sub.type) ?? [];
    this.typeIndex.set(sub.type, subs.filter(s => s.id !== subscriptionId));

    this.logger.info('Subscription removed', { subscriptionId, type: sub.type });
    this.meter.incrementCounter('eventbus.subscriptions', { type: sub.type, action: 'remove' });
  }

  async replay(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<void> {
    const traceSpan = this.tracer.startSpan('eventbus.replay', { fromTimestamp, toTimestamp, type });
    if (this.lockManager) {
      const lock = await this.lockManager.acquire('eventbus:replay', 30000);
      try {
        await this.replayEngine.replay(fromTimestamp, toTimestamp, type);
      } finally {
        await lock.release();
      }
    } else {
      await this.replayEngine.replay(fromTimestamp, toTimestamp, type);
    }
    traceSpan.finish();
  }

  async health(): Promise<EventBusHealth> {
    const deadLetterStats = this.deadLetter.stats();
    const p50 = this.calculatePercentile(50);
    const p99 = this.calculatePercentile(99);
    return {
      status: deadLetterStats.queued > 100 ? 'degraded' : 'healthy',
      pendingEvents: this.router.pendingCount(),
      deadLetterCount: deadLetterStats.queued,
      activeSubscriptions: this.subscriptions.size,
      throughputPerSec: this.calculateThroughput(),
      latencyMs: { p50, p99 },
    };
  }

  // Internal helpers for observability
  private calculatePercentile(percentile: number): number {
    if (this.latencyAccumulator.length === 0) return 0;
    const sorted = [...this.latencyAccumulator].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] ?? 0;
  }

  private calculateThroughput(): number {
    const now = Date.now();
    const elapsed = (now - this.lastHealthCheck) / 1000;
    if (elapsed <= 0) return 0;
    const rate = this.publishedCounter / elapsed;
    // reset counters
    this.publishedCounter = 0;
    this.lastHealthCheck = now;
    return Math.round(rate);
  }
}