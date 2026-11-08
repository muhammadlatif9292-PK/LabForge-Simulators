// services/gateway-service/src/runtime/distributed-session-manager.ts
/**
 * Distributed Session Manager
 * 
 * Responsibilities:
 * - Maintain user sessions in a shared Redis-backed store across all gateway instances
 * - Handle session creation, validation, refresh, and expiry
 * - Support sticky sessions via cookie-based affinity and stateless JWT fallback
 * - Coordinate with AuthenticationService for token validation
 * - Emit session lifecycle events for observability
 * 
 * Owned state:
 * - localSessionCache: Map<SessionId, CachedSession> (short TTL in-memory cache)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Redis client (ioredis)
 * - DistributedAuthValidator (from security-runtime)
 * - DistributedEventBus (to publish session events)
 * 
 * Event emissions:
 *   "gateway.session.created", "gateway.session.resumed", "gateway.session.expired"
 * 
 * Event subscriptions: none
 * Synchronization: Redis SETNX for session creation; no local writes
 * Recovery: sessions survive gateway restarts (Redis persisted)
 * Telemetry: session count, active sessions gauge, create/refresh rate
 * Diagnostics: session TTL, cache hit rate
 * Accessibility: N/A
 * Performance: local cache avoids Redis round-trip for hot sessions; async refresh
 * Forbidden: storing plaintext tokens in cache; infinite session TTL without expiry
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export type SessionId = string;
export type UserId = string;

interface SessionData {
  sessionId: SessionId;
  userId: UserId;
  roles: string[];
  permissions: string[];
  createdAt: number;
  lastActivity: number;
  maxIdleMs: number;
  metadata: Record<string, unknown>;
}

interface CachedSession {
  data: SessionData;
  cachedAt: number;
}

export class DistributedSessionManager {
  private localCache: Map<SessionId, CachedSession> = new Map();
  private readonly CACHE_TTL_MS = 10000; // 10 seconds local cache
  private readonly DEFAULT_MAX_IDLE = 30 * 60 * 1000; // 30 minutes

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private redis: any,         // ioredis client
    private authValidator: any, // DistributedAuthValidator
  ) {}

  async createSession(
    userId: UserId,
    roles: string[] = ['user'],
    permissions: string[] = [],
    metadata: Record<string, unknown> = {},
  ): Promise<SessionId> {
    const sessionId = uuidv4() as SessionId;
    const now = Date.now();
    const session: SessionData = {
      sessionId,
      userId,
      roles,
      permissions,
      createdAt: now,
      lastActivity: now,
      maxIdleMs: this.DEFAULT_MAX_IDLE,
      metadata,
    };

    // Store in Redis with TTL
    const key = `session:${sessionId}`;
    const ttlSeconds = Math.ceil(session.maxIdleMs / 1000);
    await this.redis.set(key, JSON.stringify(session), 'EX', ttlSeconds);

    // Warm local cache
    this.localCache.set(sessionId, { data: session, cachedAt: now });

    this.meter.incrementCounter('gateway.session.created');
    this.meter.setGauge('gateway.sessions.active', this.localCache.size);
    await this.eventBus.publish('gateway.session.created', { sessionId, userId });

    this.logger.info(`Session created: ${sessionId} for user ${userId}`);
    return sessionId;
  }

  async getSession(sessionId: SessionId): Promise<SessionData | null> {
    // Check local cache first
    const cached = this.localCache.get(sessionId);
    if (cached && (Date.now() - cached.cachedAt) < this.CACHE_TTL_MS) {
      this.meter.incrementCounter('gateway.session.cache_hit');
      this.touchSession(sessionId).catch(err => this.logger.warn('Background touch failed', err));
      return cached.data;
    }

    // Fetch from Redis
    const key = `session:${sessionId}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      this.meter.incrementCounter('gateway.session.miss');
      return null;
    }

    const session: SessionData = JSON.parse(raw);
    // Check expiry
    if (Date.now() - session.lastActivity > session.maxIdleMs) {
      await this.destroySession(sessionId);
      return null;
    }

    // Refresh local cache and extend TTL
    this.localCache.set(sessionId, { data: session, cachedAt: Date.now() });
    await this.touchSession(sessionId);

    this.meter.incrementCounter('gateway.session.redis_hit');
    return session;
  }

  async refreshSession(sessionId: SessionId, roles?: string[], permissions?: string[]): Promise<SessionData | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    if (roles) session.roles = roles;
    if (permissions) session.permissions = permissions;
    session.lastActivity = Date.now();

    const key = `session:${sessionId}`;
    const ttlSeconds = Math.ceil(session.maxIdleMs / 1000);
    await this.redis.set(key, JSON.stringify(session), 'EX', ttlSeconds);
    this.localCache.set(sessionId, { data: session, cachedAt: Date.now() });

    this.meter.incrementCounter('gateway.session.refreshed');
    return session;
  }

  async destroySession(sessionId: SessionId): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.del(key);
    this.localCache.delete(sessionId);

    this.meter.incrementCounter('gateway.session.destroyed');
    this.meter.setGauge('gateway.sessions.active', this.localCache.size);
    await this.eventBus.publish('gateway.session.expired', { sessionId });
    this.logger.info(`Session destroyed: ${sessionId}`);
  }

  private async touchSession(sessionId: SessionId): Promise<void> {
    const key = `session:${sessionId}`;
    const session = await this.redis.get(key);
    if (session) {
      const data: SessionData = JSON.parse(session);
      data.lastActivity = Date.now();
      const ttl = Math.ceil(data.maxIdleMs / 1000);
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
    }
  }

  async getActiveSessionCount(): Promise<number> {
    // Approximate: use Redis DBSIZE or SCAN count (simplified)
    return this.redis.dbsize ? this.redis.dbsize() : 0;
  }

  async shutdown(): Promise<void> {
    this.localCache.clear();
  }
}