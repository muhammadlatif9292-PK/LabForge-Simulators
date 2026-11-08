// packages/observability-runtime/src/diagnostics/runtime-anomaly-detector.ts
/**
 * Runtime Anomaly Detector
 * 
 * Responsibilities:
 * - Analyze metric streams in real time for deviations from baselines
 * - Use statistical methods (moving average, std dev) for detection
 * - Emit anomaly signals when thresholds exceeded
 * - Support configurable sensitivity per metric
 * 
 * Owned state:
 * - metricWindows: Map<MetricName, number[]> (sliding window)
 * - baselines: Map<MetricName, { mean: number, stdDev: number }>
 * 
 * Dependencies:
 * - ILogger, IMeter (for internal counters)
 * - DistributedEventBus (to emit anomaly signals)
 * - DistributedTraceEngine (optional, to link traces)
 * 
 * Event emissions: "observability.anomaly.detected"
 * Event subscriptions: consumes aggregated telemetry stream
 * Synchronization: per-metric, no cross-metric locks
 * Recovery: baselines recomputed on restart from recent window
 * Telemetry: anomaly count per metric
 * Diagnostics: current baseline values
 * Accessibility: N/A
 * Performance: O(1) window updates; incremental statistics
 * Forbidden: false positive storms; ignoring sustained anomalies
 */

import { v4 as uuidv4 } from 'uuid';
import type { AnomalySignal, MetricName } from '../contracts/observability-contracts';
import type { ILogger, IMeter } from '../contracts/observability-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class RuntimeAnomalyDetector {
  private windows: Map<string, number[]> = new Map();
  private baselines: Map<string, { mean: number; stdDev: number; count: number }> = new Map();
  private windowSize = 100;
  private sensitivity = 3.0; // z-score threshold

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Subscribe to metrics stream
    this.eventBus.subscribe('telemetry.metric', this.ingestMetric.bind(this));
  }

  ingestMetric(event: any): void {
    const { name, value, timestamp, tags } = event.payload;
    // Update window
    let window = this.windows.get(name);
    if (!window) {
      window = [];
      this.windows.set(name, window);
    }
    window.push(value);
    if (window.length > this.windowSize) window.shift();

    // Update baseline periodically
    if (window.length === this.windowSize) {
      this.updateBaseline(name, window);
    }

    // Check anomaly
    this.checkAnomaly(name, value, tags);
  }

  private updateBaseline(name: string, window: number[]): void {
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const stdDev = Math.sqrt(variance);
    this.baselines.set(name, { mean, stdDev, count: window.length });
  }

  private async checkAnomaly(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const baseline = this.baselines.get(name);
    if (!baseline || baseline.stdDev === 0) return;

    const zScore = Math.abs(value - baseline.mean) / baseline.stdDev;
    if (zScore > this.sensitivity) {
      const signal: AnomalySignal = {
        id: uuidv4(),
        type: 'metric_anomaly',
        severity: zScore > 5 ? 'critical' : 'high',
        source: name,
        timestamp: Date.now(),
        details: { metric: name, value, mean: baseline.mean, stdDev: baseline.stdDev, zScore, tags },
      };
      await this.eventBus.publish('observability.anomaly.detected', signal);
      this.meter.incrementCounter('observability.anomaly.detected');
      this.logger.warn(`Anomaly detected: ${name} = ${value} (z=${zScore.toFixed(2)})`);
    }
  }

  setSensitivity(sigma: number): void {
    this.sensitivity = sigma;
  }
}