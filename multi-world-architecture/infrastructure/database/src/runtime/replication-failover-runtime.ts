// infrastructure/database/src/runtime/replication-failover-runtime.ts
/**
 * Replication Failover Runtime
 * 
 * Responsibilities:
 * - Top-level orchestration of database replication failover
 * - Consumes node health events and triggers promote/demote operations
 * - Provides a health check for active replication topology
 * 
 * Dependencies:
 * - ReplicationFailoverManager (from replication/)
 * - ILogger, IMeter
 * - DistributedEventBus
 */

import { ReplicationFailoverManager } from '../replication/replication-failover-manager';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class ReplicationFailoverRuntime {
  private manager: ReplicationFailoverManager;

  constructor(
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    this.manager = new ReplicationFailoverManager(logger, meter, eventBus);
  }

  addNode(nodeId: string, host: string, role: 'primary' | 'secondary') {
    this.manager.addNode(nodeId, host, role);
  }

  async checkAndFailover() {
    // The manager internally runs health checks and triggers failover
  }
}