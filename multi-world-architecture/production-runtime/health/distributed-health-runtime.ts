// production-runtime/health/distributed-health-runtime.ts
/**
 * Distributed Health Runtime
 * 
 * Responsibilities:
 * - Serve as the unified query interface for global system health
 * - Cache health data for fast dashboard rendering
 * - Compute Service Level Indicators (SLIs) and Service Level Objectives (SLOs)
 * - Provide health trend analysis for capacity planning
 * - Generate structured health reports for operators
 * 
 * Owned state:
 * - cachedHealth: GlobalHealth | null
 * - sloTracking: Map<ServiceName, SLOState>
 * - cacheTTL: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - GlobalRuntimeMonitor (raw health data)
 * - DistributedEventBus (to notify of health changes)
 * 
 * Event emissions:
 * - "health.slo.breached", "health.slo.recovered", "health.report.generated"
 * 
 * Event subscriptions:
 * - "monitor.global.health_updated" (refresh cache)
 * 
 * Synchronization: single health runtime per region; cross-region aggregation via monitor
 * Recovery: cache can be cold-rebuilt from monitor data
 * Telemetry: cache freshness, SLO compliance rate
 * Diagnostics: health report data
 * Accessibility: health reports must be screen-readable
 * Performance: in-memory cache; compute SLOs asynchronously
 * Forbidden: serving stale health data beyond TTL
 */

import type {
  GlobalHealth, ServiceName, ServiceStatus, RegionId,
} from '../contracts/production-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { GlobalRuntimeMonitor } from '../monitoring/global-runtime-monitor';

interface SLOState {
  serviceName: ServiceName;
  targetP99Ms: number;
  targetAvailability: number; // 0-1
  breachCount: number;
  lastBreachedAt?: number;
  inBreach: boolean;
}

export class DistributedHealthRuntime {
  private cachedHealth: GlobalHealth | null = null;
  private sloTracking: Map<ServiceName, SLOState> = new Map();
  private readonly cacheTTLMs = 5000;
  private lastCacheUpdate = 0;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private monitor: GlobalRuntimeMonitor,
    private localRegion: RegionId,
  ) {
    this.eventBus.subscribe('monitor.global.health_updated', this.onHealthUpdated.bind(this));
    this.registerDefaultSLOs();
  }

  private onHealthUpdated(event: any): void {
    this.cachedHealth = event.payload;
    this.lastCacheUpdate = Date.now();
    this.evaluateSLOs(this.cachedHealth);
  }

  getHealth(): GlobalHealth {
    if (!this.cachedHealth || Date.now() - this.lastCacheUpdate > this.cacheTTLMs) {
      this.cachedHealth = this.monitor.getGlobalHealth();
      this.lastCacheUpdate = Date.now();
    }
    return this.cachedHealth!;
  }

  getServiceHealth(serviceName: ServiceName, region?: RegionId): ServiceStatus {
    const health = this.monitor.getServiceHealth(serviceName, region);
    return health?.status ?? 'offline';
  }

  getSLODashboard(): SLOState[] {
    return Array.from(this.sloTracking.values());
  }

  registerSLO(state: SLOState): void {
    this.sloTracking.set(state.serviceName, state);
  }

  private registerDefaultSLOs(): void {
    this.registerSLO({
      serviceName: 'gateway-service' as ServiceName,
      targetP99Ms: 200,
      targetAvailability: 0.999,
      breachCount: 0,
      inBreach: false,
    });
    this.registerSLO({
      serviceName: 'realtime-service' as ServiceName,
      targetP99Ms: 50,
      targetAvailability: 0.9995,
      breachCount: 0,
      inBreach: false,
    });
    this.registerSLO({
      serviceName: 'AI-service' as ServiceName,
      targetP99Ms: 5000,
      targetAvailability: 0.99,
      breachCount: 0,
      inBreach: false,
    });
  }

  private evaluateSLOs(health: GlobalHealth): void {
    for (const serviceHealth of health.services) {
      const slo = this.sloTracking.get(serviceHealth.serviceName);
      if (!slo) continue;
      const p99Exceeded = serviceHealth.metrics.p99LatencyMs > slo.targetP99Ms;
      const availabilityLow = serviceHealth.status !== 'healthy';
      const inBreachNow = p99Exceeded || availabilityLow;
      if (inBreachNow && !slo.inBreach) {
        slo.inBreach = true;
        slo.breachCount++;
        slo.lastBreachedAt = Date.now();
        this.eventBus.publish('health.slo.breached', {
          serviceName: serviceHealth.serviceName,
          p99Ms: serviceHealth.metrics.p99LatencyMs,
          targetP99Ms: slo.targetP99Ms,
        });
        this.meter.incrementCounter('health.slo.breached');
      } else if (!inBreachNow && slo.inBreach) {
        slo.inBreach = false;
        this.eventBus.publish('health.slo.recovered', { serviceName: serviceHealth.serviceName });
        this.meter.incrementCounter('health.slo.recovered');
      }
    }
  }

  generateReport(): { health: GlobalHealth; slos: SLOState[]; generatedAt: number } {
    const report = {
      health: this.getHealth(),
      slos: this.getSLODashboard(),
      generatedAt: Date.now(),
    };
    this.eventBus.publish('health.report.generated', report);
    return report;
  }
}