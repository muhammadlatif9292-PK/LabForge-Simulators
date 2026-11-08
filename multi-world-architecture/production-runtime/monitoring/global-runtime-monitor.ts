// production-runtime/monitoring/global-runtime-monitor.ts
/**
 * Global Runtime Monitor
 * 
 * Responsibilities:
 * - Poll all registered services across all regions for health metrics
 * - Aggregate service health into a unified global health dashboard
 * - Detect cross-service degradation patterns (cascading failures)
 * - Maintain a sliding window of health history for trend analysis
 * - Trigger alerts when services deviate from healthy baseline
 * 
 * Owned state:
 * - serviceHealth: Map<string, ServiceHealth> // key = region:serviceName
 * - healthHistory: Map<string, ServiceHealth[]> // sliding window per service
 * - lastPollTimestamp: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to receive heartbeats and emit alerts)
 * - ProductionAnomalyDetector (to analyse health trends)
 * - DistributedHealthRuntime (to serve health queries)
 * 
 * Event emissions:
 * - "monitor.service.status_changed"
 * - "monitor.global.health_updated"
 * - "monitor.service.timeout" (when service stops reporting)
 * 
 * Event subscriptions:
 * - "service.heartbeat" (from all services globally)
 * - "service.registered", "service.deregistered"
 * 
 * Synchronization: single monitor instance per region; uses distributed consensus for global view
 * Recovery: health state rebuilds from heartbeats on restart; history lost (acceptable)
 * Telemetry: service count, healthy fraction, monitoring latency
 * Diagnostics: per-service health timelines, dependency graphs
 * Accessibility: health dashboard must be screen-readable
 * Performance: heartbeat processing O(1); history bounded; async poll
 * Forbidden: flooding network with health checks; single point of failure for health
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ServiceName, RegionId, ServiceHealth, ServiceStatus,
  GlobalHealth, ServiceMetrics, RegionHealth,
} from '../contracts/production-contracts';
import { ServiceStatus as SS } from '../contracts/production-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ProductionAnomalyDetector } from '../detection/production-anomaly-detector';

export class GlobalRuntimeMonitor {
  private services: Map<string, ServiceHealth> = new Map(); // key: `${region}:${serviceName}`
  private history: Map<string, ServiceHealth[]> = new Map();
  private readonly maxHistoryPerService = 60; // 60 samples
  private readonly heartbeatTimeoutMs = 30_000;
  private lastPoll = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private anomalyDetector: ProductionAnomalyDetector,
    private localRegion: RegionId,
  ) {
    this.eventBus.subscribe('service.heartbeat', this.onHeartbeat.bind(this));
    this.eventBus.subscribe('service.registered', this.onServiceRegistered.bind(this));
    this.checkInterval = setInterval(() => this.checkTimeouts(), 10_000);
  }

  private onHeartbeat(event: any): void {
    const { serviceName, region, metrics, status } = event.payload;
    const key = this.makeKey(region, serviceName);
    const health: ServiceHealth = {
      serviceName,
      region,
      status: status ?? SS.HEALTHY,
      uptimeSeconds: event.payload.uptimeSeconds ?? 0,
      lastHeartbeat: Date.now(),
      metrics: metrics ?? this.emptyMetrics(),
      dependencies: event.payload.dependencies ?? {},
    };
    this.services.set(key, health);
    this.appendHistory(key, health);
    this.meter.setGauge('monitor.service.healthy', health.status === SS.HEALTHY ? 1 : 0, { service: serviceName, region });
    this.anomalyDetector.ingestMetric(serviceName, region, health.metrics);
  }

  private onServiceRegistered(event: any): void {
    const { serviceName, region } = event.payload;
    this.logger.info(`Service registered: ${serviceName} in ${region}`);
    this.meter.incrementCounter('monitor.service.registered');
  }

  private checkTimeouts(): void {
    const now = Date.now();
    for (const [key, health] of this.services) {
      if (now - health.lastHeartbeat > this.heartbeatTimeoutMs) {
        if (health.status !== SS.OFFLINE) {
          health.status = SS.OFFLINE;
          this.logger.warn(`Service timeout: ${health.serviceName} in ${health.region}`);
          this.meter.incrementCounter('monitor.service.timeout');
          this.eventBus.publish('monitor.service.status_changed', {
            serviceName: health.serviceName,
            region: health.region,
            oldStatus: SS.HEALTHY,
            newStatus: SS.OFFLINE,
          });
        }
      }
    }
    this.lastPoll = now;
  }

  getServiceHealth(serviceName: ServiceName, region?: RegionId): ServiceHealth | undefined {
    if (region) return this.services.get(this.makeKey(region, serviceName));
    for (const health of this.services.values()) {
      if (health.serviceName === serviceName) return health;
    }
    return undefined;
  }

  getGlobalHealth(): GlobalHealth {
    const allServices = Array.from(this.services.values());
    const regionsMap = new Map<RegionId, { services: ServiceHealth[] }>();
    for (const s of allServices) {
      if (!regionsMap.has(s.region)) {
        regionsMap.set(s.region, { services: [] });
      }
      regionsMap.get(s.region)!.services.push(s);
    }
    const regionHealths: RegionHealth[] = Array.from(regionsMap.entries()).map(([regionId, data]) => ({
      regionId,
      status: this.computeRegionStatus(data.services),
      serviceCount: data.services.length,
      healthyCount: data.services.filter(s => s.status === SS.HEALTHY).length,
      degradedCount: data.services.filter(s => s.status === SS.DEGRADED).length,
      unhealthyCount: data.services.filter(s => s.status === SS.UNHEALTHY || s.status === SS.OFFLINE).length,
    }));

    const overallStatus = regionHealths.every(r => r.status === SS.HEALTHY)
      ? SS.HEALTHY
      : regionHealths.some(r => r.status === SS.UNHEALTHY)
        ? SS.UNHEALTHY
        : SS.DEGRADED;

    return {
      overall: overallStatus,
      services: allServices,
      regions: regionHealths,
      activeIncidents: [],
      lastUpdated: Date.now(),
    };
  }

  getHistory(serviceName: ServiceName, region: RegionId): ServiceHealth[] {
    return this.history.get(this.makeKey(region, serviceName)) ?? [];
  }

  private computeRegionStatus(services: ServiceHealth[]): ServiceStatus {
    const unhealthyCount = services.filter(s => s.status === SS.UNHEALTHY || s.status === SS.OFFLINE).length;
    if (unhealthyCount > services.length * 0.5) return SS.UNHEALTHY;
    if (unhealthyCount > 0) return SS.DEGRADED;
    return SS.HEALTHY;
  }

  private appendHistory(key: string, health: ServiceHealth): void {
    let history = this.history.get(key);
    if (!history) {
      history = [];
      this.history.set(key, history);
    }
    history.push({ ...health });
    if (history.length > this.maxHistoryPerService) history.shift();
  }

  private makeKey(region: RegionId, serviceName: ServiceName): string {
    return `${region}:${serviceName}`;
  }

  private emptyMetrics(): ServiceMetrics {
    return { cpuPercent: 0, memoryPercent: 0, requestRate: 0, errorRate: 0, p99LatencyMs: 0, activeConnections: 0, queueDepth: 0 };
  }

  shutdown(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}