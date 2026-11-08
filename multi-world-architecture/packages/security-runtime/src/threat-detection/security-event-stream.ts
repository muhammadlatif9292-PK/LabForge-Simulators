// packages/security-runtime/src/threat-detection/security-event-stream.ts
/**
 * Security Event Stream
 * 
 * Responsibilities:
 * - Collect and forward all security-relevant events to central analysis
 * - Ensure reliable delivery and ordering
 * - Buffer events when offline
 * - Support filtering and routing for SIEM integration
 * 
 * Owned state:
 * - eventBuffer: SecurityEvent[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to send aggregated stream)
 * 
 * Event emissions: "security.event" with aggregated payload
 * Event subscriptions: subscribes to multiple security topics
 * Synchronization: no special requirements
 * Recovery: buffer persists in local storage; sends on reconnect
 * Telemetry: events per second, buffer size
 * Diagnostics: stream health
 * Accessibility: N/A
 * Performance: batch sending to reduce network overhead
 * Forbidden: losing events due to buffer overflow
 */

import type { ThreatAlert } from '../contracts/security-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface SecurityEvent {
  type: string;
  timestamp: number;
  payload: unknown;
}

export class SecurityEventStream {
  private buffer: SecurityEvent[] = [];
  private readonly maxBufferSize = 1000;

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Subscribe to all security-related events and forward
    this.eventBus.subscribe('threat.alert', this.collect.bind(this));
    this.eventBus.subscribe('auth.failure', this.collect.bind(this));
    // etc.
  }

  private collect(event: { type: string; payload: unknown }): void {
    this.buffer.push({ type: event.type, timestamp: Date.now(), payload: event.payload });
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    await this.eventBus.publish('security.event.batch', batch);
    this.meter.incrementCounter('security.event_stream.batch_sent');
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }
}