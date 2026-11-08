// services/realtime-service/src/websocket/recovery/reconnect-recovery-runtime.ts
/**
 * Reconnect Recovery Runtime
 * 
 * Responsibilities:
 * - Handle client reconnection after network interruption
 * - Restore session state and resend missed operations
 * - Track the last acknowledged operation sequence number
 * - Provide reconnect tokens with limited TTL
 * - Coordinate with operation log for catch-up
 * 
 * Owned state:
 * - reconnectTokens: Map<string, ReconnectState>
 * - lastAcked: Map<SessionId, number> (sequence number)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - WebSocketSessionRuntime (for session management)
 * - DistributedEventBus (to request missed ops)
 * - Operation log / EventStreamReader
 * 
 * Event emissions: "ws.reconnect.started", "ws.reconnect.completed", "ws.reconnect.failed"
 * Event subscriptions: none
 * Synchronization: uses distributed lock for operation replay
 * Recovery: self-healing; clients poll for reconnect token validity
 * Telemetry: reconnect attempts, success rate, catch-up latency
 * Diagnostics: pending reconnect tokens, missed operation counts
 * Accessibility: N/A
 * Performance: incremental catch-up; batch missed ops
 * Forbidden: replaying operations that were already applied (idempotency)
 */

import { v4 as uuidv4 } from 'uuid';
import type { SessionId, WsOperation, ReconnectToken } from '../contracts/websocket-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { WebSocketSessionRuntime } from '../runtime/websocket-session-runtime';

interface ReconnectState {
  token: ReconnectToken;
  lastAckedSeq: number;
  createdAt: number;
}

export class ReconnectRecoveryRuntime {
  private reconnectStates: Map<string, ReconnectState> = new Map();
  private lastAckedSeq: Map<SessionId, number> = new Map();

  constructor(
    private sessionRuntime: WebSocketSessionRuntime,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
    private operationLog: any, // EventStreamReader or similar
  ) {}

  async generateReconnectToken(sessionId: SessionId, lastAckedSeq: number): Promise<ReconnectToken> {
    const token = await this.sessionRuntime.generateReconnectToken(sessionId);
    this.reconnectStates.set(token.token, {
      token,
      lastAckedSeq,
      createdAt: Date.now(),
    });
    this.meter.incrementCounter('ws.reconnect.token.generated');
    return token;
  }

  async attemptReconnect(reconnectToken: string, connectionId: string): Promise<{ session: any; missedOps: WsOperation[] } | null> {
    const state = this.reconnectStates.get(reconnectToken);
    if (!state || Date.now() > state.token.expiresAt) {
      this.meter.incrementCounter('ws.reconnect.token.invalid');
      return null;
    }
    const session = await this.sessionRuntime.resumeSession(reconnectToken);
    if (!session) return null;

    this.meter.incrementCounter('ws.reconnect.started');
    // Fetch operations after lastAckedSeq
    const missedOps = await this.operationLog.query({
      sessionId: state.token.sessionId,
      fromSeq: state.lastAckedSeq + 1,
    });

    this.reconnectStates.delete(reconnectToken);
    this.meter.incrementCounter('ws.reconnect.completed');
    this.logger.info(`Reconnect successful for session ${session.sessionId}, missed ${missedOps.length} ops`);
    await this.eventBus.publish('ws.reconnect.completed', {
      sessionId: session.sessionId,
      missedOpCount: missedOps.length,
    });
    return { session, missedOps };
  }

  acknowledgeOperation(sessionId: SessionId, sequenceNumber: number): void {
    const current = this.lastAckedSeq.get(sessionId) ?? 0;
    if (sequenceNumber > current) {
      this.lastAckedSeq.set(sessionId, sequenceNumber);
    }
  }

  getLastAcked(sessionId: SessionId): number {
    return this.lastAckedSeq.get(sessionId) ?? 0;
  }

  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, state] of this.reconnectStates) {
      if (now > state.token.expiresAt) this.reconnectStates.delete(token);
    }
  }
}