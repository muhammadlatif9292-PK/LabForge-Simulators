// packages/observability-runtime/src/logging/distributed-log-runtime.ts
/**
 * Distributed Log Runtime
 * 
 * Responsibilities:
 * - Provide structured logging across all services with unified format
 * - Buffer logs locally and ship to centralized log store
 * - Support log levels, correlation IDs, and trace linking
 * - Handle log rotation and retention
 * 
 * Owned state:
 * - logBuffer: LogEntry[] (bounded)
 * - config: LogConfig
 * 
 * Dependencies:
 * - ILogger (self; carefully avoid recursion by using internal buffer)
 * - DistributedEventBus (for shipping logs)
 * - Possibly local file system for persistence
 * 
 * Event emissions: "logs.batch" to central log service
 * Event subscriptions: none (this IS the logger)
 * Synchronization: none; atomic buffer operations
 * Recovery: buffer flush on shutdown; optional local file backup
 * Telemetry: log volume per level, buffer overflow count
 * Diagnostics: buffer utilization
 * Accessibility: log format consistent for screen readers
 * Performance: async batch shipping; non-blocking log calls
 * Forbidden: synchronous I/O in log path; unbounded buffering
 */

import type { LogLevel, ILogger, CorrelationId } from '../contracts/observability-contracts';
import { v4 as uuidv4 } from 'uuid';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: number;
  traceId?: string;
  spanId?: string;
  serviceName: string;
}

export class DistributedLogRuntime implements ILogger {
  private buffer: LogEntry[] = [];
  private maxBuffer = 500;
  private flushInterval: NodeJS.Timeout;
  private serviceName: string;

  constructor(
    private eventBus: DistributedEventBus,
    serviceName?: string,
  ) {
    this.serviceName = serviceName ?? process.env.SERVICE_NAME ?? 'unknown';
    this.flushInterval = setInterval(() => this.flush(), 2000);
  }

  debug(message: string, meta?: Record<string, unknown>): void { this.log('debug', message, meta); }
  info(message: string, meta?: Record<string, unknown>): void { this.log('info', message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { this.log('warn', message, meta); }
  error(message: string, meta?: Record<string, unknown>): void { this.log('error', message, meta); }
  fatal(message: string, meta?: Record<string, unknown>): void { this.log('fatal', message, meta); }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: uuidv4(),
      level,
      message,
      meta,
      timestamp: Date.now(),
      serviceName: this.serviceName,
    };
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBuffer) {
      this.flush().catch(console.error);
    }
    // Also emit to console in development
    if (process.env.NODE_ENV === 'development') {
      const fn = console[level] ?? console.log;
      fn(`[${this.serviceName}] ${message}`, meta ?? '');
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    try {
      await this.eventBus.publish('logs.batch', { entries: batch });
    } catch (err) {
      // Log locally as last resort
      console.error('Failed to ship logs', err);
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}