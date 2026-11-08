// instrumentation-core/runtime/instrument-diagnostics.ts
/**
 * Instrument Diagnostics
 * 
 * Responsibilities:
 * - Provide health checks for each instrument instance
 * - Detect anomalies: calibration drift, measurement outliers, error states
 * - Generate diagnostic reports for observability pipeline
 * - Support remote debugging of instrument issues
 * 
 * Owned state:
 * - errorLog: DiagnosticEvent[] (bounded)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "instrument.diagnostics.alert"
 * Event subscriptions: "instrument.state.changed" to track errors
 * Synchronization: none
 * Recovery: diagnostic log survives crash for post-mortem analysis
 * Telemetry: error frequency, calibration status
 * Diagnostics: exposed health endpoint
 * Accessibility: alert messages are human-readable
 * Performance: lightweight checks; no continuous monitoring overhead
 * Forbidden: slowing instrument operation for diagnostics
 */

import type { InstrumentState } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface DiagnosticEvent {
  instrumentId: string;
  timestamp: number;
  type: string;
  details: Record<string, unknown>;
}

export class InstrumentDiagnostics {
  private events: DiagnosticEvent[] = [];
  private maxEvents = 500;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  logEvent(instrumentId: string, type: string, details: Record<string, unknown> = {}): void {
    const event: DiagnosticEvent = { instrumentId, timestamp: Date.now(), type, details };
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();
    this.logger.debug(`Instrument diagnostic: ${type} on ${instrumentId}`, details);
    this.meter.incrementCounter('instrument.diagnostics.event', { type });
  }

  getRecentEvents(instrumentId: string, limit: number = 20): DiagnosticEvent[] {
    return this.events.filter(e => e.instrumentId === instrumentId).slice(-limit);
  }

  clear(): void { this.events = []; }
}