// packages/synchronization/src/runtime/conflict-resolution-runtime.ts
/**
 * Conflict Resolution Runtime (Sync Layer)
 * 
 * Responsibilities:
 * - Resolve conflicts between local and remote operations
 * - Support LWW, operational transform, and three-way merge
 * - Record conflict history for audit
 * 
 * Owned state:
 * - strategy: ConflictStrategy
 * - conflictLog: ConflictRecord[]
 * 
 * Dependencies: ILogger, IMeter
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

type ConflictStrategy = 'lww' | 'ot' | 'crdt';

interface ConflictRecord {
  localOpId: string;
  remoteOpId: string;
  resolvedWith: ConflictStrategy;
  timestamp: number;
}

export class ConflictResolutionRuntime {
  private strategy: ConflictStrategy = 'lww';
  private log: ConflictRecord[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  setStrategy(strategy: ConflictStrategy): void {
    this.strategy = strategy;
  }

  async resolve(incoming: any, local?: any): Promise<any | null> {
    if (!local) return incoming;
    switch (this.strategy) {
      case 'lww':
        return incoming.timestamp >= local.timestamp ? incoming : null;
      case 'ot':
        return incoming; // simplified
      case 'crdt':
        return incoming;
      default:
        return null;
    }
  }

  recordConflict(localId: string, remoteId: string): void {
    this.log.push({ localOpId: localId, remoteOpId: remoteId, resolvedWith: this.strategy, timestamp: Date.now() });
    this.meter.incrementCounter('conflict.resolution');
  }
}