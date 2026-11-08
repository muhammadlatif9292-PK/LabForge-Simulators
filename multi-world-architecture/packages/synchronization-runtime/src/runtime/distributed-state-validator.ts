// packages/synchronization-runtime/src/runtime/distributed-state-validator.ts
/**
 * Distributed State Validator
 * 
 * Responsibilities:
 * - Validate that an operation can be safely applied to the local state
 * - Check preconditions, schema compliance, and integrity constraints
 * - Verify state hashes after applying operations to detect corruption
 * - Maintain a manifest of expected state invariants
 * 
 * Owned state:
 * - invariants: StateInvariant[] (rules that must hold)
 * - lastValidatedHash: StateHash
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - (Optionally) a schema registry for operation payloads
 * 
 * Event emissions:
 * - "sync.validation.failed", "sync.invariant.violation"
 * 
 * Event subscriptions: none
 * Synchronization: none (local state comparison)
 * Recovery: if validation fails, trigger full state repair from peer
 * Telemetry: validation pass/fail counts, invariant violation types
 * Diagnostics: last validation result, active invariants
 * Accessibility: N/A
 * Performance: O(1) invariant checks; async for heavy validation
 * Forbidden: allowing invalid operations to corrupt state
 */

import type { SyncOperation, SyncState, StateHash } from '../contracts/sync-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { createHash } from 'crypto';

interface StateInvariant {
  name: string;
  check: (operation: SyncOperation, state: SyncState) => boolean;
  severity: 'error' | 'warning';
}

export class DistributedStateValidator {
  private invariants: StateInvariant[] = [];
  private lastValidatedHash: StateHash | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Register built-in invariants
    this.registerInvariant({
      name: 'sequence_monotonic',
      check: (op, state) => op.sequenceNumber > state.lastSequence,
      severity: 'error',
    });
    this.registerInvariant({
      name: 'timestamp_reasonable',
      check: (op, _state) => {
        const now = Date.now();
        // Operation timestamp should not be more than 5 minutes in the future
        return op.timestamp <= now + 300_000;
      },
      severity: 'warning',
    });
    this.registerInvariant({
      name: 'user_id_present',
      check: (op, _state) => !!op.userId && op.userId.length > 0,
      severity: 'error',
    });
  }

  registerInvariant(invariant: StateInvariant): void {
    this.invariants.push(invariant);
    this.logger.debug(`State invariant registered: ${invariant.name}`);
  }

  validateOperation(operation: SyncOperation, state: SyncState): boolean {
    for (const invariant of this.invariants) {
      const passed = invariant.check(operation, state);
      if (!passed) {
        const message = `Invariant violation: ${invariant.name} for operation ${operation.id}`;
        if (invariant.severity === 'error') {
          this.meter.incrementCounter('sync.validation.failed');
          this.logger.error(message, { operationId: operation.id, invariant: invariant.name });
          return false;
        } else {
          this.logger.warn(message, { operationId: operation.id, invariant: invariant.name });
        }
      }
    }
    this.meter.incrementCounter('sync.validation.passed');
    return true;
  }

  validateStateHash(operations: SyncOperation[], expectedHash: StateHash): boolean {
    const concatenated = operations
      .map(o => `${o.id}:${o.type}:${o.timestamp}`)
      .join('|');
    const computedHash = createHash('sha256').update(concatenated).digest('hex').substring(0, 16) as StateHash;
    const match = computedHash === expectedHash;
    if (!match) {
      this.meter.incrementCounter('sync.hash.mismatch');
      this.logger.error(`State hash mismatch: expected ${expectedHash}, computed ${computedHash}`);
    }
    this.lastValidatedHash = computedHash;
    return match;
  }

  getLastValidatedHash(): StateHash | null {
    return this.lastValidatedHash;
  }
}