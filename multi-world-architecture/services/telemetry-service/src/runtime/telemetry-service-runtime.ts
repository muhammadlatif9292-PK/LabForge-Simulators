// services/telemetry-service/src/runtime/telemetry-service-runtime.ts
/**
 * Telemetry Service Runtime
 * 
 * Responsibilities:
 * - Aggregate telemetry from all services via the event bus.
 * - Expose metrics endpoint for Prometheus scraping.
 * - Run distributed tracing aggregation (tail sampling).
 * - Forward structured logs to Loki / ELK.
 * 
 * Owned state:
 * - metricsRegistry: PrometheusRegistry
 * - spanBuffer: Span[]
 * 
 * Dependencies:
 * - TelemetryStreamAggregator, DistributedTraceEngine, DistributedLogRuntime
 * 
 * Event emissions: none (collector role)
 * Event subscriptions: "telemetry.metric", "telemetry.trace", "logs.batch"
 * Synchronization: none (aggregation)
 * Recovery: lost metrics on crash (acceptable for scraping)
 * Telemetry: self-monitoring (scrape latency, buffer sizes)
 * Diagnostics: collector health
 * Accessibility: N/A
 * Performance: batched exports; avoid blocking metrics scrape
 * Forbidden: dropping metrics without alert
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { TelemetryStreamAggregator } from '@labforge/observability-runtime';
import type { DistributedTraceEngine } from '@labforge/observability-runtime';

export class TelemetryServiceRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private aggregator: TelemetryStreamAggregator,
    private traceEngine: DistributedTraceEngine,
  ) {}

  async start(): Promise<void> {
    this.eventBus.subscribe('telemetry.raw', (event) => {
      this.aggregator.ingestMetric(event);
    });
    this.logger.info('Telemetry service runtime started');
    this.meter.incrementCounter('telemetry_service.started');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Telemetry service runtime stopped');
  }
}