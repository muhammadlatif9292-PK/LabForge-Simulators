// production-runtime/contracts/production-contracts.ts
/**
 * Production Runtime Contracts
 * 
 * Responsibilities:
 * - Define strict types for global monitoring, recovery, health, failover, and anomaly detection
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type ServiceName = string & { readonly __brand: 'ServiceName' };
export type RegionId = string & { readonly __brand: 'RegionId' };
export type FailoverGroupId = string & { readonly __brand: 'FailoverGroupId' };
export type IncidentId = string & { readonly __brand: 'IncidentId' };

export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline',
  STARTING = 'starting',
  STOPPING = 'stopping',
}

export enum IncidentSeverity {
  SEV5 = 'sev5', // informational
  SEV4 = 'sev4', // minor degradation
  SEV3 = 'sev3', // major degradation
  SEV2 = 'sev2', // partial outage
  SEV1 = 'sev1', // total outage
}

export interface ServiceHealth {
  serviceName: ServiceName;
  region: RegionId;
  status: ServiceStatus;
  uptimeSeconds: number;
  lastHeartbeat: number;
  metrics: ServiceMetrics;
  dependencies: Record<string, ServiceStatus>;
}

export interface ServiceMetrics {
  cpuPercent: number;
  memoryPercent: number;
  requestRate: number;
  errorRate: number;
  p99LatencyMs: number;
  activeConnections: number;
  queueDepth: number;
}

export interface GlobalHealth {
  overall: ServiceStatus;
  services: ServiceHealth[];
  regions: RegionHealth[];
  activeIncidents: Incident[];
  lastUpdated: number;
}

export interface RegionHealth {
  regionId: RegionId;
  status: ServiceStatus;
  serviceCount: number;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
}

export interface Incident {
  id: IncidentId;
  severity: IncidentSeverity;
  title: string;
  description: string;
  affectedServices: ServiceName[];
  affectedRegions: RegionId[];
  detectedAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  autoRecovered: boolean;
}

export interface FailoverPlan {
  groupId: FailoverGroupId;
  primaryRegion: RegionId;
  secondaryRegions: RegionId[];
  services: ServiceName[];
  failoverCriteria: FailoverCriteria;
  cooldownMs: number;
}

export interface FailoverCriteria {
  maxUnhealthyPercent: number;
  maxErrorRate: number;
  maxLatencyMs: number;
  minHealthyDurationMs: number;
}

export interface ProductionAnomaly {
  id: string;
  type: 'spike' | 'drift' | 'drop' | 'pattern' | 'resource';
  serviceName: ServiceName;
  metric: string;
  severity: IncidentSeverity;
  detectedAt: number;
  currentValue: number;
  expectedValue: number;
  deviationSigma: number;
  recommendation: string;
}

export interface RecoveryAction {
  id: string;
  type: 'restart' | 'scale_up' | 'scale_down' | 'failover' | 'rollback' | 'clear_cache' | 'reset_connection' | 'notify';
  targetService?: ServiceName;
  targetRegion?: RegionId;
  parameters: Record<string, unknown>;
  priority: number;
  cooldownMs: number;
  lastExecutedAt?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
}