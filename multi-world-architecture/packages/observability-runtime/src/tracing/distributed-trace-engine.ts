// packages/observability-runtime/src/tracing/distributed-trace-engine.ts
/**
 * Distributed Trace Engine
 * 
 * Responsibilities:
 * - Collect and propagate trace context across service boundaries
 * - Buffer spans locally and export in batches to a collector
 * - Support W3C Trace Context and OpenTelemetry standards
 * - Sample traces intelligently (head-based, tail-based)
 * 
 * Owned state:
 * - pendingSpans: Span[]
 * - samplingConfig: { rate: number }
 * 
 * Dependencies:
 * - ILogger, IMeter (itself, for internal telemetry; careful to avoid recursion)
 * - Trace exporter (e.g., OTLP to Jaeger or Grafana Tempo)
 * 
 * Event emissions: none (batch export)
 * Event subscriptions: none
 * Synchronization: none required; spans are independent
 * Recovery: flush buffer on shutdown; lost spans acceptable under crash
 * Telemetry: internal metrics like span drop count
 * Diagnostics: buffer depth, export latency
 * Accessibility: N/A
 * Performance: asynchronous export; sampling reduces overhead
 * Forbidden: blocking request path on trace export; unbounded buffer growth
 */

import { v4 as uuidv4 } from 'uuid';
import type { TraceId, SpanId, Trace, Span, ISpan, ITracer } from '../contracts/observability-contracts';
import type { ILogger, IMeter } from '../contracts/observability-contracts';

export class DistributedTraceEngine implements ITracer {
  private spans: Span[] = [];
  private maxBuffer = 5000;
  private exportInterval: NodeJS.Timeout;
  private samplingRate = 1.0; // 100%

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private exporter: TraceExporter,
    samplingRate?: number,
  ) {
    if (samplingRate !== undefined) this.samplingRate = samplingRate;
    this.exportInterval = setInterval(() => this.flush(), 5000);
  }

  startSpan(name: string, attributes?: Record<string, string | number>): ISpan {
    if (Math.random() > this.samplingRate) {
      return new NoopSpan(); // unsampled
    }
    const span: Span = {
      spanId: uuidv4() as SpanId,
      traceId: this.getCurrentTraceId() ?? uuidv4() as TraceId,
      name,
      startTime: Date.now(),
      tags: attributes ?? {},
      events: [],
    };
    return new SpanHandle(span, (finishedSpan) => {
      this.spans.push(finishedSpan);
      this.meter.incrementCounter('trace.spans.created');
      if (this.spans.length >= this.maxBuffer) {
        this.flush().catch(err => this.logger.error('Trace flush failed', err));
      }
    });
  }

  private getCurrentTraceId(): TraceId | null {
    // In a real system, get from async context (AsyncLocalStorage)
    return null;
  }

  async flush(): Promise<void> {
    if (this.spans.length === 0) return;
    const batch = this.spans.splice(0);
    try {
      await this.exporter.export(batch);
      this.meter.incrementCounter('trace.spans.exported', batch.length);
    } catch (err) {
      this.logger.error('Failed to export traces', { count: batch.length, error: err });
      this.meter.incrementCounter('trace.spans.dropped', batch.length);
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.exportInterval);
    await this.flush();
  }
}

class SpanHandle implements ISpan {
  private finished = false;
  constructor(
    private span: Span,
    private onFinish: (span: Span) => void,
  ) {}
  setTag(key: string, value: string | number | boolean): void {
    this.span.tags[key] = value;
  }
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.span.endTime = Date.now();
    this.onFinish(this.span);
  }
}

class NoopSpan implements ISpan {
  setTag(): void {}
  finish(): void {}
}

export interface TraceExporter {
  export(spans: Span[]): Promise<void>;
}