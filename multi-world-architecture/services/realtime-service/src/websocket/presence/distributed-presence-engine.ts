// services/realtime-service/src/websocket/presence/distributed-presence-engine.ts
/**
 * Distributed Presence Engine
 * 
 * Responsibilities:
 * - Maintain a cluster-wide presence map of all connected users
 * - Use Redis pub/sub for cross-node presence updates
 * - Detect user join/leave events and publish to event bus
 * - Support querying presence by user, world, or activity
 * 
 * Owned state:
 * - localPresence: Map<UserId, PresenceInfo> (subset)
 * - sharedPresence: Distributed cache proxy
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Redis client (for pub/sub and shared hash)
 * - PresenceReconciliation (for conflict resolution)
 * 
 * Event emissions: "presence.user.online", "presence.user.offline", "presence.user.status_change"
 * Event subscriptions: consumes "presence.heartbeat" and "presence.update"
 * Synchronization: CRDT-style last-writer-wins via Redis
 * Recovery: rebuild presence from active connections on startup
 * Telemetry: online user count, churn rate
 * Diagnostics: presence map dump for debugging
 * Accessibility: N/A
 * Performance: O(1) per update; batch sync intervals
 * Forbidden: single point of failure; inconsistent presence across nodes
 */

import type { PresenceInfo, UserId } from '../contracts/websocket-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class DistributedPresenceEngine {
  private localPresence: Map<UserId, PresenceInfo> = new Map();

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
    private redisClient: any, // Redis with pub/sub
  ) {
    // Subscribe to presence channel
    this.redisClient.subscribe('presence:channel', (message: any) => {
      this.handleRemoteUpdate(JSON.parse(message));
    });
  }

  async setPresence(info: PresenceInfo): Promise<void> {
    // Update local
    const previous = this.localPresence.get(info.userId);
    this.localPresence.set(info.userId, info);

    // Publish to Redis for other nodes
    const payload = JSON.stringify(info);
    await this.redisClient.publish('presence:channel', payload);

    // Also store in Redis hash for persistence
    await this.redisClient.hset('presence:all', info.userId, payload);

    // Emit event
    if (!previous || previous.status === 'offline') {
      await this.eventBus.publish('presence.user.online', { userId: info.userId, info });
      this.meter.incrementCounter('presence.user.online');
    } else if (info.status !== previous.status) {
      await this.eventBus.publish('presence.user.status_change', { userId: info.userId, oldStatus: previous.status, newStatus: info.status });
    }
  }

  async removePresence(userId: UserId): Promise<void> {
    this.localPresence.delete(userId);
    await this.redisClient.hdel('presence:all', userId);
    const offlineInfo: PresenceInfo = {
      userId,
      sessionId: '' as any,
      status: 'offline',
      lastSeen: Date.now(),
    };
    await this.redisClient.publish('presence:channel', JSON.stringify(offlineInfo));
    await this.eventBus.publish('presence.user.offline', { userId, timestamp: Date.now() });
    this.meter.incrementCounter('presence.user.offline');
  }

  async getPresence(userId: UserId): Promise<PresenceInfo | null> {
    const local = this.localPresence.get(userId);
    if (local) return local;
    // Fetch from Redis
    const raw = await this.redisClient.hget('presence:all', userId);
    return raw ? JSON.parse(raw) : null;
  }

  async getAllOnlineUsers(): Promise<PresenceInfo[]> {
    const all = await this.redisClient.hgetall('presence:all');
    return all ? Object.values(all).map((r: string) => JSON.parse(r)) : [];
  }

  private handleRemoteUpdate(info: PresenceInfo): void {
    const existing = this.localPresence.get(info.userId);
    // Simple last-writer-wins; reconciliation handles conflicts
    if (!existing || info.lastSeen >= existing.lastSeen) {
      this.localPresence.set(info.userId, info);
    }
  }

  async getPresenceByWorld(worldId: string): Promise<PresenceInfo[]> {
    const all = await this.getAllOnlineUsers();
    return all.filter(p => p.currentWorldId === worldId);
  }

  async heartbeat(userId: UserId, sessionId: string): Promise<void> {
    const existing = await this.getPresence(userId);
    if (existing) {
      existing.lastSeen = Date.now();
      existing.status = 'online';
      existing.sessionId = sessionId as any;
      await this.setPresence(existing);
    }
  }
}