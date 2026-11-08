// packages/observability-runtime/src/metrics/telemetry-stream-aggregator.ts
/**
 * Telemetry Stream Aggregator
 * 
 * Responsibilities:
 * - Aggregate metrics from multiple services into a unified stream
 * - Compute derived metrics (rates, percentiles) in-stream
 * - Batch and forward to alerting and storage systems
 * - Support downsampling for high-cardinality metrics
 * 
 * Owned state:
 * - aggregationWindows: Map<MetricName, AggregationWindow>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to consume raw telemetry and emit aggregated)
 * 
 * Event emissions: "telemetry.aggregated"
 * Event subscriptions: consumes "telemetry.raw" from all services
 * Synchronization: window-level locks if concurrent updates
 * Recovery: windows reset on restart (acceptable, as aggregated data is transient)
 * Telemetry: aggregation throughput, window sizes
 * Diagnostics: active aggregations
 * Accessibility: N/A
 * Performance: constant-memory window aggregation; avoid O(n) per metric
 * Forbidden: unbounded aggregation; losing data on backpressure
 */

import type { MetricName } from '../contracts/observability-contracts';
import type { ILogger, IMeter } from '../contracts/observability-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface AggregationWindow {
  sum: number;
  count: number;
  min: number;
  max: number;
  windowStart: number;
}

export class TelemetryStreamAggregator {
  private windows: Map<string, AggregationWindow> = new Map();
  private aggregationIntervalMs = 10000;
  private flushTimer: NodeJS.Timeout;

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('telemetry.raw', this.ingestMetric.bind(this));
    this.flushTimer = setInterval(() => this.flushAll(), this.aggregationIntervalMs);
  }

  ingestMetric(event: any): void {
    const { name, value, tags } = event.payload;
    const key = name + (tags ? JSON.stringify(tags) : '');
    let window = this.windows.get(key);
    if (!window) {
      window = { sum: 0, count: 0, min: Infinity, max: -Infinity, windowStart: Date.now() };
      this.windows.set(key, window);
    }
    window.sum += value;
    window.count++;
    window.min = Math.min(window.min, value);
    window.max = Math.max(window.max, value);
  }

  private async flushAll(): Promise<void> {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      const avg = window.count > 0 ? window.sum / window.count : 0;
      const aggregated = {
        key,
        sum: window.sum,
        count: window.count,
        avg,
        min: window.min,
        max: window.max,
        durationMs: now - window.windowStart,
      };
      await this.eventBus.publish('telemetry.aggregated', aggregated);
      // Reset window
      window.sum = 0;
      window.count = 0;
      window.min = Infinity;
      window.max = -Infinity;
      window.windowStart = now;
    }
  }

  shutdown(): void {
    clearInterval(this.flushTimer);
    this.flushAll();
  }
}