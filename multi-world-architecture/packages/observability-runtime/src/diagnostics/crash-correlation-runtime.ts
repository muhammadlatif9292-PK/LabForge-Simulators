// packages/observability-runtime/src/diagnostics/crash-correlation-runtime.ts
/**
 * Crash Correlation Runtime
 * 
 * Responsibilities:
 * - Top-level orchestrator for correlating crashes with recent anomalies
 * - Generates incident reports and triggers recovery actions
 * - Provides a query interface for root cause analysis
 * 
 * Dependencies:
 * - CrashCorrelationEngine (from diagnostics/)
 * - ILogger, IMeter
 * - DistributedEventBus
 */

import { CrashCorrelationEngine } from './crash-correlation-engine';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class CrashCorrelationRuntime {
  private engine: CrashCorrelationEngine;

  constructor(
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    this.engine = new CrashCorrelationEngine(eventBus, logger, meter);
  }

  async onServiceCrash(serviceName: string, errorMessage: string) {
    return this.engine.onCrash({ payload: { serviceName, errorMessage, timestamp: Date.now() } });
  }

  getRecentCrashes(limit: number = 10) {
    return this.engine.getRecentCrashes(limit);
  }
}