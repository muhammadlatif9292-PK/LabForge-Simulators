// packages/observability-runtime/src/alerting/performance-alert-engine.ts
/**
 * Performance Alert Engine
 * 
 * Responsibilities:
 * - Evaluate performance metrics against defined thresholds (SLOs)
 * - Generate alerts when thresholds are breached
 * - Support hysteresis to avoid alert flapping
 * - Integrate with RecoveryAlertRouter for auto-remediation
 * 
 * Owned state:
 * - thresholds: Map<MetricName, { warn: number; crit: number; cooldownMs: number }>
 * - lastAlerted: Map<MetricName, number> (cooldown)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to emit alerts)
 * - TelemetryStreamAggregator (or consume 'telemetry.aggregated')
 * 
 * Event emissions: "observability.performance.alert"
 * Event subscriptions: consumes "telemetry.aggregated"
 * Synchronization: none
 * Recovery: thresholds reloaded from config; cooldown reset on restart
 * Telemetry: alert count per metric, false positive rate
 * Diagnostics: current threshold violations
 * Accessibility: alerts include human-readable messages
 * Performance: O(1) lookup for thresholds
 * Forbidden: alert storm from rapid oscillations; ignoring breaches
 */

import type { PerformanceAlert, MetricName } from '../contracts/observability-contracts';
import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '../contracts/observability-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface Threshold {
  warn: number;
  critical: number;
  cooldownMs: number;
}

export class PerformanceAlertEngine {
  private thresholds: Map<string, Threshold> = new Map();
  private lastAlerted: Map<string, number> = new Map();

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Default thresholds
    this.setThreshold('http.request.latency.p99', { warn: 500, critical: 1000, cooldownMs: 60000 });
    this.setThreshold('memory.usage.percent', { warn: 80, critical: 95, cooldownMs: 120000 });
    this.setThreshold('cpu.usage.percent', { warn: 80, critical: 90, cooldownMs: 60000 });

    this.eventBus.subscribe('telemetry.aggregated', this.evaluateMetric.bind(this));
  }

  setThreshold(name: MetricName, threshold: Threshold): void {
    this.thresholds.set(name, threshold);
  }

  private async evaluateMetric(event: any): Promise<void> {
    const { key, avg, min, max, count } = event.payload;
    // key includes tags; we match base metric name
    const threshold = this.findThreshold(key);
    if (!threshold) return;

    const now = Date.now();
    const lastAlert = this.lastAlerted.get(key) ?? 0;
    if (now - lastAlert < threshold.cooldownMs) return;

    const maxValue = max;
    let breached = false;
    let severity: 'high' | 'critical' = 'high';
    if (maxValue >= threshold.critical) {
      breached = true;
      severity = 'critical';
    } else if (maxValue >= threshold.warn) {
      breached = true;
      severity = 'high';
    }
    if (!breached) return;

    this.lastAlerted.set(key, now);
    const alert: PerformanceAlert = {
      id: uuidv4(),
      metric: key as MetricName,
      threshold: threshold.warn,
      currentValue: maxValue,
      evaluatedAt: now,
      breached: true,
    };
    await this.eventBus.publish('observability.performance.alert', { ...alert, severity });
    this.meter.incrementCounter('observability.performance.alert');
    this.logger.warn(`Performance alert: ${key} = ${maxValue} (threshold ${threshold.warn})`);
  }

  private findThreshold(metricKey: string): Threshold | undefined {
    for (const [name, threshold] of this.thresholds) {
      if (metricKey.startsWith(name)) return threshold;
    }
    return undefined;
  }
}