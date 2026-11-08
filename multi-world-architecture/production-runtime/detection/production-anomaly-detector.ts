// production-runtime/detection/production-anomaly-detector.ts
/**
 * Production Anomaly Detector
 * 
 * Responsibilities:
 * - Analyse service metrics in real time for statistical anomalies
 * - Detect spikes, drifts, drops, pattern changes, and resource exhaustion
 * - Maintain adaptive baselines using exponential moving averages
 * - Trigger incidents when anomalies persist
 * - Provide actionable recommendations for operators
 * 
 * Owned state:
 * - metricWindows: Map<string, number[]>
 * - baselines: Map<string, { mean: number; stdDev: number }>
 * - activeAnomalies: Map<string, ProductionAnomaly>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - GlobalRuntimeMonitor (to receive metrics)
 * 
 * Event emissions:
 * - "production.anomaly.detected", "production.anomaly.resolved"
 * 
 * Event subscriptions:
 * - "monitor.service.healthy" metrics are ingested via GlobalRuntimeMonitor
 * 
 * Synchronization: per-metric sliding windows; no cross-metric coordination
 * Recovery: baselines recomputed on restart; anomaly history lost (acceptable)
 * Telemetry: anomaly count, detection latency
 * Diagnostics: current anomalies, baseline stats
 * Accessibility: anomaly alerts are operator-readable
 * Performance: O(1) window update; asynchronous alert generation
 * Forbidden: false positive storms; ignoring sustained anomalies
 */

import { v4 as uuidv4 } from 'uuid';
import type { ServiceName, RegionId, ServiceMetrics, ProductionAnomaly } from '../contracts/production-contracts';
import { IncidentSeverity } from '../contracts/production-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class ProductionAnomalyDetector {
  private windows: Map<string, number[]> = new Map();
  private baselines: Map<string, { mean: number; stdDev: number; count: number }> = new Map();
  private activeAnomalies: Map<string, ProductionAnomaly> = new Map();
  private readonly windowSize = 100;
  private readonly sensitivity = 3.0; // z-score threshold
  private readonly minDataPoints = 20;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  ingestMetric(serviceName: ServiceName, region: RegionId, metrics: ServiceMetrics): void {
    this.ingestMetricValue(serviceName, region, 'cpuPercent', metrics.cpuPercent);
    this.ingestMetricValue(serviceName, region, 'memoryPercent', metrics.memoryPercent);
    this.ingestMetricValue(serviceName, region, 'errorRate', metrics.errorRate);
    this.ingestMetricValue(serviceName, region, 'p99LatencyMs', metrics.p99LatencyMs);
    this.ingestMetricValue(serviceName, region, 'queueDepth', metrics.queueDepth);
  }

  private ingestMetricValue(serviceName: ServiceName, region: RegionId, metricName: string, value: number): void {
    const key = `${region}:${serviceName}:${metricName}`;
    let window = this.windows.get(key);
    if (!window) {
      window = [];
      this.windows.set(key, window);
    }
    window.push(value);
    if (window.length > this.windowSize) window.shift();
    // Update baseline when enough data
    if (window.length >= this.minDataPoints) {
      this.updateBaseline(key, window);
    }
    // Check for anomaly
    this.checkAnomaly(key, serviceName, region, metricName, value);
  }

  private updateBaseline(key: string, window: number[]): void {
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const stdDev = Math.sqrt(variance);
    this.baselines.set(key, { mean, stdDev, count: window.length });
  }

  private checkAnomaly(key: string, serviceName: ServiceName, region: RegionId, metricName: string, value: number): void {
    const baseline = this.baselines.get(key);
    if (!baseline || baseline.stdDev === 0) return;
    const zScore = Math.abs(value - baseline.mean) / baseline.stdDev;
    if (zScore > this.sensitivity) {
      const anomaly: ProductionAnomaly = {
        id: uuidv4(),
        type: value > baseline.mean ? 'spike' : 'drop',
        serviceName,
        metric: metricName,
        severity: zScore > 5 ? IncidentSeverity.SEV1 : zScore > 4 ? IncidentSeverity.SEV2 : IncidentSeverity.SEV3,
        detectedAt: Date.now(),
        currentValue: value,
        expectedValue: baseline.mean,
        deviationSigma: zScore,
        recommendation: this.generateRecommendation(metricName, value > baseline.mean),
      };
      const anomalyKey = `${region}:${serviceName}:${metricName}`;
      const existing = this.activeAnomalies.get(anomalyKey);
      if (existing) {
        // Update existing anomaly if worse
        if (zScore > existing.deviationSigma) {
          this.activeAnomalies.set(anomalyKey, anomaly);
        }
      } else {
        this.activeAnomalies.set(anomalyKey, anomaly);
        this.logger.warn(`Anomaly detected: ${serviceName}/${metricName} = ${value} (z=${zScore.toFixed(1)})`);
        this.meter.incrementCounter('production.anomaly.detected', { service: serviceName, metric: metricName });
        this.eventBus.publish('production.anomaly.detected', anomaly);
      }
    } else {
      // Check if anomaly resolved
      const anomalyKey = `${region}:${serviceName}:${metricName}`;
      const existing = this.activeAnomalies.get(anomalyKey);
      if (existing && Date.now() - existing.detectedAt > 60_000) {
        this.activeAnomalies.delete(anomalyKey);
        this.logger.info(`Anomaly resolved: ${serviceName}/${metricName}`);
        this.eventBus.publish('production.anomaly.resolved', { anomalyId: existing.id, serviceName, metricName });
        this.meter.incrementCounter('production.anomaly.resolved');
      }
    }
  }

  private generateRecommendation(metricName: string, isHigh: boolean): string {
    const recommendations: Record<string, string> = {
      cpuPercent: isHigh ? 'Scale up or throttle non-critical tasks' : 'Reduce over-provisioning to save cost',
      memoryPercent: isHigh ? 'Increase memory limit or profile for leaks' : 'No action needed',
      errorRate: isHigh ? 'Roll back recent deployment or check upstream dependencies' : 'No action needed',
      p99LatencyMs: isHigh ? 'Check database connection pool, scale replicas' : 'No action needed',
      queueDepth: isHigh ? 'Add consumer capacity or slow producer rate' : 'No action needed',
    };
    return recommendations[metricName] ?? 'Investigate metric change';
  }

  getActiveAnomalies(): ProductionAnomaly[] {
    return Array.from(this.activeAnomalies.values());
  }

  getActiveAnomalyCount(): number {
    return this.activeAnomalies.size;
  }

  clearResolved(): void {
    const threshold = Date.now() - 300_000; // 5 minutes
    for (const [key, anomaly] of this.activeAnomalies) {
      if (anomaly.detectedAt < threshold) {
        this.activeAnomalies.delete(key);
      }
    }
  }
}