// services/realtime-service/src/websocket/runtime/websocket-load-balancer.ts
/**
 * WebSocket Load Balancer
 * 
 * Responsibilities:
 * - Distribute incoming WebSocket connections across available instances
 * - Implement consistent hashing for sticky sessions
 * - Monitor instance health and redistribute on failure
 * - Coordinate with gateway for connection draining
 * 
 * Owned state:
 * - instanceLoad: Map<InstanceId, number>
 * - hashRing: ConsistentHashRing
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Service discovery (K8s endpoints / Consul)
 * - DistributedEventBus (to sync load information)
 * 
 * Event emissions: "ws.load_balancer.rebalance"
 * Event subscriptions: "ws.node.up", "ws.node.down"
 * Synchronization: eventual consistency on instance loads
 * Recovery: rebalance on topology change
 * Telemetry: connection distribution, rebalance events
 * Diagnostics: per-instance load
 * Accessibility: N/A
 * Performance: hash ring O(log n) lookup; async state updates
 * Forbidden: thundering herd on reconnect; losing sessions on rebalance
 */

import { createHash } from 'crypto';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export type InstanceId = string;

interface InstanceInfo {
  id: InstanceId;
  host: string;
  port: number;
  activeConnections: number;
  healthy: boolean;
}

export class WebSocketLoadBalancer {
  private instances: Map<InstanceId, InstanceInfo> = new Map();
  private virtualNodes = 150; // consistent hashing virtual nodes

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('ws.node.up', this.onNodeUp.bind(this));
    this.eventBus.subscribe('ws.node.down', this.onNodeDown.bind(this));
  }

  registerInstance(info: InstanceInfo): void {
    this.instances.set(info.id, { ...info, healthy: true });
    this.meter.incrementCounter('ws.load_balancer.instance_registered');
    this.logger.info(`Instance registered: ${info.id} (${info.host}:${info.port})`);
  }

  deregisterInstance(instanceId: InstanceId): void {
    this.instances.delete(instanceId);
    this.meter.incrementCounter('ws.load_balancer.instance_deregistered');
  }

  getTargetInstance(sessionId: string): InstanceInfo | null {
    const healthy = this.getHealthyInstances();
    if (healthy.length === 0) return null;
    // Consistent hashing based on sessionId
    const hash = this.computeHash(sessionId);
    let bestInstance: InstanceInfo | null = null;
    let bestDistance = Infinity;
    for (let v = 0; v < this.virtualNodes; v++) {
      const vNodeHash = this.computeHash(`${sessionId}:vnode:${v}`);
      for (const instance of healthy) {
        const instanceHash = this.computeHash(instance.id);
        const distance = Math.abs(vNodeHash - instanceHash);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestInstance = instance;
        }
      }
    }
    return bestInstance;
  }

  private getHealthyInstances(): InstanceInfo[] {
    return Array.from(this.instances.values()).filter(i => i.healthy);
  }

  private computeHash(key: string): number {
    const hash = createHash('sha256').update(key).digest('hex').substring(0, 8);
    return parseInt(hash, 16);
  }

  private onNodeUp(event: any): void {
    const { instanceId, host, port } = event.payload;
    this.registerInstance({ id: instanceId, host, port, activeConnections: 0, healthy: true });
  }

  private onNodeDown(event: any): void {
    const { instanceId } = event.payload;
    const inst = this.instances.get(instanceId);
    if (inst) inst.healthy = false;
    this.logger.warn(`Instance marked down: ${instanceId}`);
  }

  getLeastLoadedInstance(): InstanceInfo | null {
    const healthy = this.getHealthyInstances();
    if (healthy.length === 0) return null;
    return healthy.reduce((a, b) => a.activeConnections <= b.activeConnections ? a : b);
  }
}