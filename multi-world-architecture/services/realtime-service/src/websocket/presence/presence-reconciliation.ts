// services/realtime-service/src/websocket/presence/presence-reconciliation.ts
/**
 * Presence Reconciliation
 * 
 * Responsibilities:
 * - Resolve conflicting presence states across distributed nodes
 * - Determine canonical presence using last-writer-wins with timestamps
 * - Detect and remove stale presence entries (ghost users)
 * - Merge partial presence updates into consistent view
 * 
 * Owned state:
 * - localPresence: Map<UserId, PresenceInfo>
 * - pendingUpdates: Map<UserId, PresenceInfo> (unacknowledged)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to broadcast presence changes)
 * - DistributedPresenceEngine (for authoritative reads)
 * 
 * Event emissions: "presence.reconciled" after conflict resolution
 * Event subscriptions: "presence.update" from all nodes
 * Synchronization: eventual consistency; CRDT-like merge for presence
 * Recovery: re-fetch full state from distributed store after partition
 * Telemetry: reconciliation count, conflict rate
 * Diagnostics: presence inconsistency logs
 * Accessibility: N/A
 * Performance: O(1) per update; batch reconciliation
 * Forbidden: losing updates; violating monotonicity
 */

import type { PresenceInfo, UserId } from '../contracts/websocket-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class PresenceReconciliation {
  private localPresence: Map<UserId, PresenceInfo> = new Map();

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('presence.update', this.onPresenceUpdate.bind(this));
  }

  applyLocalUpdate(info: PresenceInfo): void {
    const existing = this.localPresence.get(info.userId);
    if (!existing || info.lastSeen >= existing.lastSeen) {
      this.localPresence.set(info.userId, info);
      this.eventBus.publish('presence.change', info);
    }
  }

  private onPresenceUpdate(event: any): void {
    const incoming: PresenceInfo = event.payload;
    const existing = this.localPresence.get(incoming.userId);
    // Last-writer-wins reconciliation
    if (!existing || incoming.lastSeen > existing.lastSeen) {
      this.localPresence.set(incoming.userId, incoming);
    } else if (incoming.lastSeen === existing.lastSeen) {
      // Tie-break by status priority: online > away > offline
      const priority = { online: 3, away: 2, offline: 1 };
      if ((priority[incoming.status] ?? 0) > (priority[existing.status] ?? 0)) {
        this.localPresence.set(incoming.userId, incoming);
      }
    }
    this.meter.incrementCounter('presence.reconciled');
  }

  getPresence(userId: UserId): PresenceInfo | undefined {
    return this.localPresence.get(userId);
  }

  getAllPresence(): PresenceInfo[] {
    return Array.from(this.localPresence.values());
  }

  removeStaleEntries(maxAgeMs: number = 300000): void {
    const now = Date.now();
    for (const [userId, info] of this.localPresence) {
      if (now - info.lastSeen > maxAgeMs) {
        this.localPresence.delete(userId);
        this.logger.debug(`Stale presence removed: ${userId}`);
      }
    }
  }
}