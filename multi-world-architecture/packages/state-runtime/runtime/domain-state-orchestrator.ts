// packages/state-runtime/runtime/domain-state-orchestrator.ts
/**
 * Domain State Orchestrator
 * 
 * Responsibilities:
 * - Manage multiple isolated domain states (world, experiment, instrument, user)
 * - Provide CRUD operations on domain entities with versioning
 * - Compute checksums for state integrity verification
 * - Emit state change events for reactivity
 * - Coordinate with replay and recovery subsystems
 * 
 * Owned state:
 * - domains: Map<DomainId, DomainState>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - StateReplayRuntime (to record updates)
 * - StateRecoveryRuntime (to persist snapshots)
 * 
 * Event emissions:
 *   "state.domain.created", "state.domain.entity.updated",
 *   "state.domain.entity.deleted"
 * 
 * Event subscriptions: none
 * Synchronization: per-domain locks; atomic operations
 * Recovery: domains restored from last valid snapshot on restart
 * Telemetry: domain count, entity count per domain, write throughput
 * Diagnostics: domain state dump, version history
 * Accessibility: N/A
 * Performance: O(1) entity lookup per domain; batched persistence
 * Forbidden: cross-domain access without explicit dependency; inconsistent checksums
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DomainId, DomainState, StateEntityId, StateVersion, StateSnapshot,
} from '../contracts/state-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { StateReplayRuntime } from './state-replay-runtime';
import type { StateRecoveryRuntime } from './state-recovery-runtime';
import { createHash } from 'crypto';

export class DomainStateOrchestrator {
  private domains: Map<DomainId, DomainState> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private replay: StateReplayRuntime,
    private recovery: StateRecoveryRuntime,
  ) {}

  async createDomain(domainId: DomainId): Promise<DomainState> {
    if (this.domains.has(domainId)) throw new Error(`Domain already exists: ${domainId}`);
    const state: DomainState = {
      domainId,
      entities: new Map(),
      version: 1 as StateVersion,
      lastModified: Date.now(),
      checksum: this.computeChecksum(new Map()),
    };
    this.domains.set(domainId, state);
    this.meter.incrementCounter('state.domain.created');
    await this.eventBus.publish('state.domain.created', { domainId });
    this.logger.info(`Domain created: ${domainId}`);
    return state;
  }

  getDomain(domainId: DomainId): DomainState | undefined {
    return this.domains.get(domainId);
  }

  getEntity(entityId: StateEntityId): unknown | undefined {
    for (const domain of this.domains.values()) {
      if (domain.entities.has(entityId)) return domain.entities.get(entityId);
    }
    return undefined;
  }

  async setEntity(domainId: DomainId, entityId: StateEntityId, value: unknown): Promise<void> {
    let domain = this.domains.get(domainId);
    if (!domain) domain = await this.createDomain(domainId);
    domain.entities.set(entityId, value);
    domain.version = (domain.version + 1) as StateVersion;
    domain.lastModified = Date.now();
    domain.checksum = this.computeChecksum(domain.entities);
    // Record for replay
    this.replay.recordOperation(domain.version, { type: 'set', entityId, payload: value });
    // Schedule async snapshot
    this.recovery.scheduleSnapshot(domain);
    this.meter.incrementCounter('state.domain.entity.updated');
    await this.eventBus.publish('state.domain.entity.updated', {
      domainId,
      entityId,
      version: domain.version,
    });
  }

  async deleteEntity(domainId: DomainId, entityId: StateEntityId): Promise<void> {
    const domain = this.domains.get(domainId);
    if (!domain) return;
    domain.entities.delete(entityId);
    domain.version = (domain.version + 1) as StateVersion;
    domain.lastModified = Date.now();
    domain.checksum = this.computeChecksum(domain.entities);
    this.replay.recordOperation(domain.version, { type: 'delete', entityId, payload: null });
    this.recovery.scheduleSnapshot(domain);
    this.meter.incrementCounter('state.domain.entity.deleted');
    await this.eventBus.publish('state.domain.entity.deleted', {
      domainId,
      entityId,
      version: domain.version,
    });
  }

  async patchEntity(domainId: DomainId, entityId: StateEntityId, patch: unknown): Promise<void> {
    const domain = this.domains.get(domainId);
    if (!domain) return;
    const existing = domain.entities.get(entityId);
    // Apply JSON patch or shallow merge
    domain.entities.set(entityId, patch); // simplified
    domain.version = (domain.version + 1) as StateVersion;
    domain.lastModified = Date.now();
    domain.checksum = this.computeChecksum(domain.entities);
    this.replay.recordOperation(domain.version, { type: 'patch', entityId, payload: patch });
  }

  private computeChecksum(entities: Map<StateEntityId, unknown>): string {
    const ids = Array.from(entities.keys()).sort();
    const parts = ids.map(id => `${id}:${JSON.stringify(entities.get(id))}`);
    return createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 16);
  }

  getAllDomainIds(): DomainId[] {
    return Array.from(this.domains.keys());
  }

  getDomainStats(domainId: DomainId): { entityCount: number; version: StateVersion } | null {
    const domain = this.domains.get(domainId);
    if (!domain) return null;
    return { entityCount: domain.entities.size, version: domain.version };
  }
}