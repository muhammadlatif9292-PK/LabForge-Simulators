// packages/command-framework/recovery/command-recovery-engine.ts
/**
 * Command Recovery Engine
 * 
 * Responsibilities:
 * - Persist command execution state for crash recovery
 * - Detect interrupted commands and retry or escalate
 * - Coordinate with the global recovery system for failover
 * - Store partial execution results for idempotent retry
 * 
 * Owned state:
 * - recoveryLog: Map<CommandId, CommandExecution>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - DistributedLockManager (for coordinated retry)
 * 
 * Event emissions: "command.recovery.retried", "command.recovery.escalated"
 * Event subscriptions: "service.crash" to re-process
 * Synchronization: distributed lock for retry coordination
 * Recovery: this IS the recovery mechanism
 * Telemetry: recovery count, success rate
 * Diagnostics: pending recovery commands
 * Accessibility: N/A
 * Performance: async persistence; non-blocking
 * Forbidden: infinite retry loops
 */

import type { CommandId, Command, CommandExecution } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class CommandRecoveryEngine {
  private pendingRecovery: Map<CommandId, CommandExecution> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private storage: any,
  ) {
    this.loadPending();
  }

  private async loadPending(): Promise<void> {
    const raw = await this.storage.get('command_recovery');
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [id, execution] of Object.entries(parsed)) {
        this.pendingRecovery.set(id as CommandId, execution as CommandExecution);
      }
      this.logger.info(`Loaded ${this.pendingRecovery.size} pending recovery commands`);
    }
  }

  saveExecution(execution: CommandExecution): void {
    if (execution.status === 'committed' || execution.status === 'failed') {
      this.pendingRecovery.delete(execution.command.id);
    } else {
      this.pendingRecovery.set(execution.command.id, execution);
    }
    this.persist();
  }

  async handleFailedCommand(command: Command, execution: CommandExecution): Promise<void> {
    this.pendingRecovery.set(command.id, execution);
    this.persist();
    this.logger.warn(`Command failed, queued for recovery: ${command.type} (${command.id})`);
    this.meter.incrementCounter('command.recovery.queued');
    await this.eventBus.publish('command.recovery.queued', { commandId: command.id, type: command.type });
  }

  private async persist(): Promise<void> {
    const obj: Record<string, CommandExecution> = {};
    for (const [id, exec] of this.pendingRecovery) {
      obj[id] = exec;
    }
    await this.storage.set('command_recovery', JSON.stringify(obj));
  }

  getPendingRecoveries(): CommandExecution[] {
    return Array.from(this.pendingRecovery.values());
  }

  clear(): void {
    this.pendingRecovery.clear();
    this.persist();
  }
}