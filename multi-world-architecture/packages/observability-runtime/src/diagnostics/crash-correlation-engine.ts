// packages/observability-runtime/src/diagnostics/crash-correlation-engine.ts
/**
 * Crash Correlation Engine
 * 
 * Responsibilities:
 * - When a crash occurs, correlate it with recent anomalies, traces, and logs
 * - Identify root cause candidates by analyzing patterns
 * - Generate crash reports with correlated signals
 * - Store crash signatures for future pattern matching
 * 
 * Owned state:
 * - recentSignals: AnomalySignal[] (sliding window)
 * - crashHistory: CrashReport[] (bounded)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - DistributedTraceEngine (to query recent traces)
 * 
 * Event emissions: "observability.crash.report.generated"
 * Event subscriptions: "service.crash" (from any service)
 * Synchronization: none
 * Recovery: if engine itself crashes, reports may be lost; local log backup
 * Telemetry: correlation accuracy, mean time to identify
 * Diagnostics: recent crash reports
 * Accessibility: N/A
 * Performance: lightweight matching; no blocking calls to trace store
 * Forbidden: generating false crash reports from misclassified warnings
 */

import { v4 as uuidv4 } from 'uuid';
import type { AnomalySignal, CrashReport, TraceId } from '../contracts/observability-contracts';
import type { ILogger, IMeter } from '../contracts/observability-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class CrashCorrelationEngine {
  private recentAnomalies: AnomalySignal[] = [];
  private crashHistory: CrashReport[] = [];
  private maxStored = 200;

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('observability.anomaly.detected', (event) => {
      this.recentAnomalies.push(event.payload as AnomalySignal);
      if (this.recentAnomalies.length > this.maxStored) this.recentAnomalies.shift();
    });
    this.eventBus.subscribe('service.crash', this.onCrash.bind(this));
  }

  async onCrash(event: any): Promise<void> {
    const { serviceName, errorMessage, stackTrace, timestamp } = event.payload;
    this.meter.incrementCounter('observability.crash.detected');
    // Correlate with recent anomalies in the same service
    const correlatedAnomalies = this.recentAnomalies.filter(
      a => a.source === serviceName && (timestamp - a.timestamp) < 30000, // within 30s
    );
    // Simulate trace correlation
    const correlatedTraces: TraceId[] = []; // from trace engine query

    const report: CrashReport = {
      crashId: uuidv4(),
      serviceName,
      timestamp,
      errorMessage,
      stackTrace,
      correlatedTraces,
      affectedUsers: 0,
    };
    this.crashHistory.push(report);
    if (this.crashHistory.length > this.maxStored) this.crashHistory.shift();

    await this.eventBus.publish('observability.crash.report.generated', report);
    this.logger.error(`Crash report generated for ${serviceName}: ${errorMessage}`);
  }

  getRecentCrashes(limit = 10): CrashReport[] {
    return this.crashHistory.slice(-limit);
  }
}