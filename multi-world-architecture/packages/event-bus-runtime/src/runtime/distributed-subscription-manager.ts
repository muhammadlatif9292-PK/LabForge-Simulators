// packages/event-bus-runtime/src/runtime/distributed-subscription-manager.ts
/**
 * Distributed Subscription Manager
 * 
 * Responsibilities:
 * - Maintain a consistent view of subscriptions across all service instances
 * - Notify peers of subscription changes via distributed event bus
 * - Handle node join/leave, rebalancing subscriptions
 * - Deduplicate handlers across nodes (only one instance processes an event if needed)
 * 
 * Owned state:
 * - localSubscriptions: Map<SubscriptionId, Subscription> (mirror)
 * - peerSubscriptions: Map<string, Subscription[]> (by nodeId)
 * 
 * Dependencies: DistributedEventBus, ILogger, maybe a distributed store (etcd/Redis)
 * 
 * Event emissions: "subscription.added", "subscription.removed" (cluster-wide)
 * Event subscriptions: listens to those same events to sync
 * Synchronization: uses distributed state manager; eventual consistency
 * Recovery: rebuilds state from peers on restart
 * Telemetry: subscription count gauge per node
 * Diagnostics: current subscription map exposed
 * Accessibility: N/A
 * Performance: subscription changes are rare; no hot path overhead
 * Forbidden: direct mutation of other node's state
 */

import type { Subscription, SubscriptionId, EventBus } from '../contracts/event-bus-contracts';
import type { ILogger } from '@labforge/observability-runtime';

export class DistributedSubscriptionManager {
  private localNodeId: string;
  private subscriptions: Map<SubscriptionId, Subscription> = new Map();

  constructor(
    private bus: EventBus,
    private logger: ILogger,
    nodeId?: string,
  ) {
    this.localNodeId = nodeId ?? process.env.HOSTNAME ?? 'unknown';
    // Listen to cluster-wide subscription events
    this.bus.subscribe('system.subscription.added', this.onSubscriptionAdded.bind(this));
    this.bus.subscribe('system.subscription.removed', this.onSubscriptionRemoved.bind(this));
  }

  async addSubscription(sub: Subscription): Promise<void> {
    this.subscriptions.set(sub.id, sub);
    await this.bus.publish('system.subscription.added', { nodeId: this.localNodeId, subscription: sub });
  }

  async removeSubscription(subscriptionId: SubscriptionId): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    await this.bus.publish('system.subscription.removed', { nodeId: this.localNodeId, subscriptionId });
  }

  private onSubscriptionAdded(event: Event<{ nodeId: string; subscription: Subscription }>): void {
    // In production, this would update a shared registry; for now log
    this.logger.info('Peer subscription added', { nodeId: event.payload.nodeId, type: event.payload.subscription.type });
  }

  private onSubscriptionRemoved(event: Event<{ nodeId: string; subscriptionId: SubscriptionId }>): void {
    this.logger.info('Peer subscription removed', { nodeId: event.payload.nodeId, id: event.payload.subscriptionId });
  }

  getLocalSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }
}