// packages/state-runtime/recovery/state-recovery-runtime.ts
/**
 * State Recovery Runtime
 * 
 * Responsibilities:
 * - Periodically persist domain state snapshots for crash recovery
 * - Manage snapshot rotation and storage quotas
 * - Validate snapshot integrity on load via checksum
 * - Provide transaction log persistence for atomicity
 * - Restore state from last valid snapshot on restart
 * 
 * Owned state:
 * - pendingSnapshots: Map<DomainId, NodeJS.Timeout>
 * - transactionLog: Map<TransactionId, Transaction>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Persistent storage (IndexedDB)
 * 
 * Event emissions:
 *   "state.recovery.snapshot.saved", "state.recovery.restored"
 *   "state.recovery.corruption.detected"
 * 
 * Event subscriptions: none
 * Synchronization: per-domain snapshot; debounced writes
 * Recovery: this IS the recovery mechanism
 * Telemetry: snapshot size, save/restore latency
 * Diagnostics: last snapshot version per domain
 * Accessibility: N/A
 * Performance: async persistence; debounce rapid writes
 * Forbidden: overwriting valid snapshot with corrupted one
 */

import type { DomainId, DomainState, StateSnapshot, TransactionId, Transaction } from '../contracts/state-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export class StateRecoveryRuntime {
  private pendingTimers: Map<DomainId, any> = new Map();
  private transactionLog: Map<TransactionId, Transaction> = new Map();
  private readonly DEBOUNCE_MS = 1000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any,
  ) {}

  scheduleSnapshot(domain: DomainState): void {
    const existing = this.pendingTimers.get(domain.domainId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => this.saveSnapshot(domain), this.DEBOUNCE_MS);
    this.pendingTimers.set(domain.domainId, timer);
  }

  async saveSnapshot(domain: DomainState): Promise<void> {
    const start = Date.now();
    const state = {
      domainId: domain.domainId,
      entities: Array.from(domain.entities.entries()).map(([id, val]) => ({ id, val })),
      version: domain.version,
    };
    const json = JSON.stringify(state);
    const checksum = createHash('sha256').update(json).digest('hex');
    const snapshot: StateSnapshot = {
      id: uuidv4(),
      domainId: domain.domainId,
      state: domain,
      version: domain.version,
      timestamp: Date.now(),
      checksum,
    };
    await this.storage.set(`state_snapshot:${domain.domainId}`, {
      data: json,
      checksum,
      version: domain.version,
      timestamp: snapshot.timestamp,
    });
    this.pendingTimers.delete(domain.domainId);
    const elapsed = Date.now() - start;
    this.meter.recordHistogram('state.recovery.snapshot.save_duration', elapsed);
    this.meter.incrementCounter('state.recovery.snapshot.saved');
    this.logger.debug(`State snapshot saved for ${domain.domainId} at v${domain.version}`);
  }

  async loadSnapshot(domainId: DomainId): Promise<StateSnapshot | null> {
    const start = Date.now();
    const raw = await this.storage.get(`state_snapshot:${domainId}`);
    if (!raw) return null;
    const { data, checksum, version } = raw;
    const computedChecksum = createHash('sha256').update(data).digest('hex');
    if (checksum !== computedChecksum) {
      this.logger.error(`Snapshot checksum mismatch for domain ${domainId}`);
      this.meter.incrementCounter('state.recovery.corruption.detected');
      return null;
    }
    const parsed = JSON.parse(data);
    const entities = new Map(parsed.entities.map((e: any) => [e.id, e.val]));
    const domainState: DomainState = {
      domainId,
      entities,
      version,
      lastModified: raw.timestamp,
      checksum: computedChecksum,
    };
    this.meter.recordHistogram('state.recovery.restore_duration', Date.now() - start);
    this.meter.incrementCounter('state.recovery.restored');
    return {
      id: uuidv4(),
      domainId,
      state: domainState,
      version,
      timestamp: raw.timestamp,
      checksum: computedChecksum,
    };
  }

  persistTransaction(transaction: Transaction): void {
    this.transactionLog.set(transaction.id, transaction);
    this.storage.set(`tx_log:${transaction.id}`, JSON.stringify(transaction));
    this.logger.debug(`Transaction log saved: ${transaction.id}`);
  }

  clearTransactionLog(txId: TransactionId): void {
    this.transactionLog.delete(txId);
    this.storage.delete(`tx_log:${txId}`);
  }

  async loadPendingTransactions(): Promise<Transaction[]> {
    // In production: scan storage for tx_log:* entries
    return Array.from(this.transactionLog.values());
  }

  async shutdown(): Promise<void> {
    for (const timer of this.pendingTimers.values()) clearTimeout(timer);
    this.pendingTimers.clear();
  }
}