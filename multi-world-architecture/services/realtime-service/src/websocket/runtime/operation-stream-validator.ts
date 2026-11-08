// services/realtime-service/src/websocket/runtime/operation-stream-validator.ts
/**
 * Operation Stream Validator
 * 
 * Responsibilities:
 * - Validate incoming WebSocket operations for schema compliance
 * - Check sequence numbers for ordering and gaps
 * - Reject duplicate operations (idempotency check)
 * - Enforce rate limits per user/session
 * 
 * Owned state:
 * - recentOperationIds: Set<OperationId> (LRU)
 * - sequenceTrackers: Map<SessionId, { lastSeq: number; gapCount: number }>
 * - rateLimiters: Map<SessionId, { window: number[] }>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * 
 * Event emissions: "ws.operation.invalid", "ws.operation.duplicate", "ws.operation.gap"
 * Event subscriptions: none
 * Synchronization: none (per-session tracking)
 * Recovery: state lost on restart; acceptable for validator
 * Telemetry: invalid count, duplicate rate, gap frequency
 * Diagnostics: per-session sequence health
 * Accessibility: N/A
 * Performance: O(1) checks with bounded sets; fast path for valid ops
 * Forbidden: blocking valid operations; false negatives causing drops
 */

import type { WsOperation, OperationId, SessionId } from '../contracts/websocket-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class OperationStreamValidator {
  private recentIds: Set<string> = new Set();
  private sequenceTrackers: Map<SessionId, { lastSeq: number; gaps: number }> = new Map();
  private rateLimitWindows: Map<SessionId, number[]> = new Map();
  private readonly MAX_RECENT = 50_000;
  private readonly MAX_OPS_PER_SECOND = 100;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  validate(operation: WsOperation): { valid: boolean; error?: string } {
    // Idempotency
    if (this.recentIds.has(operation.operationId)) {
      this.meter.incrementCounter('ws.operation.duplicate');
      return { valid: false, error: 'Duplicate operation' };
    }
    this.recentIds.add(operation.operationId);
    if (this.recentIds.size > this.MAX_RECENT) {
      const iter = this.recentIds.values();
      this.recentIds.delete(iter.next().value);
    }

    // Sequence ordering
    const tracker = this.sequenceTrackers.get(operation.sessionId);
    if (tracker) {
      if (operation.sequenceNumber <= tracker.lastSeq) {
        this.meter.incrementCounter('ws.operation.out_of_order');
        return { valid: false, error: `Sequence out of order: ${operation.sequenceNumber} <= ${tracker.lastSeq}` };
      }
      if (operation.sequenceNumber > tracker.lastSeq + 1) {
        tracker.gaps++;
        this.logger.warn(`Gap detected in operation stream for session ${operation.sessionId}: ${tracker.lastSeq} -> ${operation.sequenceNumber}`);
        this.meter.incrementCounter('ws.operation.gap');
        // Not invalid, just a gap (caused by offline or network)
      }
      tracker.lastSeq = operation.sequenceNumber;
    } else {
      this.sequenceTrackers.set(operation.sessionId, { lastSeq: operation.sequenceNumber, gaps: 0 });
    }

    // Rate limiting
    if (!this.checkRateLimit(operation.sessionId)) {
      this.meter.incrementCounter('ws.operation.rate_limited');
      return { valid: false, error: 'Rate limit exceeded' };
    }

    return { valid: true };
  }

  private checkRateLimit(sessionId: SessionId): boolean {
    const now = Date.now();
    let window = this.rateLimitWindows.get(sessionId);
    if (!window) {
      window = [];
      this.rateLimitWindows.set(sessionId, window);
    }
    // Remove entries older than 1 second
    const oneSecondAgo = now - 1000;
    const recent = window.filter(t => t > oneSecondAgo);
    recent.push(now);
    this.rateLimitWindows.set(sessionId, recent);
    return recent.length <= this.MAX_OPS_PER_SECOND;
  }
}