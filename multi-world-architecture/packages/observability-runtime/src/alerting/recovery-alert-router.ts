// packages/observability-runtime/src/alerting/recovery-alert-router.ts
/**
 * Recovery Alert Router
 * 
 * Responsibilities:
 * - Receive alerts from anomaly, performance, and crash systems
 * - Route to appropriate recovery handlers based on alert type and severity
 * - Trigger automated recovery actions where possible
 * - Escalate to human operators if auto-recovery fails or is not allowed
 * 
 * Owned state:
 * - recoveryHandlers: Map<AlertType, RecoveryHandler>
 * - escalationQueue: RecoveryAlert[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (consume and emit)
 * - Recovery systems (e.g., WorkerFailureRecovery, DatabaseCorruptionRecovery)
 * 
 * Event emissions: "recovery.action.triggered", "recovery.escalation"
 * Event subscriptions: "observability.anomaly.detected", "observability.performance.alert",
 *   "observability.crash.report.generated"
 * Synchronization: none; handlers may need locks internally
 * Recovery: if router fails, alerts may be replayed from event bus
 * Telemetry: recovery success rate, escalation rate
 * Diagnostics: active escalations, handler status
 * Accessibility: escalation messages include clear instructions
 * Performance: quick routing; handlers execute async
 * Forbidden: infinite recovery loops; triggering recovery without idempotency
 */

import type { RecoveryAlert, AnomalySignal, PerformanceAlert, CrashReport } from '../contracts/observability-contracts';
import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '../contracts/observability-contracts';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

type RecoveryHandler = (alert: RecoveryAlert) => Promise<void>;

export class RecoveryAlertRouter {
  private handlers: Map<string, RecoveryHandler> = new Map();

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Subscribe to all alert sources
    this.eventBus.subscribe('observability.anomaly.detected', this.onAnomaly.bind(this));
    this.eventBus.subscribe('observability.performance.alert', this.onPerformanceAlert.bind(this));
    this.eventBus.subscribe('observability.crash.report.generated', this.onCrashReport.bind(this));
  }

  registerHandler(alertType: string, handler: RecoveryHandler): void {
    this.handlers.set(alertType, handler);
  }

  private async routeAlert(alert: RecoveryAlert): Promise<void> {
    const handler = this.handlers.get(alert.alertType);
    if (handler) {
      this.logger.info(`Routing ${alert.alertType} alert to handler`);
      this.meter.incrementCounter('recovery.alert.routed');
      try {
        await handler(alert);
        this.meter.incrementCounter('recovery.alert.handled');
      } catch (err) {
        this.logger.error(`Recovery handler failed for ${alert.alertType}`, { error: err });
        await this.escalate(alert, (err as Error).message);
      }
    } else {
      await this.escalate(alert, 'No handler registered');
    }
  }

  private async escalate(alert: RecoveryAlert, reason: string): Promise<void> {
    this.logger.error(`Escalating alert: ${alert.message}. Reason: ${reason}`);
    this.meter.incrementCounter('recovery.alert.escalated');
    await this.eventBus.publish('recovery.escalation', { alert, reason });
  }

  private async onAnomaly(event: any): Promise<void> {
    const signal: AnomalySignal = event.payload;
    const alert: RecoveryAlert = {
      id: uuidv4(),
      alertType: 'degradation',
      severity: signal.severity,
      service: signal.source,
      message: `Anomaly detected: ${signal.type} on ${signal.source}`,
      timestamp: signal.timestamp,
      suggestedAction: 'Investigate metric anomaly and consider scaling or restarting service',
      autoRecoveryTriggered: false,
    };
    await this.routeAlert(alert);
  }

  private async onPerformanceAlert(event: any): Promise<void> {
    const perf: PerformanceAlert = event.payload;
    const alert: RecoveryAlert = {
      id: uuidv4(),
      alertType: 'resource',
      severity: event.payload.severity || 'high',
      service: event.payload.metric || 'unknown',
      message: `Performance threshold breached: ${perf.metric} = ${perf.currentValue}`,
      timestamp: perf.evaluatedAt,
      suggestedAction: 'Auto-scale or reduce load',
      autoRecoveryTriggered: true,
    };
    await this.routeAlert(alert);
  }

  private async onCrashReport(event: any): Promise<void> {
    const report: CrashReport = event.payload;
    const alert: RecoveryAlert = {
      id: uuidv4(),
      alertType: 'crash',
      severity: 'critical',
      service: report.serviceName,
      message: `Service crashed: ${report.errorMessage}`,
      timestamp: report.timestamp,
      suggestedAction: 'Restart service and restore from latest checkpoint',
      autoRecoveryTriggered: true,
    };
    await this.routeAlert(alert);
  }
}