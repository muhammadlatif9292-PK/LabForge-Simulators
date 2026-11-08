// packages/command-framework/history/command-history-engine.ts
/**
 * Command History Engine
 * 
 * Responsibilities:
 * - Store a complete and immutable log of all executed commands
 * - Provide querying by user, session, type, time range
 * - Support pagination for large histories
 * - Persist history for offline replay and audit
 * 
 * Owned state:
 * - historyLog: CommandHistoryEntry[] (bounded ring buffer)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Local persistence (IndexedDB for frontend)
 * 
 * Event emissions: "command.history.recorded"
 * Event subscriptions: none
 * Synchronization: append-only; no concurrent modification
 * Recovery: history restored from persistent store on restart
 * Telemetry: history size, query latency
 * Diagnostics: recent history entries
 * Accessibility: N/A
 * Performance: bounded log; paginated queries
 * Forbidden: modifying history entries; unbounded growth
 */

import type { CommandHistoryEntry, CommandExecution, CommandId } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class CommandHistoryEngine {
  private log: CommandHistoryEntry[] = [];
  private readonly maxLogSize = 10_000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // persistence adapter
  ) {
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    const raw = await this.storage.get('command_history');
    if (raw) {
      this.log = JSON.parse(raw).slice(-this.maxLogSize);
      this.logger.info(`Command history loaded: ${this.log.length} entries`);
    }
  }

  recordExecution(execution: CommandExecution): void {
    const entry: CommandHistoryEntry = {
      execution,
      timestamp: Date.now(),
      undoable: execution.status === 'committed',
    };
    this.log.push(entry);
    if (this.log.length > this.maxLogSize) {
      this.log = this.log.slice(-this.maxLogSize);
    }
    this.persist();
    this.meter.incrementCounter('command.history.recorded');
  }

  getExecution(commandId: CommandId): CommandExecution | undefined {
    return this.log.find(e => e.execution.command.id === commandId)?.execution;
  }

  query(filters: { userId?: string; sessionId?: string; type?: string; fromTime?: number; toTime?: number }, limit: number = 50): CommandHistoryEntry[] {
    let results = this.log;
    if (filters.userId) results = results.filter(e => e.execution.command.metadata.userId === filters.userId);
    if (filters.sessionId) results = results.filter(e => e.execution.command.metadata.sessionId === filters.sessionId);
    if (filters.type) results = results.filter(e => e.execution.command.type === filters.type);
    if (filters.fromTime) results = results.filter(e => e.timestamp >= filters.fromTime!);
    if (filters.toTime) results = results.filter(e => e.timestamp <= filters.toTime!);
    return results.slice(-limit);
  }

  private async persist(): Promise<void> {
    await this.storage.set('command_history', JSON.stringify(this.log.slice(-5000)));
  }

  getSize(): number { return this.log.length; }
}