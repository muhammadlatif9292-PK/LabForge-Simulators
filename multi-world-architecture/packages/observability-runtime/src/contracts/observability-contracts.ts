// packages/observability-runtime/src/contracts/observability-contracts.ts
/**
 * Observability Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for metrics, tracing, logging, and alerting
 * - Ensure all observability signals conform to OpenTelemetry-compatible shapes
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type TraceId = string & { readonly __brand: 'TraceId' };
export type SpanId = string & { readonly __brand: 'SpanId' };
export type MetricName = string;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
}

export interface IMeter {
  incrementCounter(name: MetricName, value?: number, tags?: Record<string, string>): void;
  recordHistogram(name: MetricName, value: number, tags?: Record<string, string>): void;
  setGauge(name: MetricName, value: number, tags?: Record<string, string>): void;
}

export interface ITracer {
  startSpan(name: string, attributes?: Record<string, string | number>): ISpan;
}

export interface ISpan {
  setTag(key: string, value: string | number | boolean): void;
  finish(): void;
}

export interface Trace {
  traceId: TraceId;
  spans: Span[];
  startTime: number;
  endTime?: number;
  rootSpanId: SpanId;
}

export interface Span {
  spanId: SpanId;
  parentSpanId?: SpanId;
  traceId: TraceId;
  name: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number>;
}

export interface AnomalySignal {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: number;
  details: Record<string, unknown>;
  metricSnapshot?: Record<string, number>;
}

export interface CrashReport {
  crashId: string;
  serviceName: string;
  timestamp: number;
  errorMessage: string;
  stackTrace?: string;
  correlatedTraces: TraceId[];
  affectedUsers?: number;
}

export interface PerformanceAlert {
  id: string;
  metric: MetricName;
  threshold: number;
  currentValue: number;
  evaluatedAt: number;
  breached: boolean;
  tags?: Record<string, string>;
}

export interface RecoveryAlert {
  id: string;
  alertType: 'crash' | 'degradation' | 'timeout' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  message: string;
  timestamp: number;
  suggestedAction: string;
  autoRecoveryTriggered: boolean;
}