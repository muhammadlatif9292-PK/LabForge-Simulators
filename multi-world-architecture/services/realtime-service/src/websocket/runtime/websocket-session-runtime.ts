// services/realtime-service/src/websocket/runtime/websocket-session-runtime.ts
/**
 * WebSocket Session Runtime
 * 
 * Responsibilities:
 * - Manage lifecycle of WebSocket connections and associated sessions
 * - Handle authentication and session binding
 * - Track connection health, heartbeats, and timeouts
 * - Coordinate with presence system on connect/disconnect
 * - Support multiple connections per session (tab/window resilience)
 * 
 * Owned state:
 * - sessions: Map<SessionId, WsSession>
 * - connections: Map<ConnectionId, SessionId>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (for session events)
 * - DistributedPresenceEngine
 * - DistributedAuthValidator (token validation)
 * 
 * Event emissions:
 * - "ws.session.created", "ws.session.resumed", "ws.session.expired"
 * - "ws.connection.opened", "ws.connection.closed"
 * 
 * Event subscriptions: none
 * Synchronization: distributed session store for cross-node lookups
 * Recovery: sessions persisted in Redis; can resume after reconnect
 * Telemetry: active connections gauge, session duration histogram
 * Diagnostics: session list, connection counts
 * Accessibility: N/A
 * Performance: O(1) session lookup; heartbeat interval configurable
 * Forbidden: leaking session data across users; unbounded session TTL
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  SessionId, ConnectionId, UserId, WsSession, ReconnectToken,
} from '../contracts/websocket-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class WebSocketSessionRuntime {
  private sessions: Map<SessionId, WsSession> = new Map();
  private connections: Map<ConnectionId, SessionId> = new Map();
  private reconnectTokens: Map<string, ReconnectToken> = new Map();
  private readonly sessionTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly idleTimeout = 30 * 60 * 1000; // 30 minutes
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private redisClient: any, // distributed session store
  ) {
    this.heartbeatInterval = setInterval(() => this.checkTimeouts(), 30000);
  }

  async createSession(userId: UserId, metadata?: Record<string, unknown>): Promise<WsSession> {
    const sessionId = uuidv4() as SessionId;
    const session: WsSession = {
      sessionId,
      userId,
      connectionIds: new Set(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: metadata ?? {},
      status: 'active',
    };
    this.sessions.set(sessionId, session);
    await this.persistSession(session);
    this.meter.incrementCounter('ws.session.created');
    await this.eventBus.publish('ws.session.created', { sessionId, userId });
    this.logger.info(`Session created: ${sessionId} for user ${userId}`);
    return session;
  }

  async addConnection(sessionId: SessionId, connectionId: ConnectionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    session.connectionIds.add(connectionId);
    session.lastActivity = Date.now();
    session.status = 'active';
    this.connections.set(connectionId, sessionId);
    this.meter.incrementCounter('ws.connection.opened');
  }

  async removeConnection(connectionId: ConnectionId): Promise<void> {
    const sessionId = this.connections.get(connectionId);
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (session) {
      session.connectionIds.delete(connectionId);
      if (session.connectionIds.size === 0) {
        session.status = 'disconnected';
      }
    }
    this.connections.delete(connectionId);
    this.meter.incrementCounter('ws.connection.closed');
  }

  async getSession(sessionId: SessionId): Promise<WsSession | null> {
    // Try local first, then Redis
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.loadSessionFromRedis(sessionId);
      if (session) this.sessions.set(sessionId, session);
    }
    return session ?? null;
  }

  async generateReconnectToken(sessionId: SessionId): Promise<ReconnectToken> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    const token = uuidv4();
    const rt: ReconnectToken = {
      token,
      sessionId,
      userId: session.userId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
    this.reconnectTokens.set(token, rt);
    return rt;
  }

  async resumeSession(reconnectToken: string): Promise<WsSession | null> {
    const rt = this.reconnectTokens.get(reconnectToken);
    if (!rt || Date.now() > rt.expiresAt) return null;
    this.reconnectTokens.delete(reconnectToken);
    const session = await this.getSession(rt.sessionId);
    if (session && session.userId === rt.userId) {
      session.status = 'active';
      session.lastActivity = Date.now();
      await this.eventBus.publish('ws.session.resumed', { sessionId: session.sessionId });
      this.meter.incrementCounter('ws.session.resumed');
      return session;
    }
    return null;
  }

  async terminateSession(sessionId: SessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'disconnected';
    this.sessions.delete(sessionId);
    await this.removeSessionFromRedis(sessionId);
    this.logger.info(`Session terminated: ${sessionId}`);
    this.meter.incrementCounter('ws.session.terminated');
  }

  private checkTimeouts(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > this.sessionTTL) {
        this.terminateSession(id).catch(err => this.logger.error('Failed to expire session', err));
        this.eventBus.publish('ws.session.expired', { sessionId: id });
      } else if (session.status === 'disconnected' && (now - session.lastActivity) > this.idleTimeout) {
        this.terminateSession(id).catch(err => this.logger.error('Failed to expire idle session', err));
      }
    }
  }

  private async persistSession(session: WsSession): Promise<void> {
    await this.redisClient.set(`session:${session.sessionId}`, JSON.stringify(session), 'PX', this.sessionTTL);
  }

  private async loadSessionFromRedis(sessionId: SessionId): Promise<WsSession | null> {
    const raw = await this.redisClient.get(`session:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  }

  private async removeSessionFromRedis(sessionId: SessionId): Promise<void> {
    await this.redisClient.del(`session:${sessionId}`);
  }

  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  async shutdown(): Promise<void> {
    clearInterval(this.heartbeatInterval);
  }
}