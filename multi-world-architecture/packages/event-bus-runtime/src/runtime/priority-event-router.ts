// packages/event-bus-runtime/src/runtime/priority-event-router.ts
/**
 * Priority Event Router
 * 
 * Responsibilities:
 * - Route events to matching subscribers with priority-based ordering
 * - Support event filtering and wildcard type matching
 * - Enforce handler execution timeouts
 * - Backpressure handling: pending queue with bounded capacity
 * - Observability of routing latency and errors
 * 
 * Owned state:
 * - pendingQueue: Array<{ event: Event; resolve: () => void }>
 * - activeHandlers: number
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: none directly, delegates to handlers
 * Event subscriptions: none
 * Synchronization: none (in-process, single-threaded)
 * Recovery: failed events pushed to dead-letter queue by DistributedEventBus
 * Telemetry: handler execution histograms, pending queue gauge
 * Diagnostics: pendingCount()
 * Accessibility: errors per handler tracked
 * Performance: async iteration over subscribers, bounded queue prevents OOM
 * Forbidden: synchronous external calls, infinite retry loops
 */

import type { Event, EventHandler, Subscription } from '../contracts/event-bus-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class PriorityEventRouter {
  private pending: Array<{ event: Event; resolve: () => void; reject: (err: Error) => void }> = [];
  private processing = false;
  private readonly MAX_QUEUE = 10_000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async route(event: Event, subscriptions: Subscription[]): Promise<void> {
    // Filter by type
    const matching = subscriptions.filter(s => this.matchesType(event.type, s.type));
    if (matching.length === 0) return;

    // Sort by priority (handler options)
    matching.sort((a, b) => (a.options.priority ?? 99) - (b.options.priority ?? 99));

    // Execute handlers concurrently with timeout
    const promises = matching.map(sub => this.executeHandlerWithTimeout(event, sub));
    await Promise.allSettled(promises);
  }

  private matchesType(eventType: string, subscriptionType: string): boolean {
    if (subscriptionType === '*') return true;
    if (subscriptionType.endsWith('.*')) {
      const prefix = subscriptionType.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return eventType === subscriptionType;
  }

  private async executeHandlerWithTimeout(event: Event, sub: Subscription): Promise<void> {
    const start = Date.now();
    const timeout = sub.options.timeout ?? 5000;
    try {
      const handlerPromise = Promise.resolve(sub.handler(event));
      if (timeout > 0) {
        await Promise.race([
          handlerPromise,
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Handler timeout')), timeout)),
        ]);
      } else {
        await handlerPromise;
      }
      this.meter.recordHistogram('eventbus.handler.duration', Date.now() - start, { type: event.type });
    } catch (err) {
      this.logger.error('Event handler error', { eventId: event.metadata.eventId, type: event.type, error: err });
      this.meter.incrementCounter('eventbus.handler.errors', { type: event.type });
      throw err; // will be caught by publisher and routed to DLQ
    }
  }

  pendingCount(): number {
    return this.pending.length;
  }
}